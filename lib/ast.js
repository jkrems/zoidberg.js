/* jshint node:true */
'use strict';

var __slice = Array.prototype.slice;

function Node(type, loc) {
  this.type = type;
  this.loc = loc || null;
}
exports.Node = Node;

Node.prototype.visit = function(visitors) {
  var visitor = visitors[this.type];

  if (typeof visitor === 'function') {
    var args = [this].concat(__slice.call(arguments, 1));
    return visitor.apply(this, args);
  }
};


function Program(loc, body) {
  Node.call(this, 'Program', loc);
  this.body = body;
}
Program.prototype = Object.create(Node.prototype);
exports.Program = Program;


function ValueDeclaration(loc, name, body, dataType) {
  Node.call(this, 'ValueDeclaration', loc);
  this.name = name;
  this.body = body;
  this.dataType = dataType;
}
ValueDeclaration.prototype = Object.create(Node.prototype);
exports.ValueDeclaration = ValueDeclaration;


function FunctionDeclaration(loc, name, params, body, dataType) {
  Node.call(this, 'FunctionDeclaration', loc);
  this.name = name;
  this.params = params;
  this.body = body;
  this.dataType = dataType;
}
FunctionDeclaration.prototype = Object.create(Node.prototype);
exports.FunctionDeclaration = FunctionDeclaration;


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


function ArrayExpression(loc, items, dataType) {
  Node.call(this, 'ArrayExpression', loc);
  this.items = items;
  this.dataType = dataType; // generally undefined on initialization
}
ArrayExpression.prototype = Object.create(Node.prototype);
exports.ArrayExpression = ArrayExpression;


function BinaryExpression(loc, operator, left, right, dataType) {
  Node.call(this, 'BinaryExpression', loc);
  this.operator = operator;
  this.left = left;
  this.right = right;
  this.dataType = dataType;
}
BinaryExpression.prototype = Object.create(Node.prototype);
exports.BinaryExpression = BinaryExpression;


function MatchExpression(loc, target, cases, dataType) {
  Node.call(this, 'MatchExpression', loc);
  this.target = target;
  this.cases = cases;
}
MatchExpression.prototype = Object.create(Node.prototype);
exports.MatchExpression = MatchExpression;


function MatchCase(loc, condition, body, dataType) {
  Node.call(this, 'MatchCase', loc);
  this.condition = condition;
  this.body = body;
}
MatchCase.prototype = Object.create(Node.prototype);
exports.MatchCase = MatchCase;
