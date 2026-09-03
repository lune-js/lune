import type { Token, TokenType } from "./lexer";
import { ExpressionSyntaxError, tokenize } from "./lexer";

export interface Program {
  type: "Program";
  body: Statement[];
}

export type Statement =
  | { type: "ExpressionStatement"; expression: Expression }
  | { type: "ReturnStatement"; argument: Expression | null }
  | { type: "IfStatement"; test: Expression; consequent: Statement; alternate: Statement | null }
  | { type: "ThrowStatement"; argument: Expression }
  | { type: "BlockStatement"; body: Statement[] }
  | { type: "VariableDeclaration"; declarations: { name: string; init: Expression | null }[] }
  | { type: "EmptyStatement" };

export type Expression =
  | { type: "Literal"; value: unknown }
  | { type: "Identifier"; name: string }
  | { type: "ThisExpression" }
  | { type: "TemplateLiteral"; quasis: string[]; expressions: Expression[] }
  | { type: "ArrayExpression"; elements: (Expression | SpreadElement | null)[] }
  | { type: "ObjectExpression"; properties: ObjectProperty[] }
  | { type: "MemberExpression"; object: Expression; property: Expression; computed: boolean; optional: boolean }
  | { type: "CallExpression"; callee: Expression; args: (Expression | SpreadElement)[]; optional: boolean }
  | { type: "NewExpression"; callee: Expression; args: (Expression | SpreadElement)[] }
  | { type: "UnaryExpression"; operator: string; argument: Expression }
  | { type: "UpdateExpression"; operator: string; argument: Expression; prefix: boolean }
  | { type: "BinaryExpression"; operator: string; left: Expression; right: Expression }
  | { type: "LogicalExpression"; operator: string; left: Expression; right: Expression }
  | { type: "ConditionalExpression"; test: Expression; consequent: Expression; alternate: Expression }
  | { type: "AssignmentExpression"; operator: string; left: Expression; right: Expression }
  | { type: "ArrowFunctionExpression"; params: string[]; body: Expression | Statement[] }
  | { type: "ChainExpression"; expression: Expression };

export interface SpreadElement {
  type: "SpreadElement";
  argument: Expression;
}

export interface ObjectProperty {
  /** `null` marks a spread entry, whose source object is held by {@link ObjectProperty.value}. */
  key: Expression | null;
  computed: boolean;
  value: Expression;
}

// Binary operators mapped to their binding power; higher binds tighter.
const BINARY_PRECEDENCE: Record<string, number> = {
  "??": 1,
  "||": 2,
  "&&": 3,
  "|": 4,
  "^": 5,
  "&": 6,
  "==": 7,
  "!=": 7,
  "===": 7,
  "!==": 7,
  "<": 8,
  ">": 8,
  "<=": 8,
  ">=": 8,
  in: 8,
  instanceof: 8,
  "<<": 9,
  ">>": 9,
  ">>>": 9,
  "+": 10,
  "-": 10,
  "*": 11,
  "/": 11,
  "%": 11,
  "**": 12
};

const LOGICAL_OPERATORS = new Set(["&&", "||", "??"]);
const UNARY_OPERATORS = new Set(["-", "+", "!", "~", "typeof", "void", "delete"]);
const ASSIGNMENT_OPERATORS = new Set([
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**=",
  "<<=",
  ">>=",
  ">>>=",
  "&=",
  "|=",
  "^=",
  "&&=",
  "||=",
  "??="
]);

// Keywords the engine deliberately does not implement. Rejecting them by name keeps the failure
// mode a clear syntax error instead of a confusing "x is not defined" at runtime.
const UNSUPPORTED_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "continue",
  "debugger",
  "default",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "import",
  "super",
  "switch",
  "try",
  "while",
  "with",
  "yield"
]);

const DECLARATION_KEYWORDS = new Set(["const", "let", "var"]);

/**
 * Recursive descent parser for the expression subset supported by template bindings.
 * Instances are single use; {@link parse} and {@link parseExpressionSource} drive the whole flow.
 */
class Parser {
  private tokens: Token[];
  private index = 0;

  constructor(private source: string) {
    this.tokens = tokenize(source);
  }

  parseProgram(): Program {
    const body: Statement[] = [];
    while (!this.isType("eof")) {
      body.push(this.parseStatement());
    }
    return { type: "Program", body };
  }

  // ---------------------------------------------------------------- statements

