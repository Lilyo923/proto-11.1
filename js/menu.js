/* =============================================================================
   BRAD BITT, MAIS LE JEU — accueil, chargement, menu

   Trois choses vivent ici :

   1. La sequence de demarrage. Les navigateurs refusent toute lecture audio
      tant que l'utilisateur n'a pas interagi avec la page : le bouton
      « Jouer » n'est donc pas decoratif, c'est lui qui autorise le son pour
      tout le reste de la session.
   2. Le menu principal, sa scene de fond jouee automatiquement, les options
      et les credits.
   3. Les zones cliquables. Le menu est dessine dans le canvas (et non en
      HTML) pour rester dans le meme rendu pixel que le jeu ; on reconstruit
      donc a chaque image la liste des rectangles cliquables.
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. SEQUENCE DE DEMARRAGE
-------------------------------------------------------------------------- */

const DUREE_LOGO = 2.3;            // duree d'affichage de chaque logo
const MARGE_CHARGEMENT = 3.0;      // surplus de securite demande, en secondes

const demarrage = {
  t: 0,                            // temps ecoule depuis le clic sur « Jouer »
  progres: 0,                      // 0 -> 1
  finChargement: -1,               // instant ou tout etait en memoire
  lance: false,
};

function lancerDemarrage() {
  if (demarrage.lance) return;
  // En portrait sur mobile, l'ecran de rotation recouvre tout : demarrer
  // maintenant lancerait la partie derriere un voile.
  if (typeof enPortrait === 'function' && enPortrait()) return;
  demarrage.lance = true;
  audio.debloquer();               // le geste utilisateur autorise enfin le son
  audio.bruit('valider');
  scene = 'logos';

  precharger(p => { demarrage.progres = p; })
    .then(() => {
      demarrage.progres = 1;
      demarrage.finChargement = demarrage.t;
    })
    .catch(() => {
      demarrage.progres = 1;
      demarrage.finChargement = demarrage.t;
    });
}

/* Le menu s'ouvre au plus tard des deux : la fin de l'animation des logos, ou
   la fin du chargement plus la marge de securite. Un chargement rapide ne
   raccourcit donc pas l'animation, et un chargement lent ne coupe rien. */
function momentDuMenu() {
  const finLogos = DUREE_LOGO * 2 + 0.5;
  if (demarrage.finChargement < 0) return Infinity;
  return Math.max(finLogos, demarrage.finChargement + MARGE_CHARGEMENT);
}

function majDemarrage(dt) {
  demarrage.t += dt;
  if (demarrage.t >= momentDuMenu()) {
    scene = 'menu';
    reinitialiserDemo();
  }
}

/* -----------------------------------------------------------------------------
   2. SCENE DE FOND DU MENU
   Brad y joue tout seul : il saute sur les Serra qui entrent par les cotes,
   grimpe sur les plateformes, et se met a ne rien faire quand le calme revient.
   Simulation entierement independante du niveau : aucun risque de perturber
   la partie en cours.
-------------------------------------------------------------------------- */

const SOL_DEMO = 300;
const PLATEFORMES_DEMO = [
  { x: 96,  y: 236, w: 92 },
  { x: 268, y: 188, w: 80 },
  { x: 438, y: 232, w: 96 },
];

const demo = {
  brad: null,
  ennemis: [],
  prochain: 1.2,
  t: 0,
};

function reinitialiserDemo() {
  demo.brad = {
    x: 300, y: SOL_DEMO - 46, w: 22, h: 46,
    vx: 0, vy: 0, sens: 1, auSol: true,
    phaseMarche: 0, phaseRepos: 0, inactif: 0, etirement: 1,
    but: 0, repos: 0, cible: null,
  };
  demo.ennemis.length = 0;
  demo.prochain = 1.0;
  demo.t = 0;
}

/* Toutes les surfaces sur lesquelles Brad peut se tenir, le sol compris. */
const SURFACES_DEMO = [{ x: 0, w: LARGEUR, y: SOL_DEMO }].concat(PLATEFORMES_DEMO);

/* Hauteur qu'un saut permet de gagner, avec une marge de securite. */
const PORTEE_SAUT_DEMO = (R.forceSaut * R.forceSaut) / (2 * R.gravite) - 8;

function solDemoSous(x, y) {
  if (y >= SOL_DEMO - 1) return SOL_DEMO;
  for (const p of PLATEFORMES_DEMO) {
    if (x > p.x && x < p.x + p.w && Math.abs(y - p.y) < 8) return p.y;
  }
  return null;
}

function surfaceDe(b) {
  let meilleure = SOL_DEMO;
  for (const s of SURFACES_DEMO) {
    if (Math.abs((b.y + b.h) - s.y) < 3 && b.x + b.w > s.x && b.x < s.x + s.w) meilleure = s.y;
  }
  return meilleure;
}

/* Depuis quelle surface Brad peut-il atteindre cette cible en sautant ?
   On prend la plus HAUTE qui reste accessible, pour que les volants places
   au-dessus des plateformes soient reellement atteignables. */
function appuiPour(cible) {
  const hautCible = cible.y;
  let choix = SURFACES_DEMO[0];
  for (const s of SURFACES_DEMO) {
    const cx = cible.x + cible.w / 2;
    // La surface doit passer sous la cible, et le saut doit y arriver.
    if (cx < s.x - 40 || cx > s.x + s.w + 40) continue;
    if (s.y - PORTEE_SAUT_DEMO > hautCible) continue;       // trop bas
    if (s.y < hautCible) continue;                          // deja au-dessus
    if (s.y < choix.y) choix = s;
  }
  return choix;
}

/* Surface intermediaire pour grimper : la plus haute accessible d'un saut
   depuis celle ou Brad se trouve. */
function marcheVers(depuisY, versY) {
  let choix = null;
  for (const s of SURFACES_DEMO) {
    if (s.y >= depuisY) continue;                        // pas plus haut
    if (depuisY - s.y > PORTEE_SAUT_DEMO) continue;      // hors de portee
    if (s.y < versY) continue;                           // depasse la cible
    if (!choix || s.y < choix.y) choix = s;
  }
  return choix;
}

