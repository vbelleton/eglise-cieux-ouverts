import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { trouverPassages, nomPassage, LIVRES_BIBLE } from '../../utils/livresBible.js'
import { normaliserReglagesVR, photosDeLaSalle, VR_LIEUX, VR_MUSIQUES } from '../../utils/vrReglages.js'
import { IDS_AMBIANCES } from '../../lib/vr/musique.js'
import { LIEUX } from '../../lib/vr/lieux/index.js'

// Salle de prière VR (/vr) : passages cités par les prédications, Bible
// livrée dans public/bible/lsg/, réglages de ⚙ Config.

const passages = (t: string) => trouverPassages(t).map(nomPassage)

test.describe('Passages bibliques cités dans les prédications', () => {
  test('reconnaît noms complets, abréviations, versets et plages', () => {
    expect(passages('La foi qui déplace les montagnes — Matthieu 17. Culte')).toEqual(['Matthieu 17'])
    expect(passages('Luc 15 : le père qui court vers son fils')).toEqual(['Luc 15'])
    expect(passages('Jn 3.16 et 1 Jean 4:8')).toEqual(['Jean 3.16', '1 Jean 4.8'])
    expect(passages('1 Corinthiens 13:4-7, Ésaïe 40.31')).toEqual(['1 Corinthiens 13.4-7', 'Ésaïe 40.31'])
    expect(passages('psaume 23')).toEqual(['Psaumes 23'])
  })

  test('ignore les faux amis : dates, heures, petits mots', () => {
    expect(passages('Témoignage de Marc 12 mai')).toEqual([])
    expect(passages('Culte avec Jean 10 h')).toEqual([])
    expect(passages('Es-tu prêt ? ex 3')).toEqual([])
    expect(passages('Rendez-vous le 12 mars à 10h')).toEqual([])
  })

  test('sans doublon (même livre et chapitre)', () => {
    expect(passages('Actes 2, puis actes 2.4')).toEqual(['Actes 2'])
  })
})

test.describe('Bible Louis Segond 1910 (public/bible/lsg)', () => {
  const dossier = resolve(__dirname, '../../public/bible/lsg')

  test('les 66 livres sont là, avec leurs chapitres', () => {
    const index = JSON.parse(readFileSync(resolve(dossier, 'livres.json'), 'utf8'))
    expect(index.livres.map((l: any) => l.code)).toEqual(LIVRES_BIBLE.map((l) => l.code))
    expect(readdirSync(dossier).filter((f) => f !== 'livres.json')).toHaveLength(66)
    expect(index.livres.find((l: any) => l.code === 'PSA').chapitres).toBe(150)
  })

  test('texte exact, espaces rétablis', () => {
    const jean = JSON.parse(readFileSync(resolve(dossier, 'JHN.json'), 'utf8'))
    expect(jean.chapitres[2][15]).toBe(
      'Car Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle.',
    )
    const actes = JSON.parse(readFileSync(resolve(dossier, 'ACT.json'), 'utf8'))
    expect(actes.chapitres[6][55]).toContain('Voici, je vois les cieux ouverts')
  })
})

test.describe('Réglages de la salle de prière', () => {
  test('valeurs par défaut quand rien n’est enregistré', () => {
    expect(normaliserReglagesVR(null)).toEqual({
      titre: 'salle de prière',
      lieux: VR_LIEUX,
      lieu: 'chapelle',
      passage: '',
      dureePriere: 3,
      musique: 'repos',
      tableaux: true,
      agenda: true,
      predications: true,
      photosSite: true,
      photos: [],
      photosSiteMasquees: [],
    })
  })

  test('ne garde que des adresses d’images sûres, sans doublon', () => {
    const r = normaliserReglagesVR({ photos: ['/api/media/uploads/a.jpg', 'javascript:alert(1)', '/api/media/uploads/a.jpg', 'https://exemple.fr/b.png', ''], agenda: false })
    expect(r.photos).toEqual(['/api/media/uploads/a.jpg', 'https://exemple.fr/b.png'])
    expect(r.agenda).toBe(false)
    expect(r.predications).toBe(true)
  })

  test('une image supprimée de la Médiathèque n’est plus montrée dans la salle', () => {
    const r = normaliserReglagesVR({ photos: ['/uploads/a.jpg', '/uploads/b.jpg'], photosSiteMasquees: ['/images/activites-femmes.jpeg'] })
    const images = photosDeLaSalle(r, ['/images/activites-repas.jpg', '/uploads/b.jpg']).map((p) => p.image)
    expect(images).toContain('/images/activites-priere.jpg')
    expect(images).toContain('/uploads/a.jpg')
    expect(images).not.toContain('/images/activites-repas.jpg') // supprimée de la Médiathèque
    expect(images).not.toContain('/uploads/b.jpg')
    expect(images).not.toContain('/images/activites-femmes.jpeg') // retirée dans « Salle VR »
  })

  test('lieu de prière : seulement un lieu qui existe', () => {
    expect(LIEUX.map((l) => l.id)).toEqual(VR_LIEUX)
    expect(normaliserReglagesVR({ lieu: 'mer' }).lieu).toBe('mer')
    expect(normaliserReglagesVR({ lieu: '../../etc' }).lieu).toBe('chapelle')
  })

  test('lieux proposés : au moins un, et le lieu d’arrivée en fait partie', () => {
    expect(normaliserReglagesVR({ lieux: ['mer', 'inconnu', 'salle'], lieu: 'chapelle' })).toMatchObject({ lieux: ['salle', 'mer'], lieu: 'salle' })
    expect(normaliserReglagesVR({ lieux: ['salle', 'mer'], lieu: 'mer' }).lieu).toBe('mer')
    expect(normaliserReglagesVR({ lieux: [] }).lieux).toEqual(VR_LIEUX)
  })

  test('fond musical : une ambiance qui existe, ou aucune si on l’a choisi', () => {
    expect(IDS_AMBIANCES).toEqual(VR_MUSIQUES)
    expect(normaliserReglagesVR({}).musique).toBe('repos')
    expect(normaliserReglagesVR({ musique: 'nuit' }).musique).toBe('nuit')
    expect(normaliserReglagesVR({ musique: null }).musique).toBeNull()
    expect(normaliserReglagesVR({ musique: '<script>' }).musique).toBeNull()
  })

  test('durée de prière bornée, titre et passage nettoyés', () => {
    expect(normaliserReglagesVR({ dureePriere: 0 }).dureePriere).toBe(1)
    expect(normaliserReglagesVR({ dureePriere: 99 }).dureePriere).toBe(15)
    expect(normaliserReglagesVR({ dureePriere: '7' }).dureePriere).toBe(7)
    expect(normaliserReglagesVR({ dureePriere: 'abc' }).dureePriere).toBe(3)
    expect(normaliserReglagesVR({ titre: '   ' }).titre).toBe('salle de prière')
    expect(normaliserReglagesVR({ titre: '  veillée   du soir ' }).titre).toBe('veillée du soir')
    expect(normaliserReglagesVR({ passage: 'x'.repeat(200) }).passage).toHaveLength(60)
  })
})
