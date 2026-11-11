// Vidéos factices servies par /api/predications en test (PW_TEST=1) :
// aucun appel à YouTube pendant les tests.
export const VIDEOS_TEST = [
  { id: 'aaaaaaaaaa1', titre: 'La foi qui déplace les montagnes — Pasteur Martin', description: 'Matthieu 17. Culte du dimanche.', date: '2026-10-26T10:00:00Z', vignette: '/favicon-192.png' },
  { id: 'aaaaaaaaaa2', titre: "L'enfant prodigue", description: 'Luc 15 : le père qui court vers son fils. Voir aussi Matthieu 18.12-14. Prédication de Sophie.', date: '2026-10-19T10:00:00Z', vignette: '/favicon-192.png' },
  { id: 'aaaaaaaaaa3', titre: 'Louange du dimanche', description: 'Temps de louange.', date: '2025-06-01T10:00:00Z', vignette: '/favicon-192.png' },
  { id: 'aaaaaaaaaa4', titre: 'Marcher par l’Esprit', description: 'Galates 5. Pasteur Martin.', date: '2025-03-09T10:00:00Z', vignette: '/favicon-192.png' },
]

// Paroles factices (une ligne JSON par vidéo, comme youtube/paroles.ndjson).
// La 2ᵉ ligne pour aaaaaaaaaa1 remplace la 1ʳᵉ (dernière version gardée).
export const PAROLES_TEST = [
  { id: 'aaaaaaaaaa1', p: [[0, 'version périmée']] },
  { id: 'aaaaaaaaaa1', p: [[5, 'Bonjour à tous, aujourd’hui parlons de la foi.'], [65, 'La foi déplace les montagnes, dit Jésus.'], [130, 'Le pardon aussi demande de la foi.']] },
  { id: 'aaaaaaaaaa3', p: [[12, 'Nous chantons le pardon de Dieu.'], [754, 'Encore une fois, merci pour ce pardon !']] },
].map((l) => JSON.stringify(l)).join('\n') + '\n'
