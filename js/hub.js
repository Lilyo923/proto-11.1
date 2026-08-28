/* =============================================================================
   BRAD BITT, MAIS LE JEU — le hub

   Une base souterraine que Brad parcourt a pied, façon Splatoon : on ne
   choisit pas dans un menu, on va physiquement jusqu'au comptoir. Quatre
   postes : la boutique du BRADDY3000, le vestiaire, la borne d'arcade et la
   carte des niveaux.

   Brad y a son propre acteur, distinct de celui du niveau : le hub n'a ni
   combat, ni PV, ni Brad-Shy, et melanger les deux etats exposerait le jeu a
   des bugs sournois (mourir dans le hub, garder une boule de Serrano en
   sortant du magasin...).
   ========================================================================== */
'use strict';

const HUB_L = 1840;              // largeur de la base, en pixels
const BRADDY_X = 300;            // poste du robot, hors mise en scene
const HUB_SOL = 296;             // ligne de sol

const POSTES = [
  { cle: 'boutique',     x: 210,  nom: 'Boutique',    sous: 'BRADDY3000' },
  { cle: 'vestiaire',    x: 520,  nom: 'Vestiaire',   sous: 'Uniformes' },
  { cle: 'entrainement', x: 820,  nom: 'Entraînement', sous: 'Aucune récompense' },
  { cle: 'arcade',       x: 1120, nom: 'Arcade',      sous: 'Serra Invaders' },
  { cle: 'jukebox',      x: 1290, nom: 'Jukebox',     sous: 'Musique de la base' },
  { cle: 'carte',        x: 1560, nom: 'Carte',       sous: 'Départ en mission' },
];

const PORTEE_POSTE = 46;         // distance a laquelle un poste s'active
const PORTEE_BRADDY = 60;        // distance a laquelle on peut lui parler

const hub = {
  brad: null,
  poste: null,                   // poste a portee, ou null
  t: 0,
  braddy: { x: 300, y: 182, phase: 0 },   // x est deplace pendant les dialogues
  reponse: '',                   // replique affichee par le BRADDY3000
  reponseT: 0,                   // temps restant avant fermeture automatique
  reponseAge: 0,                 // depuis combien de temps elle est ouverte
  pretAParler: false,            // Brad est assez pres pour engager la conversation
};

/* La decouverte de la base ne se joue qu'une fois par partie, pas une fois par
   session : le drapeau vit dans la sauvegarde. Sinon, quitter puis relancer
   rejouerait la scene d'arrivee a chaque fois. */
Object.defineProperty(hub, 'premiereVisite', {
  get() { return !partie.hubVu; },
});

/* Un appui sur E devant le robot : ferme la bulle si elle est deja lisible,
   sinon en ouvre une. On ne peut donc pas fermer par accident la replique
   qu'on vient tout juste de declencher. */
function parlerAuBraddy() {
  if (bulleFermable()) {
    hub.reponse = '';
    hub.reponseT = 0;
    audio.bruit('menu');
    return;
  }
  braddyDit(repliqueBraddy());
  audio.bruit('menu');
}

function reinitialiserHub(depuisX) {
  hub.brad = {
    x: depuisX === undefined ? 120 : depuisX, y: HUB_SOL - 46, w: 22, h: 46,
    vx: 0, vy: 0, sens: 1, auSol: true,
    phaseMarche: 0, phaseRepos: 0, inactif: 0, etirement: 1,
  };
  hub.poste = null;
  hub.t = 0;
  camHub.x = 0;
}

/* -----------------------------------------------------------------------------
   CE QUE DIT LE BRADDY3000

   Une replique restait 3,4 s a l'ecran quelle que soit sa longueur : les
   courtes trainaient, les longues disparaissaient avant d'etre lues. Deux
   changements :

   1. la duree se calcule sur le texte — 2,2 s de base plus 55 ms par
      caractere, plafonnee a 14 s ;
   2. et surtout, la bulle attend qu'on la ferme. Passe un court delai de
      lecture, un « E ▸ » clignote dans le coin ; reappuyer sur E (ou toucher
      le robot) ferme la bulle, ou enchaine sur la replique suivante. Le
      minuteur reste comme filet : si le joueur s'eloigne ou fait autre chose,
      la bulle finit par se refermer seule.
-------------------------------------------------------------------------- */

const LECTURE_BASE = 2.2;        // secondes, quelle que soit la longueur
const LECTURE_PAR_CARACTERE = 0.055;
const LECTURE_MAX = 14;
const DELAI_AVANT_FERMETURE = 0.7;   // le temps qu'on lise le debut

function dureeReplique(texte) {
  return Math.min(LECTURE_MAX, LECTURE_BASE + texte.length * LECTURE_PAR_CARACTERE);
}

/* Fin de la scene de decouverte, qu'on l'ait regardee en entier ou passee.

   Pendant la scene, la camera se promene et les deux personnages la suivent :
   Brad peut finir a l'autre bout de la base, devant l'arcade ou dans le vide
   entre deux postes. En sortant, on remet donc tout a sa place de depart —
   Brad a l'entree, le robot a son comptoir, la camera au bord gauche. Sans
   ça, passer la scene deposait le joueur n'importe ou, et souvent deja dans
   la zone d'activation d'un poste.

   On coupe aussi la bulle du robot : elle avait sa propre duree et survivait
   a la scene, ce qui donnait une replique orpheline sur l'ecran d'arrivee. */
function terminerDialogueHub() {
  reinitialiserHub();
  hub.braddy.x = BRADDY_X;
  hub.reponse = '';
  hub.reponseT = 0;
  hub.reponseAge = 0;
  camHub.x = 0;
  scene = 'hub';
}

function braddyDit(texte) {
  hub.reponse = texte;
  hub.reponseT = dureeReplique(texte);
  hub.reponseAge = 0;
}

