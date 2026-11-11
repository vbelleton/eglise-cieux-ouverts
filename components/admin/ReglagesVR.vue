<template>
  <div class="reglages-vr">
    <p class="settings-hint">
      La salle de prière en réalité virtuelle : la Bible au pupitre, l'agenda, les prédications et des photos qui flottent
      autour. Aucun lien du site n'y mène : on y accède par l'adresse <a href="/vr" target="_blank" rel="noopener">/vr</a>.
    </p>
    <p v-if="etat === 'chargement'" class="settings-hint">Chargement…</p>
    <template v-else-if="etat === 'erreur'">
      <!-- Jamais d'enregistrement par-dessus des réglages qu'on n'a pas pu lire. -->
      <p class="settings-hint reglages-vr-erreur">Les réglages actuels n'ont pas pu être lus : rien ne sera modifié.</p>
      <button type="button" class="settings-test-email-btn" @click="charger">Réessayer</button>
    </template>
    <template v-else>
      <fieldset class="reglages-vr-groupe">
        <legend>Accueil</legend>
        <label class="reglages-vr-champ">
          Titre affiché en haut de l'écran
          <input v-model="form.titre" type="text" maxlength="60" placeholder="salle de prière" />
        </label>
        <label class="reglages-vr-champ">
          Passage biblique d'ouverture
          <input v-model="form.passage" type="text" maxlength="60" placeholder="Automatique (ex. Psaume 23, Jean 3.16)" />
        </label>
        <p class="settings-hint" :class="{ 'reglages-vr-erreur': passageInvalide }">
          <template v-if="!form.passage.trim()">
            Automatique : le passage cité par la dernière prédication, sinon un passage différent chaque jour.
          </template>
          <template v-else-if="passageInvalide">Passage non reconnu : écrivez le livre en entier puis le chapitre, ex. « Romains 8 ».</template>
          <template v-else>La Bible s'ouvrira sur {{ passageReconnu }}.</template>
        </p>
      </fieldset>

      <fieldset class="reglages-vr-groupe">
        <legend>Lieux de prière</legend>
        <p class="settings-hint">Cochez les lieux proposés aux visiteurs (au moins un).</p>
        <label v-for="l in LIEUX" :key="l.id" class="settings-checkbox-label">
          <input
            type="checkbox"
            class="settings-checkbox"
            :checked="form.lieux.includes(l.id)"
            :disabled="form.lieux.length === 1 && form.lieux.includes(l.id)"
            @change="basculerLieu(l.id, $event.target.checked)"
          />
          <span><strong>{{ l.nom }}</strong> — {{ l.description }}</span>
        </label>
        <label class="reglages-vr-champ">
          Lieu de prière à l'arrivée
          <select v-model="form.lieu">
            <option v-for="l in lieuxProposes" :key="l.id" :value="l.id">{{ l.nom }}</option>
          </select>
        </label>
        <p class="settings-hint">Chaque visiteur peut ensuite changer de lieu ; son choix est retenu sur son appareil.</p>
      </fieldset>

      <fieldset class="reglages-vr-groupe">
        <legend>Temps de prière</legend>
        <label class="reglages-vr-champ reglages-vr-duree">
          Durée du temps de prière
          <span>
            <input v-model.number="form.dureePriere" type="number" :min="VR_DUREE_MIN" :max="VR_DUREE_MAX" step="1" />
            minutes
          </span>
        </label>
        <p class="settings-hint">Les versets du chapitre ouvert apparaissent un à un pendant ce temps.</p>
      </fieldset>

      <fieldset class="reglages-vr-groupe">
        <legend>Fond musical</legend>
        <label class="reglages-vr-champ">
          Musique à l'arrivée
          <select v-model="form.musique">
            <option :value="null">Aucune</option>
            <option v-for="a in AMBIANCES" :key="a.id" :value="a.id">{{ a.nom }} — {{ a.description }}</option>
          </select>
        </label>
        <p class="settings-hint">
          Nappes douces jouées en direct par l'appareil, sans droits d'auteur. Elles démarrent au premier geste du visiteur, se taisent
          pendant une prédication et se font discrètes pendant la lecture de la Bible. Chaque visiteur peut en changer (son choix est
          retenu sur son appareil).
        </p>
      </fieldset>

      <fieldset class="reglages-vr-groupe">
        <legend>Contenu des panneaux</legend>
        <label class="settings-checkbox-label">
          <input v-model="form.agenda" type="checkbox" class="settings-checkbox" />
          Afficher les prochains rendez-vous de l'agenda
        </label>
        <label class="settings-checkbox-label">
          <input v-model="form.predications" type="checkbox" class="settings-checkbox" />
          Afficher les dernières prédications (YouTube)
        </label>
      </fieldset>

      <fieldset class="reglages-vr-groupe">
        <legend>Photos</legend>
        <label class="settings-checkbox-label">
          <input v-model="form.photosSite" type="checkbox" class="settings-checkbox" />
          Inclure les photos des activités du site
        </label>
        <ul v-if="form.photosSite" class="reglages-vr-photos" aria-label="Photos des activités dans la salle">
          <li v-for="p in VR_PHOTOS_SITE" :key="p.image" :class="{ 'reglages-vr-photo--retiree': form.photosSiteMasquees.includes(p.image) }">
            <label>
              <img :src="p.image" :alt="p.titre" loading="lazy" />
              <span>
                <input
                  type="checkbox"
                  :checked="!form.photosSiteMasquees.includes(p.image)"
                  @change="basculerPhotoSite(p.image, $event.target.checked)"
                />
                {{ p.titre }}
              </span>
            </label>
          </li>
        </ul>
        <label class="settings-checkbox-label">
          <input v-model="form.tableaux" type="checkbox" class="settings-checkbox" />
          Ajouter des tableaux de maîtres (domaine public) liés au passage ouvert
        </label>
        <p class="settings-hint">Photos choisies pour la salle (médiathèque ou téléversement, {{ VR_MAX_PHOTOS }} au plus) :</p>
        <FieldImages :value="form.photos" :field="{ key: 'photos' }" @change="(v) => (form.photos = v.filter(Boolean))" />
      </fieldset>
      <p v-if="message" class="settings-hint" :class="message.ok ? 'email-etat-ok' : 'email-etat-ko'">{{ message.texte }}</p>
    </template>
  </div>
