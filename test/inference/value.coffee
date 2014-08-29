assert = require 'assertive'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'
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
