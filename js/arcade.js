/* =============================================================================
   BRAD BITT, MAIS LE JEU — SERRA INVADERS

   Le mini-jeu de la borne du hub : un Invaders remixe a la sauce Brad Bitt.
   Brad tient la ligne du bas et renvoie des boules de Serrano sur une grille
   de Serra qui descend. Les notes demandaient de s'inspirer d'un jeu connu
   pour ne rien avoir a expliquer au joueur — c'est exactement le but.

   Les regles maison :
     * les Serra-Lourd du dernier rang encaissent trois boules ;
     * les Serra-Volant traversent l'ecran en diagonale et valent double ;
     * les Lanceurs ripostent, il faut esquiver ;
     * 100 points = 1 Brad Coin, et la limite de 3 parties par jour vient de
       la sauvegarde (sinon la borne serait une machine a BC).
   ========================================================================== */
'use strict';

const ARC = {
  hautGrille: 58,
  basLimite: 262,        // si un Serra descend plus bas, la partie s'arrete
  joueurY: 300,
  pasDescente: 12,
  cadenceTir: 0.34,
  ptsParBC: 100,
};

const arcade = {
  etat: 'accueil',       // accueil | jeu | fini
  brad: null,
  serras: [],
  tirs: [],
  ripostes: [],
  particules: [],
  score: 0,
  vies: 3,
  vague: 1,
  recharge: 0,
  sens: 1,
  vitesse: 26,
  descendre: false,
  minuteurVolant: 5,
  volants: [],
  t: 0,
  bcGagnes: 0,
  message: '',
};

function ouvrirArcade() {
  arcade.etat = 'accueil';
  arcade.score = 0;
  arcade.bcGagnes = 0;
  scene = 'arcade';
}

function demarrerArcade() {
  if (partiesArcadeRestantes() <= 0) {
    audio.bruit('refus');
    braddyDit('La borne chauffe. Reviens demain, elle aura refroidi.');
    return;
  }
  consommerPartieArcade();
  arcade.etat = 'jeu';
  arcade.brad = { x: LARGEUR / 2 - 14, w: 28, h: 26, vx: 0, invincible: 0 };
  arcade.score = 0;
  arcade.vies = 3;
  arcade.vague = 1;
  arcade.bcGagnes = 0;
  arcade.tirs.length = 0;
  arcade.ripostes.length = 0;
  arcade.particules.length = 0;
  arcade.volants.length = 0;
  arcade.t = 0;
  composerVague();
  audio.bruit('valider');
}

function composerVague() {
  arcade.serras.length = 0;
  const cols = 8, rangs = 4;
  const l = 46, h = 34;
  const x0 = (LARGEUR - cols * l) / 2 + 6;
  for (let r = 0; r < rangs; r++) {
    for (let c = 0; c < cols; c++) {
      // Le rang du fond est blinde, celui du milieu riposte.
      const type = r === 0 ? 'Serra-Lourd' : (r === 1 ? 'Serra-Lanceur' : 'Serra');
      arcade.serras.push({
        x: x0 + c * l, y: ARC.hautGrille + r * h,
        w: 26, h: 26, type,
        pv: type === 'Serra-Lourd' ? 3 : 1,
        vivant: true, flash: 0,
      });
    }
  }
  arcade.sens = 1;
  arcade.vitesse = 26 + (arcade.vague - 1) * 9;
  arcade.minuteurVolant = 4;
}

/* -----------------------------------------------------------------------------
   SIMULATION
-------------------------------------------------------------------------- */

