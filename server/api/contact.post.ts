import { getFirestoreConfig, getAccessToken, getFirestoreDoc, setFirestoreDoc, parseFirestoreDoc } from '../utils/firebase'
import { sendEmail, escapeHtml, nettoyerSujet } from '../utils/send-email'
import { fetchWithTimeout } from '../utils/http'
import { placesAlpha } from '../utils/alpha-places'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Note: in-memory rate limiting is best-effort on serverless (Cloudflare Pages).
// Each cold start resets the map. For proper production rate limiting,
// configure Cloudflare Edge Rate Limiting in the Cloudflare Dashboard.
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
}
const rateLimitStore = new Map()

function getRateLimitKey(event) {
  return getRequestIP(event) || 'unknown'
}

// Sans purge, une salve depuis beaucoup d'IP différentes fait grossir la Map
// jusqu'au recyclage de l'isolat. Les entrées périmées ne servent plus à rien :
// on les retire à chaque passage, ce qui borne la taille au nombre d'IP vues
// dans la fenêtre courante.
function purgerEntreesPerimees(now) {
  for (const [cle, entry] of rateLimitStore) {
    if (now - entry.resetTime > RATE_LIMIT.windowMs) rateLimitStore.delete(cle)
  }
}

function checkRateLimit(key) {
  const now = Date.now()
  purgerEntreesPerimees(now)
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.resetTime > RATE_LIMIT.windowMs) {
    rateLimitStore.set(key, { count: 1, resetTime: now })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 }
  }

  if (entry.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.resetTime + RATE_LIMIT.windowMs - now) / 1000) }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - entry.count }
}

function assertString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

// ─── Envoi sans JavaScript ───
// Les formulaires (BlockContact, BlockInscriptionAlpha) portent
// `action="/api/contact" method="post"` : sans JS, le navigateur les poste lui-
// même en `application/x-www-form-urlencoded`. Le traitement est le même ; seule
// la réponse change : une redirection 303 vers la page d'origine, avec un code
// que la page affiche (composables/useEnvoiSansJs.js) au lieu d'un JSON brut.
const FORMULAIRES_SANS_JS: Record<string, string> = { contact: 'formulaire-contact', alpha: 'inscription-alpha' }
// Un humain ne remplit pas un formulaire en moins de 3 s : en dessous, ou sans
// heure d'ouverture valide, c'est un robot. Même idée que le délai côté JS.
const DELAI_MINIMUM_SANS_JS = 3000

function estEnvoiSansJs(event) {
  return (getRequestHeader(event, 'content-type') || '').includes('application/x-www-form-urlencoded')
}

// Chemin interne uniquement (`/…`, jamais `//hote` ni `/\hote`) : sinon la
// redirection deviendrait un rebond vers n'importe quel site.
function cheminRetour(valeur: unknown) {
  const chemin = typeof valeur === 'string' ? valeur.trim() : ''
  if (!/^\/(?![\/\\])/.test(chemin) || /[\s\\]/.test(chemin)) return '/contact'
  return chemin.split(/[?#]/)[0].slice(0, 200) || '/'
}

function codeErreur(err: any) {
  return err?.data?.code || (err?.statusCode === 429 ? 'limite' : 'serveur')
}

function refus(statusCode: number, message: string, code: string) {
  return createError({ statusCode, message, data: { code } })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!estEnvoiSansJs(event)) return enregistrer(event, body)

  const formulaire = Object.hasOwn(FORMULAIRES_SANS_JS, body?.formulaire) ? body.formulaire : 'contact'
  const ouvert = Number(body?.ouvert)
  const ecoule = Date.now() - ouvert
  let code = 'ok'
  // Robot (champ piège rempli, envoi instantané, heure absente ou inventée) :
  // on fait comme si tout allait bien, sans rien enregistrer ni lui apprendre
  // ce qui l'a trahi.
  const robot = Boolean(assertString(body?.website, 200)) || !Number.isFinite(ouvert) || ecoule < DELAI_MINIMUM_SANS_JS || ecoule > 7 * 24 * 3600 * 1000
  if (!robot) {
    try {
      await enregistrer(event, body)
    } catch (err) {
      code = codeErreur(err)
    }
  }
  const query = new URLSearchParams({ envoi: code, formulaire })
  return sendRedirect(event, `${cheminRetour(body?.retour)}?${query}#${FORMULAIRES_SANS_JS[formulaire]}`, 303)
})

