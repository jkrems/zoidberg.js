assert = require 'assertive'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:fcall', ->
  beforeEach ->
    @types = TypeSystem()
    {@TypeVariable, @FunctionType, @hasType} = @types

  describe 'return value', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse """
          f(x) = x
          n = f(10)
          s = f("str")
          """
        infer @ast, @types
        [@fDecl, @nDecl, @sDecl] = @ast.body

      it 'properly infers the type of `n`', ->
        assert.equal 'Int', @nDecl.dataType.name

      it 'properly infers the type of `s`', ->
        assert.equal 'String', @sDecl.dataType.name

      it 'keeps f generic', ->
        argType = new @TypeVariable()
        genericCall = @FunctionType.withTypes [argType, argType]
        assert.truthy @hasType(@fDecl, genericCall)
