(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("pgnParser", [], factory);
	else if(typeof exports === 'object')
		exports["pgnParser"] = factory();
	else
		root["pgnParser"] = factory();
})(this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/pegjs/lib/compiler/asts.js":
/*!*************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/asts.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays  = __webpack_require__(/*! ../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    visitor = __webpack_require__(/*! ./visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/* AST utilities. */
var asts = {
  findRule: function(ast, name) {
    return arrays.find(ast.rules, function(r) { return r.name === name; });
  },

  indexOfRule: function(ast, name) {
    return arrays.indexOf(ast.rules, function(r) { return r.name === name; });
  },

  alwaysConsumesOnSuccess: function(ast, node) {
    function consumesTrue()  { return true;  }
    function consumesFalse() { return false; }

    function consumesExpression(node) {
      return consumes(node.expression);
    }

    var consumes = visitor.build({
      rule:  consumesExpression,
      named: consumesExpression,

      choice: function(node) {
        return arrays.every(node.alternatives, consumes);
      },

      action: consumesExpression,

      sequence: function(node) {
        return arrays.some(node.elements, consumes);
      },

      labeled:      consumesExpression,
      text:         consumesExpression,
      simple_and:   consumesFalse,
      simple_not:   consumesFalse,
      optional:     consumesFalse,
      zero_or_more: consumesFalse,
      one_or_more:  consumesExpression,
      group:        consumesExpression,
      semantic_and: consumesFalse,
      semantic_not: consumesFalse,

      rule_ref: function(node) {
        return consumes(asts.findRule(ast, node.name));
      },

      literal: function(node) {
        return node.value !== "";
      },

      "class": consumesTrue,
      any:     consumesTrue
    });

    return consumes(node);
  }
};

module.exports = asts;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/index.js":
/*!**************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/index.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays  = __webpack_require__(/*! ../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    objects = __webpack_require__(/*! ../utils/objects */ "./node_modules/pegjs/lib/utils/objects.js");

var compiler = {
  /*
   * AST node visitor builder. Useful mainly for plugins which manipulate the
   * AST.
   */
  visitor: __webpack_require__(/*! ./visitor */ "./node_modules/pegjs/lib/compiler/visitor.js"),

  /*
   * Compiler passes.
   *
   * Each pass is a function that is passed the AST. It can perform checks on it
   * or modify it as needed. If the pass encounters a semantic error, it throws
   * |peg.GrammarError|.
   */
  passes: {
    check: {
      reportUndefinedRules:     __webpack_require__(/*! ./passes/report-undefined-rules */ "./node_modules/pegjs/lib/compiler/passes/report-undefined-rules.js"),
      reportDuplicateRules:     __webpack_require__(/*! ./passes/report-duplicate-rules */ "./node_modules/pegjs/lib/compiler/passes/report-duplicate-rules.js"),
      reportDuplicateLabels:    __webpack_require__(/*! ./passes/report-duplicate-labels */ "./node_modules/pegjs/lib/compiler/passes/report-duplicate-labels.js"),
      reportInfiniteRecursion:  __webpack_require__(/*! ./passes/report-infinite-recursion */ "./node_modules/pegjs/lib/compiler/passes/report-infinite-recursion.js"),
      reportInfiniteRepetition: __webpack_require__(/*! ./passes/report-infinite-repetition */ "./node_modules/pegjs/lib/compiler/passes/report-infinite-repetition.js")
    },
    transform: {
      removeProxyRules:         __webpack_require__(/*! ./passes/remove-proxy-rules */ "./node_modules/pegjs/lib/compiler/passes/remove-proxy-rules.js")
    },
    generate: {
      generateBytecode:         __webpack_require__(/*! ./passes/generate-bytecode */ "./node_modules/pegjs/lib/compiler/passes/generate-bytecode.js"),
      generateJS:               __webpack_require__(/*! ./passes/generate-js */ "./node_modules/pegjs/lib/compiler/passes/generate-js.js")
    }
  },

  /*
   * Generates a parser from a specified grammar AST. Throws |peg.GrammarError|
   * if the AST contains a semantic error. Note that not all errors are detected
   * during the generation and some may protrude to the generated parser and
   * cause its malfunction.
   */
  compile: function(ast, passes, options) {
    options = options !== void 0 ? options : {};

    var stage;

    options = objects.clone(options);
    objects.defaults(options, {
      allowedStartRules: [ast.rules[0].name],
      cache:             false,
      dependencies:      {},
      exportVar:         null,
      format:            "bare",
      optimize:          "speed",
      output:            "parser",
      trace:             false
    });

    for (stage in passes) {
      if (passes.hasOwnProperty(stage)) {
        arrays.each(passes[stage], function(p) { p(ast, options); });
      }
    }

    switch (options.output) {
      case "parser": return eval(ast.code);
      case "source": return ast.code;
    }
  }
};

module.exports = compiler;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/js.js":
/*!***********************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/js.js ***!
  \***********************************************/
/***/ ((module) => {

"use strict";


function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

/* JavaScript code generation helpers. */
var js = {
  stringEscape: function(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
     * literal except for the closing quote character, backslash, carriage
     * return, line separator, paragraph separator, and line feed. Any character
     * may appear in the form of an escape sequence.
     *
     * For portability, we also escape all control and non-ASCII characters.
     * Note that the "\v" escape sequence is not used because IE does not like
     * it.
     */
    return s
      .replace(/\\/g,   '\\\\')   // backslash
      .replace(/"/g,    '\\"')    // closing double quote
      .replace(/\0/g,   '\\0')    // null
      .replace(/\x08/g, '\\b')    // backspace
      .replace(/\t/g,   '\\t')    // horizontal tab
      .replace(/\n/g,   '\\n')    // line feed
      .replace(/\f/g,   '\\f')    // form feed
      .replace(/\r/g,   '\\r')    // carriage return
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\xFF]/g, function(ch) { return '\\x'  + hex(ch); })
      .replace(/[\u0100-\u0FFF]/g,      function(ch) { return '\\u0' + hex(ch); })
      .replace(/[\u1000-\uFFFF]/g,      function(ch) { return '\\u'  + hex(ch); });
  },

  regexpClassEscape: function(s) {
    /*
     * Based on ECMA-262, 5th ed., 7.8.5 & 15.10.1.
     *
     * For portability, we also escape all control and non-ASCII characters.
     */
    return s
      .replace(/\\/g, '\\\\')    // backslash
      .replace(/\//g, '\\/')     // closing slash
      .replace(/\]/g, '\\]')     // closing bracket
      .replace(/\^/g, '\\^')     // caret
      .replace(/-/g,  '\\-')     // dash
      .replace(/\0/g, '\\0')     // null
      .replace(/\t/g, '\\t')     // horizontal tab
      .replace(/\n/g, '\\n')     // line feed
      .replace(/\v/g, '\\x0B')   // vertical tab
      .replace(/\f/g, '\\f')     // form feed
      .replace(/\r/g, '\\r')     // carriage return
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\xFF]/g, function(ch) { return '\\x'  + hex(ch); })
      .replace(/[\u0100-\u0FFF]/g,      function(ch) { return '\\u0' + hex(ch); })
      .replace(/[\u1000-\uFFFF]/g,      function(ch) { return '\\u'  + hex(ch); });
  }
};

module.exports = js;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/opcodes.js":
/*!****************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/opcodes.js ***!
  \****************************************************/
