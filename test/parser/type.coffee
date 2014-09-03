assert = require 'assertive'

Parser = require '../../lib/peg-parser'
ZB = require '../../lib/ast'

# Type declarations generally look like value/function declarations.
# Examples:
#
# # `type` - ADT with given constructors
# Boolean = type { True, False }
# Optional(a) = type { Just(value: a), Null }
#
# # `alias` - Type unions and simple typedefs
# Shape = alias { Rectangle, Sphere }
# EscapedHtml = alias { String }
# EscapedHtml = alias String
# Elements(t) = alias Array(t)
# Elements(t) = alias [t]
#
# # `class` - structs with attributes and optional methods
# Position = class(x: Float, y: Float)
# Request = class(method: String, url: String) {
#   toString() = "[Request " + @method + " " + @url + "]"
#
#   toString() = `[Request ${@method} ${@url}]`
# }
describe 'parser:type', ->
  xdescribe 'Boolean', ->
    before ->
      @ast = Parser.parse 'Boolean = type { True, False }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      console.log @ast

  xdescribe 'Optional(a)', ->
    before ->
      @ast = Parser.parse 'Optional(a) = type { Just(value: a), Null }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      console.log @ast

  xdescribe 'Tree (recursive)', ->
    before ->
      @ast = Parser.parse 'Tree(a) = type { Leaf, Node(left: Tree, value: a, right: Tree) }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      console.log @ast
