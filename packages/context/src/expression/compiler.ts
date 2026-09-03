import { BLOCKED_IDENTIFIERS, getGlobal, hasGlobal, UNSAFE_KEYS } from "./globals";
import type { Expression, ObjectProperty, Program, SpreadElement, Statement } from "./parser";

/** Raised when an expression is syntactically valid but reaches for something it is not allowed to. */
export class UnsafeExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeExpressionError";
  }
}

/** Local bindings introduced by arrow parameters and `let`/`const`/`var` declarations. */
interface Frame {
  vars: Record<string, unknown>;
  parent: Frame | null;
}

/** Per-invocation state: the data scope, the bound element, locals, and the pending return value. */
interface Runtime {
  scope: any;
  el: Node | undefined;
  frame: Frame | null;
  returned: boolean;
  result: unknown;
}

type Evaluator = (rt: Runtime) => unknown;
type Executor = (rt: Runtime) => void;
type Assigner = (rt: Runtime, value: unknown) => void;

/** A parsed and compiled expression, ready to run against any scope. */
export type CompiledExpression = (scope: any, el?: Node) => unknown;

/**
 * Propagated by an optional chain whose base was nullish. It travels up the member and call links
 * of the chain and is turned back into `undefined` at the chain root, matching `?.` short circuiting.
 */
const SHORT_CIRCUIT = Symbol("short-circuit");

const NO_ARGS: unknown[] = [];

/**
 * Compiles a parsed program into a reusable closure.
 * The AST is walked once, here; running the result never touches the AST or the source again.
 * @param program - The parsed statement list.
 * @returns A function that runs the program against a scope and returns the value it returns.
 * @throws {UnsafeExpressionError} When the program references a blocked identifier or property.
 */
export function compile(program: Program): CompiledExpression {
  const body = compileStatements(program.body);

  return (scope, el) => {
    const rt: Runtime = { scope, el, frame: null, returned: false, result: undefined };
    body(rt);
    return rt.result;
  };
}

// ------------------------------------------------------------------ statements

function compileStatements(statements: Statement[]): Executor {
  const compiled = statements.map(compileStatement);

  if (compiled.length === 1) return compiled[0]!;

  return (rt) => {
    for (let i = 0; i < compiled.length; i++) {
      compiled[i]!(rt);
      if (rt.returned) return;
    }
  };
}

function compileStatement(statement: Statement): Executor {
  switch (statement.type) {
    case "ExpressionStatement": {
      const expression = compileExpression(statement.expression);
      return (rt) => void expression(rt);
    }
    case "ReturnStatement": {
      const argument = statement.argument && compileExpression(statement.argument);
      return (rt) => {
        rt.result = argument ? unwrap(argument(rt)) : undefined;
        rt.returned = true;
      };
    }
    case "IfStatement": {
      const test = compileExpression(statement.test);
      const consequent = compileStatement(statement.consequent);
      const alternate = statement.alternate && compileStatement(statement.alternate);
      return (rt) => {
        if (unwrap(test(rt))) consequent(rt);
        else if (alternate) alternate(rt);
      };
    }
    case "ThrowStatement": {
      const argument = compileExpression(statement.argument);
      return (rt) => {
        throw unwrap(argument(rt));
      };
    }
    case "BlockStatement":
      return compileStatements(statement.body);
    case "VariableDeclaration": {
      const declarations = statement.declarations.map(({ name, init }) => {
        assertAllowedIdentifier(name);
        return { name, init: init && compileExpression(init) };
      });
      return (rt) => {
        const frame = (rt.frame ??= { vars: Object.create(null), parent: null });
        for (const { name, init } of declarations) {
          frame.vars[name] = init ? unwrap(init(rt)) : undefined;
        }
      };
    }
    case "EmptyStatement":
      return () => {};
  }
}

// ----------------------------------------------------------------- expressions

