/* =============================================================================
   BRAD BITT, MAIS LE JEU — acteurs
   Brad, ennemis, boules de Serrano, ramassages et effets.
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. BRAD
-------------------------------------------------------------------------- */

/* Distance parcourue entre deux images du cycle de pas. Le cycle est indexe sur
   la DISTANCE et non sur le temps : la cadence des jambes suit automatiquement
   l'acceleration, Brad ne patine pas et ne marche jamais a reculons. */
const LONGUEUR_PAS = 22;

const brad = {
  x: APPARITION.x, y: APPARITION.y,
  w: 22, h: 46,
  vx: 0, vy: 0,
  sens: 1,
  auSol: false,
  coyote: 0, tampon: 0,
  sautEnCours: false,
  sautsRestants: 0,
  inactif: 0,
  phaseMarche: 0, phaseRepos: 0,
  etirement: 1,
  hauteurMax: 0, yDepartSaut: 0,
  rebond: 0,           // impulsion externe (trampoline) : gravite normale
  basAvant: 0, vyAvant: 0,

  // combat — pvMax est recalcule a chaque depart de niveau depuis la
  // sauvegarde (les ameliorations achetees au hub le font monter).
  pv: 10, pvMax: 10,
  invincible: 0,
  attaque: 0,          // temps restant de la fenetre de degats
  recharge: 0,         // delai avant le prochain coup
  toucheParAttaque: null,
  shy: 0,              // jauge de Brad-Shy, 0 a 100
  porte: null,         // boule de Serrano transportee
  pieces: 0,
  porteur: null,       // ennemi-plateforme sur lequel Brad se tient
  scenarise: 0,        // > 0 : Brad avance tout seul (entree dans la porte)
};

const traces = [];
let mortsHorsEcran = 0;
let mortsConsecutives = 0;

/* Dernier endroit sur : les notes prevoient une reapparition au dernier point
   atteint plutot qu'au debut du niveau. */
const pointSur = { x: APPARITION.x, y: APPARITION.y };
let delaiPointSur = 0;

function majPointSur(dt) {
  delaiPointSur -= dt;
  if (delaiPointSur > 0 || !brad.auSol) return;
  delaiPointSur = 0.25;
  // Le sol doit exister sous les DEUX coins : on refuse un point de
  // reapparition situe au bord d'un vide.
  const ligne = brad.y + brad.h;
  if (solSous(brad.x + 2, ligne) && solSous(brad.x + brad.w - 2, ligne)) {
    pointSur.x = brad.x;
    pointSur.y = brad.y;
  }
}

function reapparaitre(auDebut) {
  const p = auDebut ? APPARITION : pointSur;
  brad.x = p.x; brad.y = p.y;
  brad.vx = 0; brad.vy = 0;
  brad.coyote = 0; brad.tampon = 0;
  brad.invincible = 1.0;
  brad.porte = null;
  brad.porteur = null;
  brad.scenarise = 0;
  traces.length = 0;
  if (auDebut) { pointSur.x = APPARITION.x; pointSur.y = APPARITION.y; }
}

/* --- Collisions ---------------------------------------------------------- */

function deplacerX(dt) {
  brad.x += brad.vx * dt;
  for (const s of solides) {
    if (!chevauche(brad, s)) continue;
    if (brad.vx > 0) brad.x = s.x - brad.w;
    else if (brad.vx < 0) brad.x = s.x + s.w;
    brad.vx = 0;
  }
}

function deplacerY(dt) {
  const basAvant = brad.y + brad.h;
  brad.y += brad.vy * dt;
  let auSol = false;

  for (const s of solides) {
    if (!chevauche(brad, s)) continue;
    if (brad.vy > 0) { brad.y = s.y - brad.h; auSol = true; }
    else if (brad.vy < 0) { brad.y = s.y + s.h; }
    brad.vy = 0;
  }

  // Plateformes traversables : uniquement en descente, et seulement si Brad
  // etait entierement au-dessus a l'image precedente.
  if (brad.vy > 0) {
    for (const p of traversantes) {
      if (!chevauche(brad, p)) continue;
      if (basAvant <= p.y + 1) { brad.y = p.y - brad.h; brad.vy = 0; auSol = true; }
    }
  }
  return auSol;
}

/* --- Simulation ---------------------------------------------------------- */