/* Vrai quand la bulle est ouverte depuis assez longtemps pour qu'un appui
   serve a la fermer plutot qu'a la rouvrir aussitot. */
function bulleFermable() {
  return hub.reponseT > 0 && hub.reponseAge >= DELAI_AVANT_FERMETURE;
}

const camHub = { x: 0 };

/* -----------------------------------------------------------------------------
   1. DEPLACEMENT
-------------------------------------------------------------------------- */

function majHub(dt) {
  hub.t += dt;
  hub.braddy.phase += dt;
  if (hub.reponseT > 0) { hub.reponseT -= dt; hub.reponseAge += dt; }

  const b = hub.brad;
  if (!b) return;

  const dir = (entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0);
  const cible = dir * R.vitesseMarche * (entrees.courir ? 1.5 : 1);
  const accel = dir ? R.acceleration : R.freinage;
  if (b.vx < cible) b.vx = Math.min(cible, b.vx + accel * dt);
  else if (b.vx > cible) b.vx = Math.max(cible, b.vx - accel * dt);
  if (dir) b.sens = dir;

  b.x += b.vx * dt;
  b.x = Math.max(40, Math.min(HUB_L - 62, b.x));

  // Un petit saut est possible, pour le plaisir : le hub reste un endroit ou
  // l'on controle Brad, pas un ecran de menu deguise.
  if (sautPresseCeTick && b.auSol && !hub.poste) {
    b.vy = -R.forceSaut * 0.7;
    b.auSol = false;
    audio.bruit('saut');
  }
  b.vy = Math.min(R.chuteMax, b.vy + R.gravite * (b.vy > 0 ? R.graviteChute : 1) * dt);
  b.y += b.vy * dt;
  if (b.y + b.h >= HUB_SOL) { b.y = HUB_SOL - b.h; b.vy = 0; b.auSol = true; }

  b.etirement += (1 - b.etirement) * Math.min(1, 12 * dt);
  b.phaseMarche += Math.abs(b.vx) * dt / LONGUEUR_PAS;
  b.phaseRepos += dt;
  b.inactif = (dir === 0 && b.auSol && Math.abs(b.vx) < 4) ? b.inactif + dt : 0;

  // Poste a portee
  const centre = b.x + b.w / 2;
  const avant = hub.poste;
  hub.poste = POSTES.find(p => Math.abs(p.x - centre) < PORTEE_POSTE) || null;
  if (hub.poste && hub.poste !== avant) audio.bruit('menu');

  // Le BRADDY3000 est un interlocuteur, pas un poste : on lui parle sans
  // ouvrir d'ecran, il repond dans sa bulle.
  hub.pretAParler = Math.abs(hub.braddy.x - centre) < PORTEE_BRADDY;

  // Entree dans un poste : le saut sert d'action quand on est devant.
  if (sautPresseCeTick && hub.poste) ouvrirPoste(hub.poste.cle);
  if (parlerPresseCeTick && hub.pretAParler) parlerAuBraddy();
  parlerPresseCeTick = false;
  sautPresseCeTick = false;

  const cibleCam = centre - LARGEUR / 2;
  camHub.x += (cibleCam - camHub.x) * Math.min(1, 6 * dt);
  camHub.x = Math.max(0, Math.min(HUB_L - LARGEUR, camHub.x));
}

function ouvrirPoste(cle) {
  audio.bruit('valider');
  indexBoutique = 0; ongletBoutique = 0; confirmation = null;
  indexVestiaire = 0; indexCarte = 0;
  if (cle === 'arcade') { ouvrirArcade(); return; }
  if (cle === 'jukebox') { ouvrirJukebox(); return; }
  if (cle === 'entrainement') {
    // Le camp est un vrai niveau, charge par le moteur habituel. Le drapeau
    // `entrainement` du fichier coupe toutes les recompenses.
    braddyDit('Rien à gagner ici. Juste à s\'améliorer.');
    relancerNiveau('entrainement');
    return;
  }
  scene = cle;
}

function fermerPoste() {
  audio.bruit('menu');
  confirmation = null;
  scene = 'hub';
}

function entrerHub(premiere) {
  reinitialiserHub();
  scene = 'hub';
  // La musique de la base est celle choisie au jukebox, plutot que le theme
  // d'intro emprunte au niveau 1.
  audio.jouerMusiqueDifferee(musiqueDeLaBase(), 1.4);
  if (premiere) {
    partie.hubVu = true;
    enregistrerPartie();
    lancerDialogue(DIALOGUE_HUB, terminerDialogueHub);
  }
}

/* -----------------------------------------------------------------------------
   2. RENDU DU DECOR
-------------------------------------------------------------------------- */

function dessinerHub() {
  const c = Math.round(camHub.x);

  // Fond : une salle technique, plus chaleureuse que le complexe du niveau.
  const g = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  g.addColorStop(0, '#171b28');
  g.addColorStop(1, '#232839');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Paroi du fond : panneaux et canalisations
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = -1; i < 20; i++) {
    const x = Math.round(i * 96 - c * 0.5);
    ctx.fillRect(x, 40, 78, HUB_SOL - 60);
  }
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = -1; i < 26; i++) {
    const x = Math.round(i * 72 - c * 0.75);
    ctx.fillRect(x, 0, 10, 40);
  }

  // Guirlande d'ampoules : le BRADDY3000 a decore.
  for (let i = -1; i < 24; i++) {
    const x = Math.round(i * 64 - c * 0.9);
    const y = 44 + Math.sin(i * 1.3) * 6;
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 64, 44 + Math.sin((i + 1) * 1.3) * 6); ctx.stroke();
    const brille = 0.45 + 0.55 * Math.sin(hub.t * 2 + i);
    ctx.fillStyle = 'rgba(232,182,44,' + brille.toFixed(2) + ')';
    ctx.fillRect(x - 1, y + 2, 3, 4);
  }

  dessinerVitrine(c);
  POSTES.forEach(p => dessinerPoste(p, c));

  // Sol
  ctx.fillStyle = '#2b3040'; ctx.fillRect(0, HUB_SOL, LARGEUR, HAUTEUR - HUB_SOL);
  ctx.fillStyle = '#454d66'; ctx.fillRect(0, HUB_SOL, LARGEUR, 5);
  ctx.fillStyle = '#5f6a8c'; ctx.fillRect(0, HUB_SOL, LARGEUR, 2);
  // Dalles
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let i = -1; i < 24; i++) ctx.fillRect(Math.round(i * 48 - c), HUB_SOL + 5, 2, HAUTEUR - HUB_SOL);

  dessinerBraddy(c);

  // Brad
  const b = hub.brad;
  if (b) {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(Math.round(b.x + b.w / 2 - c), HUB_SOL, b.w * 0.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    dessinerPlancheBrad(Math.round(b.x + b.w / 2 - c), Math.round(b.y + b.h),
                        b.sens, b.etirement, poseBrad(b));
  }

  hudHub(c);
}

