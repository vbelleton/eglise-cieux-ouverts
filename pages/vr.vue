<template>
  <div class="vr-page">
    <div ref="conteneur" class="vr-scene" :class="{ 'vr-scene--prete': pret }" />

    <p class="vr-sr" aria-live="polite">
      {{ enLecture && versetLu ? `Lecture : ${passageOuvert}, verset ${versetLu}` : passageOuvert && `Bible ouverte : ${passageOuvert}` }}
    </p>

    <noscript>
      <p class="vr-message">Cette salle de prière en réalité virtuelle a besoin de JavaScript.</p>
    </noscript>

    <p v-if="erreur" class="vr-message" role="alert">
      {{ erreur }}
      <NuxtLink to="/">Revenir au site</NuxtLink>
    </p>

    <template v-else-if="!enVR">
      <template v-if="carton">
        <!-- Point de visée de chaque œil : toucher l'écran vise ce qui est au centre. -->
        <span class="vr-viseur" style="left: 25%" aria-hidden="true" />
        <span class="vr-viseur" style="left: 75%" aria-hidden="true" />
        <button type="button" class="vr-sortir-carton" @click="quitterCarton">Quitter le mode carton</button>
      </template>

      <template v-else>
        <header class="vr-entete">
          <p class="vr-titre">Cieux Ouverts <span>· {{ titre }}</span></p>
          <label v-if="lieuxProposes.length > 1" class="vr-lieu">
            <span class="vr-lieu-libelle">Lieu</span>
            <select :value="lieu" aria-label="Lieu de prière" @change="choisirLieu($event.target.value)">
              <option v-for="l in lieuxProposes" :key="l.id" :value="l.id">{{ l.nom }}</option>
            </select>
          </label>
          <label class="vr-lieu">
            <span class="vr-lieu-libelle">Musique</span>
            <select :value="musique || ''" aria-label="Fond musical" @change="choisirMusique($event.target.value || null)">
              <option value="">Aucune</option>
              <option v-for="a in AMBIANCES" :key="a.id" :value="a.id">{{ a.nom }}</option>
            </select>
          </label>
          <NuxtLink to="/" class="vr-quitter" aria-label="Quitter la salle de prière et revenir au site">✕</NuxtLink>
        </header>

        <div class="vr-actions">
          <form v-if="rechercheActive && !enPriere" class="vr-recherche" role="search" @submit.prevent="lancerRecherche(true)">
            <input
              ref="champRecherche"
              v-model="requete"
              type="search"
              enterkeyhint="search"
              placeholder="Un mot, une expression…"
              aria-label="Rechercher dans les prédications"
              @input="lancerRecherche(false)"
            />
          </form>
          <div v-if="ecoute && !enPriere" class="vr-ecoute">
            <span class="vr-ecoute-titre">🎧 {{ ecoute.titre }}</span>
            <span class="vr-ecoute-position">
              <span class="vr-ecoute-temps">{{ formaterMoment(ecoute.temps) }}</span>
              <input
                type="range"
                min="0"
                :max="Math.max(1, Math.floor(ecoute.duree))"
                step="1"
                :value="Math.floor(ecoute.temps)"
                :disabled="!ecoute.duree"
                aria-label="Position dans la prédication"
                :aria-valuetext="`${formaterMoment(ecoute.temps)} sur ${formaterMoment(ecoute.duree)}`"
                @change="allerA(Number($event.target.value))"
              />
              <span class="vr-ecoute-temps">{{ ecoute.duree ? formaterMoment(ecoute.duree) : '–:––' }}</span>
            </span>
            <button type="button" class="vr-bouton" aria-label="Reculer de 30 secondes" @click="allerA(ecoute.temps - 30)">−30 s</button>
            <button type="button" class="vr-bouton" @click="basculerPause">{{ ecoute.enCours ? 'Pause' : 'Reprendre' }}</button>
            <button type="button" class="vr-bouton" aria-label="Avancer de 30 secondes" @click="allerA(ecoute.temps + 30)">+30 s</button>
            <button type="button" class="vr-bouton" :aria-label="`Vitesse ${formatVitesse(ecoute.vitesse)}, changer`" @click="changerVitesse">
              {{ formatVitesse(ecoute.vitesse) }}
            </button>
            <button type="button" class="vr-bouton" @click="arreterEcoute">Arrêter</button>
          </div>
          <p v-if="enPriere" class="vr-aide" aria-live="polite">Temps de prière : laissez venir les versets.</p>
          <div v-else-if="video" class="vr-carte" aria-live="polite">
            <p class="vr-carte-titre">{{ video.titre }}</p>
            <div class="vr-boutons">
              <button type="button" class="vr-bouton vr-bouton--principal" @click="lecture = video">Regarder la vidéo</button>
              <template v-if="ecoute?.id !== video.id">
                <button v-if="reprise(video.id)" type="button" class="vr-bouton" @click="demarrerEcoute(video)">
                  Reprendre à {{ formaterMoment(reprise(video.id)) }}
                </button>
                <button type="button" class="vr-bouton" @click="demarrerEcoute(video, 0)">{{ reprise(video.id) ? 'Du début' : 'Écouter' }}</button>
              </template>
              <button type="button" class="vr-bouton" @click="video = null">Fermer</button>
            </div>
          </div>
          <p v-else-if="photo" class="vr-aide" aria-live="polite">
            {{ photo }}{{ photo ? ' · ' : '' }}{{ tactile ? 'touchez' : 'cliquez' }} à nouveau pour la remettre en place
          </p>
          <p v-else class="vr-aide">{{ aide }}</p>
          <div class="vr-boutons">
            <button v-if="enPriere" type="button" class="vr-bouton" @click="salle?.terminerPriere()">Terminer le temps de prière</button>
            <template v-else>
              <button v-if="vrOk" type="button" class="vr-bouton vr-bouton--principal" @click="entrerVR">
                Entrer en réalité virtuelle
              </button>
              <button v-if="tactile" type="button" class="vr-bouton" @click="basculerGyro">
                {{ gyro ? 'Arrêter le gyroscope' : 'Bouger le téléphone pour regarder' }}
              </button>
              <button v-if="tactile" type="button" class="vr-bouton" @click="entrerCarton">Mode casque carton</button>
            </template>
          </div>
        </div>
      </template>
    </template>

    <!-- Écoute d'une prédication : lecteur YouTube invisible (le son seul),
         qui continue au casque. Piloté par postMessage (enablejsapi). -->
    <iframe
      v-if="ecoute"
      :key="ecoute.cle"
      ref="lecteurEcoute"
      class="vr-ecoute-lecteur"
      @load="lecteurPret"
      :src="`https://www.youtube-nocookie.com/embed/${ecoute.id}?autoplay=1&start=${ecoute.debut}&enablejsapi=1&playsinline=1&rel=0`"
      allow="autoplay; encrypted-media"
      title="Écoute de la prédication"
      tabindex="-1"
      aria-hidden="true"
    />

    <div v-if="lecture" class="vr-lecteur" role="dialog" aria-modal="true" :aria-label="lecture.titre" @click.self="lecture = null">
      <div class="vr-lecteur-cadre">
        <iframe
          :src="`https://www.youtube-nocookie.com/embed/${lecture.id}?autoplay=1&rel=0`"
          :title="lecture.titre"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen
        />
        <button type="button" class="vr-bouton" @click="lecture = null">Fermer la vidéo</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Salle de prière en réalité virtuelle, cachée : aucun lien du site n'y mène,
