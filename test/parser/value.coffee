assert = require 'assertive'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'

describe 'parser:value', ->
  describe 'number', ->
    before ->
      @ast = Parser.parse 'x =\n  10'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one value declaration', ->
      assert.equal 1, @ast.body.length
      assert.truthy 'instanceof ValueDeclaration', @ast.body[0] instanceof ZB.ValueDeclaration

    it 'has the expected value', ->
      assert.equal 10, @ast.body[0].body.value

  describe 'two numbers', ->
    before ->
      @ast = Parser.parse 'x =\n  10\ny = 20'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates two items in body', ->
      assert.equal 2, @ast.body.length

    it 'has the expected values', ->
      assert.equal 10, @ast.body[0].body.value
      assert.equal 20, @ast.body[1].body.value

  describe 'string', ->
    before ->
      @ast = Parser.parse 'x =\n  "He said \\"Hello!\\""'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates one element body', ->
      assert.equal 1, @ast.body.length

    it 'has the expected value', ->
      assert.equal 'He said "Hello!"', @ast.body[0].body.value

  describe 'booleans', ->
    before ->
      @ast = Parser.parse 'x = true\ny = false'

    it 'creates two element body', ->
      assert.equal 2, @ast.body.length

    it 'has the expected value', ->
      assert.equal true, @ast.body[0].body.value
      assert.equal false, @ast.body[1].body.value
