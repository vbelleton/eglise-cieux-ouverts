<template>
  <section
    class="block-bandeau"
    :class="[visibilityClasses, { 'bandeau-pause': pauseOnHover }]"
    :style="{ background: backgroundColor, color: textColor, '--bandeau-duree': `${dureeSecondes}s` }"
  >
    <component
      :is="link ? NuxtLink : 'div'"
      :to="link && estInterne ? link : undefined"
      :href="link && !estInterne ? link : undefined"
      :target="link && !estInterne ? '_blank' : undefined"
      :rel="link && !estInterne ? 'noopener' : undefined"
      @click="onClick"
      class="bandeau-lien"
      :aria-label="ariaLabel"
    >
      <!-- Deux copies identiques côte à côte : la piste défile de -50 %, la
           2ᵉ copie prend exactement la place de la 1ʳᵉ, la boucle est donc
           invisible. La copie est masquée aux lecteurs d'écran (aria-label
           sur le lien donne le texte une seule fois). -->
      <div class="bandeau-piste">
        <div v-for="copie in 2" :key="copie" class="bandeau-copie" :aria-hidden="true">
          <template v-for="(msg, i) in messagesRepetes" :key="`${copie}-${i}`">
            <span class="bandeau-msg" data-field-key="text" :style="fieldFontStyle(fieldFonts, 'text', fieldFontSizes)">{{ msg }}</span>
            <span class="bandeau-sep">{{ separator }}</span>
          </template>
        </div>
      </div>
    </component>
  </section>
</template>

<script setup>
import { computed, inject, ref, resolveComponent } from 'vue'
import { fieldFontStyle } from '~/utils/fonts.js'

const NuxtLink = resolveComponent('NuxtLink')

const props = defineProps({
  text: { type: String, default: '' },
  link: { type: String, default: '' },
  separator: { type: String, default: '✦' },
  speed: { type: Number, default: 30 },
  pauseOnHover: { type: Boolean, default: true },
  backgroundColor: { type: String, default: '#064886' },
  textColor: { type: String, default: '#ffffff' },
  animation: { type: String, default: 'none' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

// Une ligne du champ texte = un message.
const messages = computed(() =>
  (props.text || '').split('\n').map(l => l.trim()).filter(Boolean),
)

// Une seule copie doit être plus large que l'écran, sinon un vide apparaît
// avant que la 2ᵉ copie n'arrive : on répète les messages courts.
const messagesRepetes = computed(() => {
  const list = messages.value
  if (!list.length) return []
  const longueur = list.join(' ').length
  const repetitions = Math.max(1, Math.ceil(120 / Math.max(longueur, 1)))
  return Array.from({ length: repetitions }, () => list).flat()
})

// `speed` = secondes pour un tour complet, proportionnel à la longueur pour
// garder une vitesse de lecture constante quel que soit le texte.
const dureeSecondes = computed(() => {
  const base = Math.min(Math.max(Number(props.speed) || 30, 5), 120)
  const longueur = messagesRepetes.value.join(' ').length
  return Math.round(base * Math.max(1, longueur / 120))
})

const estInterne = computed(() => (props.link || '').startsWith('/'))
// En admin, un clic sur le bandeau doit le sélectionner pour l'éditer, pas
// quitter la page. Le lien reste rendu à l'identique (pas d'écart SSR /
// hydratation) : on annule seulement la navigation — RouterLink et <a>
// respectent `defaultPrevented`, la sélection (capture dans PageRenderer)
// a déjà eu lieu.
const isAdmin = inject('isAdmin', ref(false))
function onClick(e) {
  if (isAdmin.value) e.preventDefault()
}
const ariaLabel = computed(() => messages.value.join(' — ') || undefined)

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility?.mobile === false,
  'hide-tablet': props.visibility?.tablet === false,
  'hide-desktop': props.visibility?.desktop === false,
}))
</script>

<style scoped>
.block-bandeau {
  overflow: hidden;
  position: relative;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.bandeau-lien {
  display: block;
  color: inherit;
  text-decoration: none;
  padding: 12px 0;
}
.bandeau-lien:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -4px;
}
.bandeau-piste {
  display: flex;
  width: max-content;
  animation: bandeau-defile var(--bandeau-duree, 30s) linear infinite;
}
.bandeau-copie {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  white-space: nowrap;
}
.bandeau-msg {
  padding: 0 1.25em;
}
.bandeau-sep {
  opacity: 0.7;
}
.bandeau-pause:hover .bandeau-piste,
.bandeau-lien:focus-visible .bandeau-piste {
  animation-play-state: paused;
}
@keyframes bandeau-defile {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
/* Mouvement réduit : pas de défilement, le premier message reste lisible. */
@media (prefers-reduced-motion: reduce) {
  .bandeau-piste { animation: none; width: auto; justify-content: center; }
  .bandeau-copie + .bandeau-copie { display: none; }
}
@media (max-width: 600px) {
  .block-bandeau { font-size: 0.9em; }
  .bandeau-lien { padding: 10px 0; }
}
</style>
