import { error, warn } from "@lune-js/utils";

const evalCache: Record<string, Function> = Object.create(null);

// Expression validation patterns - more conservative to avoid blocking legitimate code
const DANGEROUS_PATTERNS = [
  /\b(eval|Function|setTimeout|setInterval|XMLHttpRequest|fetch|WebSocket|Worker)\b/,
  /\b(window|document|globalThis|global|process|require|import|export)\b/,
  /\b(delete|void|typeof|instanceof)\b.*\(/
];

export function evaluate(scope: any, exp: string, el?: Node): any {
  if (!exp.trim()) {
    if (import.meta.env.DEV) {
      warn("Empty expression. `evaluate` must contain an expression.");
    }
    return undefined;
  }

  return execute(scope, `return(${exp})`, el);
}

export function execute(scope: any, exp: string, el?: Node): any {
  if (!validateExpression(exp)) {
    if (import.meta.env.DEV) {
      warn(`Potentially unsafe expression rejected: "${exp}"`);
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

function toFunction(exp: string): Function {
  try {
    // * Added expression engine in v1.0.0. Keeping comments below for context.
    // ! High Risk: Implied eval. Do not use the Function constructor to create functions.
    // TODO: `with` is deprecated https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with
    // ? https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with#avoiding_the_with_statement_by_using_an_iife
    // oxlint-disable-next-line
    return new Function(`$data`, `$el`, `with($data){${exp}}`);
  } catch (e) {
    if (import.meta.env.DEV) {
      error(`Invalid expression: "${exp}"`, e);
    }
    return () => {};
  }
}

function validateExpression(exp: string): boolean {
  if (exp == null || exp === "" || exp.length > 1000) return false;
  return !DANGEROUS_PATTERNS.some((pattern) => pattern.test(exp));
}
