// Formulaires utilisables sans JavaScript (contact, inscription Alpha).
//
// Avec JS, le formulaire est envoyé par $fetch (`@submit.prevent`) et rien de
// ce qui suit ne sert. Sans JS, le navigateur poste le formulaire lui-même
// (`action="/api/contact" method="post"`) ; le serveur répond par une
// redirection vers la page d'origine avec `?envoi=<code>&formulaire=<nom>`,
// que ce composable relit pour afficher le succès ou l'erreur au rendu serveur.
//
// `ouvert` : heure du rendu serveur, renvoyée en champ caché. Le serveur ignore
// un envoi arrivé moins de quelques secondes après (robot qui remplit la page
// d'un coup) — l'équivalent du délai de 2,5 s que le JS applique déjà.
// useState : même valeur au rendu serveur et à l'hydratation (pas d'écart).
export function useEnvoiSansJs(formulaire) {
  const route = useRoute()
  const ouvert = useState(`envoi-sans-js-ouvert-${formulaire}`, () => Date.now())
  const code = computed(() =>
    route.query.formulaire === formulaire && typeof route.query.envoi === 'string'
      ? route.query.envoi
      : '',
  )
  return { ouvert, code, route }
}
