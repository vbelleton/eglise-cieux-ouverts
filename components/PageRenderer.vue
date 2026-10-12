<template>
    <div v-if="isAdmin && isMounted" class="page-renderer admin-mode" :class="{ 'bee-positioning-active': !!positioningElementId }">
        <VueDraggable
            v-model="draggableModel"
            handle=".drag-handle"
            ghost-class="block-ghost"
            :animation="200"
            :force-fallback="true"
            tag="div"
            :style="{ minHeight: '40px' }"
        >
        <div
            v-for="block in visibleBlocks"
            :key="block.id"
            class="block-wrapper"
            :class="[
                getAnimClass(block),
                getAnimControlClass(block),
                visibilityClass(block),
                { triggered: isTriggered(block.id) },
                { 'anim-rejeu': isApercu(block.id) },
                { 'admin-selected': isSelected(block) },
                { 'bee-positioning-active': block.props?.extraElements?.some((e) => e.id === positioningElementId) },
            ]"
            :style="wrapperStyle(block)"
            :ref="(el) => setWrapperRef(el, block.id)"
            :data-block-id="block.id"
            :data-block-type="block.type"
            tabindex="0"
            @click.capture="wrapperClick(block.id, $event)"
            @keydown.enter.prevent="wrapperClick(block.id)"
        >
            <span class="drag-handle">⠿</span>
            <BlockRenderer
                :block="block"
                :is-triggered="isTriggered(block.id)"
                :is-admin="true"
            />
            <BlockExtraElementsCanvas
                v-if="block.props?.extraElements?.length"
                :elements="block.props.extraElements"
                :is-admin="true"
                :is-triggered="isTriggered(block.id)"
                :selected-id="selectedElementId"
                :positioning-id="positioningElementId"
                @select="onExtraElementSelected"
                @update:elements="updateBlock(block.id, { extraElements: $event })"
                @stop-positioning="stopPositioning"
            />
            <span v-if="!getAnimClass(block) && getAnimationStrategy(block.type) !== 'wrapper'" class="anim-native-badge">
                {{ getAnimationStrategy(block.type) === 'none' ? 'Aucune animation' : 'Animation native' }}
            </span>
            <span v-if="hasOpenComment(block)" class="dev-comment-badge" title="Demande développeur en attente">💬</span>
        </div>
    </VueDraggable>
    </div>
    <div v-else class="page-renderer" :class="{ 'admin-mode': isAdmin && isMounted }">
        <h1 v-if="pageTitle && !pageHasH1" class="sr-only">{{ pageTitle }}</h1>
        <div
            v-for="block in visibleBlocks"
            :key="block.id"
            class="block-wrapper"
            :class="[
                getAnimClass(block),
                getAnimControlClass(block),
                visibilityClass(block),
                { triggered: isTriggered(block.id) },
                { 'anim-rejeu': isApercu(block.id) },
                { 'admin-selected': isAdmin && isSelected(block) },
            ]"
            :style="wrapperStyle(block)"
            :ref="(el) => setWrapperRef(el, block.id)"
            :data-block-id="block.id"
            :data-block-type="block.type"
            @click.capture="wrapperClick(block.id, $event)"
        >
            <BlockRenderer
                :block="block"
                :is-triggered="isTriggered(block.id)"
                :is-admin="isAdmin || undefined"
            />
            <BlockExtraElementsCanvas
                v-if="block.props?.extraElements?.length"
                :elements="block.props.extraElements"
                :is-admin="isAdmin || undefined"
                :is-triggered="isTriggered(block.id)"
                :selected-id="selectedElementId"
                :positioning-id="positioningElementId"
                @select="onExtraElementSelected"
                @update:elements="updateBlock(block.id, { extraElements: $event })"
                @stop-positioning="stopPositioning"
            />
            <span v-if="isAdmin && !getAnimClass(block) && getAnimationStrategy(block.type) !== 'wrapper'" class="anim-native-badge">
                {{ getAnimationStrategy(block.type) === 'none' ? 'Aucune animation' : 'Animation native' }}
            </span>
            <span v-if="isAdmin && hasOpenComment(block)" class="dev-comment-badge" title="Demande développeur en attente">💬</span>
        </div>
    </div>
</template>

