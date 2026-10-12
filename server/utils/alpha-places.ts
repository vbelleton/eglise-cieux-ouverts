import { getFirestoreConfig, getAccessToken, getFirestoreDoc, listFirestoreCollection, parseFirestoreDoc } from './firebase'

// Places du Parcours Alpha : la capacité est un réglage du bloc
// `inscriptionAlpha` de la page Événements (0 ou vide = illimité) ; les
// inscrits sont les messages de `contacts` portant ce nom de parcours.
// Lecture seule : ne renvoie que des compteurs, jamais d'inscrit.
export interface PlacesAlpha {
  parcours: string
  capacity: number
  taken: number
  remaining: number | null
}

const NOM_PAR_DEFAUT = 'Parcours Alpha'

function trouverBloc(blocks: any): any {
  return Array.isArray(blocks) ? blocks.find((b: any) => b?.type === 'inscriptionAlpha') : null
}

export async function placesAlpha(event: any, parcoursDemande?: string): Promise<PlacesAlpha> {
  const isTest = process.env.NODE_ENV === 'test' || process.env.PW_TEST === '1' || process.env.TEST_ENV === '1'
  let bloc: any = null
  let contacts: any[] = []

  if (isTest) {
    const mock = await import('./firestore-mock.js')
    bloc = trouverBloc((await mock.getPageDoc('event-list'))?.blocks)
    contacts = mock.getContacts()
  } else {
    const config = getFirestoreConfig(event)
    if (config) {
      const token = await getAccessToken(config.clientEmail, config.privateKey)
      const page = await getFirestoreDoc(config.projectId, token, 'pages', 'event-list')
      bloc = trouverBloc(parseFirestoreDoc(page)?.blocks)
      const docs = await listFirestoreCollection(config.projectId, token, 'contacts')
      contacts = (docs || []).map((d: any) => parseFirestoreDoc(d)).filter(Boolean)
    }
  }

  const parcours = (parcoursDemande || bloc?.props?.parcours || NOM_PAR_DEFAUT).trim()
  const capacity = Math.max(0, Math.floor(Number(bloc?.props?.capacity) || 0))
  const taken = contacts.filter((c: any) => c?.parcours === parcours).length
  return { parcours, capacity, taken, remaining: capacity > 0 ? Math.max(0, capacity - taken) : null }
}
