<template>
  <section
    class="block-evenements"
    :class="[visibilityClasses, animClass]"
    :style="{ background: backgroundColor, color: textColor }"
  >
    <div class="evts-inner">
      <h2 v-if="title" class="evts-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
      <p v-if="subtitle" class="evts-subtitle" data-field-key="subtitle" :style="fieldFontStyle(fieldFonts, 'subtitle', fieldFontSizes)">{{ subtitle }}</p>

      <!-- Les événements viennent du Worker eglise-app, chargés côté client
           (useChurchEvents, onMounted) : au rendu serveur on affiche le
           squelette, jamais « aucun événement ». -->
      <div v-if="loading" class="evts-grid" aria-busy="true">
        <div v-for="n in Math.min(maxItems, 3)" :key="n" class="evt-card evt-skeleton" />
      </div>
      <p v-else-if="erreur" class="evts-msg">Les événements n'ont pas pu être chargés. Réessayez dans un instant.</p>
      <p v-else-if="!liste.length" class="evts-msg" data-field-key="emptyText" :style="fieldFontStyle(fieldFonts, 'emptyText', fieldFontSizes)">{{ emptyText }}</p>
      <div v-else class="evts-grid">
        <article v-for="evt in liste" :key="`${evt.id}-${evt.date.getTime()}`" class="evt-card">
          <div class="evt-visuel">
            <img v-if="evt.images?.length" :src="evt.images[0]" :alt="evt.titre" loading="lazy" class="evt-img" />
            <div v-else class="evt-img evt-img-vide" aria-hidden="true">{{ evt.emoji || '📅' }}</div>
            <div class="evt-date">
              <span class="evt-jour">{{ evt.date.getDate() }}</span>
              <span class="evt-mois">{{ mois(evt.date) }}</span>
            </div>
          </div>
          <div class="evt-corps">
            <h3 class="evt-titre">{{ evt.titre }}</h3>
            <p class="evt-meta">
              <span>📅 {{ dateLongue(evt) }}</span>
              <span v-if="evt.heure">🕙 {{ evt.heure }}<template v-if="evt.fin"> – {{ evt.fin }}</template></span>
              <span v-if="evt.lieu">📍 {{ evt.lieu }}</span>
            </p>
            <span v-if="evt.repeat_period" class="evt-regulier">Rendez-vous régulier</span>
            <div v-if="evt.lien || evt.billetterie" class="evt-liens">
              <a v-if="evt.billetterie" :href="evt.billetterie" target="_blank" rel="noopener" class="evt-btn">🎟️ Réserver</a>
              <a v-if="evt.lien" :href="evt.lien" target="_blank" rel="noopener" class="evt-btn evt-btn-sec">En savoir plus</a>
            </div>
          </div>
        </article>
      </div>

      <div v-if="showAgendaLink" class="evts-agenda">
        <NuxtLink to="/agenda" class="evt-btn evt-btn-sec">Voir tout l'agenda</NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { fieldFontStyle } from '~/utils/fonts.js'

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  filter: { type: String, default: 'tous' },
  maxItems: { type: Number, default: 6 },
  emptyText: { type: String, default: '' },
  showAgendaLink: { type: Boolean, default: true },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#064886' },
  animation: { type: String, default: 'fadeIn' },
  isTriggered: { type: Boolean, default: false },
  blockId: { type: String, default: '' },
  visibility: { type: Object, default: () => ({}) },
  fieldFonts: { type: Object, default: () => ({}) },
  fieldFontSizes: { type: Object, default: () => ({}) },
})

const { evenements, loading, erreur } = useChurchEvents()

// Un événement récurrent n'apparaît qu'une fois (sa prochaine date) : sans
// ça, le culte hebdomadaire occuperait à lui seul toutes les places.
const liste = computed(() => {
  const vus = new Set()
  const out = []
  for (const evt of evenements.value) {
    if (props.filter === 'ponctuels' && evt.repeat_period) continue
    if (props.filter === 'reguliers' && !evt.repeat_period) continue
    if (vus.has(evt.id)) continue
    vus.add(evt.id)
    out.push(evt)
    if (out.length >= Math.max(1, props.maxItems || 6)) break
  }
  return out
})

function mois(d) {
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
}

function dateLongue(evt) {
  const opts = { weekday: 'long', day: 'numeric', month: 'long' }
  const debut = evt.date.toLocaleDateString('fr-FR', opts)
  if (!evt.dateFin) return debut
  return `du ${debut} au ${evt.dateFin.toLocaleDateString('fr-FR', opts)}`
}

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
.block-evenements { container-type: inline-size; padding: 70px 24px; }
.evts-inner { max-width: 1100px; margin: 0 auto; }
.evts-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-style: italic;
  font-size: clamp(1.6em, 4vw, 2.4em);
  text-align: center;
  margin: 0 0 12px;
}
.evts-subtitle { text-align: center; opacity: 0.8; margin: 0 0 36px; }
.evts-msg { text-align: center; opacity: 0.8; padding: 24px 0; }
.evts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.evt-card {
  background: #fff;
  color: #1a1a2e;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(6, 72, 134, 0.1);
  display: flex;
  flex-direction: column;
}
.evt-skeleton { min-height: 280px; background: linear-gradient(90deg, #eef2f8 25%, #f6f8fc 50%, #eef2f8 75%); background-size: 200% 100%; animation: evt-shimmer 1.4s infinite; }
@keyframes evt-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.evt-visuel { position: relative; }
.evt-img { width: 100%; height: 170px; object-fit: cover; display: block; }
.evt-img-vide { display: flex; align-items: center; justify-content: center; font-size: 3em; background: #ebf0fa; }
.evt-date {
  position: absolute; top: 12px; left: 12px;
  background: #fff; color: #064886;
  border-radius: 10px; padding: 6px 10px;
  display: flex; flex-direction: column; align-items: center; line-height: 1.1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.evt-jour { font-size: 1.4em; font-weight: 700; }
.evt-mois { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; }
.evt-corps { padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.evt-titre { margin: 0; font-size: 1.15em; color: #064886; }
.evt-meta { margin: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.9em; opacity: 0.85; }
.evt-meta span:first-child { text-transform: capitalize; }
.evt-regulier { align-self: flex-start; font-size: 0.75em; background: #eef4fa; color: #064886; padding: 3px 10px; border-radius: 999px; }
.evt-liens { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; }
.evt-btn {
  display: inline-block; padding: 9px 18px; border-radius: 999px;
  background: #EF4B54; color: #fff; text-decoration: none; font-weight: 600; font-size: 0.9em;
}
.evt-btn-sec { background: transparent; color: #064886; border: 2px solid #064886; }
.evts-agenda { text-align: center; margin-top: 36px; }

@container (max-width: 900px) { .evts-grid { grid-template-columns: repeat(2, 1fr); } }
@container (max-width: 600px) {
  .block-evenements { padding: 50px 20px; }
  .evts-grid { grid-template-columns: 1fr; }
}
</style>