function compileExpression(node: Expression): Evaluator {
  switch (node.type) {
    case "Literal": {
      const { value } = node;
      return () => value;
    }
    case "Identifier":
      return compileIdentifier(node.name);
    case "ThisExpression":
      return (rt) => rt.scope;
    case "ChainExpression": {
      const expression = compileExpression(node.expression);
      return (rt) => unwrap(expression(rt));
    }
    case "TemplateLiteral":
      return compileTemplate(node.quasis, node.expressions);
    case "ArrayExpression":
      return compileArray(node.elements);
    case "ObjectExpression":
      return compileObject(node.properties);
    case "MemberExpression":
      return compileMember(node);
    case "CallExpression":
      return compileCall(node);
    case "NewExpression": {
      const callee = compileExpression(node.callee);
      const args = compileArguments(node.args);
      return (rt) => {
        const target = unwrap(callee(rt));
        if (typeof target !== "function") throw new TypeError(`${describe(node.callee)} is not a constructor`);
        return Reflect.construct(target, args(rt));
      };
    }
    case "UnaryExpression":
      return compileUnary(node.operator, node.argument);
    case "UpdateExpression":
      return compileUpdate(node);
    case "BinaryExpression":
      return compileBinary(node.operator, node.left, node.right);
    case "LogicalExpression":
      return compileLogical(node.operator, node.left, node.right);
    case "ConditionalExpression": {
      const test = compileExpression(node.test);
      const consequent = compileExpression(node.consequent);
      const alternate = compileExpression(node.alternate);
      return (rt) => (unwrap(test(rt)) ? unwrap(consequent(rt)) : unwrap(alternate(rt)));
    }
    case "AssignmentExpression":
      return compileAssignment(node);
    case "ArrowFunctionExpression":
      return compileArrow(node.params, node.body);
  }
}

/**
 * Resolves a bare identifier the way the previous `with(scope)` block did: locals first, then the
 * reactive scope (which keeps property reads tracked), then the element and scope aliases, and
 * finally the allowed globals.
 */
function compileIdentifier(name: string): Evaluator {
  assertAllowedIdentifier(name);

  return (rt) => {
    for (let frame = rt.frame; frame; frame = frame.parent) {
      if (name in frame.vars) return frame.vars[name];
    }
    const { scope } = rt;
    if (scope != null && name in scope) return scope[name];
    if (name === "$data") return scope;
    if (name === "$el") return rt.el;
    if (hasGlobal(name)) return getGlobal(name);
    throw new ReferenceError(`${name} is not defined`);
  };
}

function compileTemplate(quasis: string[], expressions: Expression[]): Evaluator {
  const compiled = expressions.map(compileExpression);
  return (rt) => {
    let result = quasis[0] ?? "";
    for (let i = 0; i < compiled.length; i++) {
      result += String(unwrap(compiled[i]!(rt))) + (quasis[i + 1] ?? "");
    }
    return result;
  };
}

function compileArray(elements: (Expression | SpreadElement | null)[]): Evaluator {
  const compiled = elements.map(
    (element) =>
      element && { spread: element.type === "SpreadElement", value: compileExpression(elementValue(element)) }
  );

  return (rt) => {
    const result: unknown[] = [];
    for (const element of compiled) {
      if (!element) {
        result.length++; // elision
      } else if (element.spread) {
        result.push(...(unwrap(element.value(rt)) as Iterable<unknown>));
      } else {
        result.push(unwrap(element.value(rt)));
      }
    }
    return result;
  };
}

function compileObject(properties: ObjectProperty[]): Evaluator {
  const compiled = properties.map((property) => {
    if (property.key === null) {
      return { spread: true as const, value: compileExpression(property.value) };
    }
    if (!property.computed && property.key.type === "Literal" && property.key.value === "__proto__") {
      throw new UnsafeExpressionError('"__proto__" cannot be set from an expression.');
    }
    return {
      spread: false as const,
      key: compileExpression(property.key),
      value: compileExpression(property.value)
    };
  });

  return (rt) => {
    const result: Record<string, unknown> = {};
    for (const property of compiled) {
      if (property.spread) {
        Object.assign(result, unwrap(property.value(rt)));
      } else {
        const key = unwrap(property.key(rt)) as string;
        assertSafeKey(key);
        result[key] = unwrap(property.value(rt));
      }
    }
    return result;
  };
}

