// Service worker du site public : rend le site installable et consultable
// hors ligne. Enregistré par plugins/pwa.client.ts.
//
// Trois règles, dans cet ordre de priorité :
//
// 1. L'ADMIN N'EST JAMAIS SERVI DEPUIS LE CACHE. Si une lecture de page
//    échouait et que le cache répondait à sa place, l'éditeur croirait avoir
//    chargé la vraie page et l'auto-save pourrait écrire une copie périmée
//    par-dessus (cf. CLAUDE.md, « ne jamais sauvegarder ce qu'on n'a pas
//    réussi à lire »). Toute requête d'un onglet admin — `/admin`,
//    `?admin=true`, aperçu `preview-inner`, ou onglet signalé par le plugin —
//    va au réseau sans que le service worker s'en mêle, tout comme les
//    requêtes authentifiées (`Authorization`) et tout ce qui n'est pas GET.
//
// 2. LE RÉSEAU D'ABORD pour le contenu (HTML, /api/pages, menu, footer,
//    agenda). Le cache n'est qu'un repli quand le réseau ne répond pas : un
//    contenu modifié dans l'admin apparaît donc à la visite suivante comme
//    avant. Seuls les bundles `/_nuxt/*` (noms hachés, immuables) et les
//    images sont servis depuis le cache en premier.
//
// 3. `/version.txt` n'est jamais intercepté : plugins/deployment-check.client.ts
//    s'en sert pour détecter un nouveau déploiement.
//
// Changer VERSION à chaque modification de ce fichier qui touche aux caches :
// l'activation supprime les caches d'une autre version.

const VERSION = 'v1'
const CACHE_PAGES = `pages-${VERSION}`
const CACHE_ASSETS = `assets-${VERSION}`
const CACHE_DATA = `data-${VERSION}`
const CACHE_IMAGES = `images-${VERSION}`
const CACHES = [CACHE_PAGES, CACHE_ASSETS, CACHE_DATA, CACHE_IMAGES]

// Plafonds par cache (entrées) : au-delà, les plus anciennes sont retirées.
const LIMITES = { [CACHE_PAGES]: 40, [CACHE_ASSETS]: 200, [CACHE_DATA]: 80, [CACHE_IMAGES]: 150 }

// Au-delà de ce délai sans réponse, une navigation se rabat sur le cache
// (réseau très lent) — la réponse réseau, si elle finit par arriver, met
// quand même le cache à jour.
const DELAI_RESEAU_MS = 6000

const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon-192.png',
  '/favicon-512.png',
  '/logo-nav.png',
]

// Lectures publiques du contenu, mises en cache pour le hors ligne.
const API_PUBLIQUES = /^\/api\/(menu|footer|settings|pages)(\/[^/]+)?$/
const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico)$/i

// Onglets que le plugin a signalés en mode admin (le mode peut s'activer
// sans `?admin=true` dans l'URL). Perdu si le service worker est arrêté,
// d'où les contrôles d'URL qui restent la première barrière.
const ongletsAdmin = new Set()

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ASSETS)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => !CACHES.includes(n)).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  const id = event.source && event.source.id
  if (data.type !== 'admin-mode' || !id) return
  if (data.actif) ongletsAdmin.add(id)
  else ongletsAdmin.delete(id)
})

function urlAdmin(url) {
  return url.pathname === '/admin' || url.pathname.startsWith('/admin/')
    || url.searchParams.has('admin') || url.searchParams.has('preview-inner')
}

async function vientDeLAdmin(event) {
  if (urlAdmin(new URL(event.request.url))) return true
  if (!event.clientId) return false
  if (ongletsAdmin.has(event.clientId)) return true
  const client = await self.clients.get(event.clientId)
  return Boolean(client && urlAdmin(new URL(client.url)))
}

async function limiter(nomCache) {
  const cache = await caches.open(nomCache)
  const cles = await cache.keys()
  const surplus = cles.length - LIMITES[nomCache]
  for (let i = 0; i < surplus; i++) await cache.delete(cles[i])
}

