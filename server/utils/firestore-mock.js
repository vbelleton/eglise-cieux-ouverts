// /server/utils/firestore-mock.js

// Fixture canonique des pages mock, utilisée à la fois pour l'état initial
// du module et par resetMock() — une seule source pour éviter que les deux
// dérivent (resetMock() avait sa propre copie tronquée sans 'test-blocks'
// ni le bloc richText d'event-list, cassant silencieusement tout test
// naviguant vers /test-blocks après un appel à resetMock()).
function defaultPages() {
  return {
  // Page de test du bloc louange (dans les defaults pour survivre aux
  // resetMock concurrents des autres fichiers de spec Playwright)
  'louange-test': {
    blocks: [
      {
        id: 'block-louange-1',
        type: 'louange',
        props: {
          title: "Rejoins l'équipe louange",
          intro: 'Postule au poste qui te correspond.',
          positions: [
            { key: 'chant', poste: 'Chant', description: 'Chanter le dimanche.', places: 2 },
            { key: 'batterie', poste: 'Batterie', description: 'Tenir le rythme.', places: 1 },
          ],
        },
      },
    ],
  },
  'event-list': {
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        props: {
          overlayText: 'Événements à venir',
          overlay: true,
        },
      },
      {
        id: 'block-text-img',
        type: 'textImage',
        props: {
          title: 'Un texte de présentation avec un Drag & Drop possible.',
          image: '/test-img.gif',
        },
      },
      {
        id: 'block-spacer',
        type: 'spacer',
        props: { height: 25 },
      },
      {
        id: 'block-richtext',
        type: 'richText',
        props: {
          content: '<div style="max-width:820px;margin:0 auto;text-align:center;"><h1>Billetterie Événements</h1><p>Découvrez et réservez vos places.</p></div>',
          animation: 'fadeIn',
        },
      },
    ],
  },
  accueil: {
    blocks: [
      {
        id: 'bloc-hero',
        type: 'hero',
        props: {},
      },
      {
        id: 'bloc-bienvenue',
        type: 'bienvenue',
        props: {},
      },
      {
        id: 'bloc-rejoins',
        type: 'rejoins',
        props: {},
      },
      {
        id: 'bloc-aspirations',
        type: 'aspirations',
        props: {},
      },
      {
        id: 'bloc-vision',
        type: 'vision',
        props: {},
      },
      {
        id: 'bloc-activities',
        type: 'activities',
        props: {},
      },
      {
        id: 'bloc-nousRejoindre',
        type: 'nousRejoindre',
        props: {},
      },
      {
        id: 'bloc-contact',
        type: 'contact',
        props: {},
      },
    ],
  },
  // Fixture de test : un bloc de chaque type + 3 animations wrapper distinctes.
  // Sert aux tests « tous les blocs rendent » et « système d'animation ».
  'test-blocks': {
    blocks: [
      { id: 'tb-hero', type: 'hero', props: {} },
      { id: 'tb-bienvenue', type: 'bienvenue', props: {} },
      { id: 'tb-activities', type: 'activities', props: {} },
      { id: 'tb-textImage', type: 'textImage', props: { title: 'Texte + image', image: '/test-img.gif' } },
      { id: 'tb-rejoins', type: 'rejoins', props: {} },
      { id: 'tb-aspirations', type: 'aspirations', props: {} },
      { id: 'tb-contact', type: 'contact', props: {} },
      { id: 'tb-nousRejoindre', type: 'nousRejoindre', props: {} },
      { id: 'tb-richText', type: 'richText', props: { content: '<h2>Bloc richText animé</h2><p>Contenu de démonstration.</p>', animation: 'fadeIn' } },
      { id: 'tb-gallery', type: 'gallery', props: { images: [{ src: '/test-img.gif', alt: 'a' }, { src: '/test-img.gif', alt: 'b' }], animation: 'slideLeft' } },
      { id: 'tb-spacer', type: 'spacer', props: { height: 40 } },
      { id: 'tb-youtube', type: 'youtube', props: { videoId: 'wZebQj0gR98', title: 'Démo' } },
      { id: 'tb-vision', type: 'vision', props: {} },
      { id: 'tb-fullWidthImage', type: 'fullWidthImage', props: { image: '/test-img.gif', animation: 'portal' } },
      { id: 'tb-equipe', type: 'equipe', props: { members: [{ name: 'Jean Test', role: 'Pasteur', photo: '', description: 'Membre de démonstration' }] } },
      { id: 'tb-faq', type: 'faq', props: { items: [{ question: 'Question de test ?', answer: 'Réponse de test.' }] } },
      { id: 'tb-louange', type: 'louange', props: {} },
      { id: 'tb-stats', type: 'stats', props: {} },
      { id: 'tb-iconGrid', type: 'iconGrid', props: {} },
      { id: 'tb-quote', type: 'quote', props: {} },
      { id: 'tb-bandeau', type: 'bandeau', props: {} },
      { id: 'tb-inscriptionAlpha', type: 'inscriptionAlpha', props: {} },
      { id: 'tb-evenements', type: 'evenements', props: {} },
      { id: 'tb-footer', type: 'footer', props: {} },
    ],
  },
  }
}

