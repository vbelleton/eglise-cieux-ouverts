<template>
  <div
    ref="racine"
    class="liseuse"
    :class="{ 'liseuse-plein': pleinEcran, 'liseuse-pseudo-plein': pseudoPlein }"
    role="region"
    :aria-label="`Liseuse — ${numero.titre}`"
  >
    <div ref="zone" class="liseuse-zone">
      <!-- Zoom : les pages de la vue en grand, dans une zone qui défile
           (déplacement au doigt ou à la molette, natif). -->
      <div v-if="zoom" class="liseuse-zoom" tabindex="0" aria-label="Pages agrandies, faire défiler pour se déplacer">
        <div class="liseuse-zoom-pages">
          <div
            v-for="p in pagesVisibles"
            :key="p"
            class="liseuse-zoom-page"
            :style="{ width: `${tailleZoom.largeur}px`, height: `${tailleZoom.hauteur}px` }"
          >
            <MagazinePage :numero="numero" :page="p" :sizes="`${tailleZoom.largeur}px`" />
          </div>
        </div>
      </div>

      <div
        v-else
        class="livre"
        :class="[double ? 'livre-double' : 'livre-simple', { 'livre-glisse': glisse }]"
        :style="{ width: `${tailleLivre.largeur}px`, height: `${tailleLivre.hauteur}px` }"
        @pointerdown="debutGeste"
        @pointermove="pendantGeste"
        @pointerup="finGeste"
        @pointercancel="annulerGeste"
        @click="clicLivre"
      >
        <template v-if="double">
          <div class="cote cote-gauche" :class="{ 'cote-vide': !affichage.gauche }">
            <MagazinePage :numero="numero" :page="affichage.gauche" :sizes="sizes" prioritaire />
          </div>
          <div class="cote cote-droite" :class="{ 'cote-vide': !affichage.droite }">
            <MagazinePage :numero="numero" :page="affichage.droite" :sizes="sizes" prioritaire />
          </div>
          <div v-if="affichage.gauche && affichage.droite" class="pli" aria-hidden="true" />
        </template>
        <div v-else class="cote cote-unique">
          <MagazinePage :numero="numero" :page="affichage.unique" :sizes="sizes" prioritaire />
        </div>

        <!-- Feuille en train de tourner : recto = page qui part, verso = page
             qui arrive (le dos de la feuille). -->
        <div
          v-if="feuille"
          class="feuille"
          :class="[`feuille-${feuille.sens}`, { 'feuille-anime': feuille.anime }]"
          :style="styleFeuille"
          aria-hidden="true"
        >
          <div class="face face-recto">
            <MagazinePage :numero="numero" :page="feuille.recto" :sizes="sizes" />
            <div class="ombre-face" :style="{ opacity: ombre }" />
          </div>
          <div class="face face-verso">
            <MagazinePage :numero="numero" :page="feuille.verso" :sizes="sizes" />
            <div class="ombre-face" :style="{ opacity: ombre }" />
          </div>
        </div>
      </div>

      <button
        type="button"
        class="fleche fleche-gauche"
        :disabled="!peutReculer"
        aria-label="Page précédente"
        @click="precedent"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        class="fleche fleche-droite"
        :disabled="!peutAvancer"
        aria-label="Page suivante"
        @click="suivant"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>

      <!-- Toutes les pages en vignettes (400 px, chargées au fil du défilement). -->
      <div v-if="vignettesOuvertes" class="vignettes" role="dialog" aria-label="Toutes les pages">
        <div class="vignettes-entete">
          <span>Toutes les pages</span>
          <button type="button" class="vignettes-fermer" aria-label="Fermer" @click="vignettesOuvertes = false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <ul class="vignettes-grille">
          <li v-for="p in numero.pages" :key="p">
            <button
              type="button"
              class="vignette"
              :class="{ 'vignette-active': pagesVisibles.includes(p) }"
              :aria-label="`Aller à la page ${p}`"
              @click="allerALaPage(p)"
            >
              <img :src="imagePage(numero, p, 's')" :width="numero.largeur" :height="numero.hauteur" alt="" loading="lazy" decoding="async">
              <span>{{ p }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="liseuse-barre">
      <div class="barre-pages">
        <span class="barre-libelle" aria-live="polite">{{ libelle }}</span>
      </div>
      <div class="barre-actions">
        <button type="button" class="barre-bouton" :aria-pressed="vignettesOuvertes" title="Toutes les pages" @click="vignettesOuvertes = !vignettesOuvertes">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
          <span class="barre-texte">Pages</span>
        </button>
        <button type="button" class="barre-bouton" :aria-pressed="zoom" :title="zoom ? 'Revenir à la taille normale' : 'Agrandir'" @click="basculerZoom">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /><path v-if="!zoom" d="M11 8.5v5M8.5 11h5" /><path v-else d="M8.5 11h5" /></svg>
          <span class="barre-texte">{{ zoom ? 'Réduire' : 'Zoom' }}</span>
        </button>
        <button type="button" class="barre-bouton" :aria-pressed="pleinEcran || pseudoPlein" :title="pleinEcran || pseudoPlein ? 'Quitter le plein écran' : 'Plein écran'" @click="basculerPleinEcran">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="!(pleinEcran || pseudoPlein)" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            <path v-else d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          </svg>
          <span class="barre-texte">Plein écran</span>
        </button>
        <a v-if="numero.pdf" :href="numero.pdf" class="barre-bouton" download title="Télécharger le PDF">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          <span class="barre-texte">PDF</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { decouperVues, vueDeLaPage, libelleVue, imagePage, srcsetPage } from '~/utils/magazines.js'

const props = defineProps({
  numero: { type: Object, required: true },
  pageInitiale: { type: Number, default: 1 },
})

const DUREE_TOUR = 550 // ms, doit suivre la transition de .feuille-anime
const racine = ref(null)
const zone = ref(null)

// ─── Disposition ─────────────────────────────────────────────────────────
// Rendu serveur en page simple ; la double page (grand écran en largeur) est
// décidée au montage, une fois la taille réelle connue.
const dimensionsZone = ref({ largeur: 0, hauteur: 0 })
const double = ref(false)
const ratio = computed(() => (props.numero.hauteur || 1414) / (props.numero.largeur || 1000))

const vues = computed(() => decouperVues(props.numero.pages, double.value))
const indexVue = ref(vueDeLaPage(decouperVues(props.numero.pages, false), borner(props.pageInitiale)))
const vueCourante = computed(() => vues.value[indexVue.value] || [])
const pagesVisibles = computed(() => vueCourante.value.filter(Boolean))
const libelle = computed(() => libelleVue(vueCourante.value, props.numero.pages))
const peutAvancer = computed(() => indexVue.value < vues.value.length - 1)
const peutReculer = computed(() => indexVue.value > 0)

function borner(p) {
  const n = Number.parseInt(p, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), props.numero.pages) : 1
}

