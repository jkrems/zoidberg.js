/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var Types = require('./types');

var analyzeVisitors = {
  ValueDeclaration: function(node, env, nonGeneric) {
    var bodyType = analyze(node.body, env, nonGeneric);
    var nodeType = node.dataType;
    if (nodeType) {
      Types.unify(bodyType, nodeType);
    }

    return (env[node.name] = bodyType);
  },

  FunctionDeclaration: function(node, env, nonGeneric) {
    var bodyEnv = _.clone(env);
    var paramTypes = _.map(node.params, function(param) {
      // todo: look at node.dataType.paramTypes
      // todo: resolve data types from environment
      var paramType = analyze(param, env, nonGeneric);
      bodyEnv[param.name] = paramType;
      return paramType;
    });
    var returnType = resolveTypeRef(node.dataType && node.dataType.returnType, env);
    var bodyType = analyze(node.body, bodyEnv, nonGeneric);

    if (returnType) {
      Types.unify(bodyType, returnType);
    }

    return new Types.FunctionType(paramTypes, bodyType);
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

  Parameter: function(node, env, nonGeneric) {
    if (!node.dataType) {
      return new Types.TypeVariable();
    }
    return node.dataType;
  },

  AddExpression: function(node, env, nonGeneric) {
    // TODO: actually handle stuff like Addable/operators
    // For now, we assume that the left side forces the type
    return analyze(node.left, env, nonGeneric);
  }
};

function resolveTypeRef(dataType, env) {
  if (!(dataType instanceof Types.TypeReference)) {
    return dataType;
  }

  var refType = env[dataType.name];
  debug('Resolving %s -> %s', dataType, refType);
  if (refType === undefined) {
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
  return program;
}
module.exports = _.extend(infer);
