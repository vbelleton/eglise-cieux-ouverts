<template>
  <div class="page-predications">
    <section class="pred-entete">
      <h1 class="pred-titre">Prédications</h1>
      <p class="pred-sous-titre">Retrouvez un message de la chaîne YouTube de l'église</p>

      <form class="pred-recherche" role="search" @submit.prevent>
        <label for="pred-q" class="visually-hidden">Rechercher une prédication</label>
        <input
          id="pred-q"
          v-model="requete"
          type="search"
          placeholder="Thème, livre de la Bible, prédicateur…"
          autocomplete="off"
          enterkeyhint="search"
        />
        <label for="pred-annee" class="visually-hidden">Année</label>
        <select id="pred-annee" v-model="annee">
          <option value="">Toutes les années</option>
          <option v-for="a in annees" :key="a" :value="a">{{ a }}</option>
        </select>
      </form>
    </section>

    <section class="pred-resultats" aria-live="polite">
      <p v-if="pending" class="pred-info">Chargement des vidéos…</p>
      <p v-else-if="error" class="pred-info pred-erreur">
        Les vidéos n'ont pas pu être chargées pour le moment.
        <a :href="URL_CHAINE" target="_blank" rel="noopener">Voir la chaîne YouTube</a>
      </p>
      <template v-else>
        <p class="pred-info">
          {{ resultats.length }} vidéo{{ resultats.length > 1 ? 's' : '' }}
          <template v-if="requete.trim() || annee"> trouvée{{ resultats.length > 1 ? 's' : '' }}</template>
          <template v-if="data && !data.complete"> · seules les 15 dernières vidéos de la chaîne sont consultables ici</template>
        </p>

        <ul class="pred-grille">
          <li v-for="v in affiches" :key="v.id" class="pred-carte">
            <button type="button" class="pred-carte-bouton" @click="ouvrir(v)">
              <span class="pred-vignette">
                <img :src="v.vignette" :alt="''" loading="lazy" width="320" height="180" />
                <span class="pred-play" aria-hidden="true"></span>
              </span>
              <span class="pred-carte-titre">{{ v.titre }}</span>
              <span class="pred-carte-date">{{ formaterDate(v.date) }}</span>
            </button>
          </li>
        </ul>

        <p v-if="!resultats.length" class="pred-info">
          Aucune vidéo ne correspond. Essayez un autre mot ou une autre année.
        </p>
        <div v-if="resultats.length > affiches.length" class="pred-plus">
          <button type="button" class="pred-plus-bouton" @click="limite += PAR_PAGE">
            Voir plus de vidéos
          </button>
        </div>
      </template>
    </section>

    <dialog ref="dialogue" class="pred-dialogue" @close="videoOuverte = null" @cancel.prevent="fermer" @keydown.esc.prevent="fermer" @click.self="fermer">
      <div v-if="videoOuverte" class="pred-dialogue-contenu">
        <!-- autofocus : sinon le focus part dans le lecteur YouTube (iframe),
             qui garde alors la touche Échap et la fenêtre ne se ferme plus. -->
        <button type="button" class="pred-fermer" aria-label="Fermer" autofocus @click="fermer">✕</button>
        <div class="pred-lecteur">
          <iframe
            :src="`https://www.youtube-nocookie.com/embed/${videoOuverte.id}?rel=0&autoplay=1`"
            :title="videoOuverte.titre"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <div class="pred-dialogue-texte">
          <h2>{{ videoOuverte.titre }}</h2>
          <p class="pred-carte-date">{{ formaterDate(videoOuverte.date) }}</p>
          <p v-if="videoOuverte.description" class="pred-description">{{ videoOuverte.description }}</p>
          <div class="pred-dialogue-actions">
            <a :href="`https://www.youtube.com/watch?v=${videoOuverte.id}`" target="_blank" rel="noopener">Ouvrir sur YouTube</a>
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { rechercherVideos, anneesDisponibles } from '~/utils/rechercheVideos.js'

// Page volontairement CACHÉE : absente du menu et du plan du site
// (public/sitemap.xml), non indexée (balise robots ici + en-tête
// X-Robots-Tag dans nuxt.config.ts). On ne la cite pas non plus dans
// robots.txt, qui est public et la révélerait. On y accède par son adresse.
useSeoMeta({
  title: 'Prédications — Église Cieux Ouverts',
  description: 'Rechercher parmi les prédications de l\'Église Cieux Ouverts.',
  robots: 'noindex, nofollow',
})

const URL_CHAINE = 'https://www.youtube.com/@eglisecieuxouverts'
const PAR_PAGE = 24

const route = useRoute()
const router = useRouter()

const requete = ref(typeof route.query.q === 'string' ? route.query.q : '')
const annee = ref(typeof route.query.annee === 'string' ? route.query.annee : '')
const limite = ref(PAR_PAGE)

