<div align="center">
 <h1>
    <a href="https://github.com/lune-js/lune">
      <img alt="Lune.js - Simple, declarative, and functional library for building reactive user interfaces." src="./.github/assets/text.svg" width="400">
    </a>
  </h1>
</div>

Lune.js is a fork of [`petite-vue`](https://github.com/vuejs/petite-vue), an alternative distribution of Vue optimized for progressive enhancement.
This project has been created because `petite-vue` has not been updated for nearly **5 years**. Lune modernizes and adds features missing in `petite-vue`:

- Utilize [Alien Signals](https://github.com/stackblitz/alien-signals) to perform reactive rendering and optimized updates to the DOM.
- Create [custom directives](http://lune-js.com/advanced/custom-directives) and [plugins](http://lune-js.com/advanced/plugins)
  to enhance the development experience.
- Run template bindings through a self contained expression engine instead of the `Function` constructor,
  so no `unsafe-eval` is needed in a Content Security Policy.
- Exposes [properties](http://lune-js.com/guide/properties) in directives such as `$root`, `$refs`, and `$el`.

A big difference from `petite-vue`: [directives start with `lu-` instead of `v-`](http://lune-js.com/directives).
