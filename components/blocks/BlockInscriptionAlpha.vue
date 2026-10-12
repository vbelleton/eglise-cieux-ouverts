<template>
  <section
    id="inscription-alpha"
    class="block-inscription-alpha"
    :class="visibilityClasses"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="ia-inner">
      <h2 class="ia-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="intro" class="ia-intro" data-field-key="intro" :style="fieldFontStyle(fieldFonts, 'intro', fieldFontSizes)">{{ intro }}</p>
      <p v-if="parcours" class="ia-parcours"><strong>{{ parcours }}</strong></p>

      <p v-if="places && places.remaining !== null && !submitted" class="ia-places" :class="{ 'ia-places-full': places.remaining === 0 }">
        {{ places.remaining === 0 ? 'Complet' : `Plus que ${places.remaining} place${places.remaining > 1 ? 's' : ''} sur ${places.capacity}` }}
      </p>

      <p v-if="submitted" class="ia-success" role="status">{{ successText }}</p>

      <p v-else-if="places && places.remaining === 0" class="ia-full" role="status">{{ fullText }}</p>

      <form v-else class="ia-form" @submit.prevent="submitForm">
        <div class="ia-row">
          <label class="ia-field">
            <span>{{ labelPrenom }} *</span>
            <input v-model="form.prenom" type="text" autocomplete="given-name" maxlength="80" :disabled="sending" required />
          </label>
          <label class="ia-field">
            <span>{{ labelNom }} *</span>
            <input v-model="form.nom" type="text" autocomplete="family-name" maxlength="80" :disabled="sending" required />
          </label>
        </div>
        <div class="ia-row">
          <label class="ia-field">
            <span>{{ labelEmail }} *</span>
            <input v-model="form.email" type="email" autocomplete="email" maxlength="180" :disabled="sending" required />
          </label>
          <label class="ia-field">
            <span>{{ labelTelephone }} *</span>
            <input v-model="form.telephone" type="tel" autocomplete="tel" maxlength="40" :disabled="sending" required />
          </label>
        </div>
        <label v-if="showAddress" class="ia-field">
          <span>{{ labelAdresse }}</span>
          <input v-model="form.adresse" type="text" autocomplete="street-address" maxlength="300" :disabled="sending" />
        </label>
        <label v-if="showMessage" class="ia-field">
          <span>{{ labelMessage }}</span>
          <textarea v-model="form.message" rows="3" maxlength="2000" :disabled="sending"></textarea>
        </label>

        <input v-model="form.website" type="text" class="ia-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />

        <label class="ia-consent">
          <input v-model="form.consent" type="checkbox" :disabled="sending" required />
          <span>{{ consentText }}</span>
        </label>

        <p v-if="isEditor" class="ia-editor">Le formulaire est désactivé dans l'admin. Teste-le sur le site public.</p>
        <p v-if="errorMessage" class="ia-error" role="alert">{{ errorMessage }}</p>

        <button type="submit" class="ia-btn" :disabled="sending">{{ sending ? 'Envoi…' : submitText }}</button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  intro: { type: String, default: '' },
  parcours: { type: String, default: '' },
  showAddress: { type: Boolean, default: true },
  labelPrenom: { type: String, default: 'Prénom' },
  labelNom: { type: String, default: 'Nom' },
  labelEmail: { type: String, default: 'E-mail' },
  labelTelephone: { type: String, default: 'Téléphone' },
  labelAdresse: { type: String, default: 'Adresse postale (facultatif)' },
  showMessage: { type: Boolean, default: true },
  labelMessage: { type: String, default: 'Un mot pour nous (facultatif)' },
  consentText: { type: String, default: '' },
  submitText: { type: String, default: "Je m'inscris" },
  successText: { type: String, default: '' },
  fullText: { type: String, default: 'Ce parcours est complet.' },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#1a1a2e' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

const isEditor = inject('isEditor', false)
const route = useRoute()

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility.mobile === false,
  'hide-tablet': props.visibility.tablet === false,
  'hide-desktop': props.visibility.desktop === false,
}))

