/* jshint node:true */
'use strict';

module.exports = process.env.PEG === '0' ?
  require('./hand-parser.js') : require('./peg-parser.js');
