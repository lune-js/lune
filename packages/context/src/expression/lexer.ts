/**
 * Token kinds produced by {@link tokenize}.
 * - `num` / `str`: literals whose decoded value is carried on {@link Token.value}.
 * - `template`: a template literal, split into its static and interpolated parts.
 * - `name`: an identifier or keyword (keywords are resolved by the parser).
 * - `punct`: an operator or delimiter.
 */
export type TokenType = "num" | "str" | "template" | "name" | "punct" | "eof";

/** The static chunks of a template literal and the raw source of each `${}` interpolation. */
export interface TemplateParts {
  quasis: string[];
  expressions: string[];
}

export interface Token {
  type: TokenType;
  /** Raw text for `name`/`punct`, decoded value for `num`/`str`, empty for the rest. */
  text: string;
  value?: string | number;
  parts?: TemplateParts;
  /** Offset of the token in the source, used to build error messages. */
  start: number;
  /** Whether a line terminator precedes this token, used for statement termination. */
  newlineBefore: boolean;
}

// Ordered longest-first so that greedy matching never splits a compound operator.
const PUNCTUATORS = [
  ">>>=",
  "...",
  "===",
  "!==",
  "**=",
  "<<=",
  ">>=",
  ">>>",
  "&&=",
  "||=",
  "??=",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "?.",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "**",
  "<<",
  ">>",
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ".",
  ",",
  ";",
  ":",
  "?",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
  "~",
  "<",
  ">",
  "=",
  "&",
  "|",
  "^"
];

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0"
};

/** Thrown for malformed source; surfaced to the caller as an "Invalid expression" error. */
export class ExpressionSyntaxError extends SyntaxError {
  constructor(
    message: string,
    public position: number
  ) {
    super(message);
    this.name = "ExpressionSyntaxError";
  }
}

function isIdentifierStart(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    code === 36 || // $
    code === 95 || // _
    code > 127 // non-ascii, close enough for template expressions
  );
}

function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57);
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

/**
 * Converts an expression source string into a flat token list.
 * Comments and whitespace are discarded, but line breaks are recorded on the following token
 * so the parser can terminate statements without an explicit semicolon.
 * @param source - The raw expression or statement list.
 * @returns The tokens, always terminated by a single `eof` token.
 * @throws {ExpressionSyntaxError} When the source contains a character sequence that cannot be tokenized.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const length = source.length;
  let i = 0;
  let newlineBefore = false;

  while (i < length) {
    const char = source[i]!;
    const code = source.charCodeAt(i);

    // whitespace and comments
    if (code === 10 || code === 13 || code === 8232 || code === 8233) {
      newlineBefore = true;
      i++;
      continue;
    }
    if (code === 32 || code === 9 || code === 11 || code === 12 || code === 160 || code === 65279) {
      i++;
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      while (i < length && source.charCodeAt(i) !== 10) i++;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) throw new ExpressionSyntaxError("Unterminated comment", i);
      if (source.slice(i, end).includes("\n")) newlineBefore = true;
      i = end + 2;
      continue;
    }

    const start = i;

    // identifiers and keywords
    if (isIdentifierStart(code)) {
      i++;
      while (i < length && isIdentifierPart(source.charCodeAt(i))) i++;
      tokens.push({ type: "name", text: source.slice(start, i), start, newlineBefore });
      newlineBefore = false;
      continue;
    }

    // numbers, including a leading-dot form such as `.5`
    if (isDigit(code) || (char === "." && isDigit(source.charCodeAt(i + 1)))) {
      i = scanNumberEnd(source, i);
      const text = source.slice(start, i);
      const value = Number(text);
      if (Number.isNaN(value)) throw new ExpressionSyntaxError(`Invalid number "${text}"`, start);
      tokens.push({ type: "num", text, value, start, newlineBefore });
      newlineBefore = false;
      continue;
    }

    // strings
    if (char === '"' || char === "'") {
      const [value, next] = scanString(source, i, char);
      tokens.push({ type: "str", text: source.slice(start, next), value, start, newlineBefore });
      i = next;
      newlineBefore = false;
      continue;
    }

    // template literals
    if (char === "`") {
      const [parts, next] = scanTemplate(source, i);
      tokens.push({ type: "template", text: source.slice(start, next), parts, start, newlineBefore });
      i = next;
      newlineBefore = false;
      continue;
    }

    const punctuator = PUNCTUATORS.find((p) => source.startsWith(p, i));
    if (!punctuator) throw new ExpressionSyntaxError(`Unexpected character "${char}"`, i);
    i += punctuator.length;
    tokens.push({ type: "punct", text: punctuator, start, newlineBefore });
    newlineBefore = false;
  }

  tokens.push({ type: "eof", text: "", start: length, newlineBefore });
  return tokens;
}

function scanNumberEnd(source: string, start: number): number {
  let i = start;
  // hex, octal and binary literals
  if (source[i] === "0" && /[xXoObB]/.test(source[i + 1] ?? "")) {
    i += 2;
    while (i < source.length && /[0-9a-fA-F]/.test(source[i]!)) i++;
    return i;
  }
  while (i < source.length && isDigit(source.charCodeAt(i))) i++;
  if (source[i] === ".") {
    i++;
    while (i < source.length && isDigit(source.charCodeAt(i))) i++;
  }
  if (source[i] === "e" || source[i] === "E") {
    let exponent = i + 1;
    if (source[exponent] === "+" || source[exponent] === "-") exponent++;
    if (isDigit(source.charCodeAt(exponent))) {
      i = exponent;
      while (i < source.length && isDigit(source.charCodeAt(i))) i++;
    }
  }
  return i;
}

/**
 * Reads a quoted string starting at `start`, decoding escape sequences.
 * @returns The decoded value and the offset just past the closing quote.
 */