/***/ ((module) => {

"use strict";


/* Bytecode instruction opcodes. */
var opcodes = {
  /* Stack Manipulation */

  PUSH:             0,    // PUSH c
  PUSH_UNDEFINED:   1,    // PUSH_UNDEFINED
  PUSH_NULL:        2,    // PUSH_NULL
  PUSH_FAILED:      3,    // PUSH_FAILED
  PUSH_EMPTY_ARRAY: 4,    // PUSH_EMPTY_ARRAY
  PUSH_CURR_POS:    5,    // PUSH_CURR_POS
  POP:              6,    // POP
  POP_CURR_POS:     7,    // POP_CURR_POS
  POP_N:            8,    // POP_N n
  NIP:              9,    // NIP
  APPEND:           10,   // APPEND
  WRAP:             11,   // WRAP n
  TEXT:             12,   // TEXT

  /* Conditions and Loops */

  IF:               13,   // IF t, f
  IF_ERROR:         14,   // IF_ERROR t, f
  IF_NOT_ERROR:     15,   // IF_NOT_ERROR t, f
  WHILE_NOT_ERROR:  16,   // WHILE_NOT_ERROR b

  /* Matching */

  MATCH_ANY:        17,   // MATCH_ANY a, f, ...
  MATCH_STRING:     18,   // MATCH_STRING s, a, f, ...
  MATCH_STRING_IC:  19,   // MATCH_STRING_IC s, a, f, ...
  MATCH_REGEXP:     20,   // MATCH_REGEXP r, a, f, ...
  ACCEPT_N:         21,   // ACCEPT_N n
  ACCEPT_STRING:    22,   // ACCEPT_STRING s
  FAIL:             23,   // FAIL e

  /* Calls */

  LOAD_SAVED_POS:   24,   // LOAD_SAVED_POS p
  UPDATE_SAVED_POS: 25,   // UPDATE_SAVED_POS
  CALL:             26,   // CALL f, n, pc, p1, p2, ..., pN

  /* Rules */

  RULE:             27,   // RULE r

  /* Failure Reporting */

  SILENT_FAILS_ON:  28,   // SILENT_FAILS_ON
  SILENT_FAILS_OFF: 29    // SILENT_FAILS_OFF
};

module.exports = opcodes;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/generate-bytecode.js":
/*!*********************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/generate-bytecode.js ***!
  \*********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays  = __webpack_require__(/*! ../../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    objects = __webpack_require__(/*! ../../utils/objects */ "./node_modules/pegjs/lib/utils/objects.js"),
    asts    = __webpack_require__(/*! ../asts */ "./node_modules/pegjs/lib/compiler/asts.js"),
    visitor = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js"),
    op      = __webpack_require__(/*! ../opcodes */ "./node_modules/pegjs/lib/compiler/opcodes.js"),
    js      = __webpack_require__(/*! ../js */ "./node_modules/pegjs/lib/compiler/js.js");

/* Generates bytecode.
 *
 * Instructions
 * ============
 *
 * Stack Manipulation
 * ------------------
 *
 *  [0] PUSH c
 *
 *        stack.push(consts[c]);
 *
 *  [1] PUSH_UNDEFINED
 *
 *        stack.push(undefined);
 *
 *  [2] PUSH_NULL
 *
 *        stack.push(null);
 *
 *  [3] PUSH_FAILED
 *
 *        stack.push(FAILED);
 *
 *  [4] PUSH_EMPTY_ARRAY
 *
 *        stack.push([]);
 *
 *  [5] PUSH_CURR_POS
 *
 *        stack.push(currPos);
 *
 *  [6] POP
 *
 *        stack.pop();
 *
 *  [7] POP_CURR_POS
 *
 *        currPos = stack.pop();
 *
 *  [8] POP_N n
 *
 *        stack.pop(n);
 *
 *  [9] NIP
 *
 *        value = stack.pop();
 *        stack.pop();
 *        stack.push(value);
 *
 * [10] APPEND
 *
 *        value = stack.pop();
 *        array = stack.pop();
 *        array.push(value);
 *        stack.push(array);
 *
 * [11] WRAP n
 *
 *        stack.push(stack.pop(n));
 *
 * [12] TEXT
 *
 *        stack.push(input.substring(stack.pop(), currPos));
 *
 * Conditions and Loops
 * --------------------
 *
 * [13] IF t, f
 *
 *        if (stack.top()) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [14] IF_ERROR t, f
 *
 *        if (stack.top() === FAILED) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [15] IF_NOT_ERROR t, f
 *
 *        if (stack.top() !== FAILED) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [16] WHILE_NOT_ERROR b
 *
 *        while(stack.top() !== FAILED) {
 *          interpret(ip + 2, ip + 2 + b);
 *        }
 *
 * Matching
 * --------
 *
 * [17] MATCH_ANY a, f, ...
 *
 *        if (input.length > currPos) {
 *          interpret(ip + 3, ip + 3 + a);
 *        } else {
 *          interpret(ip + 3 + a, ip + 3 + a + f);
 *        }
 *
 * [18] MATCH_STRING s, a, f, ...
 *
 *        if (input.substr(currPos, consts[s].length) === consts[s]) {
 *          interpret(ip + 4, ip + 4 + a);
 *        } else {
 *          interpret(ip + 4 + a, ip + 4 + a + f);
 *        }
 *
 * [19] MATCH_STRING_IC s, a, f, ...
 *
 *        if (input.substr(currPos, consts[s].length).toLowerCase() === consts[s]) {
 *          interpret(ip + 4, ip + 4 + a);
 *        } else {
 *          interpret(ip + 4 + a, ip + 4 + a + f);
 *        }
 *
 * [20] MATCH_REGEXP r, a, f, ...
 *
 *        if (consts[r].test(input.charAt(currPos))) {
 *          interpret(ip + 4, ip + 4 + a);
 *        } else {
 *          interpret(ip + 4 + a, ip + 4 + a + f);
 *        }
 *
 * [21] ACCEPT_N n
 *
 *        stack.push(input.substring(currPos, n));
 *        currPos += n;
 *
 * [22] ACCEPT_STRING s
 *
 *        stack.push(consts[s]);
 *        currPos += consts[s].length;
 *
 * [23] FAIL e
 *
 *        stack.push(FAILED);
 *        fail(consts[e]);
 *
 * Calls
 * -----
 *
 * [24] LOAD_SAVED_POS p
 *
 *        savedPos = stack[p];
 *
 * [25] UPDATE_SAVED_POS
 *
 *        savedPos = currPos;
 *
 * [26] CALL f, n, pc, p1, p2, ..., pN
 *
 *        value = consts[f](stack[p1], ..., stack[pN]);
 *        stack.pop(n);
 *        stack.push(value);
 *
 * Rules
 * -----
 *
 * [27] RULE r
 *
 *        stack.push(parseRule(r));
 *
 * Failure Reporting
 * -----------------
 *
 * [28] SILENT_FAILS_ON
 *
 *        silentFails++;
 *
 * [29] SILENT_FAILS_OFF
 *
 *        silentFails--;
 */
function generateBytecode(ast) {
  var consts = [];

  function addConst(value) {
    var index = arrays.indexOf(consts, value);

    return index === -1 ? consts.push(value) - 1 : index;
  }

  function addFunctionConst(params, code) {
    return addConst(
      "function(" + params.join(", ") + ") {" + code + "}"
    );
  }

  function buildSequence() {
    return Array.prototype.concat.apply([], arguments);
  }

  function buildCondition(condCode, thenCode, elseCode) {
    return condCode.concat(
      [thenCode.length, elseCode.length],
      thenCode,
      elseCode
    );
  }

  function buildLoop(condCode, bodyCode) {
    return condCode.concat([bodyCode.length], bodyCode);
  }

  function buildCall(functionIndex, delta, env, sp) {
    var params = arrays.map(objects.values(env), function(p) { return sp - p; });

    return [op.CALL, functionIndex, delta, params.length].concat(params);
  }

  function buildSimplePredicate(expression, negative, context) {
    return buildSequence(
      [op.PUSH_CURR_POS],
      [op.SILENT_FAILS_ON],
      generate(expression, {
        sp:     context.sp + 1,
        env:    objects.clone(context.env),
        action: null
      }),
      [op.SILENT_FAILS_OFF],
      buildCondition(
        [negative ? op.IF_ERROR : op.IF_NOT_ERROR],
        buildSequence(
          [op.POP],
          [negative ? op.POP : op.POP_CURR_POS],
          [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          [negative ? op.POP_CURR_POS : op.POP],
          [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildSemanticPredicate(code, negative, context) {
    var functionIndex = addFunctionConst(objects.keys(context.env), code);

    return buildSequence(
      [op.UPDATE_SAVED_POS],
      buildCall(functionIndex, 0, context.env, context.sp),
      buildCondition(
        [op.IF],
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_FAILED] : [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_UNDEFINED] : [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildAppendLoop(expressionCode) {
    return buildLoop(
      [op.WHILE_NOT_ERROR],
      buildSequence([op.APPEND], expressionCode)
    );
  }

  var generate = visitor.build({
    grammar: function(node) {
      arrays.each(node.rules, generate);

      node.consts = consts;
    },

    rule: function(node) {
      node.bytecode = generate(node.expression, {
        sp:     -1,    // stack pointer
        env:    { },   // mapping of label names to stack positions
        action: null   // action nodes pass themselves to children here
      });
    },

    named: function(node, context) {
      var nameIndex = addConst(
        'peg$otherExpectation("' + js.stringEscape(node.name) + '")'
      );

      /*
       * The code generated below is slightly suboptimal because |FAIL| pushes
       * to the stack, so we need to stick a |POP| in front of it. We lack a
       * dedicated instruction that would just report the failure and not touch
       * the stack.
       */
      return buildSequence(
        [op.SILENT_FAILS_ON],
        generate(node.expression, context),
        [op.SILENT_FAILS_OFF],
        buildCondition([op.IF_ERROR], [op.FAIL, nameIndex], [])
      );
    },

    choice: function(node, context) {
      function buildAlternativesCode(alternatives, context) {
        return buildSequence(
          generate(alternatives[0], {
            sp:     context.sp,
            env:    objects.clone(context.env),
            action: null
          }),
          alternatives.length > 1
            ? buildCondition(
                [op.IF_ERROR],
                buildSequence(
                  [op.POP],
                  buildAlternativesCode(alternatives.slice(1), context)
                ),
                []
              )
            : []
        );
      }

      return buildAlternativesCode(node.alternatives, context);
    },

    action: function(node, context) {
      var env            = objects.clone(context.env),
          emitCall       = node.expression.type !== "sequence"
                        || node.expression.elements.length === 0,
          expressionCode = generate(node.expression, {
            sp:     context.sp + (emitCall ? 1 : 0),
            env:    env,
            action: node
          }),
          functionIndex  = addFunctionConst(objects.keys(env), node.code);

      return emitCall
        ? buildSequence(
            [op.PUSH_CURR_POS],
            expressionCode,
            buildCondition(
              [op.IF_NOT_ERROR],
              buildSequence(
                [op.LOAD_SAVED_POS, 1],
                buildCall(functionIndex, 1, env, context.sp + 2)
              ),
              []
            ),
            [op.NIP]
          )
        : expressionCode;
    },

    sequence: function(node, context) {
      function buildElementsCode(elements, context) {
        var processedCount, functionIndex;

        if (elements.length > 0) {
          processedCount = node.elements.length - elements.slice(1).length;

          return buildSequence(
            generate(elements[0], {
              sp:     context.sp,
              env:    context.env,
              action: null
            }),
            buildCondition(
              [op.IF_NOT_ERROR],
              buildElementsCode(elements.slice(1), {
                sp:     context.sp + 1,
                env:    context.env,
                action: context.action
              }),
              buildSequence(
                processedCount > 1 ? [op.POP_N, processedCount] : [op.POP],
                [op.POP_CURR_POS],
                [op.PUSH_FAILED]
              )
            )
          );
        } else {
          if (context.action) {
            functionIndex = addFunctionConst(
              objects.keys(context.env),
              context.action.code
            );

            return buildSequence(
              [op.LOAD_SAVED_POS, node.elements.length],
              buildCall(
                functionIndex,
                node.elements.length,
                context.env,
                context.sp
              ),
              [op.NIP]
            );
          } else {
            return buildSequence([op.WRAP, node.elements.length], [op.NIP]);
          }
        }
      }

      return buildSequence(
        [op.PUSH_CURR_POS],
        buildElementsCode(node.elements, {
          sp:     context.sp + 1,
          env:    context.env,
          action: context.action
        })
      );
    },

    labeled: function(node, context) {
      var env = objects.clone(context.env);

      context.env[node.label] = context.sp + 1;

      return generate(node.expression, {
        sp:     context.sp,
        env:    env,
        action: null
      });
    },

    text: function(node, context) {
      return buildSequence(
        [op.PUSH_CURR_POS],
        generate(node.expression, {
          sp:     context.sp + 1,
          env:    objects.clone(context.env),
          action: null
        }),
        buildCondition(
          [op.IF_NOT_ERROR],
          buildSequence([op.POP], [op.TEXT]),
          [op.NIP]
        )
      );
    },

    simple_and: function(node, context) {
      return buildSimplePredicate(node.expression, false, context);
    },

    simple_not: function(node, context) {
      return buildSimplePredicate(node.expression, true, context);
    },

    optional: function(node, context) {
      return buildSequence(
        generate(node.expression, {
          sp:     context.sp,
          env:    objects.clone(context.env),
          action: null
        }),
        buildCondition(
          [op.IF_ERROR],
          buildSequence([op.POP], [op.PUSH_NULL]),
          []
        )
      );
    },

    zero_or_more: function(node, context) {
      var expressionCode = generate(node.expression, {
            sp:     context.sp + 1,
            env:    objects.clone(context.env),
            action: null
          });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildAppendLoop(expressionCode),
        [op.POP]
      );
    },

    one_or_more: function(node, context) {
      var expressionCode = generate(node.expression, {
            sp:     context.sp + 1,
            env:    objects.clone(context.env),
            action: null
          });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildCondition(
          [op.IF_NOT_ERROR],
          buildSequence(buildAppendLoop(expressionCode), [op.POP]),
          buildSequence([op.POP], [op.POP], [op.PUSH_FAILED])
        )
      );
    },

    group: function(node, context) {
      return generate(node.expression, {
        sp:     context.sp,
        env:    objects.clone(context.env),
        action: null
      });
    },

    semantic_and: function(node, context) {
      return buildSemanticPredicate(node.code, false, context);
    },

    semantic_not: function(node, context) {
      return buildSemanticPredicate(node.code, true, context);
    },

    rule_ref: function(node) {
      return [op.RULE, asts.indexOfRule(ast, node.name)];
    },

    literal: function(node) {
      var stringIndex, expectedIndex;

      if (node.value.length > 0) {
        stringIndex = addConst('"'
          + js.stringEscape(
              node.ignoreCase ? node.value.toLowerCase() : node.value
            )
          + '"'
        );
        expectedIndex = addConst(
          'peg$literalExpectation('
            + '"' + js.stringEscape(node.value) + '", '
            + node.ignoreCase
            + ')'
        );

        /*
         * For case-sensitive strings the value must match the beginning of the
         * remaining input exactly. As a result, we can use |ACCEPT_STRING| and
         * save one |substr| call that would be needed if we used |ACCEPT_N|.
         */
        return buildCondition(
          node.ignoreCase
            ? [op.MATCH_STRING_IC, stringIndex]
            : [op.MATCH_STRING, stringIndex],
          node.ignoreCase
            ? [op.ACCEPT_N, node.value.length]
            : [op.ACCEPT_STRING, stringIndex],
          [op.FAIL, expectedIndex]
        );
      } else {
        stringIndex = addConst('""');

        return [op.PUSH, stringIndex];
      }
    },

    "class": function(node) {
      var regexp, parts, regexpIndex, expectedIndex;

      if (node.parts.length > 0) {
        regexp = '/^['
          + (node.inverted ? '^' : '')
          + arrays.map(node.parts, function(part) {
              return part instanceof Array
                ? js.regexpClassEscape(part[0])
                  + '-'
                  + js.regexpClassEscape(part[1])
                : js.regexpClassEscape(part);
            }).join('')
          + ']/' + (node.ignoreCase ? 'i' : '');
      } else {
        /*
         * IE considers regexps /[]/ and /[^]/ as syntactically invalid, so we
         * translate them into equivalents it can handle.
         */
        regexp = node.inverted ? '/^[\\S\\s]/' : '/^(?!)/';
      }

      parts = '['
        + arrays.map(node.parts, function(part) {
            return part instanceof Array
              ? '["' + js.stringEscape(part[0]) + '", "' + js.stringEscape(part[1]) + '"]'
              : '"' + js.stringEscape(part) + '"';
          }).join(', ')
        + ']';

      regexpIndex   = addConst(regexp);
      expectedIndex = addConst(
        'peg$classExpectation('
          + parts + ', '
          + node.inverted + ', '
          + node.ignoreCase
          + ')'
      );

      return buildCondition(
        [op.MATCH_REGEXP, regexpIndex],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    },

    any: function() {
      var expectedIndex = addConst('peg$anyExpectation()');

      return buildCondition(
        [op.MATCH_ANY],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    }
  });

  generate(ast);
}

module.exports = generateBytecode;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/generate-js.js":
/*!***************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/generate-js.js ***!
  \***************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays  = __webpack_require__(/*! ../../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    objects = __webpack_require__(/*! ../../utils/objects */ "./node_modules/pegjs/lib/utils/objects.js"),
    asts    = __webpack_require__(/*! ../asts */ "./node_modules/pegjs/lib/compiler/asts.js"),
    op      = __webpack_require__(/*! ../opcodes */ "./node_modules/pegjs/lib/compiler/opcodes.js"),
    js      = __webpack_require__(/*! ../js */ "./node_modules/pegjs/lib/compiler/js.js");

/* Generates parser JavaScript code. */
function generateJS(ast, options) {
  /* These only indent non-empty lines to avoid trailing whitespace. */
  function indent2(code)  { return code.replace(/^(.+)$/gm, '  $1');         }
  function indent6(code)  { return code.replace(/^(.+)$/gm, '      $1');     }
  function indent10(code) { return code.replace(/^(.+)$/gm, '          $1'); }

  function generateTables() {
    if (options.optimize === "size") {
      return [
        'peg$consts = [',
           indent2(ast.consts.join(',\n')),
        '],',
        '',
        'peg$bytecode = [',
           indent2(arrays.map(ast.rules, function(rule) {
             return 'peg$decode("'
                   + js.stringEscape(arrays.map(
                       rule.bytecode,
                       function(b) { return String.fromCharCode(b + 32); }
                     ).join(''))
                   + '")';
           }).join(',\n')),
        '],'
      ].join('\n');
    } else {
      return arrays.map(
        ast.consts,
        function(c, i) { return 'peg$c' + i + ' = ' + c + ','; }
      ).join('\n');
    }
  }

  function generateRuleHeader(ruleNameCode, ruleIndexCode) {
    var parts = [];

    parts.push('');

    if (options.trace) {
      parts.push([
        'peg$tracer.trace({',
        '  type:     "rule.enter",',
        '  rule:     ' + ruleNameCode + ',',
        '  location: peg$computeLocation(startPos, startPos)',
        '});',
        ''
      ].join('\n'));
    }

    if (options.cache) {
      parts.push([
        'var key    = peg$currPos * ' + ast.rules.length + ' + ' + ruleIndexCode + ',',
        '    cached = peg$resultsCache[key];',
        '',
        'if (cached) {',
        '  peg$currPos = cached.nextPos;',
        ''
      ].join('\n'));

      if (options.trace) {
        parts.push([
          'if (cached.result !== peg$FAILED) {',
          '  peg$tracer.trace({',
          '    type:   "rule.match",',
          '    rule:   ' + ruleNameCode + ',',
          '    result: cached.result,',
          '    location: peg$computeLocation(startPos, peg$currPos)',
          '  });',
          '} else {',
          '  peg$tracer.trace({',
          '    type: "rule.fail",',
          '    rule: ' + ruleNameCode + ',',
          '    location: peg$computeLocation(startPos, startPos)',
          '  });',
          '}',
          ''
        ].join('\n'));
      }

      parts.push([
        '  return cached.result;',
        '}',
        ''
      ].join('\n'));
    }

    return parts.join('\n');
  }

  function generateRuleFooter(ruleNameCode, resultCode) {
    var parts = [];

    if (options.cache) {
      parts.push([
        '',
        'peg$resultsCache[key] = { nextPos: peg$currPos, result: ' + resultCode + ' };'
      ].join('\n'));
    }

    if (options.trace) {
      parts.push([
          '',
          'if (' + resultCode + ' !== peg$FAILED) {',
          '  peg$tracer.trace({',
          '    type:   "rule.match",',
          '    rule:   ' + ruleNameCode + ',',
          '    result: ' + resultCode + ',',
          '    location: peg$computeLocation(startPos, peg$currPos)',
          '  });',
          '} else {',
          '  peg$tracer.trace({',
          '    type: "rule.fail",',
          '    rule: ' + ruleNameCode + ',',
          '    location: peg$computeLocation(startPos, startPos)',
          '  });',
          '}'
      ].join('\n'));
    }

    parts.push([
      '',
      'return ' + resultCode + ';'
    ].join('\n'));

    return parts.join('\n');
  }

  function generateInterpreter() {
    var parts = [];

    function generateCondition(cond, argsLength) {
      var baseLength      = argsLength + 3,
          thenLengthCode = 'bc[ip + ' + (baseLength - 2) + ']',
          elseLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'ends.push(end);',
        'ips.push(ip + ' + baseLength + ' + ' + thenLengthCode + ' + ' + elseLengthCode + ');',
        '',
        'if (' + cond + ') {',
        '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ';',
        '  ip += ' + baseLength + ';',
        '} else {',
        '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ' + ' + elseLengthCode + ';',
        '  ip += ' + baseLength + ' + ' + thenLengthCode + ';',
        '}',
        '',
        'break;'
      ].join('\n');
    }

    function generateLoop(cond) {
      var baseLength     = 2,
          bodyLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'if (' + cond + ') {',
        '  ends.push(end);',
        '  ips.push(ip);',
        '',
        '  end = ip + ' + baseLength + ' + ' + bodyLengthCode + ';',
        '  ip += ' + baseLength + ';',
        '} else {',
        '  ip += ' + baseLength + ' + ' + bodyLengthCode + ';',
        '}',
        '',
        'break;'
      ].join('\n');
    }

    function generateCall() {
      var baseLength       = 4,
          paramsLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'params = bc.slice(ip + ' + baseLength + ', ip + ' + baseLength + ' + ' + paramsLengthCode + ');',
        'for (i = 0; i < ' + paramsLengthCode + '; i++) {',
        '  params[i] = stack[stack.length - 1 - params[i]];',
        '}',
        '',
        'stack.splice(',
        '  stack.length - bc[ip + 2],',
        '  bc[ip + 2],',
        '  peg$consts[bc[ip + 1]].apply(null, params)',
        ');',
        '',
        'ip += ' + baseLength + ' + ' + paramsLengthCode + ';',
        'break;'
      ].join('\n');
    }

    parts.push([
      'function peg$decode(s) {',
      '  var bc = new Array(s.length), i;',
      '',
      '  for (i = 0; i < s.length; i++) {',
      '    bc[i] = s.charCodeAt(i) - 32;',
      '  }',
      '',
      '  return bc;',
      '}',
      '',
      'function peg$parseRule(index) {'
    ].join('\n'));

    if (options.trace) {
      parts.push([
        '  var bc       = peg$bytecode[index],',
        '      ip       = 0,',
        '      ips      = [],',
        '      end      = bc.length,',
        '      ends     = [],',
        '      stack    = [],',
        '      startPos = peg$currPos,',
        '      params, i;'
      ].join('\n'));
    } else {
      parts.push([
        '  var bc    = peg$bytecode[index],',
        '      ip    = 0,',
        '      ips   = [],',
        '      end   = bc.length,',
        '      ends  = [],',
        '      stack = [],',
        '      params, i;'
      ].join('\n'));
    }

    parts.push(indent2(generateRuleHeader('peg$ruleNames[index]', 'index')));

    parts.push([
      /*
       * The point of the outer loop and the |ips| & |ends| stacks is to avoid
       * recursive calls for interpreting parts of bytecode. In other words, we
       * implement the |interpret| operation of the abstract machine without
       * function calls. Such calls would likely slow the parser down and more
       * importantly cause stack overflows for complex grammars.
       */
      '  while (true) {',
      '    while (ip < end) {',
      '      switch (bc[ip]) {',
      '        case ' + op.PUSH + ':',               // PUSH c
      '          stack.push(peg$consts[bc[ip + 1]]);',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.PUSH_UNDEFINED + ':',     // PUSH_UNDEFINED
      '          stack.push(void 0);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_NULL + ':',          // PUSH_NULL
      '          stack.push(null);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_FAILED + ':',        // PUSH_FAILED
      '          stack.push(peg$FAILED);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_EMPTY_ARRAY + ':',   // PUSH_EMPTY_ARRAY
      '          stack.push([]);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_CURR_POS + ':',      // PUSH_CURR_POS
      '          stack.push(peg$currPos);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.POP + ':',                // POP
      '          stack.pop();',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.POP_CURR_POS + ':',       // POP_CURR_POS
      '          peg$currPos = stack.pop();',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.POP_N + ':',              // POP_N n
      '          stack.length -= bc[ip + 1];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.NIP + ':',                // NIP
      '          stack.splice(-2, 1);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.APPEND + ':',             // APPEND
      '          stack[stack.length - 2].push(stack.pop());',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.WRAP + ':',               // WRAP n
      '          stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.TEXT + ':',               // TEXT
      '          stack.push(input.substring(stack.pop(), peg$currPos));',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.IF + ':',                 // IF t, f
                 indent10(generateCondition('stack[stack.length - 1]', 0)),
      '',
      '        case ' + op.IF_ERROR + ':',           // IF_ERROR t, f
                 indent10(generateCondition(
                   'stack[stack.length - 1] === peg$FAILED',
                   0
                 )),
      '',
      '        case ' + op.IF_NOT_ERROR + ':',       // IF_NOT_ERROR t, f
                 indent10(
                   generateCondition('stack[stack.length - 1] !== peg$FAILED',
                   0
                 )),
      '',
      '        case ' + op.WHILE_NOT_ERROR + ':',    // WHILE_NOT_ERROR b
                 indent10(generateLoop('stack[stack.length - 1] !== peg$FAILED')),
      '',
      '        case ' + op.MATCH_ANY + ':',          // MATCH_ANY a, f, ...
                 indent10(generateCondition('input.length > peg$currPos', 0)),
      '',
      '        case ' + op.MATCH_STRING + ':',       // MATCH_STRING s, a, f, ...
                 indent10(generateCondition(
                   'input.substr(peg$currPos, peg$consts[bc[ip + 1]].length) === peg$consts[bc[ip + 1]]',
                   1
                 )),
      '',
      '        case ' + op.MATCH_STRING_IC + ':',    // MATCH_STRING_IC s, a, f, ...
                 indent10(generateCondition(
                   'input.substr(peg$currPos, peg$consts[bc[ip + 1]].length).toLowerCase() === peg$consts[bc[ip + 1]]',
                   1
                 )),
      '',
      '        case ' + op.MATCH_REGEXP + ':',       // MATCH_REGEXP r, a, f, ...
                 indent10(generateCondition(
                   'peg$consts[bc[ip + 1]].test(input.charAt(peg$currPos))',
                   1
                 )),
      '',
      '        case ' + op.ACCEPT_N + ':',           // ACCEPT_N n
      '          stack.push(input.substr(peg$currPos, bc[ip + 1]));',
      '          peg$currPos += bc[ip + 1];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.ACCEPT_STRING + ':',      // ACCEPT_STRING s
      '          stack.push(peg$consts[bc[ip + 1]]);',
      '          peg$currPos += peg$consts[bc[ip + 1]].length;',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.FAIL + ':',               // FAIL e
      '          stack.push(peg$FAILED);',
      '          if (peg$silentFails === 0) {',
      '            peg$fail(peg$consts[bc[ip + 1]]);',
      '          }',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.LOAD_SAVED_POS + ':',     // LOAD_SAVED_POS p
      '          peg$savedPos = stack[stack.length - 1 - bc[ip + 1]];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.UPDATE_SAVED_POS + ':',   // UPDATE_SAVED_POS
      '          peg$savedPos = peg$currPos;',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.CALL + ':',               // CALL f, n, pc, p1, p2, ..., pN
                 indent10(generateCall()),
      '',
      '        case ' + op.RULE + ':',               // RULE r
      '          stack.push(peg$parseRule(bc[ip + 1]));',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.SILENT_FAILS_ON + ':',    // SILENT_FAILS_ON
      '          peg$silentFails++;',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.SILENT_FAILS_OFF + ':',   // SILENT_FAILS_OFF
      '          peg$silentFails--;',
      '          ip++;',
      '          break;',
      '',
      '        default:',
      '          throw new Error("Invalid opcode: " + bc[ip] + ".");',
      '      }',
      '    }',
      '',
      '    if (ends.length > 0) {',
      '      end = ends.pop();',
      '      ip = ips.pop();',
      '    } else {',
      '      break;',
      '    }',
      '  }'
    ].join('\n'));

    parts.push(indent2(generateRuleFooter('peg$ruleNames[index]', 'stack[0]')));
    parts.push('}');

    return parts.join('\n');
  }

  function generateRuleFunction(rule) {
    var parts = [], code;

    function c(i) { return "peg$c" + i; } // |consts[i]| of the abstract machine
    function s(i) { return "s"     + i; } // |stack[i]| of the abstract machine

    var stack = {
          sp:    -1,
          maxSp: -1,

          push: function(exprCode) {
            var code = s(++this.sp) + ' = ' + exprCode + ';';

            if (this.sp > this.maxSp) { this.maxSp = this.sp; }

            return code;
          },

          pop: function(n) {
            var values;

            if (n === void 0) {
              return s(this.sp--);
            } else {
              values = arrays.map(arrays.range(this.sp - n + 1, this.sp + 1), s);
              this.sp -= n;

              return values;
            }
          },

          top: function() {
            return s(this.sp);
          },

          index: function(i) {
            return s(this.sp - i);
          }
        };

    function compile(bc) {
      var ip    = 0,
          end   = bc.length,
          parts = [],
          value;

      function compileCondition(cond, argCount) {
        var baseLength = argCount + 3,
            thenLength = bc[ip + baseLength - 2],
            elseLength = bc[ip + baseLength - 1],
            baseSp     = stack.sp,
            thenCode, elseCode, thenSp, elseSp;

        ip += baseLength;
        thenCode = compile(bc.slice(ip, ip + thenLength));
        thenSp = stack.sp;
        ip += thenLength;

        if (elseLength > 0) {
          stack.sp = baseSp;
          elseCode = compile(bc.slice(ip, ip + elseLength));
          elseSp = stack.sp;
          ip += elseLength;

          if (thenSp !== elseSp) {
            throw new Error(
              "Branches of a condition must move the stack pointer in the same way."
            );
          }
        }

        parts.push('if (' + cond + ') {');
        parts.push(indent2(thenCode));
        if (elseLength > 0) {
          parts.push('} else {');
          parts.push(indent2(elseCode));
        }
        parts.push('}');
      }

      function compileLoop(cond) {
        var baseLength = 2,
            bodyLength = bc[ip + baseLength - 1],
            baseSp     = stack.sp,
            bodyCode, bodySp;

        ip += baseLength;
        bodyCode = compile(bc.slice(ip, ip + bodyLength));
        bodySp = stack.sp;
        ip += bodyLength;

        if (bodySp !== baseSp) {
          throw new Error("Body of a loop can't move the stack pointer.");
        }

        parts.push('while (' + cond + ') {');
        parts.push(indent2(bodyCode));
        parts.push('}');
      }

      function compileCall() {
        var baseLength   = 4,
            paramsLength = bc[ip + baseLength - 1];

        var value = c(bc[ip + 1]) + '('
              + arrays.map(
                  bc.slice(ip + baseLength, ip + baseLength + paramsLength),
                  function(p) { return stack.index(p); }
                ).join(', ')
              + ')';
        stack.pop(bc[ip + 2]);
        parts.push(stack.push(value));
        ip += baseLength + paramsLength;
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH:               // PUSH c
            parts.push(stack.push(c(bc[ip + 1])));
            ip += 2;
            break;

          case op.PUSH_CURR_POS:      // PUSH_CURR_POS
            parts.push(stack.push('peg$currPos'));
            ip++;
            break;

          case op.PUSH_UNDEFINED:      // PUSH_UNDEFINED
            parts.push(stack.push('void 0'));
            ip++;
            break;

          case op.PUSH_NULL:          // PUSH_NULL
            parts.push(stack.push('null'));
            ip++;
            break;

          case op.PUSH_FAILED:        // PUSH_FAILED
            parts.push(stack.push('peg$FAILED'));
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY:   // PUSH_EMPTY_ARRAY
            parts.push(stack.push('[]'));
            ip++;
            break;

          case op.POP:                // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS:       // POP_CURR_POS
            parts.push('peg$currPos = ' + stack.pop() + ';');
            ip++;
            break;

          case op.POP_N:              // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP:                // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND:             // APPEND
            value = stack.pop();
            parts.push(stack.top() + '.push(' + value + ');');
            ip++;
            break;

          case op.WRAP:               // WRAP n
            parts.push(
              stack.push('[' + stack.pop(bc[ip + 1]).join(', ') + ']')
            );
            ip += 2;
            break;

          case op.TEXT:               // TEXT
            parts.push(
              stack.push('input.substring(' + stack.pop() + ', peg$currPos)')
            );
            ip++;
            break;

          case op.IF:                 // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR:           // IF_ERROR t, f
            compileCondition(stack.top() + ' === peg$FAILED', 0);
            break;

          case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
            compileCondition(stack.top() + ' !== peg$FAILED', 0);
            break;

          case op.WHILE_NOT_ERROR:    // WHILE_NOT_ERROR b
            compileLoop(stack.top() + ' !== peg$FAILED', 0);
            break;

          case op.MATCH_ANY:          // MATCH_ANY a, f, ...
            compileCondition('input.length > peg$currPos', 0);
            break;

          case op.MATCH_STRING:       // MATCH_STRING s, a, f, ...
            compileCondition(
              eval(ast.consts[bc[ip + 1]]).length > 1
                ? 'input.substr(peg$currPos, '
                    + eval(ast.consts[bc[ip + 1]]).length
                    + ') === '
                    + c(bc[ip + 1])
                : 'input.charCodeAt(peg$currPos) === '
                    + eval(ast.consts[bc[ip + 1]]).charCodeAt(0),
              1
            );
            break;

          case op.MATCH_STRING_IC:    // MATCH_STRING_IC s, a, f, ...
            compileCondition(
              'input.substr(peg$currPos, '
                + eval(ast.consts[bc[ip + 1]]).length
                + ').toLowerCase() === '
                + c(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_REGEXP:       // MATCH_REGEXP r, a, f, ...
            compileCondition(
              c(bc[ip + 1]) + '.test(input.charAt(peg$currPos))',
              1
            );
            break;

          case op.ACCEPT_N:           // ACCEPT_N n
            parts.push(stack.push(
              bc[ip + 1] > 1
                ? 'input.substr(peg$currPos, ' + bc[ip + 1] + ')'
                : 'input.charAt(peg$currPos)'
            ));
            parts.push(
              bc[ip + 1] > 1
                ? 'peg$currPos += ' + bc[ip + 1] + ';'
                : 'peg$currPos++;'
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:      // ACCEPT_STRING s
            parts.push(stack.push(c(bc[ip + 1])));
            parts.push(
              eval(ast.consts[bc[ip + 1]]).length > 1
                ? 'peg$currPos += ' + eval(ast.consts[bc[ip + 1]]).length + ';'
                : 'peg$currPos++;'
            );
            ip += 2;
            break;

          case op.FAIL:               // FAIL e
            parts.push(stack.push('peg$FAILED'));
            parts.push('if (peg$silentFails === 0) { peg$fail(' + c(bc[ip + 1]) + '); }');
            ip += 2;
            break;

          case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS p
            parts.push('peg$savedPos = ' + stack.index(bc[ip + 1]) + ';');
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
            parts.push('peg$savedPos = peg$currPos;');
            ip++;
            break;

          case op.CALL:               // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE:               // RULE r
            parts.push(stack.push("peg$parse" + ast.rules[bc[ip + 1]].name + "()"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
            parts.push('peg$silentFails++;');
            ip++;
            break;

          case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
            parts.push('peg$silentFails--;');
            ip++;
            break;

          default:
            throw new Error("Invalid opcode: " + bc[ip] + ".");
        }
      }

      return parts.join('\n');
    }

    code = compile(rule.bytecode);

    parts.push('function peg$parse' + rule.name + '() {');

    if (options.trace) {
      parts.push([
        '  var ' + arrays.map(arrays.range(0, stack.maxSp + 1), s).join(', ') + ',',
        '      startPos = peg$currPos;'
      ].join('\n'));
    } else {
      parts.push(
        '  var ' + arrays.map(arrays.range(0, stack.maxSp + 1), s).join(', ') + ';'
      );
    }

    parts.push(indent2(generateRuleHeader(
      '"' + js.stringEscape(rule.name) + '"',
      asts.indexOfRule(ast, rule.name)
    )));
    parts.push(indent2(code));
    parts.push(indent2(generateRuleFooter(
      '"' + js.stringEscape(rule.name) + '"',
      s(0)
    )));

    parts.push('}');

    return parts.join('\n');
  }

  function generateToplevel() {
    var parts = [],
        startRuleIndices,   startRuleIndex,
        startRuleFunctions, startRuleFunction,
        ruleNames;

    parts.push([
      'function peg$subclass(child, parent) {',
      '  function ctor() { this.constructor = child; }',
      '  ctor.prototype = parent.prototype;',
      '  child.prototype = new ctor();',
      '}',
      '',
      'function peg$SyntaxError(message, expected, found, location) {',
      '  this.message  = message;',
      '  this.expected = expected;',
      '  this.found    = found;',
      '  this.location = location;',
      '  this.name     = "SyntaxError";',
      '',
      '  if (typeof Error.captureStackTrace === "function") {',
      '    Error.captureStackTrace(this, peg$SyntaxError);',
      '  }',
      '}',
      '',
      'peg$subclass(peg$SyntaxError, Error);',
      '',
      'peg$SyntaxError.buildMessage = function(expected, found) {',
      '  var DESCRIBE_EXPECTATION_FNS = {',
      '        literal: function(expectation) {',
      '          return "\\\"" + literalEscape(expectation.text) + "\\\"";',
      '        },',
      '',
      '        "class": function(expectation) {',
      '          var escapedParts = "",',
      '              i;',
      '',
      '          for (i = 0; i < expectation.parts.length; i++) {',
      '            escapedParts += expectation.parts[i] instanceof Array',
      '              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])',
      '              : classEscape(expectation.parts[i]);',
      '          }',
      '',
      '          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";',
      '        },',
      '',
      '        any: function(expectation) {',
      '          return "any character";',
      '        },',
      '',
      '        end: function(expectation) {',
      '          return "end of input";',
      '        },',
      '',
      '        other: function(expectation) {',
      '          return expectation.description;',
      '        }',
      '      };',
      '',
      '  function hex(ch) {',
      '    return ch.charCodeAt(0).toString(16).toUpperCase();',
      '  }',
      '',
      '  function literalEscape(s) {',
      '    return s',
      '      .replace(/\\\\/g, \'\\\\\\\\\')',   // backslash
      '      .replace(/"/g,  \'\\\\"\')',        // closing double quote
      '      .replace(/\\0/g, \'\\\\0\')',       // null
      '      .replace(/\\t/g, \'\\\\t\')',       // horizontal tab
      '      .replace(/\\n/g, \'\\\\n\')',       // line feed
      '      .replace(/\\r/g, \'\\\\r\')',       // carriage return
      '      .replace(/[\\x00-\\x0F]/g,          function(ch) { return \'\\\\x0\' + hex(ch); })',
      '      .replace(/[\\x10-\\x1F\\x7F-\\x9F]/g, function(ch) { return \'\\\\x\'  + hex(ch); });',
      '  }',
      '',
      '  function classEscape(s) {',
      '    return s',
      '      .replace(/\\\\/g, \'\\\\\\\\\')',   // backslash
      '      .replace(/\\]/g, \'\\\\]\')',       // closing bracket
      '      .replace(/\\^/g, \'\\\\^\')',       // caret
      '      .replace(/-/g,  \'\\\\-\')',        // dash
      '      .replace(/\\0/g, \'\\\\0\')',       // null
      '      .replace(/\\t/g, \'\\\\t\')',       // horizontal tab
      '      .replace(/\\n/g, \'\\\\n\')',       // line feed
      '      .replace(/\\r/g, \'\\\\r\')',       // carriage return
      '      .replace(/[\\x00-\\x0F]/g,          function(ch) { return \'\\\\x0\' + hex(ch); })',
      '      .replace(/[\\x10-\\x1F\\x7F-\\x9F]/g, function(ch) { return \'\\\\x\'  + hex(ch); });',
      '  }',
      '',
      '  function describeExpectation(expectation) {',
      '    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);',
      '  }',
      '',
      '  function describeExpected(expected) {',
      '    var descriptions = new Array(expected.length),',
      '        i, j;',
      '',
      '    for (i = 0; i < expected.length; i++) {',
      '      descriptions[i] = describeExpectation(expected[i]);',
      '    }',
      '',
      '    descriptions.sort();',
      '',
      '    if (descriptions.length > 0) {',
      '      for (i = 1, j = 1; i < descriptions.length; i++) {',
      '        if (descriptions[i - 1] !== descriptions[i]) {',
      '          descriptions[j] = descriptions[i];',
      '          j++;',
      '        }',
      '      }',
      '      descriptions.length = j;',
      '    }',
      '',
      '    switch (descriptions.length) {',
      '      case 1:',
      '        return descriptions[0];',
      '',
      '      case 2:',
      '        return descriptions[0] + " or " + descriptions[1];',
      '',
      '      default:',
      '        return descriptions.slice(0, -1).join(", ")',
      '          + ", or "',
      '          + descriptions[descriptions.length - 1];',
      '    }',
      '  }',
      '',
      '  function describeFound(found) {',
      '    return found ? "\\"" + literalEscape(found) + "\\"" : "end of input";',
      '  }',
      '',
      '  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";',
      '};',
      ''
    ].join('\n'));

    if (options.trace) {
      parts.push([
        'function peg$DefaultTracer() {',
        '  this.indentLevel = 0;',
        '}',
        '',
        'peg$DefaultTracer.prototype.trace = function(event) {',
        '  var that = this;',
        '',
        '  function log(event) {',
        '    function repeat(string, n) {',
        '       var result = "", i;',
        '',
        '       for (i = 0; i < n; i++) {',
        '         result += string;',
        '       }',
        '',
        '       return result;',
        '    }',
        '',
        '    function pad(string, length) {',
        '      return string + repeat(" ", length - string.length);',
        '    }',
        '',
        '    if (typeof console === "object") {',   // IE 8-10
        '      console.log(',
        '        event.location.start.line + ":" + event.location.start.column + "-"',
        '          + event.location.end.line + ":" + event.location.end.column + " "',
        '          + pad(event.type, 10) + " "',
        '          + repeat("  ", that.indentLevel) + event.rule',
        '      );',
        '    }',
        '  }',
        '',
        '  switch (event.type) {',
        '    case "rule.enter":',
        '      log(event);',
        '      this.indentLevel++;',
        '      break;',
        '',
        '    case "rule.match":',
        '      this.indentLevel--;',
        '      log(event);',
        '      break;',
        '',
        '    case "rule.fail":',
        '      this.indentLevel--;',
        '      log(event);',
        '      break;',
        '',
        '    default:',
        '      throw new Error("Invalid event type: " + event.type + ".");',
        '  }',
        '};',
        ''
      ].join('\n'));
    }

    parts.push([
      'function peg$parse(input, options) {',
      '  options = options !== void 0 ? options : {};',
      '',
      '  var peg$FAILED = {},',
      ''
    ].join('\n'));

    if (options.optimize === "size") {
      startRuleIndices = '{ '
                       + arrays.map(
                           options.allowedStartRules,
                           function(r) { return r + ': ' + asts.indexOfRule(ast, r); }
                         ).join(', ')
                       + ' }';
      startRuleIndex = asts.indexOfRule(ast, options.allowedStartRules[0]);

      parts.push([
        '      peg$startRuleIndices = ' + startRuleIndices + ',',
        '      peg$startRuleIndex   = ' + startRuleIndex + ','
      ].join('\n'));
    } else {
      startRuleFunctions = '{ '
                       + arrays.map(
                           options.allowedStartRules,
                           function(r) { return r + ': peg$parse' + r; }
                         ).join(', ')
                       + ' }';
      startRuleFunction = 'peg$parse' + options.allowedStartRules[0];

      parts.push([
        '      peg$startRuleFunctions = ' + startRuleFunctions + ',',
        '      peg$startRuleFunction  = ' + startRuleFunction + ','
      ].join('\n'));
    }

    parts.push('');

    parts.push(indent6(generateTables()));

    parts.push([
      '',
      '      peg$currPos          = 0,',
      '      peg$savedPos         = 0,',
      '      peg$posDetailsCache  = [{ line: 1, column: 1 }],',
      '      peg$maxFailPos       = 0,',
      '      peg$maxFailExpected  = [],',
      '      peg$silentFails      = 0,',   // 0 = report failures, > 0 = silence failures
      ''
    ].join('\n'));

    if (options.cache) {
      parts.push([
        '      peg$resultsCache = {},',
        ''
      ].join('\n'));
    }

    if (options.trace) {
      if (options.optimize === "size") {
        ruleNames = '['
                  + arrays.map(
                      ast.rules,
                      function(r) { return '"' + js.stringEscape(r.name) + '"'; }
                    ).join(', ')
                  + ']';

        parts.push([
          '      peg$ruleNames = ' + ruleNames + ',',
          ''
        ].join('\n'));
      }

      parts.push([
        '      peg$tracer = "tracer" in options ? options.tracer : new peg$DefaultTracer(),',
        ''
      ].join('\n'));
    }

    parts.push([
      '      peg$result;',
      ''
    ].join('\n'));

    if (options.optimize === "size") {
      parts.push([
        '  if ("startRule" in options) {',
        '    if (!(options.startRule in peg$startRuleIndices)) {',
        '      throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
        '    }',
        '',
        '    peg$startRuleIndex = peg$startRuleIndices[options.startRule];',
        '  }'
      ].join('\n'));
    } else {
      parts.push([
        '  if ("startRule" in options) {',
        '    if (!(options.startRule in peg$startRuleFunctions)) {',
        '      throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
        '    }',
        '',
        '    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];',
        '  }'
      ].join('\n'));
    }

    parts.push([
      '',
      '  function text() {',
      '    return input.substring(peg$savedPos, peg$currPos);',
      '  }',
      '',
      '  function location() {',
      '    return peg$computeLocation(peg$savedPos, peg$currPos);',
      '  }',
      '',
      '  function expected(description, location) {',
      '    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)',
      '',
      '    throw peg$buildStructuredError(',
      '      [peg$otherExpectation(description)],',
      '      input.substring(peg$savedPos, peg$currPos),',
      '      location',
      '    );',
      '  }',
      '',
      '  function error(message, location) {',
      '    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)',
      '',
      '    throw peg$buildSimpleError(message, location);',
      '  }',
      '',
      '  function peg$literalExpectation(text, ignoreCase) {',
      '    return { type: "literal", text: text, ignoreCase: ignoreCase };',
      '  }',
      '',
      '  function peg$classExpectation(parts, inverted, ignoreCase) {',
      '    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };',
      '  }',
      '',
      '  function peg$anyExpectation() {',
      '    return { type: "any" };',
      '  }',
      '',
      '  function peg$endExpectation() {',
      '    return { type: "end" };',
      '  }',
      '',
      '  function peg$otherExpectation(description) {',
      '    return { type: "other", description: description };',
      '  }',
      '',
      '  function peg$computePosDetails(pos) {',
      '    var details = peg$posDetailsCache[pos], p;',
      '',
      '    if (details) {',
      '      return details;',
      '    } else {',
      '      p = pos - 1;',
      '      while (!peg$posDetailsCache[p]) {',
      '        p--;',
      '      }',
      '',
      '      details = peg$posDetailsCache[p];',
      '      details = {',
      '        line:   details.line,',
      '        column: details.column',
      '      };',
      '',
      '      while (p < pos) {',
      '        if (input.charCodeAt(p) === 10) {',
      '          details.line++;',
      '          details.column = 1;',
      '        } else {',
      '          details.column++;',
      '        }',
      '',
      '        p++;',
      '      }',
      '',
      '      peg$posDetailsCache[pos] = details;',
      '      return details;',
      '    }',
      '  }',
      '',
      '  function peg$computeLocation(startPos, endPos) {',
      '    var startPosDetails = peg$computePosDetails(startPos),',
      '        endPosDetails   = peg$computePosDetails(endPos);',
      '',
      '    return {',
      '      start: {',
      '        offset: startPos,',
      '        line:   startPosDetails.line,',
      '        column: startPosDetails.column',
      '      },',
      '      end: {',
      '        offset: endPos,',
      '        line:   endPosDetails.line,',
      '        column: endPosDetails.column',
      '      }',
      '    };',
      '  }',
      '',
      '  function peg$fail(expected) {',
      '    if (peg$currPos < peg$maxFailPos) { return; }',
      '',
      '    if (peg$currPos > peg$maxFailPos) {',
      '      peg$maxFailPos = peg$currPos;',
      '      peg$maxFailExpected = [];',
      '    }',
      '',
      '    peg$maxFailExpected.push(expected);',
      '  }',
      '',
      '  function peg$buildSimpleError(message, location) {',
      '    return new peg$SyntaxError(message, null, null, location);',
      '  }',
      '',
      '  function peg$buildStructuredError(expected, found, location) {',
      '    return new peg$SyntaxError(',
      '      peg$SyntaxError.buildMessage(expected, found),',
      '      expected,',
      '      found,',
      '      location',
      '    );',
      '  }',
      ''
    ].join('\n'));

    if (options.optimize === "size") {
      parts.push(indent2(generateInterpreter()));
      parts.push('');
    } else {
      arrays.each(ast.rules, function(rule) {
        parts.push(indent2(generateRuleFunction(rule)));
        parts.push('');
      });
    }

    if (ast.initializer) {
      parts.push(indent2(ast.initializer.code));
      parts.push('');
    }

    if (options.optimize === "size") {
      parts.push('  peg$result = peg$parseRule(peg$startRuleIndex);');
    } else {
      parts.push('  peg$result = peg$startRuleFunction();');
    }

    parts.push([
      '',
      '  if (peg$result !== peg$FAILED && peg$currPos === input.length) {',
      '    return peg$result;',
      '  } else {',
      '    if (peg$result !== peg$FAILED && peg$currPos < input.length) {',
      '      peg$fail(peg$endExpectation());',
      '    }',
      '',
      '    throw peg$buildStructuredError(',
      '      peg$maxFailExpected,',
      '      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,',
      '      peg$maxFailPos < input.length',
      '        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)',
      '        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)',
      '    );',
      '  }',
      '}'
    ].join('\n'));

    return parts.join('\n');
  }

  function generateWrapper(toplevelCode) {
    function generateGeneratedByComment() {
      return [
        '/*',
        ' * Generated by PEG.js 0.10.0.',
        ' *',
        ' * http://pegjs.org/',
        ' */'
      ].join('\n');
    }

    function generateParserObject() {
      return options.trace
        ? [
            '{',
            '  SyntaxError:   peg$SyntaxError,',
            '  DefaultTracer: peg$DefaultTracer,',
            '  parse:         peg$parse',
            '}'
          ].join('\n')
        : [
            '{',
            '  SyntaxError: peg$SyntaxError,',
            '  parse:       peg$parse',
            '}'
          ].join('\n');
    }

    var generators = {
      bare: function() {
        return [
          generateGeneratedByComment(),
          '(function() {',
          '  "use strict";',
          '',
             indent2(toplevelCode),
          '',
             indent2('return ' + generateParserObject() + ';'),
          '})()'
        ].join('\n');
      },

      commonjs: function() {
        var parts          = [],
            dependencyVars = objects.keys(options.dependencies),
            requires       = arrays.map(
              dependencyVars,
              function(variable) {
                return variable
                  + ' = require("'
                  + js.stringEscape(options.dependencies[variable])
                  + '")';
              }
            );

        parts.push([
          generateGeneratedByComment(),
          '',
          '"use strict";',
          ''
        ].join('\n'));

        if (requires.length > 0) {
          parts.push('var ' + requires.join(', ') + ';');
          parts.push('');
        }

        parts.push([
          toplevelCode,
          '',
          'module.exports = ' + generateParserObject() + ';',
          ''
        ].join('\n'));

        return parts.join('\n');
      },

      amd: function() {
        var dependencyIds  = objects.values(options.dependencies),
            dependencyVars = objects.keys(options.dependencies),
            dependencies   = '['
              + arrays.map(
                  dependencyIds,
                  function(id) { return '"' + js.stringEscape(id) + '"'; }
                ).join(', ')
              + ']',
            params         = dependencyVars.join(', ');

        return [
          generateGeneratedByComment(),
          'define(' + dependencies + ', function(' + params + ') {',
          '  "use strict";',
          '',
             indent2(toplevelCode),
          '',
             indent2('return ' + generateParserObject() + ';'),
          '});',
          ''
        ].join('\n');
      },

      globals: function() {
        return [
          generateGeneratedByComment(),
          '(function(root) {',
          '  "use strict";',
          '',
             indent2(toplevelCode),
          '',
             indent2('root.' + options.exportVar + ' = ' + generateParserObject() + ';'),
          '})(this);',
          ''
        ].join('\n');
      },

      umd: function() {
        var parts          = [],
            dependencyIds  = objects.values(options.dependencies),
            dependencyVars = objects.keys(options.dependencies),
            dependencies   = '['
              + arrays.map(
                  dependencyIds,
                  function(id) { return '"' + js.stringEscape(id) + '"'; }
                ).join(', ')
              + ']',
            requires       = arrays.map(
              dependencyIds,
              function(id) { return 'require("' + js.stringEscape(id) + '")'; }
            ).join(', '),
            params         = dependencyVars.join(', ');

        parts.push([
          generateGeneratedByComment(),
          '(function(root, factory) {',
          '  if (typeof define === "function" && define.amd) {',
          '    define(' + dependencies + ', factory);',
          '  } else if (typeof module === "object" && module.exports) {',
          '    module.exports = factory(' + requires + ');'
        ].join('\n'));

        if (options.exportVar !== null) {
          parts.push([
            '  } else {',
            '    root.' + options.exportVar + ' = factory();'
          ].join('\n'));
        }

        parts.push([
          '  }',
          '})(this, function(' + params + ') {',
          '  "use strict";',
          '',
             indent2(toplevelCode),
          '',
             indent2('return ' + generateParserObject() + ';'),
          '});',
          ''
        ].join('\n'));

        return parts.join('\n');
      }
    };

    return generators[options.format]();
  }

  ast.code = generateWrapper(generateToplevel());
}

module.exports = generateJS;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/remove-proxy-rules.js":
/*!**********************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/remove-proxy-rules.js ***!
  \**********************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays  = __webpack_require__(/*! ../../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    visitor = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/*
 * Removes proxy rules -- that is, rules that only delegate to other rule.
 */
function removeProxyRules(ast, options) {
  function isProxyRule(node) {
    return node.type === "rule" && node.expression.type === "rule_ref";
  }

  function replaceRuleRefs(ast, from, to) {
    var replace = visitor.build({
      rule_ref: function(node) {
        if (node.name === from) {
          node.name = to;
        }
      }
    });

    replace(ast);
  }

  var indices = [];

  arrays.each(ast.rules, function(rule, i) {
    if (isProxyRule(rule)) {
      replaceRuleRefs(ast, rule.name, rule.expression.name);
      if (!arrays.contains(options.allowedStartRules, rule.name)) {
        indices.push(i);
      }
    }
  });

  indices.reverse();

  arrays.each(indices, function(i) { ast.rules.splice(i, 1); });
}

module.exports = removeProxyRules;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/report-duplicate-labels.js":
/*!***************************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/report-duplicate-labels.js ***!
  \***************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var GrammarError = __webpack_require__(/*! ../../grammar-error */ "./node_modules/pegjs/lib/grammar-error.js"),
    arrays       = __webpack_require__(/*! ../../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    objects      = __webpack_require__(/*! ../../utils/objects */ "./node_modules/pegjs/lib/utils/objects.js"),
    visitor      = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/* Checks that each label is defined only once within each scope. */
function reportDuplicateLabels(ast) {
  function checkExpressionWithClonedEnv(node, env) {
    check(node.expression, objects.clone(env));
  }

  var check = visitor.build({
    rule: function(node) {
      check(node.expression, { });
    },

    choice: function(node, env) {
      arrays.each(node.alternatives, function(alternative) {
        check(alternative, objects.clone(env));
      });
    },

    action: checkExpressionWithClonedEnv,

    labeled: function(node, env) {
      if (env.hasOwnProperty(node.label)) {
        throw new GrammarError(
          "Label \"" + node.label + "\" is already defined "
            + "at line " + env[node.label].start.line + ", "
            + "column " + env[node.label].start.column + ".",
          node.location
        );
      }

      check(node.expression, env);

      env[node.label] = node.location;
    },

    text:         checkExpressionWithClonedEnv,
    simple_and:   checkExpressionWithClonedEnv,
    simple_not:   checkExpressionWithClonedEnv,
    optional:     checkExpressionWithClonedEnv,
    zero_or_more: checkExpressionWithClonedEnv,
    one_or_more:  checkExpressionWithClonedEnv,
    group:        checkExpressionWithClonedEnv
  });

  check(ast);
}

module.exports = reportDuplicateLabels;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/report-duplicate-rules.js":
/*!**************************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/report-duplicate-rules.js ***!
  \**************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var GrammarError = __webpack_require__(/*! ../../grammar-error */ "./node_modules/pegjs/lib/grammar-error.js"),
    visitor      = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/* Checks that each rule is defined only once. */
function reportDuplicateRules(ast) {
  var rules = {};

  var check = visitor.build({
    rule: function(node) {
      if (rules.hasOwnProperty(node.name)) {
        throw new GrammarError(
          "Rule \"" + node.name + "\" is already defined "
            + "at line " + rules[node.name].start.line + ", "
            + "column " + rules[node.name].start.column + ".",
          node.location
        );
      }

      rules[node.name] = node.location;
    }
  });

  check(ast);
}

module.exports = reportDuplicateRules;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/report-infinite-recursion.js":
/*!*****************************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/report-infinite-recursion.js ***!
  \*****************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays       = __webpack_require__(/*! ../../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    GrammarError = __webpack_require__(/*! ../../grammar-error */ "./node_modules/pegjs/lib/grammar-error.js"),
    asts         = __webpack_require__(/*! ../asts */ "./node_modules/pegjs/lib/compiler/asts.js"),
    visitor      = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/*
 * Reports left recursion in the grammar, which prevents infinite recursion in
 * the generated parser.
 *
 * Both direct and indirect recursion is detected. The pass also correctly
 * reports cases like this:
 *
 *   start = "a"? start
 *
 * In general, if a rule reference can be reached without consuming any input,
 * it can lead to left recursion.
 */
function reportInfiniteRecursion(ast) {
  var visitedRules = [];

  var check = visitor.build({
    rule: function(node) {
      visitedRules.push(node.name);
      check(node.expression);
      visitedRules.pop(node.name);
    },

    sequence: function(node) {
      arrays.every(node.elements, function(element) {
        check(element);

        return !asts.alwaysConsumesOnSuccess(ast, element);
      });
    },

    rule_ref: function(node) {
      if (arrays.contains(visitedRules, node.name)) {
        visitedRules.push(node.name);

        throw new GrammarError(
          "Possible infinite loop when parsing (left recursion: "
            + visitedRules.join(" -> ")
            + ").",
          node.location
        );
      }

      check(asts.findRule(ast, node.name));
    }
  });

  check(ast);
}

module.exports = reportInfiniteRecursion;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/report-infinite-repetition.js":
/*!******************************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/report-infinite-repetition.js ***!
  \******************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var GrammarError = __webpack_require__(/*! ../../grammar-error */ "./node_modules/pegjs/lib/grammar-error.js"),
    asts         = __webpack_require__(/*! ../asts */ "./node_modules/pegjs/lib/compiler/asts.js"),
    visitor      = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/*
 * Reports expressions that don't consume any input inside |*| or |+| in the
 * grammar, which prevents infinite loops in the generated parser.
 */
function reportInfiniteRepetition(ast) {
  var check = visitor.build({
    zero_or_more: function(node) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        throw new GrammarError(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        );
      }
    },

    one_or_more: function(node) {
      if (!asts.alwaysConsumesOnSuccess(ast, node.expression)) {
        throw new GrammarError(
          "Possible infinite loop when parsing (repetition used with an expression that may not consume any input).",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportInfiniteRepetition;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/passes/report-undefined-rules.js":
/*!**************************************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/passes/report-undefined-rules.js ***!
  \**************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var GrammarError = __webpack_require__(/*! ../../grammar-error */ "./node_modules/pegjs/lib/grammar-error.js"),
    asts         = __webpack_require__(/*! ../asts */ "./node_modules/pegjs/lib/compiler/asts.js"),
    visitor      = __webpack_require__(/*! ../visitor */ "./node_modules/pegjs/lib/compiler/visitor.js");

/* Checks that all referenced rules exist. */
function reportUndefinedRules(ast) {
  var check = visitor.build({
    rule_ref: function(node) {
      if (!asts.findRule(ast, node.name)) {
        throw new GrammarError(
          "Rule \"" + node.name + "\" is not defined.",
          node.location
        );
      }
    }
  });

  check(ast);
}

module.exports = reportUndefinedRules;


/***/ }),

/***/ "./node_modules/pegjs/lib/compiler/visitor.js":
/*!****************************************************!*\
  !*** ./node_modules/pegjs/lib/compiler/visitor.js ***!
  \****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var objects = __webpack_require__(/*! ../utils/objects */ "./node_modules/pegjs/lib/utils/objects.js"),
    arrays  = __webpack_require__(/*! ../utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js");

/* Simple AST node visitor builder. */
var visitor = {
  build: function(functions) {
    function visit(node) {
      return functions[node.type].apply(null, arguments);
    }

    function visitNop() { }

    function visitExpression(node) {
      var extraArgs = Array.prototype.slice.call(arguments, 1);

      visit.apply(null, [node.expression].concat(extraArgs));
    }

    function visitChildren(property) {
      return function(node) {
        var extraArgs = Array.prototype.slice.call(arguments, 1);

        arrays.each(node[property], function(child) {
          visit.apply(null, [child].concat(extraArgs));
        });
      };
    }

    var DEFAULT_FUNCTIONS = {
          grammar: function(node) {
            var extraArgs = Array.prototype.slice.call(arguments, 1);

            if (node.initializer) {
              visit.apply(null, [node.initializer].concat(extraArgs));
            }

            arrays.each(node.rules, function(rule) {
              visit.apply(null, [rule].concat(extraArgs));
            });
          },

          initializer:  visitNop,
          rule:         visitExpression,
          named:        visitExpression,
          choice:       visitChildren("alternatives"),
          action:       visitExpression,
          sequence:     visitChildren("elements"),
          labeled:      visitExpression,
          text:         visitExpression,
          simple_and:   visitExpression,
          simple_not:   visitExpression,
          optional:     visitExpression,
          zero_or_more: visitExpression,
          one_or_more:  visitExpression,
          group:        visitExpression,
          semantic_and: visitNop,
          semantic_not: visitNop,
          rule_ref:     visitNop,
          literal:      visitNop,
          "class":      visitNop,
          any:          visitNop
        };

    objects.defaults(functions, DEFAULT_FUNCTIONS);

    return visit;
  }
};

module.exports = visitor;


/***/ }),

/***/ "./node_modules/pegjs/lib/grammar-error.js":
/*!*************************************************!*\
  !*** ./node_modules/pegjs/lib/grammar-error.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var classes = __webpack_require__(/*! ./utils/classes */ "./node_modules/pegjs/lib/utils/classes.js");

/* Thrown when the grammar contains an error. */
function GrammarError(message, location) {
  this.name = "GrammarError";
  this.message = message;
  this.location = location;

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, GrammarError);
  }
}

classes.subclass(GrammarError, Error);

module.exports = GrammarError;


/***/ }),