function compileMember(node: Extract<Expression, { type: "MemberExpression" }>): Evaluator {
  const object = compileExpression(node.object);
  const optional = node.optional;

  if (!node.computed) {
    const key = (node.property as { type: "Literal"; value: string }).value;
    assertSafeKey(key);
    return (rt) => {
      const target = object(rt);
      if (target === SHORT_CIRCUIT) return SHORT_CIRCUIT;
      if (target == null) {
        if (optional) return SHORT_CIRCUIT;
        throw new TypeError(`Cannot read "${key}" of ${target}`);
      }
      return (target as Record<string, unknown>)[key];
    };
  }

  const property = compileExpression(node.property);
  return (rt) => {
    const target = object(rt);
    if (target === SHORT_CIRCUIT) return SHORT_CIRCUIT;
    const key = unwrap(property(rt)) as string;
    if (target == null) {
      if (optional) return SHORT_CIRCUIT;
      throw new TypeError(`Cannot read "${String(key)}" of ${target}`);
    }
    assertSafeKey(key);
    return (target as Record<string, unknown>)[key];
  };
}

/**
 * Compiles a call, preserving the receiver rules of the previous implementation: a method reached
 * through a member expression is called on its object, and a bare scope member is called on the
 * scope, so `this` keeps working inside scope methods.
 */
function compileCall(node: Extract<Expression, { type: "CallExpression" }>): Evaluator {
  const args = compileArguments(node.args);
  const optional = node.optional;
  const label = describe(node.callee);

  if (node.callee.type === "MemberExpression") {
    const objectNode = node.callee;
    const object = compileExpression(objectNode.object);
    if (!objectNode.computed) assertSafeKey((objectNode.property as { value: unknown }).value);
    const property = compileExpression(objectNode.property);
    const memberOptional = objectNode.optional;

    return (rt) => {
      const target = object(rt);
      if (target === SHORT_CIRCUIT) return SHORT_CIRCUIT;
      if (target == null) {
        if (memberOptional) return SHORT_CIRCUIT;
        throw new TypeError(`Cannot read "${label}" of ${target}`);
      }
      const key = unwrap(property(rt)) as string;
      assertSafeKey(key);
      const fn = (target as Record<string, unknown>)[key];
      if (fn == null && optional) return SHORT_CIRCUIT;
      return invoke(fn, target, args(rt), label);
    };
  }

  if (node.callee.type === "Identifier") {
    const name = node.callee.name;
    assertAllowedIdentifier(name);

    return (rt) => {
      for (let frame = rt.frame; frame; frame = frame.parent) {
        if (name in frame.vars) return invoke(frame.vars[name], undefined, args(rt), name, optional);
      }
      const { scope } = rt;
      // scope methods are invoked on the scope so that `this` resolves to the data object
      if (scope != null && name in scope) return invoke(scope[name], scope, args(rt), name, optional);
      if (hasGlobal(name)) return invoke(getGlobal(name), globalThis, args(rt), name, optional);
      throw new ReferenceError(`${name} is not defined`);
    };
  }

  const callee = compileExpression(node.callee);
  return (rt) => {
    const fn = callee(rt);
    if (fn === SHORT_CIRCUIT) return SHORT_CIRCUIT;
    return invoke(fn, undefined, args(rt), label, optional);
  };
}

function compileArguments(nodes: (Expression | SpreadElement)[]): (rt: Runtime) => unknown[] {
  if (nodes.length === 0) return () => NO_ARGS;

  const compiled = nodes.map((node) => ({
    spread: node.type === "SpreadElement",
    value: compileExpression(elementValue(node))
  }));

  if (compiled.every((argument) => !argument.spread)) {
    return (rt) => compiled.map((argument) => unwrap(argument.value(rt)));
  }

  return (rt) => {
    const args: unknown[] = [];
    for (const argument of compiled) {
      if (argument.spread) args.push(...(unwrap(argument.value(rt)) as Iterable<unknown>));
      else args.push(unwrap(argument.value(rt)));
    }
    return args;
  };
}

function compileUnary(operator: string, argument: Expression): Evaluator {
  if (operator === "delete") {
    throw new UnsafeExpressionError("The `delete` operator is not allowed in expressions.");
  }

  // `typeof someUndeclared` must answer "undefined" rather than throwing, as it does in JavaScript
  if (operator === "typeof" && argument.type === "Identifier") {
    const identifier = compileIdentifier(argument.name);
    return (rt) => {
      try {
        return typeof unwrap(identifier(rt));
      } catch (e) {
        if (e instanceof ReferenceError) return "undefined";
        throw e;
      }
    };
  }

  const value = compileExpression(argument);
  switch (operator) {
    case "!":
      return (rt) => !unwrap(value(rt));
    case "-":
      return (rt) => -(unwrap(value(rt)) as number);
    case "+":
      return (rt) => +(unwrap(value(rt)) as number);
    case "~":
      return (rt) => ~(unwrap(value(rt)) as number);
    case "typeof":
      return (rt) => typeof unwrap(value(rt));
    case "void":
      return (rt) => void unwrap(value(rt));
    default:
      throw new UnsafeExpressionError(`Unsupported unary operator "${operator}".`);
  }
}

