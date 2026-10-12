<template>
  <template v-for="link in links" :key="link.platform">
    <a
      v-if="SOCIAL_ICONS[link.platform]"
      :href="link.url"
      target="_blank"
      rel="noopener"
      :aria-label="`${SOCIAL_ICONS[link.platform].label} (nouvelle fenêtre)`"
      class="social-link"
    >
      <svg aria-hidden="true" focusable="false" :style="{ width: size + 'px', height: size + 'px' }" viewBox="0 0 24 24" fill="currentColor">
        <path :d="SOCIAL_ICONS[link.platform].path" />
      </svg>
    </a>
  </template>
</template>

<script setup>
// Rendu partagé des icônes réseaux sociaux — les liens eux-mêmes viennent
// du réglage global (useSiteSettings.js), pas de props codées en dur. Un
// seul endroit à mettre à jour pour ajouter une plateforme supportée
// (SiteHeader.vue, BlockContact.vue, BlockBienvenue.vue... consomment
// tous ce même composant).
import { SOCIAL_ICONS } from '~/utils/socialIcons.js'

defineProps({
  links: { type: Array, default: () => [] },
  size: { type: [Number, String], default: 20 },
})
</script>

<style scoped>
.social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  color: inherit;
}
</style>
