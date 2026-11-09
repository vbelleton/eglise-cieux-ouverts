<template>
  <footer
    ref="footerEl"
    class="site-footer"
    :class="[{ animate: isAnimated }, visibilityClasses]"
    :style="footerBgStyle"
  >
    <div class="footer-inner" :ref="titleAnim.setRef">
      <div class="footer-left">
        <h2 class="footer-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">
          <span
            v-for="(char, i) in titleChars"
            :key="i"
            class="shutter-char"
            :class="[char === ' ' ? 'space' : '', { 'place-bold': i >= titleBoldStart && i <= titleBoldEnd }]"
            :style="getShutterStyle(i)"
          >
            {{ char === ' ' ? '\u00A0' : char }}
          </span>
        </h2>
      </div>

      <div class="footer-right">
        <div class="footer-info" :style="infoStyle">
          <a :href="'mailto:' + email" class="footer-email" data-field-key="email" :style="{ ...emailStyle, ...fieldFontStyle(fieldFonts, 'email', fieldFontSizes) }">{{ email }}</a>
          <p data-field-key="schedule" :style="fieldFontStyle(fieldFonts, 'schedule', fieldFontSizes)"><template v-if="scheduleParts">{{ scheduleParts[0] }}| <strong>{{ scheduleParts[1] }}</strong></template><template v-else>{{ schedule }}</template></p>
          <p data-field-key="address" :style="fieldFontStyle(fieldFonts, 'address', fieldFontSizes)"><template v-if="addressParts">{{ addressParts[0] }}| <strong>{{ addressParts[1] }}</strong></template><template v-else>{{ address }}</template></p>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { useAnimatedElements } from '~/composables/useAnimatedElements'
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: "Il y a une place pour toi !" },
  email: { type: String, default: "contact@cieuxouverts.bzh" },
  schedule: { type: String, default: "Rdv chaque dimanche | 10H" },
  address: { type: String, default: "2 rue Jean Monnet | 29600 Morlaix, Bretagne" },
  bgColorStart: { type: String, default: '#064886' },
  bgColorMid: { type: String, default: '#064886' },
  bgColorEnd: { type: String, default: '#5a9fcf' },
  bgColorMobileStart: { type: String, default: '#d46269' },
  bgColorMobileEnd: { type: String, default: '#be4f56' },
  fontSize: { type: [Number, String], default: 19 },
  titleFontSize: { type: [Number, String], default: 24 },
  textColor: { type: String, default: '#ffffff' },
  titleBoldStart: { type: Number, default: 11 },
  titleBoldEnd: { type: Number, default: 15 },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

const { addElement } = useAnimatedElements(props.blockId)
const titleAnim = addElement('title', { animation: 'fadeIn', delay: 0 })
const isEditor = inject('isEditor', ref(false))
// Pied de page déjà visible au chargement, sans défilement (page courte :
// page d'erreur, page en panne, grand écran) : le visiteur n'a aucune raison
// de défiler, or le titre n'apparaît qu'au fil de l'entrée du pied de page
// dans l'écran — il restait à moitié écrit (« Il y a une pla »), voire
// invisible. On joue alors l'animation dans le temps, comme dans l'éditeur.
// Réévalué quand la hauteur de la page change (le layout est persistant :
// une navigation interne peut passer d'une page longue à une page courte),
// mais seulement en haut de page, pour ne rien basculer en plein défilement.
const footerEl = ref(null)
const visibleSansDefiler = ref(false)
function evaluerVisibiliteInitiale() {
  if (!footerEl.value || window.scrollY > 4) return
  visibleSansDefiler.value = footerEl.value.getBoundingClientRect().top < window.innerHeight
}
let observateurHauteur = null
onMounted(() => {
  evaluerVisibiliteInitiale()
  window.addEventListener('resize', evaluerVisibiliteInitiale)
  if (typeof ResizeObserver !== 'undefined') {
    observateurHauteur = new ResizeObserver(evaluerVisibiliteInitiale)
    observateurHauteur.observe(document.getElementById('app-root') || document.body)
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', evaluerVisibiliteInitiale)
  observateurHauteur?.disconnect()
})

const isAnimated = computed(() => titleAnim.triggered.value || isEditor.value || visibleSansDefiler.value)

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility?.mobile === false,
  'hide-tablet': props.visibility?.tablet === false,
  'hide-desktop': props.visibility?.desktop === false,
}))

const titleChars = computed(() => props.title.split(''))

// « Texte | mise en gras » : la partie après la barre est affichée en gras.
//
// Ces deux champs passaient par `v-html` sur une chaîne construite par
// concaténation, sans le moindre échappement : tout HTML saisi dans les
// champs Horaires ou Adresse de la sidebar était injecté tel quel, sur
// TOUTES les pages du site (le footer est global). On renvoie désormais les
// deux morceaux et le template les interpole en texte — rendu identique,
// injection impossible. `null` = pas de séparateur, on affiche la chaîne
// brute (toujours en texte).
function splitOnPipe(value) {
  const parts = String(value ?? '').split('|')
  if (parts.length < 2) return null
  return [parts[0], parts[1].trim()]
}

