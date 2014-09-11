/**
 * The Zoidberg Type System
 */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:types');

var TypeVariableNamespace = require('./variable');
var ParametricTypeNamespace = require('./parametric');

function TypeSystem() {
  var types = {};

  var TypeVariable = types.TypeVariable = TypeVariableNamespace();
  var prune = types.prune = TypeVariable.prune;

  var ParametricType = types.ParametricType =
    ParametricTypeNamespace(TypeVariable);

  var FunctionType = types.FunctionType = new ParametricType('Function');

  types.ArrayType = new ParametricType('Array');

  types.prettyPrint = prettyPrint;

  types.generateVariable = function() {
    return new TypeVariable();
  };

  _.each(['Bool', 'Int', 'String'], function(basicType) {
    types[basicType + 'Type'] = new ParametricType(basicType);
  });

  types.getBuiltIns = function() {
    return {
      String: types.StringType,
      Int: types.IntType,
      Bool: types.BoolType,
      Function: types.FunctionType
    };
  };

  function unify(target, other, oneWayOnly) {
    target = prune(target);
    other = prune(other);

    debug('Unify %s with %s', target, other);

    if (target instanceof TypeVariable) {
      if (target !== other) {
        debug('%s := %s', target, other);
        target.value = other;
      }
    } else if (other instanceof TypeVariable) {
      if (oneWayOnly) {
        throw new Error(
          util.format(
            'Can not unify specific %s with generic %s', target, other));
      }
      return unify(other, target);
    } else if (
        target instanceof ParametricType &&
        other instanceof ParametricType) {
      if (!target.isCompatible(other)) {
        throw new Error(
          util.format('%s and %s are not compatible', target, other));
      }

      _.each(target.types, function(typeArg, idx) {
        unify(typeArg, other.types[idx], oneWayOnly);
      });

      // unify props

      // unify state

      // unify statics
    } else {
      throw new Error(
        util.format('%s could not be unified with %s', target, other));
    }
  }
  types.unify = unify;

  function hasType(node, type) {
    var nodeType = safeCopy(prune(node.dataType));
    var targetType = safeCopy(prune(type));

    debug('hasType(%s, %s)', nodeType, targetType);
    try {
      unify(nodeType, targetType, true);
      return true;
    } catch (err) {
      debug('hasType failed with %s', err);
      return false;
    }
  }
  types.hasType = hasType;

  function safeCopy(type, knownVars) {
    knownVars = knownVars || {};

    function handleTypeVariable(typeVar) {
      var mapped = knownVars[typeVar.id];
      if (!mapped) {
        knownVars[typeVar.id] = mapped = new TypeVariable();
      }
      return mapped;
    }

    if (type instanceof ParametricType) {
      var types = type.types.map(function(param) {
        param = prune(param);
        if (param instanceof TypeVariable) {
          return handleTypeVariable(param);
        } else {
          return safeCopy(param, knownVars);
        }
      });
      return type.withTypes(types);
    } else {
      return type;
    }
  }
  types.safeCopy = safeCopy;

  function isCallable(type) {
    // TODO: mark this as "should be a function"
    if (type instanceof TypeVariable) return true;
    return type.uniqueToken === FunctionType.uniqueToken;
  }
  types.isCallable = isCallable;

  return types;
}

function TypeReference(name, types) {
  this.name = name;
  this.isGeneric = /^[a-z]/.test(name);
  this.types = types || [];
}
TypeSystem.TypeReference = TypeReference;

TypeReference.prototype.toString = function toString() {
  var types = this.types;
  var params = types.length ?
    ('(' + types.map(prettyPrint).join(', ') + ')') : '';
  return '`' + this.name + params + '`';
};

function prettyPrint(t) {
  return t ? ('' + t) : '?';
}

module.exports = TypeSystem;