// page non indexée. Le monde est dans lib/vr/scene.js, la salle (Bible,
// agenda, prédications, temps de prière) dans lib/vr/salle.js ; three.js n'est
// chargé qu'ici, à la demande. Contenu réglable dans l'admin (bouton 🥽 « Salle VR »,
// /api/vr/reglages).
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { trouverPassages } from '~/utils/livresBible.js'
import { formaterMoment } from '~/utils/rechercheVideos.js'
import { normaliserReglagesVR, photosDeLaSalle } from '~/utils/vrReglages.js'
import { useChurchEvents } from '~/composables/useChurchEvents.js'
import { LIEUX } from '~/lib/vr/lieux/index.js'
import { AMBIANCES } from '~/lib/vr/musique.js'
import { tableauxPour, creditTableau } from '~/utils/vrTableaux.js'

definePageMeta({ layout: false })

// Réglés dans l'admin (🥽 Salle VR) : titre, lieux proposés.
const titre = ref('salle de prière')

useSeoMeta({
  title: () => `Cieux Ouverts · ${titre.value}`,
  robots: 'noindex, nofollow',
})

const conteneur = ref(null)
const pret = ref(false)
const erreur = ref('')
const vrOk = ref(false)
const tactile = ref(false)
const gyro = ref(false)
const carton = ref(false)
const enVR = ref(false)
const photo = ref(null)
const video = ref(null)
const lecture = ref(null)
const enPriere = ref(false)
const salle = ref(null)
const rechercheActive = ref(false)
const passageOuvert = ref('')
const requete = ref('')
const champRecherche = ref(null)
const ecoute = ref(null)
const lecteurEcoute = ref(null)
const lectureBible = ref(false) // lecture avec la voix
const enLecture = ref(false) // lecture, avec ou sans voix
const versetLu = ref(null)
let minuterieRecherche = null