function majArcade(dt) {
  arcade.t += dt;
  if (arcade.etat !== 'jeu') return;

  const b = arcade.brad;
  const dir = (entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0);
  b.x += dir * 210 * dt;
  b.x = Math.max(14, Math.min(LARGEUR - 14 - b.w, b.x));
  if (b.invincible > 0) b.invincible -= dt;

  // Tir
  arcade.recharge -= dt;
  if ((entrees.attaque || entrees.saut) && arcade.recharge <= 0) {
    arcade.recharge = ARC.cadenceTir;
    arcade.tirs.push({ x: b.x + b.w / 2 - 5, y: ARC.joueurY - 12, w: 10, h: 10, phase: 0 });
    audio.bruit('coup');
  }

  // Deplacement de la grille : elle glisse, touche un bord, descend d'un cran.
  const vivants = arcade.serras.filter(s => s.vivant);
  if (vivants.length) {
    const acceleration = 1 + (1 - vivants.length / arcade.serras.length) * 2.2;
    let bordAtteint = false;
    for (const s of vivants) {
      s.x += arcade.sens * arcade.vitesse * acceleration * dt;
      if (s.x < 12 || s.x + s.w > LARGEUR - 12) bordAtteint = true;
      s.flash = Math.max(0, s.flash - dt);
    }
    if (bordAtteint) {
      arcade.sens *= -1;
      for (const s of vivants) {
        s.y += ARC.pasDescente;
        s.x += arcade.sens * 6;
      }
      audio.bruit('menu');
    }
    // Riposte des Lanceurs
    if (Math.random() < dt * (0.55 + arcade.vague * 0.2)) {
      const tireurs = vivants.filter(s => s.type === 'Serra-Lanceur');
      const s = tireurs.length ? tireurs[Math.floor(Math.random() * tireurs.length)]
                               : vivants[Math.floor(Math.random() * vivants.length)];
      arcade.ripostes.push({ x: s.x + s.w / 2 - 5, y: s.y + s.h, w: 10, h: 10, phase: 0 });
    }
    // Defaite si la grille atteint le bas
    if (vivants.some(s => s.y + s.h >= ARC.basLimite)) finirArcade('Ils sont passés.');
  } else {
    arcade.vague++;
    arcade.score += 50;
    composerVague();
    audio.bruit('victoire');
  }

  // Volants de passage : cibles rapides, deux fois plus de points.
  arcade.minuteurVolant -= dt;
  if (arcade.minuteurVolant <= 0) {
    arcade.minuteurVolant = 6 + Math.random() * 6;
    const gauche = Math.random() < 0.5;
    arcade.volants.push({
      x: gauche ? -30 : LARGEUR + 30, y: 40 + Math.random() * 14,
      w: 26, h: 22, vx: (gauche ? 1 : -1) * (95 + arcade.vague * 12),
      phase: 0, vivant: true,
    });
  }
  for (const v of arcade.volants) {
    v.x += v.vx * dt;
    v.phase += dt * 5;
    v.y += Math.sin(v.phase) * 22 * dt;
  }
  arcade.volants = arcade.volants.filter(v => v.vivant && v.x > -60 && v.x < LARGEUR + 60);

  // Tirs du joueur
  for (const t of arcade.tirs) { t.y -= 330 * dt; t.phase += dt * 12; }
  for (const t of arcade.tirs) {
    if (t.y < -12) { t.mort = true; continue; }
    for (const s of vivants) {
      if (!s.vivant || !chevauche(t, s)) continue;
      t.mort = true;
      s.pv--;
      s.flash = 0.12;
      if (s.pv <= 0) {
        s.vivant = false;
        arcade.score += s.type === 'Serra-Lourd' ? 30 : (s.type === 'Serra-Lanceur' ? 20 : 10);
        bouffeeArcade(s.x + s.w / 2, s.y + s.h / 2, '#f0a0a0');
        audio.bruit('ecrase');
      } else {
        audio.bruit('blinde');
      }
      break;
    }
    if (t.mort) continue;
    for (const v of arcade.volants) {
      if (!v.vivant || !chevauche(t, v)) continue;
      t.mort = true; v.vivant = false;
      arcade.score += 40;
      bouffeeArcade(v.x + v.w / 2, v.y + v.h / 2, '#ffd6a0');
      audio.bruit('piece');
      break;
    }
  }
  arcade.tirs = arcade.tirs.filter(t => !t.mort);

  // Ripostes
  for (const r of arcade.ripostes) { r.y += 190 * dt; r.phase += dt * 9; }
  const zoneJoueur = { x: b.x, y: ARC.joueurY - 20, w: b.w, h: 26 };
  for (const r of arcade.ripostes) {
    if (r.y > HAUTEUR) { r.mort = true; continue; }
    if (b.invincible <= 0 && chevauche(r, zoneJoueur)) {
      r.mort = true;
      arcade.vies--;
      b.invincible = 1.4;
      bouffeeArcade(b.x + b.w / 2, ARC.joueurY - 10, '#ff8080');
      audio.bruit('degat');
      secousse(5, 0.2);
      if (arcade.vies <= 0) finirArcade('Brad a pris trop de Serrano.');
    }
  }
  arcade.ripostes = arcade.ripostes.filter(r => !r.mort);

  for (const p of arcade.particules) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
  }
  arcade.particules = arcade.particules.filter(p => p.t < p.duree);
}

