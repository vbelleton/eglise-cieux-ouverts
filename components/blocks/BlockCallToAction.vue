<template>
  <section
    class="block-call-to-action"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="cta-inner">
      <h2 v-if="title" class="cta-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="text" class="cta-text" data-field-key="text" :style="fieldFontStyle(fieldFonts, 'text', fieldFontSizes)">{{ text }}</p>
      <div v-if="primaryLabel || secondaryLabel" class="cta-buttons">
        <BlockLinkButton v-if="primaryLabel" :href="primaryLink" variant="primary" :color="buttonColor" :text-color="buttonTextColor">{{ primaryLabel }}</BlockLinkButton>
        <BlockLinkButton v-if="secondaryLabel" :href="secondaryLink" variant="secondary" :color="secondaryColor">{{ secondaryLabel }}</BlockLinkButton>
      </div>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  primaryLabel: { type: String, default: '' },
  primaryLink: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' },
  secondaryLink: { type: String, default: '' },
  backgroundColor: { type: String, default: '#064886' },
  textColor: { type: String, default: '#ffffff' },
  buttonColor: { type: String, default: '#d97777' },
  buttonTextColor: { type: String, default: '#ffffff' },
  animation: { type: String, default: 'fadeIn' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

// Le bouton secondaire (contour) reprend la couleur du texte du bloc, pour
// rester lisible quel que soit le fond choisi.
const secondaryColor = computed(() => props.textColor)

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
.block-call-to-action {
  padding: 70px 24px;
  text-align: center;
}
.cta-inner {
  max-width: 760px;
  margin: 0 auto;
}
.cta-title {
  margin: 0;
  font-size: clamp(1.6em, 4vw, 2.2em);
  line-height: 1.25;
}
.cta-text {
  margin: 16px 0 0;
  font-size: 1.1em;
  line-height: 1.6;
  opacity: 0.9;
}
.cta-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 28px;
}

@media (max-width: 600px) {
  .block-call-to-action { padding: 50px 20px; }
}
</style>
