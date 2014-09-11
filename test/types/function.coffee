
assert = require 'assertive'
TypeSystem = require '../../lib/types'

describe 'FunctionType', ->
  before ->
    @typeSystem = TypeSystem()
    {
      @TypeVariable,
      @FunctionType,
      @StringType,
      @IntType,
      @hasType
    } = @typeSystem

  describe 'includes', ->
    describe 'identity function', ->
      beforeEach ->
        @a = new @TypeVariable()
        @b = new @TypeVariable()
        @generic = @FunctionType.withTypes [@a, @a]
        @otherGeneric = @FunctionType.withTypes [@b, @b]
        @specific = @FunctionType.withTypes [@StringType, @StringType]
        @otherSpecific = @FunctionType.withTypes [@IntType, @IntType]
        @wrongParamType = @FunctionType.withTypes [@IntType, @StringType]

      it 'generic includes specific identity', ->
        assert.truthy 'generic.includes specific', @hasType(dataType: @generic, @specific)

      it 'generic includes other generic', ->
        assert.truthy 'generic.includes otherGeneric', @hasType(dataType: @generic, @otherGeneric)

      it 'specific does not include generic', ->
        assert.falsey 'specific.includes generic', @hasType(dataType: @specific, @generic)

      it 'specific does not include other specific', ->
        assert.falsey 'specific.includes otherSpecific', @hasType(dataType: @specific, @otherSpecific)

      it 'specific does not include wrongParamType', ->
        assert.falsey 'specific.includes wrongParamType', @hasType(dataType: @specific, @wrongParamType)

    describe '(a) -> b', ->
      beforeEach ->
        @a = new @TypeVariable()
        @b = new @TypeVariable()
        @identity = @FunctionType.withTypes [@a, @a]
        @generic = @FunctionType.withTypes [@a, @b]
        @otherGeneric = @FunctionType.withTypes [@b, @a]
        @specific = @FunctionType.withTypes [@IntType, @StringType]
        @otherSpecific = @FunctionType.withTypes [@StringType, @IntType]
        @genericToSpecific = @FunctionType.withTypes [@a, @IntType]
        @specificToGeneric = @FunctionType.withTypes [@IntType, @a]

      it 'generic includes specific identity', ->
        assert.truthy 'generic.includes specific', @hasType(dataType: @generic, @specific)

      it 'generic includes other generic', ->
        assert.truthy 'generic.includes otherGeneric', @hasType(dataType: @generic, @otherGeneric)

      it 'specific does not include generic', ->
        assert.falsey 'specific.includes generic', @hasType(dataType: @specific, @generic)

      it 'specific does not include other specific', ->
        assert.falsey 'specific.includes otherSpecific', @hasType(dataType: @specific, @otherSpecific)

      xit 'identity does not include generic', -> # not all generic (a -> b) are also (a -> a)
        assert.falsey 'identity.includes generic', @hasType(dataType: @identity, @generic)

      it 'generic includes identity', -> # identity is special case where a = b
        assert.truthy 'generic.includes identity', @hasType(dataType: @generic, @identity)