const tailleLivre = computed(() => {
  const { largeur, hauteur } = dimensionsZone.value
  const colonnes = double.value ? 2 : 1
  if (!largeur || !hauteur) return { largeur: 0, hauteur: 0, page: 0 }
  // Marges : place des flèches sur les côtés, respiration en haut et en bas.
  const margeX = largeur < 600 ? 16 : 120
  const dispoL = Math.max(120, largeur - margeX)
  const dispoH = Math.max(160, hauteur - 32)
  const pageL = Math.min(dispoL / colonnes, dispoH / ratio.value)
  return { largeur: Math.floor(pageL * colonnes), hauteur: Math.floor(pageL * ratio.value), page: pageL }
})

const tailleZoom = computed(() => {
  const base = tailleLivre.value.page || 500
  const largeur = Math.round(Math.min(base * 2, 1600))
  return { largeur, hauteur: Math.round(largeur * ratio.value) }
})

// `sizes` des images : largeur affichée, plafonnée à 2× la densité de l'écran.
// Un téléphone 3× n'a pas besoin de l'image 1600 px pour une page de 390 px :
// la 1000 px suffit à l'œil et pèse deux fois moins.
const sizes = computed(() => {
  const l = tailleLivre.value.page
  // Rendu serveur : densité inconnue. 60vw sur téléphone fait choisir la
  // 1000 px à un écran 2× ou 3× (pas la 1600) et la 400 px à un écran 1×.
  if (!l || typeof window === 'undefined') return '(min-width: 900px) 45vw, 60vw'
  const dpr = window.devicePixelRatio || 1
  return `${Math.round((l * Math.min(dpr, 2)) / dpr)}px`
})

