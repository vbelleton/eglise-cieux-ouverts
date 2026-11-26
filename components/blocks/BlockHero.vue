<template>
    <section
        class="block-hero block-main-hero"
        :data-block-id="blockId"
        :class="visibilityClasses"
        :style="{
            minHeight: height ? height + 'px' : undefined,
            height: height ? height + 'px' : 'auto',
        }"
    >
        <img :src="image" alt="Hero background" class="hero-bg" data-field-key="image" />
        <div
            v-if="overlay"
            class="hero-overlay"
            :style="{ background: overlayColor }"
        />

        <!-- Entrée en CSS pur (animation jouée dès le premier affichage) : elle ne
             dépend plus de l'hydratation. Avant, le logo restait à opacity 0
             jusqu'à onMounted, soit plusieurs secondes après l'arrivée de
             l'image sur une première visite (JS pas encore en cache), et pour
             toujours si l'hydratation échouait. -->
        <div class="hero-content">
            <template v-if="overlayText">
                <h1 class="hero-title" data-field-key="overlayText" :style="{ color: textColor, ...fieldFontStyle(fieldFonts, 'overlayText', fieldFontSizes) }">
                    {{ overlayText }}
                </h1>
            </template>
            <template v-else-if="!imgError">
                <img
                    :src="nameImage"
                    alt="Cieux Ouverts"
                    class="hero-name"
                    data-field-key="nameImage"
                    fetchpriority="high"
                    @error="onImgError"
                />

            </template>
            <template v-else>
                <h1 class="hero-title" :style="{ color: textColor }">
                    Église Cieux Ouverts
                </h1>
            </template>
        </div>
    </section>
</template>

<script setup>
import { ref, computed } from "vue";
import { fieldFontStyle } from "~/utils/fonts.js";

defineOptions({ inheritAttrs: false });

const props = defineProps({
    blockId: { type: String, default: "" },
    visibility: { type: Object, default: () => ({}) },
    fieldFonts: { type: Object, default: () => ({}) },
    fieldFontSizes: { type: Object, default: () => ({}) },
    image: { type: String, default: "/foule-croix.png" },
    nameImage: { type: String, default: "" },
    logoImage: { type: String, default: "" },
    height: { type: [Number, String], default: 700 },
    overlay: { type: Boolean, default: false },
    overlayColor: { type: String, default: "rgba(0,0,0,0.3)" },
    overlayText: { type: String, default: "" },
    textColor: { type: String, default: "#064886" },
    showButton: { type: Boolean, default: false },
    isTriggered: { type: Boolean, default: false },
});

const { visibility = {} } = props;

// Même raison que le préchargement du logo du menu (nuxt.config.ts) : l'image
// titre passerait sinon derrière tous les bundles JS à la première visite.
useHead(() => ({
    link: !props.overlayText && props.nameImage
        ? [{ rel: "preload", as: "image", href: props.nameImage, fetchpriority: "high", tagPriority: "critical" }]
        : [],
}));

const imgError = ref(false);
function onImgError() {
    imgError.value = true;
}

const visibilityClasses = computed(() => ({
    "hide-mobile": visibility.mobile === false,
    "hide-tablet": visibility.tablet === false,
    "hide-desktop": visibility.desktop === false,
}));
</script>

<style scoped>
.block-main-hero {
    container-type: inline-size;
    position: relative;
    width: 100%;
    margin-left: 0;
    height: 72vh;
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-top: -70px;
}

.hero-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
}

.hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
    animation: hero-entree 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes hero-entree {
    from {
        opacity: 0;
        transform: translateY(80px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
@media (prefers-reduced-motion: reduce) {
    .hero-content {
        animation: none;
    }
}

/* If admin mode, show content immediately for editing */
.admin-mode .block-main-hero .hero-content {
    animation: none;
}

.hero-overlay {
    position: absolute;
    inset: 0;
    z-index: 0;
}
.hero-title {
    font-family: var(--font-heading);
    font-size: 3.2rem;
    margin: 0;
    text-align: center;
}

.hero-name {
    width: 100%;
    max-width: 575px;
    height: auto;
    object-fit: contain;
}

.hero-logo {
    width: 100%;
    max-width: 150px;
    height: auto;
    object-fit: contain;
}

@container (max-width: 768px) {
    .block-main-hero {
        margin-top: -56px;
        min-height: 360px;
    }
    .hero-name {
        max-width: 80vw;
    }
    .hero-logo {
        max-width: 100px;
    }
}

@container (max-width: 600px) {
    .block-main-hero {
        height: 60vh;
        min-height: 300px;
    }
    .hero-name {
        max-width: 85vw;
    }
    .hero-logo {
        max-width: 80px;
    }
    .hero-content {
        gap: 24px;
    }
}
</style>
