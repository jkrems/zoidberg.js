'use strict';

var _ = require('lodash');
var escodegen = require('escodegen');

var TypeSystem = require('../../types');
var SymbolTable = require('../../inference/symbol-table');

var handleEntryPoint = require('./entry-point');
var compileType = require('./type-declaration');

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
          params: [], // node.params.map(function(param) {}),
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

    'TypeDeclaration': function(node, env) {
      return compileType(node, env);
    },

    'MatchExpression': function(node) {
      return {
        type: 'Literal',
        value: 'match: ' + node
      };
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

function transform(program, options) {
  var typeSystem = options.typeSystem || TypeSystem();
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
