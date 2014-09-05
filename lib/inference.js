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

    debug('Adding %s is %s', node.name, bodyType);
    return (env[node.name] = bodyType);
  },

  FunctionDeclaration: function(node, env, nonGeneric) {
    var bodyEnv = _.clone(env);
    var nodeTypeParams = node.dataType && node.dataType.paramTypes;
    var paramTypes = _.map(node.dataType.paramTypes, function(paramType, idx) {
      var name = node.params[idx];
      paramType = resolveTypeRef(paramType, env);
      if (paramType === undefined) {
        paramType = new Types.TypeVariable();
      }
      bodyEnv[name] = paramType;
      return paramType;
    });
    var returnType = resolveTypeRef(node.dataType && node.dataType.returnType, env);
    var bodyType = analyze(node.body, bodyEnv, nonGeneric);

    if (returnType) {
      Types.unify(bodyType, returnType);
    }

    var fnType = new Types.FunctionType(paramTypes, bodyType);

    debug('Adding %s is %s', node.name, fnType);
    return (env[node.name] = fnType);
  },

  LiteralExpression: function(node, env, nonGeneric) {
    // todo: take context into account for qualified types/more complex types
    return node.dataType;
  },

  IdentifierExpression: function(node, env, nonGeneric) {
    var envType = env[node.name];
    if (envType === undefined) {
      throw new Error('Undeclared identifier: ' + node.name);
    }
    return envType;
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
      var caseEnv = _.clone(env);
      caseEnv['matchTarget$$'] = targetType;
      var caseType = analyze(caseClause.body, caseEnv, nonGeneric);
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

  ArrayExpression: function(node, env, nonGeneric) {
    var items = node.items;
    if (items.length < 1) {
      return new Types.ArrayType(new Types.TypeVariable());
    }
    var itemType = analyze(items[0], env, nonGeneric);
    return new Types.ArrayType(itemType);
  }
};

function resolveTypeRef(dataType, env) {
  if (!(dataType instanceof Types.TypeReference)) {
    return dataType;
  }

  var refType = env[dataType.name];
  debug('Resolving %s -> %s', dataType, refType);
  if (refType === undefined) {
    if (!dataType.isGeneric) {
      throw new Error('Unknown type: ' + dataType.name);
    }
    refType = new Types.TypeVariable();
    env[dataType.name] = refType;
  }
  return refType;
}

function analyze(node, env, nonGeneric) {
  nonGeneric = nonGeneric || [];

  // try to resolve type references first
  node.dataType = resolveTypeRef(node.dataType, env);

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
  var env = Types.getBuiltIns();
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