// Fond musical (lib/vr/musique.js) : choisi par le visiteur (retenu sur son
// appareil), sinon celui réglé dans l'admin. Le son ne peut démarrer qu'après
// un geste : le premier clic ou toucher dans la page le lance.
// Lecture de la Bible : avec la voix (par défaut) ou surlignage seul, retenu aussi.
const CLE_VOIX = 'vr-voix'
function voixMemorisee() {
  try {
    return localStorage.getItem(CLE_VOIX) !== '0'
  } catch {
    return true
  }
}
function memoriserVoix(actif) {
  try {
    localStorage.setItem(CLE_VOIX, actif ? '1' : '0')
  } catch {
    // Navigation privée : choix non retenu.
  }
}
const CLE_MUSIQUE = 'vr-musique'
const musique = ref(null)
let lecteurMusique = null
function musiqueMemorisee() {
  try {
    const m = localStorage.getItem(CLE_MUSIQUE)
    return m === null ? undefined : m || null
  } catch {
    return undefined
  }
}
function choisirMusique(id) {
  musique.value = AMBIANCES.some((a) => a.id === id) ? id : null
  try {
    localStorage.setItem(CLE_MUSIQUE, musique.value || '')
  } catch {
    // Navigation privée : choix non retenu.
  }
  lecteurMusique?.jouer(musique.value)
}
function premierGeste() {
  document.removeEventListener('pointerdown', premierGeste)
  document.removeEventListener('keydown', premierGeste)
  lecteurMusique?.jouer(musique.value)
}
// La musique se tait pendant une prédication, se fait discrète sous la lecture de la Bible.
function majVolumeMusique() {
  lecteurMusique?.attenuer(ecoute.value || lecture.value ? 0 : lectureBible.value ? 0.3 : 1)
}
watch(musique, (m) => salle.value?.definirMusique(m))

function lancerRecherche(immediat) {
  clearTimeout(minuterieRecherche)
  const faire = () => salle.value?.rechercher(requete.value)
  if (immediat) {
    faire()
    champRecherche.value?.blur()
  } else minuterieRecherche = setTimeout(faire, 250)
}

// Écoute : le lecteur est (re)créé à chaque départ ; il est piloté par l'API
// iframe de YouTube (postMessage) : pause, position, vitesse. Le lecteur
// renvoie sa position (« infoDelivery ») ; on retient sur l'appareil où
// chaque prédication a été laissée, pour la reprendre là.
const YT = 'https://www.youtube-nocookie.com'
const CLE_ECOUTES = 'vr-ecoutes'
const VITESSES = [1, 1.25, 1.5, 0.75]
const progressions = ref({})
function lireProgressions() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_ECOUTES) || '{}')
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}
function retenirProgression(id, t, d) {
  const p = { ...progressions.value }
  // Finie (ou presque) : rien à reprendre.
  if (d && t > d - 20) delete p[id]
  else if (t > 15) p[id] = { t: Math.floor(t), d: Math.floor(d || 0), le: Date.now() }
  else return
  // Les 30 plus récentes suffisent.
  const garder = Object.entries(p)
    .sort((a, b) => (b[1].le || 0) - (a[1].le || 0))
    .slice(0, 30)
  progressions.value = Object.fromEntries(garder)
  try {
    localStorage.setItem(CLE_ECOUTES, JSON.stringify(progressions.value))
  } catch {
    // Navigation privée : pas de reprise, sans gêner.
  }
}
/** Position de reprise d'une prédication (0 si rien à reprendre). */
function reprise(id) {
  const p = progressions.value[id]
  return p && p.t > 15 && (!p.d || p.t < p.d - 20) ? p.t : 0
}

