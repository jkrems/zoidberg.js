assert = require 'assertive'

Parser = require '../../lib/parser'
{
  hasType
  StringType
  FunctionType
  TypeVariable
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:function', ->
  describe 'identity function', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse 'f(x) = x'

      it 'can infer the type of f', ->
        typed = infer @ast
        [firstLine] = @ast.body
        someType = new TypeVariable()
        assert.truthy 'hasType( (a) -> a )', hasType(
          firstLine,
          new FunctionType([someType], someType)
        )

    describe 'identity function with argument type', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String) = x'

      it 'can infer the type of f', ->
        typed = infer @ast
        [firstLine] = @ast.body
        assert.truthy 'hasType( (String) -> String )', hasType(
          firstLine,
          new FunctionType([StringType], StringType)
        )

    describe 'identity function with return type', ->
      beforeEach ->
        @ast = Parser.parse 'f(x): String = x'

      it 'can infer the type of f', ->
        typed = infer @ast
        [firstLine] = @ast.body
        assert.truthy 'hasType( (String) -> String )', hasType(
          firstLine,
          new FunctionType([StringType], StringType)
        )

    describe 'identity function with verbose types', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String): String = x'

      it 'can infer the type of f', ->
        typed = infer @ast
        [firstLine] = @ast.body
        assert.truthy 'hasType( (String) -> String )', hasType(
          firstLine,
          new FunctionType([StringType], StringType)
        )

    describe 'identity function with wrong types', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String): Int = x'

      it 'can not infer the type of f', ->
        err = assert.throws =>
          infer @ast

        assert.equal(
          '#String and #Int are not compatible', err.message)

  describe 'add function', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse 'f(x, y) = x + y'

      it 'can infer the type of f', ->
        typed = infer @ast
        [firstLine] = @ast.body
        xType = new TypeVariable()
        yType = new TypeVariable()
        assert.truthy 'hasType( (a, b) -> a )', hasType(
          firstLine,
          new FunctionType([xType, yType], xType)
        )

    describe 'with x and y using same type variable', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: a, y: a) = x + y'

      it 'can infer the type of f', ->
        typed = infer @ast
        [firstLine] = @ast.body
        inType = new TypeVariable()
        addedType = new TypeVariable()
        assert.truthy 'hasType( (a, a) -> b )', hasType(
          firstLine,
          new FunctionType([inType, inType], addedType)
        )
