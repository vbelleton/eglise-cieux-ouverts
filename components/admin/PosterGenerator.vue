<template>
  <div class="poster-gen" data-testid="poster-generator">
    <div class="poster-gen-row">
      <label>Modèle
        <select v-model="modeleId" data-testid="poster-modele">
          <option v-for="m in MODELES_AFFICHES" :key="m.id" :value="m.id">{{ m.libelle }}</option>
        </select>
      </label>
      <label>Date de l'affiche
        <input v-model="dateChoisie" type="date" data-testid="poster-date" @change="majDate" />
      </label>
    </div>
    <div class="poster-gen-row">
      <label v-for="z in modele.zones" :key="z.cle">{{ z.libelle }}
        <input v-model="textes[z.cle]" type="text" :data-testid="`poster-texte-${z.cle}`" />
      </label>
    </div>
    <p class="poster-gen-aide">Le texte est modifiable librement, par exemple « Chaque dernier vendredi du mois ».</p>
    <canvas ref="canvasRef" class="poster-gen-apercu" data-testid="poster-apercu" />
    <p v-if="erreur" class="poster-gen-erreur">{{ erreur }}</p>
    <div class="poster-gen-actions">
      <button type="button" class="poster-gen-btn" :disabled="envoi || !pret" data-testid="poster-utiliser" @click="utiliser">
        {{ envoi ? 'Envoi…' : 'Utiliser cette affiche' }}
      </button>
      <button type="button" class="poster-gen-btn sec" @click="$emit('fermer')">Annuler</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { MODELES_AFFICHES, modeleParId, modelePourEvenement, textesParDefaut, dateEnToutesLettres, dessinerAffiche, canvasEnFichier, nomFichierAffiche } from '~/utils/posterTemplates.js'
import { uploadImage } from '~/utils/imageUpload.js'

const props = defineProps({
  titre: { type: String, default: '' },
  date: { type: String, default: '' }, // AAAA-MM-JJ
  heure: { type: String, default: '' }, // HH:MM
})
const emit = defineEmits(['utiliser', 'fermer'])

const modeleId = ref(modelePourEvenement(props.titre).id)
const modele = computed(() => modeleParId(modeleId.value) || MODELES_AFFICHES[0])
const dateChoisie = ref(props.date)
const textes = ref(textesParDefaut(modele.value, { date: props.date, heure: props.heure }))
const canvasRef = ref(null)
const pret = ref(false)
const envoi = ref(false)
const erreur = ref('')

function majDate() {
  if (modele.value.zones.some(z => z.cle === 'date')) textes.value.date = dateEnToutesLettres(dateChoisie.value)
}

watch(modeleId, () => {
  textes.value = textesParDefaut(modele.value, { date: dateChoisie.value, heure: props.heure })
})

let tour = 0
async function redessiner() {
  if (!canvasRef.value) return
  const n = ++tour
  try {
    await dessinerAffiche(canvasRef.value, modele.value, textes.value)
    if (n === tour) { pret.value = true; erreur.value = '' }
  } catch (e) {
    if (n === tour) { pret.value = false; erreur.value = e?.message || 'Aperçu impossible' }
  }
}
watch([modele, textes], redessiner, { deep: true })
onMounted(redessiner)

async function utiliser() {
  envoi.value = true
  erreur.value = ''
  try {
    await redessiner()
    const fichier = await canvasEnFichier(canvasRef.value, nomFichierAffiche(modele.value, dateChoisie.value))
    emit('utiliser', await uploadImage(fichier))
  } catch (e) {
    erreur.value = 'Envoi impossible : ' + (e?.message || e)
  } finally {
    envoi.value = false
  }
}
</script>

<style scoped>
.poster-gen { border: 1px dashed #93c5fd; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: #f8fbff; }
.poster-gen-row { display: flex; gap: 8px; flex-wrap: wrap; }
.poster-gen-row label { flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 4px; font-size: 0.85em; font-weight: 600; color: #374151; }
.poster-gen-row input, .poster-gen-row select { padding: 7px 9px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.95em; font-weight: 400; }
.poster-gen-aide { margin: 0; font-size: 0.78em; color: #6b7280; }
.poster-gen-apercu { width: 100%; height: auto; border-radius: 6px; background: #f3f4f6; aspect-ratio: 16 / 9; }
.poster-gen-erreur { margin: 0; color: #b91c1c; font-size: 0.85em; }
.poster-gen-actions { display: flex; gap: 8px; }
.poster-gen-btn { padding: 8px 14px; border: none; border-radius: 6px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
.poster-gen-btn:disabled { opacity: 0.6; cursor: default; }
.poster-gen-btn.sec { background: #e5e7eb; color: #374151; }
</style>
