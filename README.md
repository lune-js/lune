<div align="center">
 <h1>
    <a href="https://github.com/lune-js/lune">
      <img alt="Lune.js - Simple, declarative, and functional library for building reactive user interfaces." src="./.github/assets/text.svg" width="400">
    </a>
  </h1>
</div>

Lune.js is a fork of [`petite-vue`](https://github.com/vuejs/petite-vue), an alternative distribution of Vue optimized for progressive enhancement.
This project has been created because `petite-vue` has not been updated for nearly **5 years**. Lune.js attempts to modernize and add features missing in `petite-vue` including:

- Utilize [Alien Signals](https://github.com/stackblitz/alien-signals) to perform reactive rendering and optimized updates to the DOM.
- Build with [custom directives](https://vuejs.org/guide/reusability/custom-directives.html) and [plugins](https://vuejs.org/guide/reusability/plugins.html) to enhance development experience.
- Exposes global variables such as [`$root`](https://vuejs.org/api/component-instance.html#root), [`$refs`](https://vuejs.org/api/component-instance.html#refs), and [`$el`](https://vuejs.org/api/component-instance.html#el).

A big difference from `petite-vue`: [directives](https://vuejs.org/api/built-in-directives.html) start with `lu-` instead of `v-`.