function majDemo(dt) {
  demo.t += dt;
  const b = demo.brad;
  if (!b) return;

  // --- Apparition des ennemis, alternativement par la gauche et la droite
  demo.prochain -= dt;
  if (demo.prochain <= 0 && demo.ennemis.length < 4) {
    demo.prochain = 1.8 + Math.random() * 1.8;
    const parLaGauche = Math.random() < 0.5;
    const vole = Math.random() < 0.22;
    const type = vole ? 'Serra-Volant' : (Math.random() < 0.3 ? 'Serra-Boost' : 'Serra');
    const t = TYPES_ENNEMI[type];
    demo.ennemis.push({
      type, t,
      x: parLaGauche ? -40 : LARGEUR + 40,
      y: vole ? 196 : SOL_DEMO - t.h,
      w: t.w, h: t.h,
      sens: parLaGauche ? 1 : -1,
      vitesse: (vole ? 34 : 44) * (type === 'Serra-Boost' ? 1.6 : 1),
      phase: Math.random() * 6,
      vole, mourant: false, mort: 0, ecrase: 1,
    });
  }

  for (const e of demo.ennemis) {
    e.phase += dt * 3;
    if (e.mourant) { e.mort -= dt; e.ecrase = Math.max(0.1, e.ecrase - dt * 3.5); continue; }
    e.x += e.sens * e.vitesse * dt;
    if (e.vole) e.y = 196 + Math.sin(e.phase * 0.8) * 12;
  }
  demo.ennemis = demo.ennemis.filter(e =>
    (!e.mourant || e.mort > 0) && e.x > -90 && e.x < LARGEUR + 90);

  // --- Choix de la cible : l'ennemi le plus proche, volant compris.
  //     Les volants etaient purement ignores : Brad les laissait traverser
  //     l'ecran sans reagir.
  let meilleur = null, meilleureD = 1e9;
  for (const e of demo.ennemis) {
    if (e.mourant) continue;
    if (e.x < -10 || e.x > LARGEUR - 10) continue;      // pas encore entre en scene
    const d = Math.abs((e.x + e.w / 2) - (b.x + b.w / 2));
    if (d < meilleureD) { meilleureD = d; meilleur = e; }
  }
  b.cible = meilleur;

  // --- Decision
  let dir = 0;
  if (b.repos > 0) {
    b.repos -= dt;
  } else if (meilleur) {
    const cx = meilleur.x + meilleur.w / 2;
    const dx = cx - (b.x + b.w / 2);
    const surface = surfaceDe(b);
    const appui = appuiPour(meilleur);

    if (b.auSol && surface > appui.y + 3) {
      // Brad est trop bas pour toucher cette cible : il grimpe d'abord.
      const marche = marcheVers(surface, appui.y);
      if (marche) {
        const mcx = marche.x + marche.w / 2;
        const ecart = mcx - (b.x + b.w / 2);
        dir = Math.abs(ecart) > 14 ? Math.sign(ecart) : Math.sign(dx) || 1;
        // Sauter en arrivant sur la plateforme, jamais au milieu du vide.
        if (Math.abs(ecart) < marche.w / 2 + 34) b.vy = -R.forceSaut;
      } else {
        dir = Math.sign(dx);
      }
    } else {
      dir = Math.sign(dx);
      // Sauter quand l'ennemi est assez proche pour etre atteint en retombant.
      const portee = meilleur.vole ? 40 : 62;
      if (b.auSol && Math.abs(dx) < portee && Math.abs(dx) > 6) {
        b.vy = -R.forceSaut * (meilleur.vole ? 1 : 0.86);
      }
    }
  } else {
    // Personne a l'horizon : Brad flane, monte parfois sur une plateforme,
    // et s'arrete de temps en temps (le joueur voit alors ses animations
    // d'inactivite, ce qui donne au menu un peu de vie).
    if (b.but === 0 || Math.abs(b.x - b.but) < 12) {
      if (Math.random() < 0.35) { b.repos = 1.6 + Math.random() * 3.2; b.but = 0; }
      else b.but = 70 + Math.random() * (LARGEUR - 160);
    }
    if (b.but) {
      dir = Math.sign(b.but - b.x);
      if (b.auSol && Math.random() < 0.012) b.vy = -R.forceSaut * (0.7 + Math.random() * 0.3);
    }
  }

  // --- Physique
  const cible = dir * R.vitesseMarche * 0.9;
  const accel = R.acceleration * (b.auSol ? 1 : R.controleAir);
  if (b.vx < cible) b.vx = Math.min(cible, b.vx + accel * dt);
  else if (b.vx > cible) b.vx = Math.max(cible, b.vx - (dir ? accel : R.freinage) * dt);
  if (dir) b.sens = dir;

  b.vy = Math.min(R.chuteMax, b.vy + R.gravite * (b.vy > 0 ? R.graviteChute : 1) * dt);
  b.x += b.vx * dt;
  const basAvant = b.y + b.h;
  b.y += b.vy * dt;

  b.auSol = false;
  if (b.vy > 0) {
    const sol = solDemoSous(b.x + b.w / 2, b.y + b.h);
    if (sol !== null && basAvant <= sol + 6) { b.y = sol - b.h; b.vy = 0; b.auSol = true; }
  }
  if (b.x < 30) { b.x = 30; b.but = 0; }
  if (b.x > LARGEUR - 52) { b.x = LARGEUR - 52; b.but = 0; }

  // --- Ecrasement. Les volants comptent aussi : c'est tout l'interet d'aller
  //     les chercher en hauteur.
  if (b.vy > 0) {
    for (const e of demo.ennemis) {
      if (e.mourant) continue;
      if (b.x + b.w < e.x || b.x > e.x + e.w) continue;
      if (basAvant <= e.y + 8 && b.y + b.h >= e.y) {
        e.mourant = true; e.mort = 0.34;
        audio.bruit('ecrase');
        b.vy = -R.forceSaut * 0.62;
        b.y = e.y - b.h;
      }
    }
  }

  b.etirement += (1 - b.etirement) * Math.min(1, 12 * dt);
  b.phaseMarche += Math.abs(b.vx) * dt / LONGUEUR_PAS;
  b.phaseRepos += dt;
  b.inactif = (dir === 0 && b.auSol && Math.abs(b.vx) < 4) ? b.inactif + dt : 0;
}

