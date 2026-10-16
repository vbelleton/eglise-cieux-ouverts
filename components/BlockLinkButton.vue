<template>
  <NuxtLink
    v-if="adresse && interne"
    :to="adresse"
    class="block-link-btn"
    :class="`block-link-btn-${variant}`"
    :style="styleBouton"
    @click="onClick"
  ><slot /></NuxtLink>
  <a
    v-else-if="adresse"
    :href="adresse"
    class="block-link-btn"
    :class="`block-link-btn-${variant}`"
    :style="styleBouton"
    :target="externe ? '_blank' : undefined"
    :rel="externe ? 'noopener' : undefined"
    @click="onClick"
  ><slot /></a>
</template>

<script setup>
import { lienSur, estInterne } from '~/utils/safeLink.js'

// Bouton-lien des blocs (appel à l'action, don, horaires, colonnes…). Le lien
// est filtré par lienSur : une adresse non reconnue n'affiche pas de bouton.
// Dans l'admin, un clic ne quitte pas la page (le clic sert à sélectionner).
const props = defineProps({
  href: { type: String, default: '' },
  variant: { type: String, default: 'primary' },
  color: { type: String, default: '' },
  textColor: { type: String, default: '' },
})

const isEditor = inject('isEditor', false)
const adresse = computed(() => lienSur(props.href))
const interne = computed(() => estInterne(adresse.value))
const externe = computed(() => /^https?:\/\//i.test(adresse.value))
const styleBouton = computed(() => {
  const s = {}
  if (props.color) s['--btn-color'] = props.color
  if (props.textColor) s['--btn-text'] = props.textColor
  return s
})

function onClick(e) {
  if (isEditor) e.preventDefault()
}
</script>

<style scoped>
.block-link-btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 999px;
  border: 2px solid var(--btn-color, #d97777);
  font-weight: 700;
  font-size: 1em;
  text-decoration: none;
  transition: transform 0.15s, background-color 0.15s, color 0.15s;
}
.block-link-btn-primary {
  background: var(--btn-color, #d97777);
  color: var(--btn-text, #ffffff);
}
.block-link-btn-secondary {
  background: transparent;
  color: var(--btn-color, #d97777);
}
.block-link-btn:hover {
  transform: translateY(-2px);
}
.block-link-btn:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 3px;
}
</style>