function majBrad(dt) {
  // Fin de niveau : Brad marche seul vers la porte, le joueur ne controle plus.
  const dir = brad.scenarise > 0
    ? 1
    : (entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0);
  const vitesseCible = (brad.scenarise > 0 ? R.vitesseMarche * 0.75
                       : (entrees.courir ? R.vitesseCourse : R.vitesseMarche)) * dir;

  // Un ennemi-plateforme emmene Brad avec lui. `porteur` est reechantillonne
  // a chaque image par contactEnnemi() : s'il descend, Brad tombe normalement.
  if (brad.porteur) {
    brad.x += brad.porteur.vx * dt;
    brad.porteur = null;
  }

  let accel;
  if (dir === 0) {
    accel = R.freinage * (brad.auSol ? 1 : R.freinageAir);
  } else {
    accel = R.acceleration * (brad.auSol ? 1 : R.controleAir);
    // Demi-tour : accelerer plus fort quand la vitesse s'oppose a la direction
    // demandee rend le changement de sens vif sans supprimer le poids.
    if (brad.vx * dir < 0) accel *= R.demiTour;
  }
  if (brad.vx < vitesseCible) brad.vx = Math.min(vitesseCible, brad.vx + accel * dt);
  else if (brad.vx > vitesseCible) brad.vx = Math.max(vitesseCible, brad.vx - accel * dt);
  if (dir !== 0) brad.sens = dir;

  brad.coyote = brad.auSol ? R.coyote : Math.max(0, brad.coyote - dt);
  brad.tampon = sautPresseCeTick ? R.tampon : Math.max(0, brad.tampon - dt);

  const peutSauter = (brad.coyote > 0 || (OPTIONS.doubleSaut && brad.sautsRestants > 0))
                     && brad.scenarise <= 0;
  if (brad.tampon > 0 && peutSauter) {
    audio.bruit('saut');
    if (brad.coyote <= 0) brad.sautsRestants--;
    brad.vy = -R.forceSaut;
    brad.auSol = false;
    brad.coyote = 0; brad.tampon = 0;
    brad.sautEnCours = true;
    brad.etirement = 1.28;
    brad.yDepartSaut = brad.y;
    brad.hauteurMax = 0;
  }
  if (brad.sautEnCours && (!entrees.saut || brad.vy >= 0)) brad.sautEnCours = false;

  brad.rebond = Math.max(0, brad.rebond - dt);
  let g = R.gravite;
  if (brad.vy > 0) g *= R.graviteChute;
  // La gravite renforcee du bouton relache ne doit pas s'appliquer a une
  // impulsion que le joueur n'a pas donnee : sans cette exception, le
  // trampoline ne montait qu'a 68 px au lieu de 176, et ne servait a rien.
  else if (!brad.sautEnCours && brad.rebond <= 0 && brad.vy < 0) g *= R.graviteRelache;
  brad.vy = Math.min(R.chuteMax, brad.vy + g * dt);

  deplacerX(dt);
  const etaitAuSol = brad.auSol;
  // Memorise avant la resolution des collisions : le contact avec un ennemi
  // est teste APRES que Brad a ete recale sur le sol, donc sa vitesse et sa
  // position d'alors ne diraient plus s'il arrivait par le dessus.
  brad.basAvant = brad.y + brad.h;
  brad.vyAvant = brad.vy;
  brad.auSol = deplacerY(dt);

  // Les barres mobiles portent Brad et le trampoline le relance : les deux
  // corrigent ce que la resolution verticale vient de decider, donc ils
  // passent juste apres elle.
  if (poserSurMobiles()) brad.auSol = true;
  majTrampolines(dt);

  if (brad.auSol && !etaitAuSol) {
    const force = Math.min(1, Math.abs(brad.vy || R.chuteMax) / R.chuteMax);
    brad.etirement = 1 - 0.3 * Math.max(0.35, force);
    brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;
  }
  if (brad.auSol) brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;
  if (!brad.auSol) brad.hauteurMax = Math.max(brad.hauteurMax, brad.yDepartSaut - brad.y);

  majAttaque(dt);
  majPointSur(dt);
  majPorte(dt);
  if (brad.y > NIVEAU_H + 120) { mortsHorsEcran++; tuerBrad('le vide'); }

  brad.invincible = Math.max(0, brad.invincible - dt);
  brad.etirement += (1 - brad.etirement) * Math.min(1, 12 * dt);
  brad.phaseMarche += Math.abs(brad.vx) * dt / LONGUEUR_PAS;
  brad.phaseRepos += dt;

  const actif = dir !== 0 || !brad.auSol || Math.abs(brad.vx) > 4 || brad.attaque > 0;
  brad.inactif = actif ? 0 : brad.inactif + dt;

  if (OPTIONS.traces) {
    traces.push({ x: brad.x + brad.w / 2, y: brad.y + brad.h, sol: brad.auSol });
    if (traces.length > 260) traces.shift();
  }
  sautPresseCeTick = false;
}

/* --- Attaque au corps-a-corps -------------------------------------------
   Gratuite et illimitee : seul le delai de recharge la borne. Le Brad-Shy
   n'est PAS consomme ici, c'est une jauge d'ultime (choix confirme).
------------------------------------------------------------------------ */

function zoneAttaque() {
  const enLAir = !brad.auSol;
  const l = R.porteeAttaque;
  return {
    x: brad.sens > 0 ? brad.x + brad.w - 4 : brad.x - l + 4,
    y: brad.y + (enLAir ? 14 : 8),
    w: l,
    h: brad.h - (enLAir ? 12 : 16),
  };
}

function majAttaque(dt) {
  brad.recharge = Math.max(0, brad.recharge - dt);
  brad.attaque = Math.max(0, brad.attaque - dt);

  if (attaquePresseeCeTick && brad.recharge <= 0) {
    if (brad.porte) {
      lancerBoule();
    } else {
      brad.attaque = R.dureeAttaque;
      brad.recharge = R.recharge;
      brad.toucheParAttaque = new Set();
    }
  }
  attaquePresseeCeTick = false;

  if (ondePresseeCeTick && brad.shy >= 100) declencherOnde();
  ondePresseeCeTick = false;

  if (brad.attaque <= 0) return;
  const zone = zoneAttaque();
  for (const e of ennemis) {
    if (e.etat === 'mort' || brad.toucheParAttaque.has(e.id)) continue;
    if (!chevauche(zone, e)) continue;
    brad.toucheParAttaque.add(e.id);
    blesserEnnemi(e, Math.max(1, Math.round(R.degatsBrad * bonusDegats())), brad.sens);
  }
}

function declencherOnde() {
  brad.shy = 0;
  audio.bruit('onde');
  const cx = brad.x + brad.w / 2;
  const cy = brad.y + brad.h / 2;
  effets.push({ genre: 'onde', x: cx, y: cy, r: 0, rMax: R.rayonOnde, t: 0, duree: 0.4 });
  for (const e of ennemis) {
    if (e.etat === 'mort') continue;
    const dx = (e.x + e.w / 2) - cx;
    const dy = (e.y + e.h / 2) - cy;
    if (Math.hypot(dx, dy) > R.rayonOnde) continue;
    blesserEnnemi(e, Math.max(1, Math.round(R.degatsOnde * bonusDegats())), Math.sign(dx) || 1);
  }
  texteFlottant(cx, brad.y - 8, 'BRAD-SHY !', '#e8b62c');
}

/* --- Degats subis -------------------------------------------------------- */

function blesserBrad(degats, sourceX, nomSource) {
  if (brad.invincible > 0 || brad.scenarise > 0) return;
  // La difficulte agit sur les degats subis, comme le prevoient les notes ;
  // la resistance achetee au hub les attenue.
  degats = Math.max(1, Math.round(degats * reglageDifficulte().degats * bonusResistance()));
  brad.pv -= degats;
  brad.invincible = R.invincibilite;
  audio.bruit('degat');
  const sens = Math.sign(brad.x + brad.w / 2 - sourceX) || 1;
  brad.vx = sens * R.reculX;
  brad.vy = -R.reculY;
  brad.auSol = false;
  brad.porte = null;
  texteFlottant(brad.x + brad.w / 2, brad.y, '-' + degats, '#ff6b6b');
  secousse(4, 0.18);
  if (brad.pv <= 0) tuerBrad(nomSource);
}

