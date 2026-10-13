// Où chaque image est affichée : balaie les pages (contenu enregistré, ou
// contenu par défaut quand la page n'a jamais été sauvegardée), le footer, et
// tient compte des valeurs par défaut des blocs (un champ image vide affiche
// l'image par défaut du type de bloc) et des réglages par appareil.
//
// Le résultat associe une adresse d'image (« /images/x.jpg »,
// « /api/media/uploads/123_photo.jpg ») à la liste des endroits qui l'utilisent.
import { BLOCK_TYPES, normalizePageBlocks } from '~/utils/blockTypes.js'
import { normalizeBlock } from '~/lib/blocks/renderer'

const PAGES_DU_SITE = ['accueil', 'messages', 'agenda', 'event-list', 'contact', 'photos']
const MOTIF_IMAGE = /\/[A-Za-z0-9._\/-]+\.(?:png|jpe?g|webp|gif|svg|avif)/gi

const NOMS_PAGES = {
  accueil: 'Accueil', messages: 'Messages', agenda: 'Agenda',
  'event-list': 'Évènements', contact: 'Contact', photos: 'Photos',
}

function imagesDuBloc(bloc) {
  const normalise = normalizeBlock(bloc)
  const texte = JSON.stringify({ props: normalise?.props, responsive: bloc?.responsive }) || ''
  return new Set(texte.match(MOTIF_IMAGE) || [])
}

function ajouter(usage, bloc, page) {
  const nom = BLOCK_TYPES[bloc?.type]?.label || bloc?.type || 'Bloc'
  for (const image of imagesDuBloc(bloc)) {
    if (!usage.has(image)) usage.set(image, [])
    const liste = usage.get(image)
    if (!liste.some(l => l.page === page && l.bloc === nom)) liste.push({ page, bloc: nom })
  }
}

async function lireJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/** Map<adresse d'image, { page, bloc }[]> */
export async function calculerUsageImages() {
  const usage = new Map()
  const liste = (await lireJson('/api/pages'))?.pages || []
  const pages = new Map(liste.filter(p => !p._deleted).map(p => [p.slug, p.title || p.slug]))
  for (const slug of PAGES_DU_SITE) if (!pages.has(slug)) pages.set(slug, NOMS_PAGES[slug])

  await Promise.all([...pages].map(async ([slug, titre]) => {
    const data = await lireJson(`/api/pages/${encodeURIComponent(slug)}`)
    // Page illisible : on ne devine rien (pas de faux « non utilisée »).
    if (!data) return
    const blocs = normalizePageBlocks(slug, data.blocks || [])
    for (const bloc of blocs) ajouter(usage, bloc, NOMS_PAGES[slug] || titre)
  }))

  const footer = await lireJson('/api/footer')
  ajouter(usage, { type: 'footer', props: footer?.props || {} }, 'Pied de page (toutes les pages)')
  return usage
}

/** Résumé court : « Accueil, Contact » ou « Accueil + 2 autres ». */
export function resumeUsage(endroits) {
  if (!endroits?.length) return ''
  const pages = [...new Set(endroits.map(e => e.page))]
  return pages.length <= 2 ? pages.join(', ') : `${pages[0]} + ${pages.length - 1} autres`
}

/** Détail : « Accueil (Hero), Contact (Formulaire) ». */
export function detailUsage(endroits) {
  return (endroits || []).map(e => `${e.page} (${e.bloc})`).join(', ')
}
