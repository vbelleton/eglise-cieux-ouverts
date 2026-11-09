<template>
  <!-- Page d'erreur de Nuxt (404, 500…). Rendue HORS du layout : on remet
       l'en-tête et le pied de page du site à la main, sans la mécanique
       d'édition de layouts/default.vue (barre admin, auto-save) qui n'a rien
       à faire sur une page qui n'existe pas. -->
  <div id="app-root" class="page-erreur-racine">
    <a href="#contenu" class="skip-link">Aller au contenu</a>
    <SiteHeader />
    <main id="contenu" class="site-main error-page" tabindex="-1" :data-statut="statut">
      <section class="error-ciel">
        <div class="error-content">
          <p class="error-code" aria-hidden="true">{{ statut }}</p>
          <h1 class="error-title">{{ info.titre }}</h1>
          <p class="error-message">{{ info.message }}</p>
          <p v-if="info.detail" class="error-detail">{{ info.detail }}</p>

          <div class="error-actions">
            <button
              v-if="estPanneServeur"
              type="button"
              class="btn-error btn-primary"
              @click="reessayer"
            >
              Réessayer
            </button>
            <NuxtLink to="/" :class="['btn-error', estPanneServeur ? 'btn-outline' : 'btn-primary']">
              Retour à l'accueil
            </NuxtLink>
            <button v-if="statut === 404 && isAdminMode" type="button" class="btn-error btn-outline" @click="goHomeAdmin">
              Mode édition
            </button>
            <NuxtLink v-if="statut === 401 || statut === 403" to="/membre" class="btn-error btn-outline">
              Espace membre
            </NuxtLink>
          </div>
        </div>
      </section>

      <section class="error-suggestions" aria-labelledby="error-suggestions-titre">
        <h2 id="error-suggestions-titre" class="error-suggestions-titre">Vous cherchiez peut-être…</h2>
        <ul class="error-links">
          <li v-for="lien in suggestions" :key="lien.to">
            <NuxtLink :to="lien.to" class="error-carte">
              <span class="error-carte-titre">{{ lien.titre }}</span>
              <span class="error-carte-texte">{{ lien.texte }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </main>
    <BlockFooter v-bind="footerBlock.props" :block-id="footerBlock.id" />
  </div>
</template>

<script setup>
import BlockFooter from '~/components/blocks/BlockFooter.vue'

// Nuxt passe l'erreur dans la prop `error` (NuxtError). L'ancienne version
// lisait une prop `statusCode` que Nuxt ne fournit jamais : toute erreur,
// panne serveur comprise, s'affichait « 404 Page introuvable ».
const props = defineProps({
  error: { type: Object, default: () => ({}) },
})

const { isAdminMode, footerBlock, loadFooterBlock } = useAdmin()
const { loadMenuFromFirestore } = useMenuEditor()

const statut = computed(() => {
  const code = Number(props.error?.statusCode ?? props.error?.status)
  return Number.isInteger(code) && code >= 400 && code < 600 ? code : 500
})
const estPanneServeur = computed(() => statut.value >= 500)

const MESSAGES = {
  404: {
    titre: 'Cette page est introuvable',
    message: "Le lien est peut-être ancien, ou une lettre s'est glissée de travers dans l'adresse.",
    detail: 'Le reste du site est bien là : voici quelques pistes pour retrouver votre chemin.',
  },
  410: {
    titre: "Cette page n'existe plus",
    message: 'Elle a été retirée du site.',
    detail: 'Voici quelques pistes pour retrouver ce que vous cherchiez.',
  },
  401: {
    titre: 'Accès réservé',
    message: 'Cette page est réservée aux membres de l\'église.',
    detail: 'Connectez-vous depuis l\'espace membre, ou écrivez-nous si vous pensez y avoir droit.',
  },
  403: {
    titre: 'Accès réservé',
    message: "Votre compte n'a pas accès à cette page.",
    detail: 'Si vous pensez que c\'est une erreur, écrivez-nous et nous regarderons.',
  },
  500: {
    titre: 'Un souci passager',
    message: "Une erreur inattendue s'est produite de notre côté. Ce n'est pas vous !",
    detail: 'Réessayez dans un instant ; si le problème persiste, prévenez-nous.',
  },
  503: {
    titre: 'Le site fait une courte pause',
    message: 'Le service est momentanément indisponible.',
    detail: 'Réessayez dans quelques minutes.',
  },
}

const info = computed(() => {
  if (MESSAGES[statut.value]) return MESSAGES[statut.value]
  if (estPanneServeur.value) return MESSAGES[500]
  return {
    titre: 'Cette page ne peut pas s\'afficher',
    message: 'La demande n\'a pas pu aboutir.',
    detail: 'Voici quelques pistes pour retrouver votre chemin.',
  }
})

// Pas de lien vers /predications : page volontairement cachée.
const suggestions = [
  { to: '/agenda', titre: 'Agenda', texte: 'Les prochains rendez-vous' },
  { to: '/event-list', titre: 'Événements', texte: 'Parcours Alpha et temps forts' },
  { to: '/messages', titre: 'Messages', texte: 'Les dernières prédications' },
  { to: '/contact', titre: 'Contact', texte: 'Nous écrire ou nous trouver' },
]

useSeoMeta({
  title: () => `${info.value.titre} — Église Cieux Ouverts`,
  description: () => info.value.message,
  robots: 'noindex',
})

// Ce que layouts/default.vue charge d'habitude au montage : sans le menu,
// SiteHeader garde ses liens masqués (menu-pending) quand /api/menu n'a rien
// renvoyé au rendu serveur.
onMounted(() => {
  loadFooterBlock()
  loadMenuFromFirestore()
})


function reessayer() {
  window.location.reload()
}

function goHomeAdmin() {
  window.location.replace('/?admin=true')
}
</script>

<style scoped>
.page-erreur-racine {
  background: #fff;
}

.error-page {
  display: flex;
  flex-direction: column;
}

/* Un ciel qui s'ouvre : dégradé bleu vers blanc, deux halos doux. */
.error-ciel {
  position: relative;
  overflow: clip;
  padding: clamp(56px, 10vw, 110px) 16px clamp(48px, 8vw, 80px);
  text-align: center;
  background:
    radial-gradient(ellipse 60% 45% at 50% 0%, rgba(255, 255, 255, 0.9), transparent 70%),
    radial-gradient(ellipse 40% 35% at 85% 20%, rgba(217, 119, 119, 0.18), transparent 70%),
    linear-gradient(to bottom, #dcebf8 0%, #eef5fc 55%, #ffffff 100%);
}

.error-content {
  position: relative;
  max-width: 620px;
  margin: 0 auto;
}

.error-code {
  font-family: var(--font-heading);
  font-size: clamp(88px, 22vw, 168px);
  font-weight: 700;
  line-height: 1;
  margin: 0 0 8px;
  background: linear-gradient(135deg, var(--primary-blue) 20%, var(--primary-pink) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  opacity: 0.85;
}

.error-title {
  font-family: var(--font-heading);
  font-size: clamp(1.7rem, 5vw, 2.5rem);
  color: var(--primary-blue);
  margin: 0 0 14px;
  line-height: 1.2;
}

.error-message {
  font-size: 1.12rem;
  color: #1f2937;
  margin: 0 0 6px;
  line-height: 1.6;
}

.error-detail {
  color: #4b5563;
  margin: 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 30px;
}

.btn-error {
  display: inline-block;
  padding: 13px 28px;
  border-radius: 50px;
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.btn-error:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(6, 72, 134, 0.2);
  text-decoration: none;
}

.btn-error:focus-visible {
  outline: 3px solid var(--primary-pink);
  outline-offset: 3px;
}

.btn-primary {
  background: var(--gradient-accent) border-box;
  color: #fff;
}

.btn-outline {
  background: #fff;
  color: var(--primary-blue);
  border-color: var(--primary-blue);
}

.btn-outline:hover {
  background: #f1f6fb;
}

.error-suggestions {
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: 8px 16px clamp(48px, 8vw, 80px);
  text-align: center;
}

.error-suggestions-titre {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  color: var(--primary-blue);
  margin: 0 0 20px;
}

.error-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}

.error-carte {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: 18px 20px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e3ecf5;
  box-shadow: 0 2px 12px rgba(6, 72, 134, 0.06);
  text-decoration: none;
  text-align: left;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.error-carte:hover {
  transform: translateY(-2px);
  border-color: var(--primary-pink);
  box-shadow: 0 8px 22px rgba(6, 72, 134, 0.12);
  text-decoration: none;
}

.error-carte:focus-visible {
  outline: 3px solid var(--primary-pink);
  outline-offset: 2px;
}

.error-carte-titre {
  font-weight: 700;
  color: var(--primary-blue);
}

.error-carte-texte {
  font-size: 0.92rem;
  color: #4b5563;
}

@media (prefers-reduced-motion: reduce) {
  .btn-error,
  .error-carte {
    transition: none;
  }
  .btn-error:hover,
  .error-carte:hover {
    transform: none;
  }
}
</style>
