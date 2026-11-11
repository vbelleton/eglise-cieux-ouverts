// Tableaux de maîtres (domaine public) ajoutés à la spirale de la salle de
// prière VR selon le passage ouvert dans la Bible. Liste choisie à la main :
// une recherche automatique sur le passage donnerait des images au hasard.
//
// L'image elle-même vient de Wikimedia Commons, par /api/vr/tableau/:cle
// (même origine pour WebGL, mise en cache dans le KV) : `recherche` y désigne
// l'œuvre, et seule une reproduction marquée domaine public est retenue.
//
// `passages` : livre (code USFM), chapitres `de`–`a`, versets facultatifs
// (`v` : [premier, dernier]) pour départager un chapitre (Luc 15 : la brebis
// perdue puis le fils prodigue).

const P = (code, de, a = de, v = null) => ({ code, de, a, v })

export const TABLEAUX = [
  { cle: 'creation-adam', titre: 'La Création d’Adam', peintre: 'Michel-Ange', annee: 'vers 1512', recherche: 'Michelangelo Creation of Adam', passages: [P('GEN', 1, 2)] },
  { cle: 'expulsion', titre: 'Adam et Ève chassés du paradis', peintre: 'Masaccio', annee: 'vers 1425', recherche: 'Masaccio Expulsion from the Garden of Eden', passages: [P('GEN', 3)] },
  { cle: 'arche-noe', titre: 'L’Arche de Noé', peintre: 'Edward Hicks', annee: '1846', recherche: 'Edward Hicks Noah\'s Ark', passages: [P('GEN', 6, 9)] },
  { cle: 'sacrifice-isaac', titre: 'Le Sacrifice d’Isaac', peintre: 'Le Caravage', annee: 'vers 1603', recherche: 'Caravaggio Sacrifice of Isaac Uffizi', passages: [P('GEN', 22), P('HEB', 11, 11, [17, 19])] },
  { cle: 'echelle-jacob', titre: 'L’Échelle de Jacob', peintre: 'William Blake', annee: 'vers 1805', recherche: 'William Blake Jacob\'s Ladder', passages: [P('GEN', 28)] },
  { cle: 'lutte-jacob', titre: 'La Lutte de Jacob avec l’ange', peintre: 'Eugène Delacroix', annee: '1861', recherche: 'Delacroix Jacob Wrestling with the Angel', passages: [P('GEN', 32)] },
  { cle: 'mer-rouge', titre: 'Le Passage de la mer Rouge', peintre: 'Ivan Aïvazovski', annee: '1891', recherche: 'Aivazovsky Passage of the Jews through the Red Sea', passages: [P('EXO', 14, 15)] },
  { cle: 'moise-tables', titre: 'Moïse et les tables de la Loi', peintre: 'Rembrandt', annee: '1659', recherche: 'Rembrandt Moses with the Ten Commandments', passages: [P('EXO', 19, 20), P('EXO', 32, 34), P('DEU', 5)] },
  { cle: 'bon-berger', titre: 'Le Bon Berger', peintre: 'Bernhard Plockhorst', annee: '', recherche: 'Plockhorst Good Shepherd', passages: [P('PSA', 23), P('JHN', 10), P('LUK', 15, 15, [1, 10]), P('MAT', 18, 18, [10, 14]), P('ISA', 40)] },
  { cle: 'daniel-lions', titre: 'Daniel dans la fosse aux lions', peintre: 'Pierre Paul Rubens', annee: 'vers 1615', recherche: 'Rubens Daniel in the Lions\' Den', passages: [P('DAN', 6)] },
  { cle: 'jeremie', titre: 'Jérémie pleurant la destruction de Jérusalem', peintre: 'Rembrandt', annee: '1630', recherche: 'Rembrandt Jeremiah Lamenting the Destruction of Jerusalem', passages: [P('JER', 1, 52), P('LAM', 1, 5)] },
  { cle: 'esaie', titre: 'Le Prophète Isaïe', peintre: 'Michel-Ange', annee: 'vers 1509', recherche: 'Michelangelo Isaiah Sistine Chapel', passages: [P('ISA', 1, 39), P('ISA', 41, 66)] },
  { cle: 'matin-montagnes', titre: 'Matin dans les montagnes', peintre: 'Caspar David Friedrich', annee: 'vers 1811', recherche: 'Caspar David Friedrich Morning in the Riesengebirge', passages: [P('PSA', 1, 22), P('PSA', 24, 150)] },
  { cle: 'annonciation', titre: 'L’Annonciation', peintre: 'Léonard de Vinci', annee: 'vers 1475', recherche: 'Leonardo da Vinci Annunciation Uffizi', passages: [P('LUK', 1)] },
  { cle: 'adoration-bergers', titre: 'L’Adoration des bergers', peintre: 'Gerard van Honthorst', annee: '1622', recherche: 'Gerard van Honthorst Adoration of the Shepherds 1622', passages: [P('LUK', 2, 2, [1, 20])] },
  { cle: 'adoration-mages', titre: 'L’Adoration des mages', peintre: 'Gentile da Fabriano', annee: '1423', recherche: 'Gentile da Fabriano Adoration of the Magi', passages: [P('MAT', 1, 2)] },
  { cle: 'bapteme', titre: 'Le Baptême du Christ', peintre: 'Piero della Francesca', annee: 'vers 1450', recherche: 'Piero della Francesca Baptism of Christ', passages: [P('MAT', 3), P('MRK', 1, 1, [1, 13]), P('LUK', 3), P('JHN', 1, 1, [19, 34])] },
  { cle: 'sermon-montagne', titre: 'Le Sermon sur la montagne', peintre: 'Carl Bloch', annee: '1877', recherche: 'Carl Bloch Sermon on the Mount', passages: [P('MAT', 5, 7), P('LUK', 6, 6, [17, 49])] },
  { cle: 'vocation-matthieu', titre: 'La Vocation de saint Matthieu', peintre: 'Le Caravage', annee: '1600', recherche: 'Caravaggio The Calling of Saint Matthew', passages: [P('MAT', 9, 9, [9, 13]), P('MRK', 2, 2, [13, 17]), P('LUK', 5, 5, [27, 32])] },
  { cle: 'tempete', titre: 'Le Christ dans la tempête', peintre: 'Rembrandt', annee: '1633', recherche: 'Rembrandt The Storm on the Sea of Galilee', passages: [P('MAT', 8), P('MRK', 4), P('LUK', 8, 8, [22, 25])] },
  { cle: 'marche-eaux', titre: 'Jésus marchant sur les eaux', peintre: 'Ivan Aïvazovski', annee: '1888', recherche: 'Aivazovsky Walking on Water', passages: [P('MAT', 14), P('MRK', 6, 6, [45, 56]), P('JHN', 6, 6, [16, 21])] },
  { cle: 'transfiguration', titre: 'La Transfiguration', peintre: 'Raphaël', annee: '1520', recherche: 'Raphael Transfiguration painting Vatican', passages: [P('MAT', 17), P('MRK', 9, 9, [1, 13]), P('LUK', 9, 9, [28, 36])] },
  { cle: 'cene', titre: 'La Cène', peintre: 'Léonard de Vinci', annee: 'vers 1498', recherche: 'Leonardo da Vinci The Last Supper', passages: [P('MAT', 26, 26, [17, 30]), P('MRK', 14, 14, [12, 26]), P('LUK', 22, 22, [7, 38]), P('JHN', 13), P('1CO', 11)] },
  { cle: 'gethsemane', titre: 'Le Christ à Gethsémané', peintre: 'Heinrich Hofmann', annee: '1886', recherche: 'Heinrich Hofmann Christ in Gethsemane', passages: [P('MAT', 26, 26, [31, 56]), P('MRK', 14, 14, [27, 52]), P('LUK', 22, 22, [39, 53])] },
  { cle: 'crucifixion', titre: 'Le Christ crucifié', peintre: 'Diego Velázquez', annee: 'vers 1632', recherche: 'Velázquez Christ Crucified Prado', passages: [P('MAT', 27), P('MRK', 15), P('LUK', 23), P('JHN', 19), P('ISA', 53)] },
  { cle: 'resurrection', titre: 'La Résurrection', peintre: 'Carl Bloch', annee: '1875', recherche: 'Carl Bloch The Resurrection', passages: [P('MAT', 28), P('MRK', 16), P('LUK', 24, 24, [1, 12]), P('JHN', 20, 20, [1, 18]), P('1CO', 15)] },
  { cle: 'saint-thomas', titre: 'L’Incrédulité de saint Thomas', peintre: 'Le Caravage', annee: 'vers 1602', recherche: 'Caravaggio The Incredulity of Saint Thomas', passages: [P('JHN', 20, 20, [19, 31])] },
  { cle: 'emmaus', titre: 'Le Souper à Emmaüs', peintre: 'Le Caravage', annee: '1601', recherche: 'Caravaggio Supper at Emmaus National Gallery London', passages: [P('LUK', 24, 24, [13, 35])] },
  { cle: 'bon-samaritain', titre: 'Le Bon Samaritain', peintre: 'Vincent van Gogh', annee: '1890', recherche: 'Van Gogh The Good Samaritan after Delacroix', passages: [P('LUK', 10, 10, [25, 37])] },
  { cle: 'marthe-marie', titre: 'Le Christ chez Marthe et Marie', peintre: 'Johannes Vermeer', annee: 'vers 1655', recherche: 'Vermeer Christ in the House of Martha and Mary', passages: [P('LUK', 10, 10, [38, 42])] },
  { cle: 'fils-prodigue', titre: 'Le Retour du fils prodigue', peintre: 'Rembrandt', annee: 'vers 1668', recherche: 'Rembrandt The Return of the Prodigal Son', passages: [P('LUK', 15, 15, [11, 32])] },
  { cle: 'peche-miraculeuse', titre: 'La Pêche miraculeuse', peintre: 'Raphaël', annee: '1515', recherche: 'Raphael The Miraculous Draught of Fishes cartoon', passages: [P('LUK', 5, 5, [1, 11]), P('JHN', 21)] },
  { cle: 'nicodeme', titre: 'Nicodème rendant visite à Jésus', peintre: 'Henry Ossawa Tanner', annee: '1899', recherche: 'Henry Ossawa Tanner Nicodemus visiting Jesus', passages: [P('JHN', 3)] },
  { cle: 'lazare', titre: 'La Résurrection de Lazare', peintre: 'Rembrandt', annee: 'vers 1631', recherche: 'Rembrandt The Raising of Lazarus', passages: [P('JHN', 11)] },
  { cle: 'lumiere-monde', titre: 'La Lumière du monde', peintre: 'William Holman Hunt', annee: '1853', recherche: 'William Holman Hunt The Light of the World Keble', passages: [P('JHN', 8, 8, [12, 12]), P('REV', 3)] },
  { cle: 'pentecote', titre: 'La Pentecôte', peintre: 'Le Greco', annee: 'vers 1600', recherche: 'El Greco Pentecost Prado', passages: [P('ACT', 2)] },
  { cle: 'conversion-paul', titre: 'La Conversion de saint Paul', peintre: 'Le Caravage', annee: '1601', recherche: 'Caravaggio Conversion on the Way to Damascus', passages: [P('ACT', 9), P('ACT', 22), P('ACT', 26)] },
  { cle: 'plaines-ciel', titre: 'Les Plaines du ciel', peintre: 'John Martin', annee: '1853', recherche: 'John Martin The Plains of Heaven', passages: [P('REV', 21, 22)] },
]

export const TABLEAU_PAR_CLE = Object.fromEntries(TABLEAUX.map((t) => [t.cle, t]))

/**
 * Tableaux liés à un passage ({ code, chapitre, verset?, versetFin? }), deux
 * au plus. Sans verset, tout tableau du chapitre convient ; avec, seuls ceux
 * dont les versets recoupent le passage.
 */
export function tableauxPour(passage, max = 2) {
  if (!passage?.code) return []
  const debut = passage.verset || null
  const fin = passage.versetFin || debut
  return TABLEAUX.filter((t) =>
    t.passages.some((p) => {
      if (p.code !== passage.code || passage.chapitre < p.de || passage.chapitre > p.a) return false
      if (!p.v || !debut) return true
      return debut <= p.v[1] && fin >= p.v[0]
    }),
  ).slice(0, max)
}

/** Légende : « Rembrandt, vers 1668 · domaine public ». */
export const creditTableau = (t) => `${t.peintre}${t.annee ? `, ${t.annee}` : ''} · domaine public`
