'use strict';

var targets = {
  javascript: require('./javascript')
};

function transform(program, options) {
  options = options || {};
  var target = options.target || 'javascript';

  return targets[target](program, options);
}
module.exports = transform;
