// Composable partagé : charge les événements depuis l'API eglise-app (D1)
// Utilisé par SiteHeader, agenda public et l'admin
// Remplace progressivement l'ancien composable Firebase
// Expansion des récurrences / date de fin : utils/churchEvents.js

import { buildEventList } from '~/utils/churchEvents.js'

// Plusieurs composants montés ensemble demandent la même liste (en-tête du
// site pour le lien « Événements » + la page agenda) : sans partage, /agenda
// faisait deux appels identiques au Worker à chaque chargement. On partage la
// requête EN COURS ; une fois terminée, la suivante repart de zéro, donc
// `refresh()` et chaque navigation obtiennent toujours des données fraîches.
let enCours = null
function chargerListe(url, timeoutMs) {
  if (enCours && enCours.url === url) return enCours.promesse
  const promesse = fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .finally(() => { if (enCours && enCours.promesse === promesse) enCours = null })
  enCours = { url, promesse }
  return promesse
}

export function useChurchEvents(options = {}) {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl || 'https://eglise-app.belletonv.workers.dev'

  const evenements = ref([])
  const loading = ref(true)
  // Distinct de `evenements.length === 0` : une liste vide parce que l'API n'a
  // pas répondu n'est pas un agenda vide. Sans cette distinction, une panne
  // passagère du Worker faisait disparaître la page Événements
  // (pages/event-list.vue la masque quand aucun événement n'est publié).
  const erreur = ref(false)
  const futureOnly = options.futureOnly !== false

  // Le Worker événements est un service tiers : sans délai maximal, un amont
  // qui ne répond plus (sans refuser la connexion) laisse `loading` à true
  // indéfiniment — l'agenda reste bloqué sur « Chargement » et aucun `catch`
  // ne se déclenche jamais.
  const TIMEOUT_MS = 8000

  async function loadEvenements() {
    loading.value = true
    erreur.value = false
    try {
      const allEvents = await chargerListe(`${apiUrl}/api/church-events?include_exceptions=1&size=100`, TIMEOUT_MS)

      evenements.value = buildEventList(allEvents, { futureOnly })
    } catch (e) {
      console.error('useChurchEvents:', e)
      evenements.value = []
      erreur.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    loadEvenements()
  })

  const hasEvenements = computed(() => evenements.value.length > 0)

  return { evenements, loading, erreur, hasEvenements, refresh: loadEvenements }
}
