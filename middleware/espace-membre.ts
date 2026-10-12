// Page /membre : n'existe pour le public que si l'espace membre est activé
// dans ⚙️ Config (réglage `espaceMembre`, faux par défaut). Fait dans un
// middleware plutôt qu'avec un `await` dans la page : un setup asynchrone
// retarde l'hydratation et laisse passer la connexion membre (asynchrone)
// avant elle, d'où un rendu client incohérent.
export default defineNuxtRouteMiddleware(async () => {
  try {
    const reglages = await $fetch<{ espaceMembre?: boolean }>('/api/settings')
    if (reglages?.espaceMembre !== true) return navigateTo('/', { redirectCode: 302 })
  } catch {
    // Réglages illisibles : on garde la page plutôt que de la rendre
    // inaccessible sur une panne passagère.
  }
})