/***/ "./node_modules/pegjs/lib/parser.js":
/*!******************************************!*\
  !*** ./node_modules/pegjs/lib/parser.js ***!
  \******************************************/
/***/ ((module) => {

"use strict";
/* eslint-env node, amd */
/* eslint no-unused-vars: 0 */

/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */



function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { Grammar: peg$parseGrammar },
      peg$startRuleFunction  = peg$parseGrammar,

      peg$c0 = function(initializer, rules) {
            return {
              type:        "grammar",
              initializer: extractOptional(initializer, 0),
              rules:       extractList(rules, 0),
              location:    location()
            };
          },
      peg$c1 = function(code) {
            return { type: "initializer", code: code, location: location() };
          },
      peg$c2 = "=",
      peg$c3 = peg$literalExpectation("=", false),
      peg$c4 = function(name, displayName, expression) {
            return {
              type:        "rule",
              name:        name,
              expression:  displayName !== null
                ? {
                    type:       "named",
                    name:       displayName[0],
                    expression: expression,
                    location:   location()
                  }
                : expression,
              location:    location()
            };
          },
      peg$c5 = "/",
      peg$c6 = peg$literalExpectation("/", false),
      peg$c7 = function(head, tail) {
            return tail.length > 0
              ? {
                  type:         "choice",
                  alternatives: buildList(head, tail, 3),
                  location:     location()
                }
              : head;
          },
      peg$c8 = function(expression, code) {
            return code !== null
              ? {
                  type:       "action",
                  expression: expression,
                  code:       code[1],
                  location:   location()
                }
              : expression;
          },
      peg$c9 = function(head, tail) {
            return tail.length > 0
              ? {
                  type:     "sequence",
                  elements: buildList(head, tail, 1),
                  location: location()
                }
              : head;
          },
      peg$c10 = ":",
      peg$c11 = peg$literalExpectation(":", false),
      peg$c12 = function(label, expression) {
            return {
              type:       "labeled",
              label:      label,
              expression: expression,
              location:   location()
            };
          },
      peg$c13 = function(operator, expression) {
            return {
              type:       OPS_TO_PREFIXED_TYPES[operator],
              expression: expression,
              location:   location()
            };
          },
      peg$c14 = "$",
      peg$c15 = peg$literalExpectation("$", false),
      peg$c16 = "&",
      peg$c17 = peg$literalExpectation("&", false),
      peg$c18 = "!",
      peg$c19 = peg$literalExpectation("!", false),
      peg$c20 = function(expression, operator) {
            return {
              type:       OPS_TO_SUFFIXED_TYPES[operator],
              expression: expression,
              location:   location()
            };
          },
      peg$c21 = "?",
      peg$c22 = peg$literalExpectation("?", false),
      peg$c23 = "*",
      peg$c24 = peg$literalExpectation("*", false),
      peg$c25 = "+",
      peg$c26 = peg$literalExpectation("+", false),
      peg$c27 = "(",
      peg$c28 = peg$literalExpectation("(", false),
      peg$c29 = ")",
      peg$c30 = peg$literalExpectation(")", false),
      peg$c31 = function(expression) {
            /*
             * The purpose of the "group" AST node is just to isolate label scope. We
             * don't need to put it around nodes that can't contain any labels or
             * nodes that already isolate label scope themselves. This leaves us with
             * "labeled" and "sequence".
             */
            return expression.type === 'labeled' || expression.type === 'sequence'
                ? { type: "group", expression: expression }
                : expression;
          },
      peg$c32 = function(name) {
            return { type: "rule_ref", name: name, location: location() };
          },
      peg$c33 = function(operator, code) {
            return {
              type:     OPS_TO_SEMANTIC_PREDICATE_TYPES[operator],
              code:     code,
              location: location()
            };
          },
      peg$c34 = peg$anyExpectation(),
      peg$c35 = peg$otherExpectation("whitespace"),
      peg$c36 = "\t",
      peg$c37 = peg$literalExpectation("\t", false),
      peg$c38 = "\x0B",
      peg$c39 = peg$literalExpectation("\x0B", false),
      peg$c40 = "\f",
      peg$c41 = peg$literalExpectation("\f", false),
      peg$c42 = " ",
      peg$c43 = peg$literalExpectation(" ", false),
      peg$c44 = "\xA0",
      peg$c45 = peg$literalExpectation("\xA0", false),
      peg$c46 = "\uFEFF",
      peg$c47 = peg$literalExpectation("\uFEFF", false),
      peg$c48 = /^[\n\r\u2028\u2029]/,
      peg$c49 = peg$classExpectation(["\n", "\r", "\u2028", "\u2029"], false, false),
      peg$c50 = peg$otherExpectation("end of line"),
      peg$c51 = "\n",
      peg$c52 = peg$literalExpectation("\n", false),
      peg$c53 = "\r\n",
      peg$c54 = peg$literalExpectation("\r\n", false),
      peg$c55 = "\r",
      peg$c56 = peg$literalExpectation("\r", false),
      peg$c57 = "\u2028",
      peg$c58 = peg$literalExpectation("\u2028", false),
      peg$c59 = "\u2029",
      peg$c60 = peg$literalExpectation("\u2029", false),
      peg$c61 = peg$otherExpectation("comment"),
      peg$c62 = "/*",
      peg$c63 = peg$literalExpectation("/*", false),
      peg$c64 = "*/",
      peg$c65 = peg$literalExpectation("*/", false),
      peg$c66 = "//",
      peg$c67 = peg$literalExpectation("//", false),
      peg$c68 = function(name) { return name; },
      peg$c69 = peg$otherExpectation("identifier"),
      peg$c70 = function(head, tail) { return head + tail.join(""); },
      peg$c71 = "_",
      peg$c72 = peg$literalExpectation("_", false),
      peg$c73 = "\\",
      peg$c74 = peg$literalExpectation("\\", false),
      peg$c75 = function(sequence) { return sequence; },
      peg$c76 = "\u200C",
      peg$c77 = peg$literalExpectation("\u200C", false),
      peg$c78 = "\u200D",
      peg$c79 = peg$literalExpectation("\u200D", false),
      peg$c80 = peg$otherExpectation("literal"),
      peg$c81 = "i",
      peg$c82 = peg$literalExpectation("i", false),
      peg$c83 = function(value, ignoreCase) {
            return {
              type:       "literal",
              value:      value,
              ignoreCase: ignoreCase !== null,
              location:   location()
            };
          },
      peg$c84 = peg$otherExpectation("string"),
      peg$c85 = "\"",
      peg$c86 = peg$literalExpectation("\"", false),
      peg$c87 = function(chars) { return chars.join(""); },
      peg$c88 = "'",
      peg$c89 = peg$literalExpectation("'", false),
      peg$c90 = function() { return text(); },
      peg$c91 = peg$otherExpectation("character class"),
      peg$c92 = "[",
      peg$c93 = peg$literalExpectation("[", false),
      peg$c94 = "^",
      peg$c95 = peg$literalExpectation("^", false),
      peg$c96 = "]",
      peg$c97 = peg$literalExpectation("]", false),
      peg$c98 = function(inverted, parts, ignoreCase) {
            return {
              type:       "class",
              parts:      filterEmptyStrings(parts),
              inverted:   inverted !== null,
              ignoreCase: ignoreCase !== null,
              location:   location()
            };
          },
      peg$c99 = "-",
      peg$c100 = peg$literalExpectation("-", false),
      peg$c101 = function(begin, end) {
            if (begin.charCodeAt(0) > end.charCodeAt(0)) {
              error(
                "Invalid character range: " + text() + "."
              );
            }

            return [begin, end];
          },
      peg$c102 = function() { return ""; },
      peg$c103 = "0",
      peg$c104 = peg$literalExpectation("0", false),
      peg$c105 = function() { return "\0"; },
      peg$c106 = "b",
      peg$c107 = peg$literalExpectation("b", false),
      peg$c108 = function() { return "\b";   },
      peg$c109 = "f",
      peg$c110 = peg$literalExpectation("f", false),
      peg$c111 = function() { return "\f";   },
      peg$c112 = "n",
      peg$c113 = peg$literalExpectation("n", false),
      peg$c114 = function() { return "\n";   },
      peg$c115 = "r",
      peg$c116 = peg$literalExpectation("r", false),
      peg$c117 = function() { return "\r";   },
      peg$c118 = "t",
      peg$c119 = peg$literalExpectation("t", false),
      peg$c120 = function() { return "\t";   },
      peg$c121 = "v",
      peg$c122 = peg$literalExpectation("v", false),
      peg$c123 = function() { return "\x0B"; },
      peg$c124 = "x",
      peg$c125 = peg$literalExpectation("x", false),
      peg$c126 = "u",
      peg$c127 = peg$literalExpectation("u", false),
      peg$c128 = function(digits) {
            return String.fromCharCode(parseInt(digits, 16));
          },
      peg$c129 = /^[0-9]/,
      peg$c130 = peg$classExpectation([["0", "9"]], false, false),
      peg$c131 = /^[0-9a-f]/i,
      peg$c132 = peg$classExpectation([["0", "9"], ["a", "f"]], false, true),
      peg$c133 = ".",
      peg$c134 = peg$literalExpectation(".", false),
      peg$c135 = function() { return { type: "any", location: location() }; },
      peg$c136 = peg$otherExpectation("code block"),
      peg$c137 = "{",
      peg$c138 = peg$literalExpectation("{", false),
      peg$c139 = "}",
      peg$c140 = peg$literalExpectation("}", false),
      peg$c141 = function(code) { return code; },
      peg$c142 = /^[{}]/,
      peg$c143 = peg$classExpectation(["{", "}"], false, false),
      peg$c144 = /^[a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137-\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148-\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C-\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA-\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9-\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC-\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF-\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F-\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0-\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB-\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE-\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6-\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FC7\u1FD0-\u1FD3\u1FD6-\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6-\u1FF7\u210A\u210E-\u210F\u2113\u212F\u2134\u2139\u213C-\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65-\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73-\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3-\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A]/,
      peg$c145 = peg$classExpectation([["a", "z"], "\xB5", ["\xDF", "\xF6"], ["\xF8", "\xFF"], "\u0101", "\u0103", "\u0105", "\u0107", "\u0109", "\u010B", "\u010D", "\u010F", "\u0111", "\u0113", "\u0115", "\u0117", "\u0119", "\u011B", "\u011D", "\u011F", "\u0121", "\u0123", "\u0125", "\u0127", "\u0129", "\u012B", "\u012D", "\u012F", "\u0131", "\u0133", "\u0135", ["\u0137", "\u0138"], "\u013A", "\u013C", "\u013E", "\u0140", "\u0142", "\u0144", "\u0146", ["\u0148", "\u0149"], "\u014B", "\u014D", "\u014F", "\u0151", "\u0153", "\u0155", "\u0157", "\u0159", "\u015B", "\u015D", "\u015F", "\u0161", "\u0163", "\u0165", "\u0167", "\u0169", "\u016B", "\u016D", "\u016F", "\u0171", "\u0173", "\u0175", "\u0177", "\u017A", "\u017C", ["\u017E", "\u0180"], "\u0183", "\u0185", "\u0188", ["\u018C", "\u018D"], "\u0192", "\u0195", ["\u0199", "\u019B"], "\u019E", "\u01A1", "\u01A3", "\u01A5", "\u01A8", ["\u01AA", "\u01AB"], "\u01AD", "\u01B0", "\u01B4", "\u01B6", ["\u01B9", "\u01BA"], ["\u01BD", "\u01BF"], "\u01C6", "\u01C9", "\u01CC", "\u01CE", "\u01D0", "\u01D2", "\u01D4", "\u01D6", "\u01D8", "\u01DA", ["\u01DC", "\u01DD"], "\u01DF", "\u01E1", "\u01E3", "\u01E5", "\u01E7", "\u01E9", "\u01EB", "\u01ED", ["\u01EF", "\u01F0"], "\u01F3", "\u01F5", "\u01F9", "\u01FB", "\u01FD", "\u01FF", "\u0201", "\u0203", "\u0205", "\u0207", "\u0209", "\u020B", "\u020D", "\u020F", "\u0211", "\u0213", "\u0215", "\u0217", "\u0219", "\u021B", "\u021D", "\u021F", "\u0221", "\u0223", "\u0225", "\u0227", "\u0229", "\u022B", "\u022D", "\u022F", "\u0231", ["\u0233", "\u0239"], "\u023C", ["\u023F", "\u0240"], "\u0242", "\u0247", "\u0249", "\u024B", "\u024D", ["\u024F", "\u0293"], ["\u0295", "\u02AF"], "\u0371", "\u0373", "\u0377", ["\u037B", "\u037D"], "\u0390", ["\u03AC", "\u03CE"], ["\u03D0", "\u03D1"], ["\u03D5", "\u03D7"], "\u03D9", "\u03DB", "\u03DD", "\u03DF", "\u03E1", "\u03E3", "\u03E5", "\u03E7", "\u03E9", "\u03EB", "\u03ED", ["\u03EF", "\u03F3"], "\u03F5", "\u03F8", ["\u03FB", "\u03FC"], ["\u0430", "\u045F"], "\u0461", "\u0463", "\u0465", "\u0467", "\u0469", "\u046B", "\u046D", "\u046F", "\u0471", "\u0473", "\u0475", "\u0477", "\u0479", "\u047B", "\u047D", "\u047F", "\u0481", "\u048B", "\u048D", "\u048F", "\u0491", "\u0493", "\u0495", "\u0497", "\u0499", "\u049B", "\u049D", "\u049F", "\u04A1", "\u04A3", "\u04A5", "\u04A7", "\u04A9", "\u04AB", "\u04AD", "\u04AF", "\u04B1", "\u04B3", "\u04B5", "\u04B7", "\u04B9", "\u04BB", "\u04BD", "\u04BF", "\u04C2", "\u04C4", "\u04C6", "\u04C8", "\u04CA", "\u04CC", ["\u04CE", "\u04CF"], "\u04D1", "\u04D3", "\u04D5", "\u04D7", "\u04D9", "\u04DB", "\u04DD", "\u04DF", "\u04E1", "\u04E3", "\u04E5", "\u04E7", "\u04E9", "\u04EB", "\u04ED", "\u04EF", "\u04F1", "\u04F3", "\u04F5", "\u04F7", "\u04F9", "\u04FB", "\u04FD", "\u04FF", "\u0501", "\u0503", "\u0505", "\u0507", "\u0509", "\u050B", "\u050D", "\u050F", "\u0511", "\u0513", "\u0515", "\u0517", "\u0519", "\u051B", "\u051D", "\u051F", "\u0521", "\u0523", "\u0525", "\u0527", "\u0529", "\u052B", "\u052D", "\u052F", ["\u0561", "\u0587"], ["\u13F8", "\u13FD"], ["\u1D00", "\u1D2B"], ["\u1D6B", "\u1D77"], ["\u1D79", "\u1D9A"], "\u1E01", "\u1E03", "\u1E05", "\u1E07", "\u1E09", "\u1E0B", "\u1E0D", "\u1E0F", "\u1E11", "\u1E13", "\u1E15", "\u1E17", "\u1E19", "\u1E1B", "\u1E1D", "\u1E1F", "\u1E21", "\u1E23", "\u1E25", "\u1E27", "\u1E29", "\u1E2B", "\u1E2D", "\u1E2F", "\u1E31", "\u1E33", "\u1E35", "\u1E37", "\u1E39", "\u1E3B", "\u1E3D", "\u1E3F", "\u1E41", "\u1E43", "\u1E45", "\u1E47", "\u1E49", "\u1E4B", "\u1E4D", "\u1E4F", "\u1E51", "\u1E53", "\u1E55", "\u1E57", "\u1E59", "\u1E5B", "\u1E5D", "\u1E5F", "\u1E61", "\u1E63", "\u1E65", "\u1E67", "\u1E69", "\u1E6B", "\u1E6D", "\u1E6F", "\u1E71", "\u1E73", "\u1E75", "\u1E77", "\u1E79", "\u1E7B", "\u1E7D", "\u1E7F", "\u1E81", "\u1E83", "\u1E85", "\u1E87", "\u1E89", "\u1E8B", "\u1E8D", "\u1E8F", "\u1E91", "\u1E93", ["\u1E95", "\u1E9D"], "\u1E9F", "\u1EA1", "\u1EA3", "\u1EA5", "\u1EA7", "\u1EA9", "\u1EAB", "\u1EAD", "\u1EAF", "\u1EB1", "\u1EB3", "\u1EB5", "\u1EB7", "\u1EB9", "\u1EBB", "\u1EBD", "\u1EBF", "\u1EC1", "\u1EC3", "\u1EC5", "\u1EC7", "\u1EC9", "\u1ECB", "\u1ECD", "\u1ECF", "\u1ED1", "\u1ED3", "\u1ED5", "\u1ED7", "\u1ED9", "\u1EDB", "\u1EDD", "\u1EDF", "\u1EE1", "\u1EE3", "\u1EE5", "\u1EE7", "\u1EE9", "\u1EEB", "\u1EED", "\u1EEF", "\u1EF1", "\u1EF3", "\u1EF5", "\u1EF7", "\u1EF9", "\u1EFB", "\u1EFD", ["\u1EFF", "\u1F07"], ["\u1F10", "\u1F15"], ["\u1F20", "\u1F27"], ["\u1F30", "\u1F37"], ["\u1F40", "\u1F45"], ["\u1F50", "\u1F57"], ["\u1F60", "\u1F67"], ["\u1F70", "\u1F7D"], ["\u1F80", "\u1F87"], ["\u1F90", "\u1F97"], ["\u1FA0", "\u1FA7"], ["\u1FB0", "\u1FB4"], ["\u1FB6", "\u1FB7"], "\u1FBE", ["\u1FC2", "\u1FC4"], ["\u1FC6", "\u1FC7"], ["\u1FD0", "\u1FD3"], ["\u1FD6", "\u1FD7"], ["\u1FE0", "\u1FE7"], ["\u1FF2", "\u1FF4"], ["\u1FF6", "\u1FF7"], "\u210A", ["\u210E", "\u210F"], "\u2113", "\u212F", "\u2134", "\u2139", ["\u213C", "\u213D"], ["\u2146", "\u2149"], "\u214E", "\u2184", ["\u2C30", "\u2C5E"], "\u2C61", ["\u2C65", "\u2C66"], "\u2C68", "\u2C6A", "\u2C6C", "\u2C71", ["\u2C73", "\u2C74"], ["\u2C76", "\u2C7B"], "\u2C81", "\u2C83", "\u2C85", "\u2C87", "\u2C89", "\u2C8B", "\u2C8D", "\u2C8F", "\u2C91", "\u2C93", "\u2C95", "\u2C97", "\u2C99", "\u2C9B", "\u2C9D", "\u2C9F", "\u2CA1", "\u2CA3", "\u2CA5", "\u2CA7", "\u2CA9", "\u2CAB", "\u2CAD", "\u2CAF", "\u2CB1", "\u2CB3", "\u2CB5", "\u2CB7", "\u2CB9", "\u2CBB", "\u2CBD", "\u2CBF", "\u2CC1", "\u2CC3", "\u2CC5", "\u2CC7", "\u2CC9", "\u2CCB", "\u2CCD", "\u2CCF", "\u2CD1", "\u2CD3", "\u2CD5", "\u2CD7", "\u2CD9", "\u2CDB", "\u2CDD", "\u2CDF", "\u2CE1", ["\u2CE3", "\u2CE4"], "\u2CEC", "\u2CEE", "\u2CF3", ["\u2D00", "\u2D25"], "\u2D27", "\u2D2D", "\uA641", "\uA643", "\uA645", "\uA647", "\uA649", "\uA64B", "\uA64D", "\uA64F", "\uA651", "\uA653", "\uA655", "\uA657", "\uA659", "\uA65B", "\uA65D", "\uA65F", "\uA661", "\uA663", "\uA665", "\uA667", "\uA669", "\uA66B", "\uA66D", "\uA681", "\uA683", "\uA685", "\uA687", "\uA689", "\uA68B", "\uA68D", "\uA68F", "\uA691", "\uA693", "\uA695", "\uA697", "\uA699", "\uA69B", "\uA723", "\uA725", "\uA727", "\uA729", "\uA72B", "\uA72D", ["\uA72F", "\uA731"], "\uA733", "\uA735", "\uA737", "\uA739", "\uA73B", "\uA73D", "\uA73F", "\uA741", "\uA743", "\uA745", "\uA747", "\uA749", "\uA74B", "\uA74D", "\uA74F", "\uA751", "\uA753", "\uA755", "\uA757", "\uA759", "\uA75B", "\uA75D", "\uA75F", "\uA761", "\uA763", "\uA765", "\uA767", "\uA769", "\uA76B", "\uA76D", "\uA76F", ["\uA771", "\uA778"], "\uA77A", "\uA77C", "\uA77F", "\uA781", "\uA783", "\uA785", "\uA787", "\uA78C", "\uA78E", "\uA791", ["\uA793", "\uA795"], "\uA797", "\uA799", "\uA79B", "\uA79D", "\uA79F", "\uA7A1", "\uA7A3", "\uA7A5", "\uA7A7", "\uA7A9", "\uA7B5", "\uA7B7", "\uA7FA", ["\uAB30", "\uAB5A"], ["\uAB60", "\uAB65"], ["\uAB70", "\uABBF"], ["\uFB00", "\uFB06"], ["\uFB13", "\uFB17"], ["\uFF41", "\uFF5A"]], false, false),
      peg$c146 = /^[\u02B0-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0374\u037A\u0559\u0640\u06E5-\u06E6\u07F4-\u07F5\u07FA\u081A\u0824\u0828\u0971\u0E46\u0EC6\u10FC\u17D7\u1843\u1AA7\u1C78-\u1C7D\u1D2C-\u1D6A\u1D78\u1D9B-\u1DBF\u2071\u207F\u2090-\u209C\u2C7C-\u2C7D\u2D6F\u2E2F\u3005\u3031-\u3035\u303B\u309D-\u309E\u30FC-\u30FE\uA015\uA4F8-\uA4FD\uA60C\uA67F\uA69C-\uA69D\uA717-\uA71F\uA770\uA788\uA7F8-\uA7F9\uA9CF\uA9E6\uAA70\uAADD\uAAF3-\uAAF4\uAB5C-\uAB5F\uFF70\uFF9E-\uFF9F]/,
      peg$c147 = peg$classExpectation([["\u02B0", "\u02C1"], ["\u02C6", "\u02D1"], ["\u02E0", "\u02E4"], "\u02EC", "\u02EE", "\u0374", "\u037A", "\u0559", "\u0640", ["\u06E5", "\u06E6"], ["\u07F4", "\u07F5"], "\u07FA", "\u081A", "\u0824", "\u0828", "\u0971", "\u0E46", "\u0EC6", "\u10FC", "\u17D7", "\u1843", "\u1AA7", ["\u1C78", "\u1C7D"], ["\u1D2C", "\u1D6A"], "\u1D78", ["\u1D9B", "\u1DBF"], "\u2071", "\u207F", ["\u2090", "\u209C"], ["\u2C7C", "\u2C7D"], "\u2D6F", "\u2E2F", "\u3005", ["\u3031", "\u3035"], "\u303B", ["\u309D", "\u309E"], ["\u30FC", "\u30FE"], "\uA015", ["\uA4F8", "\uA4FD"], "\uA60C", "\uA67F", ["\uA69C", "\uA69D"], ["\uA717", "\uA71F"], "\uA770", "\uA788", ["\uA7F8", "\uA7F9"], "\uA9CF", "\uA9E6", "\uAA70", "\uAADD", ["\uAAF3", "\uAAF4"], ["\uAB5C", "\uAB5F"], "\uFF70", ["\uFF9E", "\uFF9F"]], false, false),
      peg$c148 = /^[\xAA\xBA\u01BB\u01C0-\u01C3\u0294\u05D0-\u05EA\u05F0-\u05F2\u0620-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06EE-\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u0800-\u0815\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0972-\u0980\u0985-\u098C\u098F-\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC-\u09DD\u09DF-\u09E1\u09F0-\u09F1\u0A05-\u0A0A\u0A0F-\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32-\u0A33\u0A35-\u0A36\u0A38-\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2-\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0-\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F-\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32-\u0B33\u0B35-\u0B39\u0B3D\u0B5C-\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99-\u0B9A\u0B9C\u0B9E-\u0B9F\u0BA3-\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60-\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0-\u0CE1\u0CF1-\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32-\u0E33\u0E40-\u0E45\u0E81-\u0E82\u0E84\u0E87-\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA-\u0EAB\u0EAD-\u0EB0\u0EB2-\u0EB3\u0EBD\u0EC0-\u0EC4\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065-\u1066\u106E-\u1070\u1075-\u1081\u108E\u10D0-\u10FA\u10FD-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17DC\u1820-\u1842\u1844-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE-\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C77\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5-\u1CF6\u2135-\u2138\u2D30-\u2D67\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3006\u303C\u3041-\u3096\u309F\u30A1-\u30FA\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA014\uA016-\uA48C\uA4D0-\uA4F7\uA500-\uA60B\uA610-\uA61F\uA62A-\uA62B\uA66E\uA6A0-\uA6E5\uA78F\uA7F7\uA7FB-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9E0-\uA9E4\uA9E7-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA6F\uAA71-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5-\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADC\uAAE0-\uAAEA\uAAF2\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40-\uFB41\uFB43-\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF66-\uFF6F\uFF71-\uFF9D\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
      peg$c149 = peg$classExpectation(["\xAA", "\xBA", "\u01BB", ["\u01C0", "\u01C3"], "\u0294", ["\u05D0", "\u05EA"], ["\u05F0", "\u05F2"], ["\u0620", "\u063F"], ["\u0641", "\u064A"], ["\u066E", "\u066F"], ["\u0671", "\u06D3"], "\u06D5", ["\u06EE", "\u06EF"], ["\u06FA", "\u06FC"], "\u06FF", "\u0710", ["\u0712", "\u072F"], ["\u074D", "\u07A5"], "\u07B1", ["\u07CA", "\u07EA"], ["\u0800", "\u0815"], ["\u0840", "\u0858"], ["\u08A0", "\u08B4"], ["\u0904", "\u0939"], "\u093D", "\u0950", ["\u0958", "\u0961"], ["\u0972", "\u0980"], ["\u0985", "\u098C"], ["\u098F", "\u0990"], ["\u0993", "\u09A8"], ["\u09AA", "\u09B0"], "\u09B2", ["\u09B6", "\u09B9"], "\u09BD", "\u09CE", ["\u09DC", "\u09DD"], ["\u09DF", "\u09E1"], ["\u09F0", "\u09F1"], ["\u0A05", "\u0A0A"], ["\u0A0F", "\u0A10"], ["\u0A13", "\u0A28"], ["\u0A2A", "\u0A30"], ["\u0A32", "\u0A33"], ["\u0A35", "\u0A36"], ["\u0A38", "\u0A39"], ["\u0A59", "\u0A5C"], "\u0A5E", ["\u0A72", "\u0A74"], ["\u0A85", "\u0A8D"], ["\u0A8F", "\u0A91"], ["\u0A93", "\u0AA8"], ["\u0AAA", "\u0AB0"], ["\u0AB2", "\u0AB3"], ["\u0AB5", "\u0AB9"], "\u0ABD", "\u0AD0", ["\u0AE0", "\u0AE1"], "\u0AF9", ["\u0B05", "\u0B0C"], ["\u0B0F", "\u0B10"], ["\u0B13", "\u0B28"], ["\u0B2A", "\u0B30"], ["\u0B32", "\u0B33"], ["\u0B35", "\u0B39"], "\u0B3D", ["\u0B5C", "\u0B5D"], ["\u0B5F", "\u0B61"], "\u0B71", "\u0B83", ["\u0B85", "\u0B8A"], ["\u0B8E", "\u0B90"], ["\u0B92", "\u0B95"], ["\u0B99", "\u0B9A"], "\u0B9C", ["\u0B9E", "\u0B9F"], ["\u0BA3", "\u0BA4"], ["\u0BA8", "\u0BAA"], ["\u0BAE", "\u0BB9"], "\u0BD0", ["\u0C05", "\u0C0C"], ["\u0C0E", "\u0C10"], ["\u0C12", "\u0C28"], ["\u0C2A", "\u0C39"], "\u0C3D", ["\u0C58", "\u0C5A"], ["\u0C60", "\u0C61"], ["\u0C85", "\u0C8C"], ["\u0C8E", "\u0C90"], ["\u0C92", "\u0CA8"], ["\u0CAA", "\u0CB3"], ["\u0CB5", "\u0CB9"], "\u0CBD", "\u0CDE", ["\u0CE0", "\u0CE1"], ["\u0CF1", "\u0CF2"], ["\u0D05", "\u0D0C"], ["\u0D0E", "\u0D10"], ["\u0D12", "\u0D3A"], "\u0D3D", "\u0D4E", ["\u0D5F", "\u0D61"], ["\u0D7A", "\u0D7F"], ["\u0D85", "\u0D96"], ["\u0D9A", "\u0DB1"], ["\u0DB3", "\u0DBB"], "\u0DBD", ["\u0DC0", "\u0DC6"], ["\u0E01", "\u0E30"], ["\u0E32", "\u0E33"], ["\u0E40", "\u0E45"], ["\u0E81", "\u0E82"], "\u0E84", ["\u0E87", "\u0E88"], "\u0E8A", "\u0E8D", ["\u0E94", "\u0E97"], ["\u0E99", "\u0E9F"], ["\u0EA1", "\u0EA3"], "\u0EA5", "\u0EA7", ["\u0EAA", "\u0EAB"], ["\u0EAD", "\u0EB0"], ["\u0EB2", "\u0EB3"], "\u0EBD", ["\u0EC0", "\u0EC4"], ["\u0EDC", "\u0EDF"], "\u0F00", ["\u0F40", "\u0F47"], ["\u0F49", "\u0F6C"], ["\u0F88", "\u0F8C"], ["\u1000", "\u102A"], "\u103F", ["\u1050", "\u1055"], ["\u105A", "\u105D"], "\u1061", ["\u1065", "\u1066"], ["\u106E", "\u1070"], ["\u1075", "\u1081"], "\u108E", ["\u10D0", "\u10FA"], ["\u10FD", "\u1248"], ["\u124A", "\u124D"], ["\u1250", "\u1256"], "\u1258", ["\u125A", "\u125D"], ["\u1260", "\u1288"], ["\u128A", "\u128D"], ["\u1290", "\u12B0"], ["\u12B2", "\u12B5"], ["\u12B8", "\u12BE"], "\u12C0", ["\u12C2", "\u12C5"], ["\u12C8", "\u12D6"], ["\u12D8", "\u1310"], ["\u1312", "\u1315"], ["\u1318", "\u135A"], ["\u1380", "\u138F"], ["\u1401", "\u166C"], ["\u166F", "\u167F"], ["\u1681", "\u169A"], ["\u16A0", "\u16EA"], ["\u16F1", "\u16F8"], ["\u1700", "\u170C"], ["\u170E", "\u1711"], ["\u1720", "\u1731"], ["\u1740", "\u1751"], ["\u1760", "\u176C"], ["\u176E", "\u1770"], ["\u1780", "\u17B3"], "\u17DC", ["\u1820", "\u1842"], ["\u1844", "\u1877"], ["\u1880", "\u18A8"], "\u18AA", ["\u18B0", "\u18F5"], ["\u1900", "\u191E"], ["\u1950", "\u196D"], ["\u1970", "\u1974"], ["\u1980", "\u19AB"], ["\u19B0", "\u19C9"], ["\u1A00", "\u1A16"], ["\u1A20", "\u1A54"], ["\u1B05", "\u1B33"], ["\u1B45", "\u1B4B"], ["\u1B83", "\u1BA0"], ["\u1BAE", "\u1BAF"], ["\u1BBA", "\u1BE5"], ["\u1C00", "\u1C23"], ["\u1C4D", "\u1C4F"], ["\u1C5A", "\u1C77"], ["\u1CE9", "\u1CEC"], ["\u1CEE", "\u1CF1"], ["\u1CF5", "\u1CF6"], ["\u2135", "\u2138"], ["\u2D30", "\u2D67"], ["\u2D80", "\u2D96"], ["\u2DA0", "\u2DA6"], ["\u2DA8", "\u2DAE"], ["\u2DB0", "\u2DB6"], ["\u2DB8", "\u2DBE"], ["\u2DC0", "\u2DC6"], ["\u2DC8", "\u2DCE"], ["\u2DD0", "\u2DD6"], ["\u2DD8", "\u2DDE"], "\u3006", "\u303C", ["\u3041", "\u3096"], "\u309F", ["\u30A1", "\u30FA"], "\u30FF", ["\u3105", "\u312D"], ["\u3131", "\u318E"], ["\u31A0", "\u31BA"], ["\u31F0", "\u31FF"], ["\u3400", "\u4DB5"], ["\u4E00", "\u9FD5"], ["\uA000", "\uA014"], ["\uA016", "\uA48C"], ["\uA4D0", "\uA4F7"], ["\uA500", "\uA60B"], ["\uA610", "\uA61F"], ["\uA62A", "\uA62B"], "\uA66E", ["\uA6A0", "\uA6E5"], "\uA78F", "\uA7F7", ["\uA7FB", "\uA801"], ["\uA803", "\uA805"], ["\uA807", "\uA80A"], ["\uA80C", "\uA822"], ["\uA840", "\uA873"], ["\uA882", "\uA8B3"], ["\uA8F2", "\uA8F7"], "\uA8FB", "\uA8FD", ["\uA90A", "\uA925"], ["\uA930", "\uA946"], ["\uA960", "\uA97C"], ["\uA984", "\uA9B2"], ["\uA9E0", "\uA9E4"], ["\uA9E7", "\uA9EF"], ["\uA9FA", "\uA9FE"], ["\uAA00", "\uAA28"], ["\uAA40", "\uAA42"], ["\uAA44", "\uAA4B"], ["\uAA60", "\uAA6F"], ["\uAA71", "\uAA76"], "\uAA7A", ["\uAA7E", "\uAAAF"], "\uAAB1", ["\uAAB5", "\uAAB6"], ["\uAAB9", "\uAABD"], "\uAAC0", "\uAAC2", ["\uAADB", "\uAADC"], ["\uAAE0", "\uAAEA"], "\uAAF2", ["\uAB01", "\uAB06"], ["\uAB09", "\uAB0E"], ["\uAB11", "\uAB16"], ["\uAB20", "\uAB26"], ["\uAB28", "\uAB2E"], ["\uABC0", "\uABE2"], ["\uAC00", "\uD7A3"], ["\uD7B0", "\uD7C6"], ["\uD7CB", "\uD7FB"], ["\uF900", "\uFA6D"], ["\uFA70", "\uFAD9"], "\uFB1D", ["\uFB1F", "\uFB28"], ["\uFB2A", "\uFB36"], ["\uFB38", "\uFB3C"], "\uFB3E", ["\uFB40", "\uFB41"], ["\uFB43", "\uFB44"], ["\uFB46", "\uFBB1"], ["\uFBD3", "\uFD3D"], ["\uFD50", "\uFD8F"], ["\uFD92", "\uFDC7"], ["\uFDF0", "\uFDFB"], ["\uFE70", "\uFE74"], ["\uFE76", "\uFEFC"], ["\uFF66", "\uFF6F"], ["\uFF71", "\uFF9D"], ["\uFFA0", "\uFFBE"], ["\uFFC2", "\uFFC7"], ["\uFFCA", "\uFFCF"], ["\uFFD2", "\uFFD7"], ["\uFFDA", "\uFFDC"]], false, false),
      peg$c150 = /^[\u01C5\u01C8\u01CB\u01F2\u1F88-\u1F8F\u1F98-\u1F9F\u1FA8-\u1FAF\u1FBC\u1FCC\u1FFC]/,
      peg$c151 = peg$classExpectation(["\u01C5", "\u01C8", "\u01CB", "\u01F2", ["\u1F88", "\u1F8F"], ["\u1F98", "\u1F9F"], ["\u1FA8", "\u1FAF"], "\u1FBC", "\u1FCC", "\u1FFC"], false, false),
      peg$c152 = /^[A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178-\u0179\u017B\u017D\u0181-\u0182\u0184\u0186-\u0187\u0189-\u018B\u018E-\u0191\u0193-\u0194\u0196-\u0198\u019C-\u019D\u019F-\u01A0\u01A2\u01A4\u01A6-\u01A7\u01A9\u01AC\u01AE-\u01AF\u01B1-\u01B3\u01B5\u01B7-\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A-\u023B\u023D-\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E-\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9-\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0-\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E-\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D-\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A]/,
      peg$c153 = peg$classExpectation([["A", "Z"], ["\xC0", "\xD6"], ["\xD8", "\xDE"], "\u0100", "\u0102", "\u0104", "\u0106", "\u0108", "\u010A", "\u010C", "\u010E", "\u0110", "\u0112", "\u0114", "\u0116", "\u0118", "\u011A", "\u011C", "\u011E", "\u0120", "\u0122", "\u0124", "\u0126", "\u0128", "\u012A", "\u012C", "\u012E", "\u0130", "\u0132", "\u0134", "\u0136", "\u0139", "\u013B", "\u013D", "\u013F", "\u0141", "\u0143", "\u0145", "\u0147", "\u014A", "\u014C", "\u014E", "\u0150", "\u0152", "\u0154", "\u0156", "\u0158", "\u015A", "\u015C", "\u015E", "\u0160", "\u0162", "\u0164", "\u0166", "\u0168", "\u016A", "\u016C", "\u016E", "\u0170", "\u0172", "\u0174", "\u0176", ["\u0178", "\u0179"], "\u017B", "\u017D", ["\u0181", "\u0182"], "\u0184", ["\u0186", "\u0187"], ["\u0189", "\u018B"], ["\u018E", "\u0191"], ["\u0193", "\u0194"], ["\u0196", "\u0198"], ["\u019C", "\u019D"], ["\u019F", "\u01A0"], "\u01A2", "\u01A4", ["\u01A6", "\u01A7"], "\u01A9", "\u01AC", ["\u01AE", "\u01AF"], ["\u01B1", "\u01B3"], "\u01B5", ["\u01B7", "\u01B8"], "\u01BC", "\u01C4", "\u01C7", "\u01CA", "\u01CD", "\u01CF", "\u01D1", "\u01D3", "\u01D5", "\u01D7", "\u01D9", "\u01DB", "\u01DE", "\u01E0", "\u01E2", "\u01E4", "\u01E6", "\u01E8", "\u01EA", "\u01EC", "\u01EE", "\u01F1", "\u01F4", ["\u01F6", "\u01F8"], "\u01FA", "\u01FC", "\u01FE", "\u0200", "\u0202", "\u0204", "\u0206", "\u0208", "\u020A", "\u020C", "\u020E", "\u0210", "\u0212", "\u0214", "\u0216", "\u0218", "\u021A", "\u021C", "\u021E", "\u0220", "\u0222", "\u0224", "\u0226", "\u0228", "\u022A", "\u022C", "\u022E", "\u0230", "\u0232", ["\u023A", "\u023B"], ["\u023D", "\u023E"], "\u0241", ["\u0243", "\u0246"], "\u0248", "\u024A", "\u024C", "\u024E", "\u0370", "\u0372", "\u0376", "\u037F", "\u0386", ["\u0388", "\u038A"], "\u038C", ["\u038E", "\u038F"], ["\u0391", "\u03A1"], ["\u03A3", "\u03AB"], "\u03CF", ["\u03D2", "\u03D4"], "\u03D8", "\u03DA", "\u03DC", "\u03DE", "\u03E0", "\u03E2", "\u03E4", "\u03E6", "\u03E8", "\u03EA", "\u03EC", "\u03EE", "\u03F4", "\u03F7", ["\u03F9", "\u03FA"], ["\u03FD", "\u042F"], "\u0460", "\u0462", "\u0464", "\u0466", "\u0468", "\u046A", "\u046C", "\u046E", "\u0470", "\u0472", "\u0474", "\u0476", "\u0478", "\u047A", "\u047C", "\u047E", "\u0480", "\u048A", "\u048C", "\u048E", "\u0490", "\u0492", "\u0494", "\u0496", "\u0498", "\u049A", "\u049C", "\u049E", "\u04A0", "\u04A2", "\u04A4", "\u04A6", "\u04A8", "\u04AA", "\u04AC", "\u04AE", "\u04B0", "\u04B2", "\u04B4", "\u04B6", "\u04B8", "\u04BA", "\u04BC", "\u04BE", ["\u04C0", "\u04C1"], "\u04C3", "\u04C5", "\u04C7", "\u04C9", "\u04CB", "\u04CD", "\u04D0", "\u04D2", "\u04D4", "\u04D6", "\u04D8", "\u04DA", "\u04DC", "\u04DE", "\u04E0", "\u04E2", "\u04E4", "\u04E6", "\u04E8", "\u04EA", "\u04EC", "\u04EE", "\u04F0", "\u04F2", "\u04F4", "\u04F6", "\u04F8", "\u04FA", "\u04FC", "\u04FE", "\u0500", "\u0502", "\u0504", "\u0506", "\u0508", "\u050A", "\u050C", "\u050E", "\u0510", "\u0512", "\u0514", "\u0516", "\u0518", "\u051A", "\u051C", "\u051E", "\u0520", "\u0522", "\u0524", "\u0526", "\u0528", "\u052A", "\u052C", "\u052E", ["\u0531", "\u0556"], ["\u10A0", "\u10C5"], "\u10C7", "\u10CD", ["\u13A0", "\u13F5"], "\u1E00", "\u1E02", "\u1E04", "\u1E06", "\u1E08", "\u1E0A", "\u1E0C", "\u1E0E", "\u1E10", "\u1E12", "\u1E14", "\u1E16", "\u1E18", "\u1E1A", "\u1E1C", "\u1E1E", "\u1E20", "\u1E22", "\u1E24", "\u1E26", "\u1E28", "\u1E2A", "\u1E2C", "\u1E2E", "\u1E30", "\u1E32", "\u1E34", "\u1E36", "\u1E38", "\u1E3A", "\u1E3C", "\u1E3E", "\u1E40", "\u1E42", "\u1E44", "\u1E46", "\u1E48", "\u1E4A", "\u1E4C", "\u1E4E", "\u1E50", "\u1E52", "\u1E54", "\u1E56", "\u1E58", "\u1E5A", "\u1E5C", "\u1E5E", "\u1E60", "\u1E62", "\u1E64", "\u1E66", "\u1E68", "\u1E6A", "\u1E6C", "\u1E6E", "\u1E70", "\u1E72", "\u1E74", "\u1E76", "\u1E78", "\u1E7A", "\u1E7C", "\u1E7E", "\u1E80", "\u1E82", "\u1E84", "\u1E86", "\u1E88", "\u1E8A", "\u1E8C", "\u1E8E", "\u1E90", "\u1E92", "\u1E94", "\u1E9E", "\u1EA0", "\u1EA2", "\u1EA4", "\u1EA6", "\u1EA8", "\u1EAA", "\u1EAC", "\u1EAE", "\u1EB0", "\u1EB2", "\u1EB4", "\u1EB6", "\u1EB8", "\u1EBA", "\u1EBC", "\u1EBE", "\u1EC0", "\u1EC2", "\u1EC4", "\u1EC6", "\u1EC8", "\u1ECA", "\u1ECC", "\u1ECE", "\u1ED0", "\u1ED2", "\u1ED4", "\u1ED6", "\u1ED8", "\u1EDA", "\u1EDC", "\u1EDE", "\u1EE0", "\u1EE2", "\u1EE4", "\u1EE6", "\u1EE8", "\u1EEA", "\u1EEC", "\u1EEE", "\u1EF0", "\u1EF2", "\u1EF4", "\u1EF6", "\u1EF8", "\u1EFA", "\u1EFC", "\u1EFE", ["\u1F08", "\u1F0F"], ["\u1F18", "\u1F1D"], ["\u1F28", "\u1F2F"], ["\u1F38", "\u1F3F"], ["\u1F48", "\u1F4D"], "\u1F59", "\u1F5B", "\u1F5D", "\u1F5F", ["\u1F68", "\u1F6F"], ["\u1FB8", "\u1FBB"], ["\u1FC8", "\u1FCB"], ["\u1FD8", "\u1FDB"], ["\u1FE8", "\u1FEC"], ["\u1FF8", "\u1FFB"], "\u2102", "\u2107", ["\u210B", "\u210D"], ["\u2110", "\u2112"], "\u2115", ["\u2119", "\u211D"], "\u2124", "\u2126", "\u2128", ["\u212A", "\u212D"], ["\u2130", "\u2133"], ["\u213E", "\u213F"], "\u2145", "\u2183", ["\u2C00", "\u2C2E"], "\u2C60", ["\u2C62", "\u2C64"], "\u2C67", "\u2C69", "\u2C6B", ["\u2C6D", "\u2C70"], "\u2C72", "\u2C75", ["\u2C7E", "\u2C80"], "\u2C82", "\u2C84", "\u2C86", "\u2C88", "\u2C8A", "\u2C8C", "\u2C8E", "\u2C90", "\u2C92", "\u2C94", "\u2C96", "\u2C98", "\u2C9A", "\u2C9C", "\u2C9E", "\u2CA0", "\u2CA2", "\u2CA4", "\u2CA6", "\u2CA8", "\u2CAA", "\u2CAC", "\u2CAE", "\u2CB0", "\u2CB2", "\u2CB4", "\u2CB6", "\u2CB8", "\u2CBA", "\u2CBC", "\u2CBE", "\u2CC0", "\u2CC2", "\u2CC4", "\u2CC6", "\u2CC8", "\u2CCA", "\u2CCC", "\u2CCE", "\u2CD0", "\u2CD2", "\u2CD4", "\u2CD6", "\u2CD8", "\u2CDA", "\u2CDC", "\u2CDE", "\u2CE0", "\u2CE2", "\u2CEB", "\u2CED", "\u2CF2", "\uA640", "\uA642", "\uA644", "\uA646", "\uA648", "\uA64A", "\uA64C", "\uA64E", "\uA650", "\uA652", "\uA654", "\uA656", "\uA658", "\uA65A", "\uA65C", "\uA65E", "\uA660", "\uA662", "\uA664", "\uA666", "\uA668", "\uA66A", "\uA66C", "\uA680", "\uA682", "\uA684", "\uA686", "\uA688", "\uA68A", "\uA68C", "\uA68E", "\uA690", "\uA692", "\uA694", "\uA696", "\uA698", "\uA69A", "\uA722", "\uA724", "\uA726", "\uA728", "\uA72A", "\uA72C", "\uA72E", "\uA732", "\uA734", "\uA736", "\uA738", "\uA73A", "\uA73C", "\uA73E", "\uA740", "\uA742", "\uA744", "\uA746", "\uA748", "\uA74A", "\uA74C", "\uA74E", "\uA750", "\uA752", "\uA754", "\uA756", "\uA758", "\uA75A", "\uA75C", "\uA75E", "\uA760", "\uA762", "\uA764", "\uA766", "\uA768", "\uA76A", "\uA76C", "\uA76E", "\uA779", "\uA77B", ["\uA77D", "\uA77E"], "\uA780", "\uA782", "\uA784", "\uA786", "\uA78B", "\uA78D", "\uA790", "\uA792", "\uA796", "\uA798", "\uA79A", "\uA79C", "\uA79E", "\uA7A0", "\uA7A2", "\uA7A4", "\uA7A6", "\uA7A8", ["\uA7AA", "\uA7AD"], ["\uA7B0", "\uA7B4"], "\uA7B6", ["\uFF21", "\uFF3A"]], false, false),
      peg$c154 = /^[\u0903\u093B\u093E-\u0940\u0949-\u094C\u094E-\u094F\u0982-\u0983\u09BE-\u09C0\u09C7-\u09C8\u09CB-\u09CC\u09D7\u0A03\u0A3E-\u0A40\u0A83\u0ABE-\u0AC0\u0AC9\u0ACB-\u0ACC\u0B02-\u0B03\u0B3E\u0B40\u0B47-\u0B48\u0B4B-\u0B4C\u0B57\u0BBE-\u0BBF\u0BC1-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD7\u0C01-\u0C03\u0C41-\u0C44\u0C82-\u0C83\u0CBE\u0CC0-\u0CC4\u0CC7-\u0CC8\u0CCA-\u0CCB\u0CD5-\u0CD6\u0D02-\u0D03\u0D3E-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D57\u0D82-\u0D83\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DF2-\u0DF3\u0F3E-\u0F3F\u0F7F\u102B-\u102C\u1031\u1038\u103B-\u103C\u1056-\u1057\u1062-\u1064\u1067-\u106D\u1083-\u1084\u1087-\u108C\u108F\u109A-\u109C\u17B6\u17BE-\u17C5\u17C7-\u17C8\u1923-\u1926\u1929-\u192B\u1930-\u1931\u1933-\u1938\u1A19-\u1A1A\u1A55\u1A57\u1A61\u1A63-\u1A64\u1A6D-\u1A72\u1B04\u1B35\u1B3B\u1B3D-\u1B41\u1B43-\u1B44\u1B82\u1BA1\u1BA6-\u1BA7\u1BAA\u1BE7\u1BEA-\u1BEC\u1BEE\u1BF2-\u1BF3\u1C24-\u1C2B\u1C34-\u1C35\u1CE1\u1CF2-\u1CF3\u302E-\u302F\uA823-\uA824\uA827\uA880-\uA881\uA8B4-\uA8C3\uA952-\uA953\uA983\uA9B4-\uA9B5\uA9BA-\uA9BB\uA9BD-\uA9C0\uAA2F-\uAA30\uAA33-\uAA34\uAA4D\uAA7B\uAA7D\uAAEB\uAAEE-\uAAEF\uAAF5\uABE3-\uABE4\uABE6-\uABE7\uABE9-\uABEA\uABEC]/,
      peg$c155 = peg$classExpectation(["\u0903", "\u093B", ["\u093E", "\u0940"], ["\u0949", "\u094C"], ["\u094E", "\u094F"], ["\u0982", "\u0983"], ["\u09BE", "\u09C0"], ["\u09C7", "\u09C8"], ["\u09CB", "\u09CC"], "\u09D7", "\u0A03", ["\u0A3E", "\u0A40"], "\u0A83", ["\u0ABE", "\u0AC0"], "\u0AC9", ["\u0ACB", "\u0ACC"], ["\u0B02", "\u0B03"], "\u0B3E", "\u0B40", ["\u0B47", "\u0B48"], ["\u0B4B", "\u0B4C"], "\u0B57", ["\u0BBE", "\u0BBF"], ["\u0BC1", "\u0BC2"], ["\u0BC6", "\u0BC8"], ["\u0BCA", "\u0BCC"], "\u0BD7", ["\u0C01", "\u0C03"], ["\u0C41", "\u0C44"], ["\u0C82", "\u0C83"], "\u0CBE", ["\u0CC0", "\u0CC4"], ["\u0CC7", "\u0CC8"], ["\u0CCA", "\u0CCB"], ["\u0CD5", "\u0CD6"], ["\u0D02", "\u0D03"], ["\u0D3E", "\u0D40"], ["\u0D46", "\u0D48"], ["\u0D4A", "\u0D4C"], "\u0D57", ["\u0D82", "\u0D83"], ["\u0DCF", "\u0DD1"], ["\u0DD8", "\u0DDF"], ["\u0DF2", "\u0DF3"], ["\u0F3E", "\u0F3F"], "\u0F7F", ["\u102B", "\u102C"], "\u1031", "\u1038", ["\u103B", "\u103C"], ["\u1056", "\u1057"], ["\u1062", "\u1064"], ["\u1067", "\u106D"], ["\u1083", "\u1084"], ["\u1087", "\u108C"], "\u108F", ["\u109A", "\u109C"], "\u17B6", ["\u17BE", "\u17C5"], ["\u17C7", "\u17C8"], ["\u1923", "\u1926"], ["\u1929", "\u192B"], ["\u1930", "\u1931"], ["\u1933", "\u1938"], ["\u1A19", "\u1A1A"], "\u1A55", "\u1A57", "\u1A61", ["\u1A63", "\u1A64"], ["\u1A6D", "\u1A72"], "\u1B04", "\u1B35", "\u1B3B", ["\u1B3D", "\u1B41"], ["\u1B43", "\u1B44"], "\u1B82", "\u1BA1", ["\u1BA6", "\u1BA7"], "\u1BAA", "\u1BE7", ["\u1BEA", "\u1BEC"], "\u1BEE", ["\u1BF2", "\u1BF3"], ["\u1C24", "\u1C2B"], ["\u1C34", "\u1C35"], "\u1CE1", ["\u1CF2", "\u1CF3"], ["\u302E", "\u302F"], ["\uA823", "\uA824"], "\uA827", ["\uA880", "\uA881"], ["\uA8B4", "\uA8C3"], ["\uA952", "\uA953"], "\uA983", ["\uA9B4", "\uA9B5"], ["\uA9BA", "\uA9BB"], ["\uA9BD", "\uA9C0"], ["\uAA2F", "\uAA30"], ["\uAA33", "\uAA34"], "\uAA4D", "\uAA7B", "\uAA7D", "\uAAEB", ["\uAAEE", "\uAAEF"], "\uAAF5", ["\uABE3", "\uABE4"], ["\uABE6", "\uABE7"], ["\uABE9", "\uABEA"], "\uABEC"], false, false),
      peg$c156 = /^[\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962-\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2-\u09E3\u0A01-\u0A02\u0A3C\u0A41-\u0A42\u0A47-\u0A48\u0A4B-\u0A4D\u0A51\u0A70-\u0A71\u0A75\u0A81-\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7-\u0AC8\u0ACD\u0AE2-\u0AE3\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B56\u0B62-\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55-\u0C56\u0C62-\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC-\u0CCD\u0CE2-\u0CE3\u0D01\u0D41-\u0D44\u0D4D\u0D62-\u0D63\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB-\u0EBC\u0EC8-\u0ECD\u0F18-\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86-\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039-\u103A\u103D-\u103E\u1058-\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085-\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752-\u1753\u1772-\u1773\u17B4-\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u1922\u1927-\u1928\u1932\u1939-\u193B\u1A17-\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80-\u1B81\u1BA2-\u1BA5\u1BA8-\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8-\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8-\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099-\u309A\uA66F\uA674-\uA67D\uA69E-\uA69F\uA6F0-\uA6F1\uA802\uA806\uA80B\uA825-\uA826\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9E5\uAA29-\uAA2E\uAA31-\uAA32\uAA35-\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7-\uAAB8\uAABE-\uAABF\uAAC1\uAAEC-\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/,
      peg$c157 = peg$classExpectation([["\u0300", "\u036F"], ["\u0483", "\u0487"], ["\u0591", "\u05BD"], "\u05BF", ["\u05C1", "\u05C2"], ["\u05C4", "\u05C5"], "\u05C7", ["\u0610", "\u061A"], ["\u064B", "\u065F"], "\u0670", ["\u06D6", "\u06DC"], ["\u06DF", "\u06E4"], ["\u06E7", "\u06E8"], ["\u06EA", "\u06ED"], "\u0711", ["\u0730", "\u074A"], ["\u07A6", "\u07B0"], ["\u07EB", "\u07F3"], ["\u0816", "\u0819"], ["\u081B", "\u0823"], ["\u0825", "\u0827"], ["\u0829", "\u082D"], ["\u0859", "\u085B"], ["\u08E3", "\u0902"], "\u093A", "\u093C", ["\u0941", "\u0948"], "\u094D", ["\u0951", "\u0957"], ["\u0962", "\u0963"], "\u0981", "\u09BC", ["\u09C1", "\u09C4"], "\u09CD", ["\u09E2", "\u09E3"], ["\u0A01", "\u0A02"], "\u0A3C", ["\u0A41", "\u0A42"], ["\u0A47", "\u0A48"], ["\u0A4B", "\u0A4D"], "\u0A51", ["\u0A70", "\u0A71"], "\u0A75", ["\u0A81", "\u0A82"], "\u0ABC", ["\u0AC1", "\u0AC5"], ["\u0AC7", "\u0AC8"], "\u0ACD", ["\u0AE2", "\u0AE3"], "\u0B01", "\u0B3C", "\u0B3F", ["\u0B41", "\u0B44"], "\u0B4D", "\u0B56", ["\u0B62", "\u0B63"], "\u0B82", "\u0BC0", "\u0BCD", "\u0C00", ["\u0C3E", "\u0C40"], ["\u0C46", "\u0C48"], ["\u0C4A", "\u0C4D"], ["\u0C55", "\u0C56"], ["\u0C62", "\u0C63"], "\u0C81", "\u0CBC", "\u0CBF", "\u0CC6", ["\u0CCC", "\u0CCD"], ["\u0CE2", "\u0CE3"], "\u0D01", ["\u0D41", "\u0D44"], "\u0D4D", ["\u0D62", "\u0D63"], "\u0DCA", ["\u0DD2", "\u0DD4"], "\u0DD6", "\u0E31", ["\u0E34", "\u0E3A"], ["\u0E47", "\u0E4E"], "\u0EB1", ["\u0EB4", "\u0EB9"], ["\u0EBB", "\u0EBC"], ["\u0EC8", "\u0ECD"], ["\u0F18", "\u0F19"], "\u0F35", "\u0F37", "\u0F39", ["\u0F71", "\u0F7E"], ["\u0F80", "\u0F84"], ["\u0F86", "\u0F87"], ["\u0F8D", "\u0F97"], ["\u0F99", "\u0FBC"], "\u0FC6", ["\u102D", "\u1030"], ["\u1032", "\u1037"], ["\u1039", "\u103A"], ["\u103D", "\u103E"], ["\u1058", "\u1059"], ["\u105E", "\u1060"], ["\u1071", "\u1074"], "\u1082", ["\u1085", "\u1086"], "\u108D", "\u109D", ["\u135D", "\u135F"], ["\u1712", "\u1714"], ["\u1732", "\u1734"], ["\u1752", "\u1753"], ["\u1772", "\u1773"], ["\u17B4", "\u17B5"], ["\u17B7", "\u17BD"], "\u17C6", ["\u17C9", "\u17D3"], "\u17DD", ["\u180B", "\u180D"], "\u18A9", ["\u1920", "\u1922"], ["\u1927", "\u1928"], "\u1932", ["\u1939", "\u193B"], ["\u1A17", "\u1A18"], "\u1A1B", "\u1A56", ["\u1A58", "\u1A5E"], "\u1A60", "\u1A62", ["\u1A65", "\u1A6C"], ["\u1A73", "\u1A7C"], "\u1A7F", ["\u1AB0", "\u1ABD"], ["\u1B00", "\u1B03"], "\u1B34", ["\u1B36", "\u1B3A"], "\u1B3C", "\u1B42", ["\u1B6B", "\u1B73"], ["\u1B80", "\u1B81"], ["\u1BA2", "\u1BA5"], ["\u1BA8", "\u1BA9"], ["\u1BAB", "\u1BAD"], "\u1BE6", ["\u1BE8", "\u1BE9"], "\u1BED", ["\u1BEF", "\u1BF1"], ["\u1C2C", "\u1C33"], ["\u1C36", "\u1C37"], ["\u1CD0", "\u1CD2"], ["\u1CD4", "\u1CE0"], ["\u1CE2", "\u1CE8"], "\u1CED", "\u1CF4", ["\u1CF8", "\u1CF9"], ["\u1DC0", "\u1DF5"], ["\u1DFC", "\u1DFF"], ["\u20D0", "\u20DC"], "\u20E1", ["\u20E5", "\u20F0"], ["\u2CEF", "\u2CF1"], "\u2D7F", ["\u2DE0", "\u2DFF"], ["\u302A", "\u302D"], ["\u3099", "\u309A"], "\uA66F", ["\uA674", "\uA67D"], ["\uA69E", "\uA69F"], ["\uA6F0", "\uA6F1"], "\uA802", "\uA806", "\uA80B", ["\uA825", "\uA826"], "\uA8C4", ["\uA8E0", "\uA8F1"], ["\uA926", "\uA92D"], ["\uA947", "\uA951"], ["\uA980", "\uA982"], "\uA9B3", ["\uA9B6", "\uA9B9"], "\uA9BC", "\uA9E5", ["\uAA29", "\uAA2E"], ["\uAA31", "\uAA32"], ["\uAA35", "\uAA36"], "\uAA43", "\uAA4C", "\uAA7C", "\uAAB0", ["\uAAB2", "\uAAB4"], ["\uAAB7", "\uAAB8"], ["\uAABE", "\uAABF"], "\uAAC1", ["\uAAEC", "\uAAED"], "\uAAF6", "\uABE5", "\uABE8", "\uABED", "\uFB1E", ["\uFE00", "\uFE0F"], ["\uFE20", "\uFE2F"]], false, false),
      peg$c158 = /^[0-9\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29\u1040-\u1049\u1090-\u1099\u17E0-\u17E9\u1810-\u1819\u1946-\u194F\u19D0-\u19D9\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\uA620-\uA629\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]/,
      peg$c159 = peg$classExpectation([["0", "9"], ["\u0660", "\u0669"], ["\u06F0", "\u06F9"], ["\u07C0", "\u07C9"], ["\u0966", "\u096F"], ["\u09E6", "\u09EF"], ["\u0A66", "\u0A6F"], ["\u0AE6", "\u0AEF"], ["\u0B66", "\u0B6F"], ["\u0BE6", "\u0BEF"], ["\u0C66", "\u0C6F"], ["\u0CE6", "\u0CEF"], ["\u0D66", "\u0D6F"], ["\u0DE6", "\u0DEF"], ["\u0E50", "\u0E59"], ["\u0ED0", "\u0ED9"], ["\u0F20", "\u0F29"], ["\u1040", "\u1049"], ["\u1090", "\u1099"], ["\u17E0", "\u17E9"], ["\u1810", "\u1819"], ["\u1946", "\u194F"], ["\u19D0", "\u19D9"], ["\u1A80", "\u1A89"], ["\u1A90", "\u1A99"], ["\u1B50", "\u1B59"], ["\u1BB0", "\u1BB9"], ["\u1C40", "\u1C49"], ["\u1C50", "\u1C59"], ["\uA620", "\uA629"], ["\uA8D0", "\uA8D9"], ["\uA900", "\uA909"], ["\uA9D0", "\uA9D9"], ["\uA9F0", "\uA9F9"], ["\uAA50", "\uAA59"], ["\uABF0", "\uABF9"], ["\uFF10", "\uFF19"]], false, false),
      peg$c160 = /^[\u16EE-\u16F0\u2160-\u2182\u2185-\u2188\u3007\u3021-\u3029\u3038-\u303A\uA6E6-\uA6EF]/,
      peg$c161 = peg$classExpectation([["\u16EE", "\u16F0"], ["\u2160", "\u2182"], ["\u2185", "\u2188"], "\u3007", ["\u3021", "\u3029"], ["\u3038", "\u303A"], ["\uA6E6", "\uA6EF"]], false, false),
      peg$c162 = /^[_\u203F-\u2040\u2054\uFE33-\uFE34\uFE4D-\uFE4F\uFF3F]/,
      peg$c163 = peg$classExpectation(["_", ["\u203F", "\u2040"], "\u2054", ["\uFE33", "\uFE34"], ["\uFE4D", "\uFE4F"], "\uFF3F"], false, false),
      peg$c164 = /^[ \xA0\u1680\u2000-\u200A\u202F\u205F\u3000]/,
      peg$c165 = peg$classExpectation([" ", "\xA0", "\u1680", ["\u2000", "\u200A"], "\u202F", "\u205F", "\u3000"], false, false),
      peg$c166 = "break",
      peg$c167 = peg$literalExpectation("break", false),
      peg$c168 = "case",
      peg$c169 = peg$literalExpectation("case", false),
      peg$c170 = "catch",
      peg$c171 = peg$literalExpectation("catch", false),
      peg$c172 = "class",
      peg$c173 = peg$literalExpectation("class", false),
      peg$c174 = "const",
      peg$c175 = peg$literalExpectation("const", false),
      peg$c176 = "continue",
      peg$c177 = peg$literalExpectation("continue", false),
      peg$c178 = "debugger",
      peg$c179 = peg$literalExpectation("debugger", false),
      peg$c180 = "default",
      peg$c181 = peg$literalExpectation("default", false),
      peg$c182 = "delete",
      peg$c183 = peg$literalExpectation("delete", false),
      peg$c184 = "do",
      peg$c185 = peg$literalExpectation("do", false),
      peg$c186 = "else",
      peg$c187 = peg$literalExpectation("else", false),
      peg$c188 = "enum",
      peg$c189 = peg$literalExpectation("enum", false),
      peg$c190 = "export",
      peg$c191 = peg$literalExpectation("export", false),
      peg$c192 = "extends",
      peg$c193 = peg$literalExpectation("extends", false),
      peg$c194 = "false",
      peg$c195 = peg$literalExpectation("false", false),
      peg$c196 = "finally",
      peg$c197 = peg$literalExpectation("finally", false),
      peg$c198 = "for",
      peg$c199 = peg$literalExpectation("for", false),
      peg$c200 = "function",
      peg$c201 = peg$literalExpectation("function", false),
      peg$c202 = "if",
      peg$c203 = peg$literalExpectation("if", false),
      peg$c204 = "import",
      peg$c205 = peg$literalExpectation("import", false),
      peg$c206 = "instanceof",
      peg$c207 = peg$literalExpectation("instanceof", false),
      peg$c208 = "in",
      peg$c209 = peg$literalExpectation("in", false),
      peg$c210 = "new",
      peg$c211 = peg$literalExpectation("new", false),
      peg$c212 = "null",
      peg$c213 = peg$literalExpectation("null", false),
      peg$c214 = "return",
      peg$c215 = peg$literalExpectation("return", false),
      peg$c216 = "super",
      peg$c217 = peg$literalExpectation("super", false),
      peg$c218 = "switch",
      peg$c219 = peg$literalExpectation("switch", false),
      peg$c220 = "this",
      peg$c221 = peg$literalExpectation("this", false),
      peg$c222 = "throw",
      peg$c223 = peg$literalExpectation("throw", false),
      peg$c224 = "true",
      peg$c225 = peg$literalExpectation("true", false),
      peg$c226 = "try",
      peg$c227 = peg$literalExpectation("try", false),
      peg$c228 = "typeof",
      peg$c229 = peg$literalExpectation("typeof", false),
      peg$c230 = "var",
      peg$c231 = peg$literalExpectation("var", false),
      peg$c232 = "void",
      peg$c233 = peg$literalExpectation("void", false),
      peg$c234 = "while",
      peg$c235 = peg$literalExpectation("while", false),
      peg$c236 = "with",
      peg$c237 = peg$literalExpectation("with", false),
      peg$c238 = ";",
      peg$c239 = peg$literalExpectation(";", false),

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parseGrammar() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = peg$parse__();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = peg$parseInitializer();
      if (s3 !== peg$FAILED) {
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        s5 = peg$parseRule();
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s5 = [s5, s6];
            s4 = s5;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$currPos;
            s5 = peg$parseRule();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s5 = [s5, s6];
                s4 = s5;
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c0(s2, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInitializer() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parseCodeBlock();
    if (s1 !== peg$FAILED) {
      s2 = peg$parseEOS();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseRule() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseIdentifierName();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = peg$parseStringLiteral();
        if (s4 !== peg$FAILED) {
          s5 = peg$parse__();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 61) {
            s4 = peg$c2;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c3); }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseChoiceExpression();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseEOS();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c4(s1, s3, s6);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseChoiceExpression() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseActionExpression();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 47) {
          s5 = peg$c5;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c6); }
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$parse__();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseActionExpression();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 47) {
            s5 = peg$c5;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c6); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseActionExpression();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c7(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseActionExpression() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parseSequenceExpression();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = peg$parse__();
      if (s3 !== peg$FAILED) {
        s4 = peg$parseCodeBlock();
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c8(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseSequenceExpression() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseLabeledExpression();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseLabeledExpression();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseLabeledExpression();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c9(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseLabeledExpression() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseIdentifier();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 58) {
          s3 = peg$c10;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c11); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsePrefixedExpression();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c12(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsePrefixedExpression();
    }

    return s0;
  }

  function peg$parsePrefixedExpression() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsePrefixedOperator();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseSuffixedExpression();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c13(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseSuffixedExpression();
    }

    return s0;
  }

  function peg$parsePrefixedOperator() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 36) {
      s0 = peg$c14;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c15); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 38) {
        s0 = peg$c16;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c17); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 33) {
          s0 = peg$c18;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c19); }
        }
      }
    }

    return s0;
  }

  function peg$parseSuffixedExpression() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsePrimaryExpression();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseSuffixedOperator();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c20(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsePrimaryExpression();
    }

    return s0;
  }

  function peg$parseSuffixedOperator() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 63) {
      s0 = peg$c21;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c22); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 42) {
        s0 = peg$c23;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c24); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 43) {
          s0 = peg$c25;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c26); }
        }
      }
    }

    return s0;
  }

  function peg$parsePrimaryExpression() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$parseLiteralMatcher();
    if (s0 === peg$FAILED) {
      s0 = peg$parseCharacterClassMatcher();
      if (s0 === peg$FAILED) {
        s0 = peg$parseAnyMatcher();
        if (s0 === peg$FAILED) {
          s0 = peg$parseRuleReferenceExpression();
          if (s0 === peg$FAILED) {
            s0 = peg$parseSemanticPredicateExpression();
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 40) {
                s1 = peg$c27;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c28); }
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parse__();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseChoiceExpression();
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parse__();
                    if (s4 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 41) {
                        s5 = peg$c29;
                        peg$currPos++;
                      } else {
                        s5 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c30); }
                      }
                      if (s5 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c31(s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseRuleReferenceExpression() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parseIdentifierName();
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$currPos;
      s4 = peg$parse__();
      if (s4 !== peg$FAILED) {
        s5 = peg$currPos;
        s6 = peg$parseStringLiteral();
        if (s6 !== peg$FAILED) {
          s7 = peg$parse__();
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        if (s5 === peg$FAILED) {
          s5 = null;
        }
        if (s5 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 61) {
            s6 = peg$c2;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c3); }
          }
          if (s6 !== peg$FAILED) {
            s4 = [s4, s5, s6];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c32(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseSemanticPredicateExpression() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseSemanticPredicateOperator();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse__();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseCodeBlock();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c33(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseSemanticPredicateOperator() {
    var s0;

    if (input.charCodeAt(peg$currPos) === 38) {
      s0 = peg$c16;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c17); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 33) {
        s0 = peg$c18;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c19); }
      }
    }

    return s0;
  }

  function peg$parseSourceCharacter() {
    var s0;

    if (input.length > peg$currPos) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c34); }
    }

    return s0;
  }

  function peg$parseWhiteSpace() {
    var s0, s1;

    peg$silentFails++;
    if (input.charCodeAt(peg$currPos) === 9) {
      s0 = peg$c36;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c37); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 11) {
        s0 = peg$c38;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c39); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 12) {
          s0 = peg$c40;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c41); }
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 32) {
            s0 = peg$c42;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c43); }
          }
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 160) {
              s0 = peg$c44;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c45); }
            }
            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 65279) {
                s0 = peg$c46;
                peg$currPos++;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c47); }
              }
              if (s0 === peg$FAILED) {
                s0 = peg$parseZs();
              }
            }
          }
        }
      }
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c35); }
    }

    return s0;
  }

  function peg$parseLineTerminator() {
    var s0;

    if (peg$c48.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c49); }
    }

    return s0;
  }

  function peg$parseLineTerminatorSequence() {
    var s0, s1;

    peg$silentFails++;
    if (input.charCodeAt(peg$currPos) === 10) {
      s0 = peg$c51;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c52); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c53) {
        s0 = peg$c53;
        peg$currPos += 2;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c54); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 13) {
          s0 = peg$c55;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c56); }
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 8232) {
            s0 = peg$c57;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c58); }
          }
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 8233) {
              s0 = peg$c59;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c60); }
            }
          }
        }
      }
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c50); }
    }

    return s0;
  }

  function peg$parseComment() {
    var s0, s1;

    peg$silentFails++;
    s0 = peg$parseMultiLineComment();
    if (s0 === peg$FAILED) {
      s0 = peg$parseSingleLineComment();
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c61); }
    }

    return s0;
  }

  function peg$parseMultiLineComment() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c62) {
      s1 = peg$c62;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c63); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 2) === peg$c64) {
        s5 = peg$c64;
        peg$currPos += 2;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c65); }
      }
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseSourceCharacter();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 2) === peg$c64) {
          s5 = peg$c64;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c65); }
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseSourceCharacter();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c64) {
          s3 = peg$c64;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c65); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseMultiLineCommentNoLineTerminator() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c62) {
      s1 = peg$c62;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c63); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 2) === peg$c64) {
        s5 = peg$c64;
        peg$currPos += 2;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c65); }
      }
      if (s5 === peg$FAILED) {
        s5 = peg$parseLineTerminator();
      }
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseSourceCharacter();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 2) === peg$c64) {
          s5 = peg$c64;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c65); }
        }
        if (s5 === peg$FAILED) {
          s5 = peg$parseLineTerminator();
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseSourceCharacter();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c64) {
          s3 = peg$c64;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c65); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseSingleLineComment() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c66) {
      s1 = peg$c66;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c67); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      s5 = peg$parseLineTerminator();
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseSourceCharacter();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parseLineTerminator();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseSourceCharacter();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseIdentifier() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parseReservedWord();
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseIdentifierName();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c68(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseIdentifierName() {
    var s0, s1, s2, s3;

    peg$silentFails++;
    s0 = peg$currPos;
    s1 = peg$parseIdentifierStart();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseIdentifierPart();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseIdentifierPart();
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c70(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c69); }
    }

    return s0;
  }

  function peg$parseIdentifierStart() {
    var s0, s1, s2;

    s0 = peg$parseUnicodeLetter();
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 36) {
        s0 = peg$c14;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c15); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 95) {
          s0 = peg$c71;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c72); }
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 92) {
            s1 = peg$c73;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c74); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parseUnicodeEscapeSequence();
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c75(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }

    return s0;
  }

  function peg$parseIdentifierPart() {
    var s0;

    s0 = peg$parseIdentifierStart();
    if (s0 === peg$FAILED) {
      s0 = peg$parseUnicodeCombiningMark();
      if (s0 === peg$FAILED) {
        s0 = peg$parseNd();
        if (s0 === peg$FAILED) {
          s0 = peg$parsePc();
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 8204) {
              s0 = peg$c76;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c77); }
            }
            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 8205) {
                s0 = peg$c78;
                peg$currPos++;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c79); }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseUnicodeLetter() {
    var s0;

    s0 = peg$parseLu();
    if (s0 === peg$FAILED) {
      s0 = peg$parseLl();
      if (s0 === peg$FAILED) {
        s0 = peg$parseLt();
        if (s0 === peg$FAILED) {
          s0 = peg$parseLm();
          if (s0 === peg$FAILED) {
            s0 = peg$parseLo();
            if (s0 === peg$FAILED) {
              s0 = peg$parseNl();
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseUnicodeCombiningMark() {
    var s0;

    s0 = peg$parseMn();
    if (s0 === peg$FAILED) {
      s0 = peg$parseMc();
    }

    return s0;
  }

  function peg$parseReservedWord() {
    var s0;

    s0 = peg$parseKeyword();
    if (s0 === peg$FAILED) {
      s0 = peg$parseFutureReservedWord();
      if (s0 === peg$FAILED) {
        s0 = peg$parseNullToken();
        if (s0 === peg$FAILED) {
          s0 = peg$parseBooleanLiteral();
        }
      }
    }

    return s0;
  }

  function peg$parseKeyword() {
    var s0;

    s0 = peg$parseBreakToken();
    if (s0 === peg$FAILED) {
      s0 = peg$parseCaseToken();
      if (s0 === peg$FAILED) {
        s0 = peg$parseCatchToken();
        if (s0 === peg$FAILED) {
          s0 = peg$parseContinueToken();
          if (s0 === peg$FAILED) {
            s0 = peg$parseDebuggerToken();
            if (s0 === peg$FAILED) {
              s0 = peg$parseDefaultToken();
              if (s0 === peg$FAILED) {
                s0 = peg$parseDeleteToken();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseDoToken();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseElseToken();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseFinallyToken();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parseForToken();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parseFunctionToken();
                          if (s0 === peg$FAILED) {
                            s0 = peg$parseIfToken();
                            if (s0 === peg$FAILED) {
                              s0 = peg$parseInstanceofToken();
                              if (s0 === peg$FAILED) {
                                s0 = peg$parseInToken();
                                if (s0 === peg$FAILED) {
                                  s0 = peg$parseNewToken();
                                  if (s0 === peg$FAILED) {
                                    s0 = peg$parseReturnToken();
                                    if (s0 === peg$FAILED) {
                                      s0 = peg$parseSwitchToken();
                                      if (s0 === peg$FAILED) {
                                        s0 = peg$parseThisToken();
                                        if (s0 === peg$FAILED) {
                                          s0 = peg$parseThrowToken();
                                          if (s0 === peg$FAILED) {
                                            s0 = peg$parseTryToken();
                                            if (s0 === peg$FAILED) {
                                              s0 = peg$parseTypeofToken();
                                              if (s0 === peg$FAILED) {
                                                s0 = peg$parseVarToken();
                                                if (s0 === peg$FAILED) {
                                                  s0 = peg$parseVoidToken();
                                                  if (s0 === peg$FAILED) {
                                                    s0 = peg$parseWhileToken();
                                                    if (s0 === peg$FAILED) {
                                                      s0 = peg$parseWithToken();
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseFutureReservedWord() {
    var s0;

    s0 = peg$parseClassToken();
    if (s0 === peg$FAILED) {
      s0 = peg$parseConstToken();
      if (s0 === peg$FAILED) {
        s0 = peg$parseEnumToken();
        if (s0 === peg$FAILED) {
          s0 = peg$parseExportToken();
          if (s0 === peg$FAILED) {
            s0 = peg$parseExtendsToken();
            if (s0 === peg$FAILED) {
              s0 = peg$parseImportToken();
              if (s0 === peg$FAILED) {
                s0 = peg$parseSuperToken();
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseBooleanLiteral() {
    var s0;

    s0 = peg$parseTrueToken();
    if (s0 === peg$FAILED) {
      s0 = peg$parseFalseToken();
    }

    return s0;
  }

  function peg$parseLiteralMatcher() {
    var s0, s1, s2;

    peg$silentFails++;
    s0 = peg$currPos;
    s1 = peg$parseStringLiteral();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 105) {
        s2 = peg$c81;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c82); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c83(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c80); }
    }

    return s0;
  }

  function peg$parseStringLiteral() {
    var s0, s1, s2, s3;

    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c85;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c86); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseDoubleStringCharacter();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseDoubleStringCharacter();
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c85;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c86); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c87(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 39) {
        s1 = peg$c88;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c89); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseSingleStringCharacter();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseSingleStringCharacter();
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 39) {
            s3 = peg$c88;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c89); }
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c87(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c84); }
    }

    return s0;
  }

  function peg$parseDoubleStringCharacter() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    if (input.charCodeAt(peg$currPos) === 34) {
      s2 = peg$c85;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c86); }
    }
    if (s2 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 92) {
        s2 = peg$c73;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseLineTerminator();
      }
    }
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c90();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c73;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapeSequence();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c75(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseLineContinuation();
      }
    }

    return s0;
  }

  function peg$parseSingleStringCharacter() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    if (input.charCodeAt(peg$currPos) === 39) {
      s2 = peg$c88;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c89); }
    }
    if (s2 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 92) {
        s2 = peg$c73;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseLineTerminator();
      }
    }
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c90();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c73;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapeSequence();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c75(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseLineContinuation();
      }
    }

    return s0;
  }

  function peg$parseCharacterClassMatcher() {
    var s0, s1, s2, s3, s4, s5;

    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 91) {
      s1 = peg$c92;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c93); }
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 94) {
        s2 = peg$c94;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c95); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseClassCharacterRange();
        if (s4 === peg$FAILED) {
          s4 = peg$parseClassCharacter();
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parseClassCharacterRange();
          if (s4 === peg$FAILED) {
            s4 = peg$parseClassCharacter();
          }
        }
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 93) {
            s4 = peg$c96;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c97); }
          }
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 105) {
              s5 = peg$c81;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c82); }
            }
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c98(s2, s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c91); }
    }

    return s0;
  }

  function peg$parseClassCharacterRange() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseClassCharacter();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c99;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c100); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseClassCharacter();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c101(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseClassCharacter() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    if (input.charCodeAt(peg$currPos) === 93) {
      s2 = peg$c96;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c97); }
    }
    if (s2 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 92) {
        s2 = peg$c73;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseLineTerminator();
      }
    }
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c90();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c73;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseEscapeSequence();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c75(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseLineContinuation();
      }
    }

    return s0;
  }

  function peg$parseLineContinuation() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 92) {
      s1 = peg$c73;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c74); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseLineTerminatorSequence();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c102();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseEscapeSequence() {
    var s0, s1, s2, s3;

    s0 = peg$parseCharacterEscapeSequence();
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 48) {
        s1 = peg$c103;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c104); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        peg$silentFails++;
        s3 = peg$parseDecimalDigit();
        peg$silentFails--;
        if (s3 === peg$FAILED) {
          s2 = void 0;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c105();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseHexEscapeSequence();
        if (s0 === peg$FAILED) {
          s0 = peg$parseUnicodeEscapeSequence();
        }
      }
    }

    return s0;
  }

  function peg$parseCharacterEscapeSequence() {
    var s0;

    s0 = peg$parseSingleEscapeCharacter();
    if (s0 === peg$FAILED) {
      s0 = peg$parseNonEscapeCharacter();
    }

    return s0;
  }

  function peg$parseSingleEscapeCharacter() {
    var s0, s1;

    if (input.charCodeAt(peg$currPos) === 39) {
      s0 = peg$c88;
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c89); }
    }
    if (s0 === peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 34) {
        s0 = peg$c85;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c86); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 92) {
          s0 = peg$c73;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c74); }
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 98) {
            s1 = peg$c106;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c107); }
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c108();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 102) {
              s1 = peg$c109;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c110); }
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c111();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 110) {
                s1 = peg$c112;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c113); }
              }
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c114();
              }
              s0 = s1;
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.charCodeAt(peg$currPos) === 114) {
                  s1 = peg$c115;
                  peg$currPos++;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c116); }
                }
                if (s1 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c117();
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 116) {
                    s1 = peg$c118;
                    peg$currPos++;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c119); }
                  }
                  if (s1 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s1 = peg$c120();
                  }
                  s0 = s1;
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 118) {
                      s1 = peg$c121;
                      peg$currPos++;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c122); }
                    }
                    if (s1 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c123();
                    }
                    s0 = s1;
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseNonEscapeCharacter() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parseEscapeCharacter();
    if (s2 === peg$FAILED) {
      s2 = peg$parseLineTerminator();
    }
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseSourceCharacter();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c90();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseEscapeCharacter() {
    var s0;

    s0 = peg$parseSingleEscapeCharacter();
    if (s0 === peg$FAILED) {
      s0 = peg$parseDecimalDigit();
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 120) {
          s0 = peg$c124;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c125); }
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 117) {
            s0 = peg$c126;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c127); }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseHexEscapeSequence() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 120) {
      s1 = peg$c124;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c125); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = peg$currPos;
      s4 = peg$parseHexDigit();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseHexDigit();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        s2 = input.substring(s2, peg$currPos);
      } else {
        s2 = s3;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c128(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseUnicodeEscapeSequence() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 117) {
      s1 = peg$c126;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c127); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = peg$currPos;
      s4 = peg$parseHexDigit();
      if (s4 !== peg$FAILED) {
        s5 = peg$parseHexDigit();
        if (s5 !== peg$FAILED) {
          s6 = peg$parseHexDigit();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseHexDigit();
            if (s7 !== peg$FAILED) {
              s4 = [s4, s5, s6, s7];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        s2 = input.substring(s2, peg$currPos);
      } else {
        s2 = s3;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c128(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseDecimalDigit() {
    var s0;

    if (peg$c129.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c130); }
    }

    return s0;
  }

  function peg$parseHexDigit() {
    var s0;

    if (peg$c131.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c132); }
    }

    return s0;
  }

  function peg$parseAnyMatcher() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 46) {
      s1 = peg$c133;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c134); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c135();
    }
    s0 = s1;

    return s0;
  }

  function peg$parseCodeBlock() {
    var s0, s1, s2, s3;

    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 123) {
      s1 = peg$c137;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c138); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseCode();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 125) {
          s3 = peg$c139;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c140); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c141(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c136); }
    }

    return s0;
  }

  function peg$parseCode() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = [];
    s2 = [];
    s3 = peg$currPos;
    s4 = peg$currPos;
    peg$silentFails++;
    if (peg$c142.test(input.charAt(peg$currPos))) {
      s5 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s5 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c143); }
    }
    peg$silentFails--;
    if (s5 === peg$FAILED) {
      s4 = void 0;
    } else {
      peg$currPos = s4;
      s4 = peg$FAILED;
    }
    if (s4 !== peg$FAILED) {
      s5 = peg$parseSourceCharacter();
      if (s5 !== peg$FAILED) {
        s4 = [s4, s5];
        s3 = s4;
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
    } else {
      peg$currPos = s3;
      s3 = peg$FAILED;
    }
    if (s3 !== peg$FAILED) {
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (peg$c142.test(input.charAt(peg$currPos))) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c143); }
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseSourceCharacter();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
    } else {
      s2 = peg$FAILED;
    }
    if (s2 === peg$FAILED) {
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s3 = peg$c137;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c138); }
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parseCode();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 125) {
            s5 = peg$c139;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c140); }
          }
          if (s5 !== peg$FAILED) {
            s3 = [s3, s4, s5];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      if (peg$c142.test(input.charAt(peg$currPos))) {
        s5 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c143); }
      }
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseSourceCharacter();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$currPos;
          peg$silentFails++;
          if (peg$c142.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c143); }
          }
          peg$silentFails--;
          if (s5 === peg$FAILED) {
            s4 = void 0;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseSourceCharacter();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 123) {
          s3 = peg$c137;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c138); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseCode();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 125) {
              s5 = peg$c139;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c140); }
            }
            if (s5 !== peg$FAILED) {
              s3 = [s3, s4, s5];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s0 = input.substring(s0, peg$currPos);
    } else {
      s0 = s1;
    }

    return s0;
  }

  function peg$parseLl() {
    var s0;

    if (peg$c144.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c145); }
    }

    return s0;
  }

  function peg$parseLm() {
    var s0;

    if (peg$c146.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c147); }
    }

    return s0;
  }

  function peg$parseLo() {
    var s0;

    if (peg$c148.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c149); }
    }

    return s0;
  }

  function peg$parseLt() {
    var s0;

    if (peg$c150.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c151); }
    }

    return s0;
  }

  function peg$parseLu() {
    var s0;

    if (peg$c152.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c153); }
    }

    return s0;
  }

  function peg$parseMc() {
    var s0;

    if (peg$c154.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c155); }
    }

    return s0;
  }

  function peg$parseMn() {
    var s0;

    if (peg$c156.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c157); }
    }

    return s0;
  }

  function peg$parseNd() {
    var s0;

    if (peg$c158.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c159); }
    }

    return s0;
  }

  function peg$parseNl() {
    var s0;

    if (peg$c160.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c161); }
    }

    return s0;
  }

  function peg$parsePc() {
    var s0;

    if (peg$c162.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c163); }
    }

    return s0;
  }

  function peg$parseZs() {
    var s0;

    if (peg$c164.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c165); }
    }

    return s0;
  }

  function peg$parseBreakToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c166) {
      s1 = peg$c166;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c167); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseCaseToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c168) {
      s1 = peg$c168;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c169); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseCatchToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c170) {
      s1 = peg$c170;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c171); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseClassToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c172) {
      s1 = peg$c172;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c173); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseConstToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c174) {
      s1 = peg$c174;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c175); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseContinueToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8) === peg$c176) {
      s1 = peg$c176;
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c177); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseDebuggerToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8) === peg$c178) {
      s1 = peg$c178;
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c179); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseDefaultToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7) === peg$c180) {
      s1 = peg$c180;
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c181); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseDeleteToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6) === peg$c182) {
      s1 = peg$c182;
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c183); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseDoToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c184) {
      s1 = peg$c184;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c185); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseElseToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c186) {
      s1 = peg$c186;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c187); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseEnumToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c188) {
      s1 = peg$c188;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c189); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseExportToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6) === peg$c190) {
      s1 = peg$c190;
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c191); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseExtendsToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7) === peg$c192) {
      s1 = peg$c192;
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c193); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseFalseToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c194) {
      s1 = peg$c194;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c195); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseFinallyToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 7) === peg$c196) {
      s1 = peg$c196;
      peg$currPos += 7;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c197); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseForToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c198) {
      s1 = peg$c198;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c199); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseFunctionToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8) === peg$c200) {
      s1 = peg$c200;
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c201); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseIfToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c202) {
      s1 = peg$c202;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c203); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseImportToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6) === peg$c204) {
      s1 = peg$c204;
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c205); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInstanceofToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 10) === peg$c206) {
      s1 = peg$c206;
      peg$currPos += 10;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c207); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseInToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c208) {
      s1 = peg$c208;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c209); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseNewToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c210) {
      s1 = peg$c210;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c211); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseNullToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c212) {
      s1 = peg$c212;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c213); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseReturnToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6) === peg$c214) {
      s1 = peg$c214;
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c215); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseSuperToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c216) {
      s1 = peg$c216;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c217); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseSwitchToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6) === peg$c218) {
      s1 = peg$c218;
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c219); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseThisToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c220) {
      s1 = peg$c220;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c221); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseThrowToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c222) {
      s1 = peg$c222;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c223); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseTrueToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c224) {
      s1 = peg$c224;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c225); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseTryToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c226) {
      s1 = peg$c226;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c227); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseTypeofToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 6) === peg$c228) {
      s1 = peg$c228;
      peg$currPos += 6;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c229); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseVarToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c230) {
      s1 = peg$c230;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c231); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseVoidToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c232) {
      s1 = peg$c232;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c233); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseWhileToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c234) {
      s1 = peg$c234;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c235); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseWithToken() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c236) {
      s1 = peg$c236;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c237); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseIdentifierPart();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parse__() {
    var s0, s1;

    s0 = [];
    s1 = peg$parseWhiteSpace();
    if (s1 === peg$FAILED) {
      s1 = peg$parseLineTerminatorSequence();
      if (s1 === peg$FAILED) {
        s1 = peg$parseComment();
      }
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = peg$parseWhiteSpace();
      if (s1 === peg$FAILED) {
        s1 = peg$parseLineTerminatorSequence();
        if (s1 === peg$FAILED) {
          s1 = peg$parseComment();
        }
      }
    }

    return s0;
  }

  function peg$parse_() {
    var s0, s1;

    s0 = [];
    s1 = peg$parseWhiteSpace();
    if (s1 === peg$FAILED) {
      s1 = peg$parseMultiLineCommentNoLineTerminator();
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = peg$parseWhiteSpace();
      if (s1 === peg$FAILED) {
        s1 = peg$parseMultiLineCommentNoLineTerminator();
      }
    }

    return s0;
  }

  function peg$parseEOS() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parse__();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 59) {
        s2 = peg$c238;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c239); }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseSingleLineComment();
        if (s2 === peg$FAILED) {
          s2 = null;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseLineTerminatorSequence();
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parse__();
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEOF();
          if (s2 !== peg$FAILED) {
            s1 = [s1, s2];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
    }

    return s0;
  }

  function peg$parseEOF() {
    var s0, s1;

    s0 = peg$currPos;
    peg$silentFails++;
    if (input.length > peg$currPos) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c34); }
    }
    peg$silentFails--;
    if (s1 === peg$FAILED) {
      s0 = void 0;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }


    var OPS_TO_PREFIXED_TYPES = {
      "$": "text",
      "&": "simple_and",
      "!": "simple_not"
    };

    var OPS_TO_SUFFIXED_TYPES = {
      "?": "optional",
      "*": "zero_or_more",
      "+": "one_or_more"
    };

    var OPS_TO_SEMANTIC_PREDICATE_TYPES = {
      "&": "semantic_and",
      "!": "semantic_not"
    };

    function filterEmptyStrings(array) {
      var result = [], i;

      for (i = 0; i < array.length; i++) {
        if (array[i] !== "") {
          result.push(array[i]);
        }
      }

      return result;
    }

    function extractOptional(optional, index) {
      return optional ? optional[index] : null;
    }

    function extractList(list, index) {
      var result = new Array(list.length), i;

      for (i = 0; i < list.length; i++) {
        result[i] = list[i][index];
      }

      return result;
    }

    function buildList(head, tail, index) {
      return [head].concat(extractList(tail, index));
    }


  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};


