<template>
  <p v-if="element.kind === 'text' && element.text" class="bee-text" :style="textStyle">{{ element.text }}</p>
  <div
    v-else-if="element.kind === 'richtext' && element.text"
    class="bee-richtext"
    :style="textStyle"
    v-html="sanitizedHtml"
  ></div>
  <img
    v-else-if="element.kind === 'image' && element.imageUrl"
    class="bee-image"
    :src="element.imageUrl"
    :alt="element.imageAlt || ''"
    loading="lazy"
    draggable="false"
  />
  <a
    v-else-if="element.kind === 'button' && element.buttonLabel"
    class="bee-button"
    :href="element.buttonLink || '#'"
    @click="onButtonClick"
  >{{ element.buttonLabel }}</a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExtraElement } from '~/lib/blocks/types'
import { fontStack, ensureFontLoaded } from '~/utils/fonts.js'
import { sanitizeHtml } from '~/utils/sanitize.js'

const props = defineProps<{
  element: ExtraElement
  isAdmin?: boolean
}>()

// Même traitement que BlockRichText.vue pour le champ HTML d'origine :
// le contenu reste du HTML admin-authored mais passe par le même filtre
// (script/handlers/javascript: retirés) avant v-html.
const sanitizedHtml = computed(() => props.element.text ? sanitizeHtml(props.element.text) : '')

// Style repris d'un champ promu (voir AutoEditor.promoteField) pour garder
// l'apparence d'origine. fontFamily est un NOM de police résolu en stack
// et chargé à la demande (même mécanisme que fieldFontStyle des blocs).
const textStyle = computed(() => {
  const el = props.element
  const s: Record<string, string> = {}
  if (el.color) s.color = el.color
  if (el.fontSize) s.fontSize = el.fontSize
  if (el.bold) s.fontWeight = '700'
  if (el.italic) s.fontStyle = 'italic'
  if (el.underline) s.textDecoration = 'underline'
  if (el.textAlign) s.textAlign = el.textAlign
  if (el.fontFamily) {
    const stack = fontStack(el.fontFamily)
    if (stack) {
      ensureFontLoaded(el.fontFamily)
      s.fontFamily = stack
    }
  }
  return s
})

// En mode admin, le bouton est à l'intérieur d'une zone de drag/resize —
// suivre le lien romprait l'édition. Il reste cliquable normalement côté
// rendu public (isAdmin absent/false).
function onButtonClick(e: MouseEvent) {
  if (props.isAdmin) e.preventDefault()
}
</script>

<style scoped>
.bee-text {
  margin: 0;
  font-size: 1.05em;
  line-height: 1.5;
}
.bee-richtext {
  font-size: 1.05em;
  line-height: 1.7;
  overflow: auto;
}
.bee-richtext :deep(*:first-child) { margin-top: 0; }
.bee-richtext :deep(*:last-child) { margin-bottom: 0; }
.bee-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  pointer-events: none;
}
.bee-button {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 50px;
  background: #064886;
  color: white;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.bee-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}
</style>
