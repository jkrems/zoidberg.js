/* jshint node:true */
'use strict';

var _ = require('lodash');
var debug = require('debug')('zoidberg:types');


function typeToString(t) {
  if (t === undefined) return '?';
  return String(t);
}
exports.typeToString = typeToString;


function PrimitiveType(name) {
  this.name = name;
  this.primitive = true;
}

PrimitiveType.prototype.toString = function toString() {
  return '[[' + this.name + ']]';
};

PrimitiveType.prototype.includes = function includes(otherType) {
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
}
exports.TypeReference = TypeReference;

TypeReference.prototype.toString = function toString() {
  return '`' + this.name + '`';
};

TypeReference.prototype.includes = function includes(otherType) {
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
  return '$' + this.id;
};

TypeVariable.prototype.includes = function includes(otherType) {
  return otherType instanceof TypeVariable && otherType.id === this.id;
};


function FunctionType(paramTypes, returnType) {
  this.name = 'FunctionType';
  this.primitive = false;

  this.paramTypes = paramTypes;
  this.returnType = returnType;
}
exports.FunctionType = FunctionType;

FunctionType.prototype.toString = function toString() {
  return '[[ (' +
    this.paramTypes.map(typeToString).join(', ') + ') -> ' +
    typeToString(this.returnType) + ' ]]';
};

// a -> a includes String -> String
// a -> a includes Int -> Int
// String -> String includes String -> String
// String -> String does not include a -> a
// String -> String does not include Int -> Int
FunctionType.prototype.includes = function includes(otherType) {
  debug('FunctionType.includes:sanity');
  if (!otherType instanceof FunctionType) return false;
  if (this.paramTypes.length !== otherType.paramTypes.length) return false;

  var myVars = [];
  var matched = [];

  if (!otherType.returnType) {
    debug('Function:returnType is invalid');
    return false;
  }

  debug('Function:returnType %s includes %s', this.returnType, otherType.returnType);
  if (this.returnType instanceof TypeVariable) {
    myVars.push(this.returnType);
    matched.push(otherType.returnType);
  } else {
    if (!this.returnType.includes(otherType.returnType)) {
      return false;
    }
  }

  function checkParam(param, idx) {
    var otherParam = otherType.paramTypes[idx];
    debug('Function:param %s includes %s', String(param), String(otherParam));

    if (param instanceof TypeVariable) {
      var mappedIdx = myVars.indexOf(param);
      if (mappedIdx !== -1) {
        return matched[mappedIdx].includes(otherParam);
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
  if (!_.every(this.paramTypes, checkParam)) {
    return false;
  }

  return true;
};


exports.hasType = function hasType(node, type) {
  return node.dataType && type.includes(node.dataType);
};


function prune(type) {
  if (type instanceof TypeVariable) {
    type.instance = prune(type.instance);
    return type.instance;
  }
  return type;
}
exports.prune = prune;


exports.getBuiltIns = function getBuiltIns() {
  return {
    'String': exports.StringType,
    'Int': exports.IntType,
    'Bool': exports.BoolType
  };
};