/***/ }),

/***/ "./node_modules/pegjs/lib/peg.js":
/*!***************************************!*\
  !*** ./node_modules/pegjs/lib/peg.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var arrays  = __webpack_require__(/*! ./utils/arrays */ "./node_modules/pegjs/lib/utils/arrays.js"),
    objects = __webpack_require__(/*! ./utils/objects */ "./node_modules/pegjs/lib/utils/objects.js");

var peg = {
  /* PEG.js version (uses semantic versioning). */
  VERSION: "0.10.0",

  GrammarError: __webpack_require__(/*! ./grammar-error */ "./node_modules/pegjs/lib/grammar-error.js"),
  parser:       __webpack_require__(/*! ./parser */ "./node_modules/pegjs/lib/parser.js"),
  compiler:     __webpack_require__(/*! ./compiler */ "./node_modules/pegjs/lib/compiler/index.js"),

  /*
   * Generates a parser from a specified grammar and returns it.
   *
   * The grammar must be a string in the format described by the metagramar in
   * the parser.pegjs file.
   *
   * Throws |peg.parser.SyntaxError| if the grammar contains a syntax error or
   * |peg.GrammarError| if it contains a semantic error. Note that not all
   * errors are detected during the generation and some may protrude to the
   * generated parser and cause its malfunction.
   */
  generate: function(grammar, options) {
    options = options !== void 0 ? options : {};

    function convertPasses(passes) {
      var converted = {}, stage;

      for (stage in passes) {
        if (passes.hasOwnProperty(stage)) {
          converted[stage] = objects.values(passes[stage]);
        }
      }

      return converted;
    }

    options = objects.clone(options);

    var plugins = "plugins" in options ? options.plugins : [],
        config  = {
          parser: peg.parser,
          passes: convertPasses(peg.compiler.passes)
        };

    arrays.each(plugins, function(p) { p.use(config, options); });

    return peg.compiler.compile(
      config.parser.parse(grammar),
      config.passes,
      options
    );
  }
};