function scanString(source: string, start: number, quote: string): [string, number] {
  let value = "";
  let i = start + 1;
  while (i < source.length) {
    const char = source[i]!;
    if (char === quote) return [value, i + 1];
    if (char === "\\") {
      const [decoded, next] = decodeEscape(source, i);
      value += decoded;
      i = next;
      continue;
    }
    value += char;
    i++;
  }
  throw new ExpressionSyntaxError("Unterminated string", start);
}

function decodeEscape(source: string, start: number): [string, number] {
  const char = source[start + 1];
  if (char === undefined) throw new ExpressionSyntaxError("Unterminated escape sequence", start);
  if (char === "u") {
    if (source[start + 2] === "{") {
      const end = source.indexOf("}", start + 3);
      if (end === -1) throw new ExpressionSyntaxError("Unterminated unicode escape", start);
      return [String.fromCodePoint(parseInt(source.slice(start + 3, end), 16)), end + 1];
    }
    return [String.fromCharCode(parseInt(source.slice(start + 2, start + 6), 16)), start + 6];
  }
  if (char === "x") {
    return [String.fromCharCode(parseInt(source.slice(start + 2, start + 4), 16)), start + 4];
  }
  // an escaped line terminator continues the literal without contributing a character
  if (char === "\n") return ["", start + 2];
  return [ESCAPES[char] ?? char, start + 2];
}

/**
 * Reads a template literal, keeping each `${}` interpolation as raw source for the parser to
 * re-enter recursively. Nested templates, strings and object literals are skipped by depth
 * tracking so that braces inside them do not close the interpolation early.
 * @returns The split parts and the offset just past the closing backtick.
 */
function scanTemplate(source: string, start: number): [TemplateParts, number] {
  const quasis: string[] = [];
  const expressions: string[] = [];
  let current = "";
  let i = start + 1;

  while (i < source.length) {
    const char = source[i]!;
    if (char === "`") {
      quasis.push(current);
      return [{ quasis, expressions }, i + 1];
    }
    if (char === "\\") {
      const [decoded, next] = decodeEscape(source, i);
      current += decoded;
      i = next;
      continue;
    }
    if (char === "$" && source[i + 1] === "{") {
      quasis.push(current);
      current = "";
      const end = scanInterpolationEnd(source, i + 2);
      expressions.push(source.slice(i + 2, end));
      i = end + 1;
      continue;
    }
    current += char;
    i++;
  }

  throw new ExpressionSyntaxError("Unterminated template literal", start);
}

/** Finds the `}` that closes a `${` interpolation, skipping nested braces, strings and templates. */
function scanInterpolationEnd(source: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const char = source[i]!;
    if (char === "}" && depth === 0) return i;
    if (char === "{") depth++;
    else if (char === "}") depth--;
    else if (char === '"' || char === "'") i = scanString(source, i, char)[1] - 1;
    else if (char === "`") i = scanTemplate(source, i)[1] - 1;
    i++;
  }
  throw new ExpressionSyntaxError("Unterminated template interpolation", start);
}
