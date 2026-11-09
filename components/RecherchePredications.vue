<template>
  <section class="rp" aria-labelledby="rp-titre">
    <div class="rp-entete">
      <p class="rp-surtitre">Prédications</p>
      <h1 id="rp-titre" class="rp-titre">Retrouver un message</h1>
      <p class="rp-sous-titre">Cherchez parmi les vidéos de la chaîne YouTube de l'église.</p>

      <form class="rp-recherche" role="search" @submit.prevent="validerRecherche">
        <label for="rp-q" class="rp-masque">Rechercher une prédication</label>
        <span class="rp-loupe" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </span>
        <input
          id="rp-q"
          ref="champ"
          v-model="requete"
          type="search"
          placeholder="Thème, livre, prédicateur…"
          autocomplete="off"
          enterkeyhint="search"
        />
        <button v-if="requete" type="button" class="rp-effacer" aria-label="Effacer la recherche" @click="effacerRequete">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </form>

      <div v-if="etat === 'ok' && annees.length > 1" class="rp-annees" role="group" aria-label="Filtrer par année">
        <button type="button" class="rp-puce" :aria-pressed="!annee" @click="annee = ''">Toutes</button>
        <button
          v-for="a in annees"
          :key="a"
          type="button"
          class="rp-puce"
          :aria-pressed="annee === a"
          @click="annee = annee === a ? '' : a"
        >{{ a }}</button>
      </div>
    </div>

    <div class="rp-corps" aria-live="polite" :aria-busy="etat === 'chargement'">
      <!-- Chargement : des cartes fantômes plutôt qu'une phrase seule, pour
           que la page ne paraisse pas figée. -->
      <template v-if="etat === 'chargement'">
        <!-- Sans JavaScript, la recherche ne peut pas fonctionner : au lieu
             d'un chargement sans fin, on renvoie vers la chaîne YouTube
             (classe no-js posée sur <html> tant que JS n'a pas tourné). -->
        <div class="rp-sans-js rp-vide">
          <p class="rp-vide-titre">La recherche n'est pas disponible sur ce navigateur.</p>
          <p>Toutes les prédications restent consultables sur la chaîne YouTube de l'église.</p>
          <a class="rp-bouton" :href="URL_CHAINE" target="_blank" rel="noopener">Voir les vidéos sur YouTube</a>
        </div>
        <p class="rp-statut rp-avec-js">Chargement des vidéos…</p>
        <ul class="rp-grille rp-avec-js" aria-hidden="true">
          <li v-for="n in 6" :key="n" class="rp-carte rp-fantome">
            <span class="rp-vignette"></span>
            <span class="rp-ligne"></span>
            <span class="rp-ligne rp-ligne-courte"></span>
          </li>
        </ul>
      </template>

      <div v-else-if="etat === 'erreur'" class="rp-erreur" role="alert">
        <p class="rp-erreur-titre">Les vidéos n'ont pas pu être chargées.</p>
        <p class="rp-erreur-texte">YouTube n'a pas répondu à temps ou a refusé la demande. Vous pouvez réessayer, ou retrouver les vidéos directement sur la chaîne.</p>
        <div class="rp-erreur-actions">
          <button type="button" class="rp-bouton" @click="charger">Réessayer</button>
          <a class="rp-lien" :href="URL_CHAINE" target="_blank" rel="noopener">Ouvrir la chaîne YouTube</a>
        </div>
        <p v-if="detailErreur" class="rp-erreur-detail">Détail technique : {{ detailErreur }}</p>
      </div>

      <template v-else>
        <p class="rp-statut">
          <template v-if="filtreActif">
            <strong>{{ resultats.length }}</strong> résultat{{ resultats.length > 1 ? 's' : '' }}
            <template v-if="requete.trim()"> pour « {{ requete.trim() }} »</template>
            <template v-if="annee"> en {{ annee }}</template>
          </template>
          <template v-else>
            <strong>{{ videos.length }}</strong> vidéo{{ videos.length > 1 ? 's' : '' }}, de la plus récente à la plus ancienne
          </template>
        </p>
        <p v-if="liste && !liste.complete" class="rp-avertissement">
          Seules les 15 dernières vidéos de la chaîne sont consultables ici pour le moment.
        </p>

        <ul v-if="resultats.length" class="rp-grille">
          <li v-for="v in affiches" :key="v.id" class="rp-carte">
            <button type="button" class="rp-carte-bouton" @click="ouvrir(v)">
              <span class="rp-vignette">
                <img :src="v.vignette" alt="" loading="lazy" width="320" height="180" />
                <span class="rp-play" aria-hidden="true"></span>
              </span>
              <span class="rp-carte-texte">
                <span class="rp-carte-date">{{ formaterDate(v.date) }}</span>
                <span class="rp-carte-titre"><template v-for="(m, i) in surligner(v.titre, requete)" :key="i"><mark v-if="m.trouve">{{ m.texte }}</mark><template v-else>{{ m.texte }}</template></template></span>
              </span>
            </button>
          </li>
        </ul>

        <div v-else class="rp-vide">
          <p class="rp-vide-titre">Aucune vidéo ne correspond.</p>
          <p>Essayez un autre mot, moins de mots, ou une autre année.</p>
          <button type="button" class="rp-bouton rp-bouton-clair" @click="toutEffacer">Effacer la recherche</button>
        </div>

        <div v-if="resultats.length > affiches.length" class="rp-plus">
          <button type="button" class="rp-bouton" @click="limite += PAR_PAGE">
            Voir plus ({{ resultats.length - affiches.length }} restantes)
          </button>
        </div>
      </template>
    </div>

    <dialog ref="dialogue" class="rp-dialogue" @close="videoOuverte = null" @cancel.prevent="fermer" @keydown.esc.prevent="fermer" @click.self="fermer">
      <div v-if="videoOuverte" class="rp-dialogue-contenu">
        <!-- autofocus : sinon le focus part dans le lecteur YouTube (iframe),
             qui garde alors la touche Échap et la fenêtre ne se ferme plus. -->
        <button type="button" class="rp-fermer" aria-label="Fermer" autofocus @click="fermer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div class="rp-lecteur">
          <iframe
            :src="`https://www.youtube-nocookie.com/embed/${videoOuverte.id}?rel=0&autoplay=1`"
            :title="videoOuverte.titre"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <div class="rp-dialogue-texte">
          <p class="rp-carte-date">{{ formaterDate(videoOuverte.date) }}</p>
          <h2>{{ videoOuverte.titre }}</h2>
          <p v-if="videoOuverte.description" class="rp-description">{{ videoOuverte.description }}</p>
          <a class="rp-lien" :href="`https://www.youtube.com/watch?v=${videoOuverte.id}`" target="_blank" rel="noopener">Ouvrir sur YouTube</a>
        </div>
      </div>
    </dialog>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { rechercherVideos, anneesDisponibles, surligner } from '~/utils/rechercheVideos.js'

// Recherche cachée des prédications, affichée en tête de /messages quand
// l'adresse contient `?recherche` (pages/messages.vue). Rien ne la signale
// ailleurs sur le site.

const URL_CHAINE = 'https://www.youtube.com/@eglisecieuxouverts'
const PAR_PAGE = 24
// Au-delà, on affiche l'erreur et « Réessayer » plutôt qu'un chargement sans
// fin. Le premier appel interroge YouTube (plusieurs pages pour une grosse
// chaîne) : on laisse de la marge.
const DELAI_MS = 25000

const route = useRoute()
const router = useRouter()

const requete = ref(typeof route.query.q === 'string' ? route.query.q : '')
const annee = ref(typeof route.query.annee === 'string' ? route.query.annee : '')
const limite = ref(PAR_PAGE)

const etat = ref('chargement')
const liste = ref(null)
const detailErreur = ref('')

async function charger() {
  etat.value = 'chargement'
  detailErreur.value = ''
  try {
    // retry: 0 — un échec s'affiche tout de suite avec « Réessayer », sans
    // doubler l'attente en relançant en silence.
    liste.value = await $fetch('/api/predications', { timeout: DELAI_MS, retry: 0 })
    etat.value = 'ok'
  } catch (err) {
    detailErreur.value = String(err?.data?.message || err?.message || '').slice(0, 300)
    etat.value = 'erreur'
  }
}
onMounted(charger)

const videos = computed(() => liste.value?.videos || [])
const annees = computed(() => anneesDisponibles(videos.value))
const resultats = computed(() => rechercherVideos(videos.value, requete.value, { annee: annee.value }))
const affiches = computed(() => resultats.value.slice(0, limite.value))
const filtreActif = computed(() => Boolean(requete.value.trim() || annee.value))

// La recherche est gardée dans l'adresse (?recherche&q=…&annee=…) : on peut
// partager un lien vers une recherche ou revenir en arrière sans la perdre.
let minuterie = null
watch([requete, annee], () => {
  limite.value = PAR_PAGE
  clearTimeout(minuterie)
  minuterie = setTimeout(() => {
    const query = { ...route.query, recherche: null }
    delete query.q
    delete query.annee
    if (requete.value.trim()) query.q = requete.value.trim()
    if (annee.value) query.annee = annee.value
    router.replace({ query })
  }, 400)
})
onUnmounted(() => clearTimeout(minuterie))

const champ = ref(null)
function effacerRequete() {
  requete.value = ''
  champ.value?.focus()
}
function toutEffacer() {
  requete.value = ''
  annee.value = ''
}
function validerRecherche() {
  // Sur téléphone, « Rechercher » du clavier : on le ferme pour montrer les résultats.
  champ.value?.blur()
}

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
.rp {
  background: var(--bg-light);
  padding: 0 0 56px;
}

.rp-entete {
  background: linear-gradient(180deg, #eef3f9 0%, var(--bg-light) 100%);
  text-align: center;
  padding: 48px 16px 8px;
}

.rp-surtitre {
  margin: 0 0 6px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--primary-pink);
}

.rp-titre {
  margin: 0 0 8px;
  font-size: clamp(1.9rem, 5vw, 2.8rem);
  color: var(--primary-blue);
}

.rp-sous-titre {
  margin: 0 auto 24px;
  max-width: 520px;
  color: var(--text-gray);
}

.rp-recherche {
  position: relative;
  max-width: 640px;
  margin: 0 auto;
}

.rp-recherche input {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 17px; /* ≥ 16 px : évite le zoom automatique de Safari iOS */
  padding: 16px 48px 16px 50px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: #fff;
  color: var(--text-dark);
  box-shadow: 0 8px 28px rgba(6, 72, 134, 0.12);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  -webkit-appearance: none;
  appearance: none;
}

.rp-recherche input::-webkit-search-cancel-button {
  display: none;
}

.rp-recherche input:focus {
  border-color: var(--primary-blue);
  box-shadow: 0 8px 28px rgba(6, 72, 134, 0.2);
}

.rp-loupe {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--primary-blue);
  display: flex;
  pointer-events: none;
}