module.exports = peg;


/***/ }),

/***/ "./node_modules/pegjs/lib/utils/arrays.js":
/*!************************************************!*\
  !*** ./node_modules/pegjs/lib/utils/arrays.js ***!
  \************************************************/
/***/ ((module) => {

"use strict";


/* Array utilities. */
var arrays = {
  range: function(start, stop) {
    var length = stop - start,
        result = new Array(length),
        i, j;

    for (i = 0, j = start; i < length; i++, j++) {
      result[i] = j;
    }

    return result;
  },

  find: function(array, valueOrPredicate) {
    var length = array.length, i;

    if (typeof valueOrPredicate === "function") {
      for (i = 0; i < length; i++) {
        if (valueOrPredicate(array[i])) {
          return array[i];
        }
      }
    } else {
      for (i = 0; i < length; i++) {
        if (array[i] === valueOrPredicate) {
          return array[i];
        }
      }
    }
  },

  indexOf: function(array, valueOrPredicate) {
    var length = array.length, i;

    if (typeof valueOrPredicate === "function") {
      for (i = 0; i < length; i++) {
        if (valueOrPredicate(array[i])) {
          return i;
        }
      }
    } else {
      for (i = 0; i < length; i++) {
        if (array[i] === valueOrPredicate) {
          return i;
        }
      }
    }

    return -1;
  },

  contains: function(array, valueOrPredicate) {
    return arrays.indexOf(array, valueOrPredicate) !== -1;
  },

  each: function(array, iterator) {
    var length = array.length, i;

    for (i = 0; i < length; i++) {
      iterator(array[i], i);
    }
  },

  map: function(array, iterator) {
    var length = array.length,
        result = new Array(length),
        i;

    for (i = 0; i < length; i++) {
      result[i] = iterator(array[i], i);
    }

    return result;
  },

  pluck: function(array, key) {
    return arrays.map(array, function (e) { return e[key]; });
  },

  every: function(array, predicate) {
    var length = array.length, i;

    for (i = 0; i < length; i++) {
      if (!predicate(array[i])) {
        return false;
      }
    }

    return true;
  },

  some: function(array, predicate) {
    var length = array.length, i;

    for (i = 0; i < length; i++) {
      if (predicate(array[i])) {
        return true;
      }
    }

    return false;
  }
};

module.exports = arrays;


/***/ }),

