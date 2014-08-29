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


function LiteralExpression(loc, value, dataType) {
  Node.call(this, 'LiteralExpression', loc);
  this.value = value;
  this.dataType = dataType;
}
LiteralExpression.prototype = Object.create(Node.prototype);
exports.LiteralExpression = LiteralExpression;
