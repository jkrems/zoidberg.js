'use strict';

function initPrimitiveTypes(types) {
  var IntType = types.IntType,
      StringType = types.StringType,
      BoolType = types.BoolType,
      FunctionType = types.FunctionType;

  function addChainable(type, operator) {
    type.props.push({
      name: operator,
      dataType: FunctionType.withTypes([
        type, type, type
      ])
    });
  }

  addChainable(IntType, '+');
  addChainable(IntType, '-');
  addChainable(IntType, '*');
  addChainable(IntType, '/');
  addChainable(IntType, '%');

  addChainable(StringType, '++');

  addChainable(BoolType, '&&');
}
module.exports = initPrimitiveTypes;