function dessinerDemo() {
  const g = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  g.addColorStop(0, '#141a30');
  g.addColorStop(1, '#2d2a48');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Collines de fond, animees lentement pour que l'image ne soit jamais figee.
  const d = -demo.t * 8;
  for (const [f, base, haut, coul] of [[0.5, 262, 74, '#1b2138'], [1, 292, 56, '#232a44']]) {
    ctx.fillStyle = coul;
    ctx.beginPath();
    ctx.moveTo(0, HAUTEUR);
    for (let i = -1; i < 8; i++) {
      const x = (d * f) % 120 + i * 120;
      ctx.lineTo(x, base); ctx.lineTo(x + 60, base - haut); ctx.lineTo(x + 120, base);
    }
    ctx.lineTo(LARGEUR, HAUTEUR); ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = '#2f3350'; ctx.fillRect(0, SOL_DEMO, LARGEUR, HAUTEUR - SOL_DEMO);
  ctx.fillStyle = '#4a5178'; ctx.fillRect(0, SOL_DEMO, LARGEUR, 6);
  ctx.fillStyle = '#6b74a8'; ctx.fillRect(0, SOL_DEMO, LARGEUR, 2);

  for (const p of PLATEFORMES_DEMO) {
    ctx.fillStyle = '#2f3350'; ctx.fillRect(p.x, p.y, p.w, 10);
    ctx.fillStyle = '#4a5178'; ctx.fillRect(p.x, p.y, p.w, 4);
    ctx.fillStyle = '#6b74a8'; ctx.fillRect(p.x, p.y, p.w, 1);
  }

  for (const e of demo.ennemis) {
    const img = sprites[e.type];
    const cx = Math.round(e.x + e.w / 2);
    const bas = Math.round(e.y + e.h);
    if (!e.vole && !e.mourant) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx, bas, e.w * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (!img) continue;
    let sx = 1, sy = 1;
    if (e.mourant) { sy = e.ecrase; sx = 1 + (1 - e.ecrase) * 0.7; }
    else { const m = Math.sin(e.phase * 2.2); sy = 1 + m * 0.05; sx = 1 / sy; }
    ctx.save();
    ctx.translate(cx, bas);
    ctx.scale(e.sens * e.t.sensNatif * sx, sy);
    ctx.globalAlpha = e.mourant ? Math.max(0, e.mort / 0.34) : 1;
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  const b = demo.brad;
  if (b) {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(Math.round(b.x + b.w / 2), Math.round(b.y + b.h), b.w * 0.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    dessinerPlancheBrad(Math.round(b.x + b.w / 2), Math.round(b.y + b.h),
                        b.sens, b.etirement, poseBrad(b));
  }

  // Assombrissement : la scene doit rester lisible SOUS le texte du menu.
  ctx.fillStyle = 'rgba(9,11,20,.55)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
}

/* -----------------------------------------------------------------------------
   3. ZONES CLIQUABLES
   Reconstruites a chaque image pendant le rendu du menu.
-------------------------------------------------------------------------- */

const zones = [];
const souris = {
  x: -1, y: -1, survol: null, dansCanvas: false,
  bouge: false,          // la souris a-t-elle bouge depuis la derniere image ?
  glissement: null,      // jauge en cours de reglage au glisser-deposer
};

function zone(x, y, w, h, action, valeur) {
  zones.push({ x, y, w, h, action, valeur });
}

function zoneSousSouris() {
  if (!souris.dansCanvas) return null;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (souris.x >= z.x && souris.x <= z.x + z.w &&
        souris.y >= z.y && souris.y <= z.y + z.h) return z;
  }
  return null;
}

/* -----------------------------------------------------------------------------
   4. ETAT DU MENU
-------------------------------------------------------------------------- */

const MENU_PRINCIPAL = [
  { cle: 'nouvelle',  nom: 'Nouvelle partie' },
  { cle: 'continuer', nom: 'Continuer' },
  { cle: 'options',   nom: 'Options' },
  { cle: 'credits',   nom: 'Crédits' },
];

const MENU_OPTIONS = [
  { cle: 'musique',    nom: 'Volume de la musique', genre: 'jauge' },
  { cle: 'effets',     nom: 'Volume des effets',    genre: 'jauge' },
  { cle: 'difficulte', nom: 'Difficulté',           genre: 'choix' },
  { cle: 'retablir',   nom: 'Rétablir les réglages par défaut' },
  { cle: 'effacer',    nom: 'Effacer la sauvegarde' },
  { cle: 'avances',    nom: 'Réglages de développement…' },
  { cle: 'retour',     nom: 'Retour' },
];

/* D'ou l'ecran d'options a ete ouvert. Sans ça, sortir des options pendant
   une pause renvoyait au menu principal et abandonnait le niveau en cours. */
let retourOptions = 'menu';
let indexMenu = 0;
let indexOptions = 0;
let messageMenu = '';
let messageMenuT = 0;

function listeCourante() {
  return scene === 'options' ? MENU_OPTIONS : MENU_PRINCIPAL;
}
function indexCourant() {
  return scene === 'options' ? indexOptions : indexMenu;
}
function fixerIndex(i) {
  const n = listeCourante().length;
  const v = ((i % n) + n) % n;
  if (scene === 'options') indexOptions = v; else indexMenu = v;
}

function entreeDesactivee(e) {
  return e.cle === 'continuer' && !partie.existe;
}

function menuDeplacer(pas) {
  const liste = listeCourante();
  let i = indexCourant();
  for (let garde = 0; garde < liste.length; garde++) {
    i += pas;
    const e = liste[((i % liste.length) + liste.length) % liste.length];
    if (!entreeDesactivee(e)) break;
  }
  fixerIndex(i);
  audio.bruit('menu');
}

/* Reglage direct d'un volume, en valeur absolue (0 a 1). Sert au clic et au
   glisser sur la jauge : cliquer a gauche BAISSE le son, ce qui n'etait pas le
   cas quand tout clic incrementait la valeur. */
function fixerVolume(cle, valeur) {
  const v = Math.max(0, Math.min(1, Math.round(valeur * 20) / 20));
  if (cle === 'musique') { R.volMusique = v; audio.cible = v; }
  else R.volEffets = v;
  sauvegarderReglages();
}

function changerDifficulte(pas) {
  const i = DIFFICULTES.findIndex(d => d.cle === partie.difficulte);
  const n = DIFFICULTES.length;
  partie.difficulte = DIFFICULTES[(((i + pas) % n) + n) % n].cle;
  if (partie.existe) enregistrerPartie();
  audio.bruit('menu');
}

function menuAjuster(pas) {
  if (scene !== 'options') return;
  const e = MENU_OPTIONS[indexOptions];
  if (e.cle === 'musique') { fixerVolume('musique', R.volMusique + pas * 0.05); audio.bruit('menu'); }
  else if (e.cle === 'effets') { fixerVolume('effets', R.volEffets + pas * 0.05); audio.bruit('menu'); }
  else if (e.cle === 'difficulte') changerDifficulte(pas);
}

function noter(texte) { messageMenu = texte; messageMenuT = 2.6; }

function menuValider() {
  if (scene === 'credits') { scene = 'menu'; audio.bruit('menu'); return; }

  if (scene === 'options') {
    const e = MENU_OPTIONS[indexOptions];
    if (e.cle === 'retour') { menuRetour(); }
    else if (e.cle === 'effacer') {
      if (partie.existe) { effacerPartie(); noter('Sauvegarde effacée.'); audio.bruit('valider'); }
      else { noter('Il n\'y a rien à effacer.'); audio.bruit('refus'); }
    } else if (e.cle === 'retablir') {
      Object.assign(R, DEFAUTS);
      partie.difficulte = 'connaisseur';
      audio.cible = R.volMusique;
      sauvegarderReglages();
      rafraichirPanneau();
      if (partie.existe) enregistrerPartie();
      noter('Réglages rétablis.');
      audio.bruit('valider');
    } else if (e.cle === 'avances') { basculerPanneau(); audio.bruit('valider'); }
    else menuAjuster(1);
    return;
  }

  const e = MENU_PRINCIPAL[indexMenu];
  if (entreeDesactivee(e)) { audio.bruit('refus'); return; }
  audio.bruit('valider');

  if (e.cle === 'nouvelle') {
    // Ecraser une partie en cours par megarde serait cruel : on demande.
    if (partie.existe) {
      demanderConfirmation(
        'Une partie existe déjà : ' + partie.pieces + ' Brad Coins, ' +
        partie.termines.length + ' niveau' + (partie.termines.length > 1 ? 'x' : '') +
        ' terminé' + (partie.termines.length > 1 ? 's' : '') +
        '. Tout recommencer effacera cette progression. Tu es sûr ?',
        () => ouvrirChoixDifficulte());
    } else {
      ouvrirChoixDifficulte();
    }
  } else if (e.cle === 'continuer') {
    // On reprend a la base : c'est de la que tout repart une fois l'intro
    // passee. Si l'intro n'a jamais ete finie, on la relance.
    // Sept secondes de chargement : basculer du menu a la base en une image
    // donne l'impression d'un saut, et le joueur arrive sans se situer.
    if (partie.termines.length === 0) lancerChargement(() => preparerNiveau('intro'));
    else lancerChargement(() => entrerHub(hub.premiereVisite));
  } else if (e.cle === 'options') { scene = 'options'; indexOptions = 0; retourOptions = 'menu'; }
  else if (e.cle === 'credits') scene = 'credits';
}

function menuRetour() {
  if (scene === 'options' && retourOptions === 'pause') {
    scene = 'pause'; retourOptions = 'menu'; audio.bruit('menu'); return;
  }
  if (scene === 'options' || scene === 'credits') { scene = 'menu'; audio.bruit('menu'); }
}

/* Ecran « Commencer » avant chaque niveau. Il sert deux buts : garantir une
   interaction juste avant le lancement de la musique, et laisser le joueur
   souffler entre le menu et l'action. */
function preparerNiveau(id) {
  relancerNiveau(id);
  scene = 'pret';
}

function commencerNiveau() {
  audio.debloquer();
  scene = 'jeu';
  chrono = 0;
  if (AUDIO_NIVEAU) audio.jouerMusique(AUDIO_NIVEAU, 1.2);
  audio.bruit('valider');
}

/* Retour a la base apres un niveau : le BRADDY3000 commente le retour. */
function rentrerALaBase() {
  const premiere = hub.premiereVisite;
  audio.arreterMusique(0.5);
  entrerHub(premiere);
  if (premiere) return;
  // Rapporter une piece de l'appareil prime sur le commentaire de mission :
  // c'est la seule chose qui fasse avancer l'histoire.
  braddyDit(prendreRepliqueObjet() || repliqueRetourNiveau());
}

function retourAuMenu() {
  audio.arreterMusique(0.6);
  scene = 'menu';
  indexMenu = 0;
  reinitialiserDemo();
}

/* -----------------------------------------------------------------------------
   5. RENDU DES ECRANS
-------------------------------------------------------------------------- */

/* Texte centre sur une ABSCISSE DONNEE. texteCentre() centre toujours sur le
   milieu du canvas : s'en servir pour etiqueter un bouton place ailleurs dessine
   le mot au milieu de l'ecran, loin de sa zone cliquable. C'est exactement ce
   qui rendait le « Sortir » de l'arcade inutilisable — le mot etait au centre,
   le rectangle cliquable dans le coin. */
function texteCentreEn(texte, x, y, police, couleur) {
  ctx.save();
  ctx.font = police;
  ctx.textAlign = 'center';
  ctx.fillStyle = couleur;
  ctx.fillText(texte, x, y);
  ctx.restore();
  ctx.textAlign = 'left';
}

function texteCentre(texte, y, police, couleur, alpha) {
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.font = police;
  ctx.textAlign = 'center';
  ctx.fillStyle = couleur;
  ctx.fillText(texte, LARGEUR / 2, y);
  ctx.restore();
  ctx.textAlign = 'left';
}

function dessinerAccueil() {
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  texteCentre('BRAD BITT', 128, 'bold 40px system-ui, sans-serif', '#f2f3f8');
  texteCentre('mais le jeu', 156, 'italic 17px system-ui, sans-serif', '#e8b62c');

  const l = 176, h = 44, x = (LARGEUR - l) / 2, y = 214;
  const survol = souris.survol && souris.survol.action === 'demarrer';
  ctx.fillStyle = survol ? 'rgba(232,182,44,.18)' : 'rgba(255,255,255,.05)';
  ctx.fillRect(x, y, l, h);
  ctx.strokeStyle = survol ? '#e8b62c' : 'rgba(232,182,44,.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, l - 2, h - 2);
  texteCentre('JOUER', y + 29, 'bold 19px system-ui, sans-serif', survol ? '#ffe9a8' : '#e8b62c');
  zone(x, y, l, h, 'demarrer');

  texteCentre('Clique pour activer le son et charger le jeu',
              y + 68, '11px system-ui, sans-serif', 'rgba(255,255,255,.42)');
}

function dessinerEcranLogos() {
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  const t = demarrage.t;
  // Chaque logo apparait, tient, puis s'efface.
  const paliers = [
    { img: logos.imagine, debut: 0.15,           largeur: 300 },
    { img: logos.hwr,     debut: DUREE_LOGO + 0.15, largeur: 128 },
  ];

  for (const p of paliers) {
    const local = t - p.debut;
    if (local < 0 || local > DUREE_LOGO) continue;
    // Fondu d'entree de 0,45 s, fondu de sortie de 0,45 s.
    const a = Math.min(1, local / 0.45, (DUREE_LOGO - local) / 0.45);
    if (!p.img) {
      texteCentre('IMAGINe Studio', HAUTEUR / 2, 'bold 20px system-ui, sans-serif',
                  '#f2f3f8', Math.max(0, a));
      continue;
    }
    const w = p.largeur;
    const h = p.img.height * w / p.img.width;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    // Legere respiration : le logo grandit de 2 % pendant son apparition.
    const echelle = 1 + 0.02 * Math.min(1, local / DUREE_LOGO);
    ctx.translate(LARGEUR / 2, HAUTEUR / 2 - 14);
    ctx.scale(echelle, echelle);
    ctx.drawImage(p.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Barre de chargement
  const l = 260, x = (LARGEUR - l) / 2, y = HAUTEUR - 62;
  ctx.fillStyle = 'rgba(255,255,255,.09)';
  ctx.fillRect(x, y, l, 4);
  ctx.fillStyle = '#e8b62c';
  ctx.fillRect(x, y, l * demarrage.progres, 4);

  const pret = demarrage.finChargement >= 0;
  const restant = pret ? Math.max(0, momentDuMenu() - demarrage.t) : 0;
  const texte = !pret
    ? 'Chargement… ' + Math.round(demarrage.progres * 100) + ' %'
    : (restant > 0.1 ? 'Prêt — ouverture du menu…' : 'Prêt');
  texteCentre(texte, y + 22, '10px system-ui, sans-serif', 'rgba(255,255,255,.45)');
}

function cadre(x, y, w, h) {
  ctx.fillStyle = 'rgba(9,11,20,.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(232,182,44,.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
}

function dessinerMenu() {
  dessinerDemo();

  texteCentre('BRAD BITT', 66, 'bold 34px system-ui, sans-serif', '#f2f3f8');
  texteCentre('mais le jeu', 90, 'italic 14px system-ui, sans-serif', '#e8b62c');

  const l = 214, x = (LARGEUR - l) / 2;
  let y = 122;
  MENU_PRINCIPAL.forEach((e, i) => {
    const off = entreeDesactivee(e);
    const survol = souris.survol && souris.survol.action === 'menu' && souris.survol.valeur === i;
    if (survol && souris.bouge && !off && i !== indexMenu) indexMenu = i;
    const actif = i === indexMenu && !off;

    ctx.fillStyle = actif ? 'rgba(232,182,44,.16)' : 'rgba(9,11,20,.5)';
    ctx.fillRect(x, y, l, 34);
    if (actif) {
      ctx.fillStyle = '#e8b62c';
      ctx.fillRect(x, y, 3, 34);
    }
    ctx.font = (actif ? 'bold ' : '') + '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = off ? 'rgba(255,255,255,.24)' : (actif ? '#ffe9a8' : 'rgba(255,255,255,.78)');
    ctx.fillText(e.nom, LARGEUR / 2, y + 22);
    ctx.textAlign = 'left';

    if (!off) zone(x, y, l, 34, 'menu', i);
    y += 40;
  });

  if (partie.existe) {
    texteCentre('Sauvegarde : ' + partie.pieces + ' BC · ' + dureeLisible(partie.tempsJoue) +
                ' · ' + reglageDifficulte().nom,
                HAUTEUR - 26, '10px system-ui, sans-serif', 'rgba(255,255,255,.4)');
  } else {
    texteCentre('Aucune sauvegarde — « Continuer » s\'activera après ton premier niveau.',
                HAUTEUR - 26, '10px system-ui, sans-serif', 'rgba(255,255,255,.32)');
  }
  texteCentre('↑ ↓ pour choisir · Entrée pour valider',
              HAUTEUR - 10, '10px system-ui, sans-serif', 'rgba(255,255,255,.3)');

  avertissementAudio();
  dessinerConfirmation();
}

/* Un son qui manque doit se VOIR. Le jeu a tourné en silence complet sans que
   rien ne l'indique : les pistes ne se chargeaient pas et chaque demande de
   musique ne faisait simplement rien. Ce bandeau nomme le premier fichier
   fautif, ce qui transforme « il n'y a pas de musique » en une piste a
   suivre. */
function avertissementAudio() {
  if (!audio.echecs || audio.echecs.size === 0) return;
  const n = audio.echecs.size;
  const premier = Array.from(audio.echecs)[0].split('/').pop();
  texteCentre(n + ' piste' + (n > 1 ? 's' : '') + ' audio introuvable' +
              (n > 1 ? 's' : '') + ' (ex. ' + premier + ') — vérifie assets/audio',
              HAUTEUR - 42, '10px system-ui, sans-serif', 'rgba(226,85,59,.9)');
}

/* -----------------------------------------------------------------------------
   CHOIX DE LA DIFFICULTE
   Pose avant la cinematique, avec ce que chaque reglage change vraiment. Le
   joueur decide en connaissance de cause plutot que sur un nom.
-------------------------------------------------------------------------- */

let indexDifficulte = 1;

function ouvrirChoixDifficulte() {
  indexDifficulte = DIFFICULTES.findIndex(d => d.cle === partie.difficulte);
  if (indexDifficulte < 0) indexDifficulte = 1;
  scene = 'difficulte';
  audio.bruit('menu');
}

function validerDifficulte() {
  effacerPartie();
  partie.difficulte = DIFFICULTES[indexDifficulte].cle;
  enregistrerPartie();
  appliquerUniforme('classique');
  audio.arreterMusique(0.5);
  // Pas besoin de reposer le drapeau de decouverte de la base : effacerPartie()
  // vient de remettre partie.hubVu a false, et hub.premiereVisite le lit.
  audio.bruit('valider');
  // L'histoire commence par la scene de dialogue, puis le niveau d'intro.
  lancerDialogue(DIALOGUE_INTRO, () => preparerNiveau('intro'));
}

/* Ce que chaque difficulte change, en clair. */
const DETAIL_DIFFICULTE = {
  'touriste': [
    'Dégâts subis divisés par deux',
    'Ennemis à leur résistance normale',
    'Récompenses inchangées',
    'Pour profiter de l\'histoire sans s\'arracher les cheveux',
  ],
  'connaisseur': [
    'Dégâts subis normaux',
    'Ennemis à leur résistance normale',
    'Récompenses inchangées',
    'L\'équilibre pour lequel le jeu est réglé',
  ],
  'salé': [
    'Dégâts subis augmentés de moitié',
    'Ennemis coriaces : +50 % de résistance',
    'Récompenses augmentées de 20 %',
    'Le BRADDY3000 ne vous le recommande pas',
  ],
};

function dessinerChoixDifficulte() {
  dessinerDemo();
  ctx.fillStyle = 'rgba(9,11,20,.6)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  texteCentre('CHOISIS TA DIFFICULTÉ', 46, 'bold 19px system-ui, sans-serif', '#e8b62c');
  texteCentre('Elle agit sur les dégâts que tu encaisses et sur la résistance des ennemis.',
              64, '10px system-ui, sans-serif', 'rgba(255,255,255,.45)');

  const cw = 186, ch = 190;
  const x0 = (LARGEUR - DIFFICULTES.length * cw) / 2;
  DIFFICULTES.forEach((d, i) => {
    const x = x0 + i * cw, y = 82;
    const actif = i === indexDifficulte;
    const survol = souris.survol && souris.survol.action === 'difficulte' &&
                   souris.survol.valeur === i;
    if (survol && souris.bouge && i !== indexDifficulte) indexDifficulte = i;

    ctx.fillStyle = actif ? 'rgba(232,182,44,.16)' : 'rgba(9,11,20,.72)';
    ctx.fillRect(x + 6, y, cw - 12, ch);
    ctx.strokeStyle = actif ? '#e8b62c' : 'rgba(255,255,255,.14)';
    ctx.lineWidth = actif ? 2 : 1;
    ctx.strokeRect(x + 6.5, y + .5, cw - 13, ch - 1);

    ctx.font = (actif ? 'bold ' : '') + '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = actif ? '#ffe9a8' : 'rgba(255,255,255,.8)';
    ctx.fillText(d.nom, x + cw / 2, y + 26);

    // Trois chevrons de menace, pour lire la difficulte d'un coup d'oeil.
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k <= i ? (actif ? '#e8b62c' : 'rgba(232,182,44,.5)')
                             : 'rgba(255,255,255,.12)';
      ctx.fillRect(x + cw / 2 - 22 + k * 15, y + 36, 11, 4);
    }

    ctx.textAlign = 'left';
    ctx.font = '9px system-ui, sans-serif';
    (DETAIL_DIFFICULTE[d.cle] || []).forEach((ligne, k) => {
      const dernier = k === 3;
      ctx.fillStyle = dernier ? 'rgba(255,255,255,.38)' : 'rgba(255,255,255,.62)';
      ctx.font = (dernier ? 'italic ' : '') + '9px system-ui, sans-serif';
      // Puce, sauf pour la derniere ligne qui est un commentaire.
      if (!dernier) {
        ctx.fillStyle = 'rgba(232,182,44,.6)';
        ctx.fillRect(x + 18, y + 54 + k * 26, 3, 3);
        ctx.fillStyle = 'rgba(255,255,255,.62)';
      }
      envelopper(ligne, x + (dernier ? 18 : 26), y + 58 + k * 26, cw - 44, 11);
    });

    zone(x + 6, y, cw - 12, ch, 'difficulte', i);
  });

  const l = 190, h = 34, x = (LARGEUR - l) / 2, y = 292;
  const survolV = souris.survol && souris.survol.action === 'difficulte-ok';
  ctx.fillStyle = survolV ? 'rgba(232,182,44,.26)' : 'rgba(255,255,255,.07)';
  ctx.fillRect(x, y, l, h);
  ctx.strokeStyle = 'rgba(232,182,44,.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, l - 2, h - 2);
  texteCentre('COMMENCER L\'AVENTURE', y + 22, 'bold 13px system-ui, sans-serif',
              survolV ? '#ffe9a8' : '#e8b62c');
  zone(x, y, l, h, 'difficulte-ok');

  texteCentre('← → choisir · Entrée valider · Échap revenir',
              HAUTEUR - 8, '9px system-ui, sans-serif', 'rgba(255,255,255,.3)');
}

/* Ecrit un texte sur plusieurs lignes dans une largeur donnee. */
function envelopper(texte, x, y, largeur, interligne) {
  let ligne = '', yy = y;
  for (const mot of texte.split(' ')) {
    const essai = ligne ? ligne + ' ' + mot : mot;
    if (ctx.measureText(essai).width > largeur && ligne) {
      ctx.fillText(ligne, x, yy); yy += interligne; ligne = mot;
    } else ligne = essai;
  }
  if (ligne) ctx.fillText(ligne, x, yy);
  return yy;
}

function dessinerOptions() {
  dessinerDemo();
  cadre(64, 46, LARGEUR - 128, HAUTEUR - 92);
  texteCentre('OPTIONS', 76, 'bold 17px system-ui, sans-serif', '#e8b62c');

  const JAUGE_X = LARGEUR - 96 - 110;   // abscisse de depart des jauges
  const JAUGE_L = 110;

  let y = 96;
  MENU_OPTIONS.forEach((e, i) => {
    const hauteurLigne = e.genre === 'choix' ? 34 : 28;
    const survol = souris.survol && souris.survol.action !== null &&
                   souris.survol.valeur === i &&
                   String(souris.survol.action).indexOf('opt') === 0;
    // Le survol ne prend la main que si la souris a REELLEMENT bouge : sinon
    // un pointeur immobile posé sur une autre ligne volait la selection au
    // clavier, et les fleches reglaient la mauvaise valeur.
    if (survol && souris.bouge && i !== indexOptions) indexOptions = i;
    const actif = i === indexOptions;

    if (actif) {
      ctx.fillStyle = 'rgba(232,182,44,.13)';
      ctx.fillRect(80, y - 12, LARGEUR - 160, hauteurLigne - 4);
    }
    ctx.font = (actif ? 'bold ' : '') + '12px system-ui, sans-serif';
    ctx.fillStyle = actif ? '#ffe9a8' : 'rgba(255,255,255,.72)';
    ctx.fillText(e.nom, 92, y + 4);

    // La ligne entiere selectionne ; les commandes propres a la ligne sont
    // enregistrees APRES, donc au-dessus dans la pile de zones.
    zone(80, y - 12, LARGEUR - 160, hauteurLigne - 4, 'option-ligne', i);

    if (e.genre === 'jauge') {
      const v = e.cle === 'musique' ? R.volMusique : R.volEffets;
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(JAUGE_X, y - 2, JAUGE_L, 5);
      ctx.fillStyle = '#e8b62c';
      ctx.fillRect(JAUGE_X, y - 2, JAUGE_L * v, 5);
      // Poignee : rend evident que la jauge se manipule directement.
      ctx.fillStyle = actif ? '#ffe9a8' : '#e8b62c';
      ctx.fillRect(Math.round(JAUGE_X + JAUGE_L * v) - 2, y - 6, 4, 13);
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillText(Math.round(v * 100) + ' %', LARGEUR - 96, y + 18);
      ctx.textAlign = 'left';
      // Zone genereuse en hauteur : on vise une barre de 5 px avec une souris.
      zone(JAUGE_X - 8, y - 14, JAUGE_L + 16, 26, 'jauge', i);

    } else if (e.genre === 'choix') {
      const d = reglageDifficulte();
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';

      const centre = LARGEUR - 96 - 62;
      ctx.fillStyle = '#e8b62c';
      ctx.fillText(d.nom, centre, y + 4);

      // Les deux fleches sont de vrais boutons, chacun avec sa propre zone
      // exactement sous le caractere dessine. Avant, toute la ligne partageait
      // une seule zone decalee vers le bas : cliquer sur « ‹ » avançait quand
      // meme d'un cran, et la zone ne tombait pas sous le curseur.
      [[-1, centre - 74, '‹'], [1, centre + 74, '›']].forEach(([pas, fx, glyphe]) => {
        const dessus = souris.survol && souris.survol.action === 'choix' &&
                       souris.survol.valeur === pas;
        ctx.fillStyle = dessus ? '#ffe9a8' : 'rgba(232,182,44,.7)';
        ctx.font = (dessus ? 'bold ' : '') + '15px system-ui, sans-serif';
        ctx.fillText(glyphe, fx, y + 5);
        zone(fx - 13, y - 12, 26, 24, 'choix', pas);
      });

      ctx.textAlign = 'left';
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.36)';
      ctx.fillText(d.note, 92, y + 20);
    }

    y += hauteurLigne;
  });

  if (messageMenuT > 0) {
    texteCentre(messageMenu, HAUTEUR - 56, '11px system-ui, sans-serif', '#7ee08a',
                Math.min(1, messageMenuT));
  }
  texteCentre('← → pour régler · clic direct sur les jauges · Échap pour revenir',
              HAUTEUR - 34, '10px system-ui, sans-serif', 'rgba(255,255,255,.34)');
}

/* Position d'un clic sur une jauge, ramenee entre 0 et 1. */
function fractionJauge(z) {
  return (souris.x - (z.x + 8)) / (z.w - 16);
}

function dessinerCredits() {
  dessinerDemo();
  cadre(64, 46, LARGEUR - 128, HAUTEUR - 92);
  texteCentre('CRÉDITS', 76, 'bold 17px system-ui, sans-serif', '#e8b62c');

  // Les deux logos sont empiles avec assez d'air pour rester lisibles : le
  // cadre du logo HwR ne doit pas mordre sur le code-barres d'IMAGINe.
  if (logos.imagine) {
    const w = 168, h = logos.imagine.height * w / logos.imagine.width;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logos.imagine, LARGEUR / 2 - w / 2, 92, w, h);
    ctx.globalAlpha = 1;
  }
  if (logos.hwr) {
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logos.hwr, LARGEUR / 2 - 31, 166, 62, 62);
    ctx.globalAlpha = 1;
  }

  texteCentre('Un jeu IMAGINe Studio · développement par HwR Engine',
              248, '11px system-ui, sans-serif', 'rgba(255,255,255,.68)');
  texteCentre('Musiques originales du projet Brad Bitt',
              264, '10px system-ui, sans-serif', 'rgba(255,255,255,.42)');
  texteCentre('Cette page sera complétée plus tard.',
              280, 'italic 10px system-ui, sans-serif', 'rgba(255,255,255,.3)');

  const l = 120, x = (LARGEUR - l) / 2, y = 288;
  const survol = souris.survol && souris.survol.action === 'retour';
  ctx.fillStyle = survol ? 'rgba(232,182,44,.18)' : 'rgba(255,255,255,.06)';
  ctx.fillRect(x, y, l, 26);
  texteCentre('Retour', y + 18, '12px system-ui, sans-serif', '#e8b62c');
  zone(x, y, l, 26, 'retour');
}

