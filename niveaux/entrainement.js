/* =============================================================================
   CAMP D'ENTRAINEMENT

   Une salle de la base, pas un niveau : on y vient s'exercer, jamais farmer.
   Le drapeau `entrainement` coupe TOUTE récompense — ni Brad Coins, ni
   comptage d'ennemis, ni progression. C'est la seule garantie qui empêche la
   salle de devenir une machine à monnaie, et elle est posée ici, dans la
   donnée, plutôt que dispersée dans le code.

   Les ennemis réapparaissent en boucle : le but est de répéter un geste, pas
   de nettoyer la pièce.
   ========================================================================== */
'use strict';

NIVEAUX['entrainement'] = {
  nom: 'Camp d\'entraînement',
  entrainement: true,          // aucune récompense, ennemis en boucle
  musique: null,               // on garde la musique du hub
  largeur: 42,
  hauteur: 18,
  apparition: { x: 3, y: 12 },

  zones: [
    {
      x1: 999,
      nom: 'Camp d\'entraînement',
      cielHaut: '#1a1524', cielBas: '#2a2438',
      loin: '#221c30', pres: '#2c2440',
      solFace: '#332b44', solHaut: '#4e4266', solLigne: '#6d5c8c',
      silhouettes: 'entrainement',
    },
  ],

  porte: { x: 38, y: 12, w: 2, h: 3 },

  solides: [
    [0, 15, 40, 3],                       // le tapis
    [8, 13, 4, 1], [13, 11, 4, 1],        // deux corniches pour le combat aérien
    [26, 12, 3, 1],
    [22, 13, 2, 2],                       // un bloc pour tester l'écrasement
    [-2, 0, 2, 18], [40, 0, 2, 18],
  ],

  traversantes: [
    [11, 9, 4],
  ],

  panneaux: [
    { x: 2, y: 13, texte: 'Aucune récompense ici. C\'est fait exprès.' },
    { x: 9, y: 10, texte: 'Attaque aérienne' },
    { x: 20, y: 11, texte: 'Écrasement' },
    { x: 30, y: 13, texte: 'Ils reviennent toujours' },
    { x: 36, y: 13, texte: 'Sortie' },
  ],

  ennemis: [
    { type: 'Serra', x: 12, y: 15, rayon: 3 },
    { type: 'Serra', x: 18, y: 15, rayon: 3 },
    { type: 'Serra-Boost', x: 25, y: 15, rayon: 4 },
    { type: 'Serra-Lourd', x: 31, y: 15, rayon: 3 },
    { type: 'Serra-Volant', x: 15, y: 9, rayon: 4 },
    { type: 'Serra-Volant', x: 28, y: 8, rayon: 4 },
    { type: 'Serra-Lanceur', x: 34, y: 15 },
    { type: 'Serra', x: 36, y: 15, rayon: 2 },
  ],
};
