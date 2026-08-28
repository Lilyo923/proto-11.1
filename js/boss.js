/* =============================================================================
   BRAD BITT, MAIS LE JEU — arenes et boss

   Tous les trois niveaux, une piece de l'appareil a raclette est gardee par un
   boss. Le principe demande dans les notes :

     « un Serra-Lourd faisant plus de degats avec plus de vie, ou pendant un
       moment il est blinde et il faut eliminer les autres ennemis aux alentours
       pour pouvoir de nouveau lui faire des degats »

   D'ou la structure du combat. Le boss a trois tranches de vie. A chaque
   tranche entamee il se blinde et appelle une vague de sbires : tant qu'il en
   reste un debout, les coups portes au boss rebondissent. La vague nettoyee,
   son blindage tombe et il repart, plus rapide et plus nerveux qu'avant.

   C'est ce qui evite le boss-sac-a-PV : le joueur ne gagne pas en tapant plus
   fort, il gagne en gerant la salle.

   L'arene est declaree dans le fichier du niveau (champ `arene`), jamais ici :
   ce fichier tient les regles, les niveaux tiennent la mise en scene.
   ========================================================================== */
'use strict';

/* Fractions de vie restantes auxquelles le boss se blinde. Trois seuils, donc
   trois vagues, donc quatre passages a l'attaque pour le joueur. */
const SEUILS_BLINDAGE = [0.72, 0.45, 0.2];

const arene = {
  active: false,        // Brad est entre, le combat a commence
  finie: false,         // le boss est tombe
  boss: null,           // l'ennemi boss, tant qu'il vit
  blinde: false,
  vague: 0,             // combien de vagues ont deja ete appelees
  sbires: [],           // les renforts encore en vie
  tempsBlinde: 0,       // duree de la phase blindee en cours (filet anti-blocage)
  banniere: 0,          // duree restante du bandeau d'annonce
  message: '',
  messageT: 0,
  objetLache: false,
  secousseFin: 0,
  trampolines: [],      // {x, y, w, h, compression}
};

function reinitialiserArene() {
  arene.active = false;
  arene.finie = false;
  arene.boss = null;
  arene.blinde = false;
  arene.vague = 0;
  arene.sbires = [];
  arene.tempsBlinde = 0;
  arene.banniere = 0;
  arene.message = '';
  arene.messageT = 0;
  arene.objetLache = false;
  arene.secousseFin = 0;
  arene.trampolines = ARENE ? ARENE.trampolines.map(t => ({
    x: t.x, y: t.y, w: t.w, h: 10, compression: 0,
  })) : [];
}

/* La sortie du niveau reste verrouillee tant qu'un boss vit encore : un niveau
   a boss ne se contourne pas en courant vers la porte. */
function porteVerrouillee() {
  return !!ARENE && !arene.finie;
}

/* Brad est mort et le moteur vient de reconstruire la liste des ennemis a
   partir du decor : ni le boss ni ses renforts n'y figurent. Deux cas.

   - Combat non gagne : on remet l'arene a zero, le boss reapparaitra quand
     Brad refranchira la ligne d'entree.
   - Combat deja gagne : on n'y touche pas, sinon le boss ressusciterait. Mais
     si la piece etait tombee sans avoir ete ramassee, elle vient d'etre
     effacee avec le reste : on la repose, sans quoi elle serait perdue pour
     toujours et l'objet du niveau deviendrait inatteignable. */
function rejouerArene() {
  if (!ARENE) return;
  if (!arene.finie) { reinitialiserArene(); return; }

  const o = ARENE.objet ? OBJETS_MAJEURS.find(x => x.cle === ARENE.objet) : null;
  if (!o || aObjet(o.cle)) return;
  if (ramassages.some(r => r.genre === 'objet')) return;
  const dep = ARENE.depart;
  ramassages.push({
    genre: 'objet', objet: o.cle,
    x: dep.x - 9, y: dep.y - 40, w: 18, h: 18,
    vx: 0, vy: 0, vie: 9999, phase: 0,
  });
}

