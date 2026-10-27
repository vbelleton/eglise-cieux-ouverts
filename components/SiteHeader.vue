<template>
    <header
        class="site-header"
        :class="{ scrolled: isScrolled, 'menu-open': menuOpen }"
        :style="headerStyle"
    >
        <div class="header-inner">
            <NuxtLink to="/" class="brand" aria-label="Accueil — Cieux Ouverts" @click="onLogoClick">
                <img src="/logo-nav.png" alt="Cieux Ouverts" class="logo" />
            </NuxtLink>

            <nav class="nav-desktop" aria-label="Navigation principale">
                <template v-for="item in navItems" :key="item.id">
                    <!-- Render NuxtLink on SSR (isMounted=false) or when not in admin mode.
               When admin mode is active on the client, render plain anchors that
               prevent navigation and open the menu editor. This mirrors the
               mobile behaviour and keeps SSR output stable. -->
                    <NuxtLink
                        v-if="!isMounted || !adminMode"
                        :to="item.to"
                        active-class="active"
                        :class="{
                            'nav-admin-link': isMounted && adminMode,
                            dimmed: isMounted && adminMode && !item.visible,
                        }"
                        @click="!adminMode && closeMenu()"
                        >{{ item.label }}</NuxtLink
                    >
                    <a
                        v-else
                        href="#"
                        class="nav-admin-link"
                        :class="{ dimmed: !item.visible }"
                        @click.prevent="onNavClick($event, item)"
                        >{{ item.label }}</a
                    >

                    <template v-if="item.children?.length">
                        <template v-if="!isMounted || !adminMode">
                            <NuxtLink
                                v-for="sub in item.children"
                                :key="sub.id"
                                :to="sub.to"
                                class="sub-link"
                                @click="closeMenu"
                                >{{ sub.label }}</NuxtLink
                            >
                        </template>
                        <template v-else>
                            <a
                                v-for="sub in item.children"
                                :key="sub.id"
                                href="#"
                                class="sub-link nav-admin-link"
                                @click.prevent="onNavClick($event, sub)"
                                >{{ sub.label }}</a
                            >
                        </template>
                    </template>
                </template>
                <NuxtLink v-if="espaceMembre" to="/membre" class="nav-membre-link" active-class="active">
                    {{ membreLinkLabel }}
                </NuxtLink>
                <div class="nav-desktop-socials">
                    <SocialLinks :links="socialLinks" />
                </div>
            </nav>

            <!-- Téléphone uniquement : réseaux sociaux dans la barre, à gauche du ☰ -->
            <div class="header-mobile-socials">
                <SocialLinks :links="socialLinks" :size="22" />
            </div>

            <button
                ref="burgerEl"
                @click="toggleMenu"
                class="burger"
                :aria-label="menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'"
                aria-controls="mobile-navigation"
                :aria-expanded="menuOpen ? 'true' : 'false'"
            >
                <span></span><span></span><span></span>
            </button>
        </div>

        <nav id="mobile-navigation" ref="mobileNavEl" class="nav-mobile" aria-label="Navigation mobile" :style="menuBgStyle">
            <div class="nav-links">
                <template v-for="item in navItems" :key="item.id">
                    <NuxtLink
                        v-if="!isMounted || (!adminMode && item.visible !== false)"
                        :to="item.to"
                        @click="closeMenu"
                        >{{ item.label }}</NuxtLink
                    >
                    <a
                        v-if="isMounted && adminMode"
                        href="#"
                        class="nav-admin-link"
                        :class="{ dimmed: !item.visible }"
                        @click.prevent="onNavClick($event, item)"
                        >{{ item.label }}</a
                    >
                    <template v-for="sub in item.children || []" :key="sub.id">
                        <NuxtLink
                            v-if="!adminMode && sub.visible !== false"
                            :to="sub.to"
                            class="sub-link"
                            @click="closeMenu"
                            >— {{ sub.label }}</NuxtLink
                        >
                        <a
                            v-if="adminMode"
                            href="#"
                            class="nav-admin-link sub-link"
                            @click.prevent="onNavClick($event, sub)"
                            >— {{ sub.label }}</a
                        >
                    </template>
                </template>
                <NuxtLink v-if="espaceMembre" to="/membre" class="nav-membre-link" @click="closeMenu">{{ membreLinkLabel }}</NuxtLink>
            </div>
            <div class="nav-mobile-socials">
                <SocialLinks :links="socialLinks" :size="26" />
            </div>
        </nav>
    </header>
    <div class="header-spacer"></div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, inject } from "vue";
