/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:types');


function typeToString(t) {
  if (t === undefined) return '?';
  return String(t);
}
exports.typeToString = typeToString;


function _safeCopy(t, varCache) {
  if (!varCache) {
    throw new Error('_safeCopy requires varCache');
  }

  function copyWithCache(childType) {
    return _safeCopy(childType, varCache);
  }

  if (Array.isArray(t)) {
    return t.map(copyWithCache);
  } else if(t) {
    if (!(typeof t.clone === 'function')) {
      console.log('t has no clone:', t);
    }
    return t.clone(varCache);
  }
}
exports.safeCopy = function(t, varCache) {
  return _safeCopy(t, varCache || {});
};


function BaseType(name, primitive, types, props, state, statics) {
  this.name = name;
  this.primitive = primitive || false;
  this.types = types; // type arguments
  this.props = props || [];
  this.state = state || [];
  this.statics = statics || [];
}
exports.BaseType = BaseType;

BaseType.prototype.toString = function toString() {
  var params;
  if (this.types) {
    params = this.types.length > 0 ? ('(' + this.types.join(', ') + ')') : '';
  } else {
    params = '(..?)'
  }
  return '@' + (this.name || '<Name unknown>') + params;
};

BaseType.prototype.includes = function includes(otherType) {
  otherType = prune(otherType);

  debug('BaseType.includes:sanity %s / %s', this, otherType);
  if (!(otherType instanceof BaseType)) {
    debug('Not a base type: %s', otherType);
    return false;
  }
  if (otherType.name !== this.name) {
    debug('Name mismatch: %j vs. %j', this.name, otherType.name);
    return false;
  }
  if (this.types.length !== otherType.types.length) return false;

  var myVars = [];
  var matched = [];

  function checkTypeParam(param, idx) {
    var otherParam = prune(otherType.types[idx]);
    param = prune(param);

    debug('BaseType:param[%d] %s includes %s', idx, String(param), String(otherParam));

    if (param === undefined || otherParam === undefined) {
      debug('Invalid param - undefined!');
      return false;
    }

    if (param instanceof TypeVariable) {
      var mappedIdx = myVars.indexOf(param);
      if (mappedIdx !== -1) {
        var mapped = matched[mappedIdx];
        return mapped.includes(otherParam);
      } else {
        myVars.push(param);
        matched.push(otherParam);
        return true;
      }
    } else {
      return param.includes(otherParam);
    }
  }

  // check every param
  if (!_.every(this.types, checkTypeParam)) {
    return false;
  }

  return true;
};

BaseType.prototype.clone = function clone(varCache) {
  return new BaseType(name, primitive, _safeCopy(types, varCache));
};


function PrimitiveType(name) {
  BaseType.call(this, name, true, []);
}
PrimitiveType.prototype = Object.create(BaseType.prototype);

PrimitiveType.prototype.toString = function toString() {
  return '#' + this.name;
};

PrimitiveType.prototype.includes = function includes(otherType) {
  otherType = prune(otherType);
  return otherType.primitive && otherType.name === this.name;
};

_.each([
  'String',
  'Int',
  'Bool'
], function(basicType) {
  exports[basicType + 'Type'] = new PrimitiveType(basicType);
});


function TypeReference(ref) {
  this.name = ref;
  this.primitive = false;
  this.isGeneric = /^[a-z]/.test(ref);
}
exports.TypeReference = TypeReference;

TypeReference.prototype.toString = function toString() {
  return '`' + this.name + '`';
};

TypeReference.prototype.includes = function includes(otherType) {
  otherType = prune(otherType);
  return otherType instanceof TypeReference && otherType.name === this.name;
};


function TypeVariable(instance, id) {
  this.name = 'TypeVariable';
  this.primitive = false;
  this.instance = instance || null;

  if (id) {
    this.id = id;
  } else {
    this.id = TypeVariable.next++;
  }
}
exports.TypeVariable = TypeVariable;
TypeVariable.next = 1;

TypeVariable.prototype.toString = function toString() {
  var resolvedHint = '';
  if (this.instance) {
    resolvedHint = ' := ' + prune(this);
  }
  return '$' + this.id + resolvedHint;
};

TypeVariable.prototype.includes = function includes(otherType) {
  if (this.instance) {
    return prune(this).includes(otherType);
  }
  otherType = prune(otherType);
  return otherType instanceof TypeVariable && otherType.id === this.id;
};

TypeVariable.prototype.clone = function clone(varCache) {
  if (!varCache[this.id]) {
    varCache[this.id] = new TypeVariable(
      _safeCopy(this.instance, varCache), this.id);
  }
  return varCache[this.id];
}


function ArrayType(itemType) {
  BaseType.call(this, 'ArrayType', false, [itemType]);
}
ArrayType.prototype = Object.create(BaseType.prototype);
exports.ArrayType = ArrayType;

ArrayType.prototype.toString = function toString() {
  return '[' + this.types[0] + ']';
};

ArrayType.prototype.clone = function clone() {
  return new ArrayType(safeCopy(this.types[0]));
}


function FunctionType(paramTypes, returnType) {
  BaseType.call(this, 'FunctionType', false, paramTypes.concat([returnType]));
}
FunctionType.prototype = Object.create(BaseType.prototype, {
  paramTypes: {
    get: function() { return this.types.slice(0, -1); }
  },
  returnType: {
    get: function() { return this.types[this.types.length - 1]; },
    set: function(value) { this.types[this.types.length - 1] = value; }
  }
});
exports.FunctionType = FunctionType;

FunctionType.prototype.toString = function toString() {
  return '\\(' +
    this.paramTypes.map(typeToString).join(', ') + ' -> ' +
    typeToString(this.returnType) + ')';
};

FunctionType.prototype.clone = function clone(varCache) {
  return new FunctionType(
    _safeCopy(this.paramTypes, varCache),
    _safeCopy(this.returnType, varCache));
}

exports.hasType = function hasType(node, type) {
  return node.dataType && type.includes(node.dataType);
};


function prune(type) {
  if (type instanceof TypeVariable && type.instance) {
    type.instance = prune(type.instance);
    return type.instance;
  }
  return type;
}
exports.prune = prune;


function unify(target, other) {
  // resolve type variables that are already assigned a type
  // e.g. if target is $1 and we already know that $1 is a String,
  // this will set target to String (recursively).
  target = prune(target);
  other = prune(other);

  debug('Unify %s / %s', target, other);

  if (target instanceof TypeVariable) {
    if (target !== other) {
      // if (occursInType(target, other)) {
      //   throw new Error(
      //     util.format('%s occurs in %s, recursive unification invalid',
      //       target, other));
      // }

      // Make target reference other. They are now refering to the same thing.
      debug('unify %s := %s', target, other);
      target.instance = other;
    } // nothing to do if it's the same type variable
  } else if (target instanceof BaseType && other instanceof TypeVariable) {
    unify(other, target);
  } else if (target instanceof BaseType && other instanceof BaseType) {
    // compare general type & length
    if ((other.name !== undefined && target.name !== other.name) ||
        (other.types !== undefined && target.types.length !== other.types.length)) {
      throw new Error(util.format('%s and %s are not compatible', target, other));
    }

    // unify type arguments
    _.each(target.types, function(typeArg, idx) {
      unify(typeArg, other.types[idx]);
    });

    // unify props

    // unify state

    // unify statics
  } else {
    throw new Error(
      util.format('%s could not be unified with %s',
        target, other));
  }
}
exports.unify = unify;


exports.getBuiltIns = function getBuiltIns() {
  return {
    'String': exports.StringType,
    'Int': exports.IntType,
    'Bool': exports.BoolType
  };
};
