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

      <!-- Le cadre recentre le livre fermé (couverture seule, quatrième de
           couverture seule) et glisse en même temps que la page tourne. -->
      <div
        v-else
        class="livre-cadre"
        :class="{ 'livre-pret': tailleLivre.largeur > 0 }"
        :style="{ transform: `translateX(${decalage}px)` }"
      >
        <div
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
            <!-- Tranche des pages déjà lues (à gauche) et restantes (à droite). -->
            <div v-if="affichage.gauche" class="tranche tranche-gauche" :style="{ width: `${epaisseur.gauche}px` }" aria-hidden="true" />
            <div v-if="affichage.droite" class="tranche tranche-droite" :style="{ width: `${epaisseur.droite}px` }" aria-hidden="true" />

            <div class="cote cote-gauche" :class="{ 'cote-vide': !affichage.gauche }">
              <MagazinePage :numero="numero" :page="affichage.gauche" :sizes="sizes" prioritaire />
              <div v-if="affichage.gauche" class="reliure reliure-gauche" aria-hidden="true" />
              <div v-if="feuille" class="ombre-portee ombre-portee-gauche" :style="{ opacity: ombres.gauche }" aria-hidden="true" />
            </div>
            <div class="cote cote-droite" :class="{ 'cote-vide': !affichage.droite }">
              <MagazinePage :numero="numero" :page="affichage.droite" :sizes="sizes" prioritaire />
              <div v-if="affichage.droite" class="reliure reliure-droite" aria-hidden="true" />
              <div v-if="feuille" class="ombre-portee ombre-portee-droite" :style="{ opacity: ombres.droite }" aria-hidden="true" />
            </div>
          </template>
          <div v-else class="cote cote-unique">
            <MagazinePage :numero="numero" :page="affichage.unique" :sizes="sizes" prioritaire />
            <div v-if="feuille" class="ombre-portee ombre-portee-droite" :style="{ opacity: ombres.droite }" aria-hidden="true" />
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
              <div class="lumiere lumiere-recto" :style="{ opacity: lumieres.recto }" />
            </div>
            <div class="face face-verso">
              <MagazinePage :numero="numero" :page="feuille.verso" :sizes="sizes" />
              <div class="lumiere lumiere-verso" :style="{ opacity: lumieres.verso }" />
            </div>
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
      <div class="barre-navigation">
        <button type="button" class="barre-bouton barre-tourner" :disabled="!peutReculer" aria-label="Page précédente" @click="precedent">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <span class="barre-libelle" aria-live="polite">{{ libelle }}</span>
        <button type="button" class="barre-bouton barre-tourner" :disabled="!peutAvancer" aria-label="Page suivante" @click="suivant">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <!-- Curseur : survoler tout le numéro d'un geste, comme on feuillette
           du pouce la tranche d'un magazine. -->
      <input
        class="barre-curseur"
        type="range"
        min="1"
        :max="numero.pages"
        step="1"
        :value="pagesVisibles[0] || 1"
        :style="{ '--avance': `${avance}%` }"
        aria-label="Aller à la page"
        :aria-valuetext="libelle"
        @input="allerALaPage($event.target.value, false)"
      >
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

const DUREE_TOUR = 650 // ms, doit suivre la transition de .feuille-anime
const racine = ref(null)
const zone = ref(null)

// ─── Disposition ─────────────────────────────────────────────────────────
// Rendu serveur en page simple et sans taille (livre invisible) ; la double
// page (grand écran en largeur) est décidée au montage, une fois la taille
// réelle connue, puis le livre apparaît en fondu.
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
const avance = computed(() => {
  const n = props.numero.pages
  return n > 1 ? (((pagesVisibles.value[0] || 1) - 1) / (n - 1)) * 100 : 0
})

function borner(p) {
  const n = Number.parseInt(p, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), props.numero.pages) : 1
}

const etroit = computed(() => dimensionsZone.value.largeur < 600)

