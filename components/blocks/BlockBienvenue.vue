<template>
    <section
        class="block-bienvenue"
        :class="[visibilityClasses, { 'admin-animate': isAdmin }]"
    >
        <img
            src="/images/bienvenue-foule.png"
            alt="Foule Croix"
            class="bienvenue-img"
            loading="lazy"
        />

        <div class="bienvenue-content">
            <div class="hero-bienvenue-portal" data-field-key="title" :aria-label="props.title" :style="{ color: props.textColor, '--bienvenue-taille': props.fontSize + 'em', ...fieldFontStyle(props.fieldFonts, 'title', props.fieldFontSizes) }">
                <span
                    v-for="(char, i) in wordArr"
                    :key="i"
                    class="hero-bienvenue-char"
                    :style="getLetterVars(i)"
                    >{{ char === ' ' ? ' ' : char }}</span
                >
            </div>
            <p class="hero-subtitle" data-field-key="subtitle" :style="{ color: props.textColor, ...fieldFontStyle(props.fieldFonts, 'subtitle', props.fieldFontSizes) }">{{ props.subtitle }}</p>
            <div class="hero-socials">
                <SocialLinks :links="socialLinks" :size="20" />
            </div>
        </div>
    </section>
</template>

<script setup>
import { computed, inject, ref, onMounted } from "vue";
import { fieldFontStyle } from "~/utils/fonts.js";

const { socialLinks, loadSiteSettings } = useSiteSettings();
onMounted(() => loadSiteSettings());

const props = defineProps({
    title: { type: String, default: "BIENVENUE" },
    subtitle: { type: String, default: "à l'Église Cieux Ouverts à Morlaix" },
    visibility: { type: Object, default: () => ({}) },
    fieldFonts: { type: Object, default: () => ({}) },
    fieldFontSizes: { type: Object, default: () => ({}) },
    textColor: { type: String, default: "#064886" },
    fontSize: { type: [Number, String], default: 5 },
});

const isAdmin = inject("isAdmin", ref(false));

const visibilityClasses = computed(() => ({
    "hide-mobile": props.visibility.mobile === false,
    "hide-tablet": props.visibility.tablet === false,
    "hide-desktop": props.visibility.desktop === false,
}));

// L'animation fan-out est calculée par lettre ; [...title] (plutôt que
// split('')) gère correctement les caractères accentués et emoji.
const wordArr = computed(() => [...(props.title || "")]);
const center = computed(() => (wordArr.value.length - 1) / 2);

function getLetterVars(i) {
    const c = center.value;
    const dist = Math.abs(i - c);
    const sign = i === c ? 0 : (i - c) / dist;
    const extreme = i === 0 || i === wordArr.value.length - 1 ? 1.0 : 1;
    return {
        "--dist": dist,
        "--sign": sign,
        "--extreme": extreme,
        "--spread-x": "80px",
        "--spread-y": "55px",
        "--spread-r": "15deg",
    };
}
</script>

<style scoped>
.block-bienvenue {
    view-timeline: --bienvenue;
    position: relative;
    overflow: hidden;
    width: 100%;
    margin-left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 600px;
}

.bienvenue-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    z-index: 0;
}

