/* jshint node:true */
'use strict';

module.exports = process.env.PEG ?
  require('./peg-parser.js') : require('./hand-parser.js');
