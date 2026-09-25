<script setup lang="ts">
import { withBase } from "vitepress";
import DefaultTheme from "vitepress/theme";

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <!--
      VitePress's client router falls back to a generic "PAGE NOT FOUND"
      component for any unmatched path (a known limitation: a plain
      docs/404.md is only ever shown for the literal /404 route, not for
      real broken links). Overriding the `not-found` slot is the documented
      way to brand the page every visitor with a dead link actually sees.
    -->
    <template #not-found>
      <div class="keylens-not-found">
        <p class="keylens-not-found-code">404</p>
        <h1>This page tabbed off the edge of the map</h1>
        <p>
          Whatever brought you here doesn't exist. Here's where you probably
          meant to go:
        </p>
        <ul>
          <li>
            <a :href="withBase('/guide/getting-started')">Getting started</a>
          </li>
          <li><a :href="withBase('/rules/')">Rules overview</a></li>
          <li><a :href="withBase('/guide/cli')">CLI reference</a></li>
          <li><a :href="withBase('/')">Home</a></li>
        </ul>
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.keylens-not-found {
  max-width: 480px;
  margin: 0 auto;
  padding: 96px 24px;
  text-align: center;
}

.keylens-not-found-code {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-brand-1);
  margin: 0 0 16px;
}

.keylens-not-found h1 {
  font-size: 20px;
  margin: 0 0 12px;
}

.keylens-not-found ul {
  list-style: none;
  padding: 0;
  margin: 24px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