let numeroEcoute = 0
/** `debut` null : là où on l'avait laissée. */
function demarrerEcoute(video, debut = null) {
  lecture.value = null
  salle.value?.arreterLecture()
  if (ecoute.value) retenirProgression(ecoute.value.id, ecoute.value.temps, ecoute.value.duree)
  // On reprend 3 secondes avant, pour retrouver le fil.
  const depart = debut == null ? Math.max(0, reprise(video.id) - 3) : Math.max(0, Math.floor(debut))
  const duree = progressions.value[video.id]?.d || 0
  ecoute.value = { id: video.id, titre: video.titre, debut: depart, temps: depart, duree, vitesse: 1, enCours: true, cle: ++numeroEcoute }
}
function commanderLecteur(func, args = []) {
  lecteurEcoute.value?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), YT)
}
// Sans ce message, le lecteur n'envoie pas sa position.
function lecteurPret() {
  lecteurEcoute.value?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: numeroEcoute, channel: 'widget' }), YT)
}
function surMessageLecteur(e) {
  if (e.origin !== YT || !ecoute.value) return
  let data
  try {
    data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
  } catch {
    return
  }
  const info = data?.event === 'infoDelivery' ? data.info : null
  if (!info) return
  const e2 = { ...ecoute.value }
  let change = false
  if (typeof info.duration === 'number' && info.duration > 0 && Math.floor(info.duration) !== Math.floor(e2.duree)) {
    e2.duree = info.duration
    change = true
  }
  if (typeof info.currentTime === 'number' && Math.floor(info.currentTime) !== Math.floor(e2.temps)) {
    e2.temps = info.currentTime
    change = true
    // Retenue toutes les 5 secondes.
    if (Math.floor(info.currentTime) % 5 === 0) retenirProgression(e2.id, e2.temps, e2.duree)
  }
  if (typeof info.playbackRate === 'number' && info.playbackRate !== e2.vitesse) {
    e2.vitesse = info.playbackRate
    change = true
  }
  if (info.playerState === 0) {
    // Finie : plus rien à reprendre.
    retenirProgression(e2.id, e2.duree || e2.temps, e2.duree || e2.temps)
    ecoute.value = null
    return
  }
  if (info.playerState === 1 || info.playerState === 2) {
    const enCours = info.playerState === 1
    if (enCours !== e2.enCours) {
      e2.enCours = enCours
      change = true
    }
  }
  if (change) ecoute.value = e2
}
function basculerPause() {
  if (!ecoute.value) return
  commanderLecteur(ecoute.value.enCours ? 'pauseVideo' : 'playVideo')
  ecoute.value = { ...ecoute.value, enCours: !ecoute.value.enCours }
}
function allerA(t) {
  if (!ecoute.value) return
  const max = ecoute.value.duree ? ecoute.value.duree - 1 : Infinity
  const cible = Math.max(0, Math.min(max, t))
  commanderLecteur('seekTo', [cible, true])
  ecoute.value = { ...ecoute.value, temps: cible }
}
function changerVitesse() {
  if (!ecoute.value) return
  const v = VITESSES[(VITESSES.indexOf(ecoute.value.vitesse) + 1) % VITESSES.length]
  commanderLecteur('setPlaybackRate', [v])
  ecoute.value = { ...ecoute.value, vitesse: v }
}
function arreterEcoute() {
  if (ecoute.value) retenirProgression(ecoute.value.id, ecoute.value.temps, ecoute.value.duree)
  ecoute.value = null
}
const formatVitesse = (v) => `${String(v).replace('.', ',')}×`
watch(ecoute, (e) => salle.value?.definirEcoute(e ? { id: e.id, enCours: e.enCours, temps: e.temps, duree: e.duree } : null))
watch(progressions, (p) => salle.value?.definirProgressions(p))
// Regarder la vidéo coupe l'écoute (en retenant où on en était).
watch(lecture, (l) => {
  if (l) arreterEcoute()
})
watch([ecoute, lecture, lectureBible], majVolumeMusique)
const lieu = ref('chapelle')
const lieuxProposes = ref(LIEUX)

// Le dernier lieu choisi par ce visiteur (s'il est encore proposé), sinon
// celui réglé dans l'admin.
const CLE_LIEU = 'vr-lieu'
function lieuMemorise() {
  try {
    return localStorage.getItem(CLE_LIEU)
  } catch {
    return null
  }
}
function memoriserLieu(id) {
  try {
    localStorage.setItem(CLE_LIEU, id)
  } catch {
    // Navigation privée : on ne retient pas le choix, sans gêner.
  }
}
function choisirLieu(id) {
  lieu.value = id
  memoriserLieu(id)
  scene?.changerLieu(id)
}

