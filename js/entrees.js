/* =============================================================================
   BRAD BITT, MAIS LE JEU — entrees

   On ecoute a la fois event.code (touche physique, claviers QWERTY) et
   event.key (caractere produit, claviers AZERTY). Un joueur francais qui
   utilise Z Q S D est pris en charge sans aucune configuration.

   Toutes les entrees passent par la scene courante : le meme appui sur Espace
   demarre le jeu, valide un menu ou fait sauter Brad selon l'endroit ou l'on
   se trouve.
   ========================================================================== */
'use strict';

const entrees = {
  gauche: false, droite: false, saut: false, courir: false,
  attaque: false, onde: false,
};

// Fronts montants, consommes par la simulation puis remis a faux.
let sautPresseCeTick = false;
let attaquePresseeCeTick = false;
let ondePresseeCeTick = false;
let parlerPresseCeTick = false;

const MAP_CODE = {
  ArrowLeft: 'gauche', KeyA: 'gauche',
  ArrowRight: 'droite', KeyD: 'droite',
  ArrowUp: 'saut', Space: 'saut', KeyW: 'saut',
  ShiftLeft: 'courir', ShiftRight: 'courir',
  KeyX: 'attaque', KeyJ: 'attaque',
  KeyC: 'onde', KeyK: 'onde',
  KeyE: 'parler',
};
const MAP_TOUCHE = {
  q: 'gauche', a: 'gauche',
  d: 'droite',
  z: 'saut', w: 'saut',
  x: 'attaque', j: 'attaque',
  c: 'onde', k: 'onde',
  e: 'parler',
};

const FRONTS = { saut: 1, attaque: 1, onde: 1, parler: 1 };
const TOUCHES_DEFILEMENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function actionDe(e) {
  return MAP_CODE[e.code] || MAP_TOUCHE[(e.key || '').toLowerCase()] || null;
}

function marquerFront(action) {
  if (action === 'saut') sautPresseCeTick = true;
  else if (action === 'attaque') attaquePresseeCeTick = true;
  else if (action === 'onde') ondePresseeCeTick = true;
  else if (action === 'parler') parlerPresseCeTick = true;
}

function relacherTout() {
  Object.keys(entrees).forEach(k => { entrees[k] = false; });
}

