<template>
  <!-- Champs lus seulement quand le navigateur envoie le formulaire lui-même,
       c'est-à-dire sans JavaScript (voir composables/useEnvoiSansJs.js et
       server/api/contact.post.ts). Avec JS, l'envoi passe par $fetch. -->
  <input type="hidden" name="formulaire" :value="formulaire" />
  <input type="hidden" name="retour" :value="route.path" />
  <input type="hidden" name="source" :value="route.fullPath" />
  <input type="hidden" name="ouvert" :value="ouvert" />
</template>

<script setup>
defineProps({
  formulaire: { type: String, required: true },
  ouvert: { type: Number, required: true },
})
const route = useRoute()
</script>