const CONSEILS = {
  'Serra': "Un saut sur la tête suffit. Vraiment, juste un.",
  'Serra-Boost': "Il court plus vite que toi. Laisse-le venir et saute au dernier moment.",
  'Serra-Lourd': "Impossible à écraser. Trois coups de poing, et de la patience.",
  'Serra-Lanceur': "Tes poings ne lui font rien. Renvoie-lui sa boule.",
  'Serra-Volant': "Attaque-le en l'air, c'est fait pour ça.",
  'le vide': "Le vide, Brad. Le vide.",
};

/* Scene courante. Une seule variable pilote tout : la boucle sait quoi
   simuler, le rendu sait quoi dessiner, les entrees savent qui ecouter.
   'accueil' | 'logos' | 'menu' | 'options' | 'credits' | 'pret'
   | 'jeu' | 'mort' | 'fin' */
let scene = 'accueil';
let tueur = '';

function tuerBrad(nomSource) {
  if (scene !== 'jeu') return;
  // Au camp, mourir n'a aucune consequence : on repart tout de suite, la
  // salle est faite pour rater.
  if (ENTRAINEMENT) {
    brad.pv = brad.pvMax;
    brad.shy = 0;
    reapparaitre(true);
    secousse(6, 0.3);
    audio.bruit('degat');
    return;
  }
  brad.pv = 0;
  scene = 'mort';
  tueur = nomSource;
  mortsConsecutives++;
  secousse(8, 0.4);
  audio.bruit('mort');
  audio.arreterMusique(0.5);
}

function relancerApresMort() {
  // Trois morts consecutives : les notes demandent de refaire le niveau entier.
  const auDebut = mortsConsecutives >= 3;
  if (auDebut) mortsConsecutives = 0;
  brad.pv = brad.pvMax;
  brad.shy = 0;
  reapparaitre(auDebut);
  // Les ennemis deja elimines restent elimines, sauf redemarrage complet.
  reinitialiserEnnemis(auDebut);
  // Le combat de boss, lui, repart de zero : reinitialiserEnnemis() vient de
  // supprimer le boss et ses renforts, qui ne sont dans aucune liste de
  // depart. Sans ça, l'arene resterait « active » avec un boss disparu.
  rejouerArene();
  scene = 'jeu';
  // La musique reprend celle du niveau en cours, quel qu'il soit.
  if (AUDIO_NIVEAU) audio.jouerMusique(AUDIO_NIVEAU, 0.8);
}

/* --- Porte de sortie -----------------------------------------------------
   La fin du niveau ne doit pas etre une enigme : Brad n'a aucune touche a
   deviner, il lui suffit de marcher dans la porte. Le joueur perd alors la
   main pendant une seconde — Brad finit d'entrer tout seul — puis le bilan
   s'affiche. Ce petit temps scenarise vaut mieux qu'une coupure seche.
------------------------------------------------------------------------- */

const bilan = { temps: 0, pieces: 0, ennemis: 0, prime: 0 };
let chrono = 0;

function majPorte(dt) {
  if (brad.refusPorte > 0) brad.refusPorte -= dt;
  if (brad.scenarise > 0) {
    brad.scenarise -= dt;
    if (brad.scenarise <= 0) terminerNiveau();
    return;
  }
  if (scene !== 'jeu') return;
  if (brad.auSol && chevauche(brad, PORTE)) {
    // Un niveau a boss ne se contourne pas : la porte refuse de s'ouvrir tant
    // que le gardien est debout. On le signale plutot que de laisser Brad
    // pietiner une porte qui ne reagit pas.
    if (porteVerrouillee()) {
      if (!brad.refusPorte || brad.refusPorte <= 0) {
        brad.refusPorte = 1.4;
        audio.bruit('refus');
        texteFlottant(brad.x + brad.w / 2, brad.y - 6, 'verrouillé', '#e2553b');
      }
      return;
    }
    brad.scenarise = 1.2;
    brad.invincible = 999;
    brad.porte = null;
    audio.bruit('porte');
    audio.arreterMusique(1.1);
  }
}

function terminerNiveau() {
  // Sortir du camp ne « termine » rien : on rentre simplement dans la base,
  // sans bilan, sans prime, sans deblocage de niveau.
  if (ENTRAINEMENT) {
    partie.entrainements++;
    enregistrerPartie();
    audio.arreterMusique(0.4);
    entrerHub(false);
    braddyDit(repliqueSortieEntrainement());
    return;
  }
  scene = 'fin';
  const diff = reglageDifficulte();
  bilan.temps = chrono;
  bilan.pieces = brad.pieces;
  bilan.ennemis = ennemisElimines.size;
  bilan.prime = Math.round(5 * diff.recompense);   // +5 BC par niveau (Roadmap)
  bilan.premiere = !niveauTermine(niveauCourant);

  partie.pieces += brad.pieces + bilan.prime;
  partie.tempsJoue += chrono;
  if (bilan.premiere) partie.termines.push(niveauCourant);
  enregistrerPartie();
  audio.bruit('victoire');
}

/* -----------------------------------------------------------------------------
   2. ENNEMIS
   Un seul comportement generique, parametre par type. Les differences de
   gameplay tiennent dans cette table, pas dans du code separe.
-------------------------------------------------------------------------- */

/* `sensNatif` : direction vers laquelle le sprite d'origine regarde, releve sur
   la position des pupilles dans chaque image. Le rendu multiplie le sens de
   deplacement par cette valeur ; sans elle, un sprite dessine vers la gauche
   apparait a l'envers des qu'il avance vers la droite. */
