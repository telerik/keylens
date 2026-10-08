#!/usr/bin/env node

console.warn(
  "(WARN) Keylens: this `keylens` package is only a placeholder. The Keylens CLI is published as @progress/keylens:",
);
console.warn();
console.warn("  npx @progress/keylens audit https://your-site.com");
console.warn();
console.warn("Or install it in your project and run the local binary:");
console.warn();
console.warn("  npm install --save-dev @progress/keylens");
console.warn("  npx playwright install chromium");
console.warn("  npx keylens audit https://your-site.com");
console.warn();
console.warn("More info: https://github.com/telerik/keylens#install");
console.warn();

process.exit(1);