function compileUpdate(node: Extract<Expression, { type: "UpdateExpression" }>): Evaluator {
  const read = compileExpression(node.argument);
  const write = compileAssigner(node.argument);
  const delta = node.operator === "++" ? 1 : -1;
  const { prefix } = node;

  return (rt) => {
    const previous = Number(unwrap(read(rt)));
    const next = previous + delta;
    write(rt, next);
    return prefix ? next : previous;
  };
}

function compileBinary(operator: string, leftNode: Expression, rightNode: Expression): Evaluator {
  const left = compileExpression(leftNode);
  const right = compileExpression(rightNode);

  // typed as `any` because these operators are intentionally as loose as the JavaScript they mirror
  const l = (rt: Runtime) => unwrap(left(rt)) as any;
  const r = (rt: Runtime) => unwrap(right(rt)) as any;

  switch (operator) {
    case "+":
      return (rt) => l(rt) + r(rt);
    case "-":
      return (rt) => l(rt) - r(rt);
    case "*":
      return (rt) => l(rt) * r(rt);
    case "/":
      return (rt) => l(rt) / r(rt);
    case "%":
      return (rt) => l(rt) % r(rt);
    case "**":
      return (rt) => l(rt) ** r(rt);
    case "==":
      return (rt) => l(rt) == r(rt);
    case "!=":
      return (rt) => l(rt) != r(rt);
    case "===":
      return (rt) => l(rt) === r(rt);
    case "!==":
      return (rt) => l(rt) !== r(rt);
    case "<":
      return (rt) => l(rt) < r(rt);
    case ">":
      return (rt) => l(rt) > r(rt);
    case "<=":
      return (rt) => l(rt) <= r(rt);
    case ">=":
      return (rt) => l(rt) >= r(rt);
    case "&":
      return (rt) => l(rt) & r(rt);
    case "|":
      return (rt) => l(rt) | r(rt);
    case "^":
      return (rt) => l(rt) ^ r(rt);
    case "<<":
      return (rt) => l(rt) << r(rt);
    case ">>":
      return (rt) => l(rt) >> r(rt);
    case ">>>":
      return (rt) => l(rt) >>> r(rt);
    case "in":
      return (rt) => l(rt) in r(rt);
    case "instanceof":
      return (rt) => l(rt) instanceof r(rt);
    default:
      throw new UnsafeExpressionError(`Unsupported operator "${operator}".`);
  }
}

function compileLogical(operator: string, leftNode: Expression, rightNode: Expression): Evaluator {
  const left = compileExpression(leftNode);
  const right = compileExpression(rightNode);

  switch (operator) {
    case "&&":
      return (rt) => {
        const value = unwrap(left(rt));
        return value ? unwrap(right(rt)) : value;
      };
    case "||":
      return (rt) => {
        const value = unwrap(left(rt));
        return value ? value : unwrap(right(rt));
      };
    default:
      return (rt) => {
        const value = unwrap(left(rt));
        return value ?? unwrap(right(rt));
      };
  }
}

function compileAssignment(node: Extract<Expression, { type: "AssignmentExpression" }>): Evaluator {
  const write = compileAssigner(node.left);
  const right = compileExpression(node.right);
  const { operator } = node;

  if (operator === "=") {
    return (rt) => {
      const value = unwrap(right(rt));
      write(rt, value);
      return value;
    };
  }

  const read = compileExpression(node.left);

  // logical assignment only evaluates the right hand side when the current value calls for it
  if (operator === "&&=" || operator === "||=" || operator === "??=") {
    return (rt) => {
      const current = unwrap(read(rt));
      const shouldAssign =
        operator === "&&="
          ? Boolean(current)
          : operator === "||="
            ? !current
            : current === null || current === undefined;
      if (!shouldAssign) return current;
      const value = unwrap(right(rt));
      write(rt, value);
      return value;
    };
  }

  const apply = compileBinaryOperation(operator.slice(0, -1));
  return (rt) => {
    const value = apply(unwrap(read(rt)), unwrap(right(rt)));
    write(rt, value);
    return value;
  };
}

