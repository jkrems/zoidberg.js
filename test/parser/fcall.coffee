assert = require 'assertive'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'

describe 'parser:fcall', ->
  describe 'number', ->
    before ->
      @ast = Parser.parse 'x = print("Hello World!")'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one value declaration', ->
      assert.equal 1, @ast.body.length
      assert.truthy 'instanceof ValueDeclaration', @ast.body[0] instanceof ZB.ValueDeclaration

    it 'has the expected value', ->
      fcall = @ast.body[0].body
      assert.truthy 'instanceof FCallExpression', fcall instanceof ZB.FCallExpression
      assert.equal 'print', fcall.callee.name
      assert.equal 'Hello World!', fcall.args[0].value