/* -----------------------------------------------------------------------------
   LA VITRINE

   Trois emplacements au mur, entre le vestiaire et le camp. Les pieces
   trouvees y sont posees, les autres restent en silhouette : le joueur voit
   d'un coup d'oeil ou en est la quete, sans avoir a ouvrir un menu ni a
   demander au robot.

   Ce n'est pas un poste : rien a activer, rien a acheter. C'est un mur qui se
   remplit — le genre de recompense qui n'a pas besoin d'etre cliquable.
-------------------------------------------------------------------------- */

const VITRINE_X = 670;

function dessinerVitrine(c) {
  const x = Math.round(VITRINE_X - c);
  if (x < -160 || x > LARGEUR + 160) return;

  const y = HUB_SOL - 150;
  const l = 148, h = 74;

  // Caisson
  ctx.fillStyle = 'rgba(12,15,24,.85)';
  ctx.fillRect(x - l / 2, y, l, h);
  ctx.strokeStyle = 'rgba(232,182,44,.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - l / 2 + .5, y + .5, l - 1, h - 1);
  ctx.fillStyle = 'rgba(232,182,44,.55)';
  ctx.fillRect(x - l / 2, y, l, 2);

  // Titre et compteur
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,182,44,.8)';
  ctx.fillText('APPAREIL À RACLETTE', x, y - 6);
  ctx.font = '8px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillText(objetsTrouves() + ' / ' + OBJETS_MAJEURS.length, x, y + h + 11);

  // Les trois emplacements
  OBJETS_MAJEURS.forEach((o, i) => {
    const cx = x - l / 2 + 25 + i * 49;
    const cy = y + 30;
    const eu = aObjet(o.cle);

    ctx.fillStyle = eu ? 'rgba(232,182,44,.10)' : 'rgba(255,255,255,.035)';
    ctx.fillRect(cx - 21, y + 8, 42, h - 24);

    if (eu) {
      dessinerObjetMajeur(cx, cy, o.cle, 0.95, false);
      ctx.font = '7px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(232,182,44,.75)';
      ctx.fillText(o.court, cx, y + h - 8);
    } else {
      // Emplacement vide : le contour de la piece, en pointille, plus le
      // cadenas deja utilise partout ailleurs. Montrer la forme manquante
      // vaut mieux qu'un point d'interrogation.
      ctx.save();
      ctx.globalAlpha = 0.13;
      dessinerObjetMajeur(cx, cy, o.cle, 0.95, false);
      ctx.restore();
      dessinerCadenas(cx, cy + 20, 0.5, 'rgba(255,255,255,.22)');
      ctx.font = '7px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillText('Niv. ' + o.niveau.replace('niveau', ''), cx, y + h - 8);
    }
  });

  ctx.textAlign = 'left';

  // Support mural
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(x - 4, y + h, 8, HUB_SOL - (y + h));
}

