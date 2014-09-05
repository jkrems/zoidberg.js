assert = require 'assertive'

Parser = require '../../lib/parser'
{
  hasType
  StringType
  FunctionType
  TypeVariable
  ArrayType
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:fcall', ->
  describe 'return value', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse """
          f(x) = x
          n = f(10)
          s = f("str")
          """
        infer @ast
        [@fDecl, @nDecl, @sDecl] = @ast.body

      it 'properly infers the type of `n`', ->
        assert.equal 'Int', @nDecl.dataType.name

      it 'properly infers the type of `s`', ->
        assert.equal 'String', @sDecl.dataType.name

      it 'keeps f generic', ->
        argType = new TypeVariable()
        genericCall = new FunctionType [argType], argType
        assert.truthy hasType(@fDecl, genericCall)