/** Builds the arithmetic half of a compound assignment such as `+=`. */
function compileBinaryOperation(operator: string): (left: any, right: any) => unknown {
  switch (operator) {
    case "+":
      return (left, right) => left + right;
    case "-":
      return (left, right) => left - right;
    case "*":
      return (left, right) => left * right;
    case "/":
      return (left, right) => left / right;
    case "%":
      return (left, right) => left % right;
    case "**":
      return (left, right) => left ** right;
    case "&":
      return (left, right) => left & right;
    case "|":
      return (left, right) => left | right;
    case "^":
      return (left, right) => left ^ right;
    case "<<":
      return (left, right) => left << right;
    case ">>":
      return (left, right) => left >> right;
    case ">>>":
      return (left, right) => left >>> right;
    default:
      throw new UnsafeExpressionError(`Unsupported assignment operator "${operator}=".`);
  }
}

/**
 * Compiles the write half of an assignment target. Writes to a bare name go to the scope, which
 * lets the scoped context proxy forward them to a parent scope when the property is inherited.
 */
function compileAssigner(target: Expression): Assigner {
  if (target.type === "Identifier") {
    const name = target.name;
    assertAllowedIdentifier(name);
    return (rt, value) => {
      for (let frame = rt.frame; frame; frame = frame.parent) {
        if (name in frame.vars) {
          frame.vars[name] = value;
          return;
        }
      }
      rt.scope[name] = value;
    };
  }

  if (target.type === "MemberExpression") {
    const object = compileExpression(target.object);
    const property = compileExpression(target.property);
    return (rt, value) => {
      const receiver = unwrap(object(rt));
      if (receiver == null) throw new TypeError(`Cannot assign to a property of ${receiver}`);
      const key = unwrap(property(rt)) as string;
      assertSafeKey(key);
      (receiver as Record<string, unknown>)[key] = value;
    };
  }

  throw new UnsafeExpressionError("Invalid assignment target.");
}

function compileArrow(params: string[], body: Expression | Statement[]): Evaluator {
  params.forEach(assertAllowedIdentifier);
  const isBlock = Array.isArray(body);
  const run = isBlock ? compileStatements(body) : compileExpression(body);

  return (rt) => {
    // the defining runtime is captured so the arrow keeps its lexical scope, element and locals
    const { scope, el, frame: closure } = rt;

    return (...args: unknown[]) => {
      const vars: Record<string, unknown> = Object.create(null);
      for (let i = 0; i < params.length; i++) vars[params[i]!] = args[i];

      const child: Runtime = { scope, el, frame: { vars, parent: closure }, returned: false, result: undefined };
      if (!isBlock) return unwrap((run as Evaluator)(child));
      (run as Executor)(child);
      return child.result;
    };
  };
}

// --------------------------------------------------------------------- helpers

function invoke(fn: unknown, thisArg: unknown, args: unknown[], label: string, optional = false): unknown {
  if (fn == null && optional) return SHORT_CIRCUIT;
  if (typeof fn !== "function") throw new TypeError(`${label} is not a function`);
  return Reflect.apply(fn, thisArg, args);
}

/** Converts a short circuited optional chain back into `undefined` at the point of consumption. */
function unwrap(value: unknown): unknown {
  return value === SHORT_CIRCUIT ? undefined : value;
}

function elementValue(node: Expression | SpreadElement): Expression {
  return node.type === "SpreadElement" ? node.argument : node;
}

function assertAllowedIdentifier(name: string): void {
  if (BLOCKED_IDENTIFIERS.has(name)) {
    throw new UnsafeExpressionError(`"${name}" is not available to expressions.`);
  }
}

function assertSafeKey(key: unknown): void {
  if (typeof key === "string" && UNSAFE_KEYS.has(key)) {
    throw new UnsafeExpressionError(`"${key}" cannot be accessed from an expression.`);
  }
}

/** Best effort description of a callee, used for `x is not a function` style messages. */
function describe(node: Expression): string {
  switch (node.type) {
    case "Identifier":
      return node.name;
    case "MemberExpression":
      return node.computed || node.property.type !== "Literal"
        ? `${describe(node.object)}[...]`
        : `${describe(node.object)}.${String(node.property.value)}`;
    case "CallExpression":
      return `${describe(node.callee)}(...)`;
    default:
      return "expression";
  }
}