/* Les invocations n'ont pas d'index dans ENNEMIS_DEPART : on leur en donne un
   negatif, unique, qui ne heurtera jamais celui d'un ennemi du decor. Les
   ensembles d'ennemis elimines s'en accommodent, et reinitialiserEnnemis() ne
   parcourt que les indices positifs. */
let prochainIndexInvoque = -1;

function invoquer(type, xPx, yPx) {
  const e = creerEnnemi({ type, x: xPx / TUILE, y: yPx / TUILE }, prochainIndexInvoque--);
  e.dort = false;                 // un renfort appele est deja reveille
  e.etat = 'charge';
  e.invoque = true;
  ennemis.push(e);
  particules(xPx, yPx - e.h / 2, 10, '#ffd0a0');
  return e;
}

function annoncerArene(texte, duree) {
  arene.message = texte;
  arene.messageT = duree || 2.6;
}

/* -----------------------------------------------------------------------------
   DEROULEMENT DU COMBAT
-------------------------------------------------------------------------- */

function majArene(dt) {
  if (!ARENE) return;

  if (arene.messageT > 0) arene.messageT -= dt;
  if (arene.banniere > 0) arene.banniere -= dt;
  if (arene.secousseFin > 0) arene.secousseFin -= dt;

  // --- Declenchement : Brad franchit la ligne d'entree ---------------------
  if (!arene.active && !arene.finie) {
    if (brad.x + brad.w / 2 > ARENE.x1) declencherArene();
    return;
  }
  if (!arene.active) return;

  // --- Le boss est tombe ---------------------------------------------------
  if (!arene.boss || arene.boss.etat === 'mort') {
    if (!arene.finie) terminerArene();
    return;
  }

  const b = arene.boss;

  // --- Gestion du blindage -------------------------------------------------
  if (arene.blinde) {
    arene.tempsBlinde += dt;
    // Un sbire tombe au fond d'un trou disparait de `ennemis` : on filtre sur
    // la presence reelle, pas sur un compteur, sinon le blindage ne tombe
    // jamais et le combat se bloque.
    arene.sbires = arene.sbires.filter(s => s.etat !== 'mort' && ennemis.indexOf(s) >= 0);

    /* Filet de securite. Le blindage ne tombe normalement qu'une fois la salle
       vide — c'est la regle du combat. Mais un seul renfort devenu inatteignable
       (coince derriere un decor, parti trop haut) transformerait le combat en
       attente infinie, sans meme un ecran de mort pour en sortir. Passe une
       demi-minute, on rend donc la main au joueur. Aucune partie normale
       n'atteint ce delai : les vagues se nettoient en une dizaine de secondes. */
    const secours = arene.tempsBlinde > 30;

    if (arene.sbires.length === 0 || secours) {
      arene.blinde = false;
      b.blinde = false;
      b.enrage = arene.vague;                  // il accelere a chaque vague
      audio.bruit('victoire');
      annoncerArene(secours ? 'SON BLINDAGE LÂCHE TOUT SEUL' : 'BLINDAGE TOMBÉ — FRAPPE !', 2.2);
      particules(b.x + b.w / 2, b.y + b.h / 2, 26, '#ffe9a8');
      secousse(6, 0.3);
    }
  } else if (arene.vague < SEUILS_BLINDAGE.length &&
             b.pv <= b.pvMax * SEUILS_BLINDAGE[arene.vague]) {
    lancerVague();
  }

  // Le boss reste dans sa salle : rien ne l'oblige a poursuivre Brad dehors,
  // et le voir sortir de l'arene casserait la scene.
  const cx = b.x + b.w / 2;
  if (cx < ARENE.x1 + 20) { b.x = ARENE.x1 + 20 - b.w / 2; b.sens = 1; }
  if (cx > ARENE.x2 - 20) { b.x = ARENE.x2 - 20 - b.w / 2; b.sens = -1; }

  degagerDuBoss(b);
}

