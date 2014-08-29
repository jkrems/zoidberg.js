/* jshint node:true */
'use strict';

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var analyzeVisitors = {
  ValueDeclaration: function(node, env, nonGeneric) {
    var bodyType = analyze(node.body, env, nonGeneric);
    var nodeType = node.dataType;
    if (nodeType) throw new Error('Not implemented');

    return (env[node.name] = bodyType);
  }
};

function analyze(node, env, nonGeneric) {
  nonGeneric = nonGeneric || [];
  try {
    var nodeType = node.visit(analyzeVisitors, env, nonGeneric);
  } catch (err) {
    console.log(node);
    throw err;
  }

  debug('analyze %s', node.type, nodeType);
}

// Run algorithm W on a program/module
function infer(program) {
  var env = {};
  _.each(program.body, function(line) {
    analyze(line, env);
  });
  return program;
}
module.exports = _.extend(infer);
