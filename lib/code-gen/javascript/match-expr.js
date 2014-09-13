'use strict';

var _ = require('lodash');

var selfCall = require('./self-call');

function compileBindingPattern(rootBinding, body, targetRef, processNode) {
  // 1. Collect placeholder names
  // 2. Collect equality constraints
  var bound = {}; // name:String to { ref:Identifier, init:Expression }
  var constraints = [];

  function visitBinding(binding, targetPath) {
    switch (binding.type) {
      case 'FCallExpression':
        constraints.push({
          type: 'BinaryExpression',
          operator: 'instanceof',
          left: targetPath,
          right: processNode(binding.callee)
        });

        _.each(binding.args, function(arg, idx) {
          var argPath = {
            type: 'MemberExpression',
            object: targetPath,
            property: { type: 'Identifier', name: '$' + idx }
          };
          visitBinding(arg, argPath);
        });
        break;

      case 'IdentifierExpression':
        if (!bound.hasOwnProperty(binding.name)) {
          bound[binding.name] = {
            ref: { type: 'Identifier', name: binding.name },
            init: targetPath
          };
        } else {
          throw new Error('Not implemented');
        }
        break;

      case 'LiteralExpression':
        constraints.push({
          type: 'BinaryExpression',
          operator: '===',
          left: targetPath,
          right: {
            type: 'Literal',
            value: binding.value
          }
        });
        break;

      default:
        throw new Error('Unsupported binding: ' + binding.type);
    }
  }

  visitBinding(rootBinding, targetRef);

  var varDeclarations = {
    type: 'VariableDeclaration',
    declarations: _.map(bound, function(spec) {
      return {
        type: 'VariableDeclarator',
        id: spec.ref,
        init: null
      };
    }),
    kind: 'var'
  };

  if (varDeclarations.declarations.length) {
    varDeclarations = [ varDeclarations ];
  } else {
    varDeclarations = [];
  }

  var assignments = _.map(bound, function(spec) {
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: spec.ref,
        right: spec.init
      }
    };
  });

  var condition = _.reduce(constraints, function(left, right) {
    return {
      type: 'BinaryExpression',
      operator: '&&',
      left: left,
      right: right
    };
  });

  var testAndReturn =
    condition ? {
      type: 'IfStatement',
      test: condition,
      consequent: { type: 'ReturnStatement', argument: body }
    } : {
      type: 'ReturnStatement',
      argument: body
    };

  return varDeclarations.concat(assignments, [ testAndReturn ]);
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
          processNode(matchCase.body),
          targetRef,
          processNode
        );

      case 'CatchAllPattern':
        return [
          {
            type: 'ReturnStatement',
            argument: processNode(matchCase.body)
          }
        ];

      default:
        throw new Error('Unknown condition type: ' + conditionType);
    }
  });
  var matchInit =
    Array.prototype.concat.apply(matchSteps[0], matchSteps.slice(1));

  matchInit.push({
    type: 'ThrowStatement',
    argument: {
      type: 'NewExpression',
      callee: { type: 'Identifier', name: 'Error' },
      arguments: [
        {
          type: 'Literal',
          value: 'No match found'
        }
      ]
    }
  });

  var matchInitBindings = {};
  matchInitBindings[targetId] = processNode(node.target);
  return selfCall(matchInit, matchInitBindings);
}

module.exports = compileMatchExpression;
