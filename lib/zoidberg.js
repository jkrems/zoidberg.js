/* jshint node:true */
'use strict';

var fs = require('fs');

var runMain = require('./evaluate').runMain;
var parser = require('./parser');

var source = fs.readFileSync('examples/greet.berg', 'utf8');
var parsed = parser.parse(source);
process.exit(runMain(parsed, process.argv));
