/* jshint node:true */
'use strict';

var _ = require('lodash');
var debug = require('debug')('zoidberg:parser-state');

function ParserState(text) {
  this.text = text;
  this.idx = 0; // next char to read
  this.line = 1; // 1-based position of next char to read
  this.column = 1;
}

ParserState.prototype.clone = function() {
  var state = new ParserState(this.text);
  state.idx = this.idx;
  state.line = this.line;
  state.column = this.column;
  return state;
};

ParserState.prototype.next = function(count) {
  if (count === undefined) count = 1;

  var endIndex = this.idx + count;
  var result = this.text.substring(this.idx, endIndex);

  while (this.idx < endIndex) {
    if (this.text[this.idx] === '\n') {
      ++this.line;
      this.column = 1;
    } else {
      ++this.column;
    }
    ++this.idx;
  }

  return result;
};

ParserState.prototype.peek = function() {
  return this.text[this.idx];
}

ParserState.prototype.readPattern = function(pattern) {
  debug('[%d] readPattern %j', this.idx, pattern.toString());
  var match = this.text.substr(this.idx).match(pattern);
  if (match !== null) {
    var matched = match[0];
    this.next(matched.length);
    return match;
  } else {
    this.fail('Expected ' + pattern);
  }
}

ParserState.prototype.readString = function(expected) {
  var actual = this.next(expected.length);
  debug('[%d] readString %j - %j', this.idx, expected, actual);
  if (actual !== expected) {
    this.fail('Expected ' + expected);
  }
  return actual;
}

ParserState.prototype.try = function(rule) {
  var ruleName = rule.name || rule.toString();
  debug('[%d] try %j', this.idx, ruleName);
  var cloned = this.clone();
  try {
    var result = rule(cloned);
    this.idx = cloned.idx;
    this.column = cloned.column;
    this.line = cloned.line;
    return result;
  } catch (err) {
    debug('[%d] try %j', this.idx, ruleName, err.message);
    return undefined;
  }
}

ParserState.prototype.skip = function(rule) {
  this.try(rule);
};

ParserState.prototype.trackNodeLocation = function() {
  var sourceLocation = {
    source: this.text,
    start: {
      line: this.line,
      column: this.column
    }
  };

  return function capture() {
    var loc = _.cloneDeep(sourceLocation);
    loc.end = { line: this.line, column: this.column };
    return loc;
  }.bind(this);
};

var spaces = '                                                                ';
ParserState.prototype.fail = function(reason, cause) {
  var lines = this.text.split('\n');
  var currentLine = lines[this.line - 1];
  var marker = spaces.substr(0, this.column - 1) + '^';

  var errMessage = (
    reason + ' at ' + this.line + ':' + this.column + '\n' +
    '  ' + currentLine + '\n  ' + marker
  );
  var err = new Error(errMessage);
  
  if (cause) {
    err.stack += 'Caused by:\n' + cause.stack;
  }
  throw err;
}

ParserState.prototype.eof = function() {
  if (this.idx < this.text.length) {
    this.fail('Expected EOF');
  }
}

ParserState.prototype.or = function() {
  var rules = [].slice.apply(arguments), lastRule = rules.pop(), i, l = rules.length;
  for (i = 0; i < l; ++i) {
    var result = this.try(rules[i]);
    if (result !== undefined) return result;
  }
  return lastRule(this);
}

module.exports = ParserState;
