'use strict';

var _ = require('lodash');

var selfCall = require('./self-call');

function compileBindingPattern(rootBinding, targetRef) {
  // 1. Collect placeholder names
  // 2. Collect equality constraints
  var bound = {}; // name:String to { ref:Identifier, init:Expression }
  var constraints = [];

  function visitBinding(binding, targetPath) {
    switch (binding.type) {
      case 'FCallExpression':
        console.error('Ctor binding', binding, targetPath);
        break;

      default:
        throw new Error('Unsupported binding: ' + binding.type);
    }
  }

  visitBinding(rootBinding, targetRef);

  console.error(bound, constraints);

  return [];
}

function compileMatchExpression(node, processNode) {
  var targetId = '$$matchTarget';
  var targetRef = { type: 'Identifier', name: targetId };

  var matchSteps = _.map(node.cases, function(matchCase) {
    var conditionType = matchCase.condition.type;
    switch (conditionType) {
      case 'BindingPattern':
        return compileBindingPattern(
          matchCase.condition.bindings,
          targetRef,
          processNode
        );

      case 'MatchAllPattern':
        console.error('MatchAllPattern');
        return [];

      default:
        throw new Error('Unknown condition type: ' + conditionType);
    }
  }, []);
  var matchInit =
    Array.prototype.slice.apply(matchSteps[0], matchSteps.slice(1));

  matchInit.push({
    type: 'ReturnStatement',
    argument: {
      type: 'Literal',
      value: 42
    }
  });

  var matchInitBindings = {};
  matchInitBindings[targetId] = processNode(node.target);
  return selfCall(matchInit, matchInitBindings);
}

module.exports = compileMatchExpression;