const tailleLivre = computed(() => {
  const { largeur, hauteur } = dimensionsZone.value
  const colonnes = double.value ? 2 : 1
  if (!largeur || !hauteur) return { largeur: 0, hauteur: 0, page: 0 }
  // Sur téléphone la page prend toute la largeur (les flèches passent dans la
  // barre) ; ailleurs, place des flèches et de la tranche sur les côtés.
  const margeX = etroit.value ? 12 : 140
  const margeY = etroit.value ? 12 : 40
  const dispoL = Math.max(120, largeur - margeX)
  const dispoH = Math.max(160, hauteur - margeY)
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
  const pageEnDouble = Math.min(largeur / 2, (hauteur - 40) / ratio.value)
  changerDisposition(largeur >= 760 && pageEnDouble >= 260)
}

function changerDisposition(enDouble) {
  if (enDouble === double.value) return
  const page = pagesVisibles.value[0] || 1
  terminerFeuille(false)
  double.value = enDouble
  indexVue.value = vueDeLaPage(vues.value, page)
}

// Livre fermé (couverture ou quatrième seule) : recentré à l'écran, comme
// un magazine posé sur la table. Pendant un tour de page, on suit la vue
// d'arrivée, et la transition du cadre accompagne celle de la feuille.
const decalage = computed(() => {
  if (!double.value) return 0
  const vue = feuille.value ? vues.value[feuille.value.cible] : vueCourante.value
  const [g, d] = vue || []
  const demi = tailleLivre.value.largeur / 4
  if (!g && d) return -demi
  if (g && !d) return demi
  return 0
})

// Épaisseur de la tranche : proportionnelle aux pages lues / restantes.
const epaisseur = computed(() => {
  const n = props.numero.pages
  const p = pagesVisibles.value[0] || 1
  const max = Math.min(10, Math.max(3, n / 6))
  return { gauche: Math.max(2, Math.round((p / n) * max)), droite: Math.max(2, Math.round(((n - p) / n) * max)) }
})

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
  // La feuille se soulève un peu au milieu de sa course (translateZ) : sans
  // ça elle frôle les pages du dessous et la perspective paraît plate.
  const levee = Math.sin(Math.PI * p) * 24
  return { transform: `translateZ(${levee}px) rotateY(${angle}deg)` }
})

// Éclairage : le recto s'assombrit en se redressant vers la lumière rasante,
// le verso s'éclaircit en se posant.
const lumieres = computed(() => {
  const f = feuille.value
  if (!f) return { recto: 0, verso: 0 }
  const p = double.value || f.sens === 'avant' ? f.progres : 1 - f.progres
  return { recto: Math.min(0.55, p * 0.9), verso: Math.min(0.55, (1 - p) * 0.9) }
})

// Ombre que la feuille projette sur les pages du dessous : forte sur la page
// qu'elle découvre au départ, puis sur celle où elle se pose à l'arrivée.
const ombres = computed(() => {
  const f = feuille.value
  if (!f) return { gauche: 0, droite: 0 }
  const p = f.progres
  const depart = (1 - p) * 0.55
  const arrivee = Math.sin(Math.PI * Math.min(1, p)) * 0.45
  if (!double.value) return { gauche: 0, droite: f.sens === 'avant' ? depart : Math.sin(Math.PI * p) * 0.4 }
  return f.sens === 'avant' ? { droite: depart, gauche: arrivee } : { gauche: depart, droite: arrivee }
})

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

async function tourner(sens) {
  apercuAnnule = true
  if (zoom.value) {
    const cible = indexVue.value + (sens === 'avant' ? 1 : -1)
    if (cible >= 0 && cible < vues.value.length) indexVue.value = cible
    return
  }
  if (feuille.value) terminerFeuille(feuille.value.progres > 0.5 || feuille.value.anime)
  const f = preparerFeuille(sens)
  if (!f) return
  if (mouvementReduit()) {
    indexVue.value = f.cible
    return
  }
  // Pages d'arrivée décodées avant de tourner (au plus 150 ms d'attente) :
  // sinon la feuille découvre une page encore blanche.
  await pagesPretes(vues.value[f.cible])
  if (feuille.value) return // un autre geste a commencé entre-temps
  feuille.value = { ...f, progres: 0, anime: false }
  // Deux images plus tard : la feuille est posée à 0°, la transition peut partir.
  requestAnimationFrame(() => requestAnimationFrame(() => animerFeuille(1)))
}

