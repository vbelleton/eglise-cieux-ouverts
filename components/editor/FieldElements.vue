<template>
  <div class="field-elements">
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
        :class="{ 'array-item-selected': item.id === selectedId }"
        :ref="(el) => { if (el) itemRefs[item.id] = el }"
        @click="$emit('select', item.id)"
      >
        <div class="array-item-header">
          <span class="array-drag-handle" title="Glisser pour réordonner (ordre d'empilement)">⠿</span>
          <span class="array-item-num">{{ kindLabel(item.kind) }} #{{ idx + 1 }}</span>
          <button
            class="array-item-position-btn"
            title="Ajuster la position/taille sur la page"
            @click.stop="$emit('position', item.id)"
          >⤢</button>
          <button
            class="array-item-del"
            @click.stop="removeItem(idx)"
            aria-label="Supprimer l'élément"
          >✕</button>
        </div>

        <div class="array-item-anim-row">
          <label class="array-item-anim-label">Animation</label>
          <select
            class="field-select"
            :value="item.animation || 'none'"
            title="Animation d'entrée de cet élément"
            @change="updateItem(idx, { animation: ($event.target as HTMLSelectElement).value }); $emit('replay', item.id)"
            @click.stop
          >
            <option v-for="a in animations" :key="a.id" :value="a.id">{{ a.label }}</option>
          </select>
        </div>

        <template v-if="item.kind === 'text'">
          <textarea
            class="field-textarea"
            rows="2"
            placeholder="Texte"
            :value="item.text"
            @input="updateItem(idx, { text: ($event.target as HTMLTextAreaElement).value })"
            @click.stop
          ></textarea>
        </template>

        <template v-else-if="item.kind === 'richtext'">
          <FieldRichText
            :field="{ label: 'Texte' }"
            :value="item.text"
            @change="updateItem(idx, { text: $event })"
            @click.stop
          />
        </template>

        <template v-else-if="item.kind === 'image'">
          <input
            type="text"
            class="field-input"
            placeholder="URL image"
            :value="item.imageUrl"
            @input="updateItem(idx, { imageUrl: ($event.target as HTMLInputElement).value })"
            @click.stop
          />
          <input
            type="text"
            class="field-input"
            placeholder="Texte alternatif"
            :value="item.imageAlt"
            @input="updateItem(idx, { imageAlt: ($event.target as HTMLInputElement).value })"
            @click.stop
          />
          <img v-if="item.imageUrl" :src="item.imageUrl" class="field-image-preview" alt="Aperçu" />
        </template>

        <template v-else-if="item.kind === 'button'">
          <input
            type="text"
            class="field-input"
            placeholder="Texte du bouton"
            :value="item.buttonLabel"
            @input="updateItem(idx, { buttonLabel: ($event.target as HTMLInputElement).value })"
            @click.stop
          />
          <input
            type="text"
            class="field-input"
            placeholder="Lien"
            :value="item.buttonLink"
            @input="updateItem(idx, { buttonLink: ($event.target as HTMLInputElement).value })"
            @click.stop
          />
        </template>
      </div>
    </VueDraggable>

    <div class="array-actions">
      <button class="array-add-btn" @click="addItem('text')">+ Texte</button>
      <button class="array-add-btn" @click="addItem('richtext')">+ Texte mis en forme</button>
      <button class="array-add-btn" @click="addItem('image')">+ Image</button>
      <button class="array-add-btn" @click="addItem('button')">+ Bouton</button>
    </div>
    <p class="field-elements-hint">
      Ajoute, réordonne (ordre d'empilement) ou supprime le contenu ici. Clique ⤢ sur un élément pour le déplacer/redimensionner directement sur la page.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { ExtraElement, ExtraElementKind } from '~/lib/blocks/types'
import { ANIMATIONS as animations } from '~/utils/blockTypes.js'
import FieldRichText from './fields/FieldRichText.vue'

const props = defineProps<{
  elements: ExtraElement[]
  selectedId?: string | null
}>()

const emit = defineEmits<{
  change: [elements: ExtraElement[]]
  select: [id: string]
  position: [id: string]
  replay: [id: string]
}>()

// Scroll automatique vers l'élément sélectionné depuis le canvas (clic
// direct sur la page) — même logique que le surlignage des champs fixes
// dans AutoEditor.vue, pour qu'un élément déjà présent hors-vue reste
// repérable dans la liste sans avoir à scroller manuellement.
// Watch sur identifySeq (compteur incrémenté à CHAQUE clic), pas sur
// selectedId directement : Vue ne déclenche pas un watch sur un ref
// primitif dont la valeur ne change pas (ex: re-cliquer le même élément
// déjà actif) — le scroll ne partait alors jamais pour ce cas précis.
const { identifySeq } = useAdmin()
const itemRefs: Record<string, HTMLElement> = {}
watch(identifySeq, () => {
  const id = props.selectedId
  if (!id) return
  nextTick(() => itemRefs[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}, { immediate: true })

let isEditing = false
let nextKey = 0
let nextId = 0
const localItems = ref<(ExtraElement & { _key: number })[]>([])

function initItems(val: ExtraElement[]) {
  localItems.value = Array.isArray(val) ? val.map((item) => ({ ...item, _key: nextKey++ })) : []
}

initItems(props.elements)

watch(() => props.elements, (v) => {
  if (!isEditing) initItems(v)
}, { deep: true })

function kindLabel(kind: ExtraElementKind) {
  if (kind === 'text') return 'Texte'
  if (kind === 'richtext') return 'Texte mis en forme'
  if (kind === 'image') return 'Image'
  return 'Bouton'
}

function emitChange() {
  isEditing = true
  emit('change', localItems.value.map(({ _key, ...rest }) => rest))
  setTimeout(() => { isEditing = false }, 0)
}

function updateItem(idx: number, patch: Partial<ExtraElement>) {
  localItems.value[idx] = { ...localItems.value[idx], ...patch }
  emitChange()
}

function removeItem(idx: number) {
  localItems.value.splice(idx, 1)
  emitChange()
}

function addItem(kind: ExtraElementKind) {
  // Décale légèrement chaque nouvel élément par rapport au précédent :
  // sans ça, plusieurs éléments créés à la suite démarrent exactement à
  // la même position et se superposent parfaitement, ce qui donne
  // l'impression qu'un déplacement ne fait rien (l'élément du dessous
  // reste visible au même endroit).
  const offset = (localItems.value.length % 5) * 4
  const base: ExtraElement = {
    id: `el-${Date.now()}-${nextId++}`,
    kind,
    xPct: 10 + offset,
    yPct: 10 + offset,
    wPct: 30,
    hPct: 20,
    z: localItems.value.length,
  }
  if (kind === 'button') base.buttonLabel = 'En savoir plus'
  if (kind === 'richtext') base.text = '<p>Nouveau texte…</p>'
  localItems.value.push({ ...base, _key: nextKey++ })
  emitChange()
  emit('select', base.id)
}
</script>

<style scoped>
.field-elements { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.field-array-list { display: flex; flex-direction: column; gap: 10px; min-height: 4px; }
.array-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
.array-item-selected { border-color: #064886; box-shadow: 0 0 0 2px rgba(6, 72, 134, 0.15); }
.array-item-ghost { opacity: 0.4; outline: 2px dashed #064886; outline-offset: -2px; }
.array-item-header { display: flex; align-items: center; gap: 8px; }
.array-drag-handle { cursor: grab; color: #9ca3af; font-size: 14px; user-select: none; }
.array-drag-handle:hover { color: #064886; }
.array-item-num { font-size: 0.72em; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em; flex: 1; }
.array-item-position-btn { background: none; border: none; color: #064886; cursor: pointer; font-size: 0.95em; padding: 2px 5px; border-radius: 4px; }
.array-item-position-btn:hover { background: rgba(6,72,134,0.1); }
.array-item-del { background: none; border: none; color: #EF4B54; cursor: pointer; font-size: 0.85em; padding: 2px 5px; border-radius: 4px; }
.array-item-del:hover { background: rgba(239,75,84,0.1); }
.array-item-anim-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.array-item-anim-label { font-size: 0.7em; color: #888; font-weight: 500; }
.field-select { font-size: 0.78em; background: #fff; border: 1px solid #ddd; border-radius: 5px; color: #555; padding: 3px 6px; max-width: 150px; }
.array-actions { display: flex; gap: 8px; }
.array-add-btn { flex: 1; background: #f3f4f6; border: 1.5px dashed #d1d5db; border-radius: 8px; color: #555; font-size: 0.8em; padding: 8px; cursor: pointer; }
.array-add-btn:hover { border-color: #064886; color: #064886; background: #eef4fa; }
.field-input, .field-textarea { width: 100%; padding: 7px 10px; background: #fff; border: 1px solid #ddd; border-radius: 6px; color: #1a1a2e; font-size: 0.88em; outline: none; font-family: inherit; }
.field-textarea { resize: vertical; min-height: 50px; }
.field-image-preview { width: 100%; max-height: 60px; object-fit: cover; border-radius: 6px; }
.field-elements-hint { font-size: 0.75em; color: #999; margin: 0; line-height: 1.4; }
</style>
