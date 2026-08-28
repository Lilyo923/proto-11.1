/* =============================================================================
   NIVEAU — Introduction
   « Zone de largage » puis « Complexe — niveau -2 ».

   Un niveau est une pure description : geometrie, zones de decor, ennemis,
   musique. Aucun code de gameplay ici — le moteur consomme ces donnees via
   chargerNiveau(). Ajouter un niveau, c'est ajouter un fichier de ce genre et
   son <script> dans index.html.

   Reperes : une tuile = 24 px, la rangee de sol de reference est la 15.
   ========================================================================== */
'use strict';

NIVEAUX['intro'] = {
  nom: 'Niveau d\'introduction',
  musique: 'intro',
  largeur: 266,
  hauteur: 18,
  apparition: { x: 3, y: 12 },

  zones: [
    {
      x1: 138,
      nom: 'Zone de largage',
      cielHaut: '#141a30', cielBas: '#2d2a48',
      loin: '#1b2138', pres: '#232a44',
      solFace: '#2f3350', solHaut: '#4a5178', solLigne: '#6b74a8',
      silhouettes: 'tours',
    },
    {
      x1: 999,
      nom: 'Complexe — niveau -2',
      cielHaut: '#0f1520', cielBas: '#1d2a2c',
      loin: '#16202a', pres: '#1d2b33',
      solFace: '#2b3230', solHaut: '#46524a', solLigne: '#657a67',
      silhouettes: 'tuyaux',
    },
  ],

  sas: { x: 136.5, y: 9, w: 3, h: 6 },
  porte: { x: 256, y: 12, w: 2, h: 3 },

  solides: [
    // ---- ZONE 1 : exterieur futuriste -------------------------------------
    [0, 15, 30, 3],                                        // sol de lancement
    [33, 15, 15, 3],                                       // apres le trou
    [48, 14, 3, 4], [51, 13, 3, 5], [54, 12, 3, 6],        // escalier
    [57, 11, 10, 7],                                       // plateau du Lourd
    [88, 6, 3, 12],                                        // mur a franchir
    [91, 15, 14, 3],                                       // corridor bas
    [94, 10, 9, 1],                                        // plafond bas
    [98, 12, 4, 1],                                        // corniche du Lanceur
    [105, 15, 13, 3],
    [120, 14, 1, 4], [123, 14, 1, 4], [126, 14, 1, 4], [129, 14, 1, 4],
    [132, 15, 12, 3],                                      // sas de transition

    // ---- ZONE 2 : interieur du complexe ------------------------------------
    [144, 15, 18, 3],                                      // couloir d'entree
    [150, 12, 8, 1],                                       // plafond du couloir
    [165, 15, 13, 3],
    [178, 14, 2, 4], [180, 13, 2, 5], [182, 12, 2, 6],     // escalier montant
    [184, 12, 14, 6],                                      // plateforme technique
    [190, 9, 3, 1],                                        // corniche du Lanceur
    [206, 13, 10, 5],
    [219, 15, 14, 3],
    [235, 14, 1, 4], [238, 14, 1, 4], [241, 14, 1, 4],     // piliers de precision
    [244, 15, 20, 3],                                      // ligne d'arrivee

    [-2, 0, 2, 18], [264, 0, 2, 18],                       // murs de fin de niveau
  ],

  traversantes: [
    [70, 12, 4], [76, 10, 4], [82, 8, 4],                  // zone 1
    [199, 12, 5],                                          // pont vers le bloc de la zone 2
  ],

  panneaux: [
    { x: 3, y: 13, texte: 'Inertie : lance et relâche' },
    { x: 16, y: 13, texte: 'Écrase-le (saut) ou frappe (X)' },
    { x: 26, y: 13, texte: 'Trou : coyote time' },
    { x: 35, y: 13, texte: 'Le coureur charge vite' },
    { x: 44, y: 13, texte: 'Escalier' },
    { x: 58, y: 9, texte: 'Le Lourd ne s\'écrase pas — mais on peut lui marcher dessus' },
    { x: 70, y: 10, texte: 'Plateformes traversables' },
    { x: 80, y: 6, texte: 'Le Volant : attaque en l\'air' },
    { x: 92, y: 13, texte: 'Lanceur : renvoie-lui sa boule' },
    { x: 108, y: 13, texte: 'Onde de choc : C quand la jauge est pleine' },
    { x: 118, y: 12, texte: 'Précision : jump buffer' },
    { x: 126, y: 13, texte: 'Sas — accès au complexe' },
    { x: 146, y: 13, texte: 'Plafond bas : petit saut' },
    { x: 186, y: 10, texte: 'Deux fronts à la fois' },
    { x: 220, y: 13, texte: 'Dernière ligne droite' },
    { x: 250, y: 13, texte: 'Sortie' },
  ],

  ennemis: [
    // ---- ZONE 1 ------------------------------------------------------------
    { type: 'Serra', x: 18, y: 15 },
    { type: 'Serra', x: 24, y: 15 },
    { type: 'Serra-Boost', x: 40, y: 15 },
    { type: 'Serra', x: 45, y: 15 },
    { type: 'Serra-Lourd', x: 62, y: 11, rayon: 3 },
    { type: 'Serra-Volant', x: 79, y: 7, rayon: 2.5 },
    { type: 'Serra-Volant', x: 85, y: 5, rayon: 2.5 },
    { type: 'Serra-Lanceur', x: 100, y: 10 },   // sur la grande corniche : a la rangee 12, la plateforme du dessus lui traversait la tete
    { type: 'Serra', x: 96, y: 15 },
    { type: 'Serra-Boost', x: 110, y: 15 },
    { type: 'Serra', x: 113, y: 15 },
    { type: 'Serra', x: 116, y: 15 },
    { type: 'Serra-Boost', x: 136, y: 15, rayon: 3 },

    // ---- ZONE 2 ------------------------------------------------------------
    { type: 'Serra', x: 148, y: 15 },
    { type: 'Serra', x: 156, y: 15 },
    { type: 'Serra-Boost', x: 170, y: 15, rayon: 4 },
    { type: 'Serra', x: 175, y: 15 },
    { type: 'Serra-Lourd', x: 189, y: 12, rayon: 4 },
    { type: 'Serra-Lanceur', x: 191, y: 9 },
    { type: 'Serra-Volant', x: 196, y: 8, rayon: 3 },
    { type: 'Serra-Volant', x: 210, y: 9, rayon: 3 },
    { type: 'Serra', x: 210, y: 13 },
    { type: 'Serra-Boost', x: 224, y: 15, rayon: 4 },
    { type: 'Serra', x: 229, y: 15 },
    { type: 'Serra-Volant', x: 238, y: 10, rayon: 2.5 },
    { type: 'Serra', x: 248, y: 15 },
    { type: 'Serra-Lourd', x: 252, y: 15, rayon: 2 },
  ],
};