/* -----------------------------------------------------------------------------
   NE PAS RESTER COINCE SUR LE BOSS

   Le Serra-Colosse est large et haut. Un Brad qui retombe dessus se retrouvait
   pose sur son crane, hors de portee de ses propres coups, pousse contre un mur
   de l'arene — et ne pouvait qu'attendre de mourir. Ce n'est pas une punition,
   c'est une impasse.

   Des qu'il se retrouve au-dessus, on l'ejecte : vers le centre de la salle
   s'il est dans un coin, sinon du cote oppose au boss. Et surtout, ce contact
   ne lui coute AUCUN degat — se cogner au sommet d'un boss n'est pas une faute
   de jeu, c'est le decor qui manque de place.
-------------------------------------------------------------------------- */
function degagerDuBoss(b) {
  if (b.etat === 'mort') return;

  const auDessus = brad.y + brad.h <= b.y + 18;
  const chevauchement = brad.x + brad.w > b.x + 2 && brad.x < b.x + b.w - 2 &&
                        brad.y + brad.h > b.y - 4 && brad.y < b.y + b.h;
  if (!auDessus || !chevauchement) return;

  const centreSalle = (ARENE.x1 + ARENE.x2) / 2;
  const bcx = brad.x + brad.w / 2;
  // Vers le centre de la salle, jamais vers le mur le plus proche.
  const sens = bcx < centreSalle ? 1 : -1;

  brad.x += sens * 6;
  brad.vx = sens * 260;
  brad.vy = -R.forceSaut * 0.72;         // un rebond franc, pas une chute molle
  brad.auSol = false;
  brad.invincible = Math.max(brad.invincible, 0.35);
  audio.bruit('saut');
  particules(bcx, brad.y + brad.h, 8, '#ffe9a8');
}

function declencherArene() {
  arene.active = true;
  // La musique du mini-boss remplace celle du niveau, et repart en fondu
  // court : le combat commence, on ne laisse pas trainer l'ambiance.
  if (ARENE.musique) audio.jouerMusiqueDifferee(sourceMusique(ARENE.musique), 0.6);
  arene.banniere = 3.2;
  const dep = ARENE.depart;
  arene.boss = creerEnnemi(
    { type: ARENE.boss, x: dep.x / TUILE, y: dep.y / TUILE }, prochainIndexInvoque--);
  arene.boss.dort = false;
  arene.boss.estBoss = true;
  ennemis.push(arene.boss);
  audio.bruit('porte');
  secousse(9, 0.5);
  annoncerArene(ARENE.nom, 3.2);
}

function lancerVague() {
  const vague = ARENE.renforts[Math.min(arene.vague, ARENE.renforts.length - 1)] || [];
  arene.vague++;
  arene.blinde = true;
  arene.tempsBlinde = 0;
  arene.boss.blinde = true;
  arene.sbires = vague.map(r => invoquer(r.type, r.x, r.y));
  audio.bruit('blinde');
  secousse(7, 0.4);
  annoncerArene('IL SE BLINDE — NETTOIE LA SALLE', 3.0);

  // Cas limite : une vague vide (ou un niveau mal decrit) laisserait le boss
  // blinde pour toujours. On refuse ce blocage tout de suite.
  if (arene.sbires.length === 0) {
    arene.blinde = false;
    arene.boss.blinde = false;
  }
}

function terminerArene() {
  arene.finie = true;
  if (ARENE.musique && AUDIO_NIVEAU) audio.jouerMusiqueDifferee(AUDIO_NIVEAU, 1.6);
  arene.active = false;
  arene.secousseFin = 1.2;
  secousse(12, 0.8);
  audio.bruit('victoire');

  if (partie.bossVaincus.indexOf(niveauCourant) < 0 && !ENTRAINEMENT) {
    partie.bossVaincus.push(niveauCourant);
    enregistrerPartie();
  }

  // La piece tombe au sol, a ramasser : la voir apparaitre et aller la
  // chercher vaut mieux que de la recevoir dans un ecran de bilan.
  const o = ARENE.objet ? OBJETS_MAJEURS.find(x => x.cle === ARENE.objet) : null;
  if (o && !aObjet(o.cle)) {
    const dep = ARENE.depart;
    ramassages.push({
      genre: 'objet', objet: o.cle,
      x: dep.x - 9, y: dep.y - 40, w: 18, h: 18,
      vx: 0, vy: -180,
      vie: 9999, phase: 0,
    });
    arene.objetLache = true;
    annoncerArene('IL A LÂCHÉ QUELQUE CHOSE', 3.4);
  } else {
    annoncerArene('LA SORTIE S\'OUVRE', 2.8);
  }
}

