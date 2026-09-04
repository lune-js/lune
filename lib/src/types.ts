import type { Directive } from "@lune-js/context";
import type { Block } from "@lune-js/context";

export interface App<HostElement = Element> {
  /** Registers a directive. */
  directive(name: string, def?: Directive<any>): Directive | undefined | this;
  /** Installs a plugin. */
  use(plugin: Plugin, options?: any): this;
  /** Mounts the application to the DOM. */
  mount(el?: string | HostElement | null): this | undefined;
  /** Unmounts the application. */
  unmount(): void;
  /** The root blocks of the mounted application. */
  readonly rootBlocks: Block[];
  /** The root scope/context of the application. */
  readonly scope: any;
}

/**
 * Definitions for Lune attributes.
 */
export interface Attributes {
  /**
   * Used to dynamically bind one or more attributes to an expression.
   * @see https://vuejs.org/api/built-in-directives.html#v-bind
   * @category Core
   *
   * ```html
   * <!-- full syntax -->
   * <a lu-bind:href="url">Link</a>
   *
   * <!-- shorthand (preferred) -->
   * <a :href="url">Link</a>
   * ```
   */
  ["lu-bind"]?: string;

  /**
   * Used to hide un-compiled templates until the component instance is ready.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-cloak
   * @category Core
   */
  ["lu-cloak"]?: string;

  /**
   * Execute reactive inline statements. Similar to running Vue's
   * [`watchEffect() `](https://vuejs.org/api/reactivity-core.html#watcheffect) inline.
   *
   * @see https://github.com/vuejs/petite-vue#v-effect
   * @category Core
   */
  ["lu-effect"]?: string;

  /**
   * Render a list of elements by iterating over an array or an object.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-for
   * @category Core
   */
  ["lu-for"]?: string;

  /**
   * Update an element's [`innerHTML`](https://developer.mozilla.org/docs/Web/API/Element/innerHTML).
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-html
   * @category Core
   */
  ["lu-html"]?: string;

  /**
   * Conditionally render an element based on the truthiness of an expression.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-if
   * @category Core
   */
  ["lu-if"]?: string;

  /**
   * Create a two-way binding on a form input element or a component.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-model
   * @category Core
   */
  ["lu-model"]?: string;

  /**
   * Attach event listeners to elements. It supports both inline expressions
   * and method calls from your scope.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-on
   * @category Core
   */
  ["lu-on"]?: string;

  /**
   * Render the element and component once only, and skip future updates.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-once
   * @category Core
   *
   * ```html
   * <span lu-once>This will never change: {{ msg }}</span>
   * ```
   */
  ["lu-once"]?: string;

  /**
   * Skip compilation for this element and all its children.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-pre
   * @category Core
   *
   * ```html
   * <span lu-pre>{{ will not be compiled }}</span>
   * ```
   */
  ["lu-pre"]?: string;

  /**
   * The primary directive that marks a region of the DOM
   * that should be controlled by Lune.
   *
   * @see https://github.com/vuejs/petite-vue#usage
   * @category Core
   * @remarks
   * - The `defer` attribute makes the script execute after HTML content is parsed.
   * - The `init` attribute tells Lune to automatically query and initialize all elements that have `lu-scope` on the page.
   * - If you don't want Lune to auto-mount, remove the `init` attribute and move the scripts to end of `<body>`.
   *
   * ```html
   * <!-- auto init -->
   * <script src="https://cdn.jsdelivr.net/npm/lune-js" defer init></script>
   *
   * <!-- anywhere on the page -->
   * <div lu-scope="{ count: 0 }">
   *   {{ count }}
   * </div>
   *
   * <!-- manual init -->
   * <script src="https://unpkg.com/lune-js"></script>
   * <script>
   *   Lune.createApp().mount();
   * </script>
   * ```
   */
  ["lu-scope"]?: string;

  /**
   * Toggle the element's visibility based on the truthy-ness
   * of the expression value. It manipulates the CSS
   * [`display`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display) property.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-show
   * @category Core
   */
  ["lu-show"]?: string;

  /**
   * Update the element's text content. It is a one-way binding
   * from a reactive property to the DOM.
   *
   * @see https://vuejs.org/api/built-in-directives.html#v-text
   * @category Core
   */
  ["lu-text"]?: string;

  /**
   * Register a reference to a DOM element.
   *
   * @see https://vuejs.org/api/built-in-special-attributes.html#ref
   * @category Core
   */
  ref?: string;
}

type FunctionPlugin<Options = any[]> = PluginInstallFunction<Options> & Partial<ObjectPlugin<Options>>;

type PluginInstallFunction<Options = any[]> = Options extends unknown[]
  ? (app: App, ...options: Options) => any
  : (app: App, options: Options) => any;

export type Plugin<Options extends unknown[] = any[]> = FunctionPlugin<Options> | ObjectPlugin<Options>;

type ObjectPlugin<Options = any[]> = {
  install: PluginInstallFunction<Options>;
};