function animerFeuille(vers, duree = DUREE_TOUR) {
  const f = feuille.value
  if (!f) return
  feuille.value = { ...f, anime: true, progres: vers }
  clearTimeout(minuterieFeuille)
  // Minuterie plutôt que `transitionend`, qui ne part pas toujours
  // (onglet en arrière-plan, transition interrompue).
  minuterieFeuille = setTimeout(() => terminerFeuille(vers === 1), duree + 40)
}

function terminerFeuille(valider) {
  clearTimeout(minuterieFeuille)
  const f = feuille.value
  if (!f) return
  // L'indice du premier passage ne tourne jamais la page pour de bon.
  if (valider && !f.apercu) indexVue.value = f.cible
  feuille.value = null
}

const suivant = () => tourner('avant')
const precedent = () => tourner('arriere')

function allerALaPage(p, fermer = true) {
  apercuAnnule = true
  terminerFeuille(false)
  indexVue.value = vueDeLaPage(vues.value, borner(p))
  if (fermer) vignettesOuvertes.value = false
}

// ─── Gestes : la page suit le doigt, toucher un côté avance/recule ───────
let geste = null
let ignorerClic = false
let imageEnAttente = null

function debutGeste(e) {
  if (e.button !== undefined && e.button !== 0) return
  if (feuille.value?.anime) terminerFeuille(feuille.value.progres > 0.5)
  apercuAnnule = true
  geste = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, actif: false, rect: e.currentTarget.getBoundingClientRect() }
}

/**
 * Progression de la feuille d'après la position du doigt. En double page, le
 * bord de la feuille reste sous le doigt : la feuille tourne autour de la
 * reliure, donc cos(angle) = distance du doigt à la reliure / largeur de page.
 * On part de l'angle sous le point de départ pour éviter un saut.
 */
function progresDuDoigt(x) {
  const g = geste
  const f = feuille.value
  const largeurPage = tailleLivre.value.page || 1
  if (!double.value) {
    const dx = f.sens === 'avant' ? g.x - x : x - g.x
    return Math.min(1, Math.max(0, dx / (largeurPage * 0.85)))
  }
  const reliure = g.rect.left + g.rect.width / 2
  const signe = f.sens === 'avant' ? 1 : -1
  const cos = (v) => Math.min(1, Math.max(-1, (signe * (v - reliure)) / largeurPage))
  const depart = Math.acos(Math.max(cos(g.x), 0.05))
  const angle = Math.acos(cos(x))
  return Math.min(1, Math.max(0, (angle - depart) / (Math.PI - depart)))
}

function pendantGeste(e) {
  if (!geste || e.pointerId !== geste.id) return
  const dx = e.clientX - geste.x
  const dy = e.clientY - geste.y
  if (!geste.actif) {
    if (geste.bloque) return
    // Geste surtout vertical : on laisse la page défiler.
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return
    const f = preparerFeuille(dx < 0 ? 'avant' : 'arriere')
    if (!f || mouvementReduit()) { geste.bloque = true; return }
    geste.actif = true
    glisse.value = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    feuille.value = { ...f, progres: 0, anime: false }
  }
  geste.dernierX = e.clientX
  geste.dernierT = performance.now()
  // Une mise à jour par image affichée, quel que soit le rythme du pointeur.
  if (imageEnAttente) return
  imageEnAttente = requestAnimationFrame(() => {
    imageEnAttente = null
    const f = feuille.value
    if (!f || !geste?.actif) return
    feuille.value = { ...f, progres: progresDuDoigt(geste.dernierX) }
  })
}

