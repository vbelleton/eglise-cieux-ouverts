<template>
  <div class="settings-field reglages-vr">
    <label>Salle de prière VR (page cachée <code>/vr</code>)</label>
    <p class="settings-hint">
      Une salle de prière en réalité virtuelle : la Bible au pupitre, l'agenda, les prédications et des photos qui flottent
      autour. Aucun lien du site n'y mène : on y accède par l'adresse.
    </p>
    <p v-if="etat === 'chargement'" class="settings-hint">Chargement…</p>
    <template v-else-if="etat === 'erreur'">
      <!-- Jamais d'enregistrement par-dessus des réglages qu'on n'a pas pu lire. -->
      <p class="settings-hint reglages-vr-erreur">Les réglages actuels n'ont pas pu être lus : rien ne sera modifié.</p>
      <button type="button" class="settings-test-email-btn" @click="charger">Réessayer</button>
    </template>
    <template v-else>
      <label class="settings-checkbox-label">
        <input v-model="form.agenda" type="checkbox" class="settings-checkbox" />
        Afficher les prochains rendez-vous de l'agenda
      </label>
      <label class="settings-checkbox-label">
        <input v-model="form.predications" type="checkbox" class="settings-checkbox" />
        Afficher les dernières prédications (YouTube)
      </label>
      <label class="settings-checkbox-label">
        <input v-model="form.photosSite" type="checkbox" class="settings-checkbox" />
        Inclure les photos des activités du site
      </label>
      <p class="settings-hint">Photos choisies pour la salle (médiathèque ou téléversement) :</p>
      <FieldImages :value="form.photos" :field="{ key: 'photos' }" @change="(v) => (form.photos = v.filter(Boolean))" />
      <p v-if="message" class="settings-hint" :class="message.ok ? 'email-etat-ok' : 'email-etat-ko'">{{ message.texte }}</p>
    </template>
  </div>
</template>

<script setup>
// Réglages de la salle de prière VR (document Firestore `settings/vr`,
// /api/vr/reglages). Enregistrés avec le reste de ⚙ Config : AdminToolbar
// appelle `enregistrer()` dans saveSettings.
import { ref, onMounted } from 'vue'
import FieldImages from '~/components/editor/fields/FieldImages.vue'
import { normaliserReglagesVR } from '~/utils/vrReglages.js'

const props = defineProps({ jeton: { type: Function, required: true } })

const etat = ref('chargement')
const form = ref(normaliserReglagesVR(null))
const message = ref(null)
let initial = ''

async function charger() {
  etat.value = 'chargement'
  try {
    const data = await $fetch('/api/vr/reglages', { timeout: 10000 })
    if (data?.lu === false) throw new Error('lecture impossible')
    form.value = normaliserReglagesVR(data)
    initial = JSON.stringify(form.value)
    etat.value = 'pret'
  } catch {
    etat.value = 'erreur'
  }
}

/** Enregistre si quelque chose a changé ; renvoie false en cas d'échec. */
async function enregistrer() {
  if (etat.value !== 'pret') return true
  const corps = normaliserReglagesVR(form.value)
  if (JSON.stringify(corps) === initial) return true
  try {
    const token = await props.jeton()
    await $fetch('/api/vr/reglages', { method: 'PUT', body: corps, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    initial = JSON.stringify(corps)
    message.value = { ok: true, texte: 'Salle de prière enregistrée.' }
    return true
  } catch (e) {
    message.value = { ok: false, texte: `Salle de prière non enregistrée : ${e?.data?.message || e?.message || e}` }
    return false
  }
}

defineExpose({ enregistrer })
onMounted(charger)
</script>

<style scoped>
.reglages-vr .settings-checkbox-label {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 6px 0;
}
.reglages-vr-erreur {
  color: #b42318;
}
</style>
