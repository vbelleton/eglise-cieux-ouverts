<template>
    <div
        class="aspirations-viewport"
        :class="[visibilityClasses, { triggered: isTriggered }]"
    >
        <div
            class="sticky-box"
            :style="{
                background: backgroundGradient || backgroundColor,
                color: textColor,
            }"
        >
            <div class="aspirations-content">
                <h2 class="aspirations-title" data-field-key="title" :style="fieldFontStyle(fieldFonts, 'title', fieldFontSizes)">{{ title }}</h2>
                <div class="aspirations-divider"></div>
                <ol class="aspirations-list">
                    <li
                        v-for="(item, i) in items"
                        :key="i"
                        :style="getItemStyle(i)"
                    >
                        <span class="circle" :style="getCircleStyle(i)"></span>
                        <span class="badge" aria-hidden="true">{{ i + 1 }}</span>
                        <span class="text">{{ item }}</span>
                    </li>
                </ol>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";
import { fieldFontStyle } from "~/utils/fonts.js";
const {
    backgroundGradient = "",
    backgroundColor = "#fff",
    textColor = "#222",
    title = "",
    items = [],
    visibility = {},
    isTriggered = false,
    fieldFonts = {},
    fieldFontSizes = {},
} = defineProps({
    backgroundGradient: { type: String, default: "" },
    backgroundColor: { type: String, default: "#fff" },
    textColor: { type: String, default: "#222" },
    title: { type: String, default: "" },
    items: { type: Array, default: () => [] },
    visibility: { type: Object, default: () => ({}) },
    isTriggered: { type: Boolean, default: false },
    fieldFonts: { type: Object, default: () => ({}) },
    fieldFontSizes: { type: Object, default: () => ({}) },
});

const visibilityClasses = computed(() => ({
    "hide-mobile": visibility.mobile === false,
    "hide-tablet": visibility.tablet === false,
    "hide-desktop": visibility.desktop === false,
}));

const n = computed(() => items.length);

function getItemStyle(index) {
    const total = n.value || 1; // éviter division par zéro
    const band = 80;
    const step = band / total;
    const pad = (100 - band) / 2;
    const start = pad + index * step;
    const end = pad + band;
    return {
        "--anim-start": start + "%",
        "--anim-end": end + "%",
    };
}

function getCircleStyle(index) {
    const total = n.value || 1;
    const band = 80;
    const step = band / total;
    const pad = (100 - band) / 2;
    const start = pad + index * step;
    const end = pad + band;
    return {
        left: -6 + index * 4 + "rem",
        "--anim-start": start + "%",
        "--anim-end": end + "%",
        "--circle-offset": index * 4.5 + "rem",
    };
}
</script>

