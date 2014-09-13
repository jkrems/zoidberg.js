util = require 'util'

assert = require 'assertive'
_ = require 'lodash'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:ADT', ->
  beforeEach ->
    @typeSystem = TypeSystem()
    {
      @hasType,
      @prune,
      @IntType,
      @TypeVariable,
      @FunctionType
    } = @typeSystem

  describe 'List(t); Node / Empty', ->
    beforeEach ->
      @source = """
        List(t) = enum { Node(value: t, next: List(t)), Empty() }
        length(list) = match list {
          List.Node(value, next) => 1 + length(next)
          List.Empty() => 0
        }
        myList = List.Node(10, List.Node(42, List.Node(9, List.Empty())))
        myListLen = length(myList)
        """
      @ast = Parser.parse @source
      infer @ast, @typeSystem

    it 'can infer the type of myList', ->
      {dataType: lType} = _.find @ast.body, { name: 'myList' }
      assert.equal 'List', lType.name
      typeParam = @prune(lType.types[0])
      assert.truthy 'hasType IntType', @hasType({ dataType: typeParam }, @IntType)

    it 'can infer the type of length', ->
      List = _.find @ast.body, { name: 'List' }
      length = _.find @ast.body, { name: 'length' }
      genericList = @typeSystem.safeCopy(
        List.body.constructors[1].dataType.types[0])
      expected = @FunctionType.withTypes [genericList, @IntType]
      desc = util.format '%s hasType %s', length.dataType, expected
      assert.truthy desc, @hasType(length, expected)

    it 'can infer the type of myListLen', ->
      myListLen = _.find @ast.body, { name: 'myListLen' }
      assert.truthy 'hasType IntType', @hasType(myListLen, @IntType)
