assert = require 'assertive'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:operators', ->
  beforeEach ->
    @typeSystem = TypeSystem()
    {@StringType, @IntType, @hasType} = @typeSystem

  describe 'integer addition', ->
    describe 'two integers', ->
      beforeEach ->
        @ast = Parser.parse 'x = 2 + 3'
        infer @ast, @typeSystem

      it 'can infer the type of x', ->
        [firstLine] = @ast.body
        assert.truthy 'hasType(Int)', @hasType(firstLine, @IntType)

    describe 'one int, one string', ->
      beforeEach ->
        @ast = Parser.parse 'x = 2 + "3"'

      it 'throws because Int and String are incompatible', ->
        err = assert.throws =>
          infer @ast, @typeSystem
        assert.equal '@Int and @String are not compatible', err.message