  private parseStatement(): Statement {
    const token = this.peek();

    if (token.type === "punct") {
      if (token.text === ";") {
        this.next();
        return { type: "EmptyStatement" };
      }
      if (token.text === "{") return this.parseBlock();
    }

    if (token.type === "name") {
      switch (token.text) {
        case "return": {
          this.next();
          const argument = this.canEndStatement() ? null : this.parseExpression();
          this.consumeTerminator();
          return { type: "ReturnStatement", argument };
        }
        case "if":
          return this.parseIf();
        case "throw": {
          this.next();
          const argument = this.parseExpression();
          this.consumeTerminator();
          return { type: "ThrowStatement", argument };
        }
        default:
          if (DECLARATION_KEYWORDS.has(token.text)) return this.parseVariableDeclaration();
      }
    }

    const expression = this.parseExpression();
    this.consumeTerminator();
    return { type: "ExpressionStatement", expression };
  }

  private parseBlock(): { type: "BlockStatement"; body: Statement[] } {
    this.expect("{");
    const body: Statement[] = [];
    while (!this.isPunct("}")) {
      if (this.isType("eof")) throw this.error("Unexpected end of expression, expected `}`");
      body.push(this.parseStatement());
    }
    this.next();
    return { type: "BlockStatement", body };
  }

  private parseIf(): Statement {
    this.next();
    this.expect("(");
    const test = this.parseExpression();
    this.expect(")");
    const consequent = this.parseStatement();
    let alternate: Statement | null = null;
    if (this.isName("else")) {
      this.next();
      alternate = this.parseStatement();
    }
    return { type: "IfStatement", test, consequent, alternate };
  }

  private parseVariableDeclaration(): Statement {
    this.next();
    const declarations: { name: string; init: Expression | null }[] = [];
    do {
      const name = this.parseIdentifierName();
      let init: Expression | null = null;
      if (this.isPunct("=")) {
        this.next();
        init = this.parseAssignment();
      }
      declarations.push({ name, init });
    } while (this.consumeIf(","));
    this.consumeTerminator();
    return { type: "VariableDeclaration", declarations };
  }

  /** Accepts `;`, a closing brace, end of input or a preceding line break as a statement end. */
  private consumeTerminator(): void {
    if (this.consumeIf(";")) return;
    if (this.canEndStatement()) return;
    throw this.error(`Unexpected token "${this.peek().text}"`);
  }

  private canEndStatement(): boolean {
    const token = this.peek();
    if (token.type === "eof" || token.newlineBefore) return true;
    return token.type === "punct" && (token.text === "}" || token.text === ";");
  }

  // --------------------------------------------------------------- expressions

  parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    if (this.isArrowAhead()) return this.parseArrow();

