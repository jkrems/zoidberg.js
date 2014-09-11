/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var TypeSystem = require('../types');
var ZB = require('../ast');

var SymbolTable = require('./symbol-table');

function slice(arr, start, end) {
  if (!arr) return undefined;

  if (end < 0) { end = arr.length + end; }
  return arr.slice(start, end);
}

function getParamTypes(functionType) {
  return slice(functionType && functionType.types, 0, -1);
}

function getReturnType(functionType) {
  if (!functionType || !functionType.types) return undefined;
  return functionType.types[functionType.types.length - 1];
}

function Analyzer(Types) {
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
      var paramTypes = _.map(getParamTypes(node.dataType),
        function(paramType, idx) {
          var name = node.params[idx];
          paramType = env.resolveTypeRef(paramType);
          if (paramType === undefined) {
            paramType = new Types.TypeVariable();
          }
          return bodyEnv.addWithType(name, paramType);
        });
      var returnType = env.resolveTypeRef(
        node.dataType && getReturnType(node.dataType));

      // Examples for functions without body: ADT constructors
      var bodyType;
      if (node.body) {
        bodyType = analyze(node.body, bodyEnv, nonGeneric);

        if (returnType) {
          Types.unify(bodyType, returnType);
        }
      } else {
        bodyType = returnType;
      }

      var fnType = Types.FunctionType.withTypes(paramTypes.concat([bodyType]));

      return env.addWithType(node.name, fnType);
    },

    EnumExpression: function(node, env, nonGeneric) {
      var dataType = node.dataType;
      var metaType = dataType.dataType;
      var statics = _.each(node.constructors, function(ctor) {
        var ctorType;
        if (ctor.type === 'FunctionDeclaration') {
          ctorType = analyze(ctor, env, nonGeneric);
          ctorType.types[ctorType.types.length - 1] = dataType;
        } else {
          // TypeDeclaration (for param-less constructors)
          ctorType = dataType;
        }
        ctor.dataType = Types.safeCopy(ctorType);
        debug('%s has constructor %s: %s', dataType, ctor.name, ctor.dataType);
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

      var metaType = new Types.ParametricType(
        node.name + '%Meta',
        false,
        [], // params
        [], // props
        [], // state
        null);

      var self = new Types.ParametricType(
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
        // TODO: restrict this
        // throw new Error('Undeclared identifier: ' + node.name);
        dataType = new Types.TypeVariable();
        env.addWithType(node.name, dataType);
        return dataType;
      }
      return dataType;
    },

    FCallExpression: function(node, env, nonGeneric) {
      if (node.callee.name === 'printf') {
        // TMP TMP TMP
        return;
      }

      var calleeType = Types.safeCopy(analyze(node.callee, env, nonGeneric));

      if (!Types.isCallable(calleeType)) {
        var calleeName = node.callee.name || '<unknown>';
        throw new Error(
          util.format(
            'Tried to call non-function %s: %s', calleeName, calleeType));
      }

      var argTypes = node.args.map(function(arg) {
        return analyze(arg, env, nonGeneric);
      });

      var callType = Types.FunctionType.withTypes(
        argTypes.concat([new Types.TypeVariable()]));

      debug('Unify call %s of function with type %s', callType, calleeType);
      Types.unify(calleeType, callType);
      debug('Unified: %s', calleeType);

      return getReturnType(callType);
    },

    ListExpression: function(node, env, nonGeneric) {
      var expressionTypes = node.body.map(function(expr) {
        return analyze(expr, env, nonGeneric);
      });
      return expressionTypes[expressionTypes.length - 1];
    },

    MatchExpression: function(node, env, nonGeneric) {
      var target = node.target, targetType;
      if (target) {
        targetType = analyze(target, env, nonGeneric);
      } else {
        targetType = env.get('Bool');
      }
      debug('Target/condition type: %s', targetType);

      var resultType = node.cases.reduce(function(knownType, caseClause) {
        var casesymbolToType = env.clone();
        casesymbolToType.addWithType('matchTarget$$', targetType);

        var conditionType =
          analyze(caseClause.condition, casesymbolToType, nonGeneric);
        Types.unify(conditionType, env.get('Bool'));

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
      var leftType = analyze(node.left, env, nonGeneric);
      var rightType = analyze(node.right, env, nonGeneric);
      if (node.operator === '==' || node.operator === '!=') {
        Types.unify(leftType, rightType);
        return env.get('Bool');
      }
      return leftType;
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
      var itemsType = _.reduce(node.items, function(currentGuess, item) {
        var itemType = analyze(item, env, nonGeneric);
        Types.unify(currentGuess, itemType);
        return currentGuess;
      }, new Types.TypeVariable());

      return Types.ArrayType.withTypes([itemsType]);
    }
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

  return analyze;
};

// Run algorithm W on a program/module
function infer(program, typeSystem) {
  typeSystem = typeSystem || TypeSystem();

  var env = new SymbolTable(
    typeSystem.getBuiltIns(), typeSystem.generateVariable);

  _.each(program.body, function(line) {
    Analyzer(typeSystem)(line, env);
  });

  // Resolve temporary type variables
  ZB.traverseDF(program, function(node) {
    if (node.dataType) {
      node.dataType = typeSystem.prune(node.dataType);
    }
  });

  return program;
}
module.exports = _.extend(infer);
