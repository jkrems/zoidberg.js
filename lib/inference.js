/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var Types = require('./types');
var ZB = require('./ast');

var analyzeVisitors = {
  ValueDeclaration: function(node, env, nonGeneric) {
    var bodyType = analyze(node.body, env, nonGeneric);
    var nodeType = node.dataType;
    if (nodeType) {
      Types.unify(bodyType, nodeType);
    }

    return env.addWithType(node.name, bodyType);
  },

  FunctionDeclaration: function(node, env, nonGeneric) {
    var bodyEnv = env.clone();
    var nodeTypeParams = node.dataType && node.dataType.paramTypes;
    var paramTypes = _.map(node.dataType.paramTypes, function(paramType, idx) {
      var name = node.params[idx];
      paramType = env.resolveTypeRef(paramType);
      if (paramType === undefined) {
        paramType = new Types.TypeVariable();
      }
      return bodyEnv.addWithType(name, paramType);
    });
    var returnType = env.resolveTypeRef(node.dataType && node.dataType.returnType);

    // Examples for functions without body: ADT constructors
    if (node.body) {
      var bodyType = analyze(node.body, bodyEnv, nonGeneric);

      if (returnType) {
        Types.unify(bodyType, returnType);
      }
    } else {
      bodyType = returnType;
    }

    var fnType = new Types.FunctionType(paramTypes, bodyType);

    return env.addWithType(node.name, fnType);
  },

  EnumExpression: function(node, env, nonGeneric) {
    var dataType = node.dataType;
    var metaType = dataType.dataType;
    var statics = _.each(node.constructors, function(ctor) {
      if (ctor.type === 'FunctionDeclaration') {
        var ctorType = analyze(ctor, env, nonGeneric);
        ctorType.returnType = dataType;
      } else {
        // TypeDeclaration (for param-less constructors)
        ctor.dataType = Types.safeCopy(dataType);
      }
      metaType.props.push(ctor);
    });

    return dataType;
  },

  TypeDeclaration: function(node, env, nonGeneric) {
    var bodyEnv = env.clone();
    var params = node.params.map(function(param) {
      if (param.dataType !== undefined) {
        throw new Error('Typed type params are not supported (yet?)');
      }
      return bodyEnv.set(param.name, new Types.TypeVariable());
    });

    var metaType = new Types.BaseType(
      node.name + '%Meta',
      false,
      [], // params
      [], // props
      [], // state
      null);

    var self = new Types.BaseType(
      node.name, // name
      false, // primitive
      params, // params/BaseType.types
      [], // props/public
      [], // state/private
      metaType); // dataType

    env.set(node.name, self);
    bodyEnv.set(node.name, self);
    node.body.dataType = self;
    analyze(node.body, bodyEnv, nonGeneric);

    return self.dataType;
  },

  LiteralExpression: function(node, env, nonGeneric) {
    // todo: take context into account for qualified types/more complex types
    return node.dataType;
  },

  IdentifierExpression: function(node, env, nonGeneric) {
    var dataType = env.getType(node.name);
    if (dataType === undefined) {
      throw new Error('Undeclared identifier: ' + node.name);
    }
    return dataType;
  },

  FCallExpression: function(node, env, nonGeneric) {
    if (node.callee.name === 'printf') {
      // TMP TMP TMP
      return;
    }

    var calleeType = Types.safeCopy(analyze(node.callee, env, nonGeneric));

    if (!calleeType instanceof Types.FunctionType) {
      throw new Error('Tried to call non-function');
    }

    var argTypes = node.args.map(function(arg) {
      return analyze(arg, env, nonGeneric);
    });

    var callType = new Types.FunctionType(
      argTypes, new Types.TypeVariable());

    debug('Unify call %s of function with type %s', callType, calleeType);
    Types.unify(calleeType, callType);
    debug('Unified: %s', calleeType);

    return callType.returnType;
  },

  ListExpression: function(node, env, nonGeneric) {
    var expressionTypes = node.body.map(function(expr) {
      return analyze(expr, env, nonGeneric);
    });
    return expressionTypes[expressionTypes.length - 1];
  },

  MatchExpression: function(node, env, nonGeneric) {
    var targetType = analyze(node.target, env, nonGeneric);

    var resultType = node.cases.reduce(function(knownType, caseClause) {
      var casesymbolToType = env.clone();
      casesymbolToType['matchTarget$$'] = targetType;
      var caseType = analyze(caseClause.body, casesymbolToType, nonGeneric);
      if (knownType) {
        Types.unify(knownType, caseType);
        return knownType;
      } else {
        return caseType;
      }
    }, node.dataType);

    return resultType;
  },

  BinaryExpression: function(node, env, nonGeneric) {
    // TODO: actually handle stuff like Addable/operators
    // For now, we assume that the left side forces the type
    return analyze(node.left, env, nonGeneric);
  },

  MemberAccessExpression: function(node, env, nonGeneric) {
    var baseType = analyze(node.base, env, nonGeneric);

    var member = _.find(baseType.props, { name: node.field });

    if (!member) {
      // TODO: how to handle non-existing members..?
      // Add TypeVariable? Throw error? Depending on what..?
      throw new Error('This one\'s a bit tricky...');
    }
    return member.dataType;
  },

  ArrayExpression: function(node, env, nonGeneric) {
    var items = node.items;
    if (items.length < 1) {
      return new Types.ArrayType(new Types.TypeVariable());
    }
    var itemType = analyze(items[0], env, nonGeneric);
    return new Types.ArrayType(itemType);
  }
};