const TYPES_ENNEMI = {
  'Serra':         { w: 20, h: 32, pv: 1, vitesse: 1.0,  degats: 1, shy: 1.0, ecrasable: true,
                     sensNatif: -1 },
  'Serra-Boost':   { w: 20, h: 32, pv: 1, vitesse: 2.0,  degats: 1, shy: 1.0, ecrasable: true,
                     sensNatif: 1, portee: 1.4, saute: true },
  'Serra-Lourd':   { w: 32, h: 40, pv: 3, vitesse: 0.55, degats: 2, shy: 2.2, ecrasable: false,
                     sensNatif: 1, plateforme: true },
  'Serra-Lanceur': { w: 24, h: 34, pv: 1, vitesse: 0,    degats: 1, shy: 1.8, ecrasable: false,
                     sensNatif: 1, invulnerable: true, lance: true, cadence: 2.0 },
  'Serra-Volant':  { w: 24, h: 28, pv: 1, vitesse: 0.9,  degats: 1, shy: 1.3, ecrasable: true,
                     sensNatif: -1, vole: true },

  /* Le boss. Un Serra-Lourd nourri : quatre fois sa vie, plus de degats, et
     surtout le blindage gere par js/boss.js. `sprite` reutilise la planche du
     Lourd et `echelle` l'agrandit — inutile de redessiner un asset pour un
     ennemi dont la difference tient au comportement. Il n'est pas
     `plateforme` : on ne monte pas sur un boss pour le pieger dans un coin. */
  'Serra-Colosse': { w: 52, h: 66, pv: 14, vitesse: 0.5, degats: 3, shy: 6, ecrasable: false,
                     sensNatif: 1, sprite: 'Serra-Lourd', echelle: 1.65, boss: true },
};

/* Impulsion d'un ennemi qui franchit un trou, et distance maximale qu'il
   accepte de tenter. */
const SAUT_ENNEMI = 430;
const PORTEE_SAUT_ENNEMI = 96;

/* Le bonus permanent « Serrano rassis » ralentit toutes les patrouilles. */
function vitesseEnnemiEffective() {
  return R.vitesseEnnemi * (aPermanent('lenteur') ? 0.85 : 1);
}

let ennemis = [];
let prochainId = 1;

/* Index, dans ENNEMIS_DEPART, des ennemis deja elimines. Ils ne reviennent pas
   quand Brad reapparait : rien n'est plus injuste que de retomber au milieu
   d'un groupe qu'on venait de nettoyer. Seul un vrai redemarrage du niveau
   (trois morts d'affilee, ou la touche R) remet tout en place. */
const ennemisElimines = new Set();

function creerEnnemi(depart, index) {
  const t = TYPES_ENNEMI[depart.type];
  const diff = reglageDifficulte();
  // Rayon de patrouille : borne dure autour du point de depart. Sans elle, un
  // volant n'a rien pour l'arreter en plein ciel et finit a l'autre bout du
  // niveau avant meme que le joueur ne l'ait vu.
  const rayon = depart.rayon !== undefined ? depart.rayon * TUILE : R.amplitudePatrouille;
  return {
    id: prochainId++,
    depart: index,
    type: depart.type, t,
    x: depart.x * TUILE, y: depart.y * TUILE - t.h,
    ancreX: depart.x * TUILE + t.w / 2,  // centre du point de depart
    ancreY: depart.y * TUILE - t.h,      // ligne de vol pour les volants
    rayon,
    w: t.w, h: t.h,
    vx: 0, vy: 0,
    sens: -1,
    pv: t.pv > 1 ? Math.max(2, Math.round(t.pv * diff.pvEnnemi)) : 1,
    pvMax: t.pv > 1 ? Math.max(2, Math.round(t.pv * diff.pvEnnemi)) : 1,
    etat: 'patrouille',                  // patrouille | alerte | charge | mort
    dort: true,                          // fige tant que Brad n'est pas proche
    auSol: false,
    minuteur: 0,
    flash: 0,
    coince: 0,
    phase: depart.x * 0.7,               // dephasage pour que tous ne bougent pas ensemble
    ecrase: 1,
    rechargeTir: 1.0,
  };
}

function reinitialiserEnnemis(complet) {
  if (complet) ennemisElimines.clear();
  prochainId = 1;
  ennemis = ENNEMIS_DEPART
    .map((d, i) => i)
    .filter(i => !ennemisElimines.has(i))
    .map(i => creerEnnemi(ENNEMIS_DEPART[i], i));
  boules.length = 0;
  ramassages.length = 0;
}

function blesserEnnemi(e, degats, sensPoussee, ignoreInvulnerabilite) {
  if (e.etat === 'mort') return;

  /* Blindage du boss. Contrairement a l'invulnerabilite du Lanceur, celle-ci
     ne se contourne pas — meme l'onde de choc rebondit. C'est la regle du
     combat : on baisse le blindage en vidant la salle, pas en tapant plus
     fort. On le dit clairement, sinon le joueur croit a un bug. */
  if (e.blinde) {
    e.flash = 0.12;
    audio.bruit('blinde');
    texteFlottant(e.x + e.w / 2, e.y, 'blindé — vide la salle !', '#78beff');
    return;
  }

  if (e.t.invulnerable && !ignoreInvulnerabilite) {
    // Le Lanceur encaisse sans broncher : on le signale au joueur au lieu de
    // le laisser croire que son coup n'a pas porte.
    e.flash = 0.12;
    audio.bruit('blinde');
    texteFlottant(e.x + e.w / 2, e.y, 'blindé !', '#9aa0bb');
    return;
  }
  e.pv -= degats;
  e.flash = 0.14;
  audio.bruit(degats >= 999 ? 'ecrase' : 'coup');
  e.vx += sensPoussee * 60;
  if (e.pv <= 0) tuerEnnemi(e);
  else {
    e.etat = 'charge';
    e.minuteur = 0;
    particules(e.x + e.w / 2, e.y + e.h / 2, 5, '#ffd6d6');
  }
}

