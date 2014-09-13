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

describe 'parser:match', ->
  describe 'simple match function', ->
    source =
      """
      # Returns true if x is 1 (yes, that's a stupid function)
      isOne(x) = match x {
        1 => true
        else => false
      }
      """

    before ->
      @ast = Parser.parse source

    it 'matches stuff', ->
      matchExpr = @ast.body[0].body
      assert.truthy 'instanceof MatchExpression', matchExpr instanceof ZB.MatchExpression
      assert.equal 'x', matchExpr.target.name
      assert.equal 2, matchExpr.cases.length

  describe 'match with ADT', ->
    source =
      """
      length(list) = match list {
        List.Node(value, next) => 1 + length(next)
        List.Empty() => 0
      }
      """

    before ->
      @ast = Parser.parse source

    it 'matches stuff', ->
      matchExpr = @ast.body[0].body
      assert.truthy 'instanceof MatchExpression', matchExpr instanceof ZB.MatchExpression
      assert.equal 'list', matchExpr.target.name
      assert.equal 2, matchExpr.cases.length
