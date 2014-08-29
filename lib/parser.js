/* jshint node:true */
'use strict';

var debug = require('debug')('zoidberg:parser');

var ParserState = require('./parser-state');
var ZB = require('./ast');
var Types = require('./types');

var WHITESPACE = /^([^\S]+|#[^\n]*\n)+/;
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
    dataType: Types.String
  };
}

var INTEGER_LITERAL = /^([1-9][0-9]*|0)/;
function IntegerLiteral(state) {
  var int = state.readPattern(INTEGER_LITERAL);
  return {
    value: parseInt(int[1], 10),
    dataType: Types.Int
  };
}

var BOOLEAN_LITERAL = /^(true|false)/;
function BooleanLiteral(state) {
  var b = state.readPattern(BOOLEAN_LITERAL);
  return {
    value: b[1] === 'true',
    dataType: Types.Bool
  };
}

function Literal(state) {
  return state.or(StringLiteral, BooleanLiteral, IntegerLiteral);
}

function LiteralExpression(state) {
  var getLocation = state.trackNodeLocation();
  var value = Literal(state);
  var loc = getLocation();
  return new ZB.LiteralExpression(loc, value.value, value.dataType);
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

function MatchElseCondition(state) {
  debug('[%d] MatchElseCondition %j', state.idx, state.text.substr(state.idx, 10));
  var getLocation = state.trackNodeLocation();
  state.readString('else');
  state.skip(Whitespace);
  state.readString(':');
  var loc = getLocation();
  return new ZB.LiteralExpression(loc, true, Types.Bool);
}

function MatchValueCondition(state) {
  debug('MatchValueCondition');
  var value = UnaryExpression(state);
  state.skip(Whitespace);
  state.readString(':');
  return {
    type: 'CompareExpression',
    left: {
      type: 'IdentifierExpression',
      name: 'matchTarget$$'
    },
    right: value,
    operator: '=='
  };
}

function MatchCondition(state) {
  return state.or(MatchElseCondition, MatchValueCondition);
}

function MatchCase(state) {
  var condition = MatchCondition(state);
  state.skip(Whitespace);
  var body = ExpressionBlock(state);

  return {
    type: 'MatchCase',
    condition: condition,
    body: body
  };
}

function MatchCases(state) {
  var cases = [ MatchCase(state) ];

  do {
    var matchCase = state.try(function(s) {
      s.skip(Whitespace);
      return MatchCase(s);
    });
    if (matchCase !== undefined) {
      cases.push(matchCase);
    }
  } while (matchCase !== undefined);
  return cases;
}

function MatchExpression(state) {
  var matchKeyword = state.try(function(s) {
    return s.readString('match'); });
  debug('MatchExpression', matchKeyword);
  if (matchKeyword !== undefined) {
    // match expression!
    state.skip(Whitespace);
    var target = FCallExpression(state);
    state.skip(Whitespace);
    debug('<MatchExpression>');
    state.readString('{');
    state.skip(Whitespace);
    var cases = MatchCases(state);
    state.skip(Whitespace);
    debug('</MatchExpression>');
    state.readString('}');

    return {
      type: 'MatchExpression',
      target: target,
      cases: cases
    };
  } else {
    return AddExpression(state);
  }
}

// Match expression || list expression in 
function ExpressionBlock(state) {
  debug('<ExpressionBlock>');
  var opening = state.try(function(s) {
    s.readString('{');
    s.skip(Whitespace);
    return true;
  });
  var body;
  if (opening !== undefined) {
    body = ListExpression(state);
    state.skip(Whitespace);
    state.readString('}');
  } else {
    body = ListExpressionItem(state);
  }
  debug('</ExpressionBlock>');
  return body;
}

function ListExpressionItem(state) {
  return MatchExpression(state);
}

function ListExpression(state) {
  var first = ListExpressionItem(state);
  var expressions = [ first ];

  do {
    var expr = state.try(function(s) {
      s.skip(Whitespace);
      s.readString(';');
      s.skip(Whitespace);
      return ListExpressionItem(s);
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
  var getLocation = state.trackNodeLocation();
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
  var body = ExpressionBlock(state);
  var loc = getLocation();

  debug('[%d] Declaration %j', state.idx, name);

  if (params === undefined) {
    return new ZB.ValueDeclaration(loc, name, body, returnType);
  } else {
    return {
      type: 'FunctionDeclaration',
      name: name,
      params: params,
      body: body,
      dataType: [ params, returnType ]
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
  var getLocation = state.trackNodeLocation();
  var body = Declarations(state);
  var loc = getLocation();
  state.skip(Whitespace);
  state.eof();
  return new ZB.Program(loc, body);
}

function customParser(text) {
  var state = new ParserState(text);
  return Program(state);
}

var parser = { parse: customParser };

module.exports = parser;
