assert = require 'assertive'

Parser = require '../../lib/parser'
{
  hasType
  StringType
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:value', ->
  describe 'simple string constant', ->
    beforeEach ->
      @ast = Parser.parse 'x = "foo"'

    it 'can infer the type of x', ->
      typed = infer @ast
      [firstLine] = @ast.body
      assert.equal StringType, firstLine.dataType

    it 'can infer as verified by hasType', ->
      typed = infer @ast
      [firstLine] = @ast.body
      assert.truthy 'hasType(String)', hasType(firstLine, StringType)

  describe 'explicitly types string', ->
    beforeEach ->
      @ast = Parser.parse 'x: String = "foo"'

    it 'can infer the type of x', ->
      typed = infer @ast
      [firstLine] = @ast.body
      assert.equal StringType, firstLine.dataType

  describe 'attempt to assign int to string', ->
    beforeEach ->
      @ast = Parser.parse 'x: Int = "foo"'

    it 'fails with meaningful error', ->
      err = assert.throws =>
        infer @ast

      assert.equal(
        '#String and #Int are not compatible', err.message)
