<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    command: string;
    label?: string;
  }>(),
  {
    label: "command",
  },
);

const copied = ref(false);
const copyError = ref(false);

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(props.command);
    copied.value = true;
    copyError.value = false;
    window.setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {
    copied.value = false;
    copyError.value = true;
  }
}
</script>

<template>
  <div class="keylens-install-command">
    <code><span>$</span> {{ command }}</code>
    <button
      type="button"
      class="keylens-copy-button"
      :aria-label="copied ? `${label} copied` : `Copy ${label}`"
      :title="copied ? 'Copied' : `Copy ${label}`"
      @click="copyCommand"
    >
      <svg
        v-if="!copied"
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <svg
        v-else
        aria-hidden="true"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    </button>
    <span v-if="copyError" class="keylens-copy-error" role="status"
      >Copy failed — select the command manually.</span
    >
  </div>
</template>

<style scoped>
.keylens-install-command {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
  padding: 5px 6px 5px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-1);
}

.keylens-install-command code {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  white-space: nowrap;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.keylens-install-command code::-webkit-scrollbar {
  display: none;
}

.keylens-install-command code span {
  color: var(--vp-c-brand-1);
}

.keylens-copy-button {
  display: inline-grid;
  width: 30px;
  height: 30px;
  margin-left: auto;
  flex-shrink: 0;
  place-items: center;
  padding: 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.keylens-copy-button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.keylens-copy-button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.keylens-copy-error {
  flex-basis: 100%;
  color: var(--vp-c-danger-1);
  font-size: 12px;
}

@media (max-width: 640px) {
  .keylens-install-command {
    margin: 14px 0;
  }
}
</style>
