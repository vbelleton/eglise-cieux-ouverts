<template>
  <section
    v-if="slides.length"
    class="block-diaporama"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
    role="region"
    aria-roledescription="carrousel"
    :aria-label="title || regionLabel"
    @mouseenter="survol = true"
    @mouseleave="survol = false"
    @focusin="focusDedans = true"
    @focusout="onFocusOut"
  >
    <div class="dia-inner">
      <h2 v-if="title" class="dia-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <div class="dia-cadre">
        <!-- Piste à défilement natif (scroll-snap) : sans JavaScript, on fait
             toujours défiler les affiches au doigt, à la molette ou au
             clavier ; le script n'ajoute que le défilement automatique, les
             flèches et les points. -->
        <div
          ref="piste"
          class="dia-piste"
          tabindex="0"
          :aria-label="title || regionLabel"
          @scroll.passive="majPosition"
        >
          <div
            v-for="(slide, i) in slides"
            :key="(slide.agenda ? 'agenda:' : '') + slide.image + i"
            class="dia-slide"
            :class="{ 'dia-slide-perimee': isAdmin && !slide.agenda && (estPerimee(slide, jour) || remplacees.has(slide)), 'dia-slide-agenda': slide.agenda }"
            role="group"
            aria-roledescription="diapositive"
            :aria-label="`${slideLabel} ${i + 1} / ${slides.length}`"
          >
            <component
              :is="slide.link ? (estInterne(slide.link) ? NuxtLink : 'a') : 'div'"
              :to="slide.link && estInterne(slide.link) ? slide.link : undefined"
              :href="slide.link && !estInterne(slide.link) ? slide.link : undefined"
              :target="slide.link && !estInterne(slide.link) ? '_blank' : undefined"
              :rel="slide.link && !estInterne(slide.link) ? 'noopener' : undefined"
              :tabindex="slide.link && i !== position ? -1 : undefined"
              class="dia-lien"
              @click="onClick"
            >
              <!-- Affiche venue de l'agenda : ImageAgenda écrit la date et
                   l'heure de la séance sur une affiche automatique. -->
              <ImageAgenda
                v-if="slide.agenda"
                :src="image(slide)"
                :alt="slide.alt"
                :date="slide.date"
                :heure="slide.heure"
                :titre="slide.titre"
                :rythme="slide.rythme"
                :prioritaire="i === 0"
                class="dia-image-agenda"
              />
              <span v-if="slide.agenda && !modelePourImage(slide.image)" class="dia-legende">
                <strong>{{ slide.titre }}</strong>
                <span>{{ slide.jourLisible }}<template v-if="slide.heureLisible"> · {{ slide.heureLisible }}</template></span>
              </span>
              <img
                v-if="!slide.agenda"
                :src="image(slide)"
                :alt="slide.alt || ''"
                class="dia-image"
                width="1600"
                height="900"
                :loading="i === 0 ? 'eager' : 'lazy'"
                :fetchpriority="i === 0 ? 'high' : undefined"
                decoding="async"
                draggable="false"
              />
            </component>
            <span v-if="isAdmin && slide.agenda" class="dia-badge dia-badge-agenda">{{ ADMIN.badgeAgenda }}</span>
            <span v-else-if="isAdmin && remplacees.has(slide)" class="dia-badge dia-badge-agenda">{{ ADMIN.badgeRemplacee }}</span>
            <span v-else-if="isAdmin && estPerimee(slide, jour)" class="dia-badge">{{ expiredLabel }}</span>
            <span v-else-if="isAdmin && alertesParSlide.get(slide)?.length" class="dia-badge dia-badge-alerte">{{ ADMIN.badgeAlerte }}</span>
          </div>
        </div>
        <template v-if="slides.length > 1">
          <button type="button" class="dia-fleche dia-fleche-prec" :aria-label="prevLabel" @click="aller(-1, true)">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" class="dia-fleche dia-fleche-suiv" :aria-label="nextLabel" @click="aller(1, true)">
            <span aria-hidden="true">›</span>
          </button>
        </template>
      </div>
      <div v-if="slides.length > 1" class="dia-commandes">
        <button
          type="button"
          class="dia-pause"
          :aria-label="enPause ? playLabel : pauseLabel"
          :title="enPause ? playLabel : pauseLabel"
          :style="{ color: textColor, borderColor: textColor }"
          @click="basculerPause"
        >
          <span v-if="enPause" aria-hidden="true">▶</span>
          <span v-else aria-hidden="true">❚❚</span>
        </button>
        <div class="dia-points">
          <button
            v-for="(slide, i) in slides"
            :key="i"
            type="button"
            class="dia-point"
            :class="{ 'dia-point-actif': i === position }"
            :aria-label="`${slideLabel} ${i + 1}`"
            :aria-current="i === position ? 'true' : undefined"
            :style="{ background: textColor }"
            @click="allerA(i, true)"
          ></button>
        </div>
      </div>
      <!-- Admin : l'état de l'alignement avec l'agenda, visible sans faire
           défiler les affiches une à une. -->
      <div v-if="isAdmin" class="dia-verif" data-testid="diaporama-verif" :class="{ 'dia-verif-ok': !alertesAdmin.length }">
        <p class="dia-verif-titre">{{ titreVerif }}</p>
        <ul v-if="alertesAdmin.length">
          <li v-for="(a, k) in alertesAdmin" :key="k">{{ a }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, resolveComponent, watch } from 'vue'