function finGeste(e) {
  if (!geste || e.pointerId !== geste.id) return
  const g = geste
  geste = null
  glisse.value = false
  cancelAnimationFrame(imageEnAttente)
  imageEnAttente = null
  if (!g.actif) return
  ignorerClic = true
  const f = feuille.value
  if (!f) return
  const dx = e.clientX - g.x
  const vitesse = Math.abs(dx) / Math.max(1, performance.now() - g.t) // px/ms
  const valider = f.progres > 0.4 || (vitesse > 0.45 && f.progres > 0.04)
  // Le reste de la course prend un temps proportionnel à ce qu'il reste.
  const reste = valider ? 1 - f.progres : f.progres
  animerFeuille(valider ? 1 : 0, Math.max(220, DUREE_TOUR * reste))
}

function annulerGeste() {
  if (geste?.actif && feuille.value) animerFeuille(0, 250)
  geste = null
  glisse.value = false
}

function clicLivre(e) {
  if (ignorerClic) { ignorerClic = false; return }
  const rect = e.currentTarget.getBoundingClientRect()
  if (e.clientX - rect.left > rect.width / 2) suivant()
  else precedent()
}

// ─── Indice au premier passage : le coin de la page se soulève ───────────
let apercuAnnule = false
function montrerQueLaPageSeTourne() {
  let dejaVu = false
  try { dejaVu = localStorage.getItem('magazine-astuce') === '1' } catch { /* stockage indisponible */ }
  if (dejaVu || mouvementReduit() || !peutAvancer.value) return
  setTimeout(() => {
    if (apercuAnnule || feuille.value || zoom.value) return
    const f = preparerFeuille('avant')
    if (!f) return
    feuille.value = { ...f, progres: 0, anime: false, apercu: true }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!feuille.value?.apercu) return
      feuille.value = { ...feuille.value, anime: true, progres: 0.14 }
      clearTimeout(minuterieFeuille)
      minuterieFeuille = setTimeout(() => { if (feuille.value?.apercu) animerFeuille(0, 500) }, 700)
    }))
    try { localStorage.setItem('magazine-astuce', '1') } catch { /* stockage indisponible */ }
  }, 1200)
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
// précédente sont téléchargées et décodées en avance (même `sizes`, donc la
// même image que celle qui sera affichée) pour que la page tournée soit là.
const prechargees = new Map()
function chargerPage(p) {
  const cle = `${p}|${sizes.value}`
  if (!prechargees.has(cle)) {
    const img = new Image()
    img.decoding = 'async'
    img.sizes = sizes.value
    img.srcset = srcsetPage(props.numero, p)
    img.src = imagePage(props.numero, p, 'm')
    prechargees.set(cle, img.decode ? img.decode().catch(() => {}) : Promise.resolve())
  }
  return prechargees.get(cle)
}

function precharger() {
  if (typeof window === 'undefined' || !tailleLivre.value.page) return
  for (const i of [indexVue.value + 1, indexVue.value - 1]) {
    for (const p of (vues.value[i] || []).filter(Boolean)) chargerPage(p)
  }
}

function pagesPretes(vue) {
  const pages = (vue || []).filter(Boolean)
  if (!pages.length || !tailleLivre.value.page) return Promise.resolve()
  return Promise.race([
    Promise.all(pages.map(chargerPage)),
    new Promise(r => setTimeout(r, 150)),
  ])
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
  montrerQueLaPageSeTourne()
})

