// Référencement et aperçu de partage d'une page : titre, description,
// balise canonical, Open Graph et Twitter — au même endroit pour toutes les
// pages (avant, seul l'accueil avait de quoi alimenter un aperçu de partage).
// `path` : chemin canonique (ex. "/contact") ; par défaut la route courante
// sans paramètres de requête (?admin=true, ?device=… ne doivent pas
// produire de « page dupliquée »).
const IMAGE_PAR_DEFAUT = "/images/activites-celebration.jpg";

export function usePageSeo({ title, description, path, image } = {}) {
  const config = useRuntimeConfig();
  const route = useRoute();
  const site = String(config.public.SITE_URL || "").replace(/\/+$/, "");
  const chemin = computed(() => {
    const p = toValue(path) || route.path || "/";
    return p === "/" ? "" : p.replace(/\/+$/, "");
  });
  const url = computed(() => `${site}${chemin.value}` || site);
  const imageAbsolue = computed(() => {
    const i = toValue(image) || IMAGE_PAR_DEFAUT;
    return /^https?:\/\//i.test(i) ? i : `${site}${i}`;
  });

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: url,
    // URL ABSOLUE obligatoire : Open Graph ne résout pas les chemins relatifs.
    ogImage: imageAbsolue,
    ogType: "website",
    twitterCard: "summary_large_image",
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: imageAbsolue,
  });
  useHead({ link: [{ rel: "canonical", href: url }] });
}