const vide = () => ({ prenom: '', nom: '', email: '', telephone: '', adresse: '', message: '', consent: false, website: '' })
const form = ref(vide())
const sending = ref(false)
const submitted = ref(false)
const errorMessage = ref('')
const mountedAt = Date.now()
const places = ref(null)

async function chargerPlaces() {
  try {
    places.value = await $fetch('/api/alpha-places', { query: { parcours: props.parcours || 'Parcours Alpha' } })
  } catch (e) {
    places.value = null // compteur indisponible : le formulaire reste ouvert
  }
}
onMounted(chargerPlaces)

async function submitForm() {
  if (isEditor === true) return
  const f = form.value
  const data = {
    prenom: f.prenom.trim(),
    nom: f.nom.trim(),
    email: f.email.trim().toLowerCase(),
    telephone: f.telephone.trim(),
    adresse: f.adresse.trim(),
    message: f.message.trim(),
  }
  if (!data.prenom || !data.nom || !data.email || !data.telephone) {
    errorMessage.value = 'Merci de renseigner les champs obligatoires.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errorMessage.value = 'Merci de saisir une adresse e-mail valide.'
    return
  }
  if (data.telephone.replace(/\D/g, '').length < 6) {
    errorMessage.value = 'Merci de saisir un numéro de téléphone valide.'
    return
  }
  if (!f.consent) {
    errorMessage.value = 'Merci de cocher la case d\'accord pour l\'utilisation de tes coordonnées.'
    return
  }
  if (f.website.trim() || Date.now() - mountedAt < 2500) {
    errorMessage.value = 'Merci de patienter une seconde avant d\'envoyer le formulaire.'
    return
  }

  sending.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: { ...data, parcours: props.parcours || 'Parcours Alpha', website: '', source: route.fullPath },
    })
    submitted.value = true
    form.value = vide()
    chargerPlaces()
  } catch (e) {
    console.error(e)
    if (e?.statusCode === 409 || e?.status === 409) chargerPlaces()
    errorMessage.value = e?.data?.message || "L'envoi a échoué. Vérifie la connexion ou réessaie dans un instant."
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.block-inscription-alpha { padding: 60px 20px; }
.ia-inner { max-width: 680px; margin: 0 auto; }
.ia-title { text-align: center; margin: 0 0 12px; color: #064886; }
.ia-intro { text-align: center; margin: 0 0 12px; line-height: 1.6; }
.ia-parcours { text-align: center; margin: 0 0 20px; }
.ia-form { display: flex; flex-direction: column; gap: 14px; }
.ia-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ia-field { display: flex; flex-direction: column; gap: 4px; font-size: 0.92em; }
.ia-field input, .ia-field textarea { padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font: inherit; color: #1a1a2e; background: #fff; }
.ia-field input:focus, .ia-field textarea:focus { outline: none; border-color: #064886; }
.ia-consent { display: flex; gap: 10px; align-items: flex-start; font-size: 0.85em; line-height: 1.5; }
.ia-consent input { margin-top: 3px; }
.ia-btn { align-self: center; padding: 12px 32px; border: none; border-radius: 999px; background: #064886; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.ia-btn:disabled { opacity: 0.6; cursor: default; }
.ia-places { text-align: center; font-weight: 600; margin: 0 0 16px; color: #064886; }
.ia-places-full { color: #b91c1c; }
.ia-full { text-align: center; font-weight: 600; background: #fef3c7; padding: 16px; border-radius: 10px; }
.ia-success { text-align: center; font-weight: 600; color: #166534; background: #dcfce7; padding: 16px; border-radius: 10px; }
.ia-error { color: #b91c1c; margin: 0; text-align: center; }
.ia-editor { font-size: 0.85em; opacity: 0.7; margin: 0; text-align: center; }
.ia-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
@media (max-width: 600px) { .ia-row { grid-template-columns: 1fr; } }
</style>
