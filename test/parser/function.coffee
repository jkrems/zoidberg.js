assert = require 'assertive'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'
{
  hasType
  FunctionType
  TypeVariable
  IntType
  StringType
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'parser:function', ->
  describe 'return number', ->
    before ->
      @ast = Parser.parse 'f() = 10'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one function declaration', ->
      assert.equal 1, @ast.body.length
      assert.truthy 'instanceof FunctionDeclaration', @ast.body[0] instanceof ZB.FunctionDeclaration

    it 'has the expected value', ->
      assert.equal 10, @ast.body[0].body.value

  describe 'identity', ->
    before ->
      @ast = Parser.parse 'f(x) = x'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one function declaration', ->
      assert.equal 1, @ast.body.length
      assert.truthy 'instanceof FunctionDeclaration', @ast.body[0] instanceof ZB.FunctionDeclaration

    it 'has the expected value', ->
      assert.equal 'x', @ast.body[0].body.name

  describe 'typed add', ->
    before ->
      @ast = Parser.parse 'f(x: Int, y: String): Int = x + y'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one function declaration', ->
      assert.equal 1, @ast.body.length
      assert.truthy 'instanceof FunctionDeclaration', @ast.body[0] instanceof ZB.FunctionDeclaration

    it 'has the expected value', ->
      assert.equal 'x', @ast.body[0].body.left.name
      assert.equal 'y', @ast.body[0].body.right.name