function bouffeeArcade(x, y, couleur) {
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 110;
    arcade.particules.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      t: 0, duree: 0.35 + Math.random() * 0.2, couleur,
    });
  }
}

function finirArcade(raison) {
  arcade.etat = 'fini';
  arcade.message = raison;
  arcade.bcGagnes = Math.floor(arcade.score / ARC.ptsParBC);
  if (arcade.bcGagnes > 0) partie.pieces += arcade.bcGagnes;
  if (arcade.score > partie.meilleurArcade) partie.meilleurArcade = arcade.score;
  enregistrerPartie();
  audio.bruit('mort');
}

/* -----------------------------------------------------------------------------
   RENDU
-------------------------------------------------------------------------- */

function dessinerArcade() {
  // Cadre de borne : on joue DANS la machine, pas en plein ecran.
  ctx.fillStyle = '#07090f';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  const g = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  g.addColorStop(0, '#0d1220'); g.addColorStop(1, '#141020');
  ctx.fillStyle = g;
  ctx.fillRect(8, 8, LARGEUR - 16, HAUTEUR - 16);

  // Lignes de balayage, pour l'ecran cathodique
  ctx.fillStyle = 'rgba(255,255,255,.022)';
  for (let y = 8; y < HAUTEUR - 8; y += 3) ctx.fillRect(8, y, LARGEUR - 16, 1);

  if (arcade.etat === 'accueil') { dessinerArcadeAccueil(); return; }

  // Ligne de defense
  ctx.fillStyle = 'rgba(226,85,59,.3)';
  ctx.fillRect(12, ARC.basLimite, LARGEUR - 24, 1);

  for (const s of arcade.serras) {
    if (!s.vivant) continue;
    const img = sprites[s.type];
    const cx = Math.round(s.x + s.w / 2), bas = Math.round(s.y + s.h);
    if (img) {
      const ech = s.w / img.width;
      ctx.save();
      ctx.translate(cx, bas);
      ctx.scale(ech * (s.type === 'Serra' ? -1 : 1), ech);
      const source = s.flash > 0 ? silhouette(img) : img;
      ctx.drawImage(source, -img.width / 2, -img.height);
      ctx.restore();
    } else {
      ctx.fillStyle = '#c9564f';
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    if (s.type === 'Serra-Lourd' && s.pv < 3) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(cx - 11, s.y - 5, 22, 3);
      ctx.fillStyle = ACCENT; ctx.fillRect(cx - 10, s.y - 4, 20 * (s.pv / 3), 1);
    }
  }

  for (const v of arcade.volants) {
    const img = sprites['Serra-Volant'];
    if (!img) continue;
    const ech = v.w / img.width;
    ctx.save();
    ctx.translate(Math.round(v.x + v.w / 2), Math.round(v.y + v.h));
    ctx.scale(ech * (v.vx > 0 ? -1 : 1), ech);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  // Brad, vu de face, simplifie : c'est un jeu dans le jeu.
  const b = arcade.brad;
  if (b && !(b.invincible > 0 && Math.floor(b.invincible * 14) % 2 === 0)) {
    const x = Math.round(b.x), y = ARC.joueurY - 4;
    ctx.fillStyle = '#191b26'; ctx.fillRect(x, y - 18, b.w, 18);
    ctx.fillStyle = '#eceef6'; ctx.fillRect(x + b.w / 2 - 4, y - 18, 8, 11);
    ctx.fillStyle = '#d0453f'; ctx.fillRect(x + b.w / 2 - 2, y - 17, 4, 9);
    ctx.fillStyle = '#e8b98f'; ctx.fillRect(x + b.w / 2 - 7, y - 30, 14, 12);
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + b.w / 2 - 8, y - 32, 16, 5);
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(x + b.w / 2 - 4, y - 26, 2, 3);
    ctx.fillRect(x + b.w / 2 + 2, y - 26, 2, 3);
  }

  for (const t of arcade.tirs) dessinerBoule(Math.round(t.x), Math.round(t.y), t.phase);
  for (const r of arcade.ripostes) {
    ctx.fillStyle = '#e2553b';
    ctx.fillRect(Math.round(r.x + 2), Math.round(r.y), 6, 10);
    ctx.fillStyle = 'rgba(255,190,150,.7)';
    ctx.fillRect(Math.round(r.x + 3), Math.round(r.y + 2), 2, 5);
  }
  for (const p of arcade.particules) {
    ctx.globalAlpha = 1 - p.t / p.duree;
    ctx.fillStyle = p.couleur;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    ctx.globalAlpha = 1;
  }

  hudArcade();
  if (arcade.etat === 'fini') dessinerArcadeFin();
}

