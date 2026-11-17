<template>
  <PageRenderer :blocks="blocks" page-title="Faire un don" />
</template>

<script setup>
import { lirePageApi } from '~/utils/pageApiCache.js'
import { getDefaultDonsPage, normalizePageBlocks } from '~/utils/blockTypes.js'

usePageSeo({
  title: 'Dons — Église Cieux Ouverts Morlaix',
  description: 'Soutenez l\'Église Cieux Ouverts à Morlaix : faire un don par virement bancaire (IBAN, BIC).',
})

const { isAdminMode, enterAdmin, localBlocks, localBlocksPage } = useAdmin()

// `echecLecture` : distingue « page réellement vide » (defaults légitimes, on
// peut sauvegarder) de « lecture impossible » (defaults de secours, sauvegarder
// écraserait la vraie page). Voir `contenuNonCharge` dans useAdmin.js.
const { data: pageData } = await useAsyncData('page-dons-blocks', async () => {
  try {
    const data = await lirePageApi('/api/pages/dons', { sansCache: isAdminMode.value })
    return {
      blocks: data?.blocks?.length ? normalizePageBlocks('dons', data.blocks) : getDefaultDonsPage(),
      echecLecture: false,
    }
  } catch {
    return { blocks: getDefaultDonsPage(), echecLecture: true }
  }
})

const pageBlocks = computed(() => pageData.value?.blocks ?? [])

const blocks = computed(() => {
  if (isAdminMode.value && localBlocks.value.length && localBlocksPage.value === 'dons') {
    return localBlocks.value
  }
  return pageBlocks.value?.length ? pageBlocks.value : getDefaultDonsPage()
})

function initAdminBlocks() {
  if (!isAdminMode.value) return
  enterAdmin(
    pageBlocks.value?.length ? pageBlocks.value : getDefaultDonsPage(),
    'dons',
    pageData.value?.echecLecture !== true,
  )
}

watch(() => isAdminMode.value, () => {
  initAdminBlocks()
}, { immediate: true })

watch(pageBlocks, () => {
  if (isAdminMode.value) {
    initAdminBlocks()
  }
})
</script>