<script lang="ts" setup>
import {
    ref,
    computed,
    watch,
    nextTick,
    inject,
    onMounted,
    onUnmounted,
} from "vue";
import {
    normalizeBlock,
    getAnimClass,
    getAnimControlClass,
    getAnimationStrategy,
    filterByVisibility,
    resolveResponsive,
    shouldUseTrigger,
} from "~/lib/blocks/renderer";
import { useBlockAnimation } from "~/composables/useBlockAnimation";
import { useAdmin } from "~/composables/useAdmin";
import { useRoute } from "#app";
import { VueDraggable } from 'vue-draggable-plus';

const isAdmin = inject("isAdmin", ref(false));
const isEditor = inject("isEditor", ref(false));
const editingBlockId = inject("editingBlockId", ref(null));
const selectBlock = inject<(id: string) => void>("selectBlock", () => {});
const previewDevice = inject("previewDevice", ref("desktop"));
const commentBlockIds = inject<any>("commentBlockIds", ref([]));

function hasOpenComment(block: any) {
    return commentBlockIds.value?.includes(block.id);
}

// In iframe preview mode, forward block clicks to parent
function onBlockSelected(id) {
    selectBlock(id)
    try {
        if (typeof window !== 'undefined' && window.top !== window.self) {
            window.parent.postMessage({ type: 'block-click', blockId: id }, '*')
        }
    } catch (e) {
        console.warn("PageRenderer: postMessage failed", e)
    }
}

// SSR detection: return true on server when ?admin=true, false on client initially
const isServer = typeof window === "undefined" || !import.meta.client;
const route = useRoute();
const isServerAdmin = computed(() => {
    // On client, the value comes from isAdmin injection (via URL param check in plugin)
    // On server, we check the route for testing purposes
    if (isServer && route?.query?.admin === "true") return true;
    if (isServer) return false;
    return isAdmin.value;
});

const props = defineProps({
    blocks: { type: Array, default: () => [] },
    // Titre principal de la page (h1) pour les lecteurs d'écran, quand aucun
    // bloc n'en affiche un (le héros n'a qu'un logo, par exemple).
    pageTitle: { type: String, default: "" },
});

const pageHasH1 = computed(() =>
    (props.blocks || []).some((b) => {
        const p = b?.props || {};
        if (b?.type === "hero") return Boolean(p.overlayText);
        return typeof p.content === "string" && /<h1[\s>]/i.test(p.content);
    }),
);

// selectedElementId / positioningElementId / activeFieldKey : partagés avec
// le panneau sidebar (composables/useAdmin.js) pour garder la sélection, le
// mode positionnement et le champ identifié par clic synchronisés.
const { reorderBlocks, updateBlock, selectedElementId, positioningElementId, stopPositioning, activeFieldKey, identifySeq } = useAdmin();

// Sur un premier chargement admin (bascule SSR public -> admin post-
// hydratation), la transition de page Nuxt (page-enter-from/page-enter-
// active) reste bloquée en plein vol (opacity:0 + transform) : le
// `transitionend` qu'elle attend ne se déclenche jamais dans ce cas précis.
// Chrome expose ces transitions CSS comme de vraies Animation (Web
// Animations API), ce qui les fait gagner sur n'importe quelle règle CSS
// même !important — impossible à corriger en pur CSS. On l'annule
// explicitement dès qu'on entre en mode positionnement, où le contenu est
// de toute façon censé être pleinement visible.
watch(positioningElementId, (id) => {
    if (!id) return;
    nextTick(() => {
        const pageEl = document.querySelector(".page-renderer");
        if (pageEl) {
            pageEl.getAnimations?.().forEach((a) => a.cancel());
            pageEl.classList.remove("page-enter-from", "page-enter-active", "page-leave-active", "page-leave-to");
        }
        // Même souci pour l'animation d'entrée du bloc lui-même
        // (.block-anim-portal etc.) : si elle est restée bloquée en plein
        // vol, l'annuler laisse la cascade CSS normale reprendre la main —
        // la classe .triggered (déjà posée) redonne alors l'état final
        // correct (opacity:1) sans qu'on ait besoin d'y toucher.
        document.querySelectorAll(".block-wrapper.bee-positioning-active").forEach((el) => {
            el.getAnimations?.().forEach((a) => a.cancel());
        });
    });
});

// Sélectionner un élément additionnel (canvas ou sidebar) efface le champ
// fixe éventuellement identifié par un clic précédent — évite un surlignage
// obsolète dans AutoEditor.vue une fois qu'on édite un élément libre.
function onExtraElementSelected(id) {
    selectedElementId.value = id
    activeFieldKey.value = null
    identifySeq.value++
}