const aide = computed(() =>
  tactile.value
    ? 'Glissez pour regarder autour de vous. Touchez la Bible, l’agenda, une prédication ou une photo.'
    : 'Glissez pour regarder autour de vous. Cliquez sur la Bible, l’agenda, une prédication ou une photo.',
)

const { evenements, loading: agendaChargement, erreur: agendaErreur } = useChurchEvents()
let reglages = normaliserReglagesVR(null)

let scene = null

// Tableaux du domaine public liés au passage ouvert (utils/vrTableaux.js),
// glissés dans la spirale là où elle passe sous les yeux. On n'ajoute que
// ceux dont l'image a pu être chargée.
let photosBase = []
let clesTableaux = ''
function chargerImage(src) {
  return new Promise((ok) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok(true)
    img.onerror = () => ok(false)
    img.src = src
  })
}
async function majTableaux(passage) {
  if (!reglages.tableaux || !scene) return
  const liste = tableauxPour(passage)
  const cles = liste.map((t) => t.cle).join()
  if (cles === clesTableaux) return
  clesTableaux = cles
  const elements = liste.map((t) => ({ type: 'photo', image: `/api/vr/tableau/${t.cle}`, titre: t.titre, sousTitre: creditTableau(t) }))
  const charges = await Promise.all(elements.map((e) => chargerImage(e.image)))
  if (cles !== clesTableaux || !scene) return
  scene.definirElements(photosBase, { devant: elements.filter((_, i) => charges[i]) })
}

function videoDepuis(v) {
  return {
    id: v.id,
    titre: v.titre,
    date: v.date,
    description: v.description || '',
    image: `/api/vr/vignette/${v.id}`,
    passages: trouverPassages(`${v.titre} ${v.description || ''}`),
  }
}

async function chargerReglages() {
  try {
    reglages = normaliserReglagesVR(await $fetch('/api/vr/reglages', { timeout: 8000 }))
  } catch {
    // Valeurs par défaut : la salle reste utilisable.
  }
}

async function chargerPredications() {
  try {
    const res = await $fetch('/api/predications', { timeout: 25000 })
    return (res?.videos || [])
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map(videoDepuis)
  } catch (e) {
    console.error('[vr] prédications', e)
    return null
  }
}

function majAgenda() {
  salle.value?.definirAgenda({
    actif: reglages.agenda,
    chargement: agendaChargement.value,
    erreur: agendaErreur.value,
    evenements: evenements.value,
  })
}
watch([evenements, agendaChargement, agendaErreur], majAgenda)

