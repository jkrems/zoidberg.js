'use strict';

var fs = require('fs');

var parser = require('./parser');
var infer = require('./inference');
var codeGen = require('./code-gen');
var TypeSystem = require('./types');

function compile(source, options) {
  options = options || {};
  var target = options.target || 'javascript';
  // var programFile =  process.argv[2];

  var typeSystem = TypeSystem();
  var parsed = parser.parse(source);
  var checked = infer(parsed, typeSystem);
  var compiled = codeGen(checked, {
    target: target,
    typeSystem: typeSystem
  });
  return compiled;
}
exports.compile = compile;

function runMain(source, options) {
  var compiled = compile(source);

  var mainModule = require.main;
  mainModule.filename = process.argv[1] =
    fs.realpathSync(options.filename || '.');

  // console.error(compiled.code);
  // console.error('--- ' + mainModule.filename + ' ---');
  mainModule._compile(compiled.code, mainModule.filename);
}
exports.runMain = runMain;
