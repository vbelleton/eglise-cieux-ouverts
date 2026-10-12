<template>
    <div
        id="app-root"
        :class="{
            'admin-mode': isAdminMode && isMounted,
            'is-preview': isPreviewMode,
            'is-inner-preview': isInnerPreview,
        }"
        :style="{ '--admin-offset': isAdminMode && isMounted && !isInnerPreview ? '48px' : '0px' }"
    >
        <div class="admin-preview-frame" :class="`preview-${previewDevice}`">
            <ClientOnly>
                <AdminToolbar
                    v-if="isMounted && isAdminMode && !isPreviewMode && !isInnerPreview"
                    :page-slug="effectiveSlug"
                    @navigate-preview="onNavigatePreview"
                />
            </ClientOnly>

            <!-- Desktop: inline rendering (blocks editable) -->
            <div v-if="previewDevice === 'desktop' || isInnerPreview" class="page-shell" :class="deviceClass">
                <a v-if="!isAdminMode" href="#contenu" class="skip-link" @click.prevent="allerAuContenu">Aller au contenu</a>
                <SiteHeader />
                <main id="contenu" class="site-main" tabindex="-1">
                    <slot />
                </main>
                <div
                    class="footer-editable-wrap"
                    :class="{ 'admin-selected': editingFooter }"
                    @click.capture="onFooterClick"
                >
                    <BlockFooter
                        v-bind="footerBlock.props"
                        :block-id="footerBlock.id"
                        :data-admin="(isAdminMode && isMounted) || undefined"
                    />
                </div>
            </div>

            <!-- Mobile/tablet: iframe for faithful rendering -->
            <iframe
                v-else-if="isMounted"
                :src="previewIframeSrc"
                :width="deviceWidth"
                class="device-iframe"
                :class="`preview-${previewDevice}`"
                :style="{ width: deviceWidth ? deviceWidth + 'px' : '100%' }"
                title="Aperçu mobile/tablet"
            />
        </div>
        <MenuEditor v-if="isMounted && isAdminMode && !isInnerPreview" />
    </div>
</template>

<script setup>
import { provide, ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import BlockFooter from "~/components/blocks/BlockFooter.vue";

function allerAuContenu() {
    const main = document.getElementById("contenu");
    if (!main) return;
    main.focus({ preventScroll: true });
    main.scrollIntoView({ behavior: "auto", block: "start" });
}

useSeoMeta({
    ogSiteName: "Église Cieux Ouverts — Morlaix",
    ogLocale: "fr_FR",
    ogType: "website",
});

// Données structurées (schema.org « Church ») : permet aux moteurs de
// recherche d'afficher nom, adresse, horaires et réseaux de l'église.
const { socialLinks: reseauxSociaux } = useSiteSettings();
const siteUrl = String(useRuntimeConfig().public.SITE_URL || "").replace(/\/+$/, "");
useHead({
    script: [
        {
            type: "application/ld+json",
            key: "ld-church",
            innerHTML: computed(() =>
                JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Church",
                    name: "Église Cieux Ouverts",
                    url: siteUrl,
                    image: `${siteUrl}/images/activites-celebration.jpg`,
                    telephone: "+33620705496",
                    address: {
                        "@type": "PostalAddress",
                        streetAddress: "2 rue Jean Monnet",
                        postalCode: "29600",
                        addressLocality: "Morlaix",
                        addressCountry: "FR",
                    },
                    openingHoursSpecification: [
                        { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "09:30", closes: "12:00" },
                    ],
                    sameAs: (reseauxSociaux.value || []).map((l) => l.url).filter(Boolean),
                }),
            ),
        },
    ],
});

const {
    isAdminMode,
    enterAdmin,
    exitAdmin,
    previewDevice,
    editingBlockId,
    selectBlock,
    editingFooter,
    footerBlock,
    loadFooterBlock,
    selectFooter,
    localBlocks,
    localBlocksPage,
} = useAdmin();

provide("isAdmin", isAdminMode);
provide("editingBlockId", editingBlockId);
provide("selectBlock", selectBlock);
provide("previewDevice", previewDevice);
provide("isEditor", isAdminMode);
const isMounted = ref(false);
const { loadMenuFromFirestore, saveMenuToFirestore, openMenuEditor } = useMenuEditor();

const route = useRoute();
const router = useRouter();
const currentPageSlug = computed(() => {
    const path = route.path.replace("/", "");
    return path === "" ? "accueil" : path;
});