onMounted(async () => {
  tactile.value = window.matchMedia('(pointer: coarse)').matches
  try {
    const [{ creerSceneVR }, { creerSalle }, { creerMusique }] = await Promise.all([
      import('~/lib/vr/scene.js'),
      import('~/lib/vr/salle.js'),
      import('~/lib/vr/musique.js'),
      chargerReglages(),
    ])
    lecteurMusique = creerMusique()
    const memoMusique = musiqueMemorisee()
    musique.value = memoMusique === undefined ? reglages.musique : memoMusique
    document.addEventListener('pointerdown', premierGeste)
    document.addEventListener('keydown', premierGeste)
    const photos = photosDeLaSalle(reglages).map((p) => ({ type: 'photo', ...p }))
    photosBase = photos
    const memorise = lieuMemorise()
    titre.value = reglages.titre
    lieuxProposes.value = LIEUX.filter((l) => reglages.lieux.includes(l.id))
    lieu.value = reglages.lieux.includes(memorise) ? memorise : reglages.lieu
    scene = creerSceneVR(conteneur.value, {
      elements: photos,
      lieu: lieu.value,
      surChangement: (e) => {
        if ('lieu' in e) {
          lieu.value = e.lieu
          salle.value?.lieuChange()
        }
        if ('element' in e) photo.value = e.element ? [e.element.titre, e.element.sousTitre].filter(Boolean).join(' — ') : null
        if ('vr' in e) enVR.value = e.vr
      },
    })
    salle.value = creerSalle(scene.monde, {
      lieux: reglages.lieux,
      dureePriere: reglages.dureePriere * 60,
      surAction: (a) => {
        if (a.type === 'predication') video.value = a.video
        if (a.type === 'recherche') {
          rechercheActive.value = a.actif
          if (!a.actif) requete.value = ''
          else if (a.requete) requete.value = a.requete
        }
        if (a.type === 'passage') {
          passageOuvert.value = a.nom
          majTableaux(a.passage)
        }
        if (a.type === 'ecouter') demarrerEcoute(a.video, a.debut)
        if (a.type === 'pause') basculerPause()
        if (a.type === 'aller') allerA(a.t)
        if (a.type === 'deplacer') allerA((ecoute.value?.temps || 0) + a.delta)
        if (a.type === 'lieu') memoriserLieu(a.id)
        if (a.type === 'musique') choisirMusique(a.id)
        if (a.type === 'verset') versetLu.value = a.n
        if (a.type === 'voix') memoriserVoix(a.actif)
        if (a.type === 'lecture') {
          // Sans voix, rien à couvrir : la musique garde son volume.
          enLecture.value = a.actif
          lectureBible.value = a.actif && a.voix
          versetLu.value = null
          if (a.actif) arreterEcoute()
        }
        if (a.type === 'priere') {
          enPriere.value = a.actif
          video.value = null
        }
      },
    })
    progressions.value = lireProgressions()
    salle.value.definirProgressions(progressions.value)
    window.addEventListener('message', surMessageLecteur)
    salle.value.definirMusique(musique.value)
    salle.value.definirVoix(voixMemorisee())
    majAgenda()
    pret.value = true
    vrOk.value = await scene.vrDisponible()

    // Prédications, puis ouverture de la Bible : sur le passage choisi dans
    // l'admin, sinon sur celui de la plus récente prédication qui en cite un,
    // sinon sur le passage du jour.
    let videos = []
    if (reglages.predications) {
      salle.value.definirPredications({ chargement: true })
      videos = await chargerPredications()
      salle.value?.definirPredications(videos ? { videos } : { erreur: true })
    } else salle.value.definirPredications({ actif: false })
    const passage = trouverPassages(reglages.passage)[0] || (videos || []).find((v) => v.passages.length)?.passages[0]
    salle.value?.ouvrir(passage || salle.value.passageDuJour())
  } catch (e) {
    console.error('[vr]', e)
    erreur.value = 'Votre appareil n’arrive pas à afficher la salle en 3D.'
  }
})

onBeforeUnmount(() => {
  clearTimeout(minuterieRecherche)
  document.removeEventListener('fullscreenchange', surPleinEcran)
  document.removeEventListener('pointerdown', premierGeste)
  document.removeEventListener('keydown', premierGeste)
  window.removeEventListener('message', surMessageLecteur)
  if (ecoute.value) retenirProgression(ecoute.value.id, ecoute.value.temps, ecoute.value.duree)
  lecteurMusique?.detruire()
  lecteurMusique = null
  salle.value?.detruire()
  scene?.detruire()
  scene = null
  salle.value = null
})

async function entrerVR() {
  try {
    video.value = null
    await scene.entrerVR()
  } catch (e) {
    console.error('[vr]', e)
    erreur.value = 'Le casque n’a pas pu démarrer la réalité virtuelle.'
  }
}

async function basculerGyro() {
  if (gyro.value) {
    scene.couperGyro()
    gyro.value = false
  } else {
    gyro.value = await scene.activerGyro()
  }
}

function surPleinEcran() {
  if (!document.fullscreenElement && carton.value) quitterCarton()
}

async function entrerCarton() {
  // Le gyroscope est indispensable dans un casque carton ; sur iPhone, la
  // permission doit être demandée pendant ce clic.
  gyro.value = await scene.activerGyro()
  carton.value = true
  scene.basculerCarton(true)
  try {
    await document.documentElement.requestFullscreen?.()
    document.addEventListener('fullscreenchange', surPleinEcran)
    await screen.orientation?.lock?.('landscape')
  } catch {
    // iPhone : ni plein écran ni verrouillage — tourner le téléphone suffit.
  }
}

function quitterCarton() {
  carton.value = false
  scene?.basculerCarton(false)
  document.removeEventListener('fullscreenchange', surPleinEcran)
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}
</script>

<style scoped>
.vr-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #eef3f7;
  font-family: var(--font-body);
  color: var(--primary-blue);
}

.vr-scene {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1.2s ease;
  touch-action: none;
  cursor: grab;
}
.vr-scene--prete {
  opacity: 1;
}
.vr-scene:active {
  cursor: grabbing;
}

