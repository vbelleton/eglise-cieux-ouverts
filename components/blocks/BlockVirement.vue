<template>
  <section
    class="block-virement"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="virement-inner">
      <h2 v-if="title" class="virement-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="intro" class="virement-intro" data-field-key="intro" :style="fieldFontStyle(fieldFonts, 'intro', fieldFontSizes)">{{ intro }}</p>

      <dl class="virement-carte" :style="{ background: cardColor }">
        <div v-for="ligne in lignes" :key="ligne.cle" class="virement-ligne">
          <dt class="virement-libelle">{{ ligne.libelle }}</dt>
          <dd class="virement-valeur">
            <span class="virement-texte" :class="{ 'virement-code': ligne.code }">{{ ligne.valeur }}</span>
            <!-- Bouton affiché seulement une fois la page active (sans
                 JavaScript, il ne ferait rien) : la valeur reste
                 sélectionnable d'un clic dans tous les cas. -->
            <button
              v-if="ligne.copiable && copieDisponible && copyLabel"
              type="button"
              class="virement-copier"
              :style="{ background: buttonColor, color: buttonTextColor }"
              :aria-label="`${copyLabel} : ${ligne.libelle}`"
              @click="copier(ligne)"
            >{{ copie === ligne.cle ? copiedLabel || copyLabel : copyLabel }}</button>
          </dd>
        </div>
      </dl>

      <p v-if="note" class="virement-note" data-field-key="note" :style="fieldFontStyle(fieldFonts, 'note', fieldFontSizes)">{{ note }}</p>
      <p class="sr-only" aria-live="polite">{{ copie ? copiedLabel : '' }}</p>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  intro: { type: String, default: '' },
  holderLabel: { type: String, default: '' },
  holder: { type: String, default: '' },
  ibanLabel: { type: String, default: '' },
  iban: { type: String, default: '' },
  bicLabel: { type: String, default: '' },
  bic: { type: String, default: '' },
  bankLabel: { type: String, default: '' },
  bank: { type: String, default: '' },
  note: { type: String, default: '' },
  copyLabel: { type: String, default: '' },
  copiedLabel: { type: String, default: '' },
  backgroundColor: { type: String, default: '#f4f8fc' },
  textColor: { type: String, default: '#064886' },
  cardColor: { type: String, default: '#ffffff' },
  buttonColor: { type: String, default: '#064886' },
  buttonTextColor: { type: String, default: '#ffffff' },
  animation: { type: String, default: 'fadeIn' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

// Une ligne n'apparaît que si sa valeur est renseignée.
const lignes = computed(() => [
  { cle: 'holder', libelle: props.holderLabel, valeur: props.holder, copiable: true },
  // IBAN copié sans espaces : c'est la forme que toutes les banques acceptent.
  { cle: 'iban', libelle: props.ibanLabel, valeur: props.iban, copiable: true, code: true, aCopier: props.iban.replace(/\s+/g, '') },
  { cle: 'bic', libelle: props.bicLabel, valeur: props.bic, copiable: true, code: true },
  { cle: 'bank', libelle: props.bankLabel, valeur: props.bank, copiable: false },
].filter((l) => l.valeur))

const copieDisponible = ref(false)
const copie = ref('')
let minuteur = null

onMounted(() => {
  copieDisponible.value = !!navigator.clipboard?.writeText
})
onBeforeUnmount(() => clearTimeout(minuteur))

async function copier(ligne) {
  try {
    await navigator.clipboard.writeText(ligne.aCopier ?? ligne.valeur)
    copie.value = ligne.cle
    clearTimeout(minuteur)
    minuteur = setTimeout(() => { copie.value = '' }, 2000)
  } catch {
    // Copie refusée par le navigateur : la valeur reste sélectionnable.
  }
}

const animClass = computed(() => {
  if (!props.animation || props.animation === 'none') return ''
  return `block-anim-${props.animation} ${props.isTriggered ? 'triggered' : ''}`
})

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility?.mobile === false,
  'hide-tablet': props.visibility?.tablet === false,
  'hide-desktop': props.visibility?.desktop === false,
}))
</script>

<style scoped>
.block-virement {
  padding: 60px 24px 70px;
}
.virement-inner {
  max-width: 680px;
  margin: 0 auto;
}
.virement-title {
  margin: 0;
  text-align: center;
  font-size: clamp(1.5em, 4vw, 2em);
}
.virement-intro {
  margin: 14px 0 0;
  text-align: center;
  font-size: 1.05em;
  line-height: 1.65;
  white-space: pre-line;
}
.virement-carte {
  margin: 28px 0 0;
  padding: 8px 24px;
  border-radius: 14px;
  box-shadow: 0 6px 24px rgba(6, 72, 134, 0.1);
}
.virement-ligne {
  padding: 16px 0;
  border-bottom: 1px solid rgba(6, 72, 134, 0.12);
}
.virement-ligne:last-child { border-bottom: 0; }
.virement-libelle {
  font-size: 0.8em;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.7;
}
.virement-valeur {
  margin: 6px 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.virement-texte {
  font-size: 1.1em;
  font-weight: 600;
  overflow-wrap: anywhere;
  user-select: all;
}
.virement-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.02em;
}
.virement-copier {
  flex-shrink: 0;
  border: 0;
  border-radius: 999px;
  padding: 7px 16px;
  font: inherit;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
}
.virement-copier:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
.virement-note {
  margin: 20px 0 0;
  text-align: center;
  font-size: 0.95em;
  line-height: 1.6;
  opacity: 0.85;
  white-space: pre-line;
}

@media (max-width: 600px) {
  .block-virement { padding: 44px 16px 54px; }
  .virement-carte { padding: 4px 16px; }
  .virement-texte { font-size: 1em; }
  /* L'IBAN tient sur une ligne sur un téléphone courant (375 px). */
  .virement-code { font-size: 0.9em; letter-spacing: 0; }
}
</style>
