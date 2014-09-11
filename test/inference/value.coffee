assert = require 'assertive'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:value', ->
  beforeEach ->
    @typeSystem = TypeSystem()
    {@StringType, @hasType} = @typeSystem

  describe 'simple string constant', ->
    beforeEach ->
      @ast = Parser.parse 'x = "foo"'
      infer @ast, @typeSystem

    it 'can infer the type of x', ->
      [firstLine] = @ast.body
      assert.truthy 'hasType(String)', @hasType(firstLine, @StringType)

  describe 'explicitly types string', ->
    beforeEach ->
      @ast = Parser.parse 'x: String = "foo"'
      infer @ast, @typeSystem

    it 'can infer the type of x', ->
      [firstLine] = @ast.body
      assert.truthy 'hasType(String)', @hasType(firstLine, @StringType)

  describe 'attempt to assign int to string', ->
    beforeEach ->
      @ast = Parser.parse 'x: Int = "foo"'

    it 'fails with meaningful error', ->
      err = assert.throws =>
        infer @ast

      assert.equal(
        '@String and @Int are not compatible', err.message)
