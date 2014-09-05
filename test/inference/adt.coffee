assert = require 'assertive'
_ = require 'lodash'

Parser = require '../../lib/parser'
{
  hasType
  StringType
  TypeVariable
  prune
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:ADT', ->
  describe 'Boolean; x = True', ->
    before ->
      @source = """
        Boolean = enum { True, False }
        x = Boolean.True

        # Simulating a clean impl of the built-in type
        false_ = Boolean.False
        true_ = Boolean.True

        y = true_
        """
      @ast = Parser.parse @source
      infer @ast
      [@typeDecl, @xDecl] = @ast.body

    it 'can infer the type of x', ->
      {dataType: xType} = @xDecl
      assert.equal 'Boolean', xType.name

    it 'can infer the type of Boolean (meta type)', ->
      {dataType: typeType} = @typeDecl
      assert.equal 'Boolean%Meta', typeType.name

    it 'can infer the type of y', ->
      {dataType: yType} = _.find @ast.body, { name: 'y' }
      assert.equal 'Boolean', yType.name

  describe 'Tree(t); Leaf', ->
    before ->
      @source = """
        Tree(a) = enum { Leaf, Node(left: Tree, value: a, right: Tree) }
        l = Tree.Leaf
        n = Tree.Node(Tree.Leaf, 10, Tree.Leaf)
        """
      @ast = Parser.parse @source
      infer @ast

    it 'can infer the type of l', ->
      {dataType: lType} = _.find @ast.body, { name: 'l' }
      assert.equal 'Tree', lType.name
      assert.truthy 'instanceof TypeVariable', lType.types[0] instanceof TypeVariable
      assert.falsey 'is generic', lType.types[0].instance

    xit 'can infer the type of n', ->
      {dataType: nType} = _.find @ast.body, { name: 'n' }
      assert.equal 'Tree', nType.name
      console.log prune(nType.types[0])
      assert.equal 'Int', nType.types[0].name
