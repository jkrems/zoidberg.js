/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:evaluate');

var ZB = require('./ast');

function Bindable(name) {
  this.name = name;
  this.value = undefined;
}

Bindable.prototype.toString = function() {
  return 'Bindable(' + this.name + ' => ' + this.value + ')';
};

Bindable.prototype.prune = function() {
  if (this.value !== undefined) {
    return this.value;
  }
};

function pruneBindable(value) {
  while (value instanceof Bindable && value.value) {
    value = value.value;
  }
  return value;
}

function compareWithBindable(bindings, left, right) {
  left = pruneBindable(left);
  right = pruneBindable(right);
  debug('%j === %j', left, right);

  if (right instanceof Bindable) {
    right.value = left;
    debug('%s', right);
    return true;
  } else if (Array.isArray(left)) {
    if (!Array.isArray(right)) return false;

    return left.every(function(leftEl, idx) {
      var rightEl = right[idx];
      return compareWithBindable(bindings, leftEl, rightEl);
    });
  }
  return left === right;
}

function evaluate(program, bindings, node) {
  var results, left, right, name, resolved;

  switch (node.type) {
    case 'BinaryExpression':
      left = evaluate(program, bindings, node.left);
      right = evaluate(program, bindings, node.right);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '==': return compareWithBindable(bindings, left, right);
        case '!=': return left !== right;
        case '>=': return left >= right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '<': return left < right;
        default: throw new Error('Unknown binary operator: ' + node.operator);
      }
      break;

    case 'UnaryExpression':
      right = evaluate(program, bindings, node.right);
      switch (node.operator) {
        case '-': return -right;
        case '+': return +right;
        case '!': return !right;
        case '~': return ~right;
        default: throw new Error('Unknown unary operator: ' + node.operator);
      }
      break;

    case 'ListExpression':
      results = node.body.map(function(expr) {
        return evaluate(program, bindings, expr);
      });
      return results[results.length - 1];

    case 'ArrayExpression':
      results = node.items.map(function(expr) {
        return evaluate(program, bindings, expr);
      });
      return results;

    case 'LiteralExpression':
      return node.value;

    case 'IdentifierExpression':
      name = node.name;
      resolved = bindings[name];
      if (resolved === undefined) {
        // TODO: protect against cases where this isn't actually legal
        debug('Introduce bindable %s', name);
        resolved = bindings[name] = new Bindable(name);
      } else {
        resolved = pruneBindable(resolved);
      }
      return resolved;

    case 'MatchExpression':
      var targetValue = evaluate(program, bindings, node.target);
      var foundMatch = false;
      var matchEval = node.cases.reduce(function(result, curCase) {
        if (foundMatch) return result;
        var matchBindings = Object.create(bindings, {
          matchTarget$$: { value: targetValue }
        });
        matchBindings.track = 'foo';
        var matched = evaluate(program, matchBindings, curCase.condition);
        if (matched === true) {
          foundMatch = true;
          result = evaluate(program, matchBindings, curCase.body);
        }
        return result;
      }, null);
      if (!foundMatch) {
        throw new Error('No match for ' + targetValue + ' found! ' + JSON.stringify(node.cases));
      }
      return matchEval;

    case 'FCallExpression':
      var fn = evaluate(program, bindings, node.callee);
      var args = node.args.map(function(arg) {
        return evaluate(program, bindings, arg);
      });
      return runFunction(program, fn.scope || bindings, fn, args);

    case 'MemberAccessExpression':
      var base = evaluate(program, bindings, node.base);
      var baseProps = base && base.props;
      var property = _.find(baseProps, { name: node.field });
      if (!property) {
        throw new Error(
          util.format('Property not found: %s in', node.field, base));
      }

      // bindings['this'] = base;
      // TODO: use propBindings..?
      return property;

    default:
      // console.log(line);
      throw new Error(
        util.format('Unknown node type: %s\n%j', node && node.type, node));
  }
}

function runFunction(program, bindings, fn, args) {
  if (typeof fn === 'function') {
    return fn.apply(null, args);
  }
  var argBindings = fn.params.reduce(function(bound, param, idx) {
    bound[param] = args[idx];
    return bound;
  }, Object.create(bindings));

  return evaluate(program, argBindings, fn.body);
}

var builtIns = {
  printf: function() {
    console.log.apply(console, arguments);
  }
};

function createType(bindings, typeDecl) {
  var typeName = typeDecl.name;
  var body = typeDecl.body;
  var metaType = typeDecl.dataType;

  var typeObj = {
    dataType: metaType,
    props: []
  };

  switch (body.type) {
    case 'EnumExpression':
      _.each(body.constructors, function(ctor) {
        var propDescriptor = _.find(metaType.props, { name: ctor.name });
        var ctorType = propDescriptor.dataType;
        var returnType = ctorType.types[ctorType.types.length - 1];
        ctor.scope = bindings;
        ctor.body = new ZB.ArrayExpression(null, [
          new ZB.LiteralExpression(null, typeName + '.' + ctor.name, bindings.String)
        ].concat(ctor.params.map(function(param, idx) {
          return new ZB.IdentifierExpression(null, param, ctorType.types[idx]);
        })), returnType);

        typeObj.props.push(ctor);
      });
      break;
  }

  return typeObj;
}

function runMain(program, argv) {
  var bindings = program.body.reduce(function(bound, line) {
    switch (line.type) {
      case 'ValueDeclaration':
        var cached;
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
        line.scope = bound;
        bound[line.name] = line;
        break;

      case 'TypeDeclaration':
        line.scope = bound;
        bound[line.name] = createType(bound, line);
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

  var mainTypes = mainFn.dataType.types;
  var returnType = mainTypes[mainTypes.length - 1];
  var paramTypes = mainTypes.slice(0, -1);
  if (returnType.name !== 'Int') {
    throw new Error(
      util.format('main has to return an Int, returns %s', returnType));
  }

  var parsedArgs = args.map(function(arg, idx) {
    var paramType = paramTypes[idx];

    switch (paramType.name) {
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
