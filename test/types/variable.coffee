assert = require 'assertive'

TypeSystem = require '../../lib/types/index'

TestType = 'TestType'
OtherType = 'OtherType'

describe 'TypeSystem:TypeVariable', ->
  beforeEach ->
    @types = TypeSystem()
    {@TypeVariable, @prune} = @types

  describe 'prune', ->
    it 'returns the most deeply nested value', ->
      a = new @TypeVariable TestType
      b = new @TypeVariable a
      c = new @TypeVariable b

      assert.equal TestType, @prune(c)
      assert.equal @prune(b), @prune(c)
      assert.equal @prune(a), @prune(b)

    it 'returns the most deeply nested variable', ->
      a = new @TypeVariable()
      b = new @TypeVariable a
      c = new @TypeVariable b

      assert.equal a, @prune(c)
      assert.equal @prune(b), @prune(c)
      assert.equal @prune(a), @prune(b)

    it 'is protected against cyclic references', ->
      a = new @TypeVariable()
      b = new @TypeVariable()
      c = new @TypeVariable()

      a.value = b; b.value = c; c.value = b
      err = assert.throws =>
        @prune a

      assert.equal 'Cyclic type variables detected', err.message

  describe 'formatting', ->
    it 'converts ids into nice letters', ->
      a = new @TypeVariable()
      b = new @TypeVariable()
      z = new @TypeVariable(null, 25)
      a2 = new @TypeVariable(null, 26)
      z2 = new @TypeVariable(null, 51)
      assert.equal '$a', "#{a}"
      assert.equal '$b', "#{b}"
      assert.equal '$z', "#{z}"
      assert.equal '$a2', "#{a2}"
      assert.equal '$z2', "#{z2}"

    it 'includes the instance if set', ->
      a = new @TypeVariable TestType
      assert.equal "$a := #{TestType}", "#{a}"

  describe 'instance', ->
    it 'can be passed into the constructor', ->
      a = new @TypeVariable TestType
      assert.equal TestType, a.value

    it 'can be set later on', ->
      a = new @TypeVariable()
      a.value = TestType
      assert.equal TestType, a.value

    it 'can only be set once', ->
      a = new @TypeVariable TestType
      err = assert.throws ->
        a.value = OtherType

      assert.equal 'Value of TypeVariable can only be set once', err.message

    it 'is `null` by default', ->
      a = new @TypeVariable()
      assert.equal null, a.value
