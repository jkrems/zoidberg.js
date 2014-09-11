'use strict';

var _ = require('lodash');
var escodegen = require('escodegen');

var TypeSystem = require('../types');
var SymbolTable = require('../inference/symbol-table');

function NodeTransforms(/* Types */) {
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
      var callee;
      if (node.callee.name === 'printf') {
        callee = {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'console' },
          property: { type: 'Identifier', name: 'log' }
        };
      } else {
        callee = processNode(node.callee, env);
      }
      return {
        type: 'CallExpression',
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
    }
  };

  function processNode(node, env) {
    return node.visit(visitors, env);
  }

  return processNode;
}

function handleEntryPoint(program, jsAst, typeSystem) {
  // console.log(program, jsAst);
  var mainFn = _.find(program.body,
    { name: 'main', type: 'FunctionDeclaration' });

  if (!mainFn) return;

  // var paramNames = mainFn.params;
  // var paramTypes = mainFn.dataType.types.slice(0, -1);
  var returnType = mainFn.dataType.types.slice(-1)[0];
  typeSystem.unify(returnType, typeSystem.IntType);

  // if (module === require.main)
  //   (function(args) {})(process.argv.slice(2));

  var runMain = [];
  var mainCheck = {
    type: 'IfStatement',
    test: {
      type: 'BinaryExpression',
      operator: '===',
      left: { type: 'Identifier', name: 'module' },
      right: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'require' },
        property: { type: 'Identifier', name: 'main' },
        computed: false
      }
    },
    consequent: {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'FunctionExpression',
          params: [ { type: 'Identifier', name: 'rawArgs' } ],
          defaults: [],
          body: {
            type: 'BlockStatement',
            body: runMain
          }
        },
        arguments: [
          {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'process' },
                property: { type: 'Identifier', name: 'argv' },
                computed: false
              },
              property: { type: 'Identifier', name: 'slice' },
              computed: false
            },
            arguments: [ { type: 'Literal', value: 2 } ]
          }
        ]
      }
    }
  };

  // var exitCode = main(args...);
  runMain.push({
    type: 'VariableDeclaration',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: { type: 'Identifier', name: 'exitCode' },
        init: {
          type: 'CallExpression',
          callee: { type: 'Identifier', name: 'main' },
          arguments: [] // TODO: args
        }
      }
    ],
    kind: 'var'
  });

  // TODO: handle async exit code / promise of exit code

  // return process.exit(exitCode);
  runMain.push({
    type: 'ReturnStatement',
    argument: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'process' },
        property: { type: 'Identifier', name: 'exit' }
      },
      arguments: [
        { type: 'Identifier', name: 'exitCode' }
      ]
    }
  });

  jsAst.body.push(mainCheck);
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
