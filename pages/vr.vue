<template>
  <div class="vr-page">
    <div ref="conteneur" class="vr-scene" :class="{ 'vr-scene--prete': pret }" />

    <noscript>
      <p class="vr-message">Cette visite en réalité virtuelle a besoin de JavaScript.</p>
    </noscript>

    <p v-if="erreur" class="vr-message" role="alert">
      {{ erreur }}
      <NuxtLink to="/">Revenir au site</NuxtLink>
    </p>

    <template v-else-if="!enVR">
      <!-- Mode carton : seul un petit bouton reste, au centre, pour sortir. -->
<template v-if="carton">
        <!-- Point de visée de chaque œil : toucher l'écran vise ce qui est au centre. -->
        <span class="vr-viseur" style="left: 25%" aria-hidden="true" />
        <span class="vr-viseur" style="left: 75%" aria-hidden="true" />
        <button type="button" class="vr-sortir-carton" @click="quitterCarton">Quitter le mode carton</button>
      </template>

      <template v-else>
        <header class="vr-entete">
          <p class="vr-titre">Cieux Ouverts <span>· VR</span></p>
          <NuxtLink to="/" class="vr-quitter" aria-label="Quitter la visite et revenir au site">✕</NuxtLink>
        </header>

        <div class="vr-actions">
          <p v-if="photo" class="vr-photo" aria-live="polite">
            {{ photo }} <span>· {{ tactile ? 'touchez' : 'cliquez' }} à nouveau pour la remettre en place</span>
          </p>
          <p v-else class="vr-aide">{{ aide }}</p>
          <div class="vr-boutons">
            <button v-if="vrOk" type="button" class="vr-bouton vr-bouton--principal" @click="entrerVR">
              Entrer en réalité virtuelle
            </button>
            <button v-if="tactile" type="button" class="vr-bouton" @click="basculerGyro">
              {{ gyro ? 'Arrêter le gyroscope' : 'Bouger le téléphone pour regarder' }}
            </button>
            <button v-if="tactile" type="button" class="vr-bouton" @click="entrerCarton">Mode casque carton</button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
// Mode VR caché : aucun lien du site n'y mène, page non indexée.
// La scène elle-même est dans lib/vr/scene.js (three.js chargé à la demande).
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({ layout: false })

useSeoMeta({
  title: 'Cieux Ouverts · VR',
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

const aide = computed(() =>
  tactile.value
    ? 'Glissez pour regarder autour de vous, touchez une photo pour l’approcher.'
    : 'Glissez pour regarder autour de vous, cliquez sur une photo pour l’approcher.',
)

let scene = null

onMounted(async () => {
  tactile.value = window.matchMedia('(pointer: coarse)').matches
  try {
    const { creerSceneVR } = await import('~/lib/vr/scene.js')
    scene = creerSceneVR(conteneur.value, {
      surChangement: (e) => {
        if ('photo' in e) photo.value = e.photo
        if ('vr' in e) enVR.value = e.vr
      },
    })
    pret.value = true
    vrOk.value = await scene.vrDisponible()
  } catch (e) {
    console.error('[vr]', e)
    erreur.value = 'Votre appareil n’arrive pas à afficher la visite en 3D.'
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', surPleinEcran)
  scene?.detruire()
  scene = null
})

async function entrerVR() {
  try {
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
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 600;
  text-shadow: 0 0 12px #fff;
}
.vr-titre span {
  color: var(--primary-pink);
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
