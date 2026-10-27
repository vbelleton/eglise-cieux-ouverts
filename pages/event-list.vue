<template>
  <PageRenderer :blocks="blocks" page-title="Événements" />
</template>

<script setup>
import { lirePageApi } from '~/utils/pageApiCache.js'
import { computed, watch } from 'vue'
import { getDefaultBilletteriePage, normalizePageBlocks } from '~/utils/blockTypes.js'

usePageSeo({
  title: 'Événements — Église Cieux Ouverts Morlaix',
  description: 'Prochains événements de l\'Église Cieux Ouverts à Morlaix et inscription au Parcours Alpha.',
})

const { isAdminMode, enterAdmin, localBlocks, localBlocksPage } = useAdmin()

// Masquer la page si aucun événement à venir n'est publié (option admin),
// sauf en mode admin où elle reste accessible pour la gestion du contenu.
const { data: settingsData } = await useFetch('/api/settings')
const hideIfEmpty = computed(() => settingsData.value?.hideEventsPageIfEmpty === true)
const { hasEvenements, loading: eventsLoading, erreur: eventsErreur } = useChurchEvents()

watch([isAdminMode, hideIfEmpty, hasEvenements, eventsLoading, eventsErreur], () => {
  if (isAdminMode.value || eventsLoading.value) return
  // Ne jamais masquer la page sur une ERREUR de chargement : « aucun événement
  // publié » et « le Worker événements n'a pas répondu » donnent la même liste
  // vide, mais seul le premier cas justifie de retirer la page du site. Sans
  // cette distinction, une panne passagère de l'amont faisait disparaître
  // Événements, sans que rien ne le signale.
  if (eventsErreur.value) return
  if (hideIfEmpty.value && !hasEvenements.value) {
    // navigateTo (pas router.push) : sur un premier chargement direct de
    // /event-list, useChurchEvents() ne résout (onMounted, client-only)
    // qu'après hydratation — ce watcher peut donc se déclencher une seule
    // fois post-hydratation, en plein contexte Nuxt. router.push() y
    // fonctionne, mais navigateTo() est la primitive Nuxt correcte ici
    // (gère aussi le cas SSR si jamais ce timing venait à changer).
    navigateTo('/')
  }
}, { immediate: true })

// On utilise useFetch au lieu de useLazyFetch pour que les données
// soient sérialisées dans le payload Nuxt et disponibles côté client
// après hydratation. useLazyFetch ne sérialise pas les données, ce qui
// empêche les mocks de fonctionner dans les tests Playwright admin.
// `error` de useFetch sert ici de signal d'échec de LECTURE : sans lui, une
// lecture ratée donne `pageData = null`, la page se rabat sur ses defaults, et
// en admin l'auto-save les écrirait par-dessus le vrai contenu. Voir
// `contenuNonCharge` dans useAdmin.js.
const { data: pageData, error: pageError } = await useAsyncData('page-event-list', () =>
  lirePageApi('/api/pages/event-list', { sansCache: isAdminMode.value }),
)

// normalizePageBlocks : la page jamais éditée (ancien bloc par défaut,
// sauvegardé tel quel) passe sur le contenu par défaut actuel — voir
// upgradeLegacyBilletterie() dans utils/blockTypes.js.
const savedBlocks = computed(() =>
  pageData.value?.blocks?.length ? normalizePageBlocks('event-list', pageData.value.blocks) : [],
)

const blocks = computed(() => {
  if (isAdminMode.value && localBlocks.value.length && localBlocksPage.value === 'event-list') {
    return localBlocks.value
  }
  if (savedBlocks.value.length) {
    return savedBlocks.value
  }
  return getDefaultBilletteriePage()
})

function initAdminBlocks() {
  if (!isAdminMode.value) return
  const contenuCharge = !pageError.value
  if (savedBlocks.value.length) {
    enterAdmin(savedBlocks.value, 'event-list', contenuCharge)
  } else {
    enterAdmin(getDefaultBilletteriePage(), 'event-list', contenuCharge)
  }
}

watch(() => isAdminMode.value, initAdminBlocks, { immediate: true })
watch(pageData, () => {
  if (isAdminMode.value) initAdminBlocks()
})
</script>
