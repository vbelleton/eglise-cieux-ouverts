import { test, expect } from '@playwright/test'
import { rechercherVideos, anneesDisponibles, normaliser, surligner } from '../../utils/rechercheVideos.js'
import { lireFluxRss, idChaineDepuisHtml } from '../../server/utils/youtube'

const videos = [
  { id: 'a', titre: 'La foi qui déplace les montagnes', description: 'Matthieu 17', date: '2026-10-26T10:00:00Z', vignette: '' },
  { id: 'b', titre: "L'enfant prodigue", description: 'Luc 15, la foi du père', date: '2026-10-19T10:00:00Z', vignette: '' },
  { id: 'c', titre: 'Louange', description: '', date: '2025-06-01T10:00:00Z', vignette: '' },
]

test.describe('Recherche des prédications', () => {
  test('ignore accents, casse et apostrophes', () => {
    expect(normaliser("L’Évangile")).toBe('l evangile')
    expect(rechercherVideos(videos, 'DEPLACE').map(v => v.id)).toEqual(['a'])
    expect(rechercherVideos(videos, 'enfant prodigue').map(v => v.id)).toEqual(['b'])
  })

  test('tous les mots doivent apparaître ; le titre passe avant la description', () => {
    expect(rechercherVideos(videos, 'foi').map(v => v.id)).toEqual(['a', 'b'])
    expect(rechercherVideos(videos, 'foi luc').map(v => v.id)).toEqual(['b'])
    expect(rechercherVideos(videos, 'foi zzz')).toEqual([])
  })

  test('sans requête : tout, du plus récent au plus ancien ; filtre par année', () => {
    expect(rechercherVideos(videos, '  ').map(v => v.id)).toEqual(['a', 'b', 'c'])
    expect(rechercherVideos(videos, '', { annee: '2025' }).map(v => v.id)).toEqual(['c'])
    expect(anneesDisponibles(videos)).toEqual(['2026', '2025'])
  })
})

test.describe('Surlignage des mots trouvés', () => {
  test('garde le texte original, accents compris', () => {
    const m = surligner("L'Évangile de la grâce", 'evangile grace')
    expect(m.map(x => x.texte).join('')).toBe("L'Évangile de la grâce")
    expect(m.filter(x => x.trouve).map(x => x.texte)).toEqual(['Évangile', 'grâce'])
  })
  test('sans requête : un seul morceau non surligné', () => {
    expect(surligner('Titre', '  ')).toEqual([{ texte: 'Titre', trouve: false }])
  })
})

test.describe('Lecture du flux YouTube', () => {
  test('flux RSS → vidéos (entités décodées, identifiants invalides ignorés)', () => {
    const xml = `<feed><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><title>Gr&#226;ce &amp; v&eacute;rit&#233;</title>
      <published>2026-01-04T09:00:00+00:00</published><media:group><media:description>Jean 1</media:description></media:group></entry>
      <entry><yt:videoId>pas-un-id</yt:videoId><title>x</title></entry></feed>`
    const v = lireFluxRss(xml)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ id: 'dQw4w9WgXcQ', description: 'Jean 1', date: '2026-01-04T09:00:00+00:00' })
    expect(v[0].titre.startsWith('Grâce & v')).toBe(true)
  })

  test('identifiant de chaîne trouvé dans la page HTML', () => {
    expect(idChaineDepuisHtml('…"externalId":"UCabcdefghijklmnopqrstuv"…')).toBe('UCabcdefghijklmnopqrstuv')
    expect(idChaineDepuisHtml('<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">')).toBe('UCabcdefghijklmnopqrstuv')
    expect(idChaineDepuisHtml('rien')).toBe('')
  })
})