// Cherche l'ancêtre [data-field-key] le plus proche du point de clic : les
// composants de bloc (components/blocks/Block*.vue) taguent leurs champs
// promouvables (image/texte/richtext fixes) avec cet attribut pour que le
// clic identifie précisément quel champ ouvrir/surligner dans la sidebar
// (AutoEditor.vue), plutôt que de juste sélectionner le bloc entier.
function resolveFieldKey(target) {
    const el = target?.closest?.("[data-field-key]");
    return el ? el.getAttribute("data-field-key") : null;
}

// Applique le nouvel ordre des blocs VISIBLES à la liste complète : les blocs
// masqués (par device) gardent leur position, les visibles prennent l'ordre
// issu du drag.
function applyVisibleOrder(newVisibleOrder) {
    if (!Array.isArray(newVisibleOrder) || !newVisibleOrder.length) return
    const visibleIds = new Set(visibleBlocks.value.map((b) => b.id))
    const queue = [...newVisibleOrder]
    const merged = fixedBlocks.value.map((b) =>
        visibleIds.has(b.id) ? (queue.shift() ?? b) : b,
    )
    reorderBlocks(merged)
}

const {
    triggeredBlocks,
    isTriggered,
    isApercu,
    setWrapperRef,
    setup,
    handleBlocksChange,
    handleAnimationChange,
    setupClient,
    teardownClient,
} = useBlockAnimation(isAdmin, isServerAdmin);

const isMounted = ref(false);
const adminModeActive = computed(() =>
    Boolean(isAdmin && (isMounted.value || isServer)),
);

const useTrigger = shouldUseTrigger;

// Active device for resolving per-device overrides.
// - In admin/editor: follows the chosen previewDevice.
// - On the public site: follows the real viewport, but only after mount so the
//   first client render matches the SSR (desktop) output (no hydration mismatch).
const viewportDevice = ref("desktop");
function computeViewportDevice() {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w <= 480) return "mobile";
    if (w <= 1024) return "tablet";
    return "desktop";
}
const activeDevice = computed(() => {
    if (isAdmin && isAdmin.value) return previewDevice.value || "desktop";
    return isMounted.value ? viewportDevice.value : "desktop";
});

type Device = "desktop" | "tablet" | "mobile";

const fixedBlocks = computed(() => {
    return (props.blocks || [])
        .map(normalizeBlock)
        .map((b) => resolveResponsive(b, activeDevice.value as Device));
});

const visibleBlocks = computed(() => {
    return filterByVisibility(
        fixedBlocks.value,
        (previewDevice.value || "desktop") as Device,
    );
});

// v-model réel : c'est le flux prévu par vue-draggable-plus — Sortable
// déplace le nœud DOM puis émet le tableau ré-ordonné via le setter. Un
// setter no-op + ré-ordonnancement custom dans @update faisait re-rendre
// à Vue un v-for keyé sur un DOM déjà muté hors de son contrôle → erreurs
// de réconciliation intermittentes (nextSibling/insertBefore sur null).
const draggableModel = computed({
    get: () => visibleBlocks.value,
    set: (newOrder) => applyVisibleOrder(newOrder),
});

function visibilityClass(block) {
    const v = block?.visibility || {};
    return {
        "hide-mobile": v.mobile === false,
        "hide-tablet": v.tablet === false,
        "hide-desktop": v.desktop === false,
    };
}

// Position / emplacement applied at the wrapper level (works for every block
// type, and reflects per-device overrides since props are already resolved).
function wrapperStyle(block) {
    const p = block?.props || {};
    const s: Record<string, string> = {};
    if (p.maxWidth) s.maxWidth = p.maxWidth;
    if (p.blockAlign === "center") {
        s.marginLeft = "auto";
        s.marginRight = "auto";
    } else if (p.blockAlign === "right") {
        s.marginLeft = "auto";
        s.marginRight = "0";
    } else if (p.blockAlign === "left") {
        s.marginLeft = "0";
        s.marginRight = "auto";
    }
    if (p.marginTop) s.marginTop = p.marginTop;
    if (p.marginBottom) s.marginBottom = p.marginBottom;
    // Réglage générique de hauteur minimale, disponible pour tout type de
    // bloc (panneau "Hauteur du bloc" dans la sidebar, hors schema par bloc)
    if (p.minHeight) s.minHeight = typeof p.minHeight === "number" ? `${p.minHeight}px` : p.minHeight;
    return s;
}

// Local reactive selected id (mirrors injected editingBlockId ref)
const selectedId = ref(null);
watch(
    editingBlockId,
    (v) => {
        if (selectedId.value !== v) {
            selectedId.value = v;
        }
    },
    { immediate: true },
);