    const left = this.parseConditional();
    const token = this.peek();
    if (token.type === "punct" && ASSIGNMENT_OPERATORS.has(token.text)) {
      if (left.type !== "Identifier" && left.type !== "MemberExpression") {
        throw this.error("Invalid assignment target");
      }
      this.next();
      const right = this.parseAssignment();
      return { type: "AssignmentExpression", operator: token.text, left, right };
    }
    return left;
  }

  private parseConditional(): Expression {
    const test = this.parseBinary(0);
    if (!this.isPunct("?")) return test;
    this.next();
    const consequent = this.parseAssignment();
    this.expect(":");
    const alternate = this.parseAssignment();
    return { type: "ConditionalExpression", test, consequent, alternate };
  }

  private parseBinary(minPrecedence: number): Expression {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();
      const operator = token.text;
      const isOperator =
        (token.type === "punct" || (token.type === "name" && (operator === "in" || operator === "instanceof"))) &&
        operator in BINARY_PRECEDENCE;
      if (!isOperator) break;

      const precedence = BINARY_PRECEDENCE[operator]!;
      if (precedence < minPrecedence) break;
      this.next();

      // `**` is the only right-associative binary operator
      const right = this.parseBinary(operator === "**" ? precedence : precedence + 1);
      left = LOGICAL_OPERATORS.has(operator)
        ? { type: "LogicalExpression", operator, left, right }
        : { type: "BinaryExpression", operator, left, right };
    }

    return left;
  }

  private parseUnary(): Expression {
    const token = this.peek();

    if ((token.type === "punct" || token.type === "name") && UNARY_OPERATORS.has(token.text)) {
      this.next();
      return { type: "UnaryExpression", operator: token.text, argument: this.parseUnary() };
    }
    if (token.type === "punct" && (token.text === "++" || token.text === "--")) {
      this.next();
      const argument = this.parseUnary();
      this.assertUpdateTarget(argument);
      return { type: "UpdateExpression", operator: token.text, argument, prefix: true };
    }

    const expression = this.parseCallOrMember(this.parsePrimary(), true);
    const next = this.peek();
    if (next.type === "punct" && (next.text === "++" || next.text === "--") && !next.newlineBefore) {
      this.next();
      this.assertUpdateTarget(expression);
      return { type: "UpdateExpression", operator: next.text, argument: expression, prefix: false };
    }
    return expression;
  }

  private assertUpdateTarget(node: Expression): void {
    if (node.type !== "Identifier" && node.type !== "MemberExpression") {
      throw this.error("Invalid increment or decrement target");
    }
  }

  /**
   * Consumes the member, index and call suffixes that can follow a primary expression.
   * @param allowCall - False while parsing a `new` callee, where the argument list belongs to `new`.
   */
  private parseCallOrMember(object: Expression, allowCall: boolean): Expression {
    let optionalChain = false;

    for (;;) {
      if (this.isPunct(".")) {
        this.next();
        object = this.staticMember(object, this.parseIdentifierName(), false);
      } else if (this.isPunct("?.")) {
        this.next();
        optionalChain = true;
        if (this.isPunct("(")) {
          if (!allowCall) throw this.error("Optional call is not allowed in a `new` expression");
          object = { type: "CallExpression", callee: object, args: this.parseArguments(), optional: true };
        } else if (this.isPunct("[")) {
          object = this.computedMember(object, true);
        } else {
          object = this.staticMember(object, this.parseIdentifierName(), true);
        }
      } else if (this.isPunct("[")) {
        object = this.computedMember(object, false);
      } else if (allowCall && this.isPunct("(")) {
        object = { type: "CallExpression", callee: object, args: this.parseArguments(), optional: false };
      } else {
        // an optional link short circuits the whole chain, so the chain root marks where the
        // short circuit is turned back into `undefined`
        return optionalChain ? { type: "ChainExpression", expression: object } : object;
      }
    }
  }

  private staticMember(object: Expression, name: string, optional: boolean): Expression {
    return { type: "MemberExpression", object, property: { type: "Literal", value: name }, computed: false, optional };
  }

  private computedMember(object: Expression, optional: boolean): Expression {
    this.expect("[");
    const property = this.parseExpression();
    this.expect("]");
    return { type: "MemberExpression", object, property, computed: true, optional };
  }

  private parseArguments(): (Expression | SpreadElement)[] {
    this.expect("(");
    const args: (Expression | SpreadElement)[] = [];
    while (!this.isPunct(")")) {
      args.push(this.parseSpreadable());
      if (!this.consumeIf(",")) break;
    }
    this.expect(")");
    return args;
  }

  private parseSpreadable(): Expression | SpreadElement {
    if (this.isPunct("...")) {
      this.next();
      return { type: "SpreadElement", argument: this.parseAssignment() };
    }
    return this.parseAssignment();
  }

  private parsePrimary(): Expression {
    const token = this.peek();

    switch (token.type) {
      case "num":
      case "str":
        this.next();
        return { type: "Literal", value: token.value };
      case "template": {
        this.next();
        const { quasis, expressions } = token.parts!;
        return {
          type: "TemplateLiteral",
          quasis,
          expressions: expressions.map((source) => parseExpressionSource(source))
        };
      }
      case "name":
        return this.parseNamePrimary(token);
      case "punct":
        if (token.text === "(") {
          this.next();
          const expression = this.parseExpression();
          this.expect(")");
          return expression;
        }
        if (token.text === "[") return this.parseArray();
        if (token.text === "{") return this.parseObject();
        break;
      case "eof":
        break;
    }

    throw this.error(`Unexpected token "${token.text || "end of expression"}"`);
  }

  private parseNamePrimary(token: Token): Expression {
    const name = token.text;
    if (UNSUPPORTED_KEYWORDS.has(name)) {
      throw this.error(`Unsupported keyword "${name}"`);
    }

    this.next();
    switch (name) {
      case "true":
        return { type: "Literal", value: true };
      case "false":
        return { type: "Literal", value: false };
      case "null":
        return { type: "Literal", value: null };
      case "undefined":
        return { type: "Literal", value: undefined };
      case "this":
        return { type: "ThisExpression" };
      case "new": {
        const callee = this.parseCallOrMember(this.parsePrimary(), false);
        const args = this.isPunct("(") ? this.parseArguments() : [];
        return { type: "NewExpression", callee, args };
      }
      default:
        return { type: "Identifier", name };
    }
  }

  private parseArray(): Expression {
    this.expect("[");
    const elements: (Expression | SpreadElement | null)[] = [];
    while (!this.isPunct("]")) {
      if (this.isPunct(",")) {
        this.next();
        elements.push(null); // elision
        continue;
      }
      elements.push(this.parseSpreadable());
      if (!this.consumeIf(",")) break;
    }
    this.expect("]");
    return { type: "ArrayExpression", elements };
  }

  private parseObject(): Expression {
    this.expect("{");
    const properties: ObjectProperty[] = [];

    while (!this.isPunct("}")) {
      if (this.isPunct("...")) {
        this.next();
        properties.push({ key: null, computed: false, value: this.parseAssignment() });
      } else if (this.isPunct("[")) {
        this.next();
        const key = this.parseExpression();
        this.expect("]");
        this.expect(":");
        properties.push({ key, computed: true, value: this.parseAssignment() });
      } else {
        const token = this.peek();
        let key: Expression;
        if (token.type === "str" || token.type === "num") {
          this.next();
          key = { type: "Literal", value: String(token.value) };
        } else {
          key = { type: "Literal", value: this.parseIdentifierName() };
        }

        if (this.consumeIf(":")) {
          properties.push({ key, computed: false, value: this.parseAssignment() });
        } else if (token.type === "name") {
          properties.push({ key, computed: false, value: { type: "Identifier", name: token.text } }); // shorthand
        } else {
          throw this.error("Expected `:` after a property key");
        }
      }

      if (!this.consumeIf(",")) break;
    }

    this.expect("}");
    return { type: "ObjectExpression", properties };
  }

  private parseArrow(): Expression {
    const params: string[] = [];
    if (this.isPunct("(")) {
      this.next();
      while (!this.isPunct(")")) {
        params.push(this.parseIdentifierName());
        if (!this.consumeIf(",")) break;
      }
      this.expect(")");
    } else {
      params.push(this.parseIdentifierName());
    }
    this.expect("=>");

    if (this.isPunct("{")) {
      return { type: "ArrowFunctionExpression", params, body: this.parseBlock().body };
    }
    return { type: "ArrowFunctionExpression", params, body: this.parseAssignment() };
  }

  /**
   * Looks ahead for an arrow function head, the only construct that cannot be recognised
   * from its first token alone (`(a, b) =>` versus a parenthesised expression).
   */
  private isArrowAhead(): boolean {
    const token = this.peek();
    if (token.type === "name") {
      return this.tokens[this.index + 1]?.text === "=>";
    }
    if (!(token.type === "punct" && token.text === "(")) return false;

    let depth = 0;
    for (let i = this.index; i < this.tokens.length; i++) {
      const current = this.tokens[i]!;
      if (current.type !== "punct") continue;
      if (current.text === "(" || current.text === "[" || current.text === "{") depth++;
      else if (current.text === ")" || current.text === "]" || current.text === "}") {
        depth--;
        if (depth === 0) return this.tokens[i + 1]?.text === "=>";
      }
    }
    return false;
  }

  private parseIdentifierName(): string {
    const token = this.peek();
    if (token.type !== "name") throw this.error(`Expected an identifier but found "${token.text}"`);
    this.next();
    return token.text;
  }

  // ------------------------------------------------------------------- helpers

  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private next(): Token {
    return this.tokens[this.index++]!;
  }

  private isType(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private isPunct(text: string): boolean {
    const token = this.peek();
    return token.type === "punct" && token.text === text;
  }

  private isName(text: string): boolean {
    const token = this.peek();
    return token.type === "name" && token.text === text;
  }

  private consumeIf(text: string): boolean {
    if (!this.isPunct(text)) return false;
    this.next();
    return true;
  }

  private expect(text: string): void {
    if (!this.consumeIf(text)) {
      throw this.error(`Expected "${text}" but found "${this.peek().text || "end of expression"}"`);
    }
  }

  private error(message: string): ExpressionSyntaxError {
    return new ExpressionSyntaxError(`${message} in "${this.source}"`, this.peek().start);
  }

  /** Asserts that every token has been consumed, guarding against trailing garbage. */
  assertConsumed(): void {
    if (!this.isType("eof")) throw this.error(`Unexpected token "${this.peek().text}"`);
  }
}

/**
 * Parses a statement list into an AST.
 * @param source - The raw expression source, which may hold several statements.
 * @returns The parsed program.
 * @throws {ExpressionSyntaxError} When the source falls outside the supported subset.
 */
export function parse(source: string): Program {
  return new Parser(source).parseProgram();
}

/**
 * Parses a single expression, used for template literal interpolations.
 * @param source - The raw source of one `${}` interpolation.
 * @returns The parsed expression.
 * @throws {ExpressionSyntaxError} When the interpolation is empty or malformed.
 */
export function parseExpressionSource(source: string): Expression {
  const parser = new Parser(source);
  const expression = parser.parseExpression();
  parser.assertConsumed();
  return expression;
}