// Memo en RAM pour simuler la persistance (reset à chaque test run)
let PAGES = defaultPages()

export function getPageDoc(slug) {
  const found = PAGES[slug]
  // exists=false permet à pages/[slug].vue de distinguer "vraiment inconnu"
  // (404) de "page réelle mais vide" (nouvelle page admin) ; une page
  // soft-deleted (_deleted) compte comme inexistante pour le routage public.
  const exists = !!found && !found._deleted
  // Deep clone pour éviter mutations
  return JSON.parse(JSON.stringify({ ...(found || { blocks: [] }), exists }))
}

export function resetMock() {
  PAGES = defaultPages()
  COMMENTS = {}
  CONTACTS = {}
  VERSIONS = {}
  SETTINGS = { config: { contactEmails: ['belletonv@gmail.com'] } }
  EMAIL_QUOTA = { month: null, count: 0 }
  ADMIN_USERS = [{ email: 'ci-admin@tests.fr', role: 'admin' }]
  MENU = { menuItems: null, menuBgImage: '' }
  FOOTER = null
  TACHES = {}
}

export function getPages() {
  return PAGES
}

// Permet d’enregistrer un nouvel état de page (écrase pour test undo/redo)
export async function setPageDoc(slug, data) {
  PAGES[slug] = JSON.parse(JSON.stringify(data))
  return { success: true }
}

// Mock du menu (settings/menu) — évite que menu.get/put tapent la vraie
// base pendant les tests (le menu réel de prod ne doit jamais être touché)
let MENU = { menuItems: null, menuBgImage: '' }

export function getMenuMock() {
  return JSON.parse(JSON.stringify(MENU))
}

export async function setMenuMock(data) {
  MENU = JSON.parse(JSON.stringify(data))
  return { success: true }
}

// Mock du footer (settings/footer)
let FOOTER = null

export function getFooterMock() {
  return FOOTER ? JSON.parse(JSON.stringify(FOOTER)) : null
}

export async function setFooterMock(data) {
  FOOTER = JSON.parse(JSON.stringify(data))
  return { success: true }
}

// Mock des demandes développeur (collection top-level 'comments') — notes
// admin-only attachées à un bloc, jamais rendues côté public.
let COMMENTS = {}

export function getComments() {
  return Object.values(JSON.parse(JSON.stringify(COMMENTS)))
}

export function getComment(id) {
  return COMMENTS[id] ? JSON.parse(JSON.stringify(COMMENTS[id])) : null
}

export function setComment(id, data) {
  COMMENTS[id] = JSON.parse(JSON.stringify(data))
  return { success: true }
}

export function deleteComment(id) {
  delete COMMENTS[id]
  return { success: true }
}

// Mock des messages du formulaire de contact (collection top-level 'contacts')
let CONTACTS = {}

export function getContacts() {
  return Object.values(JSON.parse(JSON.stringify(CONTACTS)))
}

export function getContact(id) {
  return CONTACTS[id] ? JSON.parse(JSON.stringify(CONTACTS[id])) : null
}