/* Ecran d'avant-niveau. Le bouton « Commencer » garantit une interaction juste
   avant le demarrage de la musique, comme demande. */
function dessinerPret() {
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  const d = defNiveau(niveauCourant);
  texteCentre((d ? d.nom : 'Niveau').toUpperCase(), 118,
              'bold 22px system-ui, sans-serif', '#f2f3f8');
  texteCentre(ZONES.map(z => z.nom).join('  →  ') + '  —  ' + reglageDifficulte().nom,
              144, '12px system-ui, sans-serif', 'rgba(255,255,255,.5)');

  const l = 190, h = 42, x = (LARGEUR - l) / 2, y = 190;
  const survol = souris.survol && souris.survol.action === 'commencer';
  ctx.fillStyle = survol ? 'rgba(232,182,44,.2)' : 'rgba(255,255,255,.05)';
  ctx.fillRect(x, y, l, h);
  ctx.strokeStyle = survol ? '#e8b62c' : 'rgba(232,182,44,.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, l - 2, h - 2);
  texteCentre('COMMENCER', y + 28, 'bold 17px system-ui, sans-serif', survol ? '#ffe9a8' : '#e8b62c');
  zone(x, y, l, h, 'commencer');

  texteCentre('← → se déplacer · Espace sauter · X frapper · C onde de choc',
              y + 76, '10px system-ui, sans-serif', 'rgba(255,255,255,.38)');

  // Retour a la base si elle existe deja, sinon au menu principal.
  const versHub = partie.termines.length > 0;
  const lr = 130, xr = (LARGEUR - lr) / 2;
  const action = versHub ? 'aller-hub' : 'menu-retour';
  const survolR = souris.survol && souris.survol.action === action;
  ctx.fillStyle = survolR ? 'rgba(255,255,255,.12)' : 'transparent';
  ctx.fillRect(xr, HAUTEUR - 44, lr, 22);
  texteCentre(versHub ? 'Retour à la base' : 'Menu', HAUTEUR - 29,
              '11px system-ui, sans-serif', 'rgba(255,255,255,.45)');
  zone(xr, HAUTEUR - 44, lr, 22, action);
}