function tuerEnnemi(e) {
  e.etat = 'mort';
  e.minuteur = 0.32;
  ennemisElimines.add(e.depart);
  particules(e.x + e.w / 2, e.y + e.h / 2, 12, '#f0a0a0');

  // Le camp d'entrainement ne rapporte RIEN : ni comptage d'ennemis, ni
  // Brad Coins. C'est ce qui l'empeche de devenir une ferme a monnaie. Le
  // Brad-Shy, lui, se remplit : on vient justement s'exercer a l'onde.
  if (!ENTRAINEMENT) partie.ennemisTotal++;

  const gain = R.gainBradShy * e.t.shy * (aPermanent('shy') ? 1.3 : 1);
  brad.shy = Math.min(100, brad.shy + gain);

  // Pieces : quantite raisonnable, un peu au hasard. Un boss paie sa taille.
  let nb = ENTRAINEMENT ? 0 : 1 + Math.floor(Math.random() * 2) + (e.t.pv > 1 ? 1 : 0);
  if (e.t.boss && !ENTRAINEMENT) nb += 12;
  if (aPermanent('chance')) nb = Math.round(nb * 1.5);
  for (let i = 0; i < nb; i++) {
    ramassages.push({
      genre: 'piece',
      x: e.x + e.w / 2 - 4, y: e.y + e.h / 2 - 4, w: 8, h: 8,
      vx: (Math.random() - 0.5) * 90, vy: -140 - Math.random() * 60,
      vie: 12, phase: Math.random() * 6,
    });
  }
  // Soin : uniquement si Brad a reellement perdu de la vie, pour qu'il reste
  // sur ses gardes quand sa barre est deja pleine (demande explicite des notes).
  if (brad.pv < brad.pvMax - 1 && Math.random() < (ENTRAINEMENT ? 0.5 : 0.28)) {
    ramassages.push({
      genre: 'soin',
      x: e.x + e.w / 2 - 5, y: e.y + e.h / 2 - 5, w: 10, h: 10,
      vx: (Math.random() - 0.5) * 50, vy: -120,
      vie: 12, phase: 0,
    });
  }
}

/* Un ennemi place au-dela du sas ne doit ni bouger ni s'afficher tant que
   Brad n'a pas franchi la frontiere. Sans ça, on apercevait la garde de la
   zone suivante par l'ouverture du sas, ce qui vendait la meche et donnait
   l'impression d'ennemis fantomes hors de portee. */
function ennemiHorsZone(e) {
  // Un boss et ses renforts n'existent que parce que Brad est deja dans
  // l'arene : les masquer par zone n'aurait aucun sens et, pire, figerait le
  // combat si l'arene partageait la zone precedente.
  if (e.estBoss || e.invoque) return false;
  return zoneDe(e.ancreX) > zoneAffichee;
}

function majEnnemis(dt) {
  const bcx = brad.x + brad.w / 2;
  const bcy = brad.y + brad.h / 2;

  for (const e of ennemis) {
    if (ennemiHorsZone(e)) continue;
    if (e.etat === 'mort') {
      e.minuteur -= dt;
      e.ecrase = Math.max(0.1, e.ecrase - dt * 3.4);
      continue;
    }

    e.flash = Math.max(0, e.flash - dt);
    e.phase += dt * (2 + Math.abs(e.vx) * 0.04);

    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const dx = bcx - ecx;
    const dy = bcy - ecy;

    /* Reveil de proximite.

       Un ennemi reste fige a son point de depart tant que Brad n'approche pas.
       Sans ça, les 28 ennemis du niveau patrouillent des le chargement : au
       moment ou le joueur arrive, ils sont ailleurs — et les volants, que rien
       n'arrete en plein ciel, ont deja quitte leur zone. */
    const loin = Math.abs(dx) > R.distanceReveil || Math.abs(dy) > 300;
    if (e.dort) {
      if (!loin) e.dort = false;
    } else if (Math.abs(dx) > R.distanceReveil * 1.9) {
      e.dort = true;
      e.etat = 'patrouille';
      e.minuteur = 0;
    }

    const portee = R.porteeDetection * (e.t.portee || 1);
    // Detection dans un disque : l'ennemi repere Brad meme de dos, comme
    // demande, mais la portee laisse la place a une approche preparee.
    const repere = !e.dort && Math.hypot(dx, dy * 1.6) < portee;

    switch (e.etat) {
      case 'patrouille':
        if (repere) { e.etat = 'alerte'; e.minuteur = R.delaiAlerte; e.vx = 0; }
        break;
      case 'alerte':
        e.minuteur -= dt;
        e.vx = 0;
        if (!repere) e.etat = 'patrouille';
        else if (e.minuteur <= 0) e.etat = 'charge';
        break;
      case 'charge':
        // On perd la trace un peu au-dela de la portee de detection, pour
        // eviter un ennemi qui s'allume et s'eteint au moindre pas de Brad.
        // Un renfort invoque, lui, ne renonce jamais : il a ete appele pour
        // attaquer, et un volant qui retournerait a sa ligne de vol pourrait
        // se poser hors d'atteinte et bloquer la phase blindee du boss.
        if (!e.invoque && Math.hypot(dx, dy * 1.6) > portee * 1.5) e.etat = 'patrouille';
        break;
    }

    if (e.t.lance) majLanceur(e, dt, dx, dy);
    else if (e.t.vole) majVolant(e, dt, dx, dy);
    else majTerrestre(e, dt, dx);

    // Un ennemi pousse dans le vide est perdu : on le retire au lieu de le
    // laisser tomber indefiniment, et on le compte comme elimine.
    if (e.y > NIVEAU_H + 80 && e.etat !== 'mort') {
      e.etat = 'mort';
      e.minuteur = 0;
      ennemisElimines.add(e.depart);
      continue;
    }
    if (e.etat !== 'mort') contactEnnemi(e, dt);
  }

  ennemis = ennemis.filter(e => !(e.etat === 'mort' && e.minuteur <= 0));

  // Au camp, la salle se repeuple : on vient repeter un geste, pas nettoyer
  // la piece. Un delai laisse le temps de souffler entre deux vagues.
  if (ENTRAINEMENT) {
    if (ennemis.length === 0) {
      delaiRepeuplement -= dt;
      if (delaiRepeuplement <= 0) { reinitialiserEnnemis(true); delaiRepeuplement = 2.5; }
    } else {
      delaiRepeuplement = 2.5;
    }
  }
}

let delaiRepeuplement = 2.5;