function dessinerPoste(p, c) {
  const x = Math.round(p.x - c);
  if (x < -140 || x > LARGEUR + 140) return;
  const actif = hub.poste === p;

  ctx.save();
  ctx.translate(x, HUB_SOL);

  if (p.cle === 'boutique') {
    // Comptoir + ecran de terminal
    ctx.fillStyle = '#3a3050'; ctx.fillRect(-56, -46, 112, 46);
    ctx.fillStyle = '#4c4068'; ctx.fillRect(-56, -46, 112, 5);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(-48, -34, 96, 20);
    ctx.fillStyle = 'rgba(232,182,44,.25)';
    ctx.fillRect(-48, -34, 96, 1);
    ctx.fillStyle = '#141926'; ctx.fillRect(-44, -116, 88, 62);
    ctx.fillStyle = actif ? '#2a4b62' : '#1b3040'; ctx.fillRect(-40, -112, 80, 54);
    // lignes de texte du terminal
    ctx.fillStyle = 'rgba(111,208,232,.6)';
    for (let i = 0; i < 4; i++) {
      const l = 20 + ((i * 17 + Math.floor(hub.t * 2)) % 44);
      ctx.fillRect(-34, -104 + i * 12, l, 4);
    }
    ctx.fillStyle = '#e8b62c'; ctx.fillRect(-44, -122, 88, 5);

  } else if (p.cle === 'vestiaire') {
    // Portant a vetements
    ctx.fillStyle = '#2d3446'; ctx.fillRect(-52, -104, 104, 104);
    ctx.fillStyle = actif ? '#3d4a66' : '#232939'; ctx.fillRect(-46, -98, 92, 92);
    ctx.fillStyle = '#5f6a8c'; ctx.fillRect(-46, -76, 92, 3);
    // trois costumes suspendus
    const teintes = ['#d0453f', '#2c6cd8', '#e8b62c'];
    teintes.forEach((t, i) => {
      const cx = -30 + i * 30;
      ctx.fillStyle = '#1a1d28';
      ctx.fillRect(cx - 9, -73, 18, 34);
      ctx.fillStyle = t;
      ctx.fillRect(cx - 2, -71, 4, 16);
    });
    ctx.fillStyle = '#e8b62c'; ctx.fillRect(-52, -110, 104, 5);

  } else if (p.cle === 'arcade') {
    // Borne d'arcade
    ctx.fillStyle = '#402a44'; ctx.fillRect(-32, -118, 64, 118);
    ctx.fillStyle = '#54385c'; ctx.fillRect(-32, -118, 64, 6);
    ctx.fillStyle = '#0c1018'; ctx.fillRect(-24, -106, 48, 40);
    // ecran anime
    ctx.fillStyle = actif ? '#16324a' : '#101c2c';
    ctx.fillRect(-22, -104, 44, 36);
    for (let i = 0; i < 5; i++) {
      const px = -18 + ((i * 9 + Math.floor(hub.t * 12)) % 40);
      ctx.fillStyle = i % 2 ? '#e2553b' : '#e8b62c';
      ctx.fillRect(px, -96 + (i % 3) * 8, 4, 4);
    }
    ctx.fillStyle = '#c9564f'; ctx.fillRect(-16, -58, 10, 6);
    ctx.fillStyle = '#4c9be0'; ctx.fillRect(2, -58, 10, 6);
    ctx.fillStyle = '#1a1d28'; ctx.fillRect(-24, -50, 48, 6);

  } else if (p.cle === 'jukebox') {
    dessinerBorneJukebox(0);

  } else if (p.cle === 'entrainement') {
    // Un dojo de fortune : tapis, mannequin, sac de frappe.
    ctx.fillStyle = '#2a3446'; ctx.fillRect(-58, -108, 116, 108);
    ctx.fillStyle = actif ? '#3a4a66' : '#212a3a'; ctx.fillRect(-52, -102, 104, 96);
    // tapis au sol
    ctx.fillStyle = '#8a4a3c'; ctx.fillRect(-50, -12, 100, 12);
    ctx.fillStyle = '#a55c48'; ctx.fillRect(-50, -12, 100, 3);
    // mannequin d'entrainement
    ctx.fillStyle = '#4a4054'; ctx.fillRect(-28, -14, 8, 14);
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(-34, -46, 20, 32);
    ctx.fillStyle = '#8a6a32'; ctx.fillRect(-34, -46, 20, 5);
    // sac de frappe suspendu, qui se balance
    const bal = Math.sin(hub.t * 1.6) * 4;
    ctx.fillStyle = '#3a3040';
    ctx.fillRect(18 + bal * 0.4, -96, 2, 22);
    ctx.fillStyle = '#7a4b3a';
    ctx.fillRect(11 + bal, -74, 16, 34);
    ctx.fillStyle = '#8f5a45'; ctx.fillRect(11 + bal, -74, 16, 4);
    ctx.fillStyle = '#e8b62c'; ctx.fillRect(-58, -114, 116, 5);

  } else if (p.cle === 'carte') {
    // Sas de depart en mission
    ctx.fillStyle = '#525d75'; ctx.fillRect(-52, -128, 104, 10);
    ctx.fillStyle = '#525d75'; ctx.fillRect(-52, -128, 10, 128);
    ctx.fillStyle = '#525d75'; ctx.fillRect(42, -128, 10, 128);
    const grad = ctx.createLinearGradient(0, 0, 0, -118);
    grad.addColorStop(0, actif ? 'rgba(232,182,44,.5)' : 'rgba(232,182,44,.18)');
    grad.addColorStop(1, 'rgba(232,182,44,0)');
    ctx.fillStyle = '#0d1119'; ctx.fillRect(-42, -118, 84, 118);
    ctx.fillStyle = grad; ctx.fillRect(-42, -118, 84, 118);
    // bandes au sol
    ctx.fillStyle = 'rgba(232,182,44,.45)';
    for (let i = 0; i < 7; i++) ctx.fillRect(-40 + i * 12, -5, 6, 4);
  }

  // Enseigne
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = actif ? '#ffe9a8' : 'rgba(255,255,255,.55)';
  ctx.fillText(p.nom.toUpperCase(), 0, -132);
  ctx.font = '8px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  ctx.fillText(p.sous, 0, -122);
  ctx.textAlign = 'left';
  ctx.restore();

  // Invite d'interaction
  if (actif) {
    const y = HUB_SOL - 160 + Math.round(Math.sin(hub.t * 4) * 2);
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const t = estTactile ? 'Touche ▲ pour entrer' : 'Espace pour entrer';
    const l = ctx.measureText(t).width + 14;
    ctx.fillStyle = 'rgba(9,11,20,.85)';
    ctx.fillRect(x - l / 2, y - 11, l, 17);
    ctx.strokeStyle = 'rgba(232,182,44,.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - l / 2 + .5, y - 10.5, l - 1, 16);
    ctx.fillStyle = '#e8b62c';
    ctx.fillText(t, x, y + 1);
    ctx.textAlign = 'left';
    zone(x - l / 2, y - 11, l, 17, 'entrer-poste', hub.poste.cle);
  }
}