async function enregistrer(event, body) {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'

  // Rate limiting check (désactivé en test : évite une pollution du compteur
  // en mémoire entre lancements successifs de la suite E2E)
  if (!isTest) {
    const rateLimitKey = getRateLimitKey(event)
    const rateCheck = checkRateLimit(rateLimitKey)
    if (!rateCheck.allowed) {
      throw refus(429, `Trop de requêtes. Réessayez dans ${rateCheck.resetIn} secondes.`, 'limite')
    }
  }

  // Helper partagé (comme menu/footer/pages) plutôt qu'une résolution locale :
  // cet endpoint lisait process.env AVANT runtimeConfig, soit l'inverse du
  // reste du code. Quand les deux sources divergent — typiquement une valeur
  // mal formée côté Cloudflare et une valeur correcte figée au build — seul
  // /api/contact partait en erreur, avec un 500 opaque très difficile à
  // rattacher à sa cause.
  const firestore = getFirestoreConfig(event)

  const prenom = assertString(body?.prenom, 80)
  const nom = assertString(body?.nom, 80)
  const ville = assertString(body?.ville, 120)
  const email = assertString(body?.email, 180).toLowerCase()
  const message = assertString(body?.message, 4000)
  const website = assertString(body?.website, 200)
  const source = assertString(body?.source, 200) || '/contact'
  const newsletter = Boolean(body?.newsletter)
  // Inscription au Parcours Alpha : mêmes destinataires et même liste admin
  // (📬 Messages) que le formulaire de contact, avec ces champs en plus.
  const parcours = assertString(body?.parcours, 120)
  const telephone = assertString(body?.telephone, 40)
  const adresse = assertString(body?.adresse, 300)
  const estInscription = Boolean(parcours)
  
  if (!prenom || !nom || !email || (!message && !estInscription)) {
    throw refus(400, 'Champs obligatoires manquants.', 'champs')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw refus(400, 'Email invalide.', 'email')
  }
  if (estInscription && telephone.replace(/\D/g, '').length < 6) {
    throw refus(400, 'Merci d\'indiquer un numéro de téléphone.', 'telephone')
  }
  if (!estInscription && message.length < 10) {
    throw refus(400, 'Message trop court.', 'court')
  }
  if (website) {
    throw refus(400, 'Envoi bloqué.', 'bloque')
  }

  if (estInscription) {
    // Parcours complet : refusé côté serveur, le formulaire ne fait que l'afficher.
    const places = await placesAlpha(event, parcours).catch(() => null)
    if (places && places.remaining === 0) {
      throw refus(409, 'Désolé, ce parcours est complet.', 'complet')
    }
  }

  if (isTest) {
    const { setContact } = await import('../utils/firestore-mock.js')
    const id = crypto.randomUUID()
    setContact(id, {
      id, prenom, nom, ville, email, message, newsletter, source,
      ...(estInscription ? { parcours, telephone, adresse } : {}),
      status: 'new',
      createdAt: new Date().toISOString(),
    })
    return { ok: true }
  }

  if (!firestore) {
    throw createError({ statusCode: 503, message: 'Configuration serveur contact incomplète.' })
  }
  const { projectId: firebaseProjectId, clientEmail: firebaseClientEmail, privateKey: firebasePrivateKey } = firestore

  try {
    const accessToken = await getAccessToken(firebaseClientEmail, firebasePrivateKey)

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/contacts`
    
    const response = await fetchWithTimeout(firestoreUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          prenom: { stringValue: prenom },
          nom: { stringValue: nom },
          ville: { stringValue: ville },
          email: { stringValue: email },
          message: { stringValue: message },
          newsletter: { booleanValue: newsletter },
          source: { stringValue: source },
          ...(estInscription ? {
            parcours: { stringValue: parcours },
            telephone: { stringValue: telephone },
            adresse: { stringValue: adresse },
          } : {}),
          status: { stringValue: 'new' },
          ip: { stringValue: getRequestIP(event) || '' },
          userAgent: { stringValue: getRequestHeader(event, 'user-agent') || '' },
          language: { stringValue: getRequestHeader(event, 'accept-language') || '' },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      }),
    })
  
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Firestore error: ${errorText}`)
    }
  
    // Récupérer les emails de destination depuis settings. Pas de valeur de
    // repli : l'adresse de destination se règle dans l'admin (⚙️ Config →
    // « Emails de destination »), et un repli codé en dur enverrait les
    // messages à une adresse que personne ne surveille.
    let contactEmails: string[] = []
    try {
      const settingsResponse = await fetchWithTimeout(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/settings/config`, {
        headers: { authorization: `Bearer ${accessToken}` },
      })
      if (settingsResponse.ok) {
        const settingsDoc = await settingsResponse.json()
        const multiField = settingsDoc.fields?.contactEmails?.arrayValue?.values
        const legacyField = settingsDoc.fields?.contactEmail?.stringValue
        if (multiField?.length) {
          contactEmails = multiField.map((v: any) => v.stringValue).filter(Boolean)
        } else if (legacyField) {
          contactEmails = [legacyField]
        }
      }
    } catch (e) {
      console.error('Could not fetch settings, using fallback:', e)
    }

    // Notification email — best effort : le message est déjà enregistré dans
    // Firestore et visible dans l'admin (📬 Messages), donc un échec d'envoi
    // ne doit jamais faire échouer la requête ni perdre le message.
    if (contactEmails.length) {
      // Tout ce qui vient du formulaire est échappé : il est public, donc ces
      // champs sont du texte arbitraire choisi par un inconnu. Sans échappement,
      // il compose lui-même le HTML de l'email reçu par les responsables.
      // Le `<br>` des sauts de ligne est posé APRÈS l'échappement, sinon il
      // ressortirait lui aussi en `&lt;br&gt;`.
      const emailHtml = `
        <h2>${estInscription ? 'Nouvelle inscription au Parcours Alpha' : 'Nouveau contact reçu'}</h2>
        <p><strong>Nom :</strong> ${escapeHtml(`${prenom} ${nom}`)}</p>
        <p><strong>Email :</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        ${estInscription ? `<p><strong>Parcours :</strong> ${escapeHtml(parcours)}</p><p><strong>Téléphone :</strong> ${escapeHtml(telephone)}</p>${adresse ? `<p><strong>Adresse :</strong> ${escapeHtml(adresse)}</p>` : ''}` : ''}
        ${ville ? `<p><strong>Ville :</strong> ${escapeHtml(ville)}</p>` : ''}
        ${message ? `<p><strong>Message :</strong></p>
        <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:10px 0">
          ${escapeHtml(message).replace(/\n/g, '<br>')}
        </div>` : ''}
        <p><small>Reçu le ${new Date().toLocaleString('fr-FR')}</small></p>
        <p><a href="https://console.firebase.google.com/project/${encodeURIComponent(firebaseProjectId)}/firestore/data/~2Fcontacts">Voir dans Firestore</a></p>
      `

      const sent = await sendEmail({
        to: contactEmails,
        subject: nettoyerSujet(`${estInscription ? 'Inscription Alpha' : 'Nouveau contact'} : ${prenom} ${nom}`),
        html: emailHtml,
        replyTo: email,
      })
      if (sent.ok) {
        console.log(`[contact] notification envoyée à ${contactEmails.length} destinataire(s)`)
      } else {
        console.error('[contact] notification NON envoyée :', sent.error)
      }
    }

    return { ok: true }
  } catch (err) {
    console.error('Contact API error:', err)
    throw createError({ statusCode: 500, message: err.message || 'Server Error' })
  }
}