/* La piece ramassee pendant ce niveau, en attente d'etre commentee au retour
   a la base. Le BRADDY3000 doit parler de l'evenement, pas debiter sa phrase
   de mission habituelle. */
let objetFraisRamasse = null;

/* -----------------------------------------------------------------------------
   LES TRAMPOLINES DE L'ARENE

   Ils sont la pour une raison precise : sans eux, un joueur accule dans un
   coin par le boss n'avait plus aucune sortie. Le Colosse est plus large que
   Brad et le repousse contre le mur ; il n'y avait ni la place de le contourner
   ni la hauteur de lui passer par-dessus. Le combat se terminait par une mort
   qui ne devait rien au niveau de jeu.

   Chaque coin en a donc un. Il propulse Brad par-dessus le boss et lui rend
   l'initiative, sans lui donner de degats gratuits : on retombe derriere, il
   faut encore frapper.

   Appele depuis majBrad(), apres le deplacement vertical.
-------------------------------------------------------------------------- */

const IMPULSION_TRAMPOLINE = 1.55;      // multiplie la force de saut

function majTrampolines(dt) {
  for (const t of arene.trampolines) {
    if (t.compression > 0) t.compression = Math.max(0, t.compression - dt * 4);

    const dessus = brad.x + brad.w > t.x && brad.x < t.x + t.w &&
                   brad.y + brad.h >= t.y - 2 && brad.y + brad.h <= t.y + t.h + 6 &&
                   brad.vy >= 0;
    if (!dessus) continue;

    brad.y = t.y - brad.h;
    brad.vy = -R.forceSaut * IMPULSION_TRAMPOLINE;
    brad.rebond = 0.5;              // gravite normale pendant la montee
    brad.auSol = false;
    brad.etirement = 1.35;
    t.compression = 1;
    audio.bruit('saut');
    particules(brad.x + brad.w / 2, t.y, 8, '#7ee08a');
  }
}

function dessinerTrampolines() {
  for (const t of arene.trampolines) {
    const x = Math.round(t.x - cam.x);
    const y = Math.round(t.y - cam.y + t.compression * 5);
    if (x > LARGEUR + 40 || x + t.w < -40) continue;

    // Pieds
    ctx.fillStyle = '#2b2f3c';
    ctx.fillRect(x + 2, y + 6, 4, 14);
    ctx.fillRect(x + t.w - 6, y + 6, 4, 14);
    // Toile, qui s'enfonce quand on rebondit
    ctx.fillStyle = '#4a8f5c';
    ctx.fillRect(x, y, t.w, 6);
    ctx.fillStyle = '#7ee08a';
    ctx.fillRect(x, y, t.w, 2);
    // Ressorts
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 3; k++) {
      const sx = x + 4 + k * ((t.w - 8) / 3);
      ctx.beginPath(); ctx.moveTo(sx, y + 6); ctx.lineTo(sx, y + 14); ctx.stroke();
    }
    // Fleche vers le haut : le role de l'objet doit se lire sans notice.
    const a = 0.35 + 0.3 * Math.sin(performance.now() / 300);
    ctx.fillStyle = 'rgba(126,224,138,' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(x + t.w / 2, y - 16);
    ctx.lineTo(x + t.w / 2 - 6, y - 8);
    ctx.lineTo(x + t.w / 2 + 6, y - 8);
    ctx.closePath();
    ctx.fill();
  }
}