/* Le BRADDY3000 : une machine qui flotte pres de la boutique et commente. */
function dessinerBraddy(c) {
  const x = Math.round(hub.braddy.x - c);
  const y = Math.round(hub.braddy.y + Math.sin(hub.braddy.phase * 1.6) * 4);
  if (x < -80 || x > LARGEUR + 80) return;

  // Corps
  ctx.fillStyle = '#39415a'; ctx.fillRect(x - 14, y - 16, 28, 26);
  ctx.fillStyle = '#4d5678'; ctx.fillRect(x - 14, y - 16, 28, 4);
  ctx.fillStyle = '#0e1420'; ctx.fillRect(x - 10, y - 11, 20, 13);
  // Oeil qui balaie
  const oeil = Math.round(Math.sin(hub.braddy.phase * 0.9) * 5);
  ctx.fillStyle = '#6fd0e8'; ctx.fillRect(x - 3 + oeil, y - 8, 6, 7);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 2 + oeil, y - 7, 2, 3);
  // Antenne
  ctx.fillStyle = '#4d5678'; ctx.fillRect(x - 1, y - 24, 2, 8);
  ctx.fillStyle = '#e8b62c'; ctx.fillRect(x - 2, y - 27, 4, 4);
  // Propulseur
  ctx.fillStyle = 'rgba(111,208,232,' + (0.25 + 0.2 * Math.sin(hub.braddy.phase * 8)).toFixed(2) + ')';
  ctx.fillRect(x - 8, y + 10, 16, 5);

  // Le corps du robot reste cliquable des que Brad est a portee, meme pendant
  // qu'il parle : au doigt, on relance la conversation en le touchant, sans
  // attendre que la bulle se referme.
  if (hub.pretAParler && scene === 'hub') zone(x - 18, y - 28, 36, 44, 'parler-braddy');

  if (hub.reponseT > 0) { bulle(x, y - 34, hub.reponse); return; }

  // Invite : « E pour parler ». Elle ne s'affiche que quand Brad est assez
  // pres, et disparait pendant qu'il repond.
  if (!hub.pretAParler || scene !== 'hub') return;
  const py = y - 40 + Math.round(Math.sin(hub.t * 4) * 2);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const t = estTactile ? 'Touche-le pour parler' : 'E pour parler';
  const l = ctx.measureText(t).width + 14;
  ctx.fillStyle = 'rgba(9,11,20,.85)';
  ctx.fillRect(x - l / 2, py - 11, l, 17);
  ctx.strokeStyle = 'rgba(111,208,232,.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - l / 2 + .5, py - 10.5, l - 1, 16);
  ctx.fillStyle = '#6fd0e8';
  ctx.fillText(t, x, py + 1);
  ctx.textAlign = 'left';
  zone(x - l / 2, py - 11, l, 17, 'parler-braddy');
}

function bulle(x, y, texte) {
  ctx.font = '10px system-ui, sans-serif';
  const mots = texte.split(' ');
  const lignes = [];
  let ligne = '';
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m;
    if (ctx.measureText(essai).width > 172 && ligne) { lignes.push(ligne); ligne = m; }
    else ligne = essai;
  }
  if (ligne) lignes.push(ligne);

  const invite = bulleFermable();
  const w = Math.min(190, Math.max(...lignes.map(l => ctx.measureText(l).width)) + 16);
  const h = lignes.length * 13 + 10 + (invite ? 11 : 0);
  const bx = Math.max(6, Math.min(LARGEUR - w - 6, x - w / 2));
  const by = y - h;

  ctx.globalAlpha = Math.min(1, hub.reponseT * 2);
  ctx.fillStyle = 'rgba(9,11,20,.92)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = 'rgba(111,208,232,.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + .5, by + .5, w - 1, h - 1);
  ctx.fillStyle = '#dfe6f2';
  ctx.textAlign = 'left';
  lignes.forEach((l, i) => ctx.fillText(l, bx + 8, by + 14 + i * 13));

  /* Le repere de fermeture. Il n'apparait qu'apres le court delai de lecture :
     avant, un appui rouvrirait la bulle au lieu de la fermer, et afficher
     l'invite tout de suite mentirait au joueur. Il clignote pour se distinguer
     du texte, qui lui ne bouge pas. */
  if (invite) {
    const cl = Math.sin(hub.t * 5) > -0.3 ? 1 : 0.3;
    ctx.save();
    ctx.globalAlpha *= cl;
    ctx.font = '8px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6fd0e8';
    ctx.fillText(estTactile ? 'Touche pour fermer  ▸' : 'E pour fermer  ▸', bx + w - 8, by + h - 5);
    ctx.restore();
    ctx.textAlign = 'left';
    // La bulle elle-meme se touche : au doigt, viser le petit robot est
    // inutilement precis.
    if (scene === 'hub') zone(bx, by, w, h, 'parler-braddy');
  }

  // petite pointe
  ctx.fillStyle = 'rgba(9,11,20,.92)';
  ctx.fillRect(x - 3, by + h, 6, 4);
  ctx.globalAlpha = 1;
}

function hudHub(c) {
  // Bandeau du haut : monnaie et rappel
  ctx.fillStyle = 'rgba(9,11,20,.55)';
  ctx.fillRect(0, 0, LARGEUR, 26);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'left';
  ctx.fillText(partie.pieces + ' BC', 12, 18);

  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillText('LA BASE', 92, 17);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.fillText(partie.termines.length + ' / ' + ORDRE_NIVEAUX.length + ' niveaux', LARGEUR - 12, 17);
  ctx.textAlign = 'left';

  // Mini-carte des postes en bas
  const my = HAUTEUR - 14;
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  ctx.fillRect(60, my, LARGEUR - 120, 2);
  POSTES.forEach(p => {
    const px = 60 + (p.x / HUB_L) * (LARGEUR - 120);
    ctx.fillStyle = hub.poste === p ? ACCENT : 'rgba(255,255,255,.35)';
    ctx.fillRect(px - 2, my - 3, 4, 8);
  });
  if (hub.brad) {
    const px = 60 + ((hub.brad.x + 11) / HUB_L) * (LARGEUR - 120);
    ctx.fillStyle = '#e6e8f0';
    ctx.fillRect(px - 1, my - 6, 2, 11);
  }
}

