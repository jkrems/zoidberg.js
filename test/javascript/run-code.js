'use strict';

var execFile = require('child_process').execFile;
var path = require('path');

var _ = require('lodash');

var zbBin = path.resolve(__dirname, '..', '..', 'bin', 'zb');

function runCode(source) {
  return function(done) {
    var self = this;

    var opts = {
      env: _.defaults({ DEBUG: '' }, process.env)
    };

    var child = execFile(process.execPath, [
      '--harmony',
      zbBin,
      '-'
    ], opts, function(err, stdout, stderr) {
      self.stdout = stdout;
      self.stderr = stderr;
      done(err);
    });

    child.stdin.write(source);
    child.stdin.end();
  };
}
module.exports = runCode;
