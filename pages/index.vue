<template>
    <div>
        <PageRenderer :blocks="blocks" page-title="Église Cieux Ouverts, Morlaix" />
    </div>
</template>

<script setup>
import { lirePageApi } from "~/utils/pageApiCache.js";
import { getDefaultHomePage } from "~/utils/blockTypes.js";

usePageSeo({
    title: "Église Cieux Ouverts — Morlaix",
    description:
        "Bienvenue à l'Église Cieux Ouverts à Morlaix. Découvrez nos événements, cultes et activités.",
    path: "/",
});

const { isAdminMode, enterAdmin, localBlocks, localBlocksPage } = useAdmin();

// Fetch blocks from API, fallback to getDefaultHomePage if empty.
// The handler runs ONCE during SSR (result serialized to payload),
// so server and client always get the same data → no key mismatch.
//
// `echecLecture` fait partie de la charge utile et non d'un ref à part : le
// handler s'exécute au SSR et seul ce qu'il RENVOIE est sérialisé vers le
// client. Distinguer « page réellement vide » (defaults légitimes, on peut
// sauvegarder) de « lecture impossible » (defaults de secours, sauvegarder
// écraserait la vraie page) — voir `contenuNonCharge` dans useAdmin.js.
const { data: pageData } = await useAsyncData("page-accueil-blocks", async () => {
    try {
        const data = await lirePageApi("/api/pages/accueil", { sansCache: isAdminMode.value });
        return {
            blocks: data?.blocks?.length ? data.blocks : getDefaultHomePage(),
            echecLecture: false,
        };
    } catch {
        return { blocks: getDefaultHomePage(), echecLecture: true };
    }
});

const pageBlocks = computed(() => pageData.value?.blocks ?? []);

const blocks = computed(() => {
    if (
        isAdminMode.value &&
        localBlocks.value.length &&
        localBlocksPage.value === "accueil"
    ) {
        return localBlocks.value;
    }
    return pageBlocks.value?.length ? pageBlocks.value : getDefaultHomePage();
});

function initAdminBlocks() {
    if (!isAdminMode.value) return;
    const contenuCharge = pageData.value?.echecLecture !== true;
    if (pageBlocks.value?.length) {
        enterAdmin(pageBlocks.value, "accueil", contenuCharge);
    } else {
        enterAdmin(getDefaultHomePage(), "accueil", contenuCharge);
    }
}

// Watch admin mode changes (initial load + toggling)
watch(
    () => isAdminMode.value,
    () => {
        initAdminBlocks();
    },
    { immediate: true },
);

// Also watch pageBlocks to catch late-arriving data after client-side navigation
watch(pageBlocks, () => {
    if (isAdminMode.value) {
        initAdminBlocks();
    }
});
</script>
