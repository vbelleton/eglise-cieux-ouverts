<template>
  <div class="vr-page">
    <div ref="conteneur" class="vr-scene" :class="{ 'vr-scene--prete': pret }" />

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
          <NuxtLink to="/" class="vr-quitter" aria-label="Quitter la salle de prière et revenir au site">✕</NuxtLink>
        </header>

        <div class="vr-actions">
          <p v-if="enPriere" class="vr-aide" aria-live="polite">Temps de prière : laissez venir les versets.</p>
          <div v-else-if="video" class="vr-carte" aria-live="polite">
            <p class="vr-carte-titre">{{ video.titre }}</p>
            <div class="vr-boutons">
              <button type="button" class="vr-bouton vr-bouton--principal" @click="lecture = video">Regarder la vidéo</button>
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
import { normaliserReglagesVR } from '~/utils/vrReglages.js'
import { useChurchEvents } from '~/composables/useChurchEvents.js'
import { LIEUX } from '~/lib/vr/lieux/index.js'

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

function videoDepuis(v) {
  return {
    id: v.id,
    titre: v.titre,
    date: v.date,
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
      .slice(0, 5)
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
    const [{ creerSceneVR, PHOTOS_VR }, { creerSalle }] = await Promise.all([import('~/lib/vr/scene.js'), import('~/lib/vr/salle.js'), chargerReglages()])
    const photos = [...(reglages.photosSite ? PHOTOS_VR : []), ...reglages.photos.map((image) => ({ type: 'photo', image, titre: '' }))]
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
        if ('element' in e) photo.value = e.element ? e.element.titre || '' : null
        if ('vr' in e) enVR.value = e.vr
      },
    })
    salle.value = creerSalle(scene.monde, {
      lieux: reglages.lieux,
      dureePriere: reglages.dureePriere * 60,
      surAction: (a) => {
        if (a.type === 'predication') video.value = a.video
        if (a.type === 'lieu') memoriserLieu(a.id)
        if (a.type === 'priere') {
          enPriere.value = a.actif
          video.value = null
        }
      },
    })
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
  document.removeEventListener('fullscreenchange', surPleinEcran)
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

@media (prefers-reduced-motion: reduce) {
  .vr-scene {
    transition: none;
  }
}
</style>