import MenuEditor from "~/components/editor/MenuEditor.vue";

const menuOpen = ref(false);
const isScrolled = ref(false);
const route = useRoute();
const mobileMq = ref(null);

// Lien espace membre : prénom si connecté, libellé générique sinon
const { isLoggedIn: memberLoggedIn, firstName: memberFirstName } = useMemberAuth();
const membreLinkLabel = computed(() =>
    memberLoggedIn.value && memberFirstName.value ? `👤 ${memberFirstName.value}` : "Espace membre",
);

const burgerEl = ref(null);
const mobileNavEl = ref(null);

// Éléments atteignables au clavier tant que le menu mobile est ouvert : le
// bouton de fermeture + le contenu du menu. Le reste de la page est derrière.
function focusablesDuMenu() {
    const liste = [burgerEl.value, ...(mobileNavEl.value?.querySelectorAll("a[href], button:not([disabled])") || [])];
    return liste.filter(Boolean);
}

function handleEscape(e) {
    if (!menuOpen.value) return;
    if (e.key === "Escape") {
        closeMenu();
        // Le focus était dans le menu qui disparaît : on le rend au bouton.
        burgerEl.value?.focus();
        return;
    }
    if (e.key === "Tab") {
        // Piège de focus : Tab / Maj+Tab bouclent dans le menu.
        const el = focusablesDuMenu();
        if (!el.length) return;
        const premier = el[0];
        const dernier = el[el.length - 1];
        const actif = document.activeElement;
        if (e.shiftKey && actif === premier) {
            e.preventDefault();
            dernier.focus();
        } else if (!e.shiftKey && actif === dernier) {
            e.preventDefault();
            premier.focus();
        } else if (!el.includes(actif)) {
            e.preventDefault();
            premier.focus();
        }
    }
}

function handleDesktopMediaChange(e) {
    if (e.matches) closeMenu();
}

const isAdminRoute = computed(() => route.path.startsWith("/admin"));
const adminMode = inject("isAdmin", ref(false));
const isMounted = ref(false);
const headerStyle = computed(() => ({
    // keep SSR output stable: only apply admin offset after client mount
    top: isMounted.value && adminMode.value ? "48px" : "0px",
}));
const { hasEvenements, erreur: evenementsErreur } = useChurchEvents();
// espaceMembre : réglage ⚙️ Config, faux par défaut (lien masqué).
const { socialLinks, espaceMembre, hideEventsPageIfEmpty, loadSiteSettings } = useSiteSettings();
// `erreur` inclus volontairement : si le Worker événements ne répond pas, la
// liste est vide sans que cela veuille dire « aucun événement ». Sans ça, une
// panne de l'amont retirait le lien Événements de la navigation de TOUTES les
// pages. En cas de doute on garde le lien : la page saura expliquer.
// Le lien n'est masqué que si l'admin l'a demandé (⚙️ Config « Masquer la
// page Événements si aucun événement ») — même règle que pages/event-list.vue.
// Sans ce réglage, la page reste utile sans événement (Parcours Alpha,
// formulaire d'inscription) : la masquer d'office coupait l'accès aux
// inscriptions, et le lien manquait au rendu serveur (événements chargés au client).
const showBilletterie = computed(
    () =>
        adminMode.value ||
        isAdminRoute.value ||
        !hideEventsPageIfEmpty.value ||
        hasEvenements.value ||
        evenementsErreur.value,
);

