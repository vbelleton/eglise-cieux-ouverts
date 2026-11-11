// Lieux de prière du mode VR : chacun est un module chargé à la demande
// (construire({ alea, renderer }) -> { groupe, fog, fond, logo, hauteurMax,
// maj(dt, t, calme), teinter?(couleur), liberer() }). Le sol est toujours à
// y = 0 autour du visiteur ; le pupitre et les panneaux de lib/vr/salle.js
// restent aux mêmes places d'un lieu à l'autre.
export const LIEUX = [
  { id: 'chapelle', nom: 'La chapelle', description: 'Vitraux, bougies et bancs de bois', couleurs: ['#3a2a1e', '#c98b4a', '#ffd9a0'] },
  { id: 'jardin', nom: 'Le jardin d’oliviers', description: 'Au coucher du soleil, parmi les lucioles', couleurs: ['#2c3a1c', '#e8925a', '#ffcf8a'] },
  { id: 'mer', nom: 'Le bord de mer', description: 'Granit rose, vagues et phare breton', couleurs: ['#1d5c73', '#c79a8a', '#ffe1c8'] },
  { id: 'chambre', nom: 'La chambre', description: 'Une chambre sous les toits, lumière douce et guirlandes', couleurs: ['#6e4a2e', '#e3c9a0', '#fff0d0'] },
  { id: 'ciel', nom: 'Au-dessus des nuages', description: 'Le ciel qui s’ouvre, comme sur le site', couleurs: ['#b9cbd9', '#eef3f7', '#fff6e0'] },
]

const MODULES = {
  chapelle: () => import('./chapelle.js'),
  jardin: () => import('./jardin.js'),
  mer: () => import('./mer.js'),
  chambre: () => import('./chambre.js'),
  ciel: () => import('./ciel.js'),
}

export function chargerLieu(id) {
  return (MODULES[id] || MODULES.chapelle)()
}
