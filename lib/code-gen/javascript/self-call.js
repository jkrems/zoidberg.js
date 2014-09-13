'use strict';

var _ = require('lodash');

function selfCall(body, argumentMap) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'FunctionExpression',
      params: _.map(argumentMap, function(value, param) {
        return { type: 'Identifier', name: param };
      }),
      defaults: [],
      body: {
        type: 'BlockStatement',
        body: body
      }
    },
    arguments: _.map(argumentMap, function(value) {
      return value;
    })
  };
}

module.exports = selfCall;
