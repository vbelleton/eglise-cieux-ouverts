<template>
  <!-- Image d'événement qui ne se montre jamais à moitié chargée :
       - la place est réservée dès le départ (cadre au ratio fixe), rien ne
         saute quand l'image arrive ;
       - l'image reste invisible tant qu'elle n'est pas entièrement téléchargée
         ET décodée (img.decode()), puis apparaît en fondu ;
       - déjà en cache (préchargement de l'agenda) : affichée tout de suite,
         sans fondu ;
       - en erreur : le fond neutre avec l'emoji, jamais l'icône « image cassée ». -->
  <div class="image-agenda" :class="{ 'est-prete': prete, 'en-erreur': erreur, 'sans-fondu': sansFondu }" :style="{ aspectRatio: ratio }">
    <span v-if="erreur || !prete" class="image-agenda-fond" aria-hidden="true">{{ erreur ? (emoji || '✝️') : '' }}</span>
    <img
      v-if="!erreur && srcAffichee"
      ref="img"
      :src="srcAffichee"
      :alt="alt"
      :loading="prioritaire ? 'eager' : 'lazy'"
      :fetchpriority="prioritaire ? 'high' : 'auto'"
      decoding="async"
      class="image-agenda-img"
      @load="surChargement"
      @error="erreur = true"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { modelePourImage, afficheSeance } from '~/utils/posterTemplates.js'

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  // Les visuels de l'église sont en 16:9 ; un autre format est affiché en
  // entier dans ce cadre (object-fit: contain), sans recadrage ni saut.
  ratio: { type: String, default: '16 / 9' },
  emoji: { type: String, default: '' },
  // Image visible dès l'ouverture (fenêtre du jour, première carte) : pas de
  // chargement différé.
  prioritaire: { type: Boolean, default: false },
  // Séance montrée (Date ou AAAA-MM-JJ) et son heure de début : servent quand
  // l'image est une affiche automatique.
  date: { type: [Date, String], default: null },
  heure: { type: String, default: '' },
  // Titre et rythme de la fiche (« Chaque mardi ») : écrits sur les modèles
  // d'affiche qui les prévoient (modèle « Tout événement »).
  titre: { type: String, default: '' },
  rythme: { type: String, default: '' },
})

// Adresse réellement affichée : `src`, ou l'affiche générée pour la séance.
// Vide pendant la génération (et au rendu serveur) : cadre réservé, pas de
// fond sans date qui clignote.
const srcAffichee = ref(modelePourImage(props.src) ? '' : props.src)
let demande = 0
async function preparerSource() {
  const modele = modelePourImage(props.src)
  if (!modele) { srcAffichee.value = props.src; return }
  const n = ++demande
  try {
    const url = await afficheSeance(modele, { date: props.date, heure: props.heure, titre: props.titre, rythme: props.rythme })
    if (n === demande) srcAffichee.value = url
  } catch {
    if (n === demande) erreur.value = true
  }
}

const img = ref(null)
const prete = ref(false)
const erreur = ref(false)
const sansFondu = ref(false)

async function surChargement() {
  const el = img.value
  if (!el) return
  // decode() : l'image est prête à peindre d'un bloc. Sans lui, une grande
  // image peut encore se dessiner par bandes juste après « load ».
  try { if (el.decode) await el.decode() } catch { /* image déjà décodée ou format non décodable : on affiche quand même */ }
  if (img.value === el) prete.value = true
}

function verifierCache() {
  const el = img.value
  if (el && el.complete && el.naturalWidth > 0) {
    // Déjà là (préchargée) : pas de fondu, l'image doit sembler instantanée.
    sansFondu.value = true
    prete.value = true
  }
}

onMounted(() => {
  verifierCache()
  if (modelePourImage(props.src)) preparerSource()
})

// Clé texte : un nouvel objet Date pour le même jour ne relance rien.
const cleSeance = () => `${props.src}|${props.date instanceof Date ? props.date.toDateString() : props.date || ''}|${props.heure}|${props.titre}|${props.rythme}`
watch(cleSeance, async () => {
  const avant = srcAffichee.value
  erreur.value = false
  await preparerSource()
  if (srcAffichee.value === avant) return
  prete.value = false
  sansFondu.value = false
  // Le nouvel élément <img> est en place au tick suivant.
  queueMicrotask(verifierCache)
})
</script>

<style scoped>
.image-agenda {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(135deg, #e8eff9 0%, #d3e1f3 100%);
}
.image-agenda-fond {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 2.6em;
}
/* Chargement en cours : léger reflet qui passe, pour montrer que ça arrive
   sans laisser voir l'image se dessiner. */
.image-agenda:not(.est-prete):not(.en-erreur) .image-agenda-fond::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: image-agenda-reflet 1.4s ease-in-out infinite;
}
@keyframes image-agenda-reflet {
  from { background-position: 150% 0; }
  to { background-position: -50% 0; }
}
.image-agenda-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  display: block;
  opacity: 0;
  transition: opacity 0.35s ease;
}
.image-agenda.est-prete .image-agenda-img { opacity: 1; }
.image-agenda.sans-fondu .image-agenda-img { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .image-agenda-img { transition: none; }
  .image-agenda .image-agenda-fond::after { animation: none !important; }
}
</style>
