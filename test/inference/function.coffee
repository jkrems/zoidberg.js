assert = require 'assertive'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:function', ->
  beforeEach ->
    @typeSystem = TypeSystem()
    {
      @hasType,
      @prune,
      @IntType,
      @StringType,
      @TypeVariable,
      @FunctionType,
      @ArrayType
    } = @typeSystem

  describe 'identity function', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse 'f(x) = x'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        someType = new @TypeVariable()
        assert.truthy 'hasType( (a) -> a )', @hasType(
          firstLine,
          @FunctionType.withTypes([someType, someType])
        )

    describe 'identity function with argument type', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String) = x'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        assert.truthy 'hasType( (String) -> String )', @hasType(
          firstLine,
          @FunctionType.withTypes([@StringType, @StringType])
        )

    describe 'identity function with return type', ->
      beforeEach ->
        @ast = Parser.parse 'f(x): String = x'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        assert.truthy 'hasType( (String) -> String )', @hasType(
          firstLine,
          @FunctionType.withTypes([@StringType, @StringType])
        )

    describe 'identity function with verbose types', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String): String = x'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        assert.truthy 'hasType( (String) -> String )', @hasType(
          firstLine,
          @FunctionType.withTypes([@StringType, @StringType])
        )

    describe 'identity function with wrong types', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String): Int = x'

      it 'can not infer the type of f', ->
        err = assert.throws =>
          infer @ast, @typeSystem

        assert.equal(
          '@String and @Int are not compatible', err.message)

  describe 'wrap in array function', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse 'f(x) = [x]'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        xType = new @TypeVariable()
        assert.truthy 'hasType( (a) -> [a] )', @hasType(
          firstLine,
          @FunctionType.withTypes([xType, @ArrayType.withTypes([xType])])
        )

    describe 'with type annotations', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String) = [x]'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        assert.truthy 'hasType( (a) -> [a] )', @hasType(
          firstLine,
          @FunctionType.withTypes([@StringType, @ArrayType.withTypes([@StringType])])
        )

    describe 'with incompatible types', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: String, y: Int) = [x, y]'

      it 'fails', ->
        err = assert.throws =>
          infer @ast, @typeSystem

        assert.equal(
          '@String and @Int are not compatible', err.message)

  describe 'add function', ->
    describe 'without type annotations', ->
      beforeEach ->
        @ast = Parser.parse 'f(x, y) = x + y'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        xType = new @TypeVariable()
        yType = new @TypeVariable()
        assert.truthy 'hasType( (a, b) -> a )', @hasType(
          firstLine,
          @FunctionType.withTypes([xType, yType, xType])
        )

    describe 'with x and y using same type variable', ->
      beforeEach ->
        @ast = Parser.parse 'f(x: a, y: a) = x + y'
        infer @ast, @typeSystem

      it 'can infer the type of f', ->
        [firstLine] = @ast.body
        inType = new @TypeVariable()
        addedType = new @TypeVariable()
        assert.truthy 'hasType( (a, a) -> b )', @hasType(
          firstLine,
          @FunctionType.withTypes([inType, inType, addedType])
        )
