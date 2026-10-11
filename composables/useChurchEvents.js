// Composable partagé : charge les événements depuis l'API eglise-app (D1)
// Utilisé par SiteHeader, agenda public et l'admin
// Remplace progressivement l'ancien composable Firebase
// Expansion des récurrences / date de fin : utils/churchEvents.js

import { buildEventList } from '~/utils/churchEvents.js'

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
      const res = await fetch(`${apiUrl}/api/church-events?include_exceptions=1`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const allEvents = await res.json()

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
