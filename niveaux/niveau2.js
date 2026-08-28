/* =============================================================================
   NIVEAU 2 — La ville, en ete

   Zone 1 : les rues. Toits bas, climatiseurs, echafaudages — on grimpe autant
   qu'on avance, ce qui change du niveau 1 ou tout se jouait au sol.
   Zone 2 : l'arriere-cour. Plus resserree, plus verticale, avec des lanceurs
   postes en hauteur : c'est la que le niveau demande de la lecture.

   Aucun objet majeur ici : les pieces de l'appareil a raclette sont gardees
   par les boss des niveaux 3, 6 et 9. Le niveau 2 est un niveau de metier.

   Reperes : une tuile = 24 px, la rangee de sol de reference est la 15.
   ========================================================================== */
'use strict';

NIVEAUX['niveau2'] = {
  nom: 'Ville ghetto — été',
  musique: 'niveau2',
  largeur: 244,
  hauteur: 18,
  apparition: { x: 3, y: 12 },

  zones: [
    {
      x1: 124,
      nom: 'Les rues',
      cielHaut: '#4d7fb0', cielBas: '#e0b183',   // fin d'apres-midi d'ete
      loin: '#3c4a63', pres: '#2c3648',
      solFace: '#4a4038', solHaut: '#6b6156', solLigne: '#8c8073',
      silhouettes: 'immeubles',
    },
    {
      x1: 999,
      nom: 'L\'arrière-cour',
      cielHaut: '#3a4a66', cielBas: '#8f7a72',
      loin: '#2c3444', pres: '#232a38',
      solFace: '#3b3630', solHaut: '#57504a', solLigne: '#756c63',
      silhouettes: 'cour',
    },
  ],

  sas: { x: 122.5, y: 9, w: 3, h: 6, style: 'grille' },
  porte: { x: 236, y: 12, w: 2, h: 3 },

  /* REGLE DE TRACE, apprise a la dure sur ce niveau.

     1. Le chemin du sol est le chemin garanti. Ses trous ne depassent jamais
        4 tuiles (96 px) alors que Brad court a 141 px de portee : il reste de
        la marge meme sans elan parfait.
     2. Rien au-dessus d'un elan. Une plateforme posee juste avant un trou fait
        cogner Brad en plein saut et le precipite dedans — le pire bug de
        niveau qui soit, parce qu'il ressemble a une erreur du joueur.
     3. Les obstacles poses au sol font 2 tuiles au plus (48 px), et jamais
        contre le bord d'un trou.
     Tout ce qui monte plus haut est une VOIE OPTIONNELLE : des pieces, un
     raccourci, une position de tir. Jamais un passage oblige.
  -------------------------------------------------------------------------- */
  solides: [
    // ---- ZONE 1 : les rues -------------------------------------------------
    [0, 15, 22, 3],
    [10, 13, 6, 2],                       // auvent bas, loin du trou
    [25, 15, 16, 3],
    [29, 12, 5, 1], [35, 9, 5, 1],        // escalier de secours (optionnel)
    [44, 15, 12, 3],
    [45, 13, 5, 2],                       // muret
    [59, 15, 15, 3],
    [61, 12, 5, 1],                       // climatiseur, a portee depuis le sol
    [67, 13, 4, 2],
    [77, 15, 16, 3],
    [79, 12, 5, 1], [84, 9, 5, 1],        // echafaudage
    [97, 15, 14, 3],
    [99, 13, 4, 2],                       // benne
    [104, 10, 4, 1],                       // passerelle, assez haute pour la benne
    [114, 15, 10, 3],

    // ---- ZONE 2 : l'arriere-cour ------------------------------------------
    [124, 15, 16, 3],
    [126, 11, 5, 1],
    [133, 13, 4, 2],
    [143, 15, 14, 3],
    [145, 13, 3, 2],                      // pilier bas
    [149, 12, 5, 1],
    [161, 15, 14, 3],
    [163, 11, 5, 1], [169, 8, 5, 1],      // montee vers les toits (optionnel)
    [178, 15, 16, 3],
    [180, 13, 4, 2],
    [184, 12, 6, 1],
    [198, 15, 14, 3],
    [200, 12, 5, 1], [206, 9, 5, 1],
    [215, 15, 25, 3],
    [219, 11, 7, 1],
    [228, 13, 4, 2],                      // dernier appui avant la porte
    [-2, 0, 2, 18], [240, 0, 2, 18],
  ],

  /* Deux barres mobiles au-dessus du vide. Elles sont posees sur des trous
     que Brad peut DEJA franchir d'un saut : la barre est un confort et une
     variation de rythme, jamais le seul passage. Un niveau qui depend d'une
     plateforme mobile devient injouable si elle se bloque. */
  mobiles: [
    { x1: 38, x2: 47, y: 13, w: 3, vitesse: 52, phase: 0 },
    { x1: 154, x2: 164, y: 12, w: 3, vitesse: 62, phase: 0.5 },
  ],

  traversantes: [
    [17, 10, 5],
    [52, 12, 5],
    [82, 12, 5],
    [136, 12, 5],
    [172, 9, 5],
    [210, 8, 5],
  ],

  panneaux: [
    { x: 4, y: 13, texte: 'La ville. Brad n\'a jamais aimé la ville.' },
    { x: 32, y: 10, texte: 'Ça monte.' },
    { x: 76, y: 10, texte: 'Échafaudage. Personne ne travaille dessus.' },
    { x: 118, y: 13, texte: 'Arrière-cour →' },
    { x: 148, y: 11, texte: 'Ils tirent d\'en haut.' },
    { x: 200, y: 13, texte: 'Presque.' },
    { x: 232, y: 13, texte: 'Sortie' },
  ],

  ennemis: [
    // --- zone 1 : on introduit doucement la verticalite
    { type: 'Serra', x: 17, y: 15, rayon: 3 },
    { type: 'Serra', x: 27, y: 15, rayon: 3 },
    { type: 'Serra-Volant', x: 33, y: 8, rayon: 4 },
    { type: 'Serra-Boost', x: 44, y: 15, rayon: 4 },
    { type: 'Serra', x: 47, y: 13, rayon: 3 },
    { type: 'Serra-Volant', x: 60, y: 7, rayon: 5 },
    { type: 'Serra', x: 72, y: 15, rayon: 4 },
    { type: 'Serra-Lourd', x: 79, y: 15, rayon: 3 },
    { type: 'Serra-Boost', x: 89, y: 15, rayon: 4 },
    { type: 'Serra-Volant', x: 101, y: 9, rayon: 5 },
    { type: 'Serra', x: 106, y: 10, rayon: 2 },
    { type: 'Serra', x: 116, y: 15, rayon: 3 },
    { type: 'Serra-Lanceur', x: 120, y: 15 },

    // --- zone 2 : la cour, plus dense et plus haute
    { type: 'Serra', x: 128, y: 15, rayon: 3 },
    { type: 'Serra-Lanceur', x: 128, y: 11 },
    { type: 'Serra-Boost', x: 144, y: 15, rayon: 4 },
    { type: 'Serra-Volant', x: 150, y: 8, rayon: 5 },
    { type: 'Serra', x: 163, y: 15, rayon: 4 },
    { type: 'Serra', x: 164, y: 11, rayon: 2 },
    { type: 'Serra-Lourd', x: 172, y: 15, rayon: 3 },
    { type: 'Serra-Lanceur', x: 184, y: 12 },
    { type: 'Serra-Volant', x: 184, y: 7, rayon: 6 },
    { type: 'Serra-Boost', x: 189, y: 15, rayon: 5 },
    { type: 'Serra', x: 186, y: 12, rayon: 2 },
    { type: 'Serra-Volant', x: 200, y: 9, rayon: 5 },
    { type: 'Serra', x: 205, y: 15, rayon: 3 },
    { type: 'Serra-Lourd', x: 218, y: 15, rayon: 4 },
    { type: 'Serra', x: 222, y: 11, rayon: 3 },
    { type: 'Serra-Boost', x: 224, y: 15, rayon: 4 },
  ],
};
