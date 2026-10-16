<template>
  <div class="field-array">
    <VueDraggable
      v-model="localItems"
      handle=".array-drag-handle"
      ghost-class="array-item-ghost"
      :animation="200"
      :force-fallback="true"
      tag="div"
      class="field-array-list"
      @end="emitChange"
    >
      <div
        v-for="(item, idx) in localItems"
        :key="item._key"
        class="array-item"
      >
        <div class="array-item-header">
          <span class="array-drag-handle" title="Glisser pour réordonner">⠿</span>
          <span class="array-item-num">#{{ idx + 1 }}</span>
          <button
            class="array-item-del"
            @click="removeItem(idx)"
            :aria-label="`Supprimer l'élément ${idx + 1}`"
          >✕</button>
        </div>
        <template v-if="isPrimitiveMode">
          <input
            type="text"
            class="field-input"
            placeholder="Texte"
            :value="item._value"
            @input="updatePrimitiveItem(idx, ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template v-else-if="hasSubFields">
          <div
            v-for="sub in field.subFields"
            :key="sub.key"
            class="sub-field"
          >
            <div class="sub-field-header">
              <label class="sub-field-label">{{ sub.label }}</label>
              <input
                v-if="sub.sizable"
                type="number"
                step="0.1"
                min="0.3"
                max="5"
                class="sub-field-size-input"
                :value="subFieldSizeValue(item, sub.key)"
                title="Taille de police relative (1 = taille par défaut)"
                placeholder="Taille"
                @change="updateSubFieldSize(idx, sub.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              v-if="sub.type === 'text'"
              type="text"
              class="field-input"
              :placeholder="sub.placeholder || sub.label"
              :value="item[sub.key]"
              @input="updateItem(idx, sub.key, ($event.target as HTMLInputElement).value)"
            />
            <FieldImage
              v-else-if="sub.type === 'image'"
              :value="item[sub.key]"
              :field="sub"
              @change="updateItem(idx, sub.key, $event)"
            />
            <textarea
              v-else-if="sub.type === 'textarea'"
              class="field-textarea"
              rows="3"
              :placeholder="sub.placeholder || sub.label"
              :value="item[sub.key]"
              @input="updateItem(idx, sub.key, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>
        </template>
        <template v-else>
          <input
            type="text"
            class="field-input"
            placeholder="Titre"
            :value="item.title"
            @input="updateItem(idx, 'title', ($event.target as HTMLInputElement).value)"
          />
          <textarea
            class="field-textarea"
            rows="3"
            placeholder="Description"
            :value="item.description"
            @input="updateItem(idx, 'description', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <input
            type="text"
            class="field-input"
            placeholder="URL image"
            :value="item.image"
            @input="updateItem(idx, 'image', ($event.target as HTMLInputElement).value)"
          />
          <img v-if="item.image" :src="item.image" class="field-image-preview" alt="preview" />
        </template>
      </div>
    </VueDraggable>
    <button class="array-add-btn" @click="addItem" :aria-label="'Ajouter un élément à ' + (field.label || 'la liste')">
      + Ajouter
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import FieldImage from './FieldImage.vue'

const props = defineProps<{ value: any; field: any }>()
const emit = defineEmits<{ change: [value: any[]] }>()

let isEditing = false
let nextKey = 0
const localItems = ref<any[]>([])

const hasSubFields = computed(() => {
  return Array.isArray(props.field?.subFields) && props.field.subFields.length > 0
})

// Certains champs "array" stockent des valeurs PRIMITIVES (ex: aspirations.items
// = tableau de chaînes), pas des objets — les brancher sur le rendu
// title/description/image (ou des subFields) affichait des champs vides
// alors que le texte existait bien (item.title sur une string est undefined).
// Détecté via field.itemType (déclaré dans le schema) ou, à défaut, le type
// du premier élément déjà présent dans les données.
const isPrimitiveMode = computed(() => {
  if (hasSubFields.value) return false
  if (props.field?.itemType === 'text') return true
  const first = Array.isArray(props.value) ? props.value[0] : undefined
  return typeof first === 'string' || typeof first === 'number'
})

function initItems(val: any) {
  if (!Array.isArray(val)) {
    localItems.value = []
    return
  }
  localItems.value = isPrimitiveMode.value
    ? val.map((v) => ({ _key: nextKey++, _value: v }))
    : val.map((item) => ({ ...item, _key: nextKey++ }))
}

