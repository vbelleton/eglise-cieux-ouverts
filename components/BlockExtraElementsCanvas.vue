<template>
  <div ref="canvasRef" class="bee-canvas">
    <ClientOnly v-if="isAdmin">
      <template v-for="el in elements" :key="el.id">
        <VueDraggableResizable
          v-if="el.id === positioningId"
          :x="pxX(el)"
          :y="pxY(el)"
          :w="pxW(el)"
          :h="pxH(el)"
          :parent="true"
          :z="10000"
          active
          class="bee-el bee-el-drag"
          @dragStop="(x, y) => onDragStop(el, x, y)"
          @resizeStop="(x, y, w, h) => onResizeStop(el, x, y, w, h)"
        >
          <BlockExtraElementContent :element="el" :is-admin="true" />
        </VueDraggableResizable>
        <div
          v-else
          class="bee-el bee-el-static"
          :class="[elemAnimClass(el), { 'bee-el-selected': el.id === selectedId, triggered: isTriggered }]"
          :style="staticElementStyle(el)"
          @click.stop="$emit('select', el.id)"
        >
          <BlockExtraElementContent :element="el" :is-admin="true" />
        </div>
      </template>
      <button
        v-if="positioningId"
        type="button"
        class="bee-validate-btn"
        @click="$emit('stop-positioning')"
      >✓ Valider</button>
      <template #fallback>
        <div v-for="el in elements" :key="el.id" class="bee-el" :class="[elemAnimClass(el), { triggered: isTriggered }]" :style="elementStyle(el)">
          <BlockExtraElementContent :element="el" />
        </div>
      </template>
    </ClientOnly>
    <template v-else>
      <div v-for="el in elements" :key="el.id" class="bee-el" :class="[elemAnimClass(el), { triggered: isTriggered }]" :style="elementStyle(el)">
        <BlockExtraElementContent :element="el" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ExtraElement } from '~/lib/blocks/types'
import VueDraggableResizable from 'vue-draggable-resizable'
import 'vue-draggable-resizable/style.css'
import { ANIMATIONS } from '~/utils/blockTypes.js'

const props = defineProps<{
  elements: ExtraElement[]
  isAdmin?: boolean
  isTriggered?: boolean
  selectedId?: string | null
  positioningId?: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  'update:elements': [elements: ExtraElement[]]
  'stop-positioning': []
}>()

const canvasRef = ref<HTMLElement | null>(null)
const canvasSize = ref({ width: 0, height: 0 })

function measure() {
  if (!canvasRef.value) return
  canvasSize.value = { width: canvasRef.value.clientWidth, height: canvasRef.value.clientHeight }
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  if (!canvasRef.value || typeof ResizeObserver === 'undefined') return
  measure()
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(canvasRef.value)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
})

// Le ResizeObserver ci-dessus est asynchrone (callback différé, après le
// patch DOM de Vue) : entrer en mode positionnement juste après avoir promu
// un champ (qui retire ce champ de sa place fixe et peut donc changer la
// hauteur du bloc) faisait convertir le %/px de VueDraggableResizable
// contre un canvasSize encore PÉRIMÉ, causant un redimensionnement visible
// de l'élément à l'ouverture des poignées. Un re-mesure synchrone après le
// prochain patch DOM (nextTick), déclenché dès qu'on entre en
// positionnement, corrige la taille avant que VueDraggableResizable ne
// s'en serve.
watch(() => props.positioningId, (id) => {
  if (!id) return
  nextTick(measure)
})

// % -> px, utilisé uniquement pour piloter VueDraggableResizable (qui
// travaille en px). Le rendu public/statique reste en % pur via CSS.
function pxX(el: ExtraElement) { return (canvasSize.value.width * (el.xPct ?? 0)) / 100 }
function pxY(el: ExtraElement) { return (canvasSize.value.height * (el.yPct ?? 0)) / 100 }
function pxW(el: ExtraElement) { return (canvasSize.value.width * (el.wPct ?? 20)) / 100 }
function pxH(el: ExtraElement) { return (canvasSize.value.height * (el.hPct ?? 20)) / 100 }

function elementStyle(el: ExtraElement) {
  return {
    position: 'absolute' as const,
    left: (el.xPct ?? 0) + '%',
    top: (el.yPct ?? 0) + '%',
    width: (el.wPct ?? 20) + '%',
    height: (el.hPct ?? 20) + '%',
    zIndex: el.z ?? 0,
  }
}