export function setContact(id, data) {
  CONTACTS[id] = JSON.parse(JSON.stringify(data))
  return { success: true }
}

export function deleteContact(id) {
  delete CONTACTS[id]
  return { success: true }
}

// Mock du tableau des tâches (collection 'taches'). `_rev` simule le
// updateTime de Firestore : il sert de précondition pour la prise de tâche,
// afin que le mock reproduise le même refus de double prise qu'en réel.
let TACHES = {}

export function getTaches() {
  return Object.values(JSON.parse(JSON.stringify(TACHES)))
}

export function getTache(id) {
  return TACHES[id] ? JSON.parse(JSON.stringify(TACHES[id])) : null
}

export function setTache(id, data) {
  const rev = (TACHES[id]?._rev ?? 0) + 1
  TACHES[id] = JSON.parse(JSON.stringify({ ...data, _rev: rev }))
  return { success: true }
}

export function deleteTache(id) {
  delete TACHES[id]
  return { success: true }
}

/** Renvoie false si la tâche a changé depuis la lecture (double prise). */
export function setTacheIfUnchanged(id, data, expectedRev) {
  const current = TACHES[id]
  if (!current || current._rev !== expectedRev) return false
  TACHES[id] = JSON.parse(JSON.stringify({ ...current, ...data, _rev: current._rev + 1 }))
  return true
}

// Mock de la config (collection 'settings', document 'config')
let SETTINGS = { config: { contactEmails: ['belletonv@gmail.com'] } }

export function getSettings() {
  return SETTINGS.config ? JSON.parse(JSON.stringify(SETTINGS.config)) : { contactEmails: ['belletonv@gmail.com'] }
}

export function setSettings(data) {
  SETTINGS.config = JSON.parse(JSON.stringify(data))
  return { success: true }
}

// Mock du quota d'envoi d'emails (collection 'settings', document 'emailQuota')
// Compteur mensuel remis à zéro à chaque changement de mois (format 'YYYY-MM').
let EMAIL_QUOTA = { month: null, count: 0 }

export function getEmailQuota() {
  return JSON.parse(JSON.stringify(EMAIL_QUOTA))
}

export function incrementEmailQuota() {
  const month = new Date().toISOString().slice(0, 7)
  if (EMAIL_QUOTA.month !== month) {
    EMAIL_QUOTA = { month, count: 0 }
  }
  EMAIL_QUOTA.count++
  return JSON.parse(JSON.stringify(EMAIL_QUOTA))
}

// Mock des comptes admin (collection 'settings', document 'admins').
// L'utilisateur mock CI (voir plugins/auth-mock.client.ts) est admin par
// défaut, pour que le bypass client ?admin=true corresponde à un vrai accès
// admin côté serveur si un test appelle /api/admin/*.
let ADMIN_USERS = [{ email: 'ci-admin@tests.fr', role: 'admin' }]

export function getAdminUsersMock() {
  return JSON.parse(JSON.stringify(ADMIN_USERS))
}

export function setAdminUsersMock(users) {
  ADMIN_USERS = JSON.parse(JSON.stringify(users))
  return { success: true }
}

// Mock de l'historique des versions (sous-collection Firestore réelle
// pages/{slug}/versions/{versionId}) — clé = slug, valeur = liste de
// { id, blocks, savedAt, savedBy }.
let VERSIONS = {}

export function getVersionsRaw(slug) {
  return JSON.parse(JSON.stringify(VERSIONS[slug] || []))
}

export function addVersion(slug, data) {
  if (!VERSIONS[slug]) VERSIONS[slug] = []
  VERSIONS[slug].push(JSON.parse(JSON.stringify(data)))
  return { success: true }
}

export function getVersion(slug, versionId) {
  const v = (VERSIONS[slug] || []).find(x => x.id === versionId)
  return v ? JSON.parse(JSON.stringify(v)) : null
}

export function deleteVersionMock(slug, versionId) {
  VERSIONS[slug] = (VERSIONS[slug] || []).filter(x => x.id !== versionId)
  return { success: true }
}
