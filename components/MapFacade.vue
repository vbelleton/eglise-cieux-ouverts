<template>
  <div class="map-facade" :class="{ 'map-facade-loaded': loaded }" :style="{ minHeight }">
    <iframe
      v-if="loaded"
      :src="src"
      :title="title"
      style="border:0;width:100%;height:100%;min-height:inherit;"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
    <template v-else>
      <span class="map-facade-pin" aria-hidden="true">📍</span>
      <span class="map-facade-title">{{ title }}</span>
      <button type="button" class="map-facade-btn" @click="loaded = true">{{ buttonText }}</button>
    </template>
  </div>
</template>

<script setup>
// Cadre léger à la place d'une carte Google : la carte (lente) ne se charge
// qu'au toucher. Voir utils/mapFacade.js pour la même chose dans du HTML collé.
defineProps({
  src: { type: String, required: true },
  title: { type: String, default: 'Carte' },
  minHeight: { type: String, default: '280px' },
  buttonText: { type: String, default: 'Afficher la carte' },
})
const loaded = ref(false)
</script>