onBeforeUnmount(() => {
  observateur?.disconnect()
  clearTimeout(minuterieFeuille)
  cancelAnimationFrame(imageEnAttente)
  apercuAnnule = true
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
  --fond: #1b2431;
  --accent: #f6b93b;
  position: relative;
  display: flex; flex-direction: column;
  /* Toute la hauteur d'écran sous l'en-tête du site et le titre du numéro,
     barre comprise. */
  height: clamp(440px, calc(100svh - 205px), 1400px);
  background:
    radial-gradient(ellipse 70% 60% at 50% 45%, rgba(110, 150, 200, 0.22) 0%, transparent 70%),
    radial-gradient(ellipse at 50% 120%, #0f151e 0%, transparent 60%),
    var(--fond);
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
.livre-cadre {
  opacity: 0;
  transition: transform 650ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease;
}
.livre-pret { opacity: 1; }
.livre {
  position: relative;
  display: flex;
  perspective: 2600px;
  /* Glissement horizontal pour tourner ; défilement vertical et pincement
     (zoom du navigateur) laissés au téléphone. */
  touch-action: pan-y pinch-zoom;
  cursor: pointer;
}
.livre-glisse { cursor: grabbing; }
.cote { position: relative; flex: 1; height: 100%; }
/* Ombre douce sous le livre posé (box-shadow plutôt qu'un filtre sur le
   livre : un filtre serait recalculé à chaque image du tour de page). */
.cote:not(.cote-vide) { box-shadow: 0 22px 40px rgba(0, 0, 0, 0.45), 0 3px 8px rgba(0, 0, 0, 0.3); }
.cote-gauche { border-radius: 3px 0 0 3px; }
.cote-droite { border-radius: 0 3px 3px 0; }
.cote-unique { width: 100%; border-radius: 3px; }
.cote > :deep(.mag-page) { border-radius: inherit; }
.livre-simple { overflow: hidden; }

/* Ombre de reliure, côté pli de chaque page. */
.reliure { position: absolute; top: 0; bottom: 0; width: 14%; pointer-events: none; }
.reliure-gauche { right: 0; background: linear-gradient(270deg, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.08) 30%, transparent 100%); }
.reliure-droite { left: 0; background: linear-gradient(90deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.1) 25%, rgba(255, 255, 255, 0.06) 45%, transparent 100%); }

/* Tranche : bord des pages empilées, plus épais quand il reste des pages. */
.tranche {
  position: absolute; top: 3px; bottom: 3px; pointer-events: none;
  background: repeating-linear-gradient(90deg, #f1efe8 0 1px, #c9c5ba 1px 2px);
  transition: width 650ms ease;
}
.tranche-gauche { right: 100%; border-radius: 3px 0 0 3px; }
.tranche-droite { left: 100%; border-radius: 0 3px 3px 0; }

/* Ombre projetée par la feuille sur la page du dessous. */
.ombre-portee { position: absolute; inset: 0; pointer-events: none; }
.ombre-portee-droite { background: linear-gradient(90deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.25) 35%, transparent 75%); }
.ombre-portee-gauche { background: linear-gradient(270deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.25) 35%, transparent 75%); }

.feuille {
  position: absolute; top: 0; height: 100%;
  transform-style: preserve-3d;
  will-change: transform;
  z-index: 3;
}
.feuille-anime { transition: transform 650ms cubic-bezier(0.37, 0, 0.25, 1); }
.livre-double .feuille { width: 50%; }
.livre-double .feuille-avant { left: 50%; transform-origin: left center; }
.livre-double .feuille-arriere { left: 0; transform-origin: right center; }
.livre-simple .feuille { left: 0; width: 100%; transform-origin: left center; }