.rp-effacer {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: #eef1f6;
  color: var(--text-gray);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rp-annees {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  max-width: 720px;
  margin: 18px auto 0;
}

.rp-puce {
  font: inherit;
  font-size: 0.9rem;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: #fff;
  color: var(--text-dark);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.rp-puce[aria-pressed="true"] {
  background: var(--primary-blue);
  border-color: var(--primary-blue);
  color: #fff;
}

.rp-corps {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 0;
}

.rp-statut {
  text-align: center;
  color: var(--text-gray);
  margin: 4px 0 20px;
}

.rp-statut strong {
  color: var(--text-dark);
}

.rp-avertissement {
  max-width: 560px;
  margin: -8px auto 20px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fff7e6;
  color: #7a5200;
  font-size: 0.9rem;
  text-align: center;
}

.rp-grille {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
}

.rp-carte-bouton {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.rp-carte-bouton:hover,
.rp-carte-bouton:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(6, 72, 134, 0.16);
}

.rp-vignette {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  background: #e9edf3;
  overflow: hidden;
}

.rp-vignette img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s;
}

.rp-carte-bouton:hover .rp-vignette img {
  transform: scale(1.04);
}

.rp-play {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 56px;
  height: 56px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s;
}

.rp-play::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-35%, -50%);
  border-style: solid;
  border-width: 10px 0 10px 16px;
  border-color: transparent transparent transparent var(--primary-blue);
}

