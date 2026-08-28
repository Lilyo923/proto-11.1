/* =============================================================================
   NIVEAU 3 — La vallee enchantee, et le premier gardien

   Trois zones au lieu de deux :
     1. la clairiere       — lumineuse, aeree, on respire apres la ville
     2. le bosquet         — resserre, champignons geants, plus de volants
     3. l'arene            — plate, large, close : la salle du boss

   La troisieme zone n'est pas un decor de plus, c'est une regle. Le combat
   demande de l'espace pour courir entre le boss et ses renforts ; une arene
   encombree de plateformes rendrait la phase blindee illisible. Le sol y est
   donc d'un seul tenant, avec juste deux corniches pour souffler.

   C'est ici que tombe la premiere piece de l'appareil a raclette : le poelon.

   Reperes : une tuile = 24 px, la rangee de sol de reference est la 15.
   ========================================================================== */
'use strict';

NIVEAUX['niveau3'] = {
  nom: 'Vallée enchantée',
  musique: 'niveau3',
  largeur: 260,
  hauteur: 18,
  apparition: { x: 3, y: 12 },

  zones: [
    {
      x1: 96,
      nom: 'La clairière',
      cielHaut: '#6aa8d8', cielBas: '#cfe6c8',
      loin: '#5d7f8c', pres: '#3f6b52',
      solFace: '#5a4330', solHaut: '#4f9a48', solLigne: '#74c25c',
      silhouettes: 'vallee',
    },
    {
      x1: 196,
      nom: 'Le bosquet profond',
      cielHaut: '#2c3f52', cielBas: '#54706a',
      loin: '#2b4038', pres: '#3a5a46',
      solFace: '#3f3324', solHaut: '#3d7a44', solLigne: '#5da155',
      silhouettes: 'bosquet',
    },
    {
      x1: 999,
      nom: 'Le cercle de pierres',
      cielHaut: '#221a34', cielBas: '#4a3560',
      loin: '#2a2140', pres: '#372b4e',
      solFace: '#3c3050', solHaut: '#584772', solLigne: '#7d63a4',
      silhouettes: 'arene',
    },
  ],

  /* Deux sas : un par changement de decor. Le second est aussi la porte de
     l'arene — franchir cette ligne engage le combat. */
  sas: { x: 94.5, y: 9, w: 3, h: 6, style: 'foret' },
  sas2: { x: 194.5, y: 9, w: 3, h: 6, style: 'pierre' },

  /* La porte est DANS l'arene, apres le boss : elle reste verrouillee tant
     qu'il est debout. Elle doit rester en deca du mur de droite du niveau
     (tuile 256), sinon elle est tout simplement inatteignable. */
  porte: { x: 250, y: 12, w: 2, h: 3 },

  /* L'arene. `x1` est la ligne de declenchement ET le mur de gauche ; `x2` le
     mur du fond. Le boss apparait a `depart`, les renforts aux positions des
     vagues — reparties de part et d'autre pour que le joueur ne puisse pas
     tenir un seul coin. */
  arene: {
    x1: 200, x2: 254, sol: 15,
    nom: 'LE GARDIEN DU POÊLON',
    musique: 'boss3',            // Mini-boss_3 : elle remplace celle du niveau
    boss: 'Serra-Colosse',
    objet: 'poelon',
    depart: { x: 240, y: 15 },
    /* Un trampoline dans chaque coin. Sans eux, un joueur accule par le
       Colosse n'avait aucune sortie : le boss est plus large que Brad, il le
       plaquait contre le mur, et le combat se terminait par une mort qui ne
       devait rien a son niveau de jeu. */
    trampolines: [
      { x: 201, y: 15, w: 3 },
      { x: 244, y: 15, w: 3 },   // decale : la porte est en 250
    ],

    /* Les volants apparaissent BAS (rangee 11, pas 7). Un renfort hors
       d'atteinte d'un saut normal transformerait la phase blindee en attente,
       puisque le blindage ne tombe qu'une fois la vague nettoyee. */
    renforts: [
      [ { type: 'Serra', x: 206, y: 15 },
        { type: 'Serra', x: 248, y: 15 } ],
      [ { type: 'Serra-Boost', x: 204, y: 15 },
        { type: 'Serra-Volant', x: 228, y: 11 },
        { type: 'Serra', x: 250, y: 15 } ],
      [ { type: 'Serra-Boost', x: 205, y: 15 },
        { type: 'Serra-Boost', x: 249, y: 15 },
        { type: 'Serra-Volant', x: 216, y: 11 },
        { type: 'Serra-Volant', x: 240, y: 11 } ],
    ],
  },

  /* Meme regle de trace que le niveau 2 : un chemin de sol garanti (trous de
     3 a 4 tuiles, rien au-dessus des elans, obstacles de 2 tuiles au plus), et
     tout le reste en voies optionnelles. L'arene, elle, est d'un seul tenant.
  -------------------------------------------------------------------------- */
  solides: [
    // ---- ZONE 1 : la clairiere --------------------------------------------
    [0, 15, 20, 3],
    [9, 13, 5, 2],
    [23, 15, 15, 3],
    [26, 12, 4, 1], [30, 10, 4, 1],       // souches en escalier (optionnel)
    [41, 15, 13, 3],
    [43, 13, 5, 2],                       // rocher moussu
    [57, 15, 12, 3],
    [59, 12, 6, 1],
    [72, 15, 14, 3],
    [74, 12, 4, 1], [77, 10, 5, 1],
    [89, 15, 7, 3],

    // ---- ZONE 2 : le bosquet ----------------------------------------------
    [96, 15, 16, 3],
    [99, 11, 5, 1],
    [105, 13, 4, 2],
    [115, 15, 14, 3],
    [117, 13, 4, 2],                      // pied de champignon
    [132, 15, 12, 3],
    [134, 11, 5, 1], [140, 9, 5, 1],      // montee optionnelle
    [148, 15, 14, 3],
    [150, 12, 5, 1],
    [165, 15, 13, 3],
    [167, 12, 4, 1], [172, 9, 5, 1],
    [181, 15, 15, 3],
    [183, 13, 4, 2],
    [188, 11, 5, 1],

    // ---- ZONE 3 : l'arene -------------------------------------------------
    // Un sol d'un seul tenant : le combat a besoin de place, pas de reliefs.
    [196, 15, 60, 3],
    [205, 12, 5, 1],                      // corniche gauche — rangee 12, atteignable
    [228, 12, 5, 1],                      // corniche droite — degagee de la porte ET du point de chute de la piece (tuile 240)
    [-2, 0, 2, 18], [256, 0, 2, 18],
  ],

  /* Une barre au-dessus du plus large trou du bosquet. Comme au niveau 2,
     le saut reste possible sans elle. */
  mobiles: [
    { x1: 142, x2: 152, y: 12, w: 3, vitesse: 56, phase: 0.25 },
  ],

  traversantes: [
    [16, 12, 5],
    [49, 12, 5],
    [64, 12, 5],
    [109, 12, 5],
    [121, 10, 5],                         // perchoir du champignon
    [155, 12, 5],
    [186, 10, 5],
    [222, 12, 6],                         // perchoir central, a portee de saut
  ],

  panneaux: [
    { x: 4, y: 13, texte: 'La vallée enchantée. Le nom est du BRADDY3000.' },
    { x: 30, y: 10, texte: 'Rien d\'enchanté pour l\'instant.' },
    { x: 74, y: 10, texte: 'Bon. Un peu enchanté.' },
    { x: 90, y: 13, texte: 'Le bosquet →' },
    { x: 120, y: 11, texte: 'Ces champignons sont trop grands.' },
    { x: 170, y: 11, texte: 'Quelque chose respire, plus loin.' },
    { x: 190, y: 13, texte: 'Cercle de pierres →' },
    { x: 220, y: 13, texte: 'Il garde quelque chose.' },
    { x: 247, y: 13, texte: 'Sortie' },
  ],

  ennemis: [
    // --- zone 1 : la clairiere, respiration apres la ville
    { type: 'Serra', x: 16, y: 15, rayon: 3 },
    { type: 'Serra-Volant', x: 22, y: 9, rayon: 4 },
    { type: 'Serra', x: 26, y: 15, rayon: 3 },
    { type: 'Serra-Boost', x: 42, y: 15, rayon: 4 },
    { type: 'Serra', x: 44, y: 13, rayon: 2 },
    { type: 'Serra-Volant', x: 57, y: 8, rayon: 5 },
    { type: 'Serra', x: 60, y: 12, rayon: 2 },
    { type: 'Serra-Lourd', x: 67, y: 15, rayon: 3 },
    { type: 'Serra-Boost', x: 85, y: 15, rayon: 4 },
    { type: 'Serra', x: 91, y: 15, rayon: 3 },

    // --- zone 2 : le bosquet, plus dense, plus aerien
    { type: 'Serra', x: 100, y: 15, rayon: 3 },
    { type: 'Serra-Lanceur', x: 109, y: 12 },
    { type: 'Serra-Volant', x: 111, y: 8, rayon: 5 },
    { type: 'Serra-Boost', x: 111, y: 15, rayon: 4 },
    { type: 'Serra', x: 134, y: 15, rayon: 3 },
    { type: 'Serra', x: 135, y: 11, rayon: 2 },
    { type: 'Serra-Volant', x: 142, y: 7, rayon: 6 },
    { type: 'Serra-Lourd', x: 150, y: 15, rayon: 3 },
    { type: 'Serra-Lanceur', x: 150, y: 12 },
    { type: 'Serra-Boost', x: 161, y: 15, rayon: 4 },
    { type: 'Serra-Volant', x: 166, y: 8, rayon: 5 },
    { type: 'Serra', x: 175, y: 15, rayon: 3 },
    { type: 'Serra', x: 168, y: 12, rayon: 2 },
    { type: 'Serra-Lourd', x: 188, y: 15, rayon: 3 },
    { type: 'Serra-Boost', x: 192, y: 15, rayon: 3 },

    // --- zone 3 : l'arene est vide au depart. Le boss et ses renforts
    //     apparaissent quand Brad franchit la ligne, pas avant.
  ],
};
