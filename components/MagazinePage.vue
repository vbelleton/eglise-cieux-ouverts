<template>
  <!-- Une page du magazine. Le numéro de page reste visible derrière l'image
       tant qu'elle n'est pas arrivée (pas d'état « chargé » à suivre : une
       image déjà chargée avant l'hydratation n'émettrait jamais `load`). -->
  <div class="mag-page" :class="{ 'mag-page-vide': !page }">
    <template v-if="page">
      <span class="mag-page-num" aria-hidden="true">{{ page }}</span>
      <img
        :key="page"
        :src="imagePage(numero, page, 'm')"
        :srcset="srcsetPage(numero, page)"
        :sizes="sizes"
        :width="numero.largeur"
        :height="numero.hauteur"
        :alt="`Page ${page}`"
        :fetchpriority="prioritaire ? 'high' : undefined"
        decoding="async"
        draggable="false"
      >
    </template>
  </div>
</template>

<script setup>
import { imagePage, srcsetPage } from '~/utils/magazines.js'

defineProps({
  numero: { type: Object, required: true },
  page: { type: Number, default: null },
  sizes: { type: String, default: '100vw' },
  prioritaire: { type: Boolean, default: false },
})
</script>

<style scoped>
.mag-page { position: relative; width: 100%; height: 100%; background: #fdfdfb; overflow: hidden; }
.mag-page-vide { background: transparent; }
.mag-page-num {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-heading); font-size: 2.4em; color: #c9ced8;
}
.mag-page img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block;
  user-select: none; -webkit-user-drag: none; -webkit-touch-callout: none;
}
</style>