function mesurer() {
  const el = zone.value
  if (!el) return
  const largeur = el.clientWidth
  const hauteur = el.clientHeight
  dimensionsZone.value = { largeur, hauteur }
  // Double page si deux pages tiennent côte à côte à une taille lisible.
  const pageEnDouble = Math.min(largeur / 2, (hauteur - 32) / ratio.value)
  changerDisposition(largeur >= 760 && pageEnDouble >= 260)
}

function changerDisposition(enDouble) {
  if (enDouble === double.value) return
  const page = pagesVisibles.value[0] || 1
  terminerFeuille(false)
  double.value = enDouble
  indexVue.value = vueDeLaPage(vues.value, page)
}

// ─── Feuille qui tourne ──────────────────────────────────────────────────
// feuille = { sens: 'avant' | 'arriere', cible, progres (0 → 1), anime,
//             recto, verso, dessousGauche, dessousDroite, dessousUnique }
const feuille = ref(null)
const glisse = ref(false)
let minuterieFeuille = null

const affichage = computed(() => {
  const f = feuille.value
  const [g, d] = vueCourante.value
  if (!f) return { gauche: g ?? null, droite: d ?? null, unique: vueCourante.value[0] ?? null }
  return { gauche: f.dessousGauche, droite: f.dessousDroite, unique: f.dessousUnique }
})

const styleFeuille = computed(() => {
  const f = feuille.value
  if (!f) return {}
  const p = f.progres
  let angle
  if (double.value) angle = f.sens === 'avant' ? -180 * p : 180 * p
  else angle = f.sens === 'avant' ? -180 * p : -180 * (1 - p)
  return { transform: `rotateY(${angle}deg)` }
})
// Ombre portée sur la feuille : maximale quand elle est à la verticale.
const ombre = computed(() => (feuille.value ? Math.sin(Math.PI * feuille.value.progres) * 0.35 : 0))

function preparerFeuille(sens) {
  const cible = indexVue.value + (sens === 'avant' ? 1 : -1)
  if (cible < 0 || cible >= vues.value.length) return null
  const [g, d] = vueCourante.value
  const [cg, cd] = vues.value[cible]
  if (double.value) {
    return sens === 'avant'
      ? { sens, cible, recto: d ?? null, verso: cg ?? null, dessousGauche: g ?? null, dessousDroite: cd ?? null }
      : { sens, cible, recto: g ?? null, verso: cd ?? null, dessousGauche: cg ?? null, dessousDroite: d ?? null }
  }
  // Page simple : en avant la page courante s'en va et découvre la suivante ;
  // en arrière la précédente revient se poser par-dessus.
  return sens === 'avant'
    ? { sens, cible, recto: g, verso: null, dessousUnique: vues.value[cible][0] }
    : { sens, cible, recto: vues.value[cible][0], verso: null, dessousUnique: g }
}

function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function tourner(sens) {
  if (zoom.value) {
    const cible = indexVue.value + (sens === 'avant' ? 1 : -1)
    if (cible >= 0 && cible < vues.value.length) indexVue.value = cible
    return
  }
  if (feuille.value) terminerFeuille(true)
  const f = preparerFeuille(sens)
  if (!f) return
  if (mouvementReduit()) {
    indexVue.value = f.cible
    return
  }
  feuille.value = { ...f, progres: 0, anime: false }
  // Deux images plus tard : la feuille est posée à 0°, la transition peut partir.
  requestAnimationFrame(() => requestAnimationFrame(() => animerFeuille(1)))
}

