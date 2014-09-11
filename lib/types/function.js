
module.exports = function(ParametricType) {
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

  return FunctionType;
};
