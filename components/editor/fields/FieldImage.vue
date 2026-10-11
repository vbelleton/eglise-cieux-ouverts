<template>
  <div
    class="field-image-wrap"
    :class="{ 'is-dragover': dragover }"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDrop"
  >
    <input
      type="text"
      class="field-input"
      :value="value"
      @input="$emit('change', ($event.target as HTMLInputElement).value)"
      placeholder="/chemin/image.jpg ou glisser une photo ici"
    />
    <div class="field-image-actions">
      <input ref="fileInput" type="file" accept="image/*" class="field-file-hidden" @change="onFile" />
      <button type="button" class="field-image-btn" :disabled="uploading" @click="fileInput?.click()">
        {{ uploading ? 'Envoi…' : '📤 Téléverser' }}
      </button>
      <button type="button" class="field-image-btn" @click="libraryOpen = true">🖼️ Médiathèque</button>
      <button v-if="value" type="button" class="field-image-btn field-image-btn-del" aria-label="Retirer l'image" @click="$emit('change', '')">✕</button>
    </div>
    <p v-if="error" class="field-image-error">{{ error }}</p>
    <img v-if="value" :src="value" class="field-image-preview" alt="preview" />
    <ImageLibrary v-if="libraryOpen" @select="onSelect" @close="libraryOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ImageLibrary from '~/components/editor/ImageLibrary.vue'
import { uploadImage } from '~/utils/imageUpload.js'

defineProps<{ value: any; field: any }>()
const emit = defineEmits<{ change: [value: string] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref('')
const dragover = ref(false)
const libraryOpen = ref(false)

async function send(file: File | undefined) {
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    emit('change', await uploadImage(file))
  } catch (err: any) {
    console.error('FieldImage: envoi impossible', err)
    error.value = err?.message || 'Échec du téléversement'
  } finally {
    uploading.value = false
  }
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  send(input.files?.[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragover.value = false
  send(e.dataTransfer?.files?.[0])
}

function onSelect(urls: string[]) {
  if (urls[0]) emit('change', urls[0])
  libraryOpen.value = false
}
</script>

<style scoped>
.field-image-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 8px;
  transition: background 0.15s;
}
.field-image-wrap.is-dragover { background: #eef4fa; outline: 2px dashed #064886; outline-offset: 2px; }
.field-input {
  width: 100%;
  padding: 7px 10px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  color: #1a1a2e;
  font-size: 0.88em;
  outline: none;
  font-family: inherit;
}
.field-input:focus { border-color: #064886; }
.field-image-actions { display: flex; gap: 6px; }
.field-file-hidden { display: none; }
.field-image-btn { flex: 1; padding: 6px 8px; font-size: 0.78em; border: 1.5px solid #d1d5db; border-radius: 6px; background: #f9fafb; color: #374151; cursor: pointer; white-space: nowrap; }
.field-image-btn:hover:not(:disabled) { border-color: #064886; color: #064886; }
.field-image-btn:disabled { opacity: 0.6; cursor: default; }
.field-image-btn-del { flex: 0; color: #EF4B54; }
.field-image-error { margin: 0; color: #b91c1c; font-size: 0.78em; }
.field-image-preview {
  width: 100%;
  max-height: 80px;
  object-fit: cover;
  border-radius: 6px;
}
</style>
