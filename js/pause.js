/* =============================================================================
   BRAD BITT, MAIS LE JEU — pause et ecran de chargement

   Deux ecrans qui n'existaient pas et qui manquaient pour les memes raisons :
   le jeu passait d'un etat a l'autre sans laisser au joueur ni le temps de
   souffler, ni la possibilite de revenir en arriere.

   1. LA PAUSE. Echap coupait le niveau et renvoyait a la base sans rien
      demander — donc sans avertir que les Brad Coins du niveau en cours
      etaient perdus. Elle ouvre maintenant un menu : reprendre, options,
      rentrer a la base (avec confirmation), retourner au menu principal.

   2. LE CHARGEMENT. « Continuer » basculait dans la base en une image. Sept
      secondes de logo et de conseils rendent la transition supportable, et
      donnent une place aux conseils qu'aucun ecran n'affichait.
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. LA PAUSE
-------------------------------------------------------------------------- */

const pause = { index: 0, sceneAvant: 'jeu' };

/* Ce qui est perdu en quittant un niveau en cours. On l'affiche : « tu perds
   ta progression » est vague, « tu perds 14 Brad Coins » est une decision. */
function perteEnQuittant() {
  return {
    pieces: brad ? brad.pieces : 0,
    ennemis: ennemisElimines ? ennemisElimines.size : 0,
  };
}

function entreesPause() {
  const e = [
    { cle: 'reprendre', nom: 'Reprendre' },
    { cle: 'relancer',  nom: 'Recommencer le niveau' },
    { cle: 'options',   nom: 'Options' },
  ];
  // On ne propose la base que si elle existe : pendant l'introduction, elle
  // n'a pas encore ete construite. Au camp d'entrainement, en revanche, on
  // rentre toujours — c'est une salle de la base, pas une mission.
  if (baseAccessible() || ENTRAINEMENT) e.push({ cle: 'base', nom: 'Retour à la base' });
  e.push({ cle: 'menu', nom: 'Menu principal' });
  return e;
}

function ouvrirPause() {
  if (scene !== 'jeu') return;
  pause.sceneAvant = scene;
  pause.index = 0;
  confirmation = null;
  scene = 'pause';
  relacherTout();
  audio.bruit('menu');
  // La musique baisse sans s'arreter : reprendre doit etre instantane.
  audio.cible = R.volMusique * 0.35;
}

function reprendreJeu() {
  scene = 'jeu';
  confirmation = null;
  relacherTout();
  audio.cible = R.volMusique;
  audio.bruit('menu');
}

/* Quitter un niveau en cours. Le camp d'entrainement ne rapporte rien de toute
   façon : inutile d'y avertir qui que ce soit. */
function quitterNiveau(versMenu) {
  const perte = perteEnQuittant();
  const partir = () => {
    audio.arreterMusique(0.5);
    confirmation = null;
    if (versMenu) retourAuMenu();
    else entrerHub(hub.premiereVisite);
  };

  if (ENTRAINEMENT || (perte.pieces === 0 && perte.ennemis === 0)) { partir(); return; }

  demanderConfirmation(
    'Quitter maintenant ne sauvegarde rien de ce niveau : les ' + perte.pieces +
    ' Brad Coin' + (perte.pieces > 1 ? 's' : '') + ' ramassé' + (perte.pieces > 1 ? 's' : '') +
    ' et les ' + perte.ennemis + ' ennemi' + (perte.ennemis > 1 ? 's' : '') +
    ' éliminé' + (perte.ennemis > 1 ? 's' : '') + ' seront perdus. Tu es sûr ?',
    partir);
}

function validerPause() {
  const e = entreesPause()[pause.index];
  if (!e) return;
  audio.bruit('valider');
  switch (e.cle) {
    case 'reprendre': reprendreJeu(); break;
    case 'relancer':  preparerNiveau(niveauCourant); break;
    case 'options':   scene = 'options'; indexOptions = 0; retourOptions = 'pause'; break;
    case 'base':      quitterNiveau(false); break;
    case 'menu':      quitterNiveau(true); break;
  }
}

function deplacerPause(pas) {
  const n = entreesPause().length;
  pause.index = (pause.index + pas + n) % n;
  audio.bruit('menu');
}

function dessinerPause() {
  // Le niveau reste visible derriere : on est en pause, pas ailleurs.
  rendreNiveau();
  ctx.fillStyle = 'rgba(9,11,20,.78)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  texteCentre('PAUSE', 62, 'bold 30px system-ui, sans-serif', ACCENT);
  const d = defNiveau(niveauCourant);
  texteCentre(d ? d.nom : '', 84, 'italic 11px system-ui, sans-serif', 'rgba(255,255,255,.45)');

  const liste = entreesPause();
  const l = 250, x = (LARGEUR - l) / 2;
  let y = 112;
  liste.forEach((e, i) => {
    const actif = i === pause.index;
    const survol = souris.survol && souris.survol.action === 'pause' && souris.survol.valeur === i;
    if (survol && souris.bouge && i !== pause.index) pause.index = i;

    ctx.fillStyle = actif ? 'rgba(232,182,44,.18)' : 'rgba(255,255,255,.04)';
    ctx.fillRect(x, y, l, 30);
    if (actif) { ctx.fillStyle = ACCENT; ctx.fillRect(x, y, 3, 30); }
    texteCentreEn(e.nom, x + l / 2, y + 20,
                  (actif ? 'bold ' : '') + '13px system-ui, sans-serif',
                  actif ? '#ffe9a8' : 'rgba(255,255,255,.75)');
    zone(x, y, l, 30, 'pause', i);
    y += 36;
  });

  // L'avertissement est ecrit AVANT le choix, pas seulement dans la
  // confirmation : le joueur doit savoir ce qu'il risque en visant le bouton.
  const perte = perteEnQuittant();
  if (!ENTRAINEMENT && (perte.pieces > 0 || perte.ennemis > 0)) {
    texteCentre('Quitter le niveau ne sauvegarde rien : ' + perte.pieces +
                ' BC ramassés seraient perdus.',
                y + 12, '10px system-ui, sans-serif', 'rgba(226,85,59,.85)');
  }
  texteCentre('Échap ou clic sur « Reprendre » pour repartir',
              HAUTEUR - 18, '10px system-ui, sans-serif', 'rgba(255,255,255,.3)');

  if (confirmation) dessinerConfirmation();
}

