'use strict';

var _ = require('lodash');

/*
 * We wrap this in a function to reset variable ids
 * we wouldn't want to have side effects across compilations.
 */
module.exports = function() {
  var nextVariableId = 0;

  /*
   * Type variables are any kind of "unknown types".
   * They are used to either..:
   *
   * 1. Express template types, e.g. `T` in `vector<T>`
   * 2. Act as placeholders during type inference,
   *    e.g. `typeof(x)` in `auto x = 10;`
   *
   * For the second kind, `_value` is the resolved type.
   * Once the value is set, it can't be changed.
   * To get the value of a type variable, use `prune(type)`
   * which deeply resolves `._value` properties.
   *
   * Because we didn't get the "premature optimization" memo,
   * we update `._value` with the recursively resolved value
   * whenever we prune.
   */
  function TypeVariable(value, id) {
    this._value = value || null;

    if (id) {
      this.id = id;
    } else {
      this.id = nextVariableId++;
    }
  }

  Object.defineProperty(TypeVariable.prototype, 'value', {
    get: function() { return this._value; },
    set: function(value) {
      if (this._value) {
        throw new Error('Value of TypeVariable can only be set once');
      }
      this._value = value;
    }
  });

  TypeVariable.prototype.toString = function toString() {
    var prunedHint = '';
    var pruned = prune(this);
    if (pruned !== this) {
      prunedHint = ' := ' + prune(this);
    }
    return '$' + niceId(this.id) + prunedHint;
  };

  TypeVariable.prune = prune;

  return TypeVariable;
};

function niceId(id) {
  var letter = String.fromCharCode(id % 26 + 97);
  var idx = id < 26 ? '' : (Math.floor(id / 26) + 1);
  return letter + idx;
}

function prune(type) {
  if (!type) return type;

  var seen = [ type ], value;
  while ((value = type.value)) {
    if (seen.indexOf(value) !== -1) {
      throw new Error('Cyclic type variables detected');
    }
    seen.push(type = value);
  }
  // Next time this is called we can short-cut
  _.each(seen, function(typeVariable) {
    if (typeVariable !== type) {
      typeVariable._value = type;
    }
  });
  return type;
}
