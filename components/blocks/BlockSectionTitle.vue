<template>
  <section
    class="block-section-title"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor, textAlign: align }"
  >
    <div class="section-title-inner">
      <h2 v-if="title" class="section-title-text" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <span v-if="showDivider" class="section-title-divider" :class="`section-title-divider-${align}`" :style="{ background: dividerColor || textColor }" aria-hidden="true"></span>
      <p v-if="subtitle" class="section-title-subtitle" data-field-key="subtitle" :style="fieldFontStyle(fieldFonts, 'subtitle', fieldFontSizes)">{{ subtitle }}</p>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  align: { type: String, default: 'center' },
  showDivider: { type: Boolean, default: true },
  dividerColor: { type: String, default: '' },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#064886' },
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
.block-section-title {
  padding: 56px 24px 40px;
}
.section-title-inner {
  max-width: 800px;
  margin: 0 auto;
}
.section-title-text {
  margin: 0;
  font-size: clamp(1.7em, 4.5vw, 2.5em);
  line-height: 1.2;
}
.section-title-divider {
  display: block;
  width: 64px;
  height: 4px;
  border-radius: 2px;
  margin: 18px auto;
  opacity: 0.85;
}
.section-title-divider-left { margin-left: 0; margin-right: auto; }
.section-title-divider-right { margin-left: auto; margin-right: 0; }
.section-title-subtitle {
  margin: 0;
  font-size: 1.1em;
  line-height: 1.6;
  opacity: 0.85;
}

@media (max-width: 600px) {
  .block-section-title { padding: 40px 20px 28px; }
}
</style>