/***/ "./node_modules/pegjs/lib/utils/classes.js":
/*!*************************************************!*\
  !*** ./node_modules/pegjs/lib/utils/classes.js ***!
  \*************************************************/
/***/ ((module) => {

"use strict";


/* Class utilities */
var classes = {
  subclass: function(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }
};

module.exports = classes;


/***/ }),

/***/ "./node_modules/pegjs/lib/utils/objects.js":
/*!*************************************************!*\
  !*** ./node_modules/pegjs/lib/utils/objects.js ***!
  \*************************************************/
/***/ ((module) => {

"use strict";


/* Object utilities. */
var objects = {
  keys: function(object) {
    var result = [], key;

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        result.push(key);
      }
    }

    return result;
  },

  values: function(object) {
    var result = [], key;

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        result.push(object[key]);
      }
    }

    return result;
  },

  clone: function(object) {
    var result = {}, key;

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        result[key] = object[key];
      }
    }

    return result;
  },

  defaults: function(object, defaults) {
    var key;

    for (key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        if (!(key in object)) {
          object[key] = defaults[key];
        }
      }
    }
  }
};

module.exports = objects;


/***/ }),

/***/ "./src/grammar.peg":
/*!*************************!*\
  !*** ./src/grammar.peg ***!
  \*************************/