function animerFeuille(vers) {
  const f = feuille.value
  if (!f) return
  feuille.value = { ...f, anime: true, progres: vers }
  clearTimeout(minuterieFeuille)
  // Minuterie plutôt que `transitionend`, qui ne part pas toujours
  // (onglet en arrière-plan, transition interrompue).
  minuterieFeuille = setTimeout(() => terminerFeuille(vers === 1), DUREE_TOUR + 30)
}

function terminerFeuille(valider) {
  clearTimeout(minuterieFeuille)
  const f = feuille.value
  if (!f) return
  if (valider) indexVue.value = f.cible
  feuille.value = null
}

const suivant = () => tourner('avant')
const precedent = () => tourner('arriere')

function allerALaPage(p) {
  terminerFeuille(false)
  indexVue.value = vueDeLaPage(vues.value, borner(p))
  vignettesOuvertes.value = false
}

// ─── Gestes : glisser pour tourner, toucher un côté pour avancer/reculer ──
let geste = null
let ignorerClic = false

function debutGeste(e) {
  if (e.button !== undefined && e.button !== 0) return
  if (feuille.value?.anime) terminerFeuille(true)
  geste = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, actif: false }
}

function pendantGeste(e) {
  if (!geste || e.pointerId !== geste.id) return
  const dx = e.clientX - geste.x
  const dy = e.clientY - geste.y
  if (!geste.actif) {
    // Geste surtout vertical : on laisse la page défiler.
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return
    const f = preparerFeuille(dx < 0 ? 'avant' : 'arriere')
    if (!f || mouvementReduit()) { geste.bloque = true; return }
    if (geste.bloque) return
    geste.actif = true
    glisse.value = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    feuille.value = { ...f, progres: 0, anime: false }
  }
  const f = feuille.value
  if (!f) return
  const course = double.value ? tailleLivre.value.largeur * 0.8 : tailleLivre.value.largeur * 0.9
  const dxUtile = f.sens === 'avant' ? -dx : dx
  feuille.value = { ...f, progres: Math.min(1, Math.max(0, dxUtile / (course || 1))) }
}

function finGeste(e) {
  if (!geste || e.pointerId !== geste.id) return
  const g = geste
  geste = null
  glisse.value = false
  if (!g.actif) return
  ignorerClic = true
  const f = feuille.value
  if (!f) return
  const dx = e.clientX - g.x
  const vitesse = Math.abs(dx) / Math.max(1, performance.now() - g.t) // px/ms
  animerFeuille(f.progres > 0.35 || (vitesse > 0.5 && f.progres > 0.05) ? 1 : 0)
}

function annulerGeste() {
  if (geste?.actif && feuille.value) animerFeuille(0)
  geste = null
  glisse.value = false
}

function clicLivre(e) {
  if (ignorerClic) { ignorerClic = false; return }
  const rect = e.currentTarget.getBoundingClientRect()
  if (e.clientX - rect.left > rect.width / 2) suivant()
  else precedent()
}

// ─── Zoom, vignettes, plein écran ────────────────────────────────────────
const zoom = ref(false)
const vignettesOuvertes = ref(false)
const pleinEcran = ref(false) // API Fullscreen
const pseudoPlein = ref(false) // repli (iPhone : pas de plein écran hors vidéo)

function basculerZoom() {
  terminerFeuille(true)
  zoom.value = !zoom.value
}

function elementPleinEcran() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

async function basculerPleinEcran() {
  if (pseudoPlein.value) { pseudoPlein.value = false; return }
  if (elementPleinEcran()) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    return
  }
  const el = racine.value
  const demander = el?.requestFullscreen || el?.webkitRequestFullscreen
  if (demander) {
    try {
      await demander.call(el)
      return
    } catch { /* refusé : repli ci-dessous */ }
  }
  pseudoPlein.value = true
}

function surChangementPleinEcran() {
  pleinEcran.value = elementPleinEcran() === racine.value
}

watch(pseudoPlein, (actif) => {
  document.documentElement.classList.toggle('liseuse-defilement-bloque', actif)
})