</template>

<script setup>
// Réglages de la salle de prière VR (document Firestore `settings/vr`,
// /api/vr/reglages), dans la fenêtre 🥽 « Salle VR » de la barre d'admin
// (AdminToolbar appelle `enregistrer()`).
import { ref, computed, watch, onMounted } from 'vue'
import FieldImages from '~/components/editor/fields/FieldImages.vue'
import { normaliserReglagesVR, VR_DUREE_MIN, VR_DUREE_MAX, VR_MAX_PHOTOS, VR_PHOTOS_SITE } from '~/utils/vrReglages.js'
import { trouverPassages, nomPassage } from '~/utils/livresBible.js'
import { LIEUX } from '~/lib/vr/lieux/index.js'
import { AMBIANCES } from '~/lib/vr/musique.js'

const props = defineProps({ jeton: { type: Function, required: true } })

const etat = ref('chargement')
const form = ref(normaliserReglagesVR(null))
const message = ref(null)
let initial = ''

const lieuxProposes = computed(() => LIEUX.filter((l) => form.value.lieux.includes(l.id)))
const passageTrouve = computed(() => trouverPassages(form.value.passage)[0] || null)
const passageInvalide = computed(() => Boolean(form.value.passage.trim()) && !passageTrouve.value)
const passageReconnu = computed(() => (passageTrouve.value ? nomPassage(passageTrouve.value) : ''))

function basculerPhotoSite(image, gardee) {
  const m = form.value.photosSiteMasquees.filter((u) => u !== image)
  form.value.photosSiteMasquees = gardee ? m : [...m, image]
}

function basculerLieu(id, coche) {
  const lieux = coche ? [...form.value.lieux, id] : form.value.lieux.filter((x) => x !== id)
  if (!lieux.length) return
  form.value.lieux = LIEUX.map((l) => l.id).filter((x) => lieux.includes(x))
}
// Le lieu d'arrivée suit les lieux proposés.
watch(
  () => form.value.lieux,
  (lieux) => {
    if (!lieux.includes(form.value.lieu)) form.value.lieu = lieux[0]
  },
)

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
  if (etat.value !== 'pret') return etat.value !== 'erreur'
  if (passageInvalide.value) {
    message.value = { ok: false, texte: 'Le passage d’ouverture n’est pas reconnu : corrigez-le ou videz le champ.' }
    return false
  }
  const corps = normaliserReglagesVR(form.value)
  if (JSON.stringify(corps) === initial) return true
  try {
    const token = await props.jeton()
    await $fetch('/api/vr/reglages', { method: 'PUT', body: corps, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    initial = JSON.stringify(corps)
    form.value = corps
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
.reglages-vr a {
  color: inherit;
}
.reglages-vr-groupe {
  margin: 12px 0;
  padding: 10px 14px 12px;
  border: 1px solid #dbe3ea;
  border-radius: 10px;
}
.reglages-vr-groupe legend {
  padding: 0 6px;
  font-weight: 700;
}
.reglages-vr .settings-checkbox-label {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 6px 0;
}
.reglages-vr .settings-checkbox-label input {
  flex: none;
}
.reglages-vr-champ {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0 2px;
  font-weight: 600;
}
.reglages-vr-champ input,
.reglages-vr-champ select {
  max-width: 100%;
  padding: 6px 8px;
  border: 1px solid #c8d3dd;
  border-radius: 6px;
  font: inherit;
  font-weight: 400;
}
.reglages-vr-duree span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 400;
}
.reglages-vr-duree input {
  width: 5em;
}
.reglages-vr-photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  margin: 6px 0 12px;
  padding: 0;
  list-style: none;
}
.reglages-vr-photos label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}
.reglages-vr-photos img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 6px;
}
.reglages-vr-photo--retiree img {
  opacity: 0.35;
  filter: grayscale(1);
}
.reglages-vr-erreur {
  color: #b42318;
}
</style>
