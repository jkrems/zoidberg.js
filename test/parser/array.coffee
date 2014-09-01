assert = require 'assertive'

Parser = require '../../lib/parser'
{
  TypeVariable
  ListType
} = require '../../lib/types'
ZB = require '../../lib/ast'

describe 'parser:array', ->
  describe 'empty', ->
    beforeEach ->
      @ast = Parser.parse 'x = []'

    it 'parses to an ArrayExpression', ->
      [firstLine] = @ast.body
      assert.truthy firstLine.body instanceof ZB.ArrayExpression

    it 'has an empty items array', ->
      [firstLine] = @ast.body
      assert.deepEqual [], firstLine.body.items

  describe 'one number', ->
    beforeEach ->
      @ast = Parser.parse 'x = [ 42 ]'

    it 'parses to an ArrayExpression', ->
      [firstLine] = @ast.body
      assert.truthy firstLine.body instanceof ZB.ArrayExpression

    it 'has one element in its items array', ->
      [firstLine] = @ast.body
      assert.equal 1, firstLine.body.items.length

  describe 'three numbers', ->
    beforeEach ->
      @ast = Parser.parse 'x = [ 42, 13,9 ]'

    it 'parses to an ArrayExpression', ->
      [firstLine] = @ast.body
      assert.truthy firstLine.body instanceof ZB.ArrayExpression

    it 'has 3 elements in its items array', ->
      [firstLine] = @ast.body
      assert.equal 3, firstLine.body.items.length
