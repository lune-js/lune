import { error, warn } from "@lune-js/utils";
import type { CompiledExpression } from "./expression/compiler";
import { compile, UnsafeExpressionError } from "./expression/compiler";
import { parse } from "./expression/parser";

export { allowGlobals } from "./expression/globals";

/**
 * Upper bound on expression source length. Template bindings are short by nature, so anything
 * longer is either generated or hostile, and is cheaper to reject than to parse.
 */
const MAX_EXPRESSION_LENGTH = 1000;

const evalCache: Record<string, CompiledExpression> = Object.create(null);

/** Stand-in for expressions that failed to compile, so a broken binding is only reported once. */
const noop: CompiledExpression = () => undefined;

/**
 * Evaluates a single expression against a scope and returns its value.
 * @param scope - The reactive data object the expression reads from.
 * @param exp - The expression source, without a trailing semicolon or statement.
 * @param el - The element the binding belongs to, exposed to the expression as `$el`.
 * @returns The value the expression produced, or `undefined` when it could not be run.
 */
export function evaluate(scope: any, exp: string, el?: Node): any {
  if (!exp.trim()) {
    if (import.meta.env.DEV) {
      warn("Empty expression. `evaluate` must contain an expression.");
    }
    return undefined;
  }

  return execute(scope, `return(${exp})`, el);
}

/**
 * Runs a statement list against a scope. Compilation happens once per unique source and is cached;
 * every later run reuses the compiled closure tree.
 * @param scope - The reactive data object the statements read from and write to.
 * @param exp - The source to run, which may contain several statements.
 * @param el - The element the binding belongs to, exposed to the expression as `$el`.
 * @returns The value returned by the source, or `undefined` when it could not be run.
 */
export function execute(scope: any, exp: string, el?: Node): any {
  if (exp.length > MAX_EXPRESSION_LENGTH) {
    if (import.meta.env.DEV) {
      warn(`Expression exceeds the ${MAX_EXPRESSION_LENGTH} character limit and was rejected.`);
    }
    return undefined;
  }

  const fn = evalCache[exp] ?? (evalCache[exp] = toFunction(exp));
  try {
    return fn(scope, el);
  } catch (e) {
    if (import.meta.env.DEV) {
      error(`Failed to execute expression "${exp}":`, e);
    }
    // Remove from cache on error to prevent future failures
    delete evalCache[exp];
    return undefined;
  }
}

/**
 * Parses and compiles an expression into a closure tree.
 * The engine is a self contained parser and interpreter, so no dynamic code is created and the
 * library stays usable under a Content Security Policy that forbids `unsafe-eval`.
 * @param exp - The expression source to compile.
 * @returns The compiled expression, or a no-op when the source is invalid or unsafe.
 */
function toFunction(exp: string): CompiledExpression {
  try {
    const program = parse(exp);
    if (program.body.length === 0) {
      if (import.meta.env.DEV) {
        warn(`Empty expression. \`execute\` must contain at least one statement.`);
      }
      return noop;
    }
    return compile(program);
  } catch (e) {
    if (import.meta.env.DEV) {
      if (e instanceof UnsafeExpressionError) {
        warn(`Potentially unsafe expression rejected: "${exp}"`, e.message);
      } else {
        error(`Invalid expression: "${exp}"`, e);
      }
    }
    return noop;
  }
}
