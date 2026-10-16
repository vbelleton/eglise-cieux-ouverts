<template>
  <section
    class="block-don"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="don-inner">
      <span v-if="icon" class="don-icon" aria-hidden="true">{{ icon }}</span>
      <h2 v-if="title" class="don-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="text" class="don-text" data-field-key="text" :style="fieldFontStyle(fieldFonts, 'text', fieldFontSizes)">{{ text }}</p>
      <div v-if="buttonLabel" class="don-button">
        <BlockLinkButton :href="buttonLink" variant="primary" :color="buttonColor" :text-color="buttonTextColor">{{ buttonLabel }}</BlockLinkButton>
      </div>
      <p v-if="note" class="don-note" data-field-key="note" :style="fieldFontStyle(fieldFonts, 'note', fieldFontSizes)">{{ note }}</p>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  note: { type: String, default: '' },
  buttonLabel: { type: String, default: '' },
  buttonLink: { type: String, default: '' },
  backgroundColor: { type: String, default: '#fdf2f2' },
  textColor: { type: String, default: '#064886' },
  buttonColor: { type: String, default: '#d97777' },
  buttonTextColor: { type: String, default: '#ffffff' },
  animation: { type: String, default: 'fadeIn' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

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
.block-don {
  padding: 70px 24px;
  text-align: center;
}
.don-inner {
  max-width: 680px;
  margin: 0 auto;
}
.don-icon {
  display: block;
  font-size: 2.6em;
  margin-bottom: 10px;
}
.don-title {
  margin: 0;
  font-size: clamp(1.6em, 4vw, 2.2em);
}
.don-text {
  margin: 16px 0 0;
  font-size: 1.1em;
  line-height: 1.65;
  white-space: pre-line;
}
.don-button { margin-top: 28px; }
.don-note {
  margin: 18px 0 0;
  font-size: 0.9em;
  opacity: 0.75;
}

@media (max-width: 600px) {
  .block-don { padding: 50px 20px; }
}
</style>
