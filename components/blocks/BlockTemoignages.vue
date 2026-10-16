<template>
  <section
    class="block-temoignages"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="tem-inner">
      <h2 v-if="title" class="tem-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <div class="tem-carousel">
        <button
          v-if="items.length > 1"
          type="button"
          class="tem-arrow tem-arrow-prev"
          :aria-label="prevLabel"
          :style="{ color: textColor }"
          @click="aller(-1)"
        >‹</button>
        <div ref="piste" class="tem-track" tabindex="0" role="group" :aria-label="title || slideLabel" @scroll.passive="majPosition">
          <figure v-for="(item, i) in items" :key="i" class="tem-slide" :style="{ background: cardColor }">
            <blockquote v-if="item.quote" class="tem-quote">{{ item.quote }}</blockquote>
            <figcaption class="tem-author">
              <img v-if="photo(item)" :src="photo(item)" :alt="item.name || slideLabel" class="tem-photo" loading="lazy" />
              <span v-else-if="item.name" class="tem-photo tem-photo-initiale" aria-hidden="true">{{ initiale(item.name) }}</span>
              <span class="tem-author-text">
                <span v-if="item.name" class="tem-name">{{ item.name }}</span>
                <span v-if="item.role" class="tem-role">{{ item.role }}</span>
              </span>
            </figcaption>
          </figure>
        </div>
        <button
          v-if="items.length > 1"
          type="button"
          class="tem-arrow tem-arrow-next"
          :aria-label="nextLabel"
          :style="{ color: textColor }"
          @click="aller(1)"
        >›</button>
      </div>
      <div v-if="items.length > 1" class="tem-dots">
        <button
          v-for="(item, i) in items"
          :key="i"
          type="button"
          class="tem-dot"
          :class="{ 'tem-dot-actif': i === position }"
          :aria-label="`${slideLabel} ${i + 1}`"
          :aria-current="i === position ? 'true' : undefined"
          :style="{ background: textColor }"
          @click="allerA(i)"
        ></button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { fieldFontStyle } from '~/utils/fonts.js'
import { sourceSure } from '~/utils/safeLink.js'

const props = defineProps({
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  prevLabel: { type: String, default: 'Témoignage précédent' },
  nextLabel: { type: String, default: 'Témoignage suivant' },
  slideLabel: { type: String, default: 'Témoignage' },
  backgroundColor: { type: String, default: '#f4f8fc' },
  textColor: { type: String, default: '#064886' },
  cardColor: { type: String, default: '#ffffff' },
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

// Carrousel à défilement natif (scroll-snap) : il se manie au doigt, à la
// molette et au clavier sans script ; les flèches et les points ne font que
// déplacer la piste.
const piste = ref(null)
const position = ref(0)

function photo(item) {
  return sourceSure(item?.photo)
}

function initiale(nom) {
  return String(nom || '').trim().charAt(0).toUpperCase()
}

function majPosition() {
  const el = piste.value
  if (!el || !el.clientWidth) return
  position.value = Math.max(0, Math.min(props.items.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
}

function allerA(i) {
  const el = piste.value
  if (!el) return
  el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
}

function aller(delta) {
  const n = props.items.length
  if (!n) return
  allerA((position.value + delta + n) % n)
}
</script>

<style scoped>
.block-temoignages {
  padding: 70px 24px;
}
.tem-inner {
  max-width: 820px;
  margin: 0 auto;
  text-align: center;
}
.tem-title {
  margin: 0 0 32px;
  font-size: clamp(1.6em, 4vw, 2.2em);
}
.tem-carousel {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tem-track {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  border-radius: 18px;
}
.tem-track::-webkit-scrollbar { display: none; }
.tem-track:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
.tem-slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
  box-sizing: border-box;
  margin: 0;
  padding: 36px 32px;
  border-radius: 18px;
  box-shadow: 0 2px 14px rgba(6, 72, 134, 0.1);
}
.tem-quote {
  margin: 0;
  font-family: Georgia, serif;
  font-style: italic;
  font-size: clamp(1.1em, 2.6vw, 1.4em);
  line-height: 1.6;
  white-space: pre-line;
}
.tem-author {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 24px;
  text-align: left;
}
.tem-photo {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.tem-photo-initiale {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #5a9fcf;
  color: #fff;
  font-weight: 700;
  font-size: 1.3em;
}
.tem-author-text { display: flex; flex-direction: column; }
.tem-name { font-weight: 700; }
.tem-role { font-size: 0.9em; opacity: 0.75; }
.tem-arrow {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid currentColor;
  background: transparent;
  font-size: 1.6em;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
}
.tem-arrow:hover { opacity: 1; }
.tem-dots {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}
.tem-dot {
  width: 10px;
  height: 10px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.25;
}
.tem-dot-actif { opacity: 0.9; }

@media (max-width: 600px) {
  .block-temoignages { padding: 50px 16px; }
  .tem-slide { padding: 28px 20px; }
  .tem-arrow { display: none; }
}
</style>