function majTerrestre(e, dt, dx) {
  const base = e.t.vitesse * vitesseEnnemiEffective();

  if (e.etat === 'charge') e.sens = Math.sign(dx) || e.sens;

  // Le bord se decide AVANT le deplacement. Le tester apres ne sert a rien :
  // la vitesse serait de toute façon recalculee a l'image suivante, et
  // l'ennemi franchirait le vide malgre le garde-fou.
  const bloque = e.auSol ? gererBord(e) : false;

  if (e.coince > 0) {
    e.coince -= dt;                        // decoincement, voir contactEnnemi()
    e.vx = -e.sens * base * 1.6;
  } else if (e.dort || bloque || e.etat === 'alerte') {
    e.vx = 0;
  } else if (e.etat === 'charge') {
    e.vx = e.sens * base * R.gainCharge;
  } else {
    e.vx = e.sens * base;
  }

  e.vy = Math.min(R.chuteMax, e.vy + R.gravite * dt);

  // Deplacement horizontal
  e.x += e.vx * dt;
  for (const s of solides) {
    if (!chevauche(e, s)) continue;
    e.x = e.vx > 0 ? s.x - e.w : s.x + s.w;
    e.sens = -e.sens;
    e.vx = 0;
  }

  // Deplacement vertical
  const basAvant = e.y + e.h;
  e.y += e.vy * dt;
  let auSol = false;
  for (const s of solides) {
    if (!chevauche(e, s)) continue;
    if (e.vy > 0) { e.y = s.y - e.h; auSol = true; }
    else e.y = s.y + s.h;
    e.vy = 0;
  }
  for (const p of traversantes) {
    if (e.vy > 0 && chevauche(e, p) && basAvant <= p.y + 1) {
      e.y = p.y - e.h; e.vy = 0; auSol = true;
    }
  }

  e.auSol = auSol;
}

/* Que fait un ennemi arrive au bord d'un trou ?

   En patrouille, il fait demi-tour. En charge, il ne se jette PAS dans le vide :
   il s'arrete au bord en continuant de fixer Brad. C'est volontaire — un ennemi
   qui se suicide en poursuivant le joueur se lit comme un bug, et surtout ça
   donne au trou une valeur de level design : il devient une zone sure d'ou le
   joueur peut observer et preparer son approche.

   Seul le coureur fait exception : s'il voit du sol de l'autre cote et que le
   trou est franchissable, il saute. C'est ce qui le rend reellement menaçant
   par rapport au Serra de base. */
function gererBord(e) {
  const ligne = e.y + e.h;
  const cx = e.x + e.w / 2;

  // Borne de patrouille : demi-tour avant de s'eloigner du point de depart.
  // Ne s'applique pas en charge — un ennemi qui abandonne la poursuite en
  // plein elan aurait l'air de bugger.
  if (e.etat === 'patrouille') {
    if (e.sens > 0 && cx > e.ancreX + e.rayon) { e.sens = -1; return false; }
    if (e.sens < 0 && cx < e.ancreX - e.rayon) { e.sens = 1; return false; }
  }

  const devant = e.sens > 0 ? e.x + e.w + 3 : e.x - 3;
  // Tolerance d'une marche : un decrochement d'une tuile se descend au lieu
  // d'etre traite comme un precipice. C'est ce qui permet au Lourd de suivre
  // un escalier plutot que de faire la navette en haut.
  if (solSousOuDessous(devant, ligne, TUILE + 6)) return false;

  if (e.etat === 'patrouille') { e.sens = -e.sens; return false; }

  if (e.t.saute && OPTIONS.sautEnnemi && atterrissagePossible(e, ligne)) {
    e.vy = -SAUT_ENNEMI;
    return false;
  }
  return true;              // en charge : il s'arrete net au bord
}

/* Y a-t-il du sol atteignable de l'autre cote ? On balaie devant l'ennemi
   jusqu'a la distance qu'il accepte de tenter. */
function atterrissagePossible(e, ligne) {
  for (let d = TUILE; d <= PORTEE_SAUT_ENNEMI; d += 8) {
    if (solSous(e.x + e.w / 2 + e.sens * d, ligne)) return true;
  }
  return false;
}

/* Le volant est le seul ennemi que le decor n'arrete pas : ni sol, ni mur, ni
   bord de plateforme. Sa zone doit donc etre imposee explicitement, et elle
   l'est en DERNIER, apres tous les deplacements — y compris la poursuite. */
function majVolant(e, dt, dx, dy) {
  const base = e.t.vitesse * vitesseEnnemiEffective();
  const gauche = e.ancreX - e.rayon;
  const droite = e.ancreX + e.rayon;
  const flottement = e.ancreY + Math.sin(e.phase * 0.9) * 8;

  if (e.dort) {
    // Endormi : retour tranquille au point de depart, puis surplace. Le joueur
    // qui revient sur ses pas retrouve donc les volants la ou il les a laisses.
    const vise = e.ancreX - e.w / 2;
    e.x += Math.max(-base, Math.min(base, (vise - e.x) * 3)) * dt;
    e.y += (flottement - e.y) * Math.min(1, 3 * dt);
    e.vx = 0;
    return;
  }

  if (e.etat === 'charge') {
    const d = Math.hypot(dx, dy) || 1;
    e.sens = Math.sign(dx) || e.sens;
    e.x += (dx / d) * base * R.gainCharge * dt;
    e.y += (dy / d) * base * R.gainCharge * dt;
    e.vx = (dx / d) * base * R.gainCharge;
  } else if (e.etat === 'alerte') {
    e.y += (flottement - e.y) * Math.min(1, 6 * dt);
    e.vx = 0;
  } else {
    const cx = e.x + e.w / 2;
    if (e.sens > 0 && cx > droite) e.sens = -1;
    else if (e.sens < 0 && cx < gauche) e.sens = 1;
    e.x += e.sens * base * dt;
    e.y += (flottement - e.y) * Math.min(1, 6 * dt);
    e.vx = e.sens * base;
    for (const s of solides) {
      if (chevauche(e, s)) { e.sens = -e.sens; e.x += e.sens * 4; break; }
    }
  }

  // Laisse d'attache. Une poursuite peut deborder un peu de la zone, jamais la
  // quitter : c'est cette borne qui manquait.
  const marge = 100;
  e.x = Math.max(gauche - marge - e.w / 2, Math.min(droite + marge - e.w / 2, e.x));
  e.y = Math.max(e.ancreY - 90, Math.min(e.ancreY + 120, e.y));
}

