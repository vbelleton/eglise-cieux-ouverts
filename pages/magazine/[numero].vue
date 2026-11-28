<template>
  <div class="page-numero">
    <header class="numero-entete">
      <NuxtLink to="/magazine" class="numero-retour">← Tous les numéros</NuxtLink>
      <h1 class="numero-titre">{{ numero.titre }}</h1>
      <p class="numero-date">
        {{ numero.exemple ? 'Exemple' : `Paru le ${dateParution(numero.parution)}` }} · {{ numero.pages }} pages
      </p>
    </header>

    <MagazineLiseuse class="js-only" :numero="numero" :page-initiale="pageInitiale" />

    <!-- Sans JavaScript : les pages les unes sous les autres, chargées au fil
         du défilement par le navigateur. Pas de <noscript> (écart
         d'hydratation, voir assets/css/no-js.css) : avec JS le bloc est en
         display:none, et ses images en `loading="lazy"` ne sont jamais demandées. -->
    <div class="numero-sans-js nojs-only">
      <img
        v-for="p in numero.pages"
        :key="p"
        :src="imagePage(numero, p, 'm')"
        :width="numero.largeur"
        :height="numero.hauteur"
        :alt="`Page ${p}`"
        loading="lazy"
      >
    </div>

    <p class="numero-aide">
      Glissez la page ou touchez un bord pour tourner · flèches du clavier ← → · « Pages » pour aller directement à une page.
      <template v-if="numero.pdf">
        Version PDF : <a :href="numero.pdf" download>télécharger</a>.
      </template>
    </p>
  </div>
</template>

<script setup>
import { trouverNumero, imagePage, dateParution } from '~/utils/magazines.js'

const route = useRoute()
const numero = trouverNumero(String(route.params.numero || ''))
if (!numero) {
  throw createError({ statusCode: 404, statusMessage: 'Numéro introuvable', fatal: true })
}
const pageInitiale = Number.parseInt(String(route.query.page || '1'), 10) || 1

usePageSeo({
  title: `${numero.titre} — Magazine Cieux Ouverts`,
  description: numero.description || `Feuilletez « ${numero.titre} », le magazine de l'Église Cieux Ouverts à Morlaix.`,
  path: `/magazine/${numero.id}`,
  image: imagePage(numero, 1, 'm'),
})
useHead({
  meta: numero.exemple ? [{ name: 'robots', content: 'noindex, nofollow' }] : [],
})
</script>

<style scoped>
.page-numero { background: #fff; }
.numero-entete { padding: 22px 24px 16px; max-width: 1200px; margin: 0 auto; }
.numero-retour { font-size: 0.9em; color: var(--primary-blue); text-decoration: none; font-weight: 600; }
.numero-retour:hover { text-decoration: underline; }
.numero-titre { font-family: var(--font-heading); font-size: 2em; color: var(--text-dark); margin: 6px 0 2px; line-height: 1.2; }
.numero-date { color: #6b7280; font-size: 0.9em; margin: 0; }
.numero-aide { max-width: 1200px; margin: 0 auto; padding: 14px 24px 40px; color: #6b7280; font-size: 0.88em; }
.numero-aide a { color: var(--primary-blue); }
.numero-sans-js { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px; background: #1d2633; }
.numero-sans-js img { width: 100%; max-width: 800px; height: auto; }

@media (max-width: 600px) {
  .numero-entete { padding: 10px 16px 8px; }
  .numero-titre { font-size: 1.35em; margin: 2px 0 0; }
  .numero-date { font-size: 0.85em; }
  .numero-aide { padding: 12px 16px 32px; }
}
</style>
