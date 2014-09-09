/* jshint node:true */
'use strict';

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference:symbol-table');

var TypeSystem = require('../types');

function SymbolTable(base, generateVariable) {
  this._table = {};
  this.generateVariable = generateVariable;
  if (base) {
    _.extend(this._table, base);
  }
}

SymbolTable.prototype.clone = function() {
  return new SymbolTable(this._table, this.generateVariable);
};

SymbolTable.prototype.getType = function(id) {
  var symbol = this.get(id);
  return (symbol ? symbol.dataType : undefined);
};

SymbolTable.prototype.get = function(id) {
  return this._table[id];
};

SymbolTable.prototype._set = function(id, value) {
  this._table[id] = value;
  return value;
};

SymbolTable.prototype.set = function(id, value) {
  debug('Adding %s = %s', id, value);
  return this._set(id, value);
};

SymbolTable.prototype.addWithType = function(id, dataType) {
  debug('Adding %s w/ type %s', id, dataType);
  this._set(id, { dataType: dataType });
  return dataType;
};

SymbolTable.prototype.resolveTypeRef = function(dataType) {
  if (!(dataType instanceof TypeSystem.TypeReference)) {
    return dataType;
  }

  var refType = this.get(dataType.name);
  debug('Resolving %s -> %s', dataType, refType);
  if (refType === undefined) {
    if (!dataType.isGeneric) {
      throw new Error('Unknown type: ' + dataType.name);
    }
    refType = this.set(dataType.name, this.generateVariable());
  }

  if (refType.withTypes) {
    return refType.withTypes(dataType.types);
  }
  return refType;
};

module.exports = SymbolTable;
