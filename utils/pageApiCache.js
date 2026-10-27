// Cache client des lectures `/api/pages/:slug` + préchargement au survol des
// liens du menu.
//
// Sans lui, chaque clic dans le menu attendait l'aller-retour vers l'API (et
// derrière, Firestore) AVANT de changer de page : `await useAsyncData` suspend
// la navigation tant que sa promesse n'est pas résolue, et revenir sur une page
// déjà vue refaisait toute la lecture. Ici :
//   - survol / focus / toucher d'un lien du menu → la lecture part tout de
//     suite (`prechargerPage`), le clic arrive en général après la réponse ;
//   - une lecture faite il y a moins de DUREE_MS est réutilisée telle quelle.
//
// Côté serveur on ne met RIEN en cache : un module partagé entre requêtes y
// mélangerait les visiteurs. En admin non plus (`sansCache`) : on lit toujours
// la version à jour, et on vide le cache au passage pour qu'une page modifiée
// puis consultée en visiteur ne ressorte pas dans son ancienne version.

const DUREE_MS = 60_000;
const cache = new Map(); // url -> { promesse, t }

// Pages qui ne lisent pas /api/pages (contenu propre ou réservé) : inutile de
// les précharger.
const SANS_CONTENU_CMS = new Set(["agenda", "photos", "membre", "admin", "billetterie"]);

function urlDePage(chemin) {
    if (typeof chemin !== "string" || !chemin.startsWith("/")) return null;
    const slug = chemin.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "") || "accueil";
    if (slug.includes("/") || SANS_CONTENU_CMS.has(slug)) return null;
    return `/api/pages/${slug}`;
}

export function lirePageApi(url, { sansCache = false } = {}) {
    if (!import.meta.client) return globalThis.$fetch(url);
    if (sansCache) {
        cache.clear();
        return globalThis.$fetch(url);
    }
    const existant = cache.get(url);
    let promesse;
    if (existant && Date.now() - existant.t < DUREE_MS) {
        promesse = existant.promesse;
    } else {
        promesse = globalThis.$fetch(url);
        cache.set(url, { promesse, t: Date.now() });
        // Une lecture ratée ne doit pas rester en cache : la suivante réessaie.
        promesse.catch(() => {
            if (cache.get(url)?.promesse === promesse) cache.delete(url);
        });
    }
    // Copie : chaque page reçoit son propre objet, rien ne peut modifier la
    // réponse mémorisée.
    return promesse.then((donnees) => structuredClone(donnees));
}

export function prechargerPage(chemin) {
    if (!import.meta.client) return;
    const url = urlDePage(chemin);
    if (!url) return;
    lirePageApi(url).catch(() => {});
}

export function viderCachePages() {
    cache.clear();
}
