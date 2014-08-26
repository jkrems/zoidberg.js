/* jshint node:true */
'use strict';

var fs = require('fs');

var debug = require('debug')('zoidberg');

var source = fs.readFileSync('examples/greet.berg', 'utf8');
// var parser = require('./parser');

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
  debug('[%d] readString %j', this.idx, expected);
  var actual = this.next(expected.length);
  if (actual !== expected) {
    this.fail('Expected ' + expected);
  }
  return actual;
}

ParserState.prototype.try = function(rule) {
  var ruleName = rule.name || '<unkown>';
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

var WHITESPACE = /^[\s]+/;
function Whitespace(state) {
  return state.readPattern(WHITESPACE);
}

var IDENTIFIER = /^([a-z][\w0-9]*)/i;
function Identifier(state) {
  var name = state.readPattern(IDENTIFIER);
  return name[1];
}

function ParenExpression(state) {
  state.readString('(');
  var expr = Expression(state);
  state.readString(')');
  return expr;
}

var INTEGER_LITERAL = /^([1-9][0-9]*|0)/;
function Literal(state) {
  var int = state.readPattern(INTEGER_LITERAL);
  return {
    value: parseInt(int[1], 10),
    dataType: 'Int'
  };
}

function LiteralExpression(state) {
  return {
    type: 'LiteralExpression',
    value: Literal(state)
  };
}

function IdentifierExpression(state) {
  return {
    type: 'IdentifierExpression',
    name: Identifier(state)
  };
}

function ValueExpression(state) {
  return state.or(LiteralExpression, IdentifierExpression, ParenExpression);
}

function ArgumentList(state) {
  var firstArg = state.try(Expression);
  if (firstArg === undefined) return [];

  var args = [ firstArg ];
  do {
    var arg = state.try(function(s) {
      s.skip(Whitespace);
      s.readString(',');
      s.skip(Whitespace);
      return Expression(s);
    });
    if (arg !== undefined) {
      args.push(arg);
    }
  } while (arg !== undefined);

  return args;
}

function FCallExpression(state) {
  var value = ValueExpression(state);
  var openingFCall = state.try(function(s) {
    s.skip(Whitespace);
    return s.readString('(');
  });

  if (openingFCall === undefined) {
    return value;
  }
  var args = ArgumentList(state);
  state.skip(Whitespace);
  state.readString(')');
  return {
    type: 'FCallExpression',
    callee: value,
    args: args
  };
}

function UnaryOperator(state) {
  return state.readPattern(/^[+!~-]/)[0];
}

function UnaryExpression(state) {
  var op = state.try(UnaryOperator);
  var value = FCallExpression(state);

  if (op !== undefined) {
    return {
      type: 'UnaryExpression',
      operator: op,
      right: value
    };
  } else {
    return value;
  }
}

function MulOperator(state) {
  return state.readPattern(/^[*/%]/)[0];
}

function MulExpression(state) {
  var rootNode = UnaryExpression(state);

  do {
    var node = state.try(function(s) {
      s.skip(Whitespace);
      var op = MulOperator(s);
      s.skip(Whitespace);
      var right = UnaryExpression(s);
      return {
        type: 'MulExpression',
        operator: op,
        right: right
      };
    });
    if (node !== undefined) {
      node.left = rootNode;
      rootNode = node;
    }
  } while (node !== undefined);

  return rootNode;
}

function AddOperator(state) {
  return state.readPattern(/^[+-]/)[0];
}

function AddExpression(state) {
  var rootNode = MulExpression(state);

  do {
    var node = state.try(function(s) {
      s.skip(Whitespace);
      var op = AddOperator(s);
      s.skip(Whitespace);
      var right = MulExpression(s);
      return {
        type: 'AddExpression',
        operator: op,
        right: right
      };
    });
    if (node !== undefined) {
      node.left = rootNode;
      rootNode = node;
    }
  } while (node !== undefined);

  return rootNode;
}

function Expression(state) {
  return AddExpression(state);
}

function Parameter(state) {
  var name = Identifier(state);
  var type = state.try(function(s) {
    s.skip(Whitespace);
    s.readString(':');
    s.skip(Whitespace);
    return Identifier(s);
  });
  return {
    name: name,
    dataType: type
  };
}

function ParameterList(state) {
  // param ( "," param )*
  var firstParam = state.try(Parameter);
  if (firstParam === undefined) return [];

  var params = [ firstParam ];
  do {
    var param = state.try(function(s) {
      s.skip(Whitespace);
      s.readString(',');
      s.skip(Whitespace);
      return Parameter(s);
    });
    if (param !== undefined) {
      params.push(param);
    }
  } while (param !== undefined);

  return params;
}

function Declaration(state) {
  var name = Identifier(state);
  state.skip(Whitespace);
  state.readString('(');
  state.skip(Whitespace);
  var params = ParameterList(state);
  state.skip(Whitespace);
  state.readString(')');
  state.skip(Whitespace);
  state.readString('=');
  state.skip(Whitespace);
  state.readString('{');
  state.skip(Whitespace);
  var body = Expression(state);
  state.skip(Whitespace);
  state.readString('}');

  debug('[%d] Declaration %j', state.idx, name);

  return {
    type: 'FunctionDeclaration',
    name: name,
    params: params,
    body: body
  };
}

function Declarations(state) {
  var decls = [ Declaration(state) ];

  do {
    var decl = state.try(function(s) {
      s.skip(Whitespace);
      return Declaration(s);
    });
    if (decl !== undefined) {
      debug('[%d] Adding declaration of %j', state.idx, decl.name);
      decls.push(decl);
    }
  } while (decl !== undefined);

  return decls;
}

function Program(state) {
  state.skip(Whitespace);
  var decls = Declarations(state);
  state.skip(Whitespace);
  state.eof();
  return {
    lines: decls
  };
}

function customParser(text) {
  var state = new ParserState(text);
  return Program(state);
}

var parser = { parse: customParser };

var parsed = parser.parse(source);

function evaluate(program, bindings, node) {
  switch (node.type) {
    case 'AddExpression':
      var left = evaluate(program, bindings, node.left);
      var right = evaluate(program, bindings, node.right);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        default: throw new Error('Unknown add operator: ' + node.operator);
      }

    case 'MulExpression':
      var left = evaluate(program, bindings, node.left);
      var right = evaluate(program, bindings, node.right);
      switch (node.operator) {
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        default: throw new Error('Unknown mul operator: ' + node.operator);
      }

    case 'UnaryExpression':
      var right = evaluate(program, bindings, node.right);
      switch (node.operator) {
        case '-': return -right;
        case '+': return +right;
        case '!': return !right;
        case '~': return ~right;
        default: throw new Error('Unknown unary operator: ' + node.operator);
      }

    case 'LiteralExpression':
      return node.value.value;

    case 'IdentifierExpression':
      var name = node.name;
      return bindings[name];

    case 'FCallExpression':
      var fn = evaluate(program, bindings, node.callee);
      var args = node.args.map(function(arg) {
        return evaluate(program, bindings, arg);
      });
      return runFunction(program, bindings, fn, args);

    default:
      throw new Error('Unknown node type: ' + node.type);
  }
}

function runFunction(program, bindings, fn, args) {
  var argBindings = fn.params.reduce(function(bound, param, idx) {
    bound[param.name] = args[idx];
    return bound;
  }, Object.create(bindings));

  return evaluate(program, argBindings, fn.body);
}

function runMain(program, argv) {
  var bindings = program.lines.reduce(function(bound, line) {
    bound[line.name] = line;
    return bound;
  }, {});
  var mainFn = bindings.main;

  var args = (argv || process.argv).slice(2);
  var params = mainFn.params;

  if (args.length !== params.length) {
    throw new Error('Expected ' + params.length + ' arguments');
  }

  var parsedArgs = args.map(function(arg, idx) {
    var param = params[idx];

    switch (param.dataType) {
      case 'Int32':
      case 'Int':
        return parseInt(arg, 10);
      default:
        return arg;
    }
  });

  var result = runFunction(program, bindings, mainFn, parsedArgs);
  console.log('Evaluates to %j', result);
}
runMain(parsed);