.vr-entete {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(12px, env(safe-area-inset-top)) 16px 12px;
  pointer-events: none;
}
.vr-titre {
  margin: 0 auto 0 0;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(6px);
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 600;
  text-shadow: 0 0 12px #fff;
}
.vr-titre span {
  color: var(--primary-pink);
}
.vr-lieu {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 10px;
  padding: 4px 4px 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  font-size: 0.85rem;
  font-weight: 700;
  backdrop-filter: blur(6px);
}
.vr-lieu select {
  min-height: 36px;
  padding: 4px 8px;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: var(--primary-blue);
  font: inherit;
  cursor: pointer;
}
.vr-lieu select:focus-visible {
  outline: 3px solid var(--primary-pink);
  outline-offset: 2px;
}
@media (max-width: 520px) {
  .vr-titre span,
  .vr-lieu-libelle {
    display: none;
  }
  /* Titre, lieu, musique et ✕ tiennent sur une ligne de téléphone. */
  .vr-entete {
    gap: 6px;
  }
  .vr-titre {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 15px;
  }
  .vr-lieu {
    flex: 0 1 auto;
    min-width: 0;
    margin-right: 0;
    padding: 4px;
  }
  .vr-lieu select {
    min-width: 0;
    max-width: 27vw;
    text-overflow: ellipsis;
  }
  .vr-quitter {
    flex: none;
  }
}
.vr-quitter {
  pointer-events: auto;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  color: var(--primary-blue);
  text-decoration: none;
  font-size: 1.1rem;
  backdrop-filter: blur(6px);
}

.vr-actions {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: max(20px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}
.vr-aide,
.vr-photo {
  margin: 0;
  max-width: 34rem;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  text-align: center;
  font-size: 0.9rem;
  backdrop-filter: blur(6px);
}
.vr-photo span {
  font-size: 0.85rem;
  opacity: 0.8;
}
.vr-boutons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.vr-bouton {
  pointer-events: auto;
  min-height: 44px;
  padding: 10px 18px;
  border: 2px solid var(--primary-blue);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--primary-blue);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.vr-bouton--principal {
  background: var(--primary-blue);
  color: #fff;
}
.vr-bouton:focus-visible,
.vr-quitter:focus-visible,
.vr-sortir-carton:focus-visible {
  outline: 3px solid var(--primary-pink);
  outline-offset: 2px;
}

.vr-sortir-carton {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--primary-blue);
  font: inherit;
  font-size: 0.8rem;
}

.vr-carte {
  pointer-events: auto;
  max-width: 34rem;
  padding: 12px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
  text-align: center;
  backdrop-filter: blur(6px);
}
.vr-carte-titre {
  margin: 0 0 10px;
  font-family: var(--font-heading);
  font-weight: 600;
}

.vr-lecteur {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(6, 30, 56, 0.7);
}
.vr-lecteur-cadre {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: min(960px, 100%);
}
.vr-lecteur iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 12px;
  background: #000;
}

.vr-viseur {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border: 2px solid var(--primary-blue);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  pointer-events: none;
}

.vr-message {
  position: absolute;
  inset: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
}

.vr-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.vr-recherche {
  pointer-events: auto;
  width: min(30rem, 100%);
}
.vr-recherche input {
  width: 100%;
  min-height: 44px;
  padding: 8px 18px;
  border: 2px solid var(--primary-blue);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--primary-blue);
  font: inherit;
  font-size: 1rem;
}
.vr-recherche input:focus-visible {
  outline: 3px solid var(--primary-pink);
  outline-offset: 2px;
}
.vr-ecoute {
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: 36rem;
  padding: 8px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(6px);
}
.vr-ecoute .vr-bouton {
  order: 2;
}
.vr-ecoute-position {
  display: flex;
  flex: 1 1 100%;
  align-items: center;
  gap: 8px;
  order: 1;
}
.vr-ecoute-position input {
  flex: 1;
  min-width: 0;
  accent-color: var(--primary-pink);
}
.vr-ecoute-temps {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
.vr-ecoute-titre {
  flex: 1 1 100%;
  max-width: 100%;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 700;
}
/* Invisible mais « affiché » : un lecteur masqué (display: none) ne joue pas
   partout. */
.vr-ecoute-lecteur {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 200px;
  height: 113px;
  border: 0;
  opacity: 0.01;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .vr-scene {
    transition: none;
  }
}
</style>