// Call setup synchronously during component setup (safe for lifecycle hooks).
try {
    setup(props.blocks || []);
} catch (e) {
    if (typeof window !== "undefined")
        console.warn("PageRenderer: setup failed", e);
}

if (typeof window !== "undefined" && import.meta.client) {
    isMounted.value = true;
} else {
    // On server: isMounted stays false, server output is placeholder only.
}

// Admin floating replay buttons for registered animated elements
function setupElementReplayButtons() {
    if (!isAdmin || !isAdmin.value) return
    const container = document.createElement('div')
    container.id = 'anim-replay-container'
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
    document.body.appendChild(container)

    function positionButtons() {
        container.innerHTML = ''
        const animEls = document.querySelectorAll('[data-anim-key]')
        animEls.forEach((el) => {
            const rect = el.getBoundingClientRect()
            if (rect.width === 0) return
            const key = el.getAttribute('data-anim-key') || ''
            const btn = document.createElement('button')
            btn.textContent = '▶'
            btn.title = 'Rejouer l\'animation'
            btn.dataset.animKey = key
            btn.style.cssText = [
                'position:fixed',
                `top:${rect.top + 4}px`,
                `left:${rect.right + 4}px`,
                'width:24px',
                'height:24px',
                'border:none',
                'border-radius:50%',
                'background:rgba(0,0,0,0.45)',
                'color:#fff',
                'font-size:11px',
                'cursor:pointer',
                'pointer-events:auto',
                'opacity:0',
                'transition:opacity 0.15s',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'line-height:1',
                'z-index:10000',
            ].join(';')

            // Show on hover over the animated element
            el.addEventListener('mouseenter', () => { btn.style.opacity = '1' }, { once: false })
            el.addEventListener('mouseleave', () => { btn.style.opacity = '0' })
            btn.addEventListener('mouseenter', () => { btn.style.opacity = '1' })
            btn.addEventListener('mouseleave', () => { btn.style.opacity = '0' })

            btn.addEventListener('click', (e) => {
                e.stopPropagation()
                const parts = key.split(':')
                if (parts.length === 2) {
                    document.dispatchEvent(new CustomEvent('replay-element-animation', { detail: { blockId: parts[0], elementId: parts[1] } }))
                }
            })
            container.appendChild(btn)
        })
    }

    positionButtons()
    const repositionTimer = setInterval(positionButtons, 500)

    // Cleanup
    const origTeardown = teardownClient
    const origOnUnmounted = onUnmounted
    // We override teardown to also clean up the container
    const cleanup = () => {
        clearInterval(repositionTimer)
        if (container.parentNode) container.parentNode.removeChild(container)
    }

    return cleanup
}

let animReplayCleanup = null
let onViewportResize = null
onMounted(() => {
    setupClient();
    // Track viewport device on the public site for per-device overrides.
    viewportDevice.value = computeViewportDevice();
    onViewportResize = () => {
        viewportDevice.value = computeViewportDevice();
    };
    window.addEventListener("resize", onViewportResize);
    if (isAdmin && isAdmin.value) {
        animReplayCleanup = setupElementReplayButtons()
    }
});

onUnmounted(() => {
    teardownClient();
    if (animReplayCleanup) animReplayCleanup()
    if (onViewportResize) window.removeEventListener("resize", onViewportResize);
});

