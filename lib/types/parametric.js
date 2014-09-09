'use strict';

module.exports = function(TypeVariable) {
  var DEFAULT_NAME = '<Name unknown>';

  /**
   * This is the basis for (almost) all other types,
   * including custom types.
   * We treat non-parametric types as a special case of parametric ones
   * with types = [].
   *
   * @param name Name of the type, mostly for pretty-printing and humans
   * @param uniqueToken Something to compare types by, using `===`
   * @param types Array with type arguments
   * @param props Public properties, array of {name, dataType}
   * @param state Private state, array of {name, dataType}
   * @param dataType Describes static access, e.g. Int.parse("10")
   */
  function ParametricType(name, uniqueToken, types, props, state, dataType) {
    this.name = name || DEFAULT_NAME;
    this.uniqueToken = uniqueToken || {};
    this.types = types || [];
    this.props = props || [];
    this.state = state || [];
    this.dataType = dataType || null;
  }

  ParametricType.prototype.toString = function toString() {
    var params = this.types.length > 0 ?
        ('(' + this.types.map(TypeVariable.prune).join(', ') + ')')
      : '';
    return '@' + this.name + params;
  };

  ParametricType.prototype.withTypes = function withTypes(types) {
    // TODO: handle props, state, dataType
    // in combination with type variables in this.types
    return new ParametricType(this.name, this.uniqueToken,
      types, this.props, this.state, this.dataType);
  }

  ParametricType.prototype.isCompatible = function isCompatible(other) {
    return this.uniqueToken === other.uniqueToken &&
      this.types.length === other.types.length;
  };

  return ParametricType;
};