initItems(props.value)

watch(() => props.value, (v) => {
  if (!isEditing) initItems(v)
}, { deep: true })

function getEmptyItem(): any {
  if (isPrimitiveMode.value) return { _value: '' }
  if (hasSubFields.value) {
    const item: any = {}
    for (const sub of props.field.subFields) {
      item[sub.key] = ''
    }
    return item
  }
  return { title: '', description: '', image: '' }
}

function emitChange() {
  isEditing = true
  // _key est un identifiant interne pour le drag & drop uniquement — jamais
  // persisté dans les données du bloc. En mode primitif, _value EST la
  // donnée à émettre (pas un objet) — pas de spread d'une chaîne en objet.
  emit('change', localItems.value.map(({ _key, ...rest }) =>
    isPrimitiveMode.value ? rest._value : rest,
  ))
  setTimeout(() => { isEditing = false }, 0)
}

function updateItem(idx: number, prop: string, val: string) {
  localItems.value[idx] = { ...localItems.value[idx], [prop]: val }
  emitChange()
}

// Taille de police par sous-champ "sizable" (ex: FAQ question/answer),
// stockée directement sur l'item sous `${key}Size` (ex: questionSize:
// "1.4em") — colocalisée avec le texte plutôt qu'un index séparé, pour
// survivre naturellement au drag & drop / suppression d'items. Même
// convention que fieldFontSizes dans AutoEditor.vue : input = multiplicateur
// affiché (ex: "1.4"), stocké en chaîne CSS complète ("1.4em").
function subFieldSizeValue(item: any, key: string) {
  const raw = item?.[`${key}Size`]
  const n = raw ? parseFloat(String(raw)) : NaN
  return Number.isFinite(n) ? String(n) : ''
}

function updateSubFieldSize(idx: number, key: string, value: string) {
  const n = parseFloat(value)
  const size = !value || !Number.isFinite(n) || n <= 0 ? undefined : `${n}em`
  const item = { ...localItems.value[idx] }
  const sizeKey = `${key}Size`
  if (size) item[sizeKey] = size
  else delete item[sizeKey]
  localItems.value[idx] = item
  emitChange()
}

function updatePrimitiveItem(idx: number, val: string) {
  localItems.value[idx] = { ...localItems.value[idx], _value: val }
  emitChange()
}

function removeItem(idx: number) {
  localItems.value.splice(idx, 1)
  emitChange()
}

function addItem() {
  localItems.value.push({ ...getEmptyItem(), _key: nextKey++ })
  emitChange()
}
</script>

<style scoped>
.field-array { display: flex; flex-direction: column; gap: 10px; }
.field-array-list { display: flex; flex-direction: column; gap: 10px; min-height: 4px; }
.array-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.array-item-ghost { opacity: 0.4; outline: 2px dashed #064886; outline-offset: -2px; }
.array-item-header { display: flex; align-items: center; gap: 8px; }
.array-drag-handle { cursor: grab; color: #9ca3af; font-size: 14px; user-select: none; }
.array-drag-handle:hover { color: #064886; }
.array-item-num { font-size: 0.72em; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em; flex: 1; }
.array-item-del { background: none; border: none; color: #EF4B54; cursor: pointer; font-size: 0.85em; padding: 2px 5px; border-radius: 4px; }
.array-item-del:hover { background: rgba(239,75,84,0.1); }
.array-add-btn { background: #f3f4f6; border: 1.5px dashed #d1d5db; border-radius: 8px; color: #555; font-size: 0.82em; padding: 8px; cursor: pointer; }
.array-add-btn:hover { border-color: #064886; color: #064886; background: #eef4fa; }
.sub-field { display: flex; flex-direction: column; gap: 3px; }
.sub-field-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sub-field-label { font-size: 0.7em; color: #888; font-weight: 500; }
.sub-field-size-input { font-size: 0.72em; background: #fff; border: 1px solid #ddd; border-radius: 5px; color: #555; padding: 2px 5px; width: 48px; }
.field-input, .field-textarea { width: 100%; padding: 7px 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; color: #1a1a2e; font-size: 0.88em; outline: none; font-family: inherit; }
.field-textarea { resize: vertical; min-height: 60px; }
.field-image-preview { width: 100%; max-height: 60px; object-fit: cover; border-radius: 6px; }
</style>