const scheduleParts = computed(() => splitOnPipe(props.schedule))
const addressParts = computed(() => splitOnPipe(props.address))

const footerBgStyle = computed(() => ({
  '--bf-bg-start': props.bgColorStart,
  '--bf-bg-mid': props.bgColorMid,
  '--bf-bg-end': props.bgColorEnd,
  '--bf-bg-mobile-start': props.bgColorMobileStart,
  '--bf-bg-mobile-end': props.bgColorMobileEnd,
  '--bf-text-color': props.textColor,
  '--bf-font-size': typeof props.fontSize === 'number' ? props.fontSize + 'px' : props.fontSize,
  '--bf-title-font-size': typeof props.titleFontSize === 'number' ? props.titleFontSize + 'px' : props.titleFontSize,
}))

const infoStyle = computed(() => ({
  fontSize: 'var(--bf-font-size)',
  color: 'var(--bf-text-color)',
}))

const emailStyle = computed(() => ({
  color: 'var(--bf-text-color)',
  fontSize: 'var(--bf-font-size)',
}))

// Chaque lettre apparaît pendant l'entrée du pied de page dans l'écran
// (`entry`), toujours entièrement parcourue : le pied de page est le dernier
// élément, on finit forcément par le voir en entier. Les plages étaient en
// `cover`, dont le bout n'est jamais atteint en bas de page : sur un écran
// haut (MacBook, 1920×1080), les dernières lettres (« oi ! ») restaient
// figées en cours d'animation, donc invisibles.
function getShutterStyle(i) {
  const total = titleChars.value.length
  const pas = total > 1 ? 65 / (total - 1) : 0
  const d = i * pas
  return {
    '--shutter-d': `${d}%`,
    '--shutter-e': `${d + 30}%`,
    '--shutter-delay': `${(i * 15 / total) * 0.14}s`,
  }
}
</script>

<style scoped>
.site-footer {
  background: linear-gradient(to bottom, var(--bf-bg-start) 0%, var(--bf-bg-mid) 24%, var(--bf-bg-end) 100%);
  color: var(--bf-text-color, white);
  position: relative;
  overflow: hidden;
  view-timeline-name: --footer;
  view-timeline-axis: block;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 40px;
}

.footer-left {
  flex: 1;
}

.footer-title {
  font-family: var(--font-body);
  font-size: var(--bf-title-font-size, 24px);
  font-weight: 800;
  color: var(--bf-text-color, #ffffff);
  margin: 0;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
}

.shutter-char {
  display: inline-block;
  clip-path: inset(0 0 0 0);
  opacity: 1;
}

/* Scroll-driven animation */
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    .shutter-char {
      overflow: hidden;
      clip-path: inset(0 100% 0 0);
      opacity: 0;
      animation-name: reveal;
      animation-timeline: --footer;
      animation-range: entry var(--shutter-d) entry var(--shutter-e);
      animation-fill-mode: both;
    }
  }
}

/* Fallback: always visible + animated when in admin or when IntersectionObserver triggered */
.site-footer.animate .shutter-char {
  overflow: hidden;
  animation: reveal 0.8s ease both;
  animation-delay: var(--shutter-delay);
}

@keyframes reveal {
  0%, 3% { clip-path: inset(0 100% 0 0); opacity: 0; }
  6%, 25% { clip-path: inset(0 0 0 0); opacity: 1; }
  28%, 50% { clip-path: inset(0 100% 0 0); opacity: 0; }
  53%, 100% { clip-path: inset(0 0 0 0); opacity: 1; }
}

.space {
  display: inline-block;
  width: 0.35em;
}

.place-bold {
  font-weight: 700;
}

.footer-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 800;
  text-align: left;
  font-family: var(--font-body);
  font-size: 19px;
  -webkit-font-smoothing: antialiased;
}

.footer-email {
  font-weight: 800;
  text-decoration: none;
  margin-bottom: 4px;
  display: block;
  font-size: 19px;
}

.footer-email:hover {
  text-decoration: underline;
}

.footer-email:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
  border-radius: 4px;
}

.footer-info p {
  color: var(--bf-text-color, white);
  line-height: 1.6;
  margin: 0;
}

.footer-info :deep(strong) {
  font-weight: 700;
  color: var(--bf-text-color, white);
}

@media (prefers-reduced-motion: reduce) {
  .shutter-char {
    animation: none !important;
    clip-path: inset(0 0 0 0) !important;
    opacity: 1 !important;
  }
}

@media (max-width: 768px) {
  .site-footer {
    background: linear-gradient(180deg, var(--bf-bg-mobile-start) 0%, var(--bf-bg-mobile-end) 100%);
    min-height: 0;
  }
  .footer-inner {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    padding: 20px 10px 16px;
  }
  .footer-right {
    justify-content: center;
  }
  .footer-info {
    text-align: center;
    font-size: 0.92em;
  }
  .footer-title {
    white-space: normal;
    text-align: center;
  }
  .footer-email {
    margin-bottom: 4px;
    font-size: 1em;
  }
}
</style>
