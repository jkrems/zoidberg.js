/* jshint node:true */
'use strict';

var debug = require('debug')('zoidberg:evaluate');

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

    case 'ListExpression':
      var results = node.expressions.map(function(expr) {
        return evaluate(program, bindings, expr);
      });
      return results[results.length - 1];

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
  if (typeof fn === 'function') {
    return fn.apply(null, args);
  }
  var argBindings = fn.params.reduce(function(bound, param, idx) {
    bound[param.name] = args[idx];
    return bound;
  }, Object.create(bindings));

  return evaluate(program, argBindings, fn.body);
}

var builtIns = {
  printf: function() {
    console.log.apply(console, arguments);
  }
};

function runMain(program, argv) {
  var bindings = program.lines.reduce(function(bound, line) {
    switch (line.type) {
      case 'ValueDeclaration':
        var cached = undefined;
        var wasCached = false;
        Object.defineProperty(bound, line.name, {
          get: function() {
            if (!wasCached) {
              cached = evaluate(program, bindings, line.body);
              wasCached = true;
            }
            return cached;
          }
        });
        break;

      case 'FunctionDeclaration':
        bound[line.name] = line;
        break;

      default:
        throw new Error('Unknown declaration type: ' + line.type);
    }
    return bound;
  }, Object.create(builtIns));
  var mainFn = bindings.main;

  var args = (argv || process.argv).slice(2);
  var params = mainFn.params;

  if (args.length !== params.length) {
    throw new Error('Expected ' + params.length + ' arguments');
  }

  if (mainFn.returnType !== 'ExitCode') {
    throw new Error('main has to return an ExitCode, returns ' + mainFn.returnType);
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
  return result;
}

exports.runMain = runMain;
exports.evaluate = evaluate;
