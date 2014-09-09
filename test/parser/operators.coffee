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

describe 'parser:operators', ->
  describe 'simple additions', ->
    before ->
      @ast = Parser.parse 'x = 10 + 5 - 3'

    it 'creates a body with nested binary expressions', ->
      [ { body: expr } ] = @ast.body
      # Expected tree: (- (+ 10 5) 3)
      assert.equal '-', expr.operator
      assert.equal 3, expr.right.value

      assert.equal '+', expr.left.operator
      assert.equal 10, expr.left.left.value
      assert.equal 5, expr.left.right.value

  describe 'simple multiplication', ->
    before ->
      @ast = Parser.parse 'x = 10 / 5 * 3 % 4'

    it 'creates a body with nested binary expressions', ->
      [ { body: expr } ] = @ast.body
      # Expected tree: (% (* (/ 10 5) 3) 4)
      assert.equal '%', expr.operator
      assert.equal 4, expr.right.value

      expr = expr.left
      assert.equal '*', expr.operator
      assert.equal 3, expr.right.value

      expr = expr.left
      assert.equal '/', expr.operator
      assert.equal 10, expr.left.value
      assert.equal 5, expr.right.value

  describe 'unary operator / x = 2 * -4', ->
    before ->
      @ast = Parser.parse 'x = 2 * -4'

    it 'creates a body with binary & unary expressions', ->
      [ { body: expr } ] = @ast.body
      # Expected tree: (* 2 (- 4))
      assert.equal '*', expr.operator
      assert.equal 2, expr.left.value

      expr = expr.right
      assert.truthy 'instanceof UnaryExpression', expr instanceof ZB.UnaryExpression
      assert.equal '-', expr.operator
      assert.equal 4, expr.right.value

  describe 'operator precedence', ->
    before ->
      @ast = Parser.parse 'x = 2 + 3 * 4'
      @rev = Parser.parse 'x = 3 * 4 + 2'

    it '2 + 3 * 4', ->
      [ { body: expr } ] = @ast.body
      # Expected tree: (+ 2 (* 3 4))
      assert.equal '+', expr.operator
      assert.equal 2, expr.left.value

      expr = expr.right
      assert.equal '*', expr.operator
      assert.equal 3, expr.left.value
      assert.equal 4, expr.right.value

    it '3 * 4 + 2', ->
      [ { body: expr } ] = @rev.body
      # Expected tree: (+ (* 3 4) 2)
      assert.equal '+', expr.operator
      assert.equal 2, expr.right.value

      expr = expr.left
      assert.equal '*', expr.operator
      assert.equal 3, expr.left.value
      assert.equal 4, expr.right.value
