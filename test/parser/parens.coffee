assert = require 'assertive'

Parser = require '../../lib/peg-parser'
ZB = require '../../lib/ast'
{
  hasType
  FunctionType
  TypeVariable
  IntType
  StringType
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'parser:parens', ->
  describe 'override operator precedence', ->
    before ->
      @ast = Parser.parse 'x = (2 + 3) * 4'
      @rev = Parser.parse 'x = 3 * (4 + 2)'

    it '(2 + 3) * 4', ->
      [ { body: expr } ] = @ast.body
      # Expected tree: (* (+ 2 3) 4)
      assert.equal '*', expr.operator
      assert.equal 4, expr.right.value

      expr = expr.left
      assert.equal '+', expr.operator
      assert.equal 2, expr.left.value
      assert.equal 3, expr.right.value

    it '3 * (4 + 2)', ->
      [ { body: expr } ] = @rev.body
      # Expected tree: (* 3 (+ 4 2))
      assert.equal '*', expr.operator
      assert.equal 3, expr.left.value

      expr = expr.right
      assert.equal '+', expr.operator
      assert.equal 4, expr.left.value
      assert.equal 2, expr.right.value
