<template>
  <section
    class="block-colonnes"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="col-inner">
      <h2 v-if="title" class="col-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="subtitle" class="col-subtitle" data-field-key="subtitle" :style="fieldFontStyle(fieldFonts, 'subtitle', fieldFontSizes)">{{ subtitle }}</p>
      <div class="col-grid" :style="{ '--col-nombre': nombre }">
        <article v-for="(item, i) in items" :key="i" class="col-item">
          <img v-if="image(item)" :src="image(item)" :alt="item.title || ''" class="col-image" loading="lazy" />
          <h3 v-if="item.title" class="col-item-title">{{ item.title }}</h3>
          <p v-if="item.text" class="col-item-text">{{ item.text }}</p>
          <BlockLinkButton v-if="item.linkLabel" :href="item.link" variant="secondary" :color="buttonColor">{{ item.linkLabel }}</BlockLinkButton>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'
import { sourceSure } from '~/utils/safeLink.js'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  columns: { type: Number, default: 2 },
  items: { type: Array, default: () => [] },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#064886' },
  buttonColor: { type: String, default: '#064886' },
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

// 2 ou 3 colonnes ; au-delà, les éléments passent à la ligne.
const nombre = computed(() => Math.min(3, Math.max(1, Math.round(Number(props.columns)) || 2)))

function image(item) {
  return sourceSure(item?.image)
}
</script>

<style scoped>
.block-colonnes {
  padding: 70px 24px;
}
.col-inner {
  max-width: 1050px;
  margin: 0 auto;
}
.col-title {
  margin: 0;
  text-align: center;
  font-size: clamp(1.6em, 4vw, 2.2em);
}
.col-subtitle {
  margin: 12px 0 0;
  text-align: center;
  opacity: 0.85;
  line-height: 1.6;
}
.col-grid {
  display: grid;
  grid-template-columns: repeat(var(--col-nombre, 2), minmax(0, 1fr));
  gap: 32px;
  margin-top: 36px;
}
.col-item { text-align: left; }
.col-image {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: 14px;
  margin-bottom: 16px;
}
.col-item-title {
  margin: 0 0 8px;
  font-size: 1.25em;
}
.col-item-text {
  margin: 0 0 16px;
  line-height: 1.65;
  white-space: pre-line;
}

@media (max-width: 800px) {
  .col-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
}
@media (max-width: 600px) {
  .block-colonnes { padding: 50px 20px; }
}
</style>
