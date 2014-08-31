assert = require 'assertive'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'
{
  hasType
  StringType
  FunctionType
  TypeVariable
} = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference', ->
  describe 'value', ->
    describe 'simple string constant', ->
      beforeEach ->
        @ast = Parser.parse 'x = "foo"'

      it 'parses into a Program node', ->
        assert.truthy 'instanceof Program', @ast instanceof ZB.Program

      it 'can infer the type of x', ->
        typed = infer @ast
        [firstLine] = @ast.body
        assert.equal StringType, firstLine.dataType

      it 'can infer as verified by hasType', ->
        typed = infer @ast
        [firstLine] = @ast.body
        assert.truthy 'hasType(String)', hasType(firstLine, StringType)

  describe 'function', ->
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

      xdescribe 'identity function with return type', ->
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
            'Expected expression of type [[Int]], found [[String]]', err.message)

    describe 'add function', ->
      describe 'without type annotations', ->
        beforeEach ->
          @ast = Parser.parse 'f(x, y) = x + y'

        it 'can infer the type of f', ->
          typed = infer @ast
          [firstLine] = @ast.body
          xType = new TypeVariable()
          yType = new TypeVariable()
          addedType = new TypeVariable()
          assert.truthy 'hasType( (a, b) -> c )', hasType(
            firstLine,
            new FunctionType([xType, yType], addedType)
          )

        xit 'can infer the type of x', ->
          typed = infer @ast
          [firstLine] = @ast.body
          console.log firstLine