function dessinerFinNiveau() {
  ctx.fillStyle = 'rgba(9,11,20,.9)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  texteCentre('NIVEAU TERMINÉ', 92, 'bold 26px system-ui, sans-serif', '#e8b62c');
  texteCentre('Brad a trouvé la sortie. Le monde parallèle, lui, n\'a pas bougé.',
              116, 'italic 11px system-ui, sans-serif', 'rgba(255,255,255,.5)');

  const lignes = [
    ['Temps', dureeLisible(bilan.temps)],
    ['Ennemis éliminés', String(bilan.ennemis)],
    ['Brad Coins ramassés', bilan.pieces + ' BC'],
    ['Prime de fin de niveau', '+' + bilan.prime + ' BC'],
    ['Total en banque', partie.pieces + ' BC'],
  ];
  let y = 152;
  for (const [g, d] of lignes) {
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(g, 168, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f2f3f8';
    ctx.fillText(d, LARGEUR - 168, y);
    ctx.textAlign = 'left';
    y += 22;
  }

  /* « Continuer » ramene a la base et c'est le bouton principal : c'est la
     boucle normale du jeu, le BRADDY3000 commente le retour. « Rejouer » reste
     disponible en second, pour refaire un niveau sans passer par la carte.
     Le tout premier niveau termine ouvre la base : « Continuer » existe donc
     toujours ici, puisque terminerNiveau() a deja rempli partie.termines. */
  const l = 132, h = 30, y2 = HAUTEUR - 66;
  const boutons = [
    { nom: 'Continuer ▸', action: 'aller-hub', x: LARGEUR / 2 - l - 8, primaire: true },
    { nom: 'Rejouer', action: 'rejouer', x: LARGEUR / 2 + 8 },
  ];
  for (const b of boutons) {
    const survol = souris.survol && souris.survol.action === b.action;
    ctx.fillStyle = b.primaire
      ? (survol ? 'rgba(232,182,44,.32)' : 'rgba(232,182,44,.16)')
      : (survol ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)');
    ctx.fillRect(b.x, y2, l, h);
    ctx.strokeStyle = b.primaire
      ? (survol ? '#ffe9a8' : '#e8b62c')
      : (survol ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.22)');
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + .5, y2 + .5, l - 1, h - 1);
    ctx.font = (b.primaire ? 'bold ' : '') + '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = b.primaire ? '#ffe9a8' : 'rgba(255,255,255,.7)';
    ctx.fillText(b.nom, b.x + l / 2, y2 + 20);
    ctx.textAlign = 'left';
    zone(b.x, y2, l, h, b.action);
  }

  texteCentre('Espace ou clic sur « Continuer » pour rentrer à la base.',
              HAUTEUR - 18, '10px system-ui, sans-serif', 'rgba(255,255,255,.3)');
}