.face {
  position: absolute; inset: 0;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  overflow: hidden;
}
.face-verso { transform: rotateY(180deg); }
.lumiere { position: absolute; inset: 0; pointer-events: none; transition: inherit; }
/* Recto qui se redresse : ombré côté reliure, reflet sur le bord libre. */
.feuille-avant .lumiere-recto { background: linear-gradient(90deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 45%, rgba(255, 255, 255, 0.18) 85%, rgba(0, 0, 0, 0.1) 100%); }
.feuille-arriere .lumiere-recto { background: linear-gradient(270deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 45%, rgba(255, 255, 255, 0.18) 85%, rgba(0, 0, 0, 0.1) 100%); }
.livre-simple .feuille-arriere .lumiere-recto { background: linear-gradient(90deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.25) 45%, rgba(255, 255, 255, 0.18) 85%, rgba(0, 0, 0, 0.1) 100%); }
.feuille-avant .lumiere-verso { background: linear-gradient(270deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(255, 255, 255, 0.12) 85%, transparent 100%); }
.feuille-arriere .lumiere-verso { background: linear-gradient(90deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(255, 255, 255, 0.12) 85%, transparent 100%); }
.livre-simple .face-verso { background: #f4f2ec; }

/* ── Flèches ── */
.fleche {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.08); color: #fff; cursor: pointer;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: background .2s, opacity .2s, transform .2s;
  z-index: 5;
}
.fleche:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); transform: translateY(-50%) scale(1.06); }
.fleche:disabled { opacity: 0; pointer-events: none; }
.fleche-gauche { left: 20px; }
.fleche-droite { right: 20px; }
.fleche svg, .barre-bouton svg, .vignettes-fermer svg {
  width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.fleche:focus-visible, .barre-bouton:focus-visible, .vignette:focus-visible, .vignettes-fermer:focus-visible, .barre-curseur:focus-visible {
  outline: 3px solid var(--accent); outline-offset: 2px;
}

/* ── Barre ── */
.liseuse-barre {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 16px;
  min-height: 60px; padding: 6px 16px;
  background: rgba(8, 12, 18, 0.55);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.barre-navigation { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.barre-libelle { min-width: 9.5em; text-align: center; font-size: 0.92em; font-variant-numeric: tabular-nums; color: #e6ebf2; }
.barre-tourner { padding: 8px; }
.barre-tourner:disabled { opacity: 0.3; cursor: default; background: transparent; }
.barre-actions { display: flex; gap: 4px; flex-shrink: 0; }
.barre-bouton {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-width: 44px; min-height: 44px; padding: 8px 12px; border: none; border-radius: 10px;
  background: transparent; color: #fff; font: inherit; font-size: 0.88em; cursor: pointer; text-decoration: none;
  transition: background .15s;
}
.barre-bouton:hover:not(:disabled), .barre-bouton[aria-pressed="true"] { background: rgba(255, 255, 255, 0.14); }

.barre-curseur {
  flex: 1; min-width: 80px; height: 28px; margin: 0;
  -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer;
}
.barre-curseur::-webkit-slider-runnable-track {
  height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent) 0 var(--avance), rgba(255, 255, 255, 0.2) var(--avance) 100%);
}
.barre-curseur::-moz-range-track { height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.2); }
.barre-curseur::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--accent); }
.barre-curseur::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.barre-curseur::-moz-range-thumb { width: 18px; height: 18px; border: none; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5); }

/* ── Zoom ── */
.liseuse-zoom { position: absolute; inset: 0; overflow: auto; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y pinch-zoom; }
.liseuse-zoom-pages { display: flex; width: max-content; margin: 0 auto; padding: 24px; gap: 0; }
.liseuse-zoom-page { flex-shrink: 0; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45); }

/* ── Vignettes ── */
.vignettes {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column;
  background: #141b24;
  animation: vignettes-entree 220ms ease-out;
}
@keyframes vignettes-entree { from { opacity: 0; transform: translateY(12px); } }
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
.vignette { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 6px; border: none; border-radius: 8px; background: transparent; color: #cfd6e0; cursor: pointer; font: inherit; font-size: 0.85em; }
.vignette img { width: 100%; height: auto; border-radius: 2px; background: #3a4656; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); transition: transform .15s; }
.vignette:hover { background: rgba(255, 255, 255, 0.08); }
.vignette:hover img { transform: translateY(-2px); }
.vignette-active { background: rgba(246, 185, 59, 0.18); color: #fff; }

/* ── Téléphone ── */
@media (max-width: 600px) {
  /* En-tête du site plus haut sur téléphone : la barre doit rester visible. */
  .liseuse { height: clamp(440px, calc(100svh - 150px), 1400px); }
  /* Les flèches couvriraient la page : elles passent dans la barre. */
  .fleche { display: none; }
  .barre-texte { display: none; }
  .liseuse-barre { flex-wrap: wrap; gap: 0 4px; padding: 4px 8px 6px; }
  .barre-curseur { order: -1; flex-basis: 100%; height: 22px; padding: 0 6px; }
  .barre-navigation { flex: 1; }
  .barre-libelle { flex: 1; min-width: 0; }
  .barre-bouton { padding: 8px; }
  .cote:not(.cote-vide) { box-shadow: 0 10px 20px rgba(0, 0, 0, 0.45); }
}
@media (min-width: 601px) {
  /* Ordinateur : les grandes flèches de côté suffisent. */
  .barre-tourner { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .feuille-anime, .livre-cadre, .tranche { transition: none; }
  .vignettes { animation: none; }
}
</style>