function SymbolTable(base) {
  this._table = {};
  if (base) {
    _.extend(this._table, base);
  }
}

SymbolTable.prototype.clone = function() {
  return new SymbolTable(this._table);
};

SymbolTable.prototype.getType = function(id) {
  var symbol = this.get(id);
  return (symbol ? symbol.dataType : undefined);
};

SymbolTable.prototype.get = function(id) {
  return this._table[id];
};

SymbolTable.prototype._set = function(id, value) {
  this._table[id] = value;
  return value;
};

SymbolTable.prototype.set = function(id, value) {
  debug('Adding %s = %s', id, value);
  return this._set(id, value);
};

SymbolTable.prototype.addWithType = function(id, dataType) {
  debug('Adding %s w/ type %s', id, dataType);
  this._set(id, { dataType: dataType });
  return dataType;
};

SymbolTable.prototype.resolveTypeRef = function(dataType) {
  if (!(dataType instanceof Types.TypeReference)) {
    return dataType;
  }

  var refType = this.get(dataType.name);
  debug('Resolving %s -> %s', dataType, refType);
  if (refType === undefined) {
    if (!dataType.isGeneric) {
      throw new Error('Unknown type: ' + dataType.name);
    }
    refType = this.set(dataType.name, new Types.TypeVariable());
  }
  return refType;
};

// scope -> DataType .dataType -> TypeType .dataType -> "Type"
// scope -> Node     .dataType -> DataType .dataType -> TypeType .dataType -> "Type"
//
// e.g. with `X(t) = enum ...`   : scope[X] = DataType{types:[@2], dataType => {<statics>}}@1
//                                 scope[t] = TypeVariable{}@2
//      with `f(v: X(Int)) = ...`: scope[Int] = IntType@3
//                                 scope[X] = @1
//                                 scope[v] = Symbol{name => "v", dataType => @1 & types[@3]}
//                                             ^^^ could also be {Value,Function}Declaration
//
// @1 & types[@3] -> TypeInstance? E.g. taking a general type and specializing it?
//                                 Should be subset of original type.
//
// env.lookup(id) -> scope[id]
// env.getType(id) -> scope[id].dataType

function analyze(node, env, nonGeneric) {
  nonGeneric = nonGeneric || [];

  // try to resolve type references first
  node.dataType = env.resolveTypeRef(node.dataType);

  try {
    var nodeType = node.visit(analyzeVisitors, env, nonGeneric);
  } catch (err) {
    debug('analyze throws %j', err.message, node);
    throw err;
  }

  debug('analyze %s: %s -> %s', node.type, node.dataType, nodeType);
  node.dataType = nodeType;
  return nodeType;
}

// Run algorithm W on a program/module
function infer(program) {
  var env = new SymbolTable(Types.getBuiltIns());
  _.each(program.body, function(line) {
    analyze(line, env);
  });

  // Resolve temporary type variables
  ZB.traverseDF(program, function(node) {
    if (node.dataType) {
      node.dataType = Types.prune(node.dataType);
    }
  });

  return program;
}
module.exports = _.extend(infer);