function dessinerArcadeAccueil() {
  const restantes = partiesArcadeRestantes();

  texteCentre('SERRA INVADERS', 92, 'bold 30px system-ui, sans-serif', '#e8b62c');
  texteCentre('une production BRADDY3000', 114, 'italic 10px system-ui, sans-serif',
              'rgba(255,255,255,.35)');

  const lignes = [
    '← →  se déplacer          X ou Espace  tirer',
    'Le rang du fond encaisse trois boules.',
    'Les volants valent le double. Les lanceurs ripostent.',
    ARC.ptsParBC + ' points = 1 Brad Coin.',
  ];
  lignes.forEach((l, i) =>
    texteCentre(l, 152 + i * 17, '11px system-ui, sans-serif', 'rgba(255,255,255,.6)'));

  texteCentre('Meilleur score : ' + partie.meilleurArcade, 238,
              '11px system-ui, sans-serif', 'rgba(255,255,255,.45)');

  const l = 190, h = 36, x = (LARGEUR - l) / 2, y = 256;
  const dispo = restantes > 0;
  const survol = souris.survol && souris.survol.action === 'arcade-start';
  ctx.fillStyle = !dispo ? 'rgba(255,255,255,.04)'
                : (survol ? 'rgba(232,182,44,.25)' : 'rgba(255,255,255,.07)');
  ctx.fillRect(x, y, l, h);
  ctx.strokeStyle = dispo ? 'rgba(232,182,44,.6)' : 'rgba(255,255,255,.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, l - 2, h - 2);
  texteCentre(dispo ? 'INSÉRER UN JETON' : 'BORNE EN SURCHAUFFE', y + 24,
              'bold 14px system-ui, sans-serif', dispo ? '#ffe9a8' : 'rgba(255,255,255,.3)');
  if (dispo) zone(x, y, l, h, 'arcade-start');

  texteCentre(dispo ? restantes + ' partie' + (restantes > 1 ? 's' : '') + ' restante' +
                      (restantes > 1 ? 's' : '') + ' aujourd\'hui'
                    : 'Reviens demain — 3 parties par jour, c\'est la règle du BRADDY3000',
              y + 52, '10px system-ui, sans-serif', 'rgba(255,255,255,.4)');

  /* Le bouton « Sortir ». Son etiquette est dessinee SUR LUI : texteCentre()
     l'aurait posee au milieu de l'ecran, a 224 px de sa zone cliquable. */
  const bx = LARGEUR - 96, by = HAUTEUR - 40, bl = 56, bh = 22;
  const survolS = souris.survol && souris.survol.action === 'fermer-poste';
  ctx.fillStyle = survolS ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)';
  ctx.fillRect(bx, by, bl, bh);
  ctx.strokeStyle = survolS ? 'rgba(232,182,44,.7)' : 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + .5, by + .5, bl - 1, bh - 1);
  texteCentreEn('Sortir', bx + bl / 2, by + 15, '11px system-ui, sans-serif',
                survolS ? '#ffe9a8' : 'rgba(255,255,255,.75)');
  zone(bx, by, bl, bh, 'fermer-poste');
}

