<template>
  <section
    class="block-infos-pratiques"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="infos-inner">
      <h2 v-if="title" class="infos-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="subtitle" class="infos-subtitle" data-field-key="subtitle" :style="fieldFontStyle(fieldFonts, 'subtitle', fieldFontSizes)">{{ subtitle }}</p>
      <ul class="infos-grid">
        <li v-for="(item, i) in items" :key="i" class="infos-card" :style="{ background: cardColor }">
          <span v-if="item.icon" class="infos-icon" aria-hidden="true">{{ item.icon }}</span>
          <h3 v-if="item.label" class="infos-label">{{ item.label }}</h3>
          <p v-if="item.text" class="infos-text">{{ item.text }}</p>
        </li>
      </ul>
      <div v-if="buttonLabel" class="infos-button">
        <BlockLinkButton :href="buttonLink" variant="primary" :color="buttonColor" :text-color="buttonTextColor">{{ buttonLabel }}</BlockLinkButton>
      </div>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  buttonLabel: { type: String, default: '' },
  buttonLink: { type: String, default: '' },
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
.block-infos-pratiques {
  padding: 70px 24px;
}
.infos-inner {
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
}
.infos-title {
  margin: 0;
  font-size: clamp(1.6em, 4vw, 2.2em);
}
.infos-subtitle {
  margin: 12px 0 0;
  opacity: 0.85;
  line-height: 1.6;
}
.infos-grid {
  list-style: none;
  padding: 0;
  margin: 36px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}
.infos-card {
  border-radius: 16px;
  padding: 26px 20px;
  box-shadow: 0 2px 12px rgba(6, 72, 134, 0.08);
}
.infos-icon {
  display: block;
  font-size: 2em;
  margin-bottom: 8px;
}
.infos-label {
  margin: 0 0 6px;
  font-size: 1.1em;
}
.infos-text {
  margin: 0;
  line-height: 1.55;
  white-space: pre-line;
}
.infos-button {
  margin-top: 32px;
}

@media (max-width: 600px) {
  .block-infos-pratiques { padding: 50px 20px; }
}
</style>