// Menu editor integration — intercept clicks in admin mode
const {
    menuItems: _m,
    menuEditorOpen,
    openMenuEditor,
    getVisibleItems,
    getMenuItems,
    menuBgImage,
    menuLoaded,
} = useMenuEditor();
// Le menu enregistré n'était lu qu'après le chargement de la page : le rendu
// serveur (et donc le premier affichage, sur mobile surtout) montrait les
// libellés d'origine (« Événements ») au lieu des libellés renommés. On le lit
// aussi côté serveur ; une fois le menu chargé côté client (ou modifié dans
// l'éditeur), c'est lui qui fait foi.
const { data: menuServeur } = useAsyncData("menu-navigation", () =>
    $fetch("/api/menu").catch(() => null),
);
const itemsServeur = computed(() => {
    const items = menuServeur.value?.menuItems;
    return Array.isArray(items) && items.length
        ? items.filter((i) => i.to !== "/accueil")
        : null;
});
// La page Événements est masquée de la nav publique quand aucun événement
// n'est à venir — évite un lien mort vers une page vide. Toujours visible
// en mode admin pour permettre la gestion du contenu.
const navItems = computed(() => {
    const items =
        !menuLoaded.value && itemsServeur.value
            ? adminMode.value
                ? itemsServeur.value
                : itemsServeur.value.filter((i) => i.visible)
            : adminMode.value
              ? getMenuItems()
              : getVisibleItems();
    if (showBilletterie.value) return items;
    return items.filter((item) => item.to !== "/event-list");
});
const menuBgStyle = computed(() => {
    const img = menuBgImage.value || "/foule-croix.png";
    return { backgroundImage: `url("${img}")` };
});

function onNavClick(e, item) {
    if (adminMode.value) {
        // Prevent the router-link navigation and any other handlers from firing.
        // Use stopImmediatePropagation to ensure NuxtLink/router don't navigate.
        e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e.stopPropagation) e.stopPropagation();
        // open the editor for this menu item
        openMenuEditor(item.id);
    } else {
        closeMenu();
    }
}

function toggleMenu() {
    if (adminMode.value) {
        if (window !== window.top) {
            try { window.parent.postMessage({ type: 'open-menu-editor' }, '*') } catch (e) { console.warn(e) }
            return
        }
        openMenuEditor();
    } else {
        menuOpen.value = !menuOpen.value;
        lockBodyScroll(menuOpen.value);
        if (menuOpen.value) {
            // Le focus passe dans le menu (1er lien) ; Échap / burger le rend.
            nextTick(() => mobileNavEl.value?.querySelector("a[href]")?.focus());
        }
    }
}

// Déjà sur l'accueil, NuxtLink vers la même route ne fait rien : on remonte en
// haut de page à la place (ce qui rejoue aussi l'animation « Bienvenue », pilotée
// par le défilement). Ailleurs, la navigation normale reprend la main.
// Le menu mobile fige le body et restaure la position à sa fermeture : on attend
// cette fermeture avant de remonter, sinon elle annulerait le défilement.
async function onLogoClick(e) {
    if (route.path !== "/") {
        closeMenu();
        return;
    }
    e.preventDefault();
    await closeMenu();
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduit ? "auto" : "smooth" });
}

async function closeMenu() {
    if (menuOpen.value) {
        menuOpen.value = false;
        await nextTick();
        lockBodyScroll(false);
    }
}