function cacheable(reponse) {
  return reponse && (reponse.ok || reponse.type === 'opaque')
}

async function mettreEnCache(nomCache, cle, reponse) {
  if (!cacheable(reponse)) return
  const cache = await caches.open(nomCache)
  await cache.put(cle, reponse)
  await limiter(nomCache)
}

// Réseau d'abord, cache en repli. `cle` permet de ranger une navigation sous
// son seul chemin (sans paramètres de requête).
async function reseauDAbord(event, nomCache, cle, delaiMs) {
  const reseau = fetch(event.request).then((reponse) => {
    if (cacheable(reponse)) event.waitUntil(mettreEnCache(nomCache, cle, reponse.clone()))
    return reponse
  })
  const enCache = () => caches.match(cle, { cacheName: nomCache })

  if (!delaiMs) {
    try { return await reseau } catch (e) {
      const copie = await enCache()
      if (copie) return copie
      throw e
    }
  }

  return new Promise((resolve, reject) => {
    let fini = false
    const repli = async (erreur) => {
      const copie = await enCache()
      if (fini) return
      if (copie) { fini = true; resolve(copie) } else if (erreur) { fini = true; reject(erreur) }
    }
    const minuteur = setTimeout(() => repli(null), delaiMs)
    reseau.then((reponse) => {
      clearTimeout(minuteur)
      if (!fini) { fini = true; resolve(reponse) }
    }, (erreur) => {
      clearTimeout(minuteur)
      repli(erreur)
    })
  })
}

async function cacheDAbord(event, nomCache) {
  const copie = await caches.match(event.request, { cacheName: nomCache })
  if (copie) return copie
  const reponse = await fetch(event.request)
  event.waitUntil(mettreEnCache(nomCache, event.request, reponse.clone()))
  return reponse
}

// Sert la copie en cache tout de suite et la rafraîchit en arrière-plan.
async function copiePuisMiseAJour(event, nomCache) {
  const copie = await caches.match(event.request, { cacheName: nomCache })
  const reseau = fetch(event.request).then((reponse) => {
    event.waitUntil(mettreEnCache(nomCache, event.request, reponse.clone()))
    return reponse
  })
  if (copie) {
    event.waitUntil(reseau.catch(() => {}))
    return copie
  }
  return reseau
}

async function navigation(event) {
  const url = new URL(event.request.url)
  const cle = url.origin + url.pathname
  try {
    return await reseauDAbord(event, CACHE_PAGES, cle, DELAI_RESEAU_MS)
  } catch (e) {
    const horsLigne = await caches.match('/offline.html', { cacheName: CACHE_ASSETS })
    if (horsLigne) return horsLigne
    throw e
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.headers.has('authorization')) return
  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return

  const memeOrigine = url.origin === self.location.origin
  if (memeOrigine && (url.pathname === '/version.txt' || url.pathname === '/sw.js')) return

  // Requêtes sans intérêt hors ligne : on ne les intercepte pas du tout.
  let strategie = null
  if (memeOrigine) {
    if (request.mode === 'navigate') strategie = () => navigation(event)
    else if (url.pathname.startsWith('/_nuxt/')) strategie = () => cacheDAbord(event, CACHE_ASSETS)
    else if (API_PUBLIQUES.test(url.pathname)) strategie = () => reseauDAbord(event, CACHE_DATA, request)
    else if (url.pathname.startsWith('/api/media/uploads/') || (!url.pathname.startsWith('/api/') && IMAGE.test(url.pathname))) {
      strategie = () => copiePuisMiseAJour(event, CACHE_IMAGES)
    }
  } else if (url.pathname === '/api/church-events') {
    // Agenda servi par le Worker eglise-app (autre origine).
    strategie = () => reseauDAbord(event, CACHE_DATA, request)
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    strategie = () => copiePuisMiseAJour(event, CACHE_ASSETS)
  }
  if (!strategie) return

  event.respondWith((async () => {
    if (await vientDeLAdmin(event)) return fetch(request)
    return strategie()
  })())
})
