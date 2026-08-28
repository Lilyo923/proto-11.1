/* =============================================================================
   BRAD BITT, MAIS LE JEU — monde
   Constantes de rendu, chargement des images et des musiques, et le CHARGEUR
   de niveaux. Les niveaux eux-memes vivent chacun dans leur fichier sous
   niveaux/ (l'architecture demandee par les notes : pas de monolithe).
   ========================================================================== */
'use strict';

const LARGEUR = 640;      // resolution interne, mise a l'echelle en CSS
const HAUTEUR = 360;
const TUILE = 24;

const canvas = document.getElementById('jeu');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

/* -----------------------------------------------------------------------------
   1. REGISTRE DES NIVEAUX
   Chaque fichier de niveaux/ s'enregistre ici :
     NIVEAUX['intro'] = { nom, musique, zones, solides, ... }
   puis chargerNiveau(id) transvase la definition dans les variables que le
   moteur consomme. Aucun fetch() : les niveaux sont des <script> classiques,
   la page reste ouvrable par double-clic.
-------------------------------------------------------------------------- */

const NIVEAUX = {};
const ORDRE_NIVEAUX = ['intro', 'niveau1', 'niveau2', 'niveau3'];

let niveauCourant = 'intro';
let ZONES = [];
let solides = [];
let traversantes = [];
let PANNEAUX = [];
let ENNEMIS_DEPART = [];
let NIVEAU_L = 0;
let NIVEAU_H = 18 * TUILE;
let APPARITION = { x: 3 * TUILE, y: 12 * TUILE };
let PORTE = null;
let SAS = null;          // le premier sas, garde pour les usages simples
let SAS_LISTE = [];      // tous les sas du niveau, dans l'ordre des zones
let AUDIO_NIVEAU = null;
let ENTRAINEMENT = false;      // vrai dans le camp : aucune recompense possible

/* L'arene de boss, quand le niveau en a une. En pixels apres chargement :
     { x1, x2 }        les bornes horizontales de la salle
     { boss }          le type d'ennemi a faire apparaitre
     { objet }         la cle de l'objet majeur qu'il lache en tombant
     { renforts }      les vagues de sbires appelees pendant les phases blindees
   La porte de sortie du niveau reste FERMEE tant que le boss est debout : un
   niveau a boss ne se contourne pas. */
let ARENE = null;

function chargerNiveau(id) {
  const d = NIVEAUX[id];
  if (!d) throw new Error('Niveau inconnu : ' + id);
  niveauCourant = id;

  ZONES = d.zones;
  solides = d.solides.map(([x, y, w, h]) =>
    ({ x: x * TUILE, y: y * TUILE, w: w * TUILE, h: h * TUILE }));
  traversantes = (d.traversantes || []).map(([x, y, w]) =>
    ({ x: x * TUILE, y: y * TUILE, w: w * TUILE, h: 6 }));
  PANNEAUX = d.panneaux || [];
  ENNEMIS_DEPART = d.ennemis;
  NIVEAU_L = d.largeur * TUILE;
  NIVEAU_H = (d.hauteur || 18) * TUILE;
  APPARITION = { x: d.apparition.x * TUILE, y: d.apparition.y * TUILE };
  PORTE = {
    x: d.porte.x * TUILE, y: d.porte.y * TUILE,
    w: (d.porte.w || 2) * TUILE, h: (d.porte.h || 3) * TUILE,
  };
  /* Les sas. Un niveau a autant de sas que de changements de zone, donc un de
     moins que de zones : le niveau 3 en a deux. On accepte les deux ecritures
     — un objet unique pour les niveaux a deux zones, un tableau au-dela — pour
     ne pas avoir a reecrire les fichiers existants. */
  const brutSas = d.sas === undefined ? [] : (Array.isArray(d.sas) ? d.sas : [d.sas]);
  if (d.sas2) brutSas.push(d.sas2);
  SAS_LISTE = brutSas.map(s => ({
    x: s.x * TUILE, y: s.y * TUILE,
    w: (s.w || 3) * TUILE, h: (s.h || 6) * TUILE,
    style: s.style || 'sas',
  }));
  SAS = SAS_LISTE[0] || null;
  AUDIO_NIVEAU = d.musique ? sourceMusique(d.musique) : null;
  ENTRAINEMENT = !!d.entrainement;

  ARENE = d.arene
    ? {
        x1: d.arene.x1 * TUILE,
        x2: d.arene.x2 * TUILE,
        sol: (d.arene.sol !== undefined ? d.arene.sol : 15) * TUILE,
        boss: d.arene.boss,
        nom: d.arene.nom || 'Boss',
        musique: d.arene.musique || null,
        objet: d.arene.objet || null,
        depart: { x: d.arene.depart.x * TUILE, y: d.arene.depart.y * TUILE },
        renforts: (d.arene.renforts || []).map(v =>
          v.map(r => ({ type: r.type, x: r.x * TUILE, y: r.y * TUILE }))),
        trampolines: (d.arene.trampolines || []).map(t =>
          ({ x: t.x * TUILE, y: t.y * TUILE, w: (t.w || 2) * TUILE })),
      }
    : null;
  if (typeof chargerMobiles === 'function') chargerMobiles(d);
  if (typeof reinitialiserArene === 'function') reinitialiserArene();
}