function hudArcade() {
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = ACCENT;
  ctx.fillText('SCORE ' + String(arcade.score).padStart(5, '0'), 18, 30);

  ctx.textAlign = 'center';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillText('VAGUE ' + arcade.vague, LARGEUR / 2, 30);

  ctx.textAlign = 'right';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < arcade.vies ? '#d0453f' : 'rgba(255,255,255,.14)';
    ctx.fillRect(LARGEUR - 26 - i * 13, 20, 9, 11);
  }
  ctx.textAlign = 'left';
}

function dessinerArcadeFin() {
  ctx.fillStyle = 'rgba(7,9,15,.86)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  texteCentre('GAME OVER', 108, 'bold 30px system-ui, sans-serif', '#e2553b');
  texteCentre(arcade.message, 134, 'italic 11px system-ui, sans-serif', 'rgba(255,255,255,.5)');
  texteCentre('Score : ' + arcade.score, 172, 'bold 17px system-ui, sans-serif', '#e6e8f0');
  texteCentre(arcade.bcGagnes > 0
                ? '+' + arcade.bcGagnes + ' Brad Coin' + (arcade.bcGagnes > 1 ? 's' : '')
                : 'Pas assez pour un Brad Coin. ' + ARC.ptsParBC + ' points, c\'est le seuil.',
              196, '12px system-ui, sans-serif', arcade.bcGagnes > 0 ? ACCENT : 'rgba(255,255,255,.45)');
  if (arcade.score >= partie.meilleurArcade && arcade.score > 0) {
    texteCentre('Nouveau record', 216, '10px system-ui, sans-serif', '#7ee08a');
  }

  const restantes = partiesArcadeRestantes();
  const l = 140, h = 30, y = 248;
  const boutons = [
    { nom: restantes > 0 ? 'Rejouer (' + restantes + ')' : 'Plus de jetons',
      action: restantes > 0 ? 'arcade-start' : null, x: LARGEUR / 2 - l - 8 },
    { nom: 'Sortir', action: 'fermer-poste', x: LARGEUR / 2 + 8 },
  ];
  for (const b of boutons) {
    const survol = b.action && souris.survol && souris.survol.action === b.action;
    ctx.fillStyle = !b.action ? 'rgba(255,255,255,.03)'
                  : (survol ? 'rgba(232,182,44,.22)' : 'rgba(255,255,255,.07)');
    ctx.fillRect(b.x, y, l, h);
    ctx.strokeStyle = b.action ? 'rgba(232,182,44,.45)' : 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + .5, y + .5, l - 1, h - 1);
    // Chaque etiquette sur SON bouton. Avec texteCentre(), les deux mots se
    // superposaient au milieu de l'ecran et aucun n'etait sur sa zone.
    texteCentreEn(b.nom, b.x + l / 2, y + 20, '12px system-ui, sans-serif',
                  b.action ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.25)');
    if (b.action) zone(b.x, y, l, h, b.action);
  }
  ctx.textAlign = 'left';
}