// Comme elementStyle(), mais avec un z-index toujours au-dessus du backdrop
// plein écran de la sidebar (.admin-sidebar-overlay, z-index 9998) — sinon
// les éléments statiques (non en mode positionnement) deviennent inatteignables
// au clic dès que la sidebar est ouverte. VueDraggableResizable forçait déjà
// ce comportement via sa prop :z="10000" ; on le reproduit ici pour les
// éléments qui ne l'utilisent plus.
function staticElementStyle(el: ExtraElement) {
  return { ...elementStyle(el), zIndex: 10000 + (el.z ?? 0) }
}

// Réutilise les classes .block-anim-* (déjà globales, assets/css/main.css)
// et le déclenchement du bloc parent (isTriggered) plutôt qu'un observer
// dédié par élément — même principe que getAnimClass() pour les blocs
// (lib/blocks/renderer.ts), transposé aux éléments libres.
function elemAnimClass(el: ExtraElement) {
  if (!el.animation || el.animation === 'none') return ''
  const anim = ANIMATIONS.find((a) => a.id === el.animation)
  return anim ? `block-${anim.css}` : ''
}

// Commit uniquement au relâchement (dragStop/resizeStop), jamais sur chaque
// pixel intermédiaire — évite de noyer l'historique undo/redo et Firestore.
function commit(id: string, patch: Partial<ExtraElement>) {
  const updated = props.elements.map((e) => (e.id === id ? { ...e, ...patch } : e))
  emit('update:elements', updated)
}

function onDragStop(el: ExtraElement, x: number, y: number) {
  if (!canvasSize.value.width || !canvasSize.value.height) return
  commit(el.id, {
    xPct: (x / canvasSize.value.width) * 100,
    yPct: (y / canvasSize.value.height) * 100,
  })
}

function onResizeStop(el: ExtraElement, x: number, y: number, w: number, h: number) {
  if (!canvasSize.value.width || !canvasSize.value.height) return
  commit(el.id, {
    xPct: (x / canvasSize.value.width) * 100,
    yPct: (y / canvasSize.value.height) * 100,
    wPct: (w / canvasSize.value.width) * 100,
    hPct: (h / canvasSize.value.height) * 100,
  })
}
</script>

<style scoped>
.bee-canvas {
  /* Se superpose exactement sur le contenu du bloc (voir .block-wrapper
     dans PageRenderer.vue, qui fournit l'ancre position:relative) — pas
     de hauteur propre, le bloc garde sa taille naturelle. */
  position: absolute;
  inset: 0;
  /* `clip` et non `hidden` : même découpe visuelle, mais `hidden` fait du
     canvas un conteneur de défilement. Or l'animation des éléments libres
     suit le scroll (animation-timeline: view(), assets/css/main.css), et
     view() se cale sur le conteneur de défilement le plus proche : le
     canvas, dans lequel l'élément est toujours entièrement visible. Son
     animation était donc finie avant même que le bloc n'entre à l'écran.
     `hidden` reste en repli pour les navigateurs sans `clip` (qui n'ont pas
     non plus view() et jouent l'animation via .triggered). */
  overflow: hidden;
  overflow: clip;
  /* Laisse passer les clics vers le contenu du bloc en dessous partout
     sauf sur les éléments eux-mêmes (réactivé ci-dessous). */
  pointer-events: none;
}
.bee-el {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}
/* Admin : l'élément entier capte le pointeur (drag / resize / sélection). */
.bee-el-drag,
.bee-el-static {
  pointer-events: auto;
}
.bee-el-static {
  position: absolute;
  cursor: pointer;
  border-radius: 4px;
  outline: 2px solid transparent;
  outline-offset: -2px;
  transition: outline-color 0.15s;
}
.bee-el-static:hover {
  outline-color: rgba(59, 130, 246, 0.4);
}
/* Surlignage net de l'élément sélectionné (hors mode positionnement) — même
   bleu que .admin-selected sur les blocs (PageRenderer.vue) pour un langage
   visuel de sélection unifié entre blocs et éléments additionnels. */
.bee-el-selected {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}
/* Public : les éléments héritent du pointer-events:none du canvas — un
   texte ou une image promus (souvent grands) ne bloquent donc pas les
   clics vers le contenu du bloc en dessous (ex: un bouton du Hero). Seuls
   les éléments réellement interactifs (boutons/liens) restent cliquables. */
.bee-el :deep(.bee-button) {
  pointer-events: auto;
}
.bee-el-drag :deep(.bee-text),
.bee-el-drag :deep(.bee-richtext),
.bee-el-drag :deep(.bee-image),
.bee-el-static :deep(.bee-text),
.bee-el-static :deep(.bee-richtext),
.bee-el-static :deep(.bee-image) {
  width: 100%;
  height: 100%;
}
.bee-validate-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10001;
  pointer-events: auto;
  background: #064886;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.bee-validate-btn:hover {
  background: #053a6e;
}
</style>