function defNiveau(id) { return NIVEAUX[id]; }

function zoneDe(x) {
  const t = x / TUILE;
  for (let i = 0; i < ZONES.length; i++) if (t < ZONES[i].x1) return i;
  return ZONES.length - 1;
}

/* -----------------------------------------------------------------------------
   2. MUSIQUE
   Deux encodages par piste, du meilleur au plus universel : l'AAC (.m4a) est
   le fichier d'origine, le MP3 existe parce que les compilations libres de
   Chromium ne lisent pas l'AAC. On choisit une fois pour toutes au demarrage.
-------------------------------------------------------------------------- */

const EXT_AUDIO = (() => {
  let sonde;
  try { sonde = new Audio(); } catch (e) { return '.mp3'; }
  const avis = sonde.canPlayType('audio/mp4; codecs="mp4a.40.2"');
  return (avis === 'probably' || avis === 'maybe') ? '.m4a' : '.mp3';
})();

function sourceMusique(base) { return 'assets/audio/' + base + EXT_AUDIO; }

/* -----------------------------------------------------------------------------
   3. IMAGES
   Metadonnees en dur (pas de fetch de JSON) ; assets/brad/brad.json en garde
   une copie lisible pour les humains.
-------------------------------------------------------------------------- */

const sprites = {};
const IMAGES_ENNEMIS = ['Serra', 'Serra-Boost', 'Serra-Lourd', 'Serra-Lanceur',
                        'Serra-Volant', 'boule-serrano'];

const BRAD_PLANCHE = {
  cw: 36, ch: 48,
  piedsDansCellule: 47,
  repos: 0, marche: 1, course: 2,
};

/* Une planche par uniforme. `classique` est la planche de base ; les autres
   sont pre-generees par tools/recolor_brad.py (la recoloration a l'execution
   est impossible en file://, canvas teinte). */
const PLANCHES_UNIFORMES = {
  'classique':        'assets/brad/brad.png',
  'classique-bleu':   'assets/brad/brad-classique-bleu.png',
  'classique-orange': 'assets/brad/brad-classique-orange.png',
  'classique-vert':   'assets/brad/brad-classique-vert.png',
  'classique-violet': 'assets/brad/brad-classique-violet.png',
  'cravate-jaune':    'assets/brad/brad-cravate-jaune.png',
  'classique-turquoise': 'assets/brad/brad-classique-turquoise.png',
  'classique-bordeaux':  'assets/brad/brad-classique-bordeaux.png',
  'dore':             'assets/brad/brad-dore.png',
};

const planchesBrad = {};        // cle -> Image chargee
let imgBrad = null;             // planche ACTIVE (celle de l'uniforme porte)
let bradPret = false;

function appliquerUniforme(cle) {
  const img = planchesBrad[cle] || planchesBrad['classique'];
  if (img) { imgBrad = img; bradPret = true; }
}

const logos = {};

function precharger(surProgres) {
  const taches = [];

  const image = (src, rangement, cle) => taches.push(new Promise(resoudre => {
    const img = new Image();
    img.onload = () => { rangement[cle] = img; resoudre(); };
    img.onerror = () => resoudre();          // un asset manquant ne bloque jamais
    img.src = src;
  }));

  IMAGES_ENNEMIS.forEach(n => image('assets/ennemis/' + n + '.png', sprites, n));
  image('assets/ui/logo-imagine.png', logos, 'imagine');
  image('assets/ui/logo-hwr.png', logos, 'hwr');
  Object.keys(PLANCHES_UNIFORMES).forEach(cle =>
    image(PLANCHES_UNIFORMES[cle], planchesBrad, cle));

  // Toutes les musiques de niveau connues, dans le format retenu.
  ORDRE_NIVEAUX.forEach(id => {
    const d = NIVEAUX[id];
    if (d && d.musique) taches.push(audio.precharger(sourceMusique(d.musique)));
  });

  let faits = 0;
  const total = taches.length;
  taches.forEach(p => p.then(() => { faits++; surProgres(faits / total); }));
  return Promise.all(taches).then(() => {
    appliquerUniforme(typeof partie !== 'undefined' ? partie.uniforme : 'classique');
  });
}

/* -----------------------------------------------------------------------------
   4. UTILITAIRES GEOMETRIQUES
-------------------------------------------------------------------------- */

function chevauche(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Y a-t-il un sol dont la surface est a la hauteur `ligneY` (a 2 px pres) ? */
function solSous(x, ligneY) {
  return solides.concat(traversantes).some(s =>
    x >= s.x && x <= s.x + s.w && Math.abs(s.y - ligneY) < 2);
}

/* Variante tolerante : accepte aussi un sol situe un peu PLUS BAS, jusqu'a
   `chute` pixels. Sert aux ennemis pour descendre une marche d'escalier au
   lieu de la traiter comme un precipice et de faire demi-tour. */
function solSousOuDessous(x, ligneY, chute) {
  return solides.concat(traversantes).some(s =>
    x >= s.x && x <= s.x + s.w && s.y >= ligneY - 2 && s.y <= ligneY + chute);
}