/* Appele par majRamassages() quand Brad touche une piece. */
function prendreObjet(cle) {
  const o = OBJETS_MAJEURS.find(x => x.cle === cle);
  if (!o) return;
  const nouveau = ramasserObjet(cle);
  audio.bruit('victoire');
  texteFlottant(brad.x + brad.w / 2, brad.y - 6, o.nom, '#e8b62c');
  annoncerArene(o.nom.toUpperCase(), 4.0);
  arene.messageT = 4.0;
  particules(brad.x + brad.w / 2, brad.y + brad.h / 2, 22, '#ffe9a8');
  if (nouveau) objetFraisRamasse = cle;
}

/* Consomme le drapeau : la replique speciale ne se dit qu'une fois. */
function prendreRepliqueObjet() {
  if (!objetFraisRamasse) return null;
  const t = repliqueObjetRapporte(objetFraisRamasse);
  objetFraisRamasse = null;
  return t;
}

/* -----------------------------------------------------------------------------
   RENDU
-------------------------------------------------------------------------- */

/* Les murs de la salle, dessines dans le repere du monde (appele depuis le
   rendu du niveau, camera deja appliquee). */
function dessinerArene() {
  if (!ARENE) return;
  const y0 = ARENE.sol;

  for (const x of [ARENE.x1, ARENE.x2]) {
    const dedans = x === ARENE.x1 ? 1 : -1;
    // Un montant de porte, ferme pendant le combat, ouvert apres.
    const ferme = arene.active;
    ctx.fillStyle = ferme ? 'rgba(200,70,60,.5)' : 'rgba(120,130,160,.28)';
    ctx.fillRect(x - 3, y0 - 132, 6, 132);
    ctx.fillStyle = ferme ? 'rgba(255,150,120,.75)' : 'rgba(170,180,210,.4)';
    ctx.fillRect(x - 3, y0 - 132, 6, 6);
    if (ferme) {
      // Barreaux : on voit tout de suite qu'on ne repart pas par la.
      ctx.fillStyle = 'rgba(220,110,90,.35)';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x - 3 + dedans * (i * 5 + 4), y0 - 128, 3, 124);
      }
    }
  }
}

/* -----------------------------------------------------------------------------
   LES TROIS PIECES, DESSINEES

   En primitives, comme les cadenas : ce sont des objets uniques, ils doivent
   avoir exactement la meme tete au sol, dans la vitrine de la base et dans une
   bulle de dialogue. Un emoji de raclette n'existe pas, et un asset de plus
   pour trois icones ne se justifie pas.

   (cx, cy) est le CENTRE. `echelle` vaut 1 pour la taille de reference (18 px),
   `halo` ajoute l'aureole clignotante de l'objet pose au sol.
-------------------------------------------------------------------------- */

