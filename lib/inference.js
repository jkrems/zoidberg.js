/* jshint node:true */
'use strict';

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var Types = require('./types');

var analyzeVisitors = {
  ValueDeclaration: function(node, env, nonGeneric) {
    var bodyType = analyze(node.body, env, nonGeneric);
    var nodeType = node.dataType;
    if (nodeType) throw new Error('Not implemented');

    return (env[node.name] = bodyType);
  },

  FunctionDeclaration: function(node, env, nonGeneric) {
    var bodyEnv = _.clone(env);
    var paramTypes = _.map(node.params, function(param) {
      // todo: look at node.dataType.paramTypes
      // todo: resolve data types from environment
      var paramType = analyze(param, env, nonGeneric);
      if (paramType === undefined) {
        paramType = new Types.TypeVariable();
      }
      bodyEnv[param.name] = paramType;
      return paramType;
    });
    var bodyType = analyze(node.body, bodyEnv, nonGeneric);
    // todo: check bodyType vs. returnType
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
    return node.dataType;
  }
};

function analyze(node, env, nonGeneric) {
  nonGeneric = nonGeneric || [];

  // try to resolve type references first
  if (node.dataType instanceof Types.TypeReference) {
    var refType = env[node.dataType.name];
    debug('Resolving %s -> %s', node.dataType, refType);
    if (refType === undefined) {
      refType = new Types.TypeVariable();
      env[node.dataType.name] = refType;
    }
    node.dataType = refType;
  }

  try {
    var nodeType = node.visit(analyzeVisitors, env, nonGeneric);
  } catch (err) {
    console.log(node);
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