// Ensure clicks inside complex child components still select the block.
// Some child components may stopPropagation on click; to be robust we add a
// capture-phase listener on `document` that finds the nearest `.block-wrapper`
// and calls selectBlock with its data-block-id. This is only active on the
// client and only when admin mode is enabled.
let docClickHandler, docPointerHandler;
if (typeof window !== "undefined" && import.meta.client) {
    docClickHandler = (ev) => {
        try {
            if (!isAdmin || !isAdmin.value) return;
            const target = ev.target;
            if (!target) return;
            // La poignée de drag appartient à Sortable : sélectionner le bloc
            // au moment où on la saisit ouvre la sidebar + overlay plein
            // écran qui avale le drag en cours. Même chose pour un élément
            // additionnel EN COURS DE POSITIONNEMENT (.bee-el-drag, poignées
            // VueDraggableResizable actives) : le re-sélectionner réinsère
            // l'overlay plein écran / re-render qui avale le drag/resize en
            // cours. Les éléments STATIQUES (non en positionnement) doivent
            // au contraire sélectionner normalement leur bloc — c'est ce qui
            // ouvre la sidebar et les identifie, comme un champ fixe de bloc.
            if (target.closest && (target.closest(".drag-handle") || target.closest(".bee-el-drag") || target.closest(".bee-validate-btn"))) return;
            const wrapper = target.closest && target.closest(".block-wrapper");
            if (wrapper) {
                const bid = wrapper.getAttribute("data-block-id");
                if (bid) {
                    try {
                        onBlockSelected(bid);
                    } catch (e) {
                        console.error(
                            "PageRenderer.docClick: selectBlock failed",
                            e,
                        );
                    }
                    try {
                        if (editingBlockId) editingBlockId.value = bid;
                    } catch (e) {
                        console.warn("PageRenderer.docClick: could not set editingBlockId", e);
                    }
                    try {
                        activeFieldKey.value = resolveFieldKey(target);
                        identifySeq.value++;
                    } catch (e) {
                        console.warn("PageRenderer.docClick: could not resolve field key", e);
                    }
                    try {
                        document
                            .querySelectorAll(".block-wrapper.admin-selected")
                            .forEach((el) =>
                                el.classList.remove("admin-selected"),
                            );
                        wrapper.classList.add("admin-selected");
                    } catch (e) {
                        console.warn("PageRenderer.docClick: could not update DOM classes", e);
                    }
                }
            }
        } catch (e) {
            console.error("PageRenderer: doc click handler failed", e);
        }
    };

    docPointerHandler = (ev) => {
        try {
            if (!isAdmin || !isAdmin.value) return;
            const target = ev.target;
            if (!target) return;
            // Idem docClickHandler : la poignée de drag et l'élément
            // additionnel en cours de positionnement ne sélectionnent pas le bloc
            if (target.closest && (target.closest(".drag-handle") || target.closest(".bee-el-drag") || target.closest(".bee-validate-btn"))) return;
            const wrapper = target.closest && target.closest(".block-wrapper");
            if (wrapper) {
                const bid = wrapper.getAttribute("data-block-id");
                if (bid) {
                    try {
                        onBlockSelected(bid);
                    } catch (e) {
                        console.warn("PageRenderer.docPointer: selectBlock failed", e);
                    }
                    try {
                        if (editingBlockId) editingBlockId.value = bid;
                    } catch (e) {
                        console.warn("PageRenderer.docPointer: could not set editingBlockId", e);
                    }
                    try {
                        activeFieldKey.value = resolveFieldKey(target);
                        identifySeq.value++;
                    } catch (e) {
                        console.warn("PageRenderer.docPointer: could not resolve field key", e);
                    }
                    try {
                        document
                            .querySelectorAll(".block-wrapper.admin-selected")
                            .forEach((el) =>
                                el.classList.remove("admin-selected"),
                            );
                        wrapper.classList.add("admin-selected");
                    } catch (e) {
                        console.warn("PageRenderer.docPointer: could not update DOM classes", e);
                    }
                }
            }
        } catch (e) {
            console.error("PageRenderer: doc pointer handler failed", e);
        }
    };
}

onMounted(() => {
    if (docClickHandler && docPointerHandler) {
        document.addEventListener("click", docClickHandler, true);
        document.addEventListener("pointerdown", docPointerHandler, true);
    }
});

onUnmounted(() => {
    if (docClickHandler)
        document.removeEventListener("click", docClickHandler, true);
    if (docPointerHandler)
        document.removeEventListener("pointerdown", docPointerHandler, true);
});

function wrapperClick(id, ev) {
    // Idem docClickHandler/docPointerHandler : ne pas re-sélectionner le
    // bloc depuis un élément additionnel EN COURS DE POSITIONNEMENT, sous
    // peine de rouvrir/re-render la sidebar en pleine interaction et avaler
    // le drag/resize en cours.
    if (ev && ev.target && ev.target.closest && (ev.target.closest(".bee-el-drag") || ev.target.closest(".bee-validate-btn"))) return;
    onBlockSelected(id)
    try {
        if (editingBlockId && editingBlockId.value !== id) {
            editingBlockId.value = id;
        }
    } catch (e) {
        console.warn("PageRenderer.wrapperClick: failed to set editingBlockId directly", e);
    }
    try {
        activeFieldKey.value = resolveFieldKey(ev?.target);
        identifySeq.value++;
    } catch (e) {
        console.warn("PageRenderer.wrapperClick: could not resolve field key", e);
    }
}

