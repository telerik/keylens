<script setup lang="ts">
import { withBase } from "vitepress";
import { onBeforeUnmount, ref } from "vue";

interface Stop {
  n: number;
  x: number;
  y: number;
  selector: string;
  role: string;
  name: string;
  issue?: string;
}

const stops: Stop[] = [
  {
    n: 1,
    x: 69,
    y: 3.3,
    selector: "nav a:nth-child(1)",
    role: "link",
    name: "Overview",
  },
  {
    n: 2,
    x: 75.9,
    y: 3.3,
    selector: "nav a:nth-child(2)",
    role: "link",
    name: "Features",
  },
  {
    n: 3,
    x: 82.1,
    y: 3.3,
    selector: "nav a:nth-child(3)",
    role: "link",
    name: "Pricing",
  },
  {
    n: 4,
    x: 87.4,
    y: 3.3,
    selector: "nav a:nth-child(4)",
    role: "link",
    name: "Docs",
  },
  {
    n: 5,
    x: 93.9,
    y: 3.3,
    selector: "nav a.cta",
    role: "link",
    name: "Sign in",
  },
  {
    n: 6,
    x: 42.8,
    y: 25.5,
    selector: ".btn-primary",
    role: "button",
    name: "Primary action",
  },
  {
    n: 7,
    x: 56.3,
    y: 25.5,
    selector: ".btn-secondary",
    role: "button",
    name: "Secondary action",
  },
  {
    n: 8,
    x: 22.3,
    y: 58.1,
    selector: ".panel:nth-child(1) .panel-cta",
    role: "link",
    name: "Learn more",
    issue: "missing-focus-indicator",
  },
  {
    n: 9,
    x: 44.6,
    y: 58.1,
    selector: ".panel:nth-child(2) .panel-cta",
    role: "link",
    name: "Learn more",
    issue: "missing-focus-indicator",
  },
  {
    n: 10,
    x: 66.9,
    y: 58.1,
    selector: ".panel:nth-child(3) .panel-cta",
    role: "link",
    name: "Learn more",
    issue: "missing-focus-indicator",
  },
  {
    n: 11,
    x: 47.6,
    y: 77.7,
    selector: "input#email",
    role: "textbox",
    name: "Email address",
  },
  {
    n: 12,
    x: 62.3,
    y: 77.7,
    selector: "form .btn-primary",
    role: "button",
    name: "Subscribe",
  },
  {
    n: 13,
    x: 22.9,
    y: 90.7,
    selector: "footer a[href='#features']",
    role: "link",
    name: "Features",
  },
  {
    n: 14,
    x: 22.9,
    y: 93,
    selector: "footer a[href='#pricing']",
    role: "link",
    name: "Pricing",
  },
  {
    n: 15,
    x: 22.9,
    y: 95.4,
    selector: "footer a[href='#changelog']",
    role: "link",
    name: "Changelog",
  },
  {
    n: 16,
    x: 41,
    y: 90.7,
    selector: "footer a[href='#about']",
    role: "link",
    name: "About",
  },
  {
    n: 17,
    x: 41,
    y: 93,
    selector: "footer a[href='#careers']",
    role: "link",
    name: "Careers",
  },
  {
    n: 18,
    x: 41,
    y: 95.4,
    selector: "footer a[href='#contact']",
    role: "link",
    name: "Contact",
  },
  {
    n: 19,
    x: 59,
    y: 90.7,
    selector: "footer a[href='#docs']",
    role: "link",
    name: "Docs",
  },
  {
    n: 20,
    x: 59,
    y: 93,
    selector: "footer a[href='#blog']",
    role: "link",
    name: "Blog",
  },
  {
    n: 21,
    x: 59,
    y: 95.4,
    selector: "footer a[href='#support']",
    role: "link",
    name: "Support",
  },
  {
    n: 22,
    x: 77.1,
    y: 90.7,
    selector: "footer a[href='#privacy']",
    role: "link",
    name: "Privacy",
  },
  {
    n: 23,
    x: 77.1,
    y: 93,
    selector: "footer a[href='#terms']",
    role: "link",
    name: "Terms",
  },
];

const W = 1000;
const H = 827;

const segments = stops.slice(1).map((to, i) => {
  const from = stops[i];
  const x1 = (from.x / 100) * W;
  const y1 = (from.y / 100) * H;
  const x2 = (to.x / 100) * W;
  const y2 = (to.y / 100) * H;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    to: to.n,
    x1,
    y1,
    x2,
    y2,
    mx: x1 + (x2 - x1) * 0.55,
    my: y1 + (y2 - y1) * 0.55,
    angle,
  };
});

const visible = ref(stops.length);
const selected = ref<number | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

function play() {
  stopTimer();
  selected.value = null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    visible.value = stops.length;
    return;
  }
  visible.value = 0;
  timer = setInterval(() => {
    visible.value += 1;
    if (visible.value >= stops.length) stopTimer();
  }, 180);
}

function select(n: number) {
  selected.value = selected.value === n ? null : n;
}

onBeforeUnmount(stopTimer);
</script>

