'use strict';

var _ = require('lodash');

var selfCall = require('./self-call');

function instanceofGuard(ctorRef, ctorArgs) {
  return [
    {
      type: 'IfStatement',
      test: {
        type: 'UnaryExpression',
        operator: '!',
        argument: {
          type: 'BinaryExpression',
          operator: 'instanceof',
          left: { type: 'ThisExpression' },
          right: ctorRef
        }
      },
      consequent: {
        type: 'ReturnStatement',
        argument: {
          type: 'NewExpression',
          callee: ctorRef,
          arguments: ctorArgs
        }
      }
    }
  ];
}

function enumConstructor(node, ctor) {
  var typeName = node.name;
  var ctorName = ctor.name;
  var fullName = typeName + '.' + ctorName;

  var ctorInit = [];
  var paramIds = _.map(ctor.params, function(param) {
    return { type: 'Identifier', name: param };
  });
  var ctorRef = { type: 'Identifier', name: ctorName };

  ctorInit.push({
    type: 'FunctionDeclaration',
    id: { type: 'Identifier', name: ctor.name },
    params: paramIds,
    defaults: [],
    body: {
      type: 'BlockStatement',
      body:
        instanceofGuard(ctorRef, paramIds)
        .concat(_.map(ctor.params, function(param, idx) {
          return {
            type: 'ExpressionStatement',
            expression: {
              type: 'AssignmentExpression',
              operator: '=',
              left: {
                type: 'MemberExpression',
                object: { type: 'ThisExpression' },
                property: { type: 'Identifier', name: '$' + idx }
              },
              right: { type: 'Identifier', name: param }
            }
          };
        }))
    }
  });

  var protoProps = {
    type: 'ObjectExpression',
    properties: [
      {
        key: { type: 'Identifier', name: 'toJSON' },
        kind: 'init',
        value: {
          type: 'ObjectExpression',
          properties: [
            {
              key: { type: 'Identifier', name: 'value' },
              kind: 'init',
              value: {
                type: 'FunctionExpression',
                params: [],
                defaults: [],
                body: {
                  type: 'BlockStatement',
                  body: [
                    {
                      type: 'ReturnStatement',
                      argument: {
                        type: 'ArrayExpression',
                        elements: [
                          {
                            type: 'Literal',
                            value: fullName
                          }
                        ].concat(_.map(ctor.params, function(param, idx) {
                          return {
                            type: 'MemberExpression',
                            object: { type: 'ThisExpression' },
                            property: { type: 'Identifier', name: '$' + idx }
                          };
                        }))
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    ].concat(_.map(ctor.params, function(param, idx) {
      return {
        key: { type: 'Identifier', name: param },
        kind: 'init',
        value: {
          type: 'ObjectExpression',
          properties: [
            {
              key: { type: 'Identifier', name: 'get' },
              kind: 'init',
              value: {
                type: 'FunctionExpression',
                params: [],
                defaults: [],
                body: {
                  type: 'BlockStatement',
                  body: [
                    {
                      type: 'ReturnStatement',
                      argument: {
                        type: 'MemberExpression',
                        object: { type: 'ThisExpression' },
                        property: { type: 'Identifier', name: '$' + idx }
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      };
    }))
  };

  ctorInit.push({
    type: 'ExpressionStatement',
    expression: {
      type: 'AssignmentExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        object: ctorRef,
        property: { type: 'Identifier', name: 'prototype' }
      },
      right: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'Object' },
          property: { type: 'Identifier', name: 'create' }
        },
        arguments: [
          {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: typeName },
            property: { type: 'Identifier', name: 'prototype' }
          },
          protoProps
        ]
      }
    }
  });

  ctorInit.push({
    type: 'ReturnStatement',
    argument: ctorRef
  });

  return selfCall(ctorInit, {});
}

function compileEnum(node, body, env) {
  var name = node.name;
  var typeInit = [];

  // function <name>() {}
  var mainCtor = {
    type: 'FunctionDeclaration',
    id: { type: 'Identifier', name: name },
    params: [],
    defaults: [],
    body: {
      type: 'BlockStatement',
      body: []
    },
    generator: false,
    expression: false
  };
  typeInit.push(mainCtor);

  _.each(body.constructors, function(ctor) {
    var ctorPropRef = {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: name },
      property: { type: 'Identifier', name: ctor.name }
    };
    typeInit.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: ctorPropRef,
        right: enumConstructor(node, ctor, env)
      }
    });
  });

  // return <name>;
  typeInit.push({
    type: 'ReturnStatement',
    argument: { type: 'Identifier', name: name }
  });

  return {
    type: 'VariableDeclaration',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: { type: 'Identifier', name: name },
        init: selfCall(typeInit, {})
      }
    ],
    kind: 'const'
  };
}

function compileType(node, env) {
  var typeType = node.body.type;

  switch (typeType) {
    case 'EnumExpression':
      return compileEnum(node, node.body, env);

    default:
      throw new Error('Unknown type: ' + typeType);
  }
}

module.exports = compileType;