.bienvenue-content {
    position: relative;
    z-index: 1;
    text-align: center;
    width: 100%;
    max-width: 1200px;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.hero-bienvenue-portal {
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: var(--font-heading);
    /* Taille réglée dans l'admin (« Taille police », en em). Passée par une
       variable et non en style direct : un font-size en ligne écrasait les
       règles téléphone ci-dessous, et « BIENVENUE » débordait de l'écran. */
    font-size: var(--bienvenue-taille, clamp(40px, 8vw, 80px));
    line-height: 1.3;
    margin-bottom: 20px;
    position: relative;
    width: 100%;
    white-space: nowrap;
    user-select: none;
}

.hero-bienvenue-char {
    display: inline-block;
    will-change: transform, opacity;
    margin: 0 0.03em;
    color: inherit;
    opacity: 1;
    transform: translateX(0) translateY(0) rotate(0) scale(1);
}

@supports (animation-timeline: --bienvenue) {
    @media (prefers-reduced-motion: no-preference) {
        .hero-bienvenue-char {
            opacity: 0;
            animation-name: bienvenue-fan;
            animation-timeline: --bienvenue;
            animation-range: cover 0% cover 55%;
            animation-fill-mode: both;
        }
    }
}

/* Animation choisie dans le sélecteur (wrapper .bloc-anim-controlee, cf.
   lib/blocks/renderer.ts) : les animations propres au bloc sont neutralisées,
   il faut donc l'état final explicite. main.css se contente de les ramener à
   0,01 ms en comptant sur leur image finale, or Safari/WebKit les abandonne
   quand la classe arrive après l'insertion du bloc (navigation interne sur
   téléphone : l'animation passe de « d'origine » au réglage mobile une fois
   la page montée). Sans animation, ces éléments retombaient sur leur style de
   départ, opacity 0 : « Bienvenue » ne réapparaissait plus en revenant sur
   l'accueil. Sélecteur entièrement :global() (« :global(.a) .b » ne garde que
   « .a ») ; classe doublée pour dépasser « .admin-animate .hero-…[data-v] ». */
:global(.bloc-anim-controlee .block-bienvenue.block-bienvenue .hero-bienvenue-char),
:global(.bloc-anim-controlee .block-bienvenue.block-bienvenue .hero-subtitle),
:global(.bloc-anim-controlee .block-bienvenue.block-bienvenue .hero-socials) {
    animation-name: none;
    opacity: 1;
    transform: none;
}

/* Fallback: in admin mode or when admin-animate class is present, trigger standard animations immediately */
.admin-animate .hero-bienvenue-char {
    opacity: 0;
    animation-name: bienvenue-fan;
    animation-duration: 0.8s;
    animation-fill-mode: both;
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
    /* stagger by distance */
    animation-delay: calc(0.04s * var(--dist));
}

.admin-animate .hero-subtitle {
    opacity: 0;
    transform: translateY(30px);
    animation: subtitle-in 0.5s ease both;
    animation-delay: 0.5s;
}

.admin-animate .hero-socials {
    opacity: 0;
    transform: translateY(20px);
    animation: socials-in 0.5s ease both;
    animation-delay: 0.65s;
}

@keyframes bienvenue-fan {
    0% {
        opacity: 0;
        transform: translateX(calc(var(--spread-x) * var(--dist) * var(--sign)))
            translateY(
                calc(-1 * var(--spread-y) * var(--dist) * var(--extreme))
            )
            rotate(calc(var(--spread-r) * var(--dist) * var(--sign)))
            scale(0.04);
    }
    100% {
        opacity: 1;
        transform: translateX(0) translateY(0) rotate(0) scale(1);
    }
}

.hero-subtitle {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 17.5px;
    font-weight: 400;
    margin-top: 20px;
    opacity: 0;
    transform: translateY(30px);
}

@supports (animation-timeline: --bienvenue) {
    @media (prefers-reduced-motion: no-preference) {
        .hero-subtitle {
            animation: subtitle-in 0.5s ease both;
            animation-timeline: --bienvenue;
            animation-range: cover 45% cover 60%;
        }
    }
}

@keyframes subtitle-in {
    0% {
        opacity: 0;
        transform: translateY(30px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

.hero-socials {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    opacity: 0;
    transform: translateY(20px);
}

@supports (animation-timeline: --bienvenue) {
    @media (prefers-reduced-motion: no-preference) {
        .hero-socials {
            animation: socials-in 0.5s ease both;
            animation-timeline: --bienvenue;
            animation-range: cover 55% cover 70%;
        }
    }
}

@keyframes socials-in {
    0% {
        opacity: 0;
        transform: translateY(20px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

.hero-socials :deep(.social-link) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(5, 72, 134, 0.85);
    color: white;
    text-decoration: none;
    transition:
        background 0.2s,
        transform 0.2s;
}

.hero-socials :deep(.social-link:hover) {
    background: #054886;
    transform: scale(1.1);
}

@media (max-width: 768px) {
    .block-bienvenue {
        min-height: 400px;
    }
    .hero-bienvenue-portal {
        /* Jamais plus que la taille réglée, jamais plus large que l'écran */
        font-size: min(var(--bienvenue-taille, 36px), 9vw);
        letter-spacing: 0.01em;
    }
    .hero-bienvenue-char {
        --spread-x: 30px;
        --spread-y: 25px;
        --spread-r: 6deg;
    }
    .hero-subtitle {
        font-size: 16px;
        margin-top: 15px;
    }
    .hero-socials {
        margin-top: 16px;
    }
}

@media (max-width: 480px) {
    .block-bienvenue {
        min-height: 320px;
    }
    .hero-bienvenue-portal {
        font-size: min(var(--bienvenue-taille, 28px), 10vw);
        letter-spacing: 0;
    }
    .hero-subtitle {
        font-size: 14px;
    }
}
</style>