const scrollY = ref(0);
function lockBodyScroll(lock) {
    if (lock) {
        scrollY.value = window.scrollY;
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY.value}px`;
        document.body.style.width = "100%";
        document.body.style.touchAction = "none";
    } else {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.touchAction = "";
        window.scrollTo(0, scrollY.value);
    }
}

function onScroll() {
    isScrolled.value = window.scrollY > 20;
}

watch(
    () => route.fullPath,
    () => {
        closeMenu();
    },
);

onMounted(() => {
    isMounted.value = true;
    window.addEventListener("scroll", onScroll);
    document.addEventListener("keydown", handleEscape);
    mobileMq.value = window.matchMedia("(min-width: 769px)");
    mobileMq.value.addEventListener("change", handleDesktopMediaChange);
    loadSiteSettings();
});

onUnmounted(() => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("keydown", handleEscape);
    mobileMq.value?.removeEventListener("change", handleDesktopMediaChange);
    document.body.style.overflow = "";
});
</script>

<style scoped>
.site-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-light);
    transition: box-shadow 0.3s ease;
}

.site-header.scrolled {
    box-shadow: 0 2px 20px rgba(6, 72, 134, 0.16);
}

.header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 10px 24px;
    display: flex;
    align-items: center;
    gap: 32px;
    position: relative;
}

.brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
}

.logo {
    height: 52px;
    width: auto;
    object-fit: contain;
    display: block;
}

.nav-desktop {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
}

.nav-desktop a,
.nav-admin-link {
    padding: 8px 16px;
    font-weight: 500;
    color: #064886;
    text-decoration: none;
    transition: color 0.2s;
    font-size: 0.95em;
    font-family: Helvetica, Arial, sans-serif;
}

.nav-desktop a:hover,
.nav-admin-link:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
}

.nav-desktop a.active:not(.nav-membre-link),
.nav-admin-link.active {
    color: #c8323c;
    text-decoration: none;
    border-bottom: 2px solid #c8323c;
    font-weight: 600;
}
.nav-admin-link.dimmed {
    opacity: 0.5;
}

.nav-membre-link {
    margin-left: auto;
    padding: 6px 14px;
    border: 1px solid rgba(6, 72, 134, 0.35);
    border-radius: 999px;
    font-size: 0.85em;
    white-space: nowrap;
}

.nav-membre-link:hover,
.nav-membre-link.active {
    background: #064886;
    color: #fff;
}

.nav-mobile .nav-membre-link {
    margin-left: 0;
    align-self: flex-start;
    margin-top: 8px;
}

.nav-desktop-socials {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 12px;
}

.nav-desktop-socials a {
    display: flex;
    align-items: center;
    padding: 6px;
    color: #064886;
    transition: color 0.2s;
}

.nav-desktop-socials a:hover {
    color: #c8323c;
}

.header-mobile-socials {
    display: none;
}

.burger {
    display: none;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 14px 10px;
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
}

.burger span {
    display: block;
    width: 24px;
    height: 2px;
    background: var(--text-dark);
    border-radius: 2px;
    transition:
        transform 0.3s,
        opacity 0.3s;
}

.site-header.menu-open .burger span:nth-child(1) {
    transform: translateY(7px) rotate(45deg);
}
.site-header.menu-open .burger span:nth-child(2) {
    opacity: 0;
}
.site-header.menu-open .burger span:nth-child(3) {
    transform: translateY(-7px) rotate(-45deg);
}

.nav-mobile {
    display: none;
    flex-direction: column;
    padding: 0 24px 16px;
    border-top: 1px solid var(--border-light);
    gap: 4px;
    position: relative;
    z-index: 10;
}

.nav-mobile::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.35),
        rgba(0, 0, 0, 0.55)
    );
    z-index: -1;
}

.site-header.menu-open .nav-mobile {
    display: flex;
}

.nav-mobile a,
.nav-mobile .nav-admin-link {
    padding: 12px 16px;
    border-radius: 10px;
    font-weight: 500;
    color: #ffffff;
    text-decoration: none;
    transition: color 0.2s;
    font-family: Helvetica, Arial, sans-serif;
}

.nav-mobile a:hover,
.nav-mobile .nav-admin-link:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
}

.nav-mobile a.active:not(.nav-membre-link),
.nav-mobile .nav-admin-link.active {
    color: #ffd9dc;
    text-decoration: none;
    border-bottom: 2px solid #ffd9dc;
    font-weight: 600;
}
.nav-mobile .nav-admin-link.dimmed {
    opacity: 0.5;
}
.nav-mobile a.sub-link,
.nav-mobile .nav-admin-link.sub-link {
    padding-left: 32px;
    font-size: 0.9em;
    color: rgba(255, 255, 255, 0.84);
}

.nav-desktop a:focus-visible,
.nav-mobile a:focus-visible,
.burger:focus-visible {
    outline: 2px solid #ef4b54;
    outline-offset: 2px;
}

.header-spacer {
    height: 70px;
}

@media (max-width: 768px) {
    .nav-desktop,
    .desktop-only {
        display: none;
    }
    .burger {
        display: flex;
    }
    .header-mobile-socials {
        display: flex;
        align-items: center;
        gap: 2px;
        position: absolute;
        right: 58px;
        top: 50%;
        transform: translateY(-50%);
    }
    .header-mobile-socials :deep(a) {
        display: flex;
        padding: 6px;
        color: #064886;
    }
    .site-header.menu-open .header-mobile-socials {
        display: none;
    }

    .site-header {
        backdrop-filter: none;
        background: rgba(255, 255, 255, 0.98);
    }
    .site-header.menu-open {
        background: #064886;
        border-bottom: none;
        box-shadow: none;
    }
    .site-header.menu-open .burger span {
        background: white;
    }
    .site-header.menu-open .logo {
        filter: brightness(0) invert(1);
    }
    .header-inner {
        padding: 10px 16px;
        gap: 12px;
    }
    .logo {
        height: 32px;
    }
    .brand-name {
        font-size: 0.98em;
    }
    .nav-mobile {
        position: fixed;
        top: 52px;
        left: 0;
        right: 0;
        bottom: 0;
        background-size: cover;
        background-position: center center;
        background-repeat: no-repeat;
        padding: 0 16px;
        overflow-y: auto;
        border-top: none;
        box-shadow: none;
        align-items: center;
    }

    .nav-mobile::before {
        background: linear-gradient(
            180deg,
            rgba(6, 72, 134, 0.9),
            rgba(6, 40, 80, 0.94)
        );
    }

    .site-header.menu-open .nav-mobile {
        display: flex;
        flex-direction: column;
    }
    .nav-links {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 20px 0;
        margin: auto;
    }
    .nav-links a {
        padding: 8px 0;
        font-size: 1.15em;
        font-weight: 700;
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        text-decoration: none;
        text-align: left;
    }
    .nav-links a.sub-link,
    .nav-links .nav-admin-link.sub-link {
        padding-left: 20px;
    }
    .nav-mobile a:hover {
        text-decoration: underline;
        text-underline-offset: 5px;
    }
    .nav-mobile a.active {
        color: #ffd9dc;
        border-bottom: 2px solid #ffd9dc;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    }
    .nav-mobile a.sub-link,
    .nav-mobile .nav-admin-link.sub-link {
        padding-left: 24px;
    }
    .nav-mobile-socials {
        padding: 20px 0 24px;
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-shrink: 0;
        align-self: stretch;
    }
    .nav-mobile-socials :deep(a) {
        color: #064886;
        padding: 0;
        font-size: 0;
        text-shadow: none;
        background: rgba(255, 255, 255, 0.85);
        border-radius: 50%;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .nav-mobile-socials :deep(a:hover) {
        background: rgba(255, 255, 255, 1);
        text-decoration: none;
    }
    .header-spacer {
        height: 52px;
    }
}
</style>

<style>
/* Global fallback: ensure site header is offset below admin toolbar when in admin mode */
#app-root.admin-mode .site-header {
    top: var(--admin-offset, 48px) !important;
}
/* Spacer = header height only — admin toolbar already pushes down in flow */
#app-root.admin-mode .header-spacer {
    height: 72px;
}
@media (max-width: 768px) {
    #app-root.admin-mode .header-spacer {
        height: 52px;
    }
}
/* In mobile admin mode, shift nav-mobile down to account for admin toolbar */
@media (max-width: 768px) {
    #app-root.admin-mode .nav-mobile {
        top: calc(52px + var(--admin-offset, 48px));
    }
}
</style>
