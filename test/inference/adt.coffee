assert = require 'assertive'

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
        """
      @ast = Parser.parse @source

    it 'can infer the type of x', ->
      infer @ast
      # @ast.body.forEach (decl) ->
      #   console.log decl
