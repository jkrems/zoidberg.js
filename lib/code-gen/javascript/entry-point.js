'use strict';

var _ = require('lodash');

var selfCall = require('./self-call');

module.exports = function handleEntryPoint(program, jsAst, typeSystem) {
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
      expression: selfCall(runMain, {
        rawArgs: {
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
      })
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
};