.rp-carte-bouton:hover .rp-play {
  transform: translate(-50%, -50%) scale(1.08);
}

.rp-carte-texte {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px 18px;
}

.rp-carte-date {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--primary-pink);
}

.rp-carte-titre {
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-dark);
}

.rp-carte-titre mark {
  background: rgba(217, 119, 119, 0.22);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
}

/* Cartes fantômes pendant le chargement */
.rp-fantome {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  overflow: hidden;
  padding-bottom: 18px;
}

.rp-fantome .rp-vignette,
.rp-ligne {
  background: linear-gradient(90deg, #eceff4 0%, #f6f8fb 50%, #eceff4 100%);
  background-size: 200% 100%;
  animation: rp-reflet 1.3s ease-in-out infinite;
}

.rp-ligne {
  display: block;
  height: 14px;
  margin: 16px 16px 0;
  border-radius: 7px;
}

.rp-ligne-courte {
  width: 45%;
  margin-top: 10px;
}

@keyframes rp-reflet {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .rp-fantome .rp-vignette,
  .rp-ligne {
    animation: none;
  }
}

.rp-erreur,
.rp-vide {
  max-width: 560px;
  margin: 8px auto 0;
  padding: 28px 24px;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  text-align: center;
  color: var(--text-gray);
}

.rp-erreur-titre,
.rp-vide-titre {
  margin: 0 0 8px;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-dark);
}

