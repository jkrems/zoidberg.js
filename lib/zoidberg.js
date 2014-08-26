/* jshint node:true */
'use strict';

var fs = require('fs');

var debug = require('debug')('zoidberg:main');

var runMain = require('./evaluate').runMain;
var ParserState = require('./parser-state');

var source = fs.readFileSync('examples/greet.berg', 'utf8');
// var parser = require('./parser');

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

var STRING_LITERAL = /^"((?:[^"]|\\.)*)"/;
function StringLiteral(state) {
  var str = state.readPattern(STRING_LITERAL);
  return {
    value: str[1],
    dataType: 'Int'
  };
}

var INTEGER_LITERAL = /^([1-9][0-9]*|0)/;
function IntegerLiteral(state) {
  var int = state.readPattern(INTEGER_LITERAL);
  return {
    value: parseInt(int[1], 10),
    dataType: 'Int'
  };
}

function Literal(state) {
  return state.or(StringLiteral, IntegerLiteral);
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

function ListExpression(state) {
  var first = AddExpression(state);
  var expressions = [ first ];

  do {
    var expr = state.try(function(s) {
      s.skip(Whitespace);
      s.readString(';');
      s.skip(Whitespace);
      return AddExpression(s);
    });
    if (expr !== undefined) {
      expressions.push(expr);
    }
  } while (expr !== undefined);

  return {
    type: 'ListExpression',
    expressions: expressions
  };
}

function Expression(state) {
  return ListExpression(state);
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
  var name = Identifier(state), params;
  var openingFCall = state.try(function(s) {
    s.skip(Whitespace);
    return s.readString('(');
  });
  if (openingFCall !== undefined) {
    state.skip(Whitespace);
    params = ParameterList(state);
    state.skip(Whitespace);
    state.readString(')');
  }

  var returnType = state.try(function(s) {
    s.skip(Whitespace);
    s.readString(':');
    s.skip(Whitespace);
    return Identifier(s);
  });

  state.skip(Whitespace);
  state.readString('=');
  state.skip(Whitespace);
  state.readString('{');
  state.skip(Whitespace);
  var body = Expression(state);
  state.skip(Whitespace);
  state.readString('}');

  debug('[%d] Declaration %j', state.idx, name);

  if (params === undefined) {
    return {
      type: 'ValueDeclaration',
      name: name,
      body: body,
      returnType: returnType
    };
  } else {
    return {
      type: 'FunctionDeclaration',
      name: name,
      params: params,
      body: body,
      returnType: returnType
    };
  }
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
process.exit(runMain(parsed, process.argv));
