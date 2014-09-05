assert = require 'assertive'
_ = require 'lodash'

Parser = require '../../lib/parser'
{
  hasType
  StringType
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
