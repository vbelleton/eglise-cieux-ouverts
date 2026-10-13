<template>
  <button
    ref="el"
    type="button"
    class="imglib-item"
    :class="{ selected }"
    :aria-pressed="selected"
    :title="label"
    @click="$emit('toggle')"
  >
    <img v-if="src" :src="src" :alt="label" decoding="async" @error="onError" />
    <span v-else class="imglib-skeleton" aria-hidden="true"></span>
    <span v-if="selected" class="imglib-check">{{ badge }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { thumbnailUrl, imageUrl } from '~/utils/imageUpload.js'

// Une vignette ne demande son adresse (et ne charge son image) qu'en entrant
// dans la zone visible : ouvrir la médiathèque ne coûte plus une requête par
// image déjà envoyée.
const props = defineProps<{ name: string; label: string; selected: boolean; badge: string | number; url?: string }>()
defineEmits<{ toggle: [] }>()

const el = ref<HTMLElement | null>(null)
const src = ref('')
let observer: IntersectionObserver | null = null
let repli = false

async function charger() {
  if (props.url) { src.value = props.url; return }
  try {
    src.value = await thumbnailUrl(props.name)
  } catch {
    src.value = ''
  }
}

// Vignette illisible : on retombe une fois sur l'image d'origine.
async function onError() {
  if (repli || props.url) return
  repli = true
  try { src.value = await imageUrl(props.name) } catch { src.value = '' }
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !el.value) { charger(); return }
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      observer?.disconnect()
      observer = null
      charger()
    }
  }, { rootMargin: '200px' })
  observer.observe(el.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.imglib-item { position: relative; display: block; width: 100%; height: 0; padding: 0 0 100%; border: 3px solid transparent; border-radius: 10px; overflow: hidden; cursor: pointer; background: #f3f4f6; box-sizing: border-box; }
.imglib-item img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.imglib-item:hover { border-color: #93c5fd; }
.imglib-item.selected { border-color: #064886; }
.imglib-skeleton { position: absolute; inset: 0; display: block; width: 100%; height: 100%; background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6); background-size: 200% 100%; animation: imglib-shimmer 1.2s linear infinite; }
@keyframes imglib-shimmer { to { background-position: -200% 0; } }
.imglib-check { position: absolute; top: 6px; right: 6px; background: #064886; color: #fff; border-radius: 999px; min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: 700; padding: 0 6px; }
</style>
