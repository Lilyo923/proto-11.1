/* =============================================================================
   NIVEAU 1 — Champ de tournesols, puis la grotte

   Premier vrai niveau : le joueur connait deja les mecaniques, on les combine.
   La grotte reprend le principe demande dans les notes — « le niveau 1 ou Brad
   va dans une grotte, c'est toujours le niveau 1 » : meme fichier, meme
   partie, seul le decor bascule derriere un fondu.
   ========================================================================== */
'use strict';

NIVEAUX['niveau1'] = {
  nom: 'Champ de tournesols',
  musique: 'niveau1',
  largeur: 236,
  hauteur: 18,
  apparition: { x: 3, y: 12 },

  zones: [
    {
      x1: 119,
      nom: 'Champ de tournesols',
      cielHaut: '#4a76b8', cielBas: '#9fc4d8',
      loin: '#7f9b7a', pres: '#5d7f5a',
      solFace: '#6b4a2e', solHaut: '#4f8a3c', solLigne: '#69ad4c',
      silhouettes: 'tournesols',
    },
    {
      x1: 999,
      nom: 'La grotte',
      cielHaut: '#141019', cielBas: '#241d2c',
      loin: '#1d1824', pres: '#2a2233',
      solFace: '#3a2f42', solHaut: '#584966', solLigne: '#7a6690',
      silhouettes: 'stalactites',
    },
  ],

  sas: { x: 117.5, y: 9, w: 3, h: 6, style: 'grotte' },
  porte: { x: 228, y: 12, w: 2, h: 3 },

  solides: [
    // ---- ZONE 1 : le champ -------------------------------------------------
    [0, 15, 26, 3],
    [29, 15, 14, 3],
    [46, 15, 12, 3],
    [58, 13, 4, 5],                       // butte
    [62, 15, 10, 3],
    [75, 14, 10, 4],                      // talus
    [90, 15, 14, 3],
    [94, 12, 7, 1],                       // branchage bas
    [104, 13, 3, 5],                      // rocher
    [107, 15, 12, 3],

    // ---- ZONE 2 : la grotte ------------------------------------------------
    [119, 15, 17, 3],
    [124, 12, 8, 1],                      // stalactite massive
    [139, 15, 11, 3],
    [150, 13, 3, 5], [153, 11, 3, 7],     // escalier de roche
    [156, 10, 12, 8],                     // grande vire
    [180, 15, 14, 3],
    [182, 12, 8, 1],                      // plafond bas
    [197, 15, 12, 3],
    [211, 14, 1, 4], [214, 14, 1, 4], [217, 14, 1, 4],
    [220, 15, 14, 3],                     // salle de sortie

    [-2, 0, 2, 18], [234, 0, 2, 18],
  ],

  traversantes: [
    [48, 11, 4], [54, 10, 4],             // bottes de paille empilees
    [86, 12, 4],
    [169, 12, 4], [175, 13, 4],           // corniches de la grotte
  ],

  panneaux: [
    { x: 3, y: 13, texte: 'Le monde parallèle a des champs. Va comprendre.' },
    { x: 31, y: 13, texte: 'Ils sont plus nombreux ici' },
    { x: 47, y: 9, texte: 'Bottes de paille : traversables par le bas' },
    { x: 76, y: 12, texte: 'Le talus : hauteur et Lanceur' },
    { x: 92, y: 13, texte: 'Branchage bas' },
    { x: 110, y: 13, texte: 'Entrée de la grotte' },
    { x: 141, y: 13, texte: 'Ça descend' },
    { x: 158, y: 8, texte: 'La grande vire' },
    { x: 182, y: 13, texte: 'Plafond bas, et pas seul' },
    { x: 210, y: 12, texte: 'Précision' },
    { x: 223, y: 13, texte: 'Sortie' },
  ],

  ennemis: [
    // ---- ZONE 1 ------------------------------------------------------------
    { type: 'Serra', x: 14, y: 15 },
    { type: 'Serra', x: 20, y: 15 },
    { type: 'Serra-Boost', x: 33, y: 15, rayon: 4 },
    { type: 'Serra', x: 39, y: 15 },
    { type: 'Serra-Volant', x: 44, y: 10, rayon: 3 },
    { type: 'Serra', x: 50, y: 15 },
    { type: 'Serra-Volant', x: 55, y: 7, rayon: 2.5 },
    { type: 'Serra-Lourd', x: 59, y: 13, rayon: 1.5 },
    { type: 'Serra', x: 66, y: 15 },
    { type: 'Serra-Boost', x: 69, y: 15, rayon: 3 },
    { type: 'Serra-Lanceur', x: 80, y: 14 },
    { type: 'Serra', x: 83, y: 14 },
    { type: 'Serra-Volant', x: 88, y: 9, rayon: 3 },
    { type: 'Serra', x: 92, y: 15 },
    { type: 'Serra-Boost', x: 99, y: 15, rayon: 3 },
    { type: 'Serra', x: 110, y: 15 },
    { type: 'Serra-Lourd', x: 114, y: 15, rayon: 2 },

    // ---- ZONE 2 ------------------------------------------------------------
    { type: 'Serra', x: 124, y: 15 },
    { type: 'Serra', x: 131, y: 15 },
    { type: 'Serra-Volant', x: 134, y: 12, rayon: 2.5 },
    { type: 'Serra-Boost', x: 143, y: 15, rayon: 4 },
    { type: 'Serra', x: 147, y: 15 },
    { type: 'Serra-Lourd', x: 160, y: 10, rayon: 3 },
    { type: 'Serra-Lanceur', x: 165, y: 10 },
    { type: 'Serra-Volant', x: 172, y: 9, rayon: 3 },
    { type: 'Serra', x: 186, y: 15 },
    { type: 'Serra-Boost', x: 190, y: 15, rayon: 3 },
    { type: 'Serra', x: 200, y: 15 },
    { type: 'Serra-Volant', x: 205, y: 11, rayon: 3 },
    { type: 'Serra-Boost', x: 206, y: 15, rayon: 3 },
    { type: 'Serra', x: 224, y: 15 },
    { type: 'Serra-Lourd', x: 231, y: 15, rayon: 1.5 },
  ],
};