addEventListener('keydown', e => {
  if (e.code === 'F1') { e.preventDefault(); basculerPanneau(); return; }
  if (TOUCHES_DEFILEMENT.includes(e.code)) e.preventDefault();

  const lettre = (e.key || '').toLowerCase();
  const valider = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
  const annuler = e.code === 'Escape';

  switch (scene) {
    case 'accueil':
      if (valider) lancerDemarrage();
      return;

    case 'logos':
    case 'chargement':
      return;                                   // rien a faire pendant un chargement

    case 'menu':
      if (confirmation) {
        if (valider) repondreConfirmation(true);
        else if (annuler) repondreConfirmation(false);
        return;
      }
      /* fallthrough */
    case 'options':
      if (e.code === 'ArrowUp' || lettre === 'z' || lettre === 'w') menuDeplacer(-1);
      else if (e.code === 'ArrowDown' || lettre === 's') menuDeplacer(1);
      else if (e.code === 'ArrowLeft' || lettre === 'q') menuAjuster(-1);
      else if (e.code === 'ArrowRight' || lettre === 'd') menuAjuster(1);
      else if (valider) menuValider();
      else if (annuler) menuRetour();
      return;

    case 'credits':
      if (valider || annuler) menuRetour();
      return;

    case 'pause':
      if (confirmation) {
        if (valider) repondreConfirmation(true);
        else if (annuler) repondreConfirmation(false);
        return;
      }
      if (e.code === 'ArrowUp' || lettre === 'z' || lettre === 'w') deplacerPause(-1);
      else if (e.code === 'ArrowDown' || lettre === 's') deplacerPause(1);
      else if (valider) validerPause();
      else if (annuler) reprendreJeu();
      return;

    case 'jukebox': {
      if (annuler) { fermerPoste(); return; }
      if (jukebox.onglet === 1) {
        // Onglet code : le clavier physique tape directement dans le champ.
        if (e.code === 'Backspace') { e.preventDefault(); effaceCode(); return; }
        if (valider) { validerCode(); return; }
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
          jukebox.onglet = 0; audio.bruit('menu'); return;
        }
        if (/^[a-z0-9]$/.test(lettre)) { tapeCode(lettre.toUpperCase()); return; }
        return;
      }
      if (e.code === 'ArrowUp' || lettre === 'z' || lettre === 'w') {
        jukebox.index = (jukebox.index - 1 + PISTES_JUKEBOX.length) % PISTES_JUKEBOX.length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowDown' || lettre === 's') {
        jukebox.index = (jukebox.index + 1) % PISTES_JUKEBOX.length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
                 lettre === 'q' || lettre === 'd') {
        jukebox.onglet = jukebox.onglet ? 0 : 1; audio.bruit('menu');
      } else if (valider) {
        choisirPiste(PISTES_JUKEBOX[jukebox.index].cle);
      }
      return;
    }

    case 'difficulte':
      if (e.code === 'ArrowLeft' || lettre === 'q') {
        indexDifficulte = (indexDifficulte - 1 + DIFFICULTES.length) % DIFFICULTES.length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowRight' || lettre === 'd') {
        indexDifficulte = (indexDifficulte + 1) % DIFFICULTES.length;
        audio.bruit('menu');
      } else if (valider) validerDifficulte();
      else if (annuler) { scene = 'menu'; audio.bruit('menu'); }
      return;

    case 'dialogue':
      if (valider) avancerDialogue();
      else if (annuler) passerDialogue();
      return;

    case 'hub': {
      // Le hub se joue : on laisse passer les commandes de deplacement, et le
      // saut sert d'action devant un poste (majHub le consomme).
      if (annuler) { retourAuMenu(); relacherTout(); return; }
      const ah = actionDe(e);
      if (!ah) return;
      if (FRONTS[ah] && !entrees[ah]) marquerFront(ah);
      entrees[ah] = true;
      return;
    }

    case 'boutique':
      if (annuler) { confirmation ? repondreConfirmation(false) : fermerPoste(); return; }
      if (confirmation) {
        if (valider) repondreConfirmation(true);
        return;
      }
      if (e.code === 'ArrowUp' || lettre === 'z' || lettre === 'w') {
        indexBoutique = (indexBoutique - 1 + articlesBoutique().length) % articlesBoutique().length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowDown' || lettre === 's') {
        indexBoutique = (indexBoutique + 1) % articlesBoutique().length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || lettre === 'q' || lettre === 'd') {
        ongletBoutique = 1 - ongletBoutique; indexBoutique = 0; audio.bruit('menu');
      } else if (valider) acheterArticleCourant();
      return;

    case 'vestiaire':
      if (annuler) { fermerPoste(); return; }
      if (e.code === 'ArrowLeft' || lettre === 'q') {
        indexVestiaire = (indexVestiaire - 1 + UNIFORMES.length) % UNIFORMES.length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowRight' || lettre === 'd') {
        indexVestiaire = (indexVestiaire + 1) % UNIFORMES.length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowUp' || lettre === 'z' || lettre === 'w') {
        indexVestiaire = Math.max(0, indexVestiaire - 4); audio.bruit('menu');
      } else if (e.code === 'ArrowDown' || lettre === 's') {
        indexVestiaire = Math.min(UNIFORMES.length - 1, indexVestiaire + 4); audio.bruit('menu');
      } else if (valider) porterUniformeCourant();
      return;

    case 'carte':
      if (annuler) { fermerPoste(); return; }
      if (e.code === 'ArrowUp' || lettre === 'z' || lettre === 'w') {
        indexCarte = (indexCarte - 1 + ORDRE_NIVEAUX.length) % ORDRE_NIVEAUX.length;
        audio.bruit('menu');
      } else if (e.code === 'ArrowDown' || lettre === 's') {
        indexCarte = (indexCarte + 1) % ORDRE_NIVEAUX.length;
        audio.bruit('menu');
      } else if (valider) lancerNiveauCourant();
      return;

    case 'arcade': {
      if (annuler) { fermerPoste(); return; }
      if (arcade.etat !== 'jeu') {
        if (valider) demarrerArcade();
        return;
      }
      const aa = actionDe(e);
      if (!aa) return;
      if (FRONTS[aa] && !entrees[aa]) marquerFront(aa);
      entrees[aa] = true;
      return;
    }

    case 'pret':
      if (valider) commencerNiveau();
      else if (annuler) retourAuMenu();
      return;

    case 'mort':
      if (valider || lettre === 'x') relancerApresMort();
      else if (annuler) { audio.arreterMusique(0.5); entrerHub(false); }
      return;

    case 'fin':
      // Un seul chemin, clavier comme clic : rentrerALaBase() coupe la musique,
      // entre dans le hub et fait commenter le retour par le BRADDY3000. Passer
      // par entrerHub() directement sauterait la replique.
      if (valider || annuler) rentrerALaBase();
      return;
  }

  // --- Scene 'jeu' ---------------------------------------------------------
  if (annuler) {
    // Echap n'abandonne plus le niveau d'un coup : il ouvre le menu de pause,
    // qui previent que quitter ne sauvegarde rien.
    ouvrirPause();
    return;
  }
  if (lettre === 'r') { preparerNiveau(niveauCourant); relacherTout(); return; }

  const a = actionDe(e);
  if (!a) return;
  if (FRONTS[a] && !entrees[a]) marquerFront(a);
  entrees[a] = true;
});

