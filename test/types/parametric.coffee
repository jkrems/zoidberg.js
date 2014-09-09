assert = require 'assertive'

TypeSystem = require '../../lib/types/index'

describe 'TypeSystem:ParametricType', ->
  beforeEach ->
    @types = TypeSystem()
    {@ParametricType, @TypeVariable} = @types

  describe 'formatting', ->
    it 'prefixes the name with @', ->
      a = new @ParametricType 'MyType'
      assert.equal '@MyType', "#{a}"

    it 'includes the type params', ->
      a = new @ParametricType 'MyType', null, [ 'x', 'y' ]
      assert.equal '@MyType(x, y)', "#{a}"

    it 'prunes type params', ->
      ActualType = 'ActualType'
      a = new @TypeVariable ActualType
      b = new @ParametricType 'MyType', null, [ a ]
      assert.equal '@MyType(ActualType)', "#{b}"