<style scoped>
/* styles inchangés */
.aspirations-viewport {
    view-timeline: --cascade;
    height: 300vh;
    position: relative;
}
.sticky-box {
    position: sticky;
    top: 0;
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.aspirations-content {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 0 2rem;
}
.aspirations-title {
    font-family: var(--font-heading);
    font-style: italic;
    font-weight: 700;
    font-size: 3rem;
    text-shadow: 0 1px 5px hsla(0, 0%, 0%, 0.8);
    text-align: center;
    padding-bottom: 1.5rem;
}
.aspirations-divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(
        to right,
        transparent,
        rgba(255, 255, 255, 0.4),
        transparent
    );
    margin-bottom: 1rem;
}
.aspirations-list {
    list-style: none;
    font-size: 2rem;
    padding: 0;
    margin: 0;
}
.aspirations-list li {
    position: relative;
    width: 100%;
    padding: 1rem 0 1rem 12rem;
    text-align: left;
    line-height: 1.25;
    text-shadow: 0 1px 5px hsla(0, 0%, 0%, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}
.aspirations-list li:last-child {
    border-bottom: none;
}
.circle {
    position: absolute;
    z-index: -1;
    width: 12vh;
    height: 12vh;
    border-radius: 50%;
    background: #1a96df;
    opacity: 0.5;
    top: 50%;
    transform: translateY(-50%);
}
.text {
    position: relative;
    z-index: 1;
    display: block;
}
.badge {
    display: none;
}
@media (max-width: 768px) {
    .aspirations-viewport {
        height: auto;
    }
    .sticky-box {
        position: relative;
        top: auto;
        min-height: auto;
        padding: 50px 20px;
    }
    .aspirations-content {
        padding: 0;
    }
    .aspirations-title {
        font-size: clamp(32px, 8vw, 48px);
    }
    .aspirations-divider {
        width: 64px;
        height: 3px;
        border-radius: 3px;
        margin: 0 auto 1.75rem;
        background: #1a96df;
    }
    .aspirations-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .aspirations-list li {
        display: flex;
        align-items: center;
        gap: 14px;
        font-size: 1.05rem;
        line-height: 1.35;
        padding: 14px 16px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.07);
        background: color-mix(in srgb, currentColor 7%, transparent);
        text-shadow: none;
    }
    .aspirations-list li:last-child {
        border-bottom: 1px solid rgba(255, 255, 255, 0.16);
        border-bottom: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    }
    .circle {
        display: none;
    }
    .badge {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #1a96df;
        color: #fff;
        font-weight: 700;
        font-size: 1rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
}

/* Mobile/tablet triggered animation — stagger items on entry using keyframes
   to override the global .block-wrapper.triggered fallback (which uses !important) */
@media (max-width: 768px) {
    .aspirations-viewport.triggered .aspirations-title {
        animation: aspir-title-in 0.5s ease both !important;
    }
    .aspirations-viewport.triggered .aspirations-list li {
        animation: aspir-mobile-item-in 0.4s ease both !important;
    }
    .aspirations-viewport.triggered .aspirations-list li:nth-child(1) { animation-delay: 0.15s !important; }
    .aspirations-viewport.triggered .aspirations-list li:nth-child(2) { animation-delay: 0.25s !important; }
    .aspirations-viewport.triggered .aspirations-list li:nth-child(3) { animation-delay: 0.35s !important; }
    .aspirations-viewport.triggered .aspirations-list li:nth-child(4) { animation-delay: 0.45s !important; }
    .aspirations-viewport.triggered .aspirations-list li:nth-child(5) { animation-delay: 0.55s !important; }
    .aspirations-viewport.triggered .aspirations-list li:nth-child(6) { animation-delay: 0.65s !important; }
}
@keyframes aspir-mobile-item-in {
    0% { opacity: 0; transform: translateY(15px); }
    100% { opacity: 1; transform: translateY(0); }
}

/* Keyframes et autres styles laissés intacts */
.aspirations-viewport {
    view-timeline: --cascade;
}

/* ONLY for browsers that support scroll-driven animations (Chrome 115+) */
@supports (animation-timeline: view()) {
    @media (min-width: 769px) {
        .aspirations-title {
            opacity: 0;
            animation: aspir-title-in both;
            animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
            animation-timeline: --cascade;
            animation-range: cover 0% cover 15%;
        }
        .aspirations-list li {
            opacity: 0;
            animation-name: aspir-item-in;
            animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
            animation-fill-mode: both;
            animation-timeline: --cascade;
            animation-range: cover var(--anim-start) cover var(--anim-end);
        }
        .circle {
            animation-name: circle-move;
            animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
            animation-fill-mode: both;
            animation-timeline: --cascade;
            animation-range: cover var(--anim-start) cover var(--anim-end);
        }
    }
}

/* Fallback when wrapper has triggered class (IntersectionObserver for non-supporting browsers) */
.block-wrapper.triggered .aspirations-title,
.block-wrapper.triggered .aspirations-viewport .aspirations-list li {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
}
.block-wrapper.triggered .aspirations-viewport .circle {
    opacity: 0.5 !important;
    transform: translateY(-50%) !important;
}
.block-wrapper.triggered .aspirations-viewport {
    height: auto !important;
}
.block-wrapper.triggered .aspirations-viewport .sticky-box {
    position: relative !important;
    top: auto !important;
    min-height: auto !important;
    padding: 50px 20px !important;
}

/* Cascade delays for list items - animate in sequence when triggered */
.block-wrapper.triggered
    .aspirations-viewport
    .aspirations-list
    li:nth-child(1) {
    transition:
        opacity 0.4s ease 0.1s,
        transform 0.4s ease 0.1s;
}
.block-wrapper.triggered
    .aspirations-viewport
    .aspirations-list
    li:nth-child(2) {
    transition:
        opacity 0.4s ease 0.2s,
        transform 0.4s ease 0.2s;
}
.block-wrapper.triggered
    .aspirations-viewport
    .aspirations-list
    li:nth-child(3) {
    transition:
        opacity 0.4s ease 0.3s,
        transform 0.4s ease 0.3s;
}
.block-wrapper.triggered
    .aspirations-viewport
    .aspirations-list
    li:nth-child(4) {
    transition:
        opacity 0.4s ease 0.4s,
        transform 0.4s ease 0.4s;
}
.block-wrapper.triggered
    .aspirations-viewport
    .aspirations-list
    li:nth-child(5) {
    transition:
        opacity 0.4s ease 0.5s,
        transform 0.4s ease 0.5s;
}
.block-wrapper.triggered
    .aspirations-viewport
    .aspirations-list
    li:nth-child(6) {
    transition:
        opacity 0.4s ease 0.6s,
        transform 0.4s ease 0.6s;
}
.aspirations-viewport.triggered .aspirations-title,
.aspirations-viewport.triggered .aspirations-list li {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
}
.aspirations-viewport.triggered {
    height: auto !important;
}
.aspirations-viewport.triggered .sticky-box {
    position: relative !important;
    top: auto !important;
    min-height: auto !important;
    padding: 50px 20px !important;
}
.aspirations-viewport.triggered .circle {
    opacity: 0.5 !important;
    transform: translateY(-50%) !important;
    animation: none !important;
}

@keyframes aspir-title-in {
    0% {
        opacity: 0;
        transform: translateY(20px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}
@keyframes aspir-item-in {
    0% {
        opacity: 0;
        transform: translateY(25px);
    }
    25% {
        opacity: 1;
        transform: translateY(0);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}
@keyframes circle-move {
    0% {
        opacity: 0;
        transform: translateY(-80%);
    }
    25% {
        opacity: 0.5;
        transform: translateY(calc(-50% - var(--circle-offset, 0rem)));
    }
    100% {
        opacity: 0.5;
        transform: translateY(calc(-50% - var(--circle-offset, 0rem)));
    }
}
</style>
