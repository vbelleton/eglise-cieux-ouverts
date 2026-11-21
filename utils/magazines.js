// Numéros du magazine : liste figée dans utils/magazines.json, tenue à jour
// par `node scripts/ajouter-magazine.mjs` (voir l'en-tête de ce script).
// Les images des pages sont dans public/magazines/<id>/ — dossier distinct de
// la route /magazine pour pouvoir l'exclure en bloc de la fonction serveur
// (`/magazines/*` dans nuxt.config.ts) sans exclure les pages elles-mêmes.
import liste from "./magazines.json";

export const TAILLES_PAGE = { s: 400, m: 1000, l: 1600 };

/**
 * Numéros affichés, du plus récent au plus ancien. Les numéros d'exemple ne
 * sont montrés que tant qu'aucun vrai numéro n'existe : le premier vrai numéro
 * les fait disparaître de la liste sans qu'il faille penser à les retirer.
 */
export function numerosAffiches(numeros = liste) {
  const tries = [...numeros].sort((a, b) => String(b.parution).localeCompare(String(a.parution)));
  const vrais = tries.filter((n) => !n.exemple);
  return vrais.length ? vrais : tries;
}

/** Un numéro par son identifiant (même un exemple masqué : son adresse reste lisible). */
export function trouverNumero(id, numeros = liste) {
  return numeros.find((n) => n.id === id) || null;
}

/** Adresse de l'image d'une page (1 = couverture) à une taille donnée. */
export function imagePage(numero, page, taille = "m") {
  return `/magazines/${numero.id}/p${String(page).padStart(3, "0")}-${taille}.webp`;
}

export function srcsetPage(numero, page) {
  return Object.entries(TAILLES_PAGE)
    .map(([taille, largeur]) => `${imagePage(numero, page, taille)} ${largeur}w`)
    .join(", ");
}

/**
 * Découpe un numéro en « vues » : ce qui est affiché à la fois.
 * - une page à la fois (téléphone, écran étroit) : [[1], [2], [3], …] ;
 * - en double page (comme un magazine ouvert) : la couverture seule à droite,
 *   puis les pages paires à gauche et impaires à droite, et la dernière page
 *   seule à gauche si le total est pair : [[null, 1], [2, 3], …, [8, null]].
 * Chaque vue est un couple [gauche, droite] ; null = côté vide.
 */
export function decouperVues(nbPages, double) {
  const vues = [];
  if (!nbPages) return vues;
  if (!double) {
    for (let p = 1; p <= nbPages; p++) vues.push([p]);
    return vues;
  }
  vues.push([null, 1]);
  for (let g = 2; g <= nbPages; g += 2) {
    vues.push([g, g + 1 <= nbPages ? g + 1 : null]);
  }
  return vues;
}

/** Index de la vue qui contient la page donnée. */
export function vueDeLaPage(vues, page) {
  const i = vues.findIndex((v) => v.includes(page));
  return i === -1 ? 0 : i;
}

/** Libellé « Page 3 sur 8 » / « Pages 2–3 sur 8 ». */
export function libelleVue(vue, nbPages) {
  const pages = (vue || []).filter(Boolean);
  if (pages.length === 2) return `Pages ${pages[0]}–${pages[1]} sur ${nbPages}`;
  return `Page ${pages[0] ?? 1} sur ${nbPages}`;
}

/** « 21 novembre 2026 » (date de parution AAAA-MM-JJ, sans décalage de fuseau). */
export function dateParution(iso) {
  const [a, m, j] = String(iso || "").split("-").map(Number);
  if (!a || !m || !j) return "";
  return new Date(a, m - 1, j).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
