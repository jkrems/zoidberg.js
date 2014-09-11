/* jshint node:true */
'use strict';

var _ = require('lodash');

var __slice = Array.prototype.slice;

function Node(type, loc, children) {
  this.type = type;
  this.loc = loc || null;

  this.children = children || [];
}
exports.Node = Node;

Node.prototype.visit = function(visitors) {
  var visitor = visitors[this.type] || visitors['default'];
  if (!visitor && typeof visitors === 'function') {
    visitor = visitors;
  }

  if (typeof visitor === 'function') {
    var args = [this].concat(__slice.call(arguments, 1));
    return visitor.apply(this, args);
  }
};

Node.prototype.getChildren = function() {
  return this.children;
};


function traverseDF(rootNode, visitors) {
  // Yeah, doing it imperatively would be cleaner. Whatever.
  _.each(rootNode.getChildren(), function(child) {
    if (child)
      traverseDF(child, visitors);
  });
  rootNode.visit(visitors);
}
module.exports.traverseDF = traverseDF;


function Program(loc, body) {
  Node.call(this, 'Program', loc, body);
  this.body = body;
}
Program.prototype = Object.create(Node.prototype);
exports.Program = Program;


function ValueDeclaration(loc, name, body, dataType) {
  Node.call(this, 'ValueDeclaration', loc, [body]);
  this.name = name;
  this.body = body;
  this.dataType = dataType;
}
ValueDeclaration.prototype = Object.create(Node.prototype);
exports.ValueDeclaration = ValueDeclaration;


function FunctionDeclaration(loc, name, params, body, dataType) {
  Node.call(this, 'FunctionDeclaration', loc, [body]);
  this.name = name;
  this.params = params;
  this.body = body;
  this.dataType = dataType;
}
FunctionDeclaration.prototype = Object.create(Node.prototype);
exports.FunctionDeclaration = FunctionDeclaration;

FunctionDeclaration.prototype.toString = function() {
  return this.name + ' := ' + this.dataType;
};


function EnumExpression(loc, constructors) {
  Node.call(this, 'EnumExpression', loc);
  this.constructors = constructors;
}
EnumExpression.prototype = Object.create(Node.prototype);
exports.EnumExpression = EnumExpression;


function TypeDeclaration(loc, name, params, body, dataType) {
  Node.call(this, 'TypeDeclaration', loc);
  this.name = name;
  this.params = params;
  this.body = body;
  this.dataType = dataType;
}
TypeDeclaration.prototype = Object.create(Node.prototype);
exports.TypeDeclaration = TypeDeclaration;


function LiteralExpression(loc, value, dataType) {
  Node.call(this, 'LiteralExpression', loc);
  this.value = value;
  this.dataType = dataType;
}
LiteralExpression.prototype = Object.create(Node.prototype);
exports.LiteralExpression = LiteralExpression;


function IdentifierExpression(loc, name, dataType) {
  Node.call(this, 'IdentifierExpression', loc);
  this.name = name;
  this.dataType = dataType; // generally undefined on initialization
}
IdentifierExpression.prototype = Object.create(Node.prototype);
exports.IdentifierExpression = IdentifierExpression;


function FCallExpression(loc, callee, args, dataType) {
  Node.call(this, 'FCallExpression', loc, args.concat([callee]));
  this.callee = callee;
  this.args = args;
  this.dataType = dataType; // generally undefined on initialization
}
FCallExpression.prototype = Object.create(Node.prototype);
exports.FCallExpression = FCallExpression;


function MemberAccessExpression(loc, operator, base, field, dataType) {
  Node.call(this, 'MemberAccessExpression', loc);
  this.operator = operator;
  this.base = base;
  this.field = field; // string
  this.dataType = dataType; // generally undefined on initialization
}
MemberAccessExpression.prototype = Object.create(Node.prototype);
exports.MemberAccessExpression = MemberAccessExpression;


function ArrayAccessExpression(loc, base, field, dataType) {
  Node.call(this, 'ArrayAccessExpression', loc);
  this.base = base;
  this.field = field; // expression
  this.dataType = dataType; // generally undefined on initialization
}
ArrayAccessExpression.prototype = Object.create(Node.prototype);
exports.ArrayAccessExpression = ArrayAccessExpression;


function ArrayExpression(loc, items, dataType) {
  Node.call(this, 'ArrayExpression', loc, items);
  this.items = items;
  this.dataType = dataType; // generally undefined on initialization
}
ArrayExpression.prototype = Object.create(Node.prototype);
exports.ArrayExpression = ArrayExpression;


function BinaryExpression(loc, operator, left, right, dataType) {
  Node.call(this, 'BinaryExpression', loc, [left, right]);
  this.operator = operator;
  this.left = left;
  this.right = right;
  this.dataType = dataType;
}
BinaryExpression.prototype = Object.create(Node.prototype);
exports.BinaryExpression = BinaryExpression;


function UnaryExpression(loc, operator, right, dataType) {
  Node.call(this, 'UnaryExpression', loc, [right]);
  this.operator = operator;
  this.right = right;
  this.dataType = dataType;
}
UnaryExpression.prototype = Object.create(Node.prototype);
exports.UnaryExpression = UnaryExpression;


function ListExpression(loc, body, dataType) {
  Node.call(this, 'ListExpression', loc, body);
  this.body = body;
  this.dataType = dataType;
}
ListExpression.prototype = Object.create(Node.prototype);
exports.ListExpression = ListExpression;


function MatchExpression(loc, target, cases, dataType) {
  Node.call(this, 'MatchExpression', loc, [target].concat(cases));
  this.target = target;
  this.cases = cases;
  this.dataType = dataType;
}
MatchExpression.prototype = Object.create(Node.prototype);
exports.MatchExpression = MatchExpression;


function MatchCase(loc, condition, body, dataType) {
  Node.call(this, 'MatchCase', loc, [condition, body]);
  this.condition = condition;
  this.body = body;
  this.dataType = dataType;
}
MatchCase.prototype = Object.create(Node.prototype);
exports.MatchCase = MatchCase;
