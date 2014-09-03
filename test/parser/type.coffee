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
    before ->
      @ast = Parser.parse 'Boolean = type { True, False }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      [decl] = @ast.body
      assert.truthy 'instanceof TypeDeclaration', decl instanceof ZB.TypeDeclaration

    it 'has two constructors', ->
      def = @ast.body[0].body
      assert.truthy 'instanceof TypeDefinition', def instanceof ZB.TypeDefinition
      assert.equal 2, def.constructors.length

  describe 'Optional(a)', ->
    before ->
      @ast = Parser.parse 'Optional(a) = type { Just(value: a), Null }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      [decl] = @ast.body
      assert.truthy 'instanceof TypeDeclaration', decl instanceof ZB.TypeDeclaration

    it 'has two constructors', ->
      def = @ast.body[0].body
      assert.truthy 'instanceof TypeDefinition', def instanceof ZB.TypeDefinition
      assert.equal 2, def.constructors.length

    it 'has a constructor Just that takes one `value` of type `a`', ->
      [Just] = @ast.body[0].body.constructors
      assert.equal 'Just', Just.name
      assert.equal 1, Just.params.length
      [param] = Just.params
      assert.equal 'a', param.dataType.name

    it 'has a constructor Null that has no parameters', ->
      [Just, Null] = @ast.body[0].body.constructors
      assert.equal 'Null', Null.name
      assert.equal 0, Null.params.length

  describe 'Tree (recursive)', ->
    before ->
      @ast = Parser.parse 'Tree(a) = type { Leaf, Node(left: Tree, value: a, right: Tree) }'

    it 'creates top-level Program node', ->
      assert.truthy @ast instanceof ZB.Program

    it 'creates a body with one type declaration', ->
      [decl] = @ast.body
      assert.truthy 'instanceof TypeDeclaration', decl instanceof ZB.TypeDeclaration

    it 'has two constructors', ->
      def = @ast.body[0].body
      assert.truthy 'instanceof TypeDefinition', def instanceof ZB.TypeDefinition
      assert.equal 2, def.constructors.length

    it 'has a constructor Leaf that has no parameters', ->
      [Leaf, Node] = @ast.body[0].body.constructors
      assert.equal 'Leaf', Leaf.name
      assert.equal 0, Leaf.params.length

    it 'has a constructor Node that has three parameters', ->
      [Leaf, Node] = @ast.body[0].body.constructors
      assert.equal 'Node', Node.name
      assert.equal 3, Node.params.length
      [left, value, right] = Node.params
      assert.equal 'Tree', left.dataType.name
      assert.equal 'a', value.dataType.name
      assert.equal 'Tree', right.dataType.name