/***/ ((module) => {

module.exports = "{\r\n    function flatten(a, acc = []) {\r\n        for (var i = 0; i < a.length; i++) {\r\n            if (Array.isArray(a[i])) {\r\n                flatten(a[i], acc);\r\n            } else {\r\n                acc.push(a[i]);\r\n            }\r\n        }\r\n        return acc;\r\n    }\r\n    function make_header(hn,hv) {\r\n        return {\r\n            name: hn,\r\n            value: hv\r\n        };\r\n    }\r\n    function make_move(move_number, move, nags, ravs, comments) {\r\n        var m = {};\r\n        if (move_number) m.move_number = move_number;\r\n        if (move) m.move = move;\r\n        if (nags && nags.length) m.nags = nags;\r\n        if (ravs && ravs.length) m.ravs = ravs;\r\n        if (comments) m.comments = comments;\r\n        return m;\r\n    }\r\n    function make_rav(comments, moves, result) {\r\n        return {\r\n            comments: flatten(comments),\r\n            moves, \r\n            result\r\n        };\r\n    }\r\n    function make_game(c0, hs, c1, m, r) {\r\n        return {\r\n            comments_above_header: c0,\r\n            headers: hs, \r\n            comments: c1,\r\n            moves: m || [],\r\n            result: r\r\n        };\r\n    }\r\n}\r\n\r\nstart = gs:(game newline*)* EOF {return gs.map(function(g) { return g[0]})}\r\n\r\ngame = \r\n    whitespace*\r\n    c0:comments?\r\n    whitespace*\r\n    h:headers? \r\n    c1:comments? \r\n    whitespace* \r\n    mr:(m:movetext whitespace+ r:result {return [m, r]} / r:result {return [null, r]}) \r\n    whitespace* {return make_game(c0, h, c1, mr[0], mr[1])}\r\n\r\nEOF = !.\r\ndouble_quote = '\"'\r\nstring = double_quote str:[^\"]* double_quote {return str.join('')}\r\ninteger = a:[1-9] b:[0-9]* {return parseInt(a+b.join(''), 10)}\r\nsymbol = chars:[A-Za-z0-9_-]+ {return chars.join('')}\r\nblank = ' '\r\nform_feed = '\\f'\r\ntab = '\\t'\r\ncarriage_return = '\\r'\r\nline_feed = '\\n'\r\nws = blank / form_feed / tab / carriage_return\r\nwhitespace = ws / newline\r\nnewline = line_feed\r\n\r\nheader = '[' hn:symbol ws+ hv:string ']' whitespace* { return make_header(hn,hv) }\r\nheaders = hs:header+ {return hs}\r\n\r\npiece = [NKQRB]\r\nrank = [a-h-]\r\nfile = [1-8-]\r\ncheck = \"+\"\r\ncheckmate = \"#\"\r\ncapture = \"x\"\r\nperiod = \".\"\r\nresult = \"1-0\" / \"0-1\" / \"*\" / \"1/2-1/2\"\r\nmove_number = mn:integer period? (period period)? {return mn}\r\nsquare = r:rank f:file {return r+f}\r\npromotion = \"=\"? [QRBN]\r\nnag = chars:(\"$\" integer) {return chars.join('')}\r\nnag_alts = \"!!\" / \"??\" / \"!?\" / \"?!\" / \"!\" / \"?\"\r\ncontinuation = period period period\r\ndisambiguation = (rank file) / rank / file\r\n\r\nmulti_line_comment_chars = [^}]\r\nmulti_line_comment = \"{\" cc:multi_line_comment_chars* \"}\" {return cc.join('');}\r\nsingle_line_comment_chars = [^\\n]\r\nsingle_line_comment = \";\" cc:single_line_comment_chars* newline {return cc.join('');}\r\ncommand_comment = '{' whitespace* cs:command+ whitespace* '}' {return cs;}\r\ncommand = '[%' key:command_key whitespace+ values:command_values ']' {return {key, values};}\r\ncommand_key = k:[a-zA-Z]+ {return k.join('');}\r\ncommand_value = v:[^,\\]]+ {return v.join('');}\r\ncommand_values = first:command_value rest:(',' command_value)* {return rest ? [first, ...flatten(rest).filter(function (cv) { return cv !== ','})] : [first];}\r\ncomment = c:(command_comment / multi_line_comment / single_line_comment) {return typeof c === 'string' ? {text: c} : {commands: c};}\r\ncomments = (whitespace* cs:comment {return cs;})+\r\n\r\npawn_half_move = (r:rank c:capture)? square promotion?\r\npiece_half_move = piece capture? square\r\npiece_disambiguation_half_move = piece disambiguation capture? square\r\ncastle_half_move = (\"O-O-O\" / \"O-O\")\r\n\r\nhalf_move = m:(continuation? \r\n    whitespace*\r\n    (castle_half_move / \r\n     piece_disambiguation_half_move / \r\n     piece_half_move / \r\n     pawn_half_move) \r\n    (check / checkmate)? \r\n    nag_alts?) {return flatten(m).join('');}\r\n\r\nmove = mn:move_number? \r\n       whitespace*\r\n       m:half_move \r\n       nags:(whitespace+ n:nag {return n})*\r\n       com:(whitespace+ c2:comment {return c2})* \r\n       ravs:(whitespace* r:rav {return r})*\r\n       {return make_move(mn, m, nags, ravs, com)}\r\n\r\nmovetext = first:move rest:(whitespace* move)* {return first ? [first].concat(rest.map(function(m) {return m[1]})) : []}\r\n\r\nrav = \"(\" \r\n    whitespace* \r\n    c:comments*\r\n    whitespace* \r\n    m:movetext \r\n    whitespace* \r\n    r:result?\r\n    whitespace*\r\n    \")\" {return make_rav(c, m, r)}\r\n";

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   parse: () => (/* binding */ parse)
/* harmony export */ });
/* harmony import */ var pegjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! pegjs */ "./node_modules/pegjs/lib/peg.js");
/* harmony import */ var pegjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(pegjs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _grammar_peg__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./grammar.peg */ "./src/grammar.peg");
/* harmony import */ var _grammar_peg__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_grammar_peg__WEBPACK_IMPORTED_MODULE_1__);


const parser = pegjs__WEBPACK_IMPORTED_MODULE_0___default().generate((_grammar_peg__WEBPACK_IMPORTED_MODULE_1___default()));

const parse = (s) => parser.parse(s);
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    parse
});

})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=pgn-parser.js.map