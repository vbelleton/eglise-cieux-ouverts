<template>
  <section
    class="block-icon-grid"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor }"
  >
    <div class="block-icon-grid-inner">
      <h2 v-if="title" class="block-icon-grid-title" data-field-key="title" :style="{ color: titleColor, ...fieldFontStyle(fieldFonts, 'title', fieldFontSizes) }">{{ title }}</h2>
      <div class="block-icon-grid-list" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
        <div
          v-for="(item, i) in items"
          :key="i"
          class="block-icon-grid-card"
          :style="{ background: cardBackgroundColor }"
        >
          <div v-if="item.icon" class="block-icon-grid-icon" :style="{ background: iconBackgroundColor }">
            <img :src="item.icon" :alt="item.title" loading="lazy" />
          </div>
          <h3 v-if="item.title" class="block-icon-grid-card-title" :style="{ color: titleColor }">{{ item.title }}</h3>
          <p v-if="item.description" class="block-icon-grid-card-desc" :style="{ color: textColor }">{{ item.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  isTriggered: { type: Boolean, default: false },
  'is-admin': { type: Boolean, default: false },
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  columns: { type: [String, Number], default: 2 },
  backgroundColor: { type: String, default: '#ffffff' },
  cardBackgroundColor: { type: String, default: '#F2F2F2' },
  iconBackgroundColor: { type: String, default: '#1A4C8B' },
  titleColor: { type: String, default: '#1A4C8B' },
  textColor: { type: String, default: '#4A4A4A' },
  animation: { type: String, default: 'fadeIn' },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility?.mobile === false,
  'hide-tablet': props.visibility?.tablet === false,
  'hide-desktop': props.visibility?.desktop === false,
}))

const animClass = computed(() => {
  if (!props.animation || props.animation === 'none') return ''
  return `block-anim-${props.animation} ${props.isTriggered ? 'triggered' : ''}`
})
</script>

<style scoped>
.block-icon-grid {
  padding: 80px 24px;
  container-type: inline-size;
}

.block-icon-grid-inner {
  max-width: 1000px;
  margin: 0 auto;
}

.block-icon-grid-title {
  font-family: 'Inter', 'Montserrat', sans-serif;
  font-style: normal;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: clamp(1.5em, 3vw, 1.9em);
  font-weight: 800;
  margin: 0 0 48px;
}

.block-icon-grid-list {
  display: grid;
  gap: 28px;
}

.block-icon-grid-card {
  border-radius: 16px;
  padding: 32px 28px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease;
}

.block-icon-grid-card:hover {
  transform: scale(1.02);
}

.block-icon-grid-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 22px;
}

.block-icon-grid-icon img {
  width: 43px;
  height: 43px;
  object-fit: contain;
}

.block-icon-grid-card-title {
  font-family: 'Inter', 'Montserrat', sans-serif;
  font-style: normal;
  text-transform: uppercase;
  font-size: 1.05em;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.4;
  margin: 0;
}

.block-icon-grid-card-desc {
  font-family: 'Inter', 'Montserrat', sans-serif;
  font-size: 0.92em;
  line-height: 1.6;
  margin: 10px 0 0;
}

@container (max-width: 700px) {
  .block-icon-grid-list {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 768px) {
  .block-icon-grid {
    padding: 56px 20px;
  }
}
</style>