addEventListener('keyup', e => {
  const a = actionDe(e);
  if (a) entrees[a] = false;
});

addEventListener('blur', relacherTout);

/* --- Souris ---------------------------------------------------------------
   Le menu etant dessine dans le canvas, il faut convertir les coordonnees de
   l'ecran vers la resolution interne de 640x360.
------------------------------------------------------------------------- */

function versCanvas(ev) {
  const r = canvas.getBoundingClientRect();
  const nx = (ev.clientX - r.left) * (LARGEUR / r.width);
  const ny = (ev.clientY - r.top) * (HAUTEUR / r.height);
  if (Math.abs(nx - souris.x) > 0.5 || Math.abs(ny - souris.y) > 0.5) souris.bouge = true;
  souris.x = nx;
  souris.y = ny;
  souris.dansCanvas = true;
}

canvas.addEventListener('pointermove', ev => {
  versCanvas(ev);
  if (souris.glissement) { ev.preventDefault(); majGlissement(); }
});

canvas.addEventListener('pointerleave', () => {
  souris.dansCanvas = false;
  souris.survol = null;
  souris.glissement = null;
});

addEventListener('pointerup', () => { souris.glissement = null; });
addEventListener('pointercancel', () => { souris.glissement = null; });

canvas.addEventListener('pointerdown', ev => {
  versCanvas(ev);
  const z = zoneSousSouris();
  if (z) { ev.preventDefault(); activerZone(z); return; }
  // Un clic n'importe ou sur l'ecran d'accueil demarre aussi : le bouton est
  // une invitation, pas un passage oblige.
  if (scene === 'accueil') { lancerDemarrage(); return; }
  if (scene === 'dialogue') { ev.preventDefault(); avancerDialogue(); return; }
  // Idem sur l'ecran de mort : au doigt, il n'y a pas de touche Espace a
  // presser. N'importe ou sur l'ecran relance.
  if (scene === 'mort') { ev.preventDefault(); relancerApresMort(); }
});

/* --- Commandes tactiles --------------------------------------------------- */

const zoneTactile = document.getElementById('tactile');
const estTactile = matchMedia('(pointer: coarse)').matches;

zoneTactile.querySelectorAll('.tbtn').forEach(btn => {
  const a = btn.dataset.touche;
  const presser = ev => {
    ev.preventDefault();
    if (scene !== 'jeu' && scene !== 'hub' && scene !== 'arcade') return;
    if (FRONTS[a] && !entrees[a]) marquerFront(a);
    entrees[a] = true;
  };
  const relacher = ev => { ev.preventDefault(); entrees[a] = false; };
  btn.addEventListener('pointerdown', presser);
  btn.addEventListener('pointerup', relacher);
  btn.addEventListener('pointercancel', relacher);
  btn.addEventListener('pointerleave', relacher);
});

/* Les boutons tactiles ne servent que pendant le jeu : ailleurs ils
   masqueraient inutilement le menu. */
function majAffichageTactile() {
  const jouable = scene === 'jeu' || scene === 'hub' ||
                  (scene === 'arcade' && arcade.etat === 'jeu');
  const visible = estTactile && jouable && !enPortrait();
  if (zoneTactile.hidden === visible) zoneTactile.hidden = !visible;
}

/* --- Orientation ----------------------------------------------------------
   Le jeu est cadre en 16:9 : en portrait, l'image occupe une bande minuscule
   et les commandes recouvrent la moitie de l'ecran. On demande donc la
   rotation avant tout — y compris avant le bouton « Jouer », pour que le
   joueur ne demarre pas dans une configuration injouable.
------------------------------------------------------------------------- */

const ecranRotation = document.getElementById('rotation');

function enPortrait() {
  return estTactile && innerHeight > innerWidth;
}

function majOrientation() {
  const demander = enPortrait();
  if (ecranRotation.hidden === demander) ecranRotation.hidden = !demander;
  if (demander) relacherTout();
}

addEventListener('resize', majOrientation);
addEventListener('orientationchange', () => setTimeout(majOrientation, 120));
majOrientation();
