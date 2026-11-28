<template>
  <div class="page-magazine">
    <section class="mag-entete">
      <h1 class="mag-titre">Magazine</h1>
      <p class="mag-sous-titre">Un nouveau numéro tous les trois mois, à feuilleter en ligne.</p>
    </section>

    <section v-if="dernier" class="mag-dernier">
      <NuxtLink :to="`/magazine/${dernier.id}`" class="mag-dernier-couv" :aria-label="`Lire ${dernier.titre}`">
        <img
          :src="imagePage(dernier, 1, 'm')"
          :srcset="srcsetPage(dernier, 1)"
          sizes="(max-width: 700px) 70vw, 340px"
          :width="dernier.largeur"
          :height="dernier.hauteur"
          :alt="`Couverture — ${dernier.titre}`"
          fetchpriority="high"
        >
      </NuxtLink>
      <div class="mag-dernier-texte">
        <p class="mag-etiquette">{{ dernier.exemple ? 'Exemple' : 'Dernier numéro' }}</p>
        <h2 class="mag-dernier-titre">{{ dernier.titre }}</h2>
        <p class="mag-date">Paru le {{ dateParution(dernier.parution) }} · {{ dernier.pages }} pages</p>
        <p v-if="dernier.description" class="mag-description">{{ dernier.description }}</p>
        <div class="mag-actions">
          <NuxtLink :to="`/magazine/${dernier.id}`" class="mag-bouton">Feuilleter</NuxtLink>
          <a v-if="dernier.pdf" :href="dernier.pdf" class="mag-bouton mag-bouton-contour" download>Télécharger le PDF</a>
        </div>
      </div>
    </section>

    <section v-if="anciens.length" class="mag-anciens">
      <h2 class="mag-anciens-titre">Numéros précédents</h2>
      <ul class="mag-grille">
        <li v-for="n in anciens" :key="n.id">
          <NuxtLink :to="`/magazine/${n.id}`" class="mag-carte">
            <img
              :src="imagePage(n, 1, 's')"
              :width="n.largeur"
              :height="n.hauteur"
              :alt="`Couverture — ${n.titre}`"
              loading="lazy"
              decoding="async"
            >
            <span class="mag-carte-titre">{{ n.titre }}</span>
            <span class="mag-carte-date">{{ dateParution(n.parution) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <p v-if="!dernier" class="mag-vide">Le premier numéro arrive bientôt.</p>
  </div>
</template>

<script setup>
import { numerosAffiches, imagePage, srcsetPage, dateParution } from '~/utils/magazines.js'

const numeros = numerosAffiches()
const dernier = numeros[0] || null
const anciens = numeros.slice(1)

usePageSeo({
  title: 'Magazine — Église Cieux Ouverts Morlaix',
  description: 'Le magazine de l\'Église Cieux Ouverts à Morlaix : un nouveau numéro tous les trois mois, à feuilleter en ligne.',
  image: dernier && !dernier.exemple ? imagePage(dernier, 1, 'm') : undefined,
})
// Tant qu'il n'y a que le numéro d'exemple, la page n'a rien à indexer.
useHead({
  meta: !dernier || dernier.exemple ? [{ name: 'robots', content: 'noindex, nofollow' }] : [],
})
</script>

<style scoped>
.page-magazine { background: #fff; min-height: 70vh; padding-bottom: 60px; }
.mag-entete { padding: 50px 48px 20px; border-bottom: 1px solid #e5e7eb; }
.mag-titre { font-family: var(--font-heading); font-size: 2.8em; font-weight: 700; font-style: italic; color: var(--primary-blue); margin: 0 0 4px; }
.mag-sous-titre { font-size: 0.95em; color: #6b7280; margin: 0; }

.mag-dernier {
  max-width: 1000px; margin: 40px auto 0; padding: 0 24px;
  display: grid; grid-template-columns: 340px 1fr; gap: 48px; align-items: center;
}
.mag-dernier-couv {
  display: block; border-radius: 3px; overflow: hidden;
  /* Pile de pages derrière la couverture : on voit que c'est un magazine. */
  box-shadow:
    5px 5px 0 -1px #fff, 5px 5px 0 0 #d6dbe4,
    10px 10px 0 -1px #fff, 10px 10px 0 0 #d6dbe4,
    0 24px 48px rgba(6, 72, 134, 0.25), 0 2px 6px rgba(0, 0, 0, 0.12);
  transition: transform .3s ease, box-shadow .3s ease;
}
.mag-dernier-couv:hover { transform: translateY(-4px) rotate(-0.5deg); }
.mag-dernier-couv img { display: block; width: 100%; height: auto; background: #eef2f7; }
.mag-etiquette { display: inline-block; font-size: 0.75em; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--primary-pink); margin: 0 0 8px; }
.mag-dernier-titre { font-family: var(--font-heading); font-size: 2.1em; color: var(--text-dark); margin: 0 0 8px; line-height: 1.2; }
.mag-date { color: #6b7280; font-size: 0.92em; margin: 0 0 14px; }
.mag-description { color: var(--text-gray); margin: 0 0 22px; max-width: 46ch; }
.mag-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.mag-bouton { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 24px; border-radius: 999px; background: var(--primary-blue); color: #fff; font-weight: 700; text-decoration: none; transition: background .2s; }
.mag-bouton:hover { background: #04335f; }
.mag-bouton-contour { background: transparent; color: var(--primary-blue); box-shadow: inset 0 0 0 2px var(--primary-blue); }
.mag-bouton-contour:hover { background: #eef4fb; }

.mag-anciens { max-width: 1000px; margin: 56px auto 0; padding: 0 24px; }
.mag-anciens-titre { font-family: var(--font-heading); font-size: 1.5em; color: var(--text-dark); margin: 0 0 20px; }
.mag-grille { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 28px 20px; }
.mag-carte { display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: inherit; }
.mag-carte img { width: 100%; height: auto; border-radius: 3px; background: #eef2f7; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12); transition: transform .2s ease; }
.mag-carte:hover img { transform: translateY(-3px); }
.mag-carte-titre { font-weight: 700; color: var(--text-dark); line-height: 1.3; }
.mag-carte-date { font-size: 0.85em; color: #6b7280; }
.mag-vide { text-align: center; color: #6b7280; padding: 60px 24px; }

@media (max-width: 700px) {
  .mag-entete { padding: 32px 16px 16px; }
  .mag-titre { font-size: 2.2em; }
  .mag-dernier { grid-template-columns: 1fr; gap: 24px; margin-top: 28px; padding: 0 16px; }
  .mag-dernier-couv { width: 70%; margin: 0 auto; }
  .mag-dernier-titre { font-size: 1.6em; }
  .mag-anciens { padding: 0 16px; }
  .mag-grille { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 16px; }
}
</style>
