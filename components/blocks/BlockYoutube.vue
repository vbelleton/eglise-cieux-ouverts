<template>
  <section
    class="block-youtube"
    :style="{ background: backgroundColor }"
    :class="[visibilityClasses, containerAnim.animClass, { triggered: containerAnim.triggered.value }]"
  >
    <div class="youtube-inner">
      <div class="youtube-player" v-if="videoId && hasValidId" :ref="containerAnim.setRef">
        <!-- Public : une image légère + bouton. Le vrai lecteur YouTube pèse
             ~1 Mo de JavaScript et mettait plusieurs secondes à apparaître
             (cadre blanc) ; il ne se charge qu'au clic. L'admin garde le lecteur. -->
        <button
          v-if="!adminMode && !lecteurActif"
          type="button"
          class="youtube-facade"
          :aria-label="`Lire la vidéo : ${title || 'Vidéo'}`"
          :style="{ backgroundImage: `url(${vignetteUrl})` }"
          @click="lecteurActif = true"
        >
          <span class="youtube-play" aria-hidden="true"></span>
        </button>
        <!-- Sans JavaScript le bouton ne peut pas charger le lecteur : ce lien,
             posé par-dessus (no-js.css), ouvre la vidéo sur YouTube. -->
        <a
          v-if="!adminMode && !lecteurActif"
          class="facade-lien-sans-js nojs-only"
          :href="`https://www.youtube.com/watch?v=${extractedId}`"
          target="_blank"
          rel="noopener"
        >{{ lienYoutubeText }}</a>
        <iframe
          v-else
          :src="embedUrl"
          :title="title || 'Video'"
          width="100%"
          height="100%"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <div v-else class="youtube-placeholder" :ref="containerAnim.setRef">
        <p class="placeholder-text">{{ placeholderText }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useAnimatedElements } from '~/composables/useAnimatedElements'

const props = defineProps({
  videoId: { type: String, default: '' },
  title: { type: String, default: '' },
  backgroundColor: { type: String, default: '#ffffff' },
  animation: { type: String, default: 'fadeIn' },
  visibility: { type: Object, default: () => ({}) },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
})

const adminMode = inject('isAdmin', ref(false))
const lecteurActif = ref(false)

const { addElement, blockStates } = useAnimatedElements(props.blockId)
const containerAnim = addElement('container', { animation: props.animation || 'fadeIn', delay: 0 })

const visibilityClasses = computed(() => ({
  'hide-mobile': props.visibility?.mobile === false,
  'hide-tablet': props.visibility?.tablet === false,
  'hide-desktop': props.visibility?.desktop === false,
}))

// Accepte un ID brut ou une URL YouTube complète collée par erreur
// (youtube.com/watch?v=, youtu.be/, youtube.com/embed/, etc.)
const extractedId = computed(() => {
  const raw = (props.videoId || '').trim()
  if (!raw) return ''
  const match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : raw
})

const hasValidId = computed(() => extractedId.value.length > 0)

const embedUrl = computed(() => {
  // youtube-nocookie : pas de cookie déposé avant la lecture. autoplay : le
  // visiteur vient de cliquer sur le bouton, la vidéo démarre tout de suite.
  const auto = !adminMode.value && lecteurActif.value ? '&autoplay=1' : ''
  return `https://www.youtube-nocookie.com/embed/${extractedId.value}?rel=0${auto}`
})

const vignetteUrl = computed(() => `https://i.ytimg.com/vi/${extractedId.value}/hqdefault.jpg`)

const placeholderText = 'Aucune vidéo configurée. En mode éditeur, entrez l\'ID YouTube.'
const lienYoutubeText = 'Voir la vidéo sur YouTube'
</script>

<style scoped>
.block-youtube {
  width: 100%;
  padding: 60px 24px;
}

.youtube-inner {
  max-width: 900px;
  margin: 0 auto;
}

.youtube-player {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  background: white;
}

.youtube-player iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.youtube-facade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  cursor: pointer;
  background-color: #111;
  background-size: cover;
  background-position: center;
}

.youtube-play {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 68px;
  height: 48px;
  transform: translate(-50%, -50%);
  background: rgba(200, 50, 60, 0.92);
  border-radius: 14px;
  transition: background 0.2s;
}
.youtube-play::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-35%, -50%);
  border-style: solid;
  border-width: 10px 0 10px 18px;
  border-color: transparent transparent transparent #fff;
}
.youtube-facade:hover .youtube-play,
.youtube-facade:focus-visible .youtube-play {
  background: #c8323c;
}

.youtube-placeholder {
  aspect-ratio: 16 / 3;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.placeholder-text {
  color: #888;
  font-size: 0.9em;
  text-align: center;
  padding: 20px;
}

</style>
