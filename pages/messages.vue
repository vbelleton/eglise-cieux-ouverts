<template>
  <PageRenderer :blocks="blocks" page-title="Nos messages" />
</template>

<script setup>
import { getDefaultMessagesPage, normalizePageBlocks } from '~/utils/blockTypes.js'

usePageSeo({
  title: 'Messages — Église Cieux Ouverts Morlaix',
  description: 'Retrouvez les messages et prédications de l\'Église Cieux Ouverts à Morlaix : vidéos des derniers messages et chaîne YouTube.',
})

const { isAdminMode, enterAdmin, localBlocks, localBlocksPage } = useAdmin()

// `echecLecture` : distingue « page réellement vide » (defaults légitimes, on
// peut sauvegarder) de « lecture impossible » (defaults de secours, sauvegarder
// écraserait la vraie page). Voir `contenuNonCharge` dans useAdmin.js.
const { data: pageData } = await useAsyncData('page-messages-blocks', async () => {
  try {
    const data = await $fetch('/api/pages/messages')
    return {
      blocks: data?.blocks?.length ? normalizePageBlocks('messages', data.blocks) : getDefaultMessagesPage(),
      echecLecture: false,
    }
  } catch {
    return { blocks: getDefaultMessagesPage(), echecLecture: true }
  }
})

const pageBlocks = computed(() => pageData.value?.blocks ?? [])

const blocks = computed(() => {
  if (isAdminMode.value && localBlocks.value.length && localBlocksPage.value === 'messages') {
    return localBlocks.value
  }
  return pageBlocks.value?.length ? pageBlocks.value : getDefaultMessagesPage()
})

function initAdminBlocks() {
  if (!isAdminMode.value) return
  enterAdmin(
    pageBlocks.value?.length ? pageBlocks.value : getDefaultMessagesPage(),
    'messages',
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
