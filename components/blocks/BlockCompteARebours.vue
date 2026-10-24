<template>
  <section
    class="block-compte-a-rebours"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="car-inner">
      <h2 v-if="title" class="car-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="subtitle" class="car-subtitle" data-field-key="subtitle" :style="fieldFontStyle(fieldFonts, 'subtitle', fieldFontSizes)">{{ subtitle }}</p>
      <p v-if="termine" class="car-done" role="status" data-field-key="doneText" :style="fieldFontStyle(fieldFonts, 'doneText', fieldFontSizes)">{{ doneText }}</p>
      <div v-else-if="cible" class="car-units" role="timer" :aria-label="resume">
        <div v-for="u in unites" :key="u.cle" class="car-unit" :style="{ background: cardColor }">
          <span class="car-number">{{ u.valeur }}</span>
          <span class="car-label">{{ u.label }}</span>
        </div>
      </div>
      <div v-if="buttonLabel" class="car-button">
        <BlockLinkButton :href="buttonLink" variant="primary" :color="buttonColor" :text-color="buttonTextColor">{{ buttonLabel }}</BlockLinkButton>
      </div>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  targetDate: { type: String, default: '' },
  showSeconds: { type: Boolean, default: true },
  doneText: { type: String, default: "C'est maintenant !" },
  daysLabel: { type: String, default: 'Jours' },
  hoursLabel: { type: String, default: 'Heures' },
  minutesLabel: { type: String, default: 'Minutes' },
  secondsLabel: { type: String, default: 'Secondes' },
  buttonLabel: { type: String, default: '' },
  buttonLink: { type: String, default: '' },
  backgroundColor: { type: String, default: '#064886' },
  textColor: { type: String, default: '#ffffff' },
  cardColor: { type: String, default: 'rgba(255, 255, 255, 0.14)' },
  buttonColor: { type: String, default: '#d97777' },
  buttonTextColor: { type: String, default: '#ffffff' },
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

// « AAAA-MM-JJ HH:MM » (ou avec un T). L'heure est celle de l'appareil du
// visiteur. Une date illisible n'affiche aucun compteur plutôt qu'un faux.
function lireDate(texte) {
  const t = String(texte || '').trim()
  if (!t) return null
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2})(?::(\d{2}))?)?$/)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

const cible = computed(() => lireDate(props.targetDate))

// `maintenant` reste nul au rendu serveur et à l'hydratation : le compteur
// n'est calculé qu'une fois monté, sans décalage entre serveur et navigateur.
const maintenant = ref(null)
let minuteur = null

onMounted(() => {
  maintenant.value = Date.now()
  minuteur = setInterval(() => { maintenant.value = Date.now() }, 1000)
})
onUnmounted(() => clearInterval(minuteur))

const reste = computed(() => {
  if (!cible.value || maintenant.value === null) return null
  return Math.max(0, cible.value.getTime() - maintenant.value)
})

const termine = computed(() => reste.value === 0)

const unites = computed(() => {
  const r = reste.value
  const pas = (n) => (r === null ? '–' : String(n).padStart(2, '0'))
  const s = r === null ? 0 : Math.floor(r / 1000)
  const liste = [
    { cle: 'j', label: props.daysLabel, valeur: r === null ? '–' : String(Math.floor(s / 86400)) },
    { cle: 'h', label: props.hoursLabel, valeur: pas(Math.floor((s % 86400) / 3600)) },
    { cle: 'm', label: props.minutesLabel, valeur: pas(Math.floor((s % 3600) / 60)) },
  ]
  if (props.showSeconds) liste.push({ cle: 's', label: props.secondsLabel, valeur: pas(s % 60) })
  return liste
})

const resume = computed(() => unites.value.map((u) => `${u.valeur} ${u.label}`).join(', '))
</script>

<style scoped>
.block-compte-a-rebours {
  padding: 70px 24px;
  text-align: center;
}
.car-inner {
  max-width: 760px;
  margin: 0 auto;
}
.car-title {
  margin: 0;
  font-size: clamp(1.6em, 4vw, 2.2em);
}
.car-subtitle {
  margin: 12px 0 0;
  opacity: 0.9;
  line-height: 1.6;
}
.car-units {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 30px;
}
.car-unit {
  min-width: 96px;
  padding: 16px 12px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
}
.car-number {
  font-size: clamp(2em, 6vw, 3em);
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.car-label {
  margin-top: 4px;
  font-size: 0.85em;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.85;
}
.car-done {
  margin: 30px 0 0;
  font-size: clamp(1.4em, 4vw, 2em);
  font-weight: 700;
}
.car-button { margin-top: 32px; }

@media (max-width: 600px) {
  .block-compte-a-rebours { padding: 50px 16px; }
  .car-unit { min-width: 70px; padding: 12px 8px; }
}
</style>
