<template>
  <Teleport to="body">
    <div class="imglib-overlay" @click.self="$emit('close')">
      <div
        ref="dialogEl"
        class="imglib"
        role="dialog"
        aria-modal="true"
        aria-label="Médiathèque"
        tabindex="-1"
        @keydown.esc="$emit('close')"
      >
        <header class="imglib-head">
          <h3>🖼️ Médiathèque</h3>
          <button class="imglib-close" aria-label="Fermer la médiathèque" @click="$emit('close')">✕</button>
        </header>

        <div class="imglib-actions">
          <input ref="fileInput" type="file" accept="image/*" multiple class="imglib-file" @change="onFiles" />
          <button class="imglib-btn" :disabled="uploading" @click="fileInput?.click()">
            {{ uploading ? `Envoi… ${progress}` : '📤 Téléverser depuis l\'ordinateur' }}
          </button>
          <input v-model="search" type="search" class="imglib-search" placeholder="Rechercher par nom" aria-label="Rechercher une image" />
        </div>
        <p class="imglib-hint">Les photos sont redimensionnées et allégées automatiquement avant l'envoi.</p>
        <p v-if="error" class="imglib-error">{{ error }}</p>

        <div v-if="loading" class="imglib-msg">Chargement des images…</div>
        <div v-else-if="!filtered.length" class="imglib-msg">Aucune image téléversée pour l'instant.</div>
        <div v-else class="imglib-grid">
          <button
            v-for="img in filtered"
            :key="img.name"
            type="button"
            class="imglib-item"
            :class="{ selected: selected.includes(img.url) }"
            :aria-pressed="selected.includes(img.url)"
            :title="libelle(img.name)"
            @click="toggle(img.url)"
          >
            <img :src="img.url" :alt="libelle(img.name)" loading="lazy" />
            <span v-if="selected.includes(img.url)" class="imglib-check">{{ multiple ? selected.indexOf(img.url) + 1 : '✓' }}</span>
          </button>
        </div>

        <footer class="imglib-foot">
          <span class="imglib-count">{{ selected.length ? `${selected.length} sélectionnée(s)` : '' }}</span>
          <button class="imglib-btn imglib-btn-sec" @click="$emit('close')">Annuler</button>
          <button class="imglib-btn imglib-btn-primary" :disabled="!selected.length" @click="confirm">
            {{ multiple ? 'Ajouter la sélection' : 'Choisir cette image' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { listUploadedImages, uploadImage } from '~/utils/imageUpload.js'

const props = defineProps<{ multiple?: boolean }>()
const emit = defineEmits<{ select: [urls: string[]]; close: [] }>()

const images = ref<{ name: string; url: string }[]>([])
const loading = ref(true)
const uploading = ref(false)
const progress = ref('')
const error = ref('')
const search = ref('')
const selected = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dialogEl = ref<HTMLElement | null>(null)

// « 1712345678901_ma-photo.jpg » → « ma-photo.jpg »
function libelle(name: string) {
  return name.replace(/^\d+_/, '')
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? images.value.filter(i => i.name.toLowerCase().includes(q)) : images.value
})

async function load() {
  loading.value = true
  try {
    images.value = await listUploadedImages()
  } catch (e) {
    console.error('ImageLibrary: liste impossible', e)
    error.value = 'Impossible de charger la médiathèque.'
    images.value = []
  } finally {
    loading.value = false
  }
}

function toggle(url: string) {
  if (!props.multiple) {
    selected.value = selected.value[0] === url ? [] : [url]
    return
  }
  const i = selected.value.indexOf(url)
  if (i === -1) selected.value.push(url)
  else selected.value.splice(i, 1)
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  uploading.value = true
  error.value = ''
  const echecs: string[] = []
  const nouvelles: string[] = []
  for (const [i, file] of files.entries()) {
    progress.value = `${i + 1}/${files.length}`
    try {
      nouvelles.push(await uploadImage(file))
    } catch (err: any) {
      console.error('ImageLibrary: envoi impossible', err)
      echecs.push(err?.message || file.name)
    }
  }
  uploading.value = false
  progress.value = ''
  if (echecs.length) error.value = `Échec : ${echecs.join(', ')}`
  await load()
  // Les images qu'on vient d'envoyer sont présélectionnées.
  selected.value = props.multiple ? [...selected.value, ...nouvelles] : nouvelles.slice(-1)
}

function confirm() {
  if (!selected.value.length) return
  emit('select', [...selected.value])
}

onMounted(() => {
  load()
  nextTick(() => dialogEl.value?.focus())
})
</script>

<style scoped>
.imglib-overlay { position: fixed; inset: 0; background: rgba(10, 20, 40, 0.55); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.imglib { background: #fff; color: #1a1a2e; width: min(860px, 100%); max-height: 90vh; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); outline: none; }
.imglib-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e5e7eb; }
.imglib-head h3 { margin: 0; font-size: 1.05em; color: #064886; }
.imglib-close { background: none; border: none; font-size: 1.2em; cursor: pointer; color: #666; }
.imglib-actions { display: flex; gap: 10px; padding: 12px 18px 0; flex-wrap: wrap; }
.imglib-file { display: none; }
.imglib-search { flex: 1; min-width: 160px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
.imglib-hint { margin: 6px 18px 0; font-size: 0.78em; color: #6b7280; }
.imglib-error { margin: 8px 18px 0; color: #b91c1c; font-size: 0.85em; }
.imglib-msg { padding: 40px 18px; text-align: center; color: #6b7280; }
.imglib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 14px 18px; overflow-y: auto; }
.imglib-item { position: relative; aspect-ratio: 1; border: 3px solid transparent; border-radius: 10px; overflow: hidden; padding: 0; cursor: pointer; background: #f3f4f6; }
.imglib-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.imglib-item:hover { border-color: #93c5fd; }
.imglib-item.selected { border-color: #064886; }
.imglib-check { position: absolute; top: 6px; right: 6px; background: #064886; color: #fff; border-radius: 999px; min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8em; font-weight: 700; padding: 0 6px; }
.imglib-foot { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid #e5e7eb; }
.imglib-count { flex: 1; font-size: 0.85em; color: #6b7280; }
.imglib-btn { padding: 8px 14px; border-radius: 8px; border: 1.5px solid #d1d5db; background: #f9fafb; cursor: pointer; font: inherit; font-size: 0.88em; }
.imglib-btn:disabled { opacity: 0.5; cursor: default; }
.imglib-btn-primary { background: #064886; border-color: #064886; color: #fff; }
.imglib-btn-sec { background: #fff; }
</style>
