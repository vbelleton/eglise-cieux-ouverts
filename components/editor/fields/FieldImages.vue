<template>
  <div
    class="field-array"
    :class="{ 'is-dragover': dragover }"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDrop"
  >
    <VueDraggable
      v-model="localEntries"
      handle=".array-drag-handle"
      ghost-class="array-item-ghost"
      :animation="200"
      :force-fallback="true"
      tag="div"
      class="field-array-list"
      @end="emitChange"
    >
      <div
        v-for="(entry, idx) in localEntries"
        :key="entry.id"
        class="array-item"
      >
        <div class="array-item-header">
          <span class="array-drag-handle" title="Glisser pour réordonner">⠿</span>
          <span class="array-item-num">#{{ idx + 1 }}</span>
          <button
            class="array-item-del"
            @click="removeItem(idx)"
            :aria-label="`Supprimer l'image ${idx + 1}`"
          >✕</button>
        </div>
        <input
          type="text"
          class="field-input"
          placeholder="URL image"
          :value="entry.url"
          @input="updateItem(idx, ($event.target as HTMLInputElement).value)"
        />
        <img v-if="entry.url" :src="entry.url" class="field-image-preview" :alt="`Aperçu image ${idx + 1}`" />
      </div>
    </VueDraggable>
    <div class="array-actions">
      <input ref="fileInput" type="file" accept="image/*" multiple class="field-file-hidden" @change="onFiles" />
      <button
        class="array-add-btn"
        :disabled="uploading"
        @click="fileInput?.click()"
        aria-label="Téléverser des photos depuis l'ordinateur"
      >{{ uploading ? `Envoi… ${progress}` : '📤 Téléverser des photos' }}</button>
      <button
        class="array-add-btn"
        @click="libraryOpen = true"
        aria-label="Choisir dans la médiathèque"
      >🖼️ Médiathèque</button>
    </div>
    <p class="field-images-hint">Plusieurs photos à la fois possible, ou glisser-déposer ici. Elles sont allégées automatiquement.</p>
    <p v-if="error" class="field-images-error">{{ error }}</p>
    <div class="array-actions">
      <button
        class="array-add-btn"
        @click="addItem"
        aria-label="Ajouter une image par URL"
      >+ Ajouter une image par URL</button>
      <button
        v-if="localEntries.length > 0"
        class="array-clear-btn"
        @click="clearAll"
        aria-label="Tout supprimer"
      >🗑️ Tout supprimer</button>
    </div>
    <ImageLibrary v-if="libraryOpen" multiple @select="onLibrarySelect" @close="libraryOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import ImageLibrary from '~/components/editor/ImageLibrary.vue'
import { uploadImage } from '~/utils/imageUpload.js'

const props = defineProps<{ value: any; field: any }>()
const emit = defineEmits<{ change: [value: string[]] }>()

let isEditing = false
let nextId = 0
const localEntries = ref<{ id: number; url: string }[]>([])

function initItems(val: any) {
  localEntries.value = Array.isArray(val) ? val.map((url) => ({ id: nextId++, url })) : []
}

initItems(props.value)

watch(() => props.value, (v) => {
  if (!isEditing) initItems(v)
}, { deep: true })

function emitChange() {
  isEditing = true
  emit('change', localEntries.value.map((e) => e.url))
  setTimeout(() => { isEditing = false }, 0)
}

function updateItem(idx: number, val: string) {
  localEntries.value[idx] = { ...localEntries.value[idx], url: val }
  emitChange()
}

function removeItem(idx: number) {
  localEntries.value.splice(idx, 1)
  emitChange()
}

function addItem() {
  localEntries.value.push({ id: nextId++, url: '' })
  emitChange()
}

function clearAll() {
  if (typeof window !== 'undefined' && !window.confirm('Retirer toutes les images de ce bloc ?')) return
  localEntries.value = []
  emitChange()
}

// ── Téléversement / médiathèque ─────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const progress = ref('')
const error = ref('')
const dragover = ref(false)
const libraryOpen = ref(false)

function appendUrls(urls: string[]) {
  // Une ligne vide laissée par « + Ajouter par URL » est remplacée plutôt
  // que de rester en tête de liste.
  const existantes = localEntries.value.filter((e) => e.url)
  localEntries.value = [...existantes, ...urls.map((url) => ({ id: nextId++, url }))]
  emitChange()
}

async function sendFiles(files: File[]) {
  const images = files.filter((f) => f.type?.startsWith('image/'))
  if (!images.length) return
  uploading.value = true
  error.value = ''
  const urls: string[] = []
  const echecs: string[] = []
  for (const [i, file] of images.entries()) {
    progress.value = `${i + 1}/${images.length}`
    try {
      urls.push(await uploadImage(file))
    } catch (err: any) {
      console.error('FieldImages: envoi impossible', err)
      echecs.push(err?.message || file.name)
    }
  }
  uploading.value = false
  progress.value = ''
  if (echecs.length) error.value = `Échec : ${echecs.join(', ')}`
  if (urls.length) appendUrls(urls)
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  sendFiles(Array.from(input.files || []))
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragover.value = false
  sendFiles(Array.from(e.dataTransfer?.files || []))
}

function onLibrarySelect(urls: string[]) {
  libraryOpen.value = false
  appendUrls(urls)
}
</script>

<style scoped>
.field-array { display: flex; flex-direction: column; gap: 10px; border-radius: 8px; }
.field-array.is-dragover { background: #eef4fa; outline: 2px dashed #064886; outline-offset: 2px; }
.field-file-hidden { display: none; }
.array-add-btn:disabled { opacity: 0.6; cursor: default; }
.field-images-hint { margin: -4px 0 0; font-size: 0.72em; color: #6b7280; }
.field-images-error { margin: 0; color: #b91c1c; font-size: 0.78em; }
.field-array-list { display: flex; flex-direction: column; gap: 10px; min-height: 4px; }
.array-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.array-item-ghost { opacity: 0.4; outline: 2px dashed #064886; outline-offset: -2px; }
.array-item-header { display: flex; align-items: center; gap: 8px; }
.array-drag-handle { cursor: grab; color: #9ca3af; font-size: 14px; user-select: none; }
.array-drag-handle:hover { color: #064886; }
.array-item-num { font-size: 0.72em; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em; flex: 1; }
.array-item-del { background: none; border: none; color: #EF4B54; cursor: pointer; font-size: 0.85em; padding: 2px 5px; border-radius: 4px; }
.array-item-del:hover { background: rgba(239,75,84,0.1); }
.array-actions { display: flex; gap: 8px; align-items: stretch; }
.array-add-btn { background: #f3f4f6; border: 1.5px dashed #d1d5db; border-radius: 8px; color: #555; font-size: 0.82em; padding: 8px; cursor: pointer; flex: 1; }
.array-add-btn:hover { border-color: #064886; color: #064886; background: #eef4fa; }
.array-clear-btn { background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; color: #EF4B54; font-size: 0.82em; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
.array-clear-btn:hover { background: #fee2e2; border-color: #EF4B54; }
.field-input { width: 100%; padding: 7px 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; color: #1a1a2e; font-size: 0.88em; outline: none; font-family: inherit; }
.field-image-preview { width: 100%; max-height: 60px; object-fit: cover; border-radius: 6px; }
</style>