// ─── Clavier ─────────────────────────────────────────────────────────────
function surTouche(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
  const cible = e.target
  if (cible?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
      if (zoom.value && e.key === 'ArrowRight') return // défilement de la zone agrandie
      e.preventDefault(); suivant(); break
    case 'ArrowLeft':
    case 'PageUp':
      if (zoom.value && e.key === 'ArrowLeft') return
      e.preventDefault(); precedent(); break
    case 'Home':
      e.preventDefault(); allerALaPage(1); break
    case 'End':
      e.preventDefault(); allerALaPage(props.numero.pages); break
    case 'Escape':
      if (vignettesOuvertes.value) vignettesOuvertes.value = false
      else if (zoom.value) zoom.value = false
      else if (pseudoPlein.value) pseudoPlein.value = false
      break
  }
}

// ─── Préchargement des voisines ──────────────────────────────────────────
// Seules les pages visibles sont dans le document ; la vue suivante et la
// précédente sont téléchargées en avance (même `sizes`, donc la même image
// que celle qui sera affichée) pour que la page tournée soit déjà là.
const prechargees = new Set()
function precharger() {
  if (typeof window === 'undefined' || !tailleLivre.value.page) return
  for (const i of [indexVue.value + 1, indexVue.value - 1]) {
    for (const p of (vues.value[i] || []).filter(Boolean)) {
      const cle = `${p}|${sizes.value}`
      if (prechargees.has(cle)) continue
      prechargees.add(cle)
      const img = new Image()
      img.decoding = 'async'
      img.sizes = sizes.value
      img.srcset = srcsetPage(props.numero, p)
      img.src = imagePage(props.numero, p, 'm')
    }
  }
}

// ─── Adresse : ?page=N pour partager ou retrouver une page ───────────────
function majAdresse() {
  const page = pagesVisibles.value[0] || 1
  const url = new URL(window.location.href)
  if (page > 1) url.searchParams.set('page', String(page))
  else url.searchParams.delete('page')
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.href)
}

let observateur = null
onMounted(() => {
  mesurer()
  observateur = new ResizeObserver(() => mesurer())
  if (zone.value) observateur.observe(zone.value)
  window.addEventListener('keydown', surTouche)
  document.addEventListener('fullscreenchange', surChangementPleinEcran)
  document.addEventListener('webkitfullscreenchange', surChangementPleinEcran)
  // Après le premier rendu en double page : la taille est connue.
  requestAnimationFrame(precharger)
})

onBeforeUnmount(() => {
  observateur?.disconnect()
  clearTimeout(minuterieFeuille)
  window.removeEventListener('keydown', surTouche)
  document.removeEventListener('fullscreenchange', surChangementPleinEcran)
  document.removeEventListener('webkitfullscreenchange', surChangementPleinEcran)
  document.documentElement.classList.remove('liseuse-defilement-bloque')
})

watch([indexVue, double], () => {
  precharger()
  majAdresse()
})
watch(sizes, precharger)
</script>

<style scoped>
.liseuse {
  --fond: #1d2633;
  position: relative;
  display: flex; flex-direction: column;
  /* Toute la hauteur d'écran sous l'en-tête du site et le titre du numéro,
     barre comprise. */
  height: clamp(420px, calc(100svh - 205px), 1400px);
  background: radial-gradient(ellipse at 50% 40%, #2b3747 0%, var(--fond) 70%);
  color: #fff;
  user-select: none;
  -webkit-user-select: none;
}
.liseuse-plein { height: 100vh; height: 100dvh; }
.liseuse-pseudo-plein { position: fixed; inset: 0; z-index: 2000; height: 100dvh; }

.liseuse-zone {
  position: relative; flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}

/* ── Livre ── */
.livre {
  position: relative;
  display: flex;
  perspective: 2400px;
  /* Glissement horizontal pour tourner ; défilement vertical et pincement
     (zoom du navigateur) laissés au téléphone. */
  touch-action: pan-y pinch-zoom;
  cursor: pointer;
}
.livre-glisse { cursor: grabbing; }
.cote { position: relative; flex: 1; height: 100%; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45); }
.cote-vide { box-shadow: none; }
.cote-unique { width: 100%; }
.livre-simple { overflow: hidden; }
.pli {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 60px; transform: translateX(-50%);
  pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.08) 40%, rgba(0, 0, 0, 0.22) 50%, rgba(0, 0, 0, 0.08) 60%, transparent 100%);
}

