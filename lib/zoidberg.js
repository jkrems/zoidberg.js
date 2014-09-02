/* jshint node:true */
'use strict';

var fs = require('fs');

var runMain = require('./evaluate').runMain;
var parser = require('./parser');
var infer = require('./inference');

var source = fs.readFileSync('examples/greet.berg', 'utf8');
var parsed = parser.parse(source);
var checked = infer(parsed);
process.exit(runMain(checked, process.argv));
