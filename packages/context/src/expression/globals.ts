/**
 * Built-in globals expressions may reach. Anything outside this list (and the bindings registered
 * through {@link allowGlobals}) resolves to a `ReferenceError`, so a template can never walk into
 * ambient application state or browser APIs by accident.
 */
const ALLOWED_GLOBALS = new Set([
  "Array",
  "BigInt",
  "Boolean",
  "Date",
  "Error",
  "Infinity",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "NaN",
  "Number",
  "Object",
  "Promise",
  "RangeError",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "TypeError",
  "WeakMap",
  "WeakSet",
  "alert",
  "confirm",
  "console",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "structuredClone"
]);

/**
 * Identifiers that are always rejected, even when an application registers them.
 * These are the names that hand an expression a way back to dynamic code evaluation,
 * the DOM at large, or the network.
 */
export const BLOCKED_IDENTIFIERS: Set<string> = new Set([
  "Function",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "document",
  "eval",
  "exports",
  "fetch",
  "global",
  "globalThis",
  "importScripts",
  "module",
  "navigator",
  "process",
  "require",
  "self",
  "setInterval",
  "setTimeout",
  "top",
  "window"
]);

/**
 * Property keys that are never readable or writable from an expression. `constructor` and
 * `prototype` are the classic routes back to the `Function` constructor, and `__proto__`
 * allows prototype pollution.
 */
export const UNSAFE_KEYS: Set<string> = new Set(["__proto__", "constructor", "prototype"]);

const customGlobals: Record<string, unknown> = Object.create(null);

/**
 * Registers extra bindings that expressions may reference by name, for applications that rely on
 * globals beyond the built-in allow list (a date library, a formatter, and so on).
 * @param globals - A map of identifier name to the value the name should resolve to.
 * @throws {Error} When a name is on the permanently blocked list.
 */
export function allowGlobals(globals: Record<string, unknown>): void {
  for (const name of Object.keys(globals)) {
    if (BLOCKED_IDENTIFIERS.has(name)) {
      throw new Error(`"${name}" cannot be exposed to expressions.`);
    }
    customGlobals[name] = globals[name];
  }
}

/**
 * Checks whether an identifier resolves to a global binding.
 * @param name - The identifier being resolved.
 * @returns True when the name is registered or is an allowed built-in that exists at runtime.
 */
export function hasGlobal(name: string): boolean {
  return name in customGlobals || (ALLOWED_GLOBALS.has(name) && name in globalThis);
}

/**
 * Reads a global binding previously matched by {@link hasGlobal}.
 * @param name - The identifier being resolved.
 * @returns The registered value, or the built-in of that name.
 */
export function getGlobal(name: string): unknown {
  return name in customGlobals ? customGlobals[name] : (globalThis as Record<string, unknown>)[name];
}
