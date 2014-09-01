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


function BaseType(name, primitive) {
  this.name = name;
  this.primitive = primitive || false;
  this.types = []; // type arguments
}
exports.BaseType = BaseType;

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


function PrimitiveType(name) {
  BaseType.call(this, name, true);
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


function TypeVariable(instance) {
  this.name = 'TypeVariable';
  this.primitive = false;
  this.instance = instance || null;

  this.id = TypeVariable.next++;
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


function ArrayType(itemType) {
  BaseType.call(this, 'ArrayType');
  this.types = [itemType];
}
ArrayType.prototype = Object.create(BaseType.prototype);
exports.ArrayType = ArrayType;

ArrayType.prototype.toString = function toString() {
  return '[' + this.types[0] + ']';
};


function FunctionType(paramTypes, returnType) {
  BaseType.call(this, 'FunctionType');

  this.types = paramTypes.concat([returnType]);
}
FunctionType.prototype = Object.create(BaseType.prototype, {
  paramTypes: {
    get: function() { return this.types.slice(0, -1); }
  },
  returnType: {
    get: function() { return this.types[this.types.length - 1]; }
  }
});
exports.FunctionType = FunctionType;

FunctionType.prototype.toString = function toString() {
  return '\\(' +
    this.paramTypes.map(typeToString).join(', ') + ' -> ' +
    typeToString(this.returnType) + ')';
};

// a -> a includes String -> String
// a -> a includes Int -> Int
// String -> String includes String -> String
// String -> String does not include a -> a
// String -> String does not include Int -> Int
// FunctionType.prototype.includes = function includes(otherType) {
//   otherType = prune(otherType);

//   debug('FunctionType.includes:sanity');
//   if (!otherType instanceof FunctionType) return false;
//   if (this.types.length !== otherType.types.length) return false;

//   var myVars = [];
//   var matched = [];

//   if (!otherType.returnType) {
//     debug('Function:returnType is invalid');
//     return false;
//   }

//   debug('Function:returnType %s includes %s', this.returnType, otherType.returnType);
//   var returnType = prune(this.returnType);
//   var otherReturnType = prune(otherType.returnType);
//   if (returnType instanceof TypeVariable) {
//     myVars.push(returnType);
//     matched.push(otherReturnType);
//   } else {
//     if (!returnType.includes(otherReturnType)) {
//       return false;
//     }
//   }

//   function checkParam(param, idx) {
//     var otherParam = prune(otherType.paramTypes[idx]);
//     param = prune(param);

//     debug('Function:param %s includes %s', String(param), String(otherParam));

//     if (param instanceof TypeVariable) {
//       var mappedIdx = myVars.indexOf(param);
//       if (mappedIdx !== -1) {
//         return matched[mappedIdx].includes(otherParam);
//       } else {
//         myVars.push(param);
//         matched.push(otherParam);
//         return true;
//       }
//     } else {
//       return param.includes(otherParam);
//     }
//   }

//   // check every param
//   if (!_.every(this.paramTypes, checkParam)) {
//     return false;
//   }

//   return true;
// };


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
    if (target.name !== other.name || target.types.length !== other.types.length) {
      throw new Error(util.format('%s and %s are not compatible', target, other));
    }

    // unify type arguments
    _.each(target.types, function(typeArg, idx) {
      unify(typeArg, other.types[idx]);
    });
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