<template>
  <div class="klx-fm">
    <div class="klx-fm-bar">
      <span class="klx-fm-pill">focus order · {{ stops.length }} stops</span>
      <button
        type="button"
        class="klx-fm-play"
        aria-label="Play Tab order animation"
        title="Play Tab order animation"
        @click="play"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
        </svg>
      </button>
    </div>

    <div class="klx-fm-surface">
      <img
        class="klx-fm-page"
        :src="withBase('/demo-page.png')"
        alt="A small generic sample page with a nav, hero, three feature panels, a subscribe form and a footer."
        width="1280"
        height="1058"
        loading="lazy"
      />

      <svg
        class="klx-fm-lines"
        :viewBox="`0 0 ${W} ${H}`"
        aria-hidden="true"
        focusable="false"
      >
        <g v-for="s in segments" :key="s.to" :class="{ on: s.to <= visible }">
          <line :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2" class="seg" />
          <polygon
            points="-9,-6 7,0 -9,6"
            class="arrow"
            :transform="`translate(${s.mx} ${s.my}) rotate(${s.angle})`"
          />
        </g>
      </svg>

      <button
        v-for="s in stops"
        :key="s.n"
        type="button"
        class="klx-fm-marker"
        :class="{
          on: s.n <= visible,
          issue: s.issue,
          selected: selected === s.n,
        }"
        :style="{ left: s.x + '%', top: s.y + '%' }"
        :aria-label="`Stop ${s.n}: ${s.role} ${s.name}${s.issue ? ', ' + s.issue : ''}`"
        :aria-pressed="selected === s.n"
        @click="select(s.n)"
      >
        {{ s.n }}
        <span
          class="klx-fm-tip"
          :class="{
            left: s.x > 60,
            below: s.y < 12,
          }"
          role="presentation"
        >
          <b>{{ s.name }}</b>
          <span>{{ s.role }} · {{ s.selector }}</span>
          <em v-if="s.issue">{{ s.issue }}</em>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.klx-fm {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.klx-fm-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  background: var(--klx-bar-bg);
  border-bottom: 1px solid var(--klx-bar-border);
}

.klx-fm-pill {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--klx-pill-bg);
  font-size: 11px;
  color: var(--klx-dim);
}

.klx-fm-play {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--klx-bar-border);
  border-radius: 999px;
  background: transparent;
  color: var(--klx-eyebrow);
  cursor: pointer;
}

.klx-fm-play:hover {
  background: var(--klx-pill-bg);
}

.klx-fm-play:focus-visible,
.klx-fm-marker:focus-visible {
  outline: 2px solid var(--klx-eyebrow);
  outline-offset: 2px;
}

.klx-fm-surface {
  position: relative;
  container-type: inline-size;
  aspect-ratio: 1280 / 1058;
  background: #d9dce3;
  overflow: hidden;
}

.klx-fm-page {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.klx-fm-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.klx-fm-lines g {
  opacity: 0;
  transition: opacity 0.25s;
}

.klx-fm-lines g.on {
  opacity: 1;
}

.seg {
  stroke: #4b5fd6;
  stroke-width: 2;
  stroke-dasharray: 7 6;
  stroke-linecap: round;
  opacity: 0.75;
}

.arrow {
  fill: #4b5fd6;
}

.klx-fm-marker {
  position: absolute;
  display: grid;
  place-items: center;
  width: clamp(16px, 4cqw, 25px);
  height: clamp(16px, 4cqw, 25px);
  box-sizing: border-box;
  padding: 0;
  line-height: 1;
  border: 1px solid #fff;
  border-radius: 50%;
  background: #4b5fd6;
  color: #fff;
  font-size: clamp(8px, 1.8cqw, 12px);
  font-weight: 700;
  cursor: pointer;
  transform: translate(-50%, -50%) scale(0.4);
  opacity: 0;
  transition:
    transform 0.15s,
    opacity 0.2s;
  z-index: 2;
}

.klx-fm-marker.on {
  opacity: 1;
  transform: translate(-50%, -50%);
}

.klx-fm-marker.issue {
  background: #8a1c1c;
}

.klx-fm-marker.selected {
  z-index: 5;
}

.klx-fm-marker.on:hover,
.klx-fm-marker.on:focus-visible {
  z-index: 6;
}

.klx-fm-marker.selected {
  box-shadow: 0 0 0 3px rgba(75, 95, 214, 0.45);
}

.klx-fm-marker.issue.selected {
  box-shadow: 0 0 0 3px rgba(197, 48, 48, 0.45);
}

.klx-fm-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
  padding: 6px 9px;
  border-radius: 6px;
  background: #11184b;
  color: #e8edff;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.35;
  text-align: left;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%);
  pointer-events: none;
}

.klx-fm-tip.left {
  left: auto;
  right: 0;
  transform: none;
}

.klx-fm-tip.below {
  bottom: auto;
  top: calc(100% + 8px);
}

.klx-fm-tip b {
  font-weight: 700;
}

.klx-fm-tip span {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 10px;
  opacity: 0.8;
}

.klx-fm-tip em {
  color: #ff9b9b;
  font-size: 10px;
  font-style: normal;
}

.klx-fm-surface:has(.klx-fm-marker:hover, .klx-fm-marker:focus-visible)
  .klx-fm-marker.selected:not(:hover, :focus-visible)
  .klx-fm-tip {
  opacity: 0;
  visibility: hidden;
}

.klx-fm-marker:hover .klx-fm-tip,
.klx-fm-marker:focus-visible .klx-fm-tip,
.klx-fm-marker.selected .klx-fm-tip {
  opacity: 1;
  visibility: visible;
}

@media (prefers-reduced-motion: reduce) {
  .klx-fm-lines g,
  .klx-fm-marker {
    transition: none;
  }
}
</style>