.feuille {
  position: absolute; top: 0; height: 100%;
  transform-style: preserve-3d;
  will-change: transform;
  z-index: 3;
}
.feuille-anime { transition: transform 550ms cubic-bezier(0.45, 0.05, 0.3, 1); }
.livre-double .feuille { width: 50%; }
.livre-double .feuille-avant { left: 50%; transform-origin: left center; }
.livre-double .feuille-arriere { left: 0; transform-origin: right center; }
.livre-simple .feuille { left: 0; width: 100%; transform-origin: left center; }

.face {
  position: absolute; inset: 0;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}
.face-verso { transform: rotateY(180deg); }
.ombre-face {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.55), transparent 70%);
}
.feuille-arriere .ombre-face { background: linear-gradient(270deg, rgba(0, 0, 0, 0.55), transparent 70%); }

/* ── Flèches ── */
.fleche {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 48px; height: 48px; border-radius: 50%; border: none;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.12); color: #fff; cursor: pointer;
  transition: background .2s, opacity .2s;
  z-index: 5;
}
.fleche:hover:not(:disabled) { background: rgba(255, 255, 255, 0.24); }
.fleche:disabled { opacity: 0.25; cursor: default; }
.fleche-gauche { left: 16px; }
.fleche-droite { right: 16px; }
.fleche svg, .barre-bouton svg, .vignettes-fermer svg {
  width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.fleche:focus-visible, .barre-bouton:focus-visible, .vignette:focus-visible, .vignettes-fermer:focus-visible {
  outline: 3px solid #f6b93b; outline-offset: 2px;
}

/* ── Barre ── */
.liseuse-barre {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 56px; padding: 6px 16px;
  background: rgba(0, 0, 0, 0.28);
}
.barre-libelle { font-size: 0.92em; font-variant-numeric: tabular-nums; color: #e6ebf2; }
.barre-actions { display: flex; gap: 4px; }
.barre-bouton {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; padding: 8px 12px; border: none; border-radius: 8px;
  background: transparent; color: #fff; font: inherit; font-size: 0.88em; cursor: pointer; text-decoration: none;
}
.barre-bouton:hover, .barre-bouton[aria-pressed="true"] { background: rgba(255, 255, 255, 0.14); }

/* ── Zoom ── */
.liseuse-zoom { position: absolute; inset: 0; overflow: auto; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y pinch-zoom; }
.liseuse-zoom-pages { display: flex; width: max-content; margin: 0 auto; padding: 24px; gap: 0; }
.liseuse-zoom-page { flex-shrink: 0; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45); }

/* ── Vignettes ── */
.vignettes {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column;
  background: #141b24;
}
.vignettes-entete {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; font-weight: 700;
}
.vignettes-fermer { width: 44px; height: 44px; border: none; border-radius: 8px; background: transparent; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.vignettes-fermer:hover { background: rgba(255, 255, 255, 0.14); }
.vignettes-grille {
  list-style: none; flex: 1; overflow-y: auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 18px; padding: 8px 20px 24px;
}
.vignette { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px; border: none; border-radius: 6px; background: transparent; color: #cfd6e0; cursor: pointer; font: inherit; font-size: 0.85em; }
.vignette img { width: 100%; height: auto; background: #3a4656; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); }
.vignette:hover { background: rgba(255, 255, 255, 0.08); }
.vignette-active { background: rgba(246, 185, 59, 0.18); color: #fff; }

@media (max-width: 600px) {
  /* En-tête du site plus haut sur téléphone : la barre doit rester visible. */
  .liseuse { height: clamp(420px, calc(100svh - 215px), 1400px); }
  .fleche { width: 40px; height: 40px; background: rgba(0, 0, 0, 0.28); }
  .fleche-gauche { left: 6px; }
  .fleche-droite { right: 6px; }
  .barre-texte { display: none; }
  .liseuse-barre { padding: 4px 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .feuille-anime { transition: none; }
}
</style>
