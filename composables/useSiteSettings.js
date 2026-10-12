import { ref } from "vue";

// Réglages globaux du site (pas liés à une page/un bloc en particulier) —
// pour l'instant uniquement les liens réseaux sociaux, affichés à
// plusieurs endroits (SiteHeader.vue, BlockContact.vue, BlockBienvenue.vue)
// qui codaient auparavant les mêmes URLs en dur indépendamment à 3
// endroits. Singleton (état de module partagé, même pattern que
// useAdmin.js) : chargé une seule fois, réutilisé par tous les composants.
//
// Initialisé avec les mêmes valeurs de repli que /api/settings (voir
// normalizeSocialLinks côté serveur) pour que le rendu SSR affiche déjà les
// bonnes icônes sans attendre le fetch client — même pattern que
// _defaultFooterBlock()/loadFooterBlock() dans useAdmin.js. loadSiteSettings()
// (appelé au client, onMounted) confirme/actualise ensuite depuis Firestore.
const socialLinks = ref([
  { platform: "instagram", url: "https://www.instagram.com/eglise_cieux_ouverts/" },
  { platform: "facebook", url: "https://www.facebook.com/eglisecieuxouverts" },
]);
// Ordre des onglets de pages/membre.vue (Ressources/Demandes/Événements),
// réglable depuis la modale Configuration admin — même valeur de repli que
// normalizeMemberTabOrder() côté serveur (server/api/settings/index.get.ts).
const memberTabOrder = ref(["ressources", "demandes", "evenements"]);
// Espace membre (comptes) : masqué par défaut, comme côté serveur.
const espaceMembre = ref(false);
// « Masquer la page Événements si aucun événement à venir » (⚙️ Config).
const hideEventsPageIfEmpty = ref(false);
let _loaded = false;
let _loadPromise = null;

async function loadSiteSettings() {
  if (_loaded) return;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.socialLinks)) socialLinks.value = data.socialLinks;
      if (Array.isArray(data.memberTabOrder)) memberTabOrder.value = data.memberTabOrder;
      espaceMembre.value = data.espaceMembre === true;
      hideEventsPageIfEmpty.value = data.hideEventsPageIfEmpty === true;
    } catch (e) {
      console.warn("useSiteSettings: could not load settings", e);
    } finally {
      _loaded = true;
    }
  })();
  return _loadPromise;
}

export function useSiteSettings() {
  return {
    socialLinks,
    memberTabOrder,
    espaceMembre,
    hideEventsPageIfEmpty,
    loadSiteSettings,
  };
}