const isPreviewMode = computed(() => route.query.preview === "true");
const isInnerPreview = computed(() => route.query["preview-inner"] === "1");

const deviceClass = computed(() => {
    if (!isAdminMode.value) return ''
    return `preview-${previewDevice.value}`
})

// Slug used by the iframe (can differ from current page when dropdown changes)
const previewSlug = ref(currentPageSlug.value)

// In tablet/mobile, the "current page" for the admin dropdown is previewSlug (iframe page),
// not the route (which never changes during tablet navigation).
const effectiveSlug = computed(() => {
    return previewDevice.value !== 'desktop' ? previewSlug.value : currentPageSlug.value
})

// Demandes développeur ouvertes sur la page courante — alimente le badge
// 💬 affiché sur chaque bloc concerné (PageRenderer.vue), pour repérer les
// demandes en attente sans avoir à ouvrir chaque bloc.
const commentBlockIds = ref([])
provide("commentBlockIds", commentBlockIds)

async function loadCommentBlockIds(slug) {
    if (!slug) { commentBlockIds.value = []; return }
    try {
        const { $auth } = useNuxtApp()
        const token = await $auth?.currentUser?.getIdToken()
        if (!token) return
        const res = await fetch('/api/comments', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        commentBlockIds.value = (data.comments || [])
            .filter((c) => c.pageSlug === slug && !c.resolved)
            .map((c) => c.blockId)
    } catch {
        commentBlockIds.value = []
    }
}

watch(effectiveSlug, (slug) => { if (isAdminMode.value) loadCommentBlockIds(slug) })
watch(isAdminMode, (val) => { if (val) loadCommentBlockIds(effectiveSlug.value) })

// À la sortie du mode admin SANS navigation (Escape, bouton Quitter), le
// composant de page ne se remonte pas : son useAsyncData garde les blocs
// fetchés au chargement initial, d'AVANT les éditions — l'admin voyait
// l'ancien contenu et croyait ses modifications perdues (d'où des hard
// refresh à répétition). On rafraîchit les données de page à cet instant.
watch(isAdminMode, (val, old) => {
    if (old && !val && import.meta.client) {
        refreshNuxtData().catch((e) => console.warn("refreshNuxtData après sortie admin :", e))
    }
})

// Navigation "aller au bloc" depuis la modale Demandes (?focusBlock=<id>) :
// on attend que les blocs de la page CIBLE soient effectivement chargés
// (localBlocksPage === effectiveSlug) avant de sélectionner/scroller, pour
// ne pas agir sur les blocs de la page qu'on vient de quitter.
watch(
    () => [route.query.focusBlock, localBlocks.value.length, localBlocksPage.value],
    async ([focusId, , loadedSlug]) => {
        if (!focusId || !isAdminMode.value) return
        if (loadedSlug !== effectiveSlug.value) return
        const found = localBlocks.value.find((b) => b.id === focusId)
        if (!found) return
        selectBlock(focusId)
        await nextTick()
        const el = document.querySelector(`[data-block-id="${focusId}"]`)
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
        const q = { ...route.query }
        delete q.focusBlock
        router.replace({ query: q }).catch(() => {})
    },
    { immediate: true }
)

const previewIframeSrc = computed(() => {
    const path = previewSlug.value === "accueil" ? "/" : `/${previewSlug.value}`
    const params = new URLSearchParams({
        "preview-inner": "1",
        device: previewDevice.value,
    })
    return path + "?" + params.toString()
})

const deviceWidth = computed(() => {
    if (previewDevice.value === "mobile") return "375"
    if (previewDevice.value === "tablet") return "768"
    return ""
})

function onNavigatePreview(slug) {
    previewSlug.value = slug
}

// Sync parent's localBlocks with the preview page's blocks (needed for sidebar in iframe mode)
async function syncPreviewBlocks(slug, device) {
    if (import.meta.server || device === 'desktop') return
    try {
        const res = await fetch(`/api/pages/${slug}`)
        if (res.ok) {
            const data = await res.json()
            enterAdmin(data.blocks || [], slug)
        }
    } catch (e) {
        console.warn('Failed to sync blocks for preview:', e)
    }
}

watch(previewSlug, async (slug) => {
    await syncPreviewBlocks(slug, previewDevice.value)
})

watch(previewDevice, async (device, prevDevice) => {
    if (device !== 'desktop' && prevDevice === 'desktop') {
        // Only reset previewSlug when entering non-desktop FROM desktop.
        // Switching between tablet and mobile keeps the current iframe page.
        previewSlug.value = currentPageSlug.value
    }
    if (device === 'desktop' && prevDevice && prevDevice !== 'desktop' && previewSlug.value !== currentPageSlug.value) {
        // Retour en desktop après avoir navigué DANS la préview (dropdown ou
        // lien de l'iframe) : sans ceci, l'admin était silencieusement ramené
        // à la page d'origine (la route ne change pas pendant la navigation
        // iframe) — dropdown et page se "désynchronisaient" de sa position
        // réelle. On reporte la navigation de préview vers la vraie route.
        const path = previewSlug.value === 'accueil' ? '/' : `/${previewSlug.value}`
        const q = { ...route.query, admin: 'true' }
        delete q.device
        router.push({ path, query: q }).catch(() => {})
    }
    await syncPreviewBlocks(previewSlug.value, device)
})

// Keep previewSlug in sync when navigating in desktop mode (router.push).
watch(currentPageSlug, (slug) => {
    if (previewDevice.value === 'desktop') previewSlug.value = slug
})

async function waitForAuth() {
    if (import.meta.server || !import.meta.client) return null;
    const { $auth } = useNuxtApp();
    if (!$auth?.onAuthStateChanged) return null;
    // Si l'état d'auth est déjà connu de façon synchrone (currentUser déjà
    // résolu), le retourner directement plutôt que d'enregistrer un nouveau
    // listener : cette fonction est appelée depuis 4 endroits différents,
    // chacun créant sa propre souscription onAuthStateChanged. Firebase peut
    // notifier des souscriptions enregistrées à des instants légèrement
    // différents avec des snapshots différents pendant la résolution initiale
    // — ça provoquait un aller-retour /admin ↔ page cible (chaque appel de
    // waitForAuth() concluant différemment), avec des montages/démontages de
    // page concurrents qui corrompaient l'état interne de Vue (crash
    // "Cannot destructure property of null"). currentUser reflète l'état
    // déjà résolu par n'importe quel appel précédent à onAuthStateChanged.
    if ($auth.currentUser !== undefined && $auth.currentUser !== null) {
        return $auth.currentUser;
    }
    return await new Promise((resolve) => {
        const unsubscribe = $auth.onAuthStateChanged((user) => {
            resolve(user);
            if (typeof unsubscribe === "function") unsubscribe();
        });
    });
}

async function redirectToLogin() {
    if (import.meta.server) return;
    const router = useRouter();
    const fullPath = useRoute().fullPath;
    await router.replace(
        "/admin?redirect=" + encodeURIComponent(fullPath),
    );
}

watch(
    isAdminMode,
    (val) => {
        if (val && import.meta.client) {
            loadMenuFromFirestore();
        }
    },
    { immediate: true },
);

watch(
    () => route.query.admin,
    async (val) => {
        if (import.meta.server) return;
        if (val === "true" && !isAdminMode.value && !isPreviewMode.value && !isInnerPreview.value) {
            const user = await waitForAuth();
            if (user) {
                isAdminMode.value = true;
            } else {
                redirectToLogin();
            }
        } else if (val !== "true" && isAdminMode.value) {
            exitAdmin();
        }
    },
);

// In iframe (preview-inner): activate admin mode without toolbar
watch(
    () => route.query["preview-inner"],
    async (val) => {
        if (import.meta.server) return;
        if (val === "1" && !isAdminMode.value) {
            const user = await waitForAuth();
            if (user) {
                isAdminMode.value = true;
            }
        }
    },
);

watch(isAdminMode, (val) => {
    if (val && !isMounted.value) return;
    if (val && route.query.admin !== "true" && !isInnerPreview.value) {
        exitAdmin();
    }
});



const onEscape = (e) => {
    if (e.key === "Escape" && isAdminMode.value && !isInnerPreview.value) {
        exitAdmin();
        useRouter()
            .replace({ query: {} })
            .catch((e) => console.warn("layouts/default: router.replace failed", e));
    }
};
onMounted(() => {
    isMounted.value = true;
    document.addEventListener("keydown", onEscape);

    if (route.query.admin === "true" && !isPreviewMode.value && !isInnerPreview.value) {
        waitForAuth().then((user) => {
            if (user) {
                isAdminMode.value = true;
            } else {
                redirectToLogin();
            }
        });
    }
    if (route.query["preview-inner"] === "1") {
        waitForAuth().then((user) => {
            if (user) isAdminMode.value = true;
        });
        // Force scroll to top so page content starts at viewport top
        window.scrollTo(0, 0)
        try { history.scrollRestoration = 'manual' } catch (e) {}
        // Intercept link clicks to forward navigation to parent
        function onPreviewLinkClick(e) {
            let el = e.target
            while (el && el.tagName !== 'A') el = el.parentElement
            if (!el) return
            if (el.closest('.burger')) return
            const href = el.getAttribute('href')
            if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
            e.preventDefault()
            const path = href.startsWith('/') ? href : '/' + href
            const slug = path === '/' ? 'accueil' : path.replace(/^\//, '')
            try { window.parent.postMessage({ type: 'navigate', slug }, '*') } catch (e) { console.warn(e) }
        }
        document.addEventListener('click', onPreviewLinkClick, true)
        onUnmounted(() => document.removeEventListener('click', onPreviewLinkClick, true))
    }
    if (["mobile", "tablet", "desktop"].includes(route.query.device)) {
        previewDevice.value = route.query.device;
    }
    loadFooterBlock();
    loadMenuFromFirestore();

    // Listen for messages from preview iframe
    function onIframeMessage(e) {
        if (!isAdminMode.value || isInnerPreview.value) return
        if (e.data?.type === "block-click") {
            selectBlock(e.data.blockId)
        } else if (e.data?.type === "navigate") {
            onNavigatePreview(e.data.slug)
        } else if (e.data?.type === "open-menu-editor") {
            openMenuEditor()
        }
    }
    window.addEventListener("message", onIframeMessage)
    onUnmounted(() => {
        window.removeEventListener("message", onIframeMessage)
    })
});
onUnmounted(() => {
    document.removeEventListener("keydown", onEscape);
});

function onFooterClick(e) {
    if (!isAdminMode.value || !isMounted.value) return;
    e.stopPropagation();
    selectFooter();
}
</script>

<style>
#app-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: transparent;
    color: var(--text-dark);
}
#app-root.admin-mode {
    background: #f5f5f5;
}
#app-root.admin-mode .site-header {
    top: var(--admin-offset, 48px);
}
/* .site-main { flex: 1 } (assets/css/main.css) colle le footer en bas de
   viewport sur une page courte — comportement "sticky footer" voulu côté
   site public, mais qui laisse un grand espace vide avant le footer en
   admin (particulièrement visible sur une page vide/en cours de création).
   Désactivé uniquement en mode admin : le footer suit directement le
   dernier bloc, quelle que soit la longueur de la page. */