function majLanceur(e, dt, dx, dy) {
  if (!e.dort) e.sens = Math.sign(dx) || e.sens;
  e.vy = Math.min(R.chuteMax, e.vy + R.gravite * dt);
  e.y += e.vy * dt;
  for (const s of solides) {
    if (!chevauche(e, s)) continue;
    if (e.vy > 0) e.y = s.y - e.h;
    e.vy = 0;
  }

  if (e.dort || e.etat !== 'charge') return;
  e.rechargeTir -= dt;
  if (e.rechargeTir > 0) return;
  e.rechargeTir = e.t.cadence;

  // Tir en cloche vers la position actuelle de Brad.
  const dist = Math.abs(dx);
  boules.push({
    x: e.x + e.w / 2 - 7, y: e.y + 4, w: 14, h: 14,
    vx: e.sens * Math.min(240, 110 + dist * 0.55),
    vy: -190 - Math.min(120, Math.abs(dy)),
    aBrad: false, vie: 8, phase: 0, posee: 0,
  });
}

/* Contact ennemi / Brad : ecrasement, degats, et garde-fou anti-blocage.

   Les notes signalent explicitement le risque qu'un ennemi reste coince sous
   Brad quand le joueur rate son saut. On le traite en deux temps : tout
   contact avec degats repousse les deux corps, et un chevauchement qui dure
   force l'ennemi a s'ecarter. */
/* Brad se tient sur la tete d'un ennemi-plateforme.

   C'est la reponse au blocage signale sur le Serra-Lourd. L'ancienne version
   le faisait rebondir : coince entre le Lourd et une marche d'escalier, il
   retombait dessus et rebondissait a l'infini. Faire du Lourd un sol solide
   supprime la boucle et transforme le probleme en outil — il devient une
   marche mobile pour atteindre ce qu'il y a au-dessus. */
function poserBradSur(e) {
  brad.y = e.y - brad.h;
  brad.vy = 0;
  brad.auSol = true;
  brad.coyote = R.coyote;              // il peut sauter depuis cette tete
  brad.sautsRestants = OPTIONS.doubleSaut ? 1 : 0;
  brad.porteur = e;                    // consomme par majBrad a l'image suivante
}

function contactEnnemi(e, dt) {
  // Cas « pose dessus » teste en premier, avec une tolerance de quelques
  // pixels : une fois Brad exactement pose, les boites ne se chevauchent plus
  // et le test de collision ordinaire ne le verrait plus.
  if (e.t.plateforme && brad.vy >= -1 &&
      brad.x + brad.w > e.x + 3 && brad.x < e.x + e.w - 3 &&
      (brad.y + brad.h) >= e.y - 5 && (brad.y + brad.h) <= e.y + e.h * 0.5) {
    poserBradSur(e);
    e.coince = 0;
    return;
  }

  if (!chevauche(brad, e)) { e.coince = Math.max(0, e.coince - dt); return; }

  // Brad ecrase l'ennemi s'il TOMBAIT et se trouvait au-dessus de sa moitie
  // haute juste avant la resolution des collisions.
  const dessus = brad.vyAvant > 40 && brad.basAvant <= e.y + e.h * 0.55;

  if (dessus) {
    if (e.t.ecrasable) {
      blesserEnnemi(e, 999, brad.sens, true);
      // Maintenir le bouton de saut donne un rebond plus haut : de quoi
      // enchainer plusieurs ennemis a la suite.
      brad.vy = -R.forceSaut * (entrees.saut ? Math.min(1, R.rebond + 0.28) : R.rebond);
      brad.sautEnCours = entrees.saut;
      brad.etirement = 1.2;
      secousse(3, 0.12);
      audio.bruit('ecrase');
    } else if (e.t.plateforme) {
      poserBradSur(e);
    } else {
      // Blinde : Brad rebondit sans degat de part et d'autre. Le court repit
      // qui suit est indispensable — sans lui, Brad retomberait aussitot sur
      // l'ennemi et encaisserait un coup qui ressemblerait a un bug.
      brad.vy = -R.forceSaut * 0.5;
      brad.vx = Math.sign(brad.x + brad.w / 2 - (e.x + e.w / 2)) * 120 || 120;
      brad.invincible = Math.max(brad.invincible, 0.4);
      e.flash = 0.1;
      audio.bruit('blinde');
      texteFlottant(e.x + e.w / 2, e.y, 'blindé !', '#9aa0bb');
    }
    return;
  }

  if (brad.invincible <= 0) {
    blesserBrad(e.t.degats, e.x + e.w / 2, e.type);
    e.vx = -Math.sign(brad.x - e.x) * 90;
  } else {
    // Deja invincible et toujours en contact : on decoince l'ennemi.
    e.coince += dt;
    if (e.coince > 0.25) { e.sens = -Math.sign(brad.x + brad.w / 2 - (e.x + e.w / 2)) || 1; }
  }
}

/* -----------------------------------------------------------------------------
   3. BOULES DE SERRANO
   Comportement retenu (Roadmap) : le Lanceur est invulnerable aux attaques de
   Brad. Sa boule, une fois esquivee, reste au sol un temps limite ; Brad peut
   la ramasser et la renvoyer, ce qui elimine le Lanceur en un seul coup.
-------------------------------------------------------------------------- */

const boules = [];