/* Aiguillage des clics, commun a tous les ecrans. */
function activerZone(z) {
  if (!z) return;
  switch (z.action) {
    case 'demarrer':    lancerDemarrage(); break;
    case 'menu':        indexMenu = z.valeur; menuValider(); break;
    case 'option-ligne': indexOptions = z.valeur; menuValider(); break;
    case 'jauge':
      indexOptions = z.valeur;
      souris.glissement = z;                 // on pourra regler en glissant
      fixerVolume(MENU_OPTIONS[z.valeur].cle, fractionJauge(z));
      audio.bruit('menu');
      break;
    case 'choix':       changerDifficulte(z.valeur); break;
    case 'retour':      menuRetour(); break;
    case 'commencer':   commencerNiveau(); break;
    case 'rejouer':     preparerNiveau(); break;
    case 'menu-retour': retourAuMenu(); break;
    case 'relancer-mort': relancerApresMort(); break;
    case 'mort-hub':    audio.arreterMusique(0.5); entrerHub(false); break;
    case 'aller-hub':   rentrerALaBase(); break;
    case 'difficulte':    indexDifficulte = z.valeur; audio.bruit('menu'); break;
    case 'difficulte-ok': validerDifficulte(); break;
    case 'parler-braddy': parlerAuBraddy(); break;

    // --- dialogue
    case 'avancer-dialogue': avancerDialogue(); break;
    case 'passer-dialogue':  passerDialogue(); break;

    // --- hub
    case 'entrer-poste': ouvrirPoste(z.valeur); break;
    case 'fermer-poste': fermerPoste(); break;

    // --- boutique
    case 'onglet-boutique': ongletBoutique = z.valeur; indexBoutique = 0; audio.bruit('menu'); break;
    case 'article':         indexBoutique = z.valeur; acheterArticleCourant(); break;
    case 'confirmer-oui':   repondreConfirmation(true); break;
    case 'confirmer-non':   repondreConfirmation(false); break;

    // --- vestiaire et carte
    case 'uniforme': indexVestiaire = z.valeur; porterUniformeCourant(); break;
    case 'niveau':   indexCarte = z.valeur; lancerNiveauCourant(); break;

    // --- arcade
    case 'arcade-start': demarrerArcade(); break;

    // --- jukebox
    case 'onglet-jukebox': jukebox.onglet = z.valeur; audio.bruit('menu'); break;
    case 'piste':          jukebox.index = z.valeur;
                           choisirPiste(PISTES_JUKEBOX[z.valeur].cle); break;
    case 'code-touche':    tapeCode(z.valeur); break;
    case 'code-effacer':   effaceCode(); break;
    case 'code-valider':   validerCode(); break;

    // --- pause
    case 'pause':          pause.index = z.valeur; validerPause(); break;
  }
}

/* Glisser-deposer sur une jauge, appele par le gestionnaire de souris. */
function majGlissement() {
  const z = souris.glissement;
  if (!z) return;
  fixerVolume(MENU_OPTIONS[z.valeur].cle, fractionJauge(z));
}
