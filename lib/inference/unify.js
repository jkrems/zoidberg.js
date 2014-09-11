'use strict';

var util = require('util');

var debug = require('debug')('zoidberg:inference:unify');

module.exports = function(typeSystem) {
  var TypeVariable = typeSystem.TypeVariable;
  var ParametricType = typeSystem.ParametricType;

  function unify(target, other) {
    // resolve type variables that are already assigned a type
    // e.g. if target is $1 and we already know that $1 is a String,
    // this will set target to String (recursively).
    target = target.prune();
    other = other.prune();

    debug('Unify %s / %s', target, other);

    if (typeof target.unifyWith === 'function') {
      return target.unifyWith(other);
    } else {
      throw new Error('Object can not be unified: ' +
        util.format('%s could not be unified with %s',
          target, other));
    }

    // if (target instanceof TypeVariable) {
    //   if (target !== other) {
    //     // if (occursInType(target, other)) {
    //     //   throw new Error(
    //     //     util.format('%s occurs in %s, recursive unification invalid',
    //     //       target, other));
    //     // }

    //     // Make target reference other. They are now refering to the same thing.
    //     debug('unify %s := %s', target, other);
    //     target.instance = other;
    //   } // nothing to do if it's the same type variable
    // } else if (target instanceof ParametricType && other instanceof TypeVariable) {
    //   unify(other, target);
    // } else if (target instanceof ParametricType && other instanceof ParametricType) {
    //   // compare general type & length
    //   if ((other.name !== undefined && target.name !== other.name) ||
    //       (other.types !== undefined && target.types.length !== other.types.length)) {
    //     throw new Error(util.format('%s and %s are not compatible', target, other));
    //   }

    //   // unify type arguments
    //   _.each(target.types, function(typeArg, idx) {
    //     unify(typeArg, other.types[idx]);
    //   });

    //   // unify props

    //   // unify state

    //   // unify statics
    // } else {
    //   throw new Error(
    //     util.format('%s could not be unified with %s',
    //       target, other));
    // }
  }
  return unify;
};