#app-root.admin-mode .site-main {
    flex: none;
}
#app-root.is-preview {
    background: #f5f5f5;
}
#app-root.is-preview .site-header {
    top: 0;
}
#app-root.is-inner-preview {
    background: white;
}
.admin-preview-frame {
    margin: 0 auto;
    width: 100%;
    transition: max-width 0.3s ease;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}
.page-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}
.admin-preview-frame.preview-tablet {
    max-width: 768px;
    box-shadow: 0 0 0 1px #ddd, 0 4px 24px rgba(0,0,0,0.1);
    border-radius: 12px;
    overflow: hidden;
    margin-top: 48px;
    margin-bottom: 12px;
}
.admin-preview-frame.preview-mobile {
    max-width: 375px;
    box-shadow: 0 0 0 1px #ddd, 0 4px 24px rgba(0,0,0,0.1);
    border-radius: 12px;
    overflow: hidden;
    margin-top: 48px;
    margin-bottom: 12px;
}
.admin-preview-frame.preview-tablet,
.admin-preview-frame.preview-mobile {
    background: white;
}
/* In iframe preview (preview-inner=1) suppress all admin overlays */
#app-root.is-inner-preview .admin-sidebar-overlay,
#app-root.is-inner-preview .admin-sidebar,
#app-root.is-inner-preview .admin-toolbar {
    display: none !important;
}
.device-iframe {
    width: 100%;
    height: calc(100vh - 48px - 12px);
    border: none;
    display: block;
    background: white;
}
.footer-editable-wrap {
    position: relative;
    outline: 2px solid transparent;
    outline-offset: -2px;
    transition: outline-color 0.2s;
}
.footer-editable-wrap.admin-selected {
    outline-color: #3b82f6;
}
#app-root.admin-mode .footer-editable-wrap {
    cursor: pointer;
}
#app-root.admin-mode .footer-editable-wrap:hover {
    outline-color: rgba(59, 130, 246, 0.4);
}
</style>
