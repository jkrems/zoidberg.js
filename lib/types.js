/* jshint node:true */
'use strict';

var _ = require('lodash');

_.each([
  'String',
  'Int',
  'Bool'
], function(basicType) {
  exports[basicType] = {
    name: basicType,
    primitive: true,
    toString: function() {
      return '[[' + basicType + ']]';
    }
  };
});

exports.hasType = function(node, type) {
  if (type.primitive) {
    return node.dataType === type;
  } else {
    throw new Error('Non-primitive types not implemented');
  }
};