/* -----------------------------------------------------------------------------
   3. PANNEAUX — cadre commun
-------------------------------------------------------------------------- */

let confirmation = null;         // { texte, oui, non }

function cadrePanneau(titre, sousTitre) {
  ctx.fillStyle = 'rgba(9,11,20,.9)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ctx.fillStyle = 'rgba(24,28,42,.96)';
  ctx.fillRect(40, 26, LARGEUR - 80, HAUTEUR - 52);
  ctx.strokeStyle = 'rgba(232,182,44,.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(40.5, 26.5, LARGEUR - 81, HAUTEUR - 53);

  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'left';
  ctx.fillText(titre, 56, 48);
  if (sousTitre) {
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.fillText(sousTitre, 56, 62);
  }

  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = ACCENT;
  ctx.fillText(partie.pieces + ' BC', LARGEUR - 56, 48);
  ctx.textAlign = 'left';

  // Bouton fermer
  const survol = souris.survol && souris.survol.action === 'fermer-poste';
  ctx.fillStyle = survol ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)';
  ctx.fillRect(LARGEUR - 96, HAUTEUR - 48, 56, 22);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText('Sortir', LARGEUR - 68, HAUTEUR - 33);
  ctx.textAlign = 'left';
  zone(LARGEUR - 96, HAUTEUR - 48, 56, 22, 'fermer-poste');
}

/* La confirmation d'achat demandee dans les notes : le BRADDY3000 s'assure
   qu'on ne depense pas par accident. */
