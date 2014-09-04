/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var Types = require('./types');
var ZB = require('./ast');

var analyzeVisitors = {
  ValueDeclaration: function(node, symbolToType, nonGeneric) {
    var bodyType = analyze(node.body, symbolToType, nonGeneric);
    var nodeType = node.dataType;
    if (nodeType) {
      Types.unify(bodyType, nodeType);
    }

    debug('Adding %s is %s', node.name, bodyType);
    return (symbolToType[node.name] = bodyType);
  },

  FunctionDeclaration: function(node, symbolToType, nonGeneric) {
    var bodysymbolToType = _.clone(symbolToType);
    var nodeTypeParams = node.dataType && node.dataType.paramTypes;
    var paramTypes = _.map(node.dataType.paramTypes, function(paramType, idx) {
      var name = node.params[idx];
      paramType = resolveTypeRef(paramType, symbolToType);
      if (paramType === undefined) {
        paramType = new Types.TypeVariable();
      }
      bodysymbolToType[name] = paramType;
      return paramType;
    });
    var returnType = resolveTypeRef(node.dataType && node.dataType.returnType, symbolToType);

    // Examples for functions without body: ADT constructors
    if (node.body) {
      var bodyType = analyze(node.body, bodysymbolToType, nonGeneric);

      if (returnType) {
        Types.unify(bodyType, returnType);
      }
    } else {
      bodyType = returnType;
    }

    var fnType = new Types.FunctionType(paramTypes, bodyType);

    debug('Adding %s is %s', node.name, fnType);
    return (symbolToType[node.name] = fnType);
  },

  EnumExpression: function(node, symbolToType, nonGeneric) {
    var statics = node.constructors.map(function(ctor) {
      if (ctor.type === 'FunctionDeclaration') {
        var ctorType = analyze(ctor, symbolToType, nonGeneric);
        ctorType.returnType = node.dataType;
      } else {
        // TypeDeclaration (for param-less constructors)
        ctor.dataType = node.dataType;
      }
      return ctor;
    });

    return new Types.BaseType(
      undefined, // name
      false, // primitive
      undefined, // params/BaseType.types
      [], // props/public
      [], // state/private
      statics);
  },

  TypeDeclaration: function(node, symbolToType, nonGeneric) {
    var params = node.params.map(function(param) {
      var typeParam = new Types.TypeVariable();
      symbolToType[param] = typeParam;
      return typeParam;
    });
    var self = new Types.BaseType(
      node.name, // name
      false, // primitive
      params, // params/BaseType.types
      [], // props/public
      [], // state/private
      []); // statics
    symbolToType[node.name] = self;
    node.body.dataType = self;
    var defType = analyze(node.body, symbolToType, nonGeneric);

    Types.unify(self, defType);
    return self;
  },

  LiteralExpression: function(node, symbolToType, nonGeneric) {
    // todo: take context into account for qualified types/more complex types
    return node.dataType;
  },

  IdentifierExpression: function(node, symbolToType, nonGeneric) {
    var symbolToTypeType = symbolToType[node.name];
    if (symbolToTypeType === undefined) {
      throw new Error('Undeclared identifier: ' + node.name);
    }
    return symbolToTypeType;
  },

  FCallExpression: function(node, symbolToType, nonGeneric) {
    if (node.callee.name === 'printf') {
      // TMP TMP TMP
      return;
    }

    var calleeType = Types.safeCopy(analyze(node.callee, symbolToType, nonGeneric));

    if (!calleeType instanceof Types.FunctionType) {
      throw new Error('Tried to call non-function');
    }

    var argTypes = node.args.map(function(arg) {
      return analyze(arg, symbolToType, nonGeneric);
    });

    var callType = new Types.FunctionType(
      argTypes, new Types.TypeVariable());

    debug('Unify call %s of function with type %s', callType, calleeType);
    Types.unify(calleeType, callType);
    debug('Unified: %s', calleeType);

    return callType.returnType;
  },

  ListExpression: function(node, symbolToType, nonGeneric) {
    var expressionTypes = node.body.map(function(expr) {
      return analyze(expr, symbolToType, nonGeneric);
    });
    return expressionTypes[expressionTypes.length - 1];
  },

  MatchExpression: function(node, symbolToType, nonGeneric) {
    var targetType = analyze(node.target, symbolToType, nonGeneric);

    var resultType = node.cases.reduce(function(knownType, caseClause) {
      var casesymbolToType = _.clone(symbolToType);
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

  BinaryExpression: function(node, symbolToType, nonGeneric) {
    // TODO: actually handle stuff like Addable/operators
    // For now, we assume that the left side forces the type
    return analyze(node.left, symbolToType, nonGeneric);
  },

  ArrayExpression: function(node, symbolToType, nonGeneric) {
    var items = node.items;
    if (items.length < 1) {
      return new Types.ArrayType(new Types.TypeVariable());
    }
    var itemType = analyze(items[0], symbolToType, nonGeneric);
    return new Types.ArrayType(itemType);
  }
};

function resolveTypeRef(dataType, symbolToType) {
  if (!(dataType instanceof Types.TypeReference)) {
    return dataType;
  }

  var refType = symbolToType[dataType.name];
  debug('Resolving %s -> %s', dataType, refType);
  if (refType === undefined) {
    if (!dataType.isGeneric) {
      throw new Error('Unknown type: ' + dataType.name);
    }
    refType = new Types.TypeVariable();
    symbolToType[dataType.name] = refType;
  }
  return refType;
}

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
// lookup(symbolToType, id) -> scope[id]
// getType(symbolToType, id) -> scope[id].dataType

function analyze(node, symbolToType, nonGeneric) {
  nonGeneric = nonGeneric || [];

  // try to resolve type references first
  node.dataType = resolveTypeRef(node.dataType, symbolToType);

  try {
    var nodeType = node.visit(analyzeVisitors, symbolToType, nonGeneric);
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
  var symbolToType = Types.getBuiltIns();
  _.each(program.body, function(line) {
    analyze(line, symbolToType);
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
