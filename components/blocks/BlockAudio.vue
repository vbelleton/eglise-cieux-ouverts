<template>
  <section
    class="block-audio"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="audio-inner">
      <h2 v-if="title" class="audio-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="subtitle" class="audio-subtitle" data-field-key="subtitle" :style="fieldFontStyle(fieldFonts, 'subtitle', fieldFontSizes)">{{ subtitle }}</p>
      <ul class="audio-list">
        <li v-for="(item, i) in items" :key="i" class="audio-card" :style="{ background: cardColor }">
          <h3 v-if="item.title" class="audio-item-title">{{ item.title }}</h3>
          <p v-if="item.speaker || item.date" class="audio-meta">
            <span v-if="item.speaker">{{ item.speaker }}</span>
            <span v-if="item.speaker && item.date" aria-hidden="true"> · </span>
            <span v-if="item.date">{{ item.date }}</span>
          </p>
          <p v-if="item.description" class="audio-desc">{{ item.description }}</p>
          <template v-if="source(item)">
            <audio class="audio-player" controls preload="none" :src="source(item)" :aria-label="item.title || title"></audio>
            <a v-if="downloadText" class="audio-download" :href="source(item)" download rel="noopener" :style="{ color: textColor }">{{ downloadText }}</a>
          </template>
          <p v-else class="audio-empty">{{ emptyText }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'
import { sourceSure } from '~/utils/safeLink.js'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  emptyText: { type: String, default: "L'enregistrement sera bientôt disponible." },
  downloadText: { type: String, default: 'Télécharger' },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#064886' },
  cardColor: { type: String, default: '#f4f8fc' },
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

// Seules les adresses http(s) ou du site sont lues (voir utils/safeLink.js).
function source(item) {
  return sourceSure(item?.audioUrl)
}
</script>

<style scoped>
.block-audio {
  padding: 70px 24px;
}
.audio-inner {
  max-width: 760px;
  margin: 0 auto;
}
.audio-title {
  margin: 0;
  text-align: center;
  font-size: clamp(1.6em, 4vw, 2.2em);
}
.audio-subtitle {
  margin: 12px 0 0;
  text-align: center;
  opacity: 0.85;
  line-height: 1.6;
}
.audio-list {
  list-style: none;
  padding: 0;
  margin: 32px 0 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.audio-card {
  border-radius: 16px;
  padding: 22px 22px 20px;
  box-shadow: 0 2px 12px rgba(6, 72, 134, 0.08);
}
.audio-item-title {
  margin: 0;
  font-size: 1.2em;
}
.audio-meta {
  margin: 4px 0 0;
  font-size: 0.9em;
  opacity: 0.75;
}
.audio-desc {
  margin: 10px 0 0;
  line-height: 1.55;
  white-space: pre-line;
}
.audio-player {
  display: block;
  width: 100%;
  margin-top: 16px;
}
.audio-download {
  display: inline-block;
  margin-top: 10px;
  font-size: 0.9em;
}
.audio-empty {
  margin: 14px 0 0;
  font-style: italic;
  opacity: 0.75;
}

@media (max-width: 600px) {
  .block-audio { padding: 50px 16px; }
}
</style>
