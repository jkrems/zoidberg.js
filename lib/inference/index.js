/* jshint node:true */
'use strict';

var util = require('util');

var _ = require('lodash');
var debug = require('debug')('zoidberg:inference');

var TypeSystem = require('../types');
var ZB = require('../ast');

var SymbolTable = require('./symbol-table');

function slice(arr, start, end) {
  if (!arr) return undefined;

  if (end < 0) { end = arr.length + end; }
  return arr.slice(start, end);
}

function getParamTypes(functionType) {
  return slice(functionType && functionType.types, 0, -1);
}

function getReturnType(functionType) {
  if (!functionType || !functionType.types) return undefined;
  return functionType.types[functionType.types.length - 1];
}

function parseSourceIdentifier(source) {
  var lastSegment = source
    .split('/').pop()
    .split('.').shift();
  return lastSegment;
}

function Analyzer(Types) {
  var analyzeVisitors = {
    ValueDeclaration: function(node, env, nonGeneric) {
      var bodyType = analyze(node.body, env, nonGeneric);
      var nodeType = node.dataType;
      if (nodeType) {
        Types.unify(bodyType, nodeType);
      }

      return env.addWithType(node.name, bodyType);
    },

    Identifier: function(node, env) {
      var idType = node.dataType || new Types.TypeVariable();
      return env.addWithType(node.name, idType);
    },

    ImportDeclaration: function(node, env, nonGeneric) {
      var source = node.source;
      // TODO: try to load description of source
      var sourceType = new Types.TypeVariable();

      if (node.extraction === null) {
        node.extraction = new ZB.Identifier(node.loc,
          parseSourceIdentifier(source), new Types.TypeVariable());
      }

      var extraction = node.extraction;
      var extractionType = analyze(extraction, env, nonGeneric);
      Types.unify(extractionType, sourceType);
      return extractionType;
    },

    FunctionDeclaration: function(node, env, nonGeneric) {
      var bodyEnv = env.clone();
      bodyEnv.addWithType(node.name, node.dataType);

      var paramTypes = _.map(getParamTypes(node.dataType),
        function(paramType, idx) {
          var name = node.params[idx];
          paramType = env.resolveTypeRef(paramType);
          if (paramType === undefined) {
            paramType = new Types.TypeVariable();
          }
          return bodyEnv.addWithType(name, paramType);
        });
      var returnType = env.resolveTypeRef(
        node.dataType && getReturnType(node.dataType));

      // Examples for functions without body: ADT constructors
      var bodyType;
      if (node.body) {
        bodyType = analyze(node.body, bodyEnv, nonGeneric);

        if (returnType) {
          Types.unify(bodyType, returnType);
        }
      } else {
        bodyType = returnType;
      }

      var fnBaseType =
        (Types.isCallable(node.dataType) &&
        !Types.isPlainFunction(node.dataType)) ?
          node.dataType : Types.FunctionType;

      var fnType = fnBaseType.withTypes(paramTypes.concat([bodyType]));

      return env.addWithType(node.name, fnType);
    },

    EnumExpression: function(node, env, nonGeneric) {
      var dataType = node.dataType;
      var metaType = dataType.dataType;
      _.each(node.constructors, function(ctor) {
        var ctorType;
        if (ctor.type === 'FunctionDeclaration') {
          ctorType = analyze(ctor, env, nonGeneric);
          ctorType.types[ctorType.types.length - 1] = dataType;
        } else {
          // TypeDeclaration (for param-less constructors)
          ctorType = dataType;
        }
        ctor.dataType = Types.EnumConstructorType.withTypes(
          Types.safeCopy(ctorType).types);
        debug('%s has constructor %s: %s', dataType, ctor.name, ctor.dataType);
        metaType.props.push(ctor);
      });

      return dataType;
    },

    TypeDeclaration: function(node, env, nonGeneric) {
      var bodyEnv = env.clone();
      var params = node.params.map(function(param) {
        if (param.dataType !== undefined) {
          throw new Error('Typed type params are not supported (yet?)');
        }
        return bodyEnv.set(param.name, new Types.TypeVariable());
      });

      var metaType = new Types.ParametricType(
        node.name + '%Meta',
        false,
        [], // params
        [], // props
        [], // state
        null);

      var self = new Types.ParametricType(
        node.name, // name
        false, // primitive
        params, // params/BaseType.types
        [], // props/public
        [], // state/private
        metaType); // dataType

      env.set(node.name, self);
      bodyEnv.set(node.name, self);
      node.body.dataType = self;
      analyze(node.body, bodyEnv, nonGeneric);

      return self.dataType;
    },

    LiteralExpression: function(node) {
      // todo: take context into account for qualified types/more complex types
      return node.dataType;
    },

    IdentifierExpression: function(node, env) {
      var dataType = env.getType(node.name);
      if (dataType === undefined) {
        throw new Error('Undeclared identifier: ' + node.name);
      }
      return dataType;
    },

    FCallExpression: function(node, env, nonGeneric) {
      var calleeType;
      if (node.callee.name === 'printf') {
        // TMP TMP TMP
        calleeType = new Types.TypeVariable();
      } else {
        calleeType = Types.safeCopy(analyze(node.callee, env, nonGeneric));
      }

      if (!Types.isCallable(calleeType)) {
        var calleeName = node.callee.name || '<unknown>';
        throw new Error(
          util.format(
            'Tried to call non-function %s: %s', calleeName, calleeType));
      }

      var argTypes = node.args.map(function(arg) {
        return analyze(arg, env, nonGeneric);
      });

      var callBaseType = !Types.isPlainFunction(calleeType) ?
          calleeType : Types.FunctionType;
      var callType = callBaseType.withTypes(
        argTypes.concat([new Types.TypeVariable()]));

      debug('Unify call %s of function with type %s', callType, calleeType);
      Types.unify(calleeType, callType);
      debug('Unified: %s', calleeType);

      return getReturnType(callType);
    },

    ListExpression: function(node, env, nonGeneric) {
      var expressionTypes = node.body.map(function(expr) {
        return analyze(expr, env, nonGeneric);
      });
      return expressionTypes[expressionTypes.length - 1];
    },

    BindingPattern: function(node, env, nonGeneric) {
      // Only allowed: values, ctors
      var seenIds = [];
      function visitBindingNode(bnode, env, nonGeneric) {
        switch (bnode.type) {
          case 'FCallExpression':
            var calleeType =
              Types.safeCopy(analyze(bnode.callee, env, nonGeneric));

            if (!Types.isConstructor(calleeType)) {
              throw new Error('Only constructors allowed for binding patterns');
            }

            var calledType = calleeType.withTypes(
              _.map(bnode.args, function(arg) {
                return visitBindingNode(arg, env, nonGeneric);
              }).concat([
                new Types.TypeVariable()
              ]));
            Types.unify(calleeType, calledType);
            return getReturnType(calleeType);

          case 'IdentifierExpression':
            var boundIdType;

            if (seenIds.indexOf(bnode.name) !== -1) {
              boundIdType = env.getType(bnode.name);
            } else {
              boundIdType = new Types.TypeVariable();
              env.addWithType(bnode.name, boundIdType);
              seenIds.push(bnode.name);
            }
            bnode.dataType = boundIdType;
            return boundIdType;

          case 'LiteralExpression':
            return analyze(bnode, env, nonGeneric);

          default:
            throw new Error('Unexpect ' + bnode.type + ' in match binding');
        }
      }

      return visitBindingNode(node.bindings, env, nonGeneric);
    },

    CatchAllPattern: function() {
      return new Types.TypeVariable();
    },

    MatchExpression: function(node, env, nonGeneric) {
      var target = node.target, targetType;
      if (target) {
        targetType = analyze(target, env, nonGeneric);
      } else {
        targetType = env.get('Bool');
      }
      debug('Target/condition type: %s', targetType);

      var resultType = node.cases.reduce(function(knownType, caseClause) {
        var casesymbolToType = env.clone();
        casesymbolToType.addWithType('matchTarget$$', targetType);

        var conditionType =
          analyze(caseClause.condition, casesymbolToType, nonGeneric);
        Types.unify(conditionType, targetType);

        var caseType = analyze(caseClause.body, casesymbolToType, nonGeneric);
        if (knownType) {
          Types.unify(knownType, caseType);
          return knownType;
        } else {
          return caseType;
        }
      }, node.dataType);

      return resultType;
    },

    BinaryExpression: function(node, env, nonGeneric) {
      var leftType = analyze(node.left, env, nonGeneric);
      var rightType = analyze(node.right, env, nonGeneric);
      var resultType = new Types.TypeVariable();

      leftType = Types.prune(leftType);
      if (leftType instanceof Types.TypeVariable) {
        leftType.props.push({
          name: node.operator,
          dataType: Types.FunctionType.withTypes([
            leftType, rightType, resultType ])
        });
        return resultType;
      }

      var impl = _.find(leftType.props, { name: node.operator });
      if (!impl) {
        throw new Error(util.format('Operator `%s` not supported by %s',
            node.operator, leftType));
      }

      var operatorType = Types.safeCopy(impl.dataType);
      var appliedType = Types.FunctionType.withTypes([
        leftType, rightType, resultType ]);

      Types.unify(operatorType, appliedType);

      return getReturnType(operatorType);
    },

    MemberAccessExpression: function(node, env, nonGeneric) {
      var baseType = analyze(node.base, env, nonGeneric);

      var member = _.find(baseType.props, { name: node.field });

      if (!member) {
        if (baseType instanceof Types.TypeVariable) {
          member = { name: node.field, dataType: new Types.TypeVariable() };
          baseType.props.push(member);
        } else {
          throw new Error(util.format('%s has no property %s',
            baseType, node.field));
        }
      }
      return member.dataType;
    },

    ArrayExpression: function(node, env, nonGeneric) {
      var itemsType = _.reduce(node.items, function(currentGuess, item) {
        var itemType = analyze(item, env, nonGeneric);
        Types.unify(currentGuess, itemType);
        return currentGuess;
      }, new Types.TypeVariable());

      return Types.ArrayType.withTypes([itemsType]);
    }
  };

  function analyze(node, env, nonGeneric) {
    nonGeneric = nonGeneric || [];

    // try to resolve type references first
    node.dataType = env.resolveTypeRef(node.dataType);

    var nodeType;
    try {
      nodeType = node.visit(analyzeVisitors, env, nonGeneric);
    } catch (err) {
      debug('analyze throws %j', err.message, node);
      throw err;
    }
    nodeType = Types.prune(nodeType);

    debug('analyze %s: %s -> %s', node.type, node.dataType, nodeType);
    node.dataType = nodeType;
    return nodeType;
  }

  return analyze;
}

// Run algorithm W on a program/module
function infer(program, typeSystem) {
  typeSystem = typeSystem || TypeSystem();

  // Replace `undefined`, `null`, etc. by type variables
  function undefinedToVariable(type) {
    if (!type) {
      return new typeSystem.TypeVariable();
    } else if (type.types) {
      type.types = _.map(type.types, undefinedToVariable);
    }
    return type;
  }
  ZB.traverseDF(program, function(node) {
    node.dataType = undefinedToVariable(node.dataType);
  });

  var env = new SymbolTable(
    typeSystem.getBuiltIns(), typeSystem.generateVariable);

  _.each(program.body, function(line) {
    Analyzer(typeSystem)(line, env);
  });

  // Resolve temporary type variables
  ZB.traverseDF(program, function(node) {
    if (node.dataType) {
      node.dataType = typeSystem.prune(node.dataType);
    }
  });

  return program;
}
module.exports = _.extend(infer);