import { fieldFontStyle } from '~/utils/fonts.js'
import { sourceSure } from '~/utils/safeLink.js'
import {
  estPerimee,
  fusionnerSlides,
  jourLisible,
  jourParis,
  slidesAffichees,
  slidesAgenda,
  titreNet,
  verifierSlide,
} from '~/utils/diaporama.js'
import { modelePourImage } from '~/utils/posterTemplates.js'
import ImageAgenda from '~/components/ImageAgenda.vue'

const NuxtLink = resolveComponent('NuxtLink')

const props = defineProps({
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  interval: { type: Number, default: 6 },
  regionLabel: { type: String, default: "À l'affiche" },
  prevLabel: { type: String, default: 'Affiche précédente' },
  nextLabel: { type: String, default: 'Affiche suivante' },
  pauseLabel: { type: String, default: 'Mettre le diaporama en pause' },
  playLabel: { type: String, default: 'Relancer le diaporama' },
  slideLabel: { type: String, default: 'Affiche' },
  expiredLabel: { type: String, default: 'Date passée : masquée sur le site' },
  agenda: { type: Boolean, default: true },
  agendaJours: { type: Number, default: 30 },
  backgroundColor: { type: String, default: '#0b2440' },
  textColor: { type: String, default: '#ffffff' },
  animation: { type: String, default: 'none' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

const isAdmin = inject('isAdmin', ref(false))

// Jour de référence calculé au rendu serveur et transmis tel quel au client
// (useState) : l'hydratation voit exactement la même liste que le HTML, même
// si la page vient d'un cache. Le vrai jour du visiteur est repris au montage.
const jour = useState('diaporama-jour', () => jourParis())

// Agenda (Worker événements) : chargé côté client seulement, comme partout
// sur le site ; la requête est partagée avec l'en-tête (lien Événements),
// donc aucun appel de plus. Au rendu serveur, seules les affiches posées à la
// main sont dans le HTML ; celles de l'agenda arrivent au montage.
const { evenements, loading: evenementsEnCours, erreur: evenementsErreur } = useChurchEvents()

const agendaCalcule = computed(() => {
  if (!props.agenda || evenementsErreur.value) return { ajoutees: [], ecartees: [], remplacees: [] }
  return slidesAgenda(evenements.value, props.items, { aujourdhui: jour.value, jours: props.agendaJours })
})
const nbAgenda = computed(() => agendaCalcule.value.ajoutees.length)

// En admin, les affiches périmées restent visibles (signalées) pour qu'on
// puisse les retrouver et les retirer ; sur le site, elles disparaissent.
const manuelles = computed(() => {
  if (isAdmin.value) return (props.items || []).filter((s) => s && String(s.image || '').trim())
  return slidesAffichees(props.items, jour.value)
})
// Affiches posées à la main que remplace l'affiche automatique de l'agenda :
// masquées sur le site, gardées (et signalées) en admin.
const remplacees = computed(() => new Set(agendaCalcule.value.remplacees))
const slides = computed(() => {
  const gardees = isAdmin.value ? manuelles.value : manuelles.value.filter((s) => !remplacees.value.has(s))
  return fusionnerSlides(gardees, agendaCalcule.value.ajoutees)
})

// ─── Alertes (admin) ──────────────────────────────────────────────────────
// Messages vus seulement dans l'admin : écrits ici, pas dans les réglages
// du bloc (rien de visible pour les visiteurs).
const ADMIN = {
  badgeAgenda: "📅 Depuis l'agenda (à modifier dans Événements)",
  badgeRemplacee: "📅 Remplacée par l'affiche automatique de l'agenda (masquée sur le site)",
  badgeAlerte: "⚠ À vérifier : ne correspond plus à l'agenda",
}
const alertesParSlide = computed(() => {
  const m = new Map()
  if (!isAdmin.value || evenementsEnCours.value || evenementsErreur.value) return m
  for (const s of manuelles.value) m.set(s, verifierSlide(s, evenements.value, jour.value))
  return m
})

function nomAffiche(s) {
  const n = manuelles.value.indexOf(s) + 1
  const texte = String(s.alt || '').split(/[.:,]/)[0].trim()
  return `Affiche ${n}${texte ? ` (« ${texte.slice(0, 50)} »)` : ''}`
}

const alertesAdmin = computed(() => {
  if (!isAdmin.value || evenementsEnCours.value) return []
  if (evenementsErreur.value) return ["Agenda injoignable pour l'instant : impossible de vérifier les affiches. Recharge la page dans un moment."]
  const sortie = []
  for (const [s, alertes] of alertesParSlide.value) for (const a of alertes) sortie.push(`${nomAffiche(s)} : ${a}`)
  if (props.agenda) {
    for (const e of agendaCalcule.value.ecartees) {
      sortie.push(
        `« ${titreNet(e.evt.titre)} » du ${jourLisible(e.jour)} n'est pas ajoutée au diaporama : son image dans l'agenda est l'affiche du ${jourLisible(e.dateImage)}. ` +
          'Dans 📅 Événements, choisis « Affiche automatique » ou mets la bonne affiche.',
      )
    }
  }
  return sortie
})

const titreVerif = computed(() => {
  if (evenementsEnCours.value) return "Vérification avec l'agenda…"
  const n = alertesAdmin.value.length
  if (n) return `⚠ ${n} point${n > 1 ? 's' : ''} à vérifier avec l'agenda`
  const a = nbAgenda.value
  return `✓ Diaporama aligné sur l'agenda${a ? ` (${a} affiche${a > 1 ? 's' : ''} ajoutée${a > 1 ? 's' : ''} d'office depuis l'agenda)` : ''}.`
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

function image(slide) {
  return sourceSure(slide?.image)
}

function estInterne(lien) {
  return String(lien || '').startsWith('/')
}

// En admin, un clic sur une affiche doit sélectionner le bloc, pas suivre le
// lien (même principe que le bandeau).
function onClick(e) {
  if (isAdmin.value) e.preventDefault()
}

// ─── Position ─────────────────────────────────────────────────────────────
const piste = ref(null)
const position = ref(0)

function majPosition() {
  const el = piste.value
  if (!el || !el.clientWidth) return
  position.value = Math.max(0, Math.min(slides.value.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
}

function allerA(i, parVisiteur = false) {
  const el = piste.value
  if (!el) return
  if (parVisiteur) relancerMinuteur()
  el.scrollTo({ left: i * el.clientWidth, behavior: mouvementReduit() ? 'auto' : 'smooth' })
}

function aller(delta, parVisiteur = false) {
  const n = slides.value.length
  if (!n) return
  allerA((position.value + delta + n) % n, parVisiteur)
}

// ─── Défilement automatique ──────────────────────────────────────────────
// Arrêté : au survol, quand le clavier est dans le diaporama, onglet caché,
// en admin, et d'office si le visiteur a demandé moins d'animations
// (le bouton lecture reste disponible). Le bouton pause l'arrête pour de bon.
const pauseVisiteur = ref(false)
const survol = ref(false)
const focusDedans = ref(false)
const ongletCache = ref(false)
let minuteur = null

function mouvementReduit() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const enPause = computed(() => pauseVisiteur.value)
const defileActif = computed(
  () => !pauseVisiteur.value && !survol.value && !focusDedans.value && !ongletCache.value && !isAdmin.value && slides.value.length > 1,
)

function arreterMinuteur() {
  if (minuteur) clearInterval(minuteur)
  minuteur = null
}

function relancerMinuteur() {
  arreterMinuteur()
  if (!defileActif.value) return
  const secondes = Math.min(Math.max(Number(props.interval) || 6, 3), 60)
  minuteur = setInterval(() => aller(1), secondes * 1000)
}

function basculerPause() {
  pauseVisiteur.value = !pauseVisiteur.value
}

function onFocusOut(e) {
  if (!e.currentTarget?.contains(e.relatedTarget)) focusDedans.value = false
}

function onVisibilite() {
  ongletCache.value = document.hidden
}

watch(defileActif, relancerMinuteur)
watch(() => props.interval, relancerMinuteur)
watch(slides, () => {
  if (position.value > slides.value.length - 1) position.value = 0
})

onMounted(() => {
  jour.value = jourParis()
  if (mouvementReduit()) pauseVisiteur.value = true
  document.addEventListener('visibilitychange', onVisibilite)
  relancerMinuteur()
})

onUnmounted(() => {
  arreterMinuteur()
  document.removeEventListener('visibilitychange', onVisibilite)
})
</script>

<style scoped>
.block-diaporama {
  padding: 40px 16px 28px;
}
.dia-inner {
  max-width: 1100px;
  margin: 0 auto;
}
.dia-title {
  margin: 0 0 20px;
  text-align: center;
  font-size: clamp(1.5em, 4vw, 2.1em);
}
.dia-cadre {
  position: relative;
}
.dia-piste {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  border-radius: 14px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  aspect-ratio: 16 / 9;
  background: rgba(0, 0, 0, 0.2);
}
.dia-piste::-webkit-scrollbar { display: none; }
.dia-piste:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
.dia-slide {
  position: relative;
  flex: 0 0 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
.dia-lien {
  display: block;
  width: 100%;
  height: 100%;
}
.dia-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}
.dia-slide-perimee .dia-image { opacity: 0.45; filter: grayscale(0.7); }
/* Affiche de l'agenda : cadre 16:9 d'ImageAgenda, sur le fond du diaporama
   (une image d'un autre format est montrée en entier, sans recadrage). */
.dia-slide :deep(.dia-image-agenda) {
  height: 100%;
  background: transparent;
}
.dia-legende {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  padding: 28px 20px 14px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.78));
  color: #fff;
  font-size: clamp(0.95em, 2.4vw, 1.25em);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.dia-legende span::first-letter { text-transform: uppercase; }
.dia-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #c0392b;
  color: #fff;
  font-size: 0.85em;
  font-weight: 700;
}
.dia-badge-agenda { background: #1f5fa8; }
.dia-badge-alerte { background: #d35400; }
.dia-verif {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #fff4e5;
  color: #5a3200;
  border: 2px solid #e67e22;
  font-size: 0.92em;
  text-align: left;
}
.dia-verif-ok {
  background: #eaf7ee;
  color: #1d5b2e;
  border-color: #2e8b57;
}
.dia-verif-titre { margin: 0; font-weight: 700; }
.dia-verif ul { margin: 8px 0 0; padding-left: 20px; }
.dia-verif li + li { margin-top: 6px; }
.dia-fleche {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 1.8em;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0 4px;
  transition: background 0.2s;
}
.dia-fleche:hover, .dia-fleche:focus-visible { background: rgba(0, 0, 0, 0.7); }
.dia-fleche:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.dia-fleche-prec { left: 12px; }
.dia-fleche-suiv { right: 12px; }
.dia-commandes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
}
.dia-pause {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid;
  background: transparent;
  font-size: 0.8em;
  cursor: pointer;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dia-pause:hover { opacity: 1; }
.dia-pause:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.dia-points {
  display: flex;
  gap: 10px;
}
/* Cible tactile de 24 px autour d'un point de 10 px. */
.dia-point {
  width: 10px;
  height: 10px;
  padding: 0;
  border: 7px solid transparent;
  box-sizing: content-box;
  background-clip: content-box !important;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.35;
}
.dia-point-actif { opacity: 1; }
.dia-point:focus-visible { outline: 2px solid currentColor; }

@media (max-width: 600px) {
  .block-diaporama { padding: 24px 0 20px; }
  .dia-piste { border-radius: 0; }
  /* Au doigt, on fait glisser les affiches : les flèches masqueraient le
     texte de l'image. Points et pause restent dessous. */
  .dia-fleche { display: none; }
}
</style>
