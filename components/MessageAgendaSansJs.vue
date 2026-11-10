<template>
  <!-- Les événements viennent du Worker eglise-app, chargés par le navigateur :
       sans JavaScript ils n'arriveront jamais. Plutôt qu'un « Chargement… »
       éternel, on dit où trouver l'essentiel. Invisible avec JS (no-js.css). -->
  <p class="message-sans-js nojs-only">
    L'agenda détaillé a besoin de JavaScript, désactivé sur ce navigateur.
    Nos horaires et notre adresse sont en bas de cette page, et pour une date
    précise, <NuxtLink to="/contact">écrivez-nous</NuxtLink>.
  </p>
</template>
