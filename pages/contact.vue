<template>
  <PageRenderer :blocks="blocks" page-title="Nous contacter" />
</template>

<script setup>
import { lirePageApi } from '~/utils/pageApiCache.js'
import { getDefaultContactPage, normalizePageBlocks } from '~/utils/blockTypes.js'

usePageSeo({
  title: 'Contact — Église Cieux Ouverts Morlaix',
  description: 'Contactez l\'Église Cieux Ouverts à Morlaix. 2 rue Jean Monnet, 29600 Morlaix.',
})

const { isAdminMode, enterAdmin, localBlocks, localBlocksPage } = useAdmin()

// `echecLecture` : distingue « page réellement vide » (defaults légitimes, on
// peut sauvegarder) de « lecture impossible » (defaults de secours, sauvegarder
// écraserait la vraie page). Voir `contenuNonCharge` dans useAdmin.js.
const { data: pageData } = await useAsyncData('page-contact-blocks', async () => {
  try {
    const data = await lirePageApi('/api/pages/contact', { sansCache: isAdminMode.value })
    return {
      blocks: data?.blocks?.length ? normalizePageBlocks('contact', data.blocks) : getDefaultContactPage(),
      echecLecture: false,
    }
  } catch {
    return { blocks: getDefaultContactPage(), echecLecture: true }
  }
})

const pageBlocks = computed(() => pageData.value?.blocks ?? [])

const blocks = computed(() => {
  if (isAdminMode.value && localBlocks.value.length && localBlocksPage.value === 'contact') {
    return localBlocks.value
  }
  return pageBlocks.value?.length ? pageBlocks.value : getDefaultContactPage()
})

function initAdminBlocks() {
  if (!isAdminMode.value) return
  enterAdmin(
    pageBlocks.value?.length ? pageBlocks.value : getDefaultContactPage(),
    'contact',
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