function majBoules(dt) {
  for (const b of boules) {
    b.vie -= dt;
    b.phase += dt * 8;

    if (b.posee > 0) { b.posee -= dt; continue; }

    // Le tir de l'ennemi decrit une cloche ; le renvoi de Brad part droit
    // devant lui. Une trajectoire tendue et previsible fait du renvoi une
    // vraie riposte plutot qu'un pari sur l'angle.
    b.vy = Math.min(R.chuteMax, b.vy + R.gravite * (b.aBrad ? 0 : 0.85) * dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    let pose = false;
    for (const s of solides) {
      if (!chevauche(b, s)) continue;
      if (b.aBrad) { b.vie = 0; particules(b.x + 7, b.y + 7, 8, '#f0a0a0'); break; }
      if (b.vy > 0) { b.y = s.y - b.h; pose = true; }
      else if (b.vy < 0) b.y = s.y + s.h;
      b.vx = 0; b.vy = 0;
    }
    if (b.vie <= 0) continue;
    if (pose) { b.posee = 6; b.vie = Math.min(b.vie, 6); }

    if (b.aBrad) {
      // Boule renvoyee : elle traverse et elimine ce qu'elle touche, Lanceur compris.
      for (const e of ennemis) {
        if (e.etat === 'mort' || !chevauche(b, e)) continue;
        blesserEnnemi(e, 999, Math.sign(b.vx) || 1, true);
        b.vie = 0;
        break;
      }
    } else if (chevauche(b, brad) && brad.invincible <= 0) {
      blesserBrad(1, b.x + b.w / 2, 'Serra-Lanceur');
      b.vie = 0;
    }
  }

  // Ramassage : Brad prend la boule posee sur laquelle il marche.
  if (!brad.porte) {
    for (const b of boules) {
      if (b.posee <= 0 || b.vie <= 0 || !chevauche(b, brad)) continue;
      brad.porte = true;
      b.vie = 0;
      texteFlottant(brad.x + brad.w / 2, brad.y, 'boule ramassée', '#f0a0a0');
      break;
    }
  }

  for (let i = boules.length - 1; i >= 0; i--) if (boules[i].vie <= 0) boules.splice(i, 1);
}

function lancerBoule() {
  brad.porte = null;
  brad.recharge = R.recharge;
  audio.bruit('coup');
  boules.push({
    x: brad.x + brad.w / 2 - 7 + brad.sens * 12, y: brad.y + 14, w: 14, h: 14,
    vx: brad.sens * 340, vy: 0,
    aBrad: true, vie: 1.6, phase: 0, posee: 0,
  });
  texteFlottant(brad.x + brad.w / 2, brad.y - 4, 'renvoyée !', '#f0a0a0');
}

/* -----------------------------------------------------------------------------
   4. RAMASSAGES (pieces et soins)
-------------------------------------------------------------------------- */

const ramassages = [];

function majRamassages(dt) {
  for (const r of ramassages) {
    r.vie -= dt;
    r.phase += dt * 7;
    r.vy = Math.min(500, r.vy + R.gravite * 0.9 * dt);
    r.x += r.vx * dt;
    r.y += r.vy * dt;

    for (const s of solides) {
      if (!chevauche(r, s)) continue;
      if (r.vy > 0) { r.y = s.y - r.h; r.vy = 0; r.vx *= 0.5; }
      else r.vy = 0;
    }

    // Petit aimant : sous 40 px (80 avec le bonus permanent), l'objet vient a
    // Brad. Evite les ramassages rates au pixel pres.
    const portee = aPermanent('aimant') ? 82 : 40;
    const dx = (brad.x + brad.w / 2) - (r.x + r.w / 2);
    const dy = (brad.y + brad.h / 2) - (r.y + r.h / 2);
    const d = Math.hypot(dx, dy);
    if (d < portee) { r.x += (dx / d) * 190 * dt; r.y += (dy / d) * 190 * dt; }

    if (chevauche(r, brad)) {
      if (r.genre === 'objet') {
        prendreObjet(r.objet);
      } else if (r.genre === 'piece') {
        brad.pieces++;
        audio.bruit('piece');
        texteFlottant(brad.x + brad.w / 2, brad.y - 4, '+1 BC', '#e8b62c', 'BC');
      } else {
        brad.pv = Math.min(brad.pvMax, brad.pv + 1);
        audio.bruit('soin');
        texteFlottant(brad.x + brad.w / 2, brad.y - 16, '+1 PV', '#7ee08a', 'PV');
      }
      r.vie = 0;
    }
  }
  for (let i = ramassages.length - 1; i >= 0; i--) if (ramassages[i].vie <= 0) ramassages.splice(i, 1);
}

/* -----------------------------------------------------------------------------
   5. EFFETS
-------------------------------------------------------------------------- */

const effets = [];
const secousseEtat = { force: 0, t: 0 };

function secousse(force, duree) {
  secousseEtat.force = Math.max(secousseEtat.force, force);
  secousseEtat.t = Math.max(secousseEtat.t, duree);
}

function particules(x, y, n, couleur) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 110;
    effets.push({
      genre: 'particule', x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
      t: 0, duree: 0.3 + Math.random() * 0.25, couleur,
    });
  }
}

/* Textes flottants.

   Deux gains simultanes (une piece et un soin, tres frequent quand un ennemi
   meurt) s'affichaient exactement au meme endroit et devenaient illisibles.
   On traite le probleme dans les deux sens :

   - meme libelle repete -> on cumule dans le texte deja present (+2 BC) ;
   - libelles differents  -> on empile le nouveau au-dessus des precedents.

   `cumul` est l'unite affichee ('BC', 'PV'...). Sans elle, aucun cumul. */
function texteFlottant(x, y, texte, couleur, cumul) {
  if (cumul) {
    for (const f of effets) {
      if (f.genre !== 'texte' || f.cumul !== cumul) continue;
      if (f.t > 0.55 || Math.abs(f.x - x) > 46) continue;
      f.n++;
      f.texte = '+' + f.n + ' ' + cumul;
      f.t = 0;                      // relance l'animation, le gain reste visible
      return;
    }
  }

  // Empilement : on remonte tant qu'un autre texte recent occupe la place.
  let dy = 0;
  for (let garde = 0; garde < 6; garde++) {
    const occupe = effets.some(f => f.genre === 'texte' && f.t < 0.5 &&
      Math.abs(f.x - x) < 48 && Math.abs(f.y - (y + dy)) < 12);
    if (!occupe) break;
    dy -= 12;
  }

  effets.push({ genre: 'texte', x, y: y + dy, texte, couleur, t: 0, duree: 0.85, cumul, n: 1 });
}

function majEffets(dt) {
  for (const f of effets) {
    f.t += dt;
    if (f.genre === 'particule') {
      f.vy += 420 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    } else if (f.genre === 'texte') {
      f.y -= 26 * dt;
    } else if (f.genre === 'onde') {
      f.r = f.rMax * Math.min(1, f.t / f.duree);
    }
  }
  for (let i = effets.length - 1; i >= 0; i--) if (effets[i].t >= effets[i].duree) effets.splice(i, 1);

  if (secousseEtat.t > 0) {
    secousseEtat.t -= dt;
    if (secousseEtat.t <= 0) secousseEtat.force = 0;
  }
}
