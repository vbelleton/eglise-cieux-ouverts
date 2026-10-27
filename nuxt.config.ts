// Build-time sanity check: when running in CI / Pages environments, fail the
// build early if the public Firebase API key is missing. This prevents silent
// deployments where the client bundle can't initialize Firebase and causes
// a degraded production site.
const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.PAGES_BRANCH || process.env.PAGES || process.env.CF_PAGES)
if (isCI && process.env.NODE_ENV === "production" && !process.env.NUXT_PUBLIC_FIREBASE_API_KEY) {
  throw new Error('Missing NUXT_PUBLIC_FIREBASE_API_KEY in environment. Please set NUXT_PUBLIC_FIREBASE_API_KEY in your Pages environment variables before deploying.')
}

export default defineNuxtConfig({
  css: ['~/assets/css/main.css', '~/assets/css/event-modal.css', '~/assets/css/no-js.css'],
  experimental: {
    appManifest: false
  },
  compatibilityDate: '2026-07-31',
  // @ts-expect-error: routeRules valid at runtime but absent from this Nuxt version's InputConfig type
  routeRules: {
    '/billetterie': { redirect: '/event-list' },
    // Source UNIQUE des en-têtes de sécurité : ces règles s'appliquent aux
    // réponses SSR et sont en plus recopiées par Nitro dans le `_headers`
    // final pour les fichiers statiques. Les redéclarer dans `public/_headers`
    // ferait doublon et Cloudflare joindrait les deux valeurs par une virgule
    // (« SAMEORIGIN, SAMEORIGIN »), valeur invalide ignorée par les
    // navigateurs. Ne jamais y ajouter `cache-control` non plus : la règle
    // s'appliquerait à `/*` et écraserait le cache long de `/_nuxt/*`
    // (voir public/_headers).
    '/**': {
      headers: {
        'x-frame-options': 'SAMEORIGIN',
        // Équivalent moderne de x-frame-options, seule directive CSP posée
        // ici : une CSP complète casserait les styles en ligne du contenu
        // collé en richText et le SDK Firebase. `frame-ancestors` n'a aucun
        // effet de bord et couvre les navigateurs qui ignorent l'en-tête
        // historique.
        'content-security-policy': "frame-ancestors 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=()',
        // Sans `includeSubDomains` : le domaine cieuxouverts.bzh n'est pas
        // encore rattaché à ce projet Pages, et rien ne garantit que tous ses
        // futurs sous-domaines seront en HTTPS.
        'strict-transport-security': 'max-age=15552000',
      },
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr', class: 'no-js' },
      // Retire la classe no-js dès que JS s'exécute : avec JS désactivé elle
      // reste et active les fallbacks CSS (contenu/animations visibles, SEO).
      script: [{ innerHTML: "document.documentElement.classList.remove('no-js')", tagPosition: 'head' }],
      // Application installable (PWA) : manifeste + service worker
      // (public/sw.js, enregistré par plugins/pwa.client.ts).
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-180.png' },
      ],
      // `main` est la seule branche destinée à être indexée. Cloudflare
      // Pages construit toute autre branche en Preview — donc chaque PR a
      // sa propre URL publique (`https://<hash>.eglise-cieux-ouverts.pages.dev`)
      // — mais cette règle ne visait que `recette` : une preview de PR
      // restait indexable si un robot la découvrait. `CF_PAGES_BRANCH` est
      // absent en dev/build local (build:e2e compris), d'où la garde sur sa
      // présence : ne pas ajouter ce meta hors Cloudflare Pages.
      meta: [
        { name: 'theme-color', content: '#064886' },
        // Nom sous l'icône une fois ajouté à l'écran d'accueil d'un iPhone.
        { name: 'apple-mobile-web-app-title', content: 'Cieux Ouverts' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        ...(process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== 'main'
          ? [{ name: 'robots', content: 'noindex, nofollow' }]
          : []),
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  typescript: {
    typeCheck: false,
    strict: false,
    shim: false
  },
  components: [
    { path: '~/components', global: true },
    { path: '~/components/editor', global: true }
  ],
  nitro: {
    preset: process.env.PW_TEST === '1' ? 'node-server' : 'cloudflare-pages',
  },
  hooks: {
    'build:before': async () => {
      const { mkdirSync, writeFileSync } = await import('node:fs')
      mkdirSync('.nuxt/dist/server', { recursive: true })
      // Horodatage de build lu par plugins/deployment-check.client.ts pour
      // détecter un nouveau déploiement et forcer un reload. Placé ici (hook
      // Nuxt) plutôt que dans un script npm : `nuxt build` est invoqué
      // directement par plusieurs scripts (deploy, build:e2e) qui ne
      // passaient pas tous par le script `build` — le fichier n'était donc
      // jamais rafraîchi lors d'un vrai déploiement.
      writeFileSync('public/version.txt', Date.now().toString())
    }
  },
  watchers: {
    chokidar: {
      ignored: /(^|[/\\])\.opencode([/\\]|$)/
    }
  },
  vite: {
    server: { watch: { ignored: ['**/.opencode/**'] } }
  },
  runtimeConfig: {
    firebaseProjectId: process.env.NUXT_FIREBASE_PROJECT_ID || '',
    firebaseClientEmail: process.env.NUXT_FIREBASE_CLIENT_EMAIL || '',
    firebasePrivateKey: process.env.NUXT_FIREBASE_PRIVATE_KEY || '',
    public: {
      TEST_ENV: !!process.env.PW_TEST,
      FIREBASE_API_KEY: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      // Adresse publique du site : balise canonical, Open Graph, données
      // structurées. À changer (NUXT_PUBLIC_SITE_URL) quand cieuxouverts.bzh
      // sera rattaché à ce projet Pages.
      SITE_URL: process.env.NUXT_PUBLIC_SITE_URL || 'https://eglise-cieux-ouverts.pages.dev',
      FIREBASE_APP_ID: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      apiUrl: process.env.PUBLIC_API_URL || process.env.NUXT_PUBLIC_API_URL
    }
  }
})
