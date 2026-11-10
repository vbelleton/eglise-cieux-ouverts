import { terminerConnexion } from '../../utils/youtube-chaine'

// Retour de Google après « Connecter la chaîne » (URI de redirection déclarée
// dans le projet Google Cloud). Pas de compte admin à vérifier ici : le
// navigateur arrive de Google sans jeton Firebase. La protection est le
// `state` aléatoire, créé par un admin connecté et valable 15 minutes.
function page(titre: string, texte: string) {
  const echap = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${echap(titre)}</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#1a1a2e;text-align:center">
<h1 style="color:#064886;font-size:1.5rem">${echap(titre)}</h1><p>${echap(texte)}</p>
<p><a href="/messages?admin=true" style="color:#064886;font-weight:600">Revenir au site</a></p></body></html>`
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  setHeader(event, 'cache-control', 'no-store')
  if (q.error) return page('Connexion annulée', 'La chaîne YouTube n\'a pas été connectée.')
  try {
    const r = await terminerConnexion(event, String(q.code || ''), String(q.state || ''))
    return r.ok
      ? page('Chaîne connectée ✓', 'Dans ⚙ Config, cliquez sur « Récupérer les sous-titres » pour lancer la recherche dans les paroles.')
      : page('Connexion impossible', r.message)
  } catch (err: any) {
    console.error('[youtube oauth]', err)
    return page('Connexion impossible', String(err?.message || err).slice(0, 300))
  }
})
