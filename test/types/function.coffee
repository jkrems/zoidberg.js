
assert = require 'assertive'
{
  hasType
  FunctionType
  StringType
  IntType
  TypeVariable
} = require '../../lib/types'

describe 'FunctionType', ->
  describe 'includes', ->
    describe 'identity function', ->
      beforeEach ->
        @a = new TypeVariable()
        @b = new TypeVariable()
        @generic = new FunctionType [@a], @a
        @otherGeneric = new FunctionType [@b], @b
        @specific = new FunctionType [StringType], StringType
        @otherSpecific = new FunctionType [IntType], IntType
        @wrongParamType = new FunctionType [IntType], StringType

      it 'generic includes specific identity', ->
        assert.truthy 'generic.includes specific', @generic.includes(@specific)

      it 'generic includes other generic', ->
        assert.truthy 'generic.includes otherGeneric', @generic.includes(@otherGeneric)

      it 'specific does not include generic', ->
        assert.falsey 'specific.includes generic', @specific.includes(@generic)

      it 'specific does not include other specific', ->
        assert.falsey 'specific.includes otherSpecific', @specific.includes(@otherSpecific)

      it 'specific does not include wrongParamType', ->
        assert.falsey 'specific.includes wrongParamType', @specific.includes(@wrongParamType)

    describe '(a) -> b', ->
      beforeEach ->
        @a = new TypeVariable()
        @b = new TypeVariable()
        @identity = new FunctionType [@a], @a
        @generic = new FunctionType [@a], @b
        @otherGeneric = new FunctionType [@b], @a
        @specific = new FunctionType [IntType], StringType
        @otherSpecific = new FunctionType [StringType], IntType
        @genericToSpecific = new FunctionType [@a], IntType
        @specificToGeneric = new FunctionType [IntType], @a

      it 'generic includes specific identity', ->
        assert.truthy 'generic.includes specific', @generic.includes(@specific)

      it 'generic includes other generic', ->
        assert.truthy 'generic.includes otherGeneric', @generic.includes(@otherGeneric)

      it 'specific does not include generic', ->
        assert.falsey 'specific.includes generic', @specific.includes(@generic)

      it 'specific does not include other specific', ->
        assert.falsey 'specific.includes otherSpecific', @specific.includes(@otherSpecific)

      it 'identity does not include generic', -> # not all generic (a -> b) are also (a -> a)
        assert.falsey 'identity.includes generic', @identity.includes(@generic)

      it 'generic includes identity', -> # identity is special case where a = b
        assert.truthy 'generic.includes identity', @generic.includes(@identity)