function isSelected(block) {
    try {
        // editingBlockId is a ref provided from the admin composable.
        const sel = Boolean(
            isAdmin &&
            isAdmin.value &&
            editingBlockId &&
            editingBlockId.value === block.id,
        );
        return sel;
    } catch (e) {
        return false;
    }
}

watch(
    () => (props.blocks as any[] || []).map((b: any) => b.id).join(","),
    async () => {
        try {
            await nextTick();
            handleBlocksChange(props.blocks || []);
        } catch (err) {
            console.error("PageRenderer: error in blocks watcher", err);
        }
    },
    { deep: false },
);

let suppressAnimationWatcher = false;
watch(
    () =>
        fixedBlocks.value.map((b) => ({ id: b.id, anim: b.props?.animation })),
    (newArr) => {
        if (suppressAnimationWatcher) return;
        try {
            handleAnimationChange(fixedBlocks.value);
        } catch (err) {
            console.error("PageRenderer: error in animation watcher", err);
        }
    },
    { deep: false },
);
</script>

<style scoped>
.page-renderer {
    width: 100%;
}
.admin-selected {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
}
.anim-native-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 10;
    font-size: 0.65em;
    background: rgba(107, 114, 128, 0.85);
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    pointer-events: none;
    white-space: nowrap;
}
.dev-comment-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 10;
    font-size: 0.9em;
    pointer-events: none;
}
.drag-handle {
    /* À l'INTÉRIEUR du wrapper : les blocs occupent toute la largeur, un
       offset négatif (ancien left:-28px) plaçait la poignée hors écran —
       le drag & drop était inutilisable */
    position: absolute;
    top: 50%;
    left: 8px;
    transform: translateY(-50%);
    cursor: grab;
    font-size: 18px;
    color: #374151;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    z-index: 20;
    /* Discrètement visible en permanence (pas juste au survol) : sinon la
       fonctionnalité de réordonnancement par glisser-déposer est invisible
       tant qu'on ne survole pas exactement le bon endroit du bloc. */
    opacity: 0.55;
    transition: opacity 0.15s;
    user-select: none;
    line-height: 1;
    padding: 4px;
    z-index: 20;
}
.admin-mode .block-wrapper:hover .drag-handle {
    opacity: 1;
}
.block-ghost {
    opacity: 0.4;
    outline: 2px dashed #3b82f6;
    outline-offset: -2px;
}
</style>

<style>
.block-wrapper {
    /* Ancre de positionnement pour BlockExtraElementsCanvas (overlay
       absolute sur le contenu du bloc) — nécessaire aussi hors admin-mode
       puisque le rendu public utilise le même overlay. */
    position: relative;
}
.admin-mode .block-wrapper {
    cursor: pointer;
    /* Ne JAMAIS déclarer `transition` ici. Ce sélecteur (0,2,0) est plus
       spécifique que les classes d'animation `.block-anim-*` (0,1,0) : toute
       transition posée ici REMPLACE la leur, si bien qu'en mode édition
       opacity et transform cessent d'être animées. Le bloc saute alors
       directement à son état final — on voit bien « quelque chose », mais
       jamais l'animation. Le fondu de l'outline au survol ne valait pas ça. */
}
.admin-mode .block-wrapper:hover {
    outline: 2px dashed rgba(59, 130, 246, 0.5);
    outline-offset: -2px;
}
/* Les animations d'entrée (portal/flip) laissent un transform (perspective())
   en place même une fois "triggered" — visuellement identité (rotateX(0)
   scale(1)), mais ça crée un nouveau contexte d'empilement qui plafonne le
   z-index du bouton "Valider" de BlockExtraElementsCanvas sous la sidebar
   admin (position:fixed, z-index 9999), quel que soit son propre z-index.
   On neutralise le transform seulement pendant le positionnement d'un
   élément libre de CE bloc, où l'animation d'entrée est de toute façon déjà
   terminée. */
.block-wrapper.bee-positioning-active {
    transform: none !important;
}
/* Même piège au niveau de .page-renderer : après un premier montage en mode
   admin (bascule SSR public -> admin post-hydratation), la transition de
   page Nuxt (page-enter-from/page-enter-active) reste accrochée en
   opacity:0 + transform, ce qui plafonne pareillement le bouton "Valider".
   Neutralisé uniquement pendant le positionnement, sans risque visuel
   puisque le contenu est de toute façon censé être pleinement visible à ce
   stade. */
.page-renderer.bee-positioning-active {
    opacity: 1 !important;
    transform: none !important;
}
</style>