.rp-erreur-texte {
  margin: 0 0 18px;
}

.rp-erreur-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.rp-erreur-detail {
  margin: 18px 0 0;
  font-size: 0.78rem;
  color: var(--text-light);
  word-break: break-word;
}

.rp-bouton {
  font: inherit;
  font-weight: 600;
  border: 0;
  border-radius: 999px;
  padding: 12px 26px;
  background: var(--primary-blue);
  color: #fff;
  cursor: pointer;
}

.rp-bouton-clair {
  background: #eef3f9;
  color: var(--primary-blue);
  margin-top: 8px;
}

.rp-lien {
  color: var(--primary-blue);
  font-weight: 600;
}

.rp-plus {
  text-align: center;
  margin-top: 32px;
}

.rp-dialogue {
  width: min(960px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  padding: 0;
  border: 0;
  border-radius: 16px;
  overflow: auto;
}

.rp-dialogue::backdrop {
  background: rgba(10, 14, 30, 0.8);
}

.rp-dialogue-contenu {
  position: relative;
}

.rp-fermer {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rp-lecteur {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
}

.rp-lecteur iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.rp-dialogue-texte {
  padding: 18px 22px 22px;
}

.rp-dialogue-texte h2 {
  margin: 4px 0 10px;
  font-size: 1.3rem;
  color: var(--text-dark);
}

.rp-description {
  white-space: pre-line;
  color: var(--text-gray);
  max-height: 28vh;
  overflow: auto;
  margin: 0 0 14px;
}

/* Repli sans JavaScript : <html class="no-js"> (nuxt.config.ts) */
.rp-sans-js {
  display: none;
}

:global(.no-js .rp-sans-js) {
  display: block;
}

:global(.no-js .rp-avec-js),
:global(.no-js .rp-recherche),
:global(.no-js .rp-sous-titre) {
  display: none;
}

.rp-sans-js .rp-bouton {
  display: inline-block;
  margin-top: 8px;
  text-decoration: none;
}

.rp-masque {
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

@media (max-width: 600px) {
  .rp-entete {
    padding-top: 32px;
  }
  .rp-annees {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .rp-puce {
    flex: 0 0 auto;
  }
  .rp-grille {
    gap: 16px;
  }
}
</style>