/* -----------------------------------------------------------------------------
   2. L'ECRAN DE CHARGEMENT

   Sept secondes, avec le logo et un conseil. C'est volontairement du temps
   « perdu » : passer du menu a la base en une image donne l'impression d'un
   saut, et le joueur arrive sans savoir ou il est.
-------------------------------------------------------------------------- */

const DUREE_CHARGEMENT = 7.0;

const CONSEILS_CHARGEMENT = [
  'Le Serra-Lourd sert de plateforme. Marche-lui dessus, il déteste ça.',
  'Le Lanceur est blindé : renvoie-lui sa boule d\'un coup bien placé.',
  'Maintiens le saut pour sauter plus haut. Relâche pour retomber vite.',
  'Une chute te remet au dernier sol stable, pas au début du niveau.',
  'Trois morts d\'affilée, et le niveau repart du début. Deux, non.',
  'La jauge de Brad-Shy se remplit en éliminant. L\'onde de choc est gratuite.',
  'Les uniformes ne donnent aucun bonus. C\'est exprès.',
  'Le camp d\'entraînement ne rapporte rien. C\'est aussi exprès.',
  'Parle au BRADDY3000 : il dit parfois quelque chose d\'utile.',
  'Un boss blindé ne se frappe pas. Vide la salle d\'abord.',
  'La barre de vie avant tout le reste : mourir coûte plus cher.',
  'Le jukebox de la base accepte des codes. Il paraît qu\'il en existe trois.',
  'Les pièces de l\'appareil à raclette sont aux niveaux 3, 6 et 9.',
  'En courant, Brad franchit des trous qu\'il ne passe pas au pas.',
];

const chargement = {
  t: 0,
  conseil: '',
  suite: null,
};

/* Lance l'ecran de chargement, puis `suite`. */
function lancerChargement(suite) {
  chargement.t = 0;
  chargement.conseil = CONSEILS_CHARGEMENT[
    Math.floor(Math.random() * CONSEILS_CHARGEMENT.length)];
  chargement.suite = suite;
  scene = 'chargement';
}

function majChargement(dt) {
  // Une fois la suite appelee, la scene a change : sans ce garde-fou, le
  // minuteur continuait de courir et renvoyait le joueur au menu principal
  // une image apres l'avoir depose dans la base.
  if (scene !== 'chargement') return;
  chargement.t += dt;
  if (chargement.t >= DUREE_CHARGEMENT) {
    const f = chargement.suite;
    chargement.suite = null;
    if (f) f();
    else scene = 'menu';
  }
}

function dessinerChargement() {
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Le logo du studio, redessine ici en petit : l'ecran doit avoir une
  // identite, pas juste une barre qui avance.
  const cx = LARGEUR / 2, cy = 118;
  const t = chargement.t;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 1.2) * 0.06);
  ctx.fillStyle = 'rgba(232,182,44,.12)';
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, t / DUREE_CHARGEMENT));
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BB', 0, 9);
  ctx.textAlign = 'left';
  ctx.restore();

  texteCentre('CHARGEMENT', 190, 'bold 15px system-ui, sans-serif', 'rgba(255,255,255,.75)');

  // Le conseil, enveloppe : certains sont longs.
  ctx.font = 'italic 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.textAlign = 'center';
  const mots = chargement.conseil.split(' ');
  const lignes = [];
  let ligne = '';
  for (const m of mots) {
    const essai = ligne ? ligne + ' ' + m : m;
    if (ctx.measureText(essai).width > 460 && ligne) { lignes.push(ligne); ligne = m; }
    else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  lignes.forEach((l, i) => ctx.fillText(l, LARGEUR / 2, 224 + i * 18));
  ctx.textAlign = 'left';

  // Barre de progression
  const l = 300, x = (LARGEUR - l) / 2, y = HAUTEUR - 58;
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(x, y, l, 5);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, y, Math.round(l * Math.min(1, chargement.t / DUREE_CHARGEMENT)), 5);

  // Trois points qui respirent — une barre seule a l'air figee quand elle
  // avance lentement.
  for (let i = 0; i < 3; i++) {
    const a = 0.25 + 0.55 * Math.max(0, Math.sin(t * 3 - i * 0.6));
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
    ctx.fillRect(LARGEUR / 2 - 10 + i * 8, HAUTEUR - 36, 4, 4);
  }
}