function dessinerObjetMajeur(cx, cy, cle, echelle, halo) {
  const e = echelle || 1;
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));

  if (halo) {
    const t = performance.now() / 1000;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 4);
    ctx.fillStyle = '#e8b62c';
    ctx.beginPath();
    ctx.arc(0, 0, 13 * e, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(0, Math.sin(t * 2.4) * 2 * e);
  }
  ctx.scale(e, e);

  if (cle === 'poelon') {
    // Un poelon : coupelle ovale, manche noir.
    ctx.fillStyle = '#2b2f3c';
    ctx.fillRect(2, -1, 11, 2.5);                 // manche
    ctx.fillStyle = '#8d939f';
    ctx.beginPath(); ctx.ellipse(-3, 0, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c3c9d6';
    ctx.beginPath(); ctx.ellipse(-3, -1, 6.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0d98a';                    // un reste de fromage
    ctx.beginPath(); ctx.ellipse(-3, -0.5, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();

  } else if (cle === 'garniture') {
    // Une meule entamee et deux tranches de charcuterie.
    ctx.fillStyle = '#c9a23c';
    ctx.fillRect(-9, -6, 11, 9);
    ctx.fillStyle = '#f0d98a';
    ctx.fillRect(-9, -6, 11, 2.5);
    ctx.fillStyle = '#a8842c';                    // les trous
    ctx.fillRect(-6, -2, 2, 2); ctx.fillRect(-2.5, 0.5, 2, 2);
    ctx.fillStyle = '#b4564f';
    ctx.beginPath(); ctx.arc(5, 1, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8f3f3c';
    ctx.beginPath(); ctx.arc(5, 1, 4.5, 0.4, 2.2); ctx.fill();
    ctx.fillStyle = '#e0a6a0';
    ctx.beginPath(); ctx.arc(3.6, -0.4, 1.1, 0, Math.PI * 2); ctx.fill();

  } else {
    // L'appareil : socle, resistance rouge, plateau.
    ctx.fillStyle = '#3a4055';
    ctx.fillRect(-10, 1, 20, 5);
    ctx.fillStyle = '#565f7d';
    ctx.fillRect(-10, -1, 20, 2.5);
    ctx.fillStyle = '#d8483c';                    // la resistance
    ctx.fillRect(-8, -3.5, 16, 2);
    ctx.fillStyle = '#8d939f';
    ctx.fillRect(-11, -8, 22, 3);                 // plateau superieur
    ctx.fillStyle = '#c3c9d6';
    ctx.fillRect(-11, -8, 22, 1.2);
    ctx.fillStyle = '#2b2f3c';
    ctx.fillRect(-12, 6, 3, 2); ctx.fillRect(9, 6, 3, 2);
  }

  ctx.restore();
}

/* Aureole de blindage autour du boss. Dessinee apres le sprite, dans le
   repere ecran. */
function dessinerBlindage(cx, bas, e) {
  if (!e.blinde) return;
  const t = performance.now() / 1000;
  const r = e.w * 0.9 + Math.sin(t * 5) * 3;
  ctx.save();
  ctx.translate(cx, bas - e.h / 2);
  ctx.strokeStyle = 'rgba(120,190,255,' + (0.5 + 0.25 * Math.sin(t * 5)).toFixed(2) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.6;
    const px = Math.cos(a) * r, py = Math.sin(a) * r * 1.25;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/* Barre de vie du boss et bandeaux, dessines par-dessus tout, en repere
   ecran. */
function hudArene() {
  if (!ARENE) return;
  const b = arene.boss;

  if (arene.active && b && b.etat !== 'mort') {
    const l = 300, x = (LARGEUR - l) / 2, y = 30;
    ctx.fillStyle = 'rgba(9,11,20,.7)';
    ctx.fillRect(x - 3, y - 15, l + 6, 26);

    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = arene.blinde ? '#78beff' : '#e8b62c';
    ctx.fillText(ARENE.nom, x, y - 5);

    if (arene.blinde) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#78beff';
      ctx.fillText('BLINDÉ · ' + arene.sbires.length + ' restant' +
                   (arene.sbires.length > 1 ? 's' : ''), x + l, y - 5);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(x, y, l, 7);
    const f = Math.max(0, b.pv / b.pvMax);
    ctx.fillStyle = arene.blinde ? '#4a86c8' : '#d8483c';
    ctx.fillRect(x, y, Math.round(l * f), 7);
    // Reperes des seuils : le joueur voit venir la prochaine vague.
    ctx.fillStyle = 'rgba(9,11,20,.75)';
    for (const s of SEUILS_BLINDAGE) ctx.fillRect(x + Math.round(l * s), y, 2, 7);
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, y + .5, l - 1, 6);
  }

  if (arene.messageT > 0) {
    const a = Math.min(1, arene.messageT * 1.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(9,11,20,.72)';
    const w = ctx.measureText(arene.message).width + 30;
    ctx.fillRect((LARGEUR - w) / 2, 68, w, 28);
    ctx.fillStyle = arene.blinde ? '#78beff' : '#e8b62c';
    ctx.fillText(arene.message, LARGEUR / 2, 88);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
