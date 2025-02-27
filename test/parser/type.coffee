assert = require 'assertive'

{pluck} = require 'lodash'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'

# Type declarations generally look like value/function declarations.
# Examples:
#
# # `enum` - ADT with given constructors
# Boolean = enum { True, False }
# Optional(a) = enum { Just(value: a), Null }
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
#   toString() = "[Request " + method + " " + url + "]"
# }
# LinesStream = class(separator: String) extends Transform {
#   # Private state, `:=` is mutable assignment
#   _buffer := ""
#   _sepLen = seperator.length
#
#   # Private method, returns rest
#   _pushLines(str: String) =
#     match str.indexOf(separator) {
#       -1  => str
#       idx => {
#         # `push` is part of the base class
#         push(str.substr(0, idx));
#         _pushLines(str.substr(idx + _sepLen))
#       }
#     }
#
#   _transform(chunk, done) = {
#     _buffer := _pushLines(_buffer ++ chunk.toString("utf8"));
#     done()
#   }
# }
describe 'parser:type', ->
  describe 'Boolean', ->
    beforeEach ->
      @ast = Parser.parse 'Boolean = enum { True(), False() }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      [decl] = @ast.body
      assert.truthy 'instanceof TypeDeclaration', decl instanceof ZB.TypeDeclaration

    it 'has two constructors', ->
      def = @ast.body[0].body
      assert.truthy 'instanceof EnumExpression', def instanceof ZB.EnumExpression
      assert.equal 2, def.constructors.length

  describe 'Optional(a)', ->
    beforeEach ->
      @ast = Parser.parse 'Optional(a) = enum { Just(value: a), Null() }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      [decl] = @ast.body
      assert.truthy 'instanceof TypeDeclaration', decl instanceof ZB.TypeDeclaration

    it 'has two constructors', ->
      def = @ast.body[0].body
      assert.truthy 'instanceof EnumExpression', def instanceof ZB.EnumExpression
      assert.equal 2, def.constructors.length

    it 'has a constructor Just that takes one `value` of type `a`', ->
      [Just] = @ast.body[0].body.constructors
      assert.equal 'Just', Just.name
      assert.deepEqual [ 'value' ], Just.params
      assert.equal 'a', Just.dataType.types[0].name

    it 'has a constructor Null that is a value', ->
      [Just, Null] = @ast.body[0].body.constructors
      assert.equal 'Null', Null.name
      assert.deepEqual [], Null.params

  describe 'Tree (recursive)', ->
    beforeEach ->
      @ast = Parser.parse 'Tree(a) = enum { Leaf(), Node(left: Tree(a), value: a, right: Tree(a)) }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      [decl] = @ast.body
      assert.truthy 'instanceof TypeDeclaration', decl instanceof ZB.TypeDeclaration

    it 'has two constructors', ->
      def = @ast.body[0].body
      assert.truthy 'instanceof EnumExpression', def instanceof ZB.EnumExpression
      assert.equal 2, def.constructors.length

    it 'has a constructor Leaf that has no parameters', ->
      [Leaf, Node] = @ast.body[0].body.constructors
      assert.equal 'Leaf', Leaf.name
      assert.deepEqual [], Leaf.params

    it 'has a constructor Node that has three parameters', ->
      [Leaf, Node] = @ast.body[0].body.constructors
      assert.equal 'Node', Node.name
      assert.deepEqual [ 'left', 'value', 'right' ], Node.params
      assert.deepEqual [ 'Tree', 'a', 'Tree' ], pluck(Node.dataType.types.slice(0, -1), 'name')
