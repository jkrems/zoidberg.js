assert = require 'assertive'
_ = require 'lodash'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:ADT', ->
  beforeEach ->
    @typeSystem = TypeSystem()
    {@hasType, @prune, @IntType, @TypeVariable} = @typeSystem

  describe 'Boolean; x = True', ->
    beforeEach ->
      @source = """
        Boolean = enum { True(), False() }
        x = Boolean.True()

        # Simulating a clean impl of the built-in type
        false_ = Boolean.False()
        true_ = Boolean.True()

        y = true_
        """
      @ast = Parser.parse @source
      infer @ast, @typeSystem
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

  describe 'Tree(t); Leaf / Node', ->
    beforeEach ->
      @source = """
        Tree(a) = enum { Leaf(), Node(left: Tree(a), value: a, right: Tree(a)) }
        l = Tree.Leaf()
        n = Tree.Node(Tree.Leaf(), 10, Tree.Leaf())
        n2 = Tree.Node(Tree.Leaf(), "str", Tree.Leaf())
        """
      @ast = Parser.parse @source
      infer @ast, @typeSystem

    it 'can infer the type of l', ->
      {dataType: lType} = _.find @ast.body, { name: 'l' }
      assert.equal 'Tree', lType.name
      typeParam = @prune(lType.types[0])
      assert.truthy 'instanceof TypeVariable', typeParam instanceof @TypeVariable

    it 'still leaves Tree as a generic type', ->
      {dataType: treeMeta} = _.find @ast.body, { name: 'Tree' }
      assert.equal 'Tree%Meta', treeMeta.name

    it 'can infer the type of n', ->
      {dataType: nType} = _.find @ast.body, { name: 'n' }
      assert.equal 'Tree', nType.name
      typeParam = @prune(nType.types[0])
      assert.equal 'Int', typeParam.name
      assert.truthy 'hasType IntType', @hasType({ dataType: typeParam }, @IntType)