function dessinerConfirmation() {
  if (!confirmation) return;
  ctx.fillStyle = 'rgba(9,11,20,.82)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  const w = 400, h = 150, x = (LARGEUR - w) / 2, y = (HAUTEUR - h) / 2;
  ctx.fillStyle = '#1b2030'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(111,208,232,.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = '#6fd0e8';
  ctx.textAlign = 'left';
  ctx.fillText('BRADDY3000', x + 16, y + 22);

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#e6e8f0';
  let ligne = '', yy = y + 48;
  for (const mot of confirmation.texte.split(' ')) {
    const essai = ligne ? ligne + ' ' + mot : mot;
    if (ctx.measureText(essai).width > w - 32 && ligne) {
      ctx.fillText(ligne, x + 16, yy); yy += 17; ligne = mot;
    } else ligne = essai;
  }
  if (ligne) ctx.fillText(ligne, x + 16, yy);

  const bw = 168, bh = 30, by = y + h - 44;
  [['Affirmatif', 'confirmer-oui', x + 16],
   ['Tout compte fait, non', 'confirmer-non', x + w - 16 - bw]].forEach(([t, a, bx]) => {
    const survol = souris.survol && souris.survol.action === a;
    const positif = a === 'confirmer-oui';
    ctx.fillStyle = survol
      ? (positif ? 'rgba(232,182,44,.28)' : 'rgba(255,255,255,.16)')
      : 'rgba(255,255,255,.07)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = positif ? 'rgba(232,182,44,.6)' : 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + .5, by + .5, bw - 1, bh - 1);
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = positif ? '#ffe9a8' : 'rgba(255,255,255,.75)';
    ctx.fillText(t, bx + bw / 2, by + 20);
    ctx.textAlign = 'left';
    zone(bx, by, bw, bh, a);
  });
}

function demanderConfirmation(texte, oui) {
  confirmation = { texte, oui };
  audio.bruit('menu');
}

function repondreConfirmation(accepte) {
  const c = confirmation;
  confirmation = null;
  if (!c) return;
  if (accepte) c.oui();
  else { audio.bruit('menu'); braddyDit('Sage décision. Ou pas. Je ne juge pas.'); }
}

/* -----------------------------------------------------------------------------
   4. BOUTIQUE
-------------------------------------------------------------------------- */

let ongletBoutique = 0;          // 0 = basiques, 1 = permanents
let indexBoutique = 0;

function articlesBoutique() {
  return ongletBoutique === 0 ? AMELIORATIONS : PERMANENTS;
}

function dessinerBoutique() {
  cadrePanneau('BOUTIQUE', 'Le BRADDY3000 vous écoute. Enfin, vous regarde.');

  // Onglets
  ['Améliorations', 'Bonus permanents'].forEach((nom, i) => {
    const x = 56 + i * 150, y = 76, w = 140, h = 24;
    const actif = ongletBoutique === i;
    const survol = souris.survol && souris.survol.action === 'onglet-boutique' &&
                   souris.survol.valeur === i;
    ctx.fillStyle = actif ? 'rgba(232,182,44,.2)' : (survol ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)');
    ctx.fillRect(x, y, w, h);
    if (actif) { ctx.fillStyle = ACCENT; ctx.fillRect(x, y + h - 2, w, 2); }
    ctx.font = (actif ? 'bold ' : '') + '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = actif ? '#ffe9a8' : 'rgba(255,255,255,.6)';
    ctx.fillText(nom, x + w / 2, y + 16);
    ctx.textAlign = 'left';
    zone(x, y, w, h, 'onglet-boutique', i);
  });

  const liste = articlesBoutique();
  let y = 118;
  liste.forEach((a, i) => {
    const actif = i === indexBoutique;
    const survol = souris.survol && souris.survol.action === 'article' && souris.survol.valeur === i;
    if (survol && souris.bouge && i !== indexBoutique) indexBoutique = i;

    const basique = ongletBoutique === 0;
    const niveau = basique ? partie.ameliorations[a.cle] : (aPermanent(a.cle) ? 1 : 0);
    const maxi = basique ? niveau >= a.paliers : niveau > 0;
    const prix = basique ? coutAmelioration(a) : a.cout;
    const abordable = partie.pieces >= prix;

    ctx.fillStyle = actif ? 'rgba(232,182,44,.13)' : 'rgba(255,255,255,.03)';
    ctx.fillRect(56, y - 14, LARGEUR - 112, 40);
    if (actif) { ctx.fillStyle = ACCENT; ctx.fillRect(56, y - 14, 3, 40); }

    ctx.font = (actif ? 'bold ' : '') + '12px system-ui, sans-serif';
    ctx.fillStyle = maxi ? 'rgba(126,224,138,.9)' : '#e6e8f0';
    ctx.fillText(a.nom, 70, y);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText(a.detail, 70, y + 14);

    // Paliers ou etat
    ctx.textAlign = 'right';
    if (basique) {
      const px = LARGEUR - 150;
      for (let k = 0; k < a.paliers; k++) {
        ctx.fillStyle = k < niveau ? ACCENT : 'rgba(255,255,255,.14)';
        ctx.fillRect(px + k * 8 - a.paliers * 8, y - 8, 6, 8);
      }
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillText('actuel : ' + a.valeur(niveau) + a.unite + (maxi ? '' : '  ·  +5 BC au suivant'),
                   LARGEUR - 152, y + 14);
    }

    ctx.font = 'bold 12px system-ui, sans-serif';
    if (maxi) {
      ctx.fillStyle = 'rgba(126,224,138,.9)';
      ctx.fillText(basique ? 'MAX' : 'ACQUIS', LARGEUR - 70, y + 4);
    } else {
      ctx.fillStyle = abordable ? ACCENT : 'rgba(255,255,255,.28)';
      ctx.fillText(prix + ' BC', LARGEUR - 70, y + 4);
    }
    ctx.textAlign = 'left';

    zone(56, y - 14, LARGEUR - 112, 40, 'article', i);
    y += 46;
  });

  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillText('↑ ↓ choisir  ·  ← → onglet  ·  Entrée acheter  ·  Échap sortir', 56, HAUTEUR - 33);

  dessinerConfirmation();
}

function acheterArticleCourant() {
  const liste = articlesBoutique();
  const a = liste[indexBoutique];
  if (!a) return;
  const basique = ongletBoutique === 0;
  const maxi = basique ? partie.ameliorations[a.cle] >= a.paliers : aPermanent(a.cle);
  const prix = basique ? coutAmelioration(a) : a.cout;

  if (maxi) {
    audio.bruit('refus');
    braddyDit(basique
      ? 'Pas besoin d\'acheter ça, tu es déjà au max.'
      : 'Tu l\'as déjà. Je te le revends pas deux fois, je suis honnête.');
    return;
  }
  if (partie.pieces < prix) {
    audio.bruit('refus');
    braddyDit('Mhh. J\'ai jamais été bon en maths, mais je pense que les comptes n\'y sont pas.');
    return;
  }

  demanderConfirmation(
    'Es-tu sûr de vouloir passer la transaction ? « ' + a.nom + ' » pour ' + prix +
    ' Brad Coins. ' + a.phrase,
    () => {
      const ok = basique ? acheterAmelioration(a) : acheterPermanent(a);
      if (ok) {
        audio.bruit('valider');
        braddyDit('Transaction validée. Tu sens la différence ? Moi non plus, mais elle est là.');
      }
    });
}

/* -----------------------------------------------------------------------------
   5. VESTIAIRE
-------------------------------------------------------------------------- */

let indexVestiaire = 0;

function dessinerVestiaire() {
  cadrePanneau('VESTIAIRE', 'Purement cosmétique. Aucun bonus, jamais.');

  /* Cinq colonnes, pas quatre : a neuf uniformes, une grille de quatre
     debordait sur une troisieme rangee qui recouvrait la description et le
     bouton « Sortir ». Cinq colonnes tiennent tout en deux rangees et laissent
     de la place pour un dixieme. */
  const cols = 5, cw = 110, ch = 94;
  const x0 = (LARGEUR - cols * cw) / 2;
  const y0 = 80;

  UNIFORMES.forEach((u, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = x0 + c * cw, y = y0 + r * ch;
    const actif = i === indexVestiaire;
    const survol = souris.survol && souris.survol.action === 'uniforme' && souris.survol.valeur === i;
    if (survol && souris.bouge && i !== indexVestiaire) indexVestiaire = i;

    const ouvert = uniformeDebloque(u);
    const porte = partie.uniforme === u.cle;

    ctx.fillStyle = actif ? 'rgba(232,182,44,.14)' : 'rgba(255,255,255,.035)';
    ctx.fillRect(x + 4, y, cw - 8, ch - 10);
    if (porte) {
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.strokeRect(x + 5, y + 1, cw - 10, ch - 12);
    }

    // Apercu du sprite, ou cadenas
    const img = planchesBrad[u.cle];
    if (ouvert && img) {
      const { cw: sw, ch: sh } = BRAD_PLANCHE;
      ctx.drawImage(img, 0, 0, sw, sh, x + cw / 2 - sw / 2, y + 6, sw, sh);
    } else {
      dessinerCadenas(x + cw / 2, y + 30, 1.4, 'rgba(255,255,255,.22)');
    }

    ctx.font = (actif ? 'bold ' : '') + '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ouvert ? (porte ? ACCENT : '#e6e8f0') : 'rgba(255,255,255,.3)';
    ctx.fillText(u.nom, x + cw / 2, y + ch - 26);
    if (porte) {
      ctx.font = '8px system-ui, sans-serif';
      ctx.fillStyle = ACCENT;
      ctx.fillText('PORTÉ', x + cw / 2, y + ch - 15);
    }
    ctx.textAlign = 'left';
    zone(x + 4, y, cw - 8, ch - 10, 'uniforme', i);
  });

  // Detail de l'uniforme selectionne. Le cadenas est DESSINE, pas un emoji :
  // un emoji change de forme d'un appareil a l'autre et arrive parfois en
  // couleur au milieu d'une ligne de texte grise.
  const u = UNIFORMES[indexVestiaire];
  if (u) {
    const libre = uniformeDebloque(u);
    ctx.font = '10px system-ui, sans-serif';
    const l = ctx.measureText(u.detail).width;
    const depart = LARGEUR / 2 - l / 2 + (libre ? 0 : 8);
    if (!libre) dessinerCadenas(depart - 12, HAUTEUR - 52, 0.85, 'rgba(226,85,59,.9)');
    ctx.textAlign = 'left';
    ctx.fillStyle = libre ? 'rgba(255,255,255,.6)' : 'rgba(226,85,59,.9)';
    ctx.fillText(u.detail, depart, HAUTEUR - 48);
  }

  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillText('Flèches choisir  ·  Entrée porter  ·  Échap sortir', 56, HAUTEUR - 33);
}

function porterUniformeCourant() {
  const u = UNIFORMES[indexVestiaire];
  if (!u) return;
  if (!uniformeDebloque(u)) {
    audio.bruit('refus');
    braddyDit('Pas encore débloqué. ' + u.detail);
    return;
  }
  partie.uniforme = u.cle;
  appliquerUniforme(u.cle);
  enregistrerPartie();
  audio.bruit('valider');
}

/* Cadenas dessine en primitives, a l'echelle demandee. Sert partout ou une
   chose est verrouillee, pour que le symbole soit toujours le meme. */
function dessinerCadenas(cx, cy, echelle, couleur) {
  const e = echelle;
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.strokeStyle = couleur;
  ctx.lineWidth = Math.max(1, 2 * e);
  // Anse : le demi-cercle, PUIS les deux montants qui redescendent jusqu'au
  // corps. Sans eux l'anse flotte au-dessus du boitier et le dessin ne se lit
  // plus comme un cadenas.
  ctx.beginPath();
  ctx.arc(0, -4 * e, 4.5 * e, Math.PI, 0);
  ctx.moveTo(-4.5 * e, -4 * e); ctx.lineTo(-4.5 * e, -1 * e);
  ctx.moveTo(4.5 * e, -4 * e);  ctx.lineTo(4.5 * e, -1 * e);
  ctx.stroke();
  // corps
  ctx.fillStyle = couleur;
  ctx.fillRect(-7 * e, -1 * e, 14 * e, 11 * e);
  // trou de serrure
  ctx.fillStyle = 'rgba(24,28,42,1)';
  ctx.fillRect(-1.5 * e, 2 * e, 3 * e, 5 * e);
  ctx.restore();
}

/* -----------------------------------------------------------------------------
   6. CARTE DES NIVEAUX
-------------------------------------------------------------------------- */

let indexCarte = 0;

function dessinerCarte() {
  cadrePanneau('CARTE DES MISSIONS', 'Dix niveaux avant Kirby 67. On en a deux pour l\'instant.');

  const y0 = 92;
  ORDRE_NIVEAUX.forEach((id, i) => {
    const d = NIVEAUX[id];
    const y = y0 + i * 58;
    const actif = i === indexCarte;
    const survol = souris.survol && souris.survol.action === 'niveau' && souris.survol.valeur === i;
    if (survol && souris.bouge && i !== indexCarte) indexCarte = i;

    const ouvert = niveauDebloque(id);
    const fini = niveauTermine(id);

    ctx.fillStyle = actif ? 'rgba(232,182,44,.14)' : 'rgba(255,255,255,.035)';
    ctx.fillRect(64, y, LARGEUR - 128, 48);
    if (actif) { ctx.fillStyle = ACCENT; ctx.fillRect(64, y, 3, 48); }

    // Vignette de la zone principale
    const z = d.zones[0];
    ctx.fillStyle = ouvert ? z.cielBas : '#20242f';
    ctx.fillRect(78, y + 8, 52, 32);
    ctx.fillStyle = ouvert ? z.solHaut : '#2a2f3c';
    ctx.fillRect(78, y + 30, 52, 10);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    ctx.strokeRect(78.5, y + 8.5, 51, 31);

    ctx.font = (actif ? 'bold ' : '') + '13px system-ui, sans-serif';
    ctx.fillStyle = ouvert ? '#e6e8f0' : 'rgba(255,255,255,.3)';
    ctx.fillText(d.nom, 144, y + 22);

    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText(ouvert ? d.zones.map(z2 => z2.nom).join('  →  ') : 'Termine le niveau précédent pour l\'ouvrir',
                 144, y + 36);

    ctx.textAlign = 'right';
    ctx.font = 'bold 10px system-ui, sans-serif';
    if (fini) { ctx.fillStyle = '#7ee08a'; ctx.fillText('TERMINÉ', LARGEUR - 80, y + 28); }
    else if (ouvert) { ctx.fillStyle = ACCENT; ctx.fillText('DISPONIBLE', LARGEUR - 80, y + 28); }
    else { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillText('VERROUILLÉ', LARGEUR - 80, y + 28); }
    ctx.textAlign = 'left';

    zone(64, y, LARGEUR - 128, 48, 'niveau', i);
  });

  // Les niveaux a venir, pour montrer la route
  const yy = y0 + ORDRE_NIVEAUX.length * 58 + 6;
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillText('À venir : ville ghetto · vallée enchantée · discothèque Brésil ·', 68, yy + 12);
  ctx.fillText('maison hantée · ville USA hiver · complexe scientifique · espace ·', 68, yy + 25);
  ctx.fillText('manoir de Kirby 67 · le combat final', 68, yy + 38);

  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillText('↑ ↓ choisir  ·  Entrée partir en mission  ·  Échap sortir', 56, HAUTEUR - 33);
}

function lancerNiveauCourant() {
  const id = ORDRE_NIVEAUX[indexCarte];
  if (!niveauDebloque(id)) {
    audio.bruit('refus');
    return;
  }
  audio.bruit('valider');
  preparerNiveau(id);
}