// Côté client uniquement : la page s'affiche tout de suite, la liste arrive
// ensuite (le premier chargement interroge YouTube, plusieurs secondes
// possibles sur une grosse chaîne).
const { data, pending, error } = useFetch('/api/predications', { server: false, lazy: true })

const videos = computed(() => data.value?.videos || [])
const annees = computed(() => anneesDisponibles(videos.value))
const resultats = computed(() => rechercherVideos(videos.value, requete.value, { annee: annee.value }))
const affiches = computed(() => resultats.value.slice(0, limite.value))

// La recherche est gardée dans l'adresse : on peut partager un lien vers
// « /predications?q=pardon » ou revenir en arrière sans la perdre.
let minuterie = null
watch([requete, annee], () => {
  limite.value = PAR_PAGE
  clearTimeout(minuterie)
  minuterie = setTimeout(() => {
    const query = {}
    if (requete.value.trim()) query.q = requete.value.trim()
    if (annee.value) query.annee = annee.value
    router.replace({ query })
  }, 400)
})

onUnmounted(() => clearTimeout(minuterie))

const formatDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
function formaterDate(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : formatDate.format(d)
}

const dialogue = ref(null)
const videoOuverte = ref(null)
async function ouvrir(v) {
  videoOuverte.value = v
  await nextTick()
  dialogue.value?.showModal?.()
}
function fermer() {
  dialogue.value?.close?.()
  videoOuverte.value = null
}
</script>

<style scoped>
.page-predications {
  min-height: 70vh;
  background: var(--bg-light);
  padding-bottom: 60px;
}

.pred-entete {
  background: var(--gradient-hero);
  color: #fff;
  text-align: center;
  padding: 56px 16px 44px;
}

.pred-titre {
  font-size: clamp(2rem, 5vw, 3rem);
  margin: 0 0 8px;
}

.pred-sous-titre {
  margin: 0 0 28px;
  opacity: 0.9;
}

.pred-recherche {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pred-recherche input,
.pred-recherche select {
  font: inherit;
  font-size: 16px; /* évite le zoom automatique de Safari iOS */
  border: 0;
  border-radius: 999px;
  padding: 14px 20px;
  color: var(--text-dark);
  background: #fff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.pred-recherche input {
  flex: 1 1 280px;
  min-width: 0;
}

.pred-recherche select {
  flex: 0 0 auto;
}

.pred-resultats {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 0;
}

.pred-info {
  color: var(--text-gray);
  text-align: center;
  margin: 8px 0 20px;
}

.pred-erreur a {
  color: var(--primary-blue);
}

.pred-grille {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 22px;
}

.pred-carte-bouton {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  text-align: left;
  font: inherit;
  color: inherit;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.pred-carte-bouton:hover,
.pred-carte-bouton:focus-visible {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(6, 72, 134, 0.15);
}

.pred-vignette {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  background: #111;
}

.pred-vignette img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pred-play {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 54px;
  height: 38px;
  transform: translate(-50%, -50%);
  background: rgba(200, 50, 60, 0.9);
  border-radius: 12px;
}

.pred-play::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-35%, -50%);
  border-style: solid;
  border-width: 8px 0 8px 14px;
  border-color: transparent transparent transparent #fff;
}

.pred-carte-titre {
  display: block;
  padding: 14px 16px 4px;
  font-weight: 700;
  color: var(--text-dark);
  line-height: 1.35;
}

.pred-carte-date {
  display: block;
  padding: 0 16px 14px;
  font-size: 0.9em;
  color: var(--text-gray);
}

.pred-plus {
  text-align: center;
  margin-top: 28px;
}

.pred-plus-bouton {
  font: inherit;
  border: 0;
  border-radius: 999px;
  padding: 12px 24px;
  background: var(--primary-blue);
  color: #fff;
  cursor: pointer;
}

.pred-dialogue {
  width: min(960px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 0;
  border: 0;
  border-radius: 14px;
  overflow: auto;
}

.pred-dialogue::backdrop {
  background: rgba(10, 10, 30, 0.75);
}

.pred-dialogue-contenu {
  position: relative;
}

.pred-fermer {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.pred-lecteur {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
}

.pred-lecteur iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pred-dialogue-texte {
  padding: 18px 20px 20px;
}

.pred-dialogue-texte h2 {
  margin: 0 0 4px;
  font-size: 1.3rem;
}

.pred-dialogue-texte .pred-carte-date {
  padding: 0;
  margin: 0 0 12px;
}

.pred-description {
  white-space: pre-line;
  color: var(--text-gray);
  max-height: 30vh;
  overflow: auto;
  margin: 0 0 16px;
}

.pred-dialogue-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.pred-dialogue-actions a {
  color: var(--primary-blue);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
