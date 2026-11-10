import { test, expect } from '@playwright/test'
import { lireSousTitres, choisirPiste, ligneParoles } from '../../server/utils/sous-titres'
import { indexerParoles, chercherDansParoles, rechercherAvecParoles, formaterMoment } from '../../utils/rechercheVideos.js'

test.describe('Sous-titres YouTube → passages', () => {
  test('SBV : horodatage en secondes, balises et [Musique] retirées', () => {
    const sbv = '0:00:01.200,0:00:04.000\n[Musique]\n\n0:00:05.000,0:00:08.500\nBonjour à <b>tous</b>,\nbienvenue\n\n1:02:03.900,1:02:06.000\nAmen &amp; merci\n'
    expect(lireSousTitres(sbv)).toEqual([[5, 'Bonjour à tous, bienvenue'], [3723, 'Amen & merci']])
  })

  test('WebVTT : les lignes reprises d\'un bloc au suivant ne comptent qu\'une fois', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nla foi\n\n00:00:03.000 --> 00:00:05.000\nla foi qui déplace\n\n01:10.000 --> 01:12.000\nles montagnes'
    expect(lireSousTitres(vtt)).toEqual([[1, 'la foi'], [3, 'qui déplace'], [70, 'les montagnes']])
  })

  test('piste choisie : français saisi > français automatique > autre', () => {
    const items = [
      { id: 'en', snippet: { language: 'en', trackKind: 'standard' } },
      { id: 'fr-auto', snippet: { language: 'fr', trackKind: 'asr' } },
      { id: 'fr', snippet: { language: 'fr-FR', trackKind: 'standard' } },
    ]
    expect(choisirPiste(items)?.id).toBe('fr')
    expect(choisirPiste(items.slice(0, 2))?.id).toBe('fr-auto')
    expect(choisirPiste([])).toBeNull()
  })
})

test.describe('Recherche dans les paroles', () => {
  const ndjson = ligneParoles('v1', [[0, 'périmé']])
    + ligneParoles('v1', [[10, 'La foi, encore la'], [20, 'foi ! Pas les fois.'], [95, 'Le pardon de Dieu']])
    + 'ligne cassée\n'
    + ligneParoles('v2', [[3600, 'Pardon, pardon']])
  const index = indexerParoles(ndjson)

  test('la dernière version d\'une vidéo l\'emporte, les lignes invalides sont ignorées', () => {
    expect([...index.keys()]).toEqual(['v1', 'v2'])
    expect(index.get('v1').passages[0][0]).toBe(10)
  })

  test('mots entiers, sans accents, y compris à cheval sur deux passages', () => {
    expect(chercherDansParoles(index.get('v1'), 'FOI').map(m => m.t)).toEqual([10, 20])
    expect(chercherDansParoles(index.get('v1'), 'la foi').map(m => m.t)).toEqual([10, 10])
    expect(chercherDansParoles(index.get('v1'), 'encore la foi').map(m => m.t)).toEqual([10])
    expect(chercherDansParoles(index.get('v2'), 'pardon')).toHaveLength(2)
    expect(chercherDansParoles(index.get('v1'), 'fo')).toEqual([])
  })

  test('résultats : titres d\'abord, puis vidéos trouvées par les paroles', () => {
    const videos = [
      { id: 'v1', titre: 'La foi', description: '', date: '2026-01-01' },
      { id: 'v2', titre: 'Louange', description: '', date: '2026-02-01' },
      { id: 'v3', titre: 'Autre', description: '', date: '2026-03-01' },
    ]
    const r = rechercherAvecParoles(videos, 'pardon', { paroles: index })
    expect(r.map(x => [x.video.id, x.moments.length])).toEqual([['v2', 2], ['v1', 1]])
    const t = rechercherAvecParoles(videos, 'foi', { paroles: index })
    expect(t.map(x => x.video.id)).toEqual(['v1'])
    expect(t[0].moments).toHaveLength(2)
    expect(rechercherAvecParoles(videos, 'pardon', { paroles: index, annee: '2026' })).toHaveLength(2)
    expect(rechercherAvecParoles(videos, 'pardon', { paroles: null })).toHaveLength(0)
  })

  test('format des moments', () => {
    expect(formaterMoment(5)).toBe('0:05')
    expect(formaterMoment(754)).toBe('12:34')
    expect(formaterMoment(3723)).toBe('1:02:03')
  })
})
