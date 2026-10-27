<template>
  <!-- Barre de progression en haut de l'écran pendant un changement de page :
       sans elle, un clic dans le menu ne donnait aucun signe tant que la page
       suivante n'avait pas chargé son contenu. N'apparaît qu'au-delà de
       `throttle` ms, donc jamais sur une navigation instantanée. -->
  <NuxtLoadingIndicator color="#064886" :height="3" :throttle="150" />
  <NuxtLayout>
    <NuxtPage />
    <GlobalToast />
  </NuxtLayout>
</template>
