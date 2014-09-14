'use strict';

var util = require('util');

var _ = require('lodash');
var escodegen = require('escodegen');

var TypeSystem = require('../../types');
var SymbolTable = require('../../inference/symbol-table');

var handleEntryPoint = require('./entry-point');
var compileType = require('./type-declaration');
var compileMatchExpression = require('./match-expr');

function NodeTransforms(Types) {
  var visitors = {
    'Program': function(node, env) {
      return {
        type: 'Program',
        body: _.reduce(node.body, function(body, line) {
          return body.concat(processNode(line, env) || []);
        }, [ {
          type: 'ExpressionStatement',
          expression: {
            type: 'Literal',
            value: 'use strict'
          }
        } ])
      };
    },

    'FunctionDeclaration': function(node, env) {
      return [
        {
          type: 'FunctionDeclaration',
          id: { type: 'Identifier', name: node.name },
          params: node.params.map(function(param) {
            return { type: 'Identifier', name: param };
          }),
          defaults: [],
          body: {
            type: 'BlockStatement',
            body: [
              {
                type: 'ReturnStatement',
                argument: processNode(node.body, env)
              }
            ]
          },
          generator: false,
          expression: false
        }
      ];
    },

    'LiteralExpression': function(node) {
      return {
        type: 'Literal',
        value: node.value
      };
    },

    'FCallExpression': function(node, env) {
      var callee, callType = 'CallExpression';
      if (node.callee.name === 'printf') {
        callee = {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'console' },
          property: { type: 'Identifier', name: 'log' }
        };
      } else {
        var calleeType = node.callee.dataType;
        if (calleeType && Types.isConstructor(calleeType))
          callType = 'NewExpression';

        callee = processNode(node.callee, env);
      }
      return {
        type: callType,
        callee: callee,
        arguments: node.args.map(function(arg) {
          return processNode(arg, env);
        })
      };
    },

    'ListExpression': function(node, env) {
      // { type: 'Literal', value: 'Hello World' }
      return {
        type: 'SequenceExpression',
        expressions: node.body.map(function(item) {
          return processNode(item, env);
        })
      };
    },

    'BinaryExpression': function(node, env) {
      var operator = _.find(
        node.left.dataType.props, { name: node.operator });

      if (!operator) {
        throw new Error(
          util.format('No definition for operator %s found',
            node.operator));
      }

      if (typeof operator.body === 'function') {
        return operator.body(processNode, node, env);
      } else if (operator.body) {
        throw new Error('In-language operators not implemented yet');
      } else {
        throw new Error(
          util.format('No implementation for operator found',
            node.operator));
      }
    },

    'UnaryExpression': function(node, env) {
      return {
        type: 'UnaryExpression',
        operator: node.operator,
        argument: processNode(node.right, env)
      };
    },

    'TypeDeclaration': function(node, env) {
      return compileType(node, env);
    },

    'MatchExpression': function(node) {
      return compileMatchExpression(node, processNode);
    },

    'IdentifierExpression': function(node) {
      return {
        type: 'Identifier',
        name: node.name
      };
    },

    'ValueDeclaration': function(node, env) {
      return {
        type: 'VariableDeclaration',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: { type: 'Identifier', name: node.name },
            init: processNode(node.body, env)
          }
        ],
        kind: 'const'
      };
    },

    'MemberAccessExpression': function(node, env) {
      var object = processNode(node.base, env);
      return {
        type: 'MemberExpression',
        object: object,
        property: { type: 'Identifier', name: node.field }
      };
    }
  };

  function processNode(node, env) {
    return node.visit(visitors, env);
  }

  return processNode;
}

function registerOperators(typeSystem) {
  var IntType = typeSystem.IntType;

  function operatorMacro(type, operator, macro) {
    var op = _.find(IntType.props, { name: operator });
    if (!op) {
      throw new Error('Unknown operator ' + operator);
    }
    op.body = macro(typeSystem);
  }

  _.each([ '+', '-', '/', '*', '%' ], function(operator) {
    operatorMacro(IntType, operator, function() {
      return function(compileNode, node, env) {
        return {
          type: 'BinaryExpression',
          operator: '|',
          left: {
            type: 'BinaryExpression',
            operator: operator,
            left: compileNode(node.left, env),
            right: compileNode(node.right, env)
          },
          right: { type: 'Literal', value: 0 }
        };
      };
    });
  });
}

function transform(program, options) {
  var typeSystem = options.typeSystem || TypeSystem();
  registerOperators(typeSystem);
  var env = new SymbolTable(
    typeSystem.getBuiltIns(), typeSystem.generateVariable);

  var jsAst = NodeTransforms(typeSystem)(program, env);
  handleEntryPoint(program, jsAst, typeSystem);

  return {
    code: escodegen.generate(jsAst, {
      format: {
        indent: {
          style: '  '
        }
      }
    }),
    targetAst: jsAst
  };
}
module.exports = transform;
