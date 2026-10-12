<template>
  <section class="block-louange" :style="{ background: backgroundColor, color: textColor }" :class="[visibilityClasses, animClass]">
    <div class="louange-inner">
      <h2 class="louange-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="intro" class="louange-intro" data-field-key="intro" :style="fieldFontStyle(fieldFonts, 'intro', fieldFontSizes)">{{ intro }}</p>

      <div class="louange-grid">
        <article v-for="pos in positions" :key="pos.key || pos.poste" class="louange-card">
          <h3>{{ pos.poste }}</h3>
          <p v-if="pos.description" class="louange-desc">{{ pos.description }}</p>
          <p v-if="pos.places" class="louange-places">
            {{ pos.places }} place{{ pos.places > 1 ? 's' : '' }} à pourvoir
          </p>
          <button
            class="louange-apply"
            :disabled="pendingKeys.has(posKey(pos)) || sentKeys.has(posKey(pos))"
            @click="apply(pos)"
          >
            {{ sentKeys.has(posKey(pos)) ? 'Candidature envoyée ✓' : pendingKeys.has(posKey(pos)) ? 'Envoi…' : 'Je postule !' }}
          </button>
        </article>
      </div>

      <p v-if="toast" class="louange-toast">{{ toast }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  intro: { type: String, default: '' },
  positions: { type: Array, default: () => [] },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#064886' },
  animation: { type: String, default: 'fadeIn' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

const animClass = computed(() => {
  if (!props.animation || props.animation === 'none') return ''
  return `block-anim-${props.animation} ${props.isTriggered ? 'triggered' : ''}`
})

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility?.mobile === false,
  'hide-tablet': props.visibility?.tablet === false,
  'hide-desktop': props.visibility?.desktop === false,
}))

const { isLoggedIn, authedFetch } = useMemberAuth()
// Espace membre désactivé (⚙️ Config) : les candidatures passent par le
// formulaire de contact.
const { espaceMembre, loadSiteSettings } = useSiteSettings()
onMounted(() => loadSiteSettings())
const route = useRoute()
const pendingKeys = ref(new Set())
const sentKeys = ref(new Set())
const toast = ref('')

function posKey(pos) {
  return pos.key || pos.poste || ''
}

async function apply(pos) {
  // Non connecté → redirection vers l'espace membre (retour ici après login)
  if (!espaceMembre.value) {
    navigateTo('/contact')
    return
  }
  if (!isLoggedIn.value) {
    navigateTo(`/membre?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  const key = posKey(pos)
  pendingKeys.value = new Set([...pendingKeys.value, key])
  toast.value = ''
  try {
    await authedFetch('/api/member/candidacies', {
      method: 'POST',
      body: { position_key: key, position_label: pos.poste },
    })
    sentKeys.value = new Set([...sentKeys.value, key])
    toast.value = 'Candidature envoyée ! L\'équipe te répondra bientôt.'
  } catch (e) {
    toast.value = e?.data?.message || 'Impossible d\'envoyer la candidature (déjà postulé ?).'
  } finally {
    const next = new Set(pendingKeys.value)
    next.delete(key)
    pendingKeys.value = next
  }
}
</script>

<style scoped>
.block-louange {
  padding: 70px 24px;
}
.louange-inner {
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
}
.louange-title {
  font-family: var(--font-heading, serif);
  font-size: clamp(1.6em, 4vw, 2.3em);
  margin-bottom: 0.5em;
}
.louange-intro {
  max-width: 640px;
  margin: 0 auto 2em;
  opacity: 0.85;
  line-height: 1.6;
}
.louange-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.2rem;
  text-align: left;
}
.louange-card {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 14px;
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
}
.louange-card h3 {
  font-size: 1.15em;
}
.louange-desc {
  font-size: 0.92em;
  opacity: 0.85;
  line-height: 1.5;
  flex: 1;
}
.louange-places {
  font-size: 0.8em;
  font-weight: 600;
  opacity: 0.7;
}
.louange-apply {
  margin-top: 0.4rem;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 9px;
  background: #064886;
  color: #fff;
  font-size: 0.9em;
  cursor: pointer;
  transition: opacity 0.2s;
}
.louange-apply:hover:not(:disabled) {
  opacity: 0.88;
}
.louange-apply:disabled {
  background: #9fb8cd;
  cursor: default;
}
.louange-toast {
  margin-top: 1.5rem;
  font-size: 0.9em;
  font-weight: 600;
}

@media (max-width: 600px) {
  .block-louange { padding: 50px 20px; }
}
</style>
