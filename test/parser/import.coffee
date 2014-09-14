assert = require 'assertive'

Parser = require '../../lib/parser'
ZB = require '../../lib/ast'

describe 'parser:import', ->
  describe 'import string', ->
    before ->
      # trailing decl to make sure we don't introduce funny edge cases
      @ast = Parser.parse 'import "fs"\nx = (2 + 3) * 4'
      [ @importDecl ] = @ast.body

    it 'creates an import', ->
      assert.truthy 'instanceof ImportDeclaration',
        (@importDecl instanceof ZB.ImportDeclaration)

    it 'has simple string has the source', ->
      assert.equal 'fs', @importDecl.source

    it 'has no extraction', ->
      assert.equal null, @importDecl.extraction

  describe 'simple renaming', ->
    before ->
      # trailing decl to make sure we don't introduce funny edge cases
      @ast = Parser.parse 'import FS from "fs"\nx = (2 + 3) * 4'
      [ @importDecl ] = @ast.body

    it 'creates an import', ->
      assert.truthy 'instanceof ImportDeclaration',
        (@importDecl instanceof ZB.ImportDeclaration)

    it 'has simple string has the source', ->
      assert.equal 'fs', @importDecl.source

    it 'has a simple Identifier extraction', ->
      {extraction} = @importDecl
      assert.truthy 'instanceof Identifier',
        (extraction instanceof ZB.Identifier)
      assert.equal 'FS', extraction.name

  describe 'typed renaming', ->
    before ->
      # trailing decl to make sure we don't introduce funny edge cases
      @ast = Parser.parse 'import FS: String from "fs"\nx = (2 + 3) * 4'
      [ @importDecl ] = @ast.body
      {@extraction} = @importDecl

    it 'creates an import', ->
      assert.truthy 'instanceof ImportDeclaration',
        (@importDecl instanceof ZB.ImportDeclaration)

    it 'has simple string has the source', ->
      assert.equal 'fs', @importDecl.source

    it 'has a simple Identifier extraction', ->
      assert.truthy 'instanceof Identifier',
        (@extraction instanceof ZB.Identifier)
      assert.equal 'FS', @extraction.name

    it 'types the extraction', ->
      assert.equal 'String', @extraction.dataType.name
