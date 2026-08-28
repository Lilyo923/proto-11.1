/* =============================================================================
   BRAD BITT, MAIS LE JEU — camera, rendu, interface et boucle principale
   ========================================================================== */
'use strict';

/* -----------------------------------------------------------------------------
   1. CAMERA
   Suivi horizontal souple avec anticipation ; suivi vertical seulement
   au-dela d'une zone morte, les notes demandant une camera peu mobile.
-------------------------------------------------------------------------- */

const cam = { x: 0, y: 0, anticipation: 0 };

function majCamera(dt) {
  const ratio = Math.max(-1, Math.min(1, brad.vx / Math.max(R.vitesseCourse, 1)));
  cam.anticipation += (ratio * R.camAnticipation - cam.anticipation) * Math.min(1, 3 * dt);

  const cibleX = brad.x + brad.w / 2 + cam.anticipation - LARGEUR / 2;
  cam.x += (cibleX - cam.x) * Math.min(1, R.camSouplesse * dt);

  const centreY = brad.y + brad.h / 2;
  const hautZone = cam.y + HAUTEUR / 2 - R.camZoneY;
  const basZone = cam.y + HAUTEUR / 2 + R.camZoneY;
  let cibleY = cam.y;
  if (centreY < hautZone) cibleY = cam.y - (hautZone - centreY);
  else if (centreY > basZone) cibleY = cam.y + (centreY - basZone);
  cam.y += (cibleY - cam.y) * Math.min(1, R.camSouplesse * 0.7 * dt);

  cam.x = Math.max(0, Math.min(NIVEAU_L - LARGEUR, cam.x));
  cam.y = Math.max(0, Math.min(NIVEAU_H - HAUTEUR, cam.y));
}

/* -----------------------------------------------------------------------------
   2. TRANSITION DE DECOR
   Les notes demandent un changement de decor A L'INTERIEUR d'un niveau, sans
   recharger la page ni changer de fichier : « le niveau 1 où Brad va dans une
   grotte, c'est toujours le niveau 1 ». La geometrie reste donc continue —
   seul le fondu au noir masque la bascule de palette.
-------------------------------------------------------------------------- */

const transition = { actif: false, t: 0, duree: 1.0, vers: 0 };
let zoneAffichee = 0;

function majTransition(dt) {
  if (transition.actif) {
    transition.t += dt;
    // La palette bascule quand l'ecran est completement noir.
    if (transition.t >= transition.duree / 2) zoneAffichee = transition.vers;
    if (transition.t >= transition.duree) transition.actif = false;
    return;
  }
  const z = zoneDe(brad.x + brad.w / 2);
  if (z !== zoneAffichee) {
    transition.actif = true;
    transition.t = 0;
    transition.vers = z;
    audio.bruit('transition');
  }
}

function palette() { return ZONES[zoneAffichee]; }

function dessinerFonduTransition() {
  if (!transition.actif) return;
  const p = transition.t / transition.duree;
  // Monte a 1 a mi-parcours, puis redescend.
  const a = 1 - Math.abs(p - 0.5) * 2;
  ctx.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  if (a > 0.55) {
    ctx.globalAlpha = (a - 0.55) / 0.45;
    texteCentre(ZONES[transition.vers].nom, HAUTEUR / 2 + 4,
                '13px system-ui, sans-serif', 'rgba(232,182,44,.9)');
    ctx.globalAlpha = 1;
  }
}

/* -----------------------------------------------------------------------------
   3. SILHOUETTES BLANCHES
   Utilisees pour le flash de degat. Construites une seule fois par image, sans
   lecture de pixels : la page reste utilisable en file:// (un canvas nourri
   par une image locale est « teinte » et refuse getImageData).
-------------------------------------------------------------------------- */

const cacheSilhouettes = new Map();

function silhouette(img) {
  if (cacheSilhouettes.has(img)) return cacheSilhouettes.get(img);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  cacheSilhouettes.set(img, c);
  return c;
}

/* -----------------------------------------------------------------------------
   4. RENDU DU DECOR
-------------------------------------------------------------------------- */

const ACCENT = '#e8b62c';

function fond() {
  const z = palette();
  const grad = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  grad.addColorStop(0, z.cielHaut);
  grad.addColorStop(1, z.cielBas);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  switch (z.silhouettes) {
    case 'tours':
      dessinerTours(0.2, 250, z.loin);
      dessinerTours(0.4, 288, z.pres);
      break;
    case 'tournesols':
      dessinerCollines(0.18, 244, 58, z.loin);
      dessinerTournesols(0.42, 300, z.pres);
      break;
    case 'stalactites':
      dessinerStalactites(0.22, z.loin);
      dessinerCollines(0.45, 300, 40, z.pres);
      break;
    case 'immeubles':
      dessinerImmeubles(0.16, 272, z.loin, false);
      dessinerImmeubles(0.38, 300, z.pres, true);
      break;
    case 'cour':
      dessinerImmeubles(0.14, 236, z.loin, false);
      dessinerCour(0.4, 300, z.pres);
      break;
    case 'vallee':
      dessinerMontagnes(0.14, 250, z.loin);
      dessinerForet(0.4, 302, z.pres);
      break;
    case 'bosquet':
      dessinerForet(0.2, 268, z.loin);
      dessinerChampignons(0.44, 302, z.pres);
      break;
    case 'arene':
      dessinerMontagnes(0.1, 230, z.loin);
      dessinerMenhirs(0.34, 300, z.pres);
      break;
    default:
      dessinerTuyaux(0.22, z.loin);
      dessinerCollines(0.42, 292, 46, z.pres);
  }
}

/* Niveau 1 : un champ de tournesols. Les tiges sont indexees sur le monde,
   comme les tours, pour que le champ ne bouge jamais tout seul. */
function dessinerTournesols(facteur, baseY, couleur) {
  for (const { idx, x } of rangeeDeFond(facteur, 42)) {
    const h = 54 + (((idx * 29) % 7) * 9);
    const balancement = Math.sin(performance.now() / 1400 + idx * 0.7) * 3;
    // tige
    ctx.fillStyle = couleur;
    ctx.fillRect(x + 8, baseY - h, 4, h);
    // feuille
    ctx.fillRect(x + 1, baseY - h * 0.55, 8, 4);
    ctx.fillRect(x + 11, baseY - h * 0.75, 8, 4);
    // fleur
    const fx = Math.round(x + 10 + balancement), fy = Math.round(baseY - h - 5);
    ctx.fillStyle = 'rgba(226,182,58,.85)';
    ctx.fillRect(fx - 8, fy - 4, 16, 10);
    ctx.fillRect(fx - 5, fy - 8, 10, 18);
    ctx.fillStyle = 'rgba(94,62,30,.9)';
    ctx.fillRect(fx - 3, fy - 2, 7, 7);
  }
}

/* -----------------------------------------------------------------------------
   NIVEAU 2 — la ville, en ete

   Deux rangees d'immeubles bas. `fenetres` allume une partie des carreaux : on
   ne le fait que sur la rangee proche, sinon le fond scintille de partout et
   l'oeil ne sait plus ou se poser.
-------------------------------------------------------------------------- */

function dessinerImmeubles(facteur, baseY, couleur, fenetres) {
  const motif = [74, 116, 52, 142, 90, 64, 128, 100];
  for (const { idx, x } of rangeeDeFond(facteur, 88)) {
    const i = ((idx % motif.length) + motif.length) % motif.length;
    const h = motif[i];
    ctx.fillStyle = couleur;
    ctx.fillRect(x, baseY - h, 72, h + HAUTEUR);
    // Toit : une bordure claire suffit a decoller le bloc du ciel.
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.fillRect(x, baseY - h, 72, 3);
    // Reservoir d'eau sur un toit sur trois : le detail qui fait « ville ».
    if (i % 3 === 0) {
      ctx.fillStyle = couleur;
      ctx.fillRect(x + 46, baseY - h - 14, 16, 14);
      ctx.fillRect(x + 48, baseY - h - 18, 12, 4);
    }
    if (!fenetres) continue;
    /* ATTENTION — bug de photosensibilite corrige ici.

       La version precedente tirait l'etat de chaque fenetre de sa position a
       l'ECRAN (`fx`). Or `fx` change a chaque pixel de defilement : le meme
       carreau se rallumait et s'eteignait plusieurs fois par seconde des que
       Brad marchait. Toute la façade clignotait — desagreable, et franchement
       risque pour une personne photosensible.

       L'etat depend maintenant du numero de l'immeuble et du rang de la
       fenetre DANS cet immeuble. Ces deux nombres ne bougent jamais : une
       fenetre allumee le reste, quoi qu'il arrive a la camera. */
    let rang = 0;
    for (let fy = baseY - h + 12; fy < baseY - 12; fy += 20, rang++) {
      let col = 0;
      for (let fx = x + 8; fx < x + 64; fx += 18, col++) {
        const allume = (((idx * 31 + col * 7 + rang * 13) % 11) + 11) % 11 < 4;
        ctx.fillStyle = allume ? 'rgba(255,214,140,.5)' : 'rgba(0,0,0,.24)';
        ctx.fillRect(fx, fy, 10, 12);
      }
    }
  }
}

/* Niveau 2, zone 2 : l'arriere-cour. Grillage, cordes a linge, poubelles. */
function dessinerCour(facteur, baseY, couleur) {
  for (const { idx, x } of rangeeDeFond(facteur, 104)) {
    // Le mur du fond
    ctx.fillStyle = couleur;
    ctx.fillRect(x, baseY - 96, 96, 96 + HAUTEUR);
    // Grillage : une trame reguliere, tres discrete.
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 96; g += 12) {
      ctx.beginPath();
      ctx.moveTo(x + g, baseY - 96); ctx.lineTo(x + g + 12, baseY);
      ctx.moveTo(x + g + 12, baseY - 96); ctx.lineTo(x + g, baseY);
      ctx.stroke();
    }
    // Corde a linge, avec le linge qui bouge un peu.
    const yl = baseY - 104 - ((idx * 19) % 3) * 12;
    ctx.strokeStyle = 'rgba(255,255,255,.13)';
    ctx.beginPath(); ctx.moveTo(x, yl); ctx.lineTo(x + 104, yl + 6); ctx.stroke();
    const couleurs = ['rgba(210,110,100,.4)', 'rgba(110,150,200,.4)', 'rgba(220,200,120,.4)'];
    for (let k = 0; k < 3; k++) {
      const lx = x + 18 + k * 28;
      const souffle = Math.sin(performance.now() / 900 + idx + k) * 2;
      ctx.fillStyle = couleurs[(idx + k) % 3];
      ctx.fillRect(Math.round(lx + souffle), Math.round(yl + k * 2), 14, 20);
    }
    // Poubelles au pied du mur
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(x + 12, baseY - 20, 14, 20);
    ctx.fillRect(x + 30, baseY - 16, 12, 16);
  }
}

/* -----------------------------------------------------------------------------
   NIVEAU 3 — la vallee enchantee
-------------------------------------------------------------------------- */

function dessinerMontagnes(facteur, baseY, couleur) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(-200, HAUTEUR);
  for (const { idx, x } of rangeeDeFond(facteur, 190)) {
    const h = 96 + (((idx * 37) % 5) * 26);
    ctx.lineTo(x, baseY);
    ctx.lineTo(x + 95, baseY - h);
    ctx.lineTo(x + 190, baseY);
  }
  ctx.lineTo(LARGEUR + 200, HAUTEUR);
  ctx.closePath();
  ctx.fill();
  // Neige sur les sommets les plus hauts.
  for (const { idx, x } of rangeeDeFond(facteur, 190)) {
    const h = 96 + (((idx * 37) % 5) * 26);
    if (h < 148) continue;
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.moveTo(x + 95, baseY - h);
    ctx.lineTo(x + 76, baseY - h + 30);
    ctx.lineTo(x + 114, baseY - h + 30);
    ctx.closePath();
    ctx.fill();
  }
}

/* Une foret de conifères. Les lucioles ne sont dessinees qu'ici : c'est ce qui
   dit « enchantee » sans avoir a l'ecrire sur un panneau. */
function dessinerForet(facteur, baseY, couleur) {
  for (const { idx, x } of rangeeDeFond(facteur, 46)) {
    const h = 66 + ((idx * 23) % 6) * 12;
    ctx.fillStyle = 'rgba(60,42,30,.5)';
    ctx.fillRect(x + 14, baseY - 16, 6, 16);
    ctx.fillStyle = couleur;
    for (let e = 0; e < 3; e++) {
      const ey = baseY - 14 - e * (h / 3.6);
      const l = 30 - e * 7;
      ctx.beginPath();
      ctx.moveTo(x + 17, ey - h / 2.6);
      ctx.lineTo(x + 17 - l, ey);
      ctx.lineTo(x + 17 + l, ey);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const { idx, x } of rangeeDeFond(facteur * 1.5, 118)) {
    const t = performance.now() / 1000;
    const ly = 140 + ((idx * 41) % 6) * 26 + Math.sin(t * 1.1 + idx) * 9;
    const lx = x + Math.cos(t * 0.8 + idx * 2) * 12;
    const eclat = 0.3 + 0.35 * Math.sin(t * 3 + idx);
    ctx.fillStyle = 'rgba(190,255,190,' + Math.max(0, eclat).toFixed(2) + ')';
    ctx.fillRect(Math.round(lx), Math.round(ly), 3, 3);
  }
}

/* Zone 2 : le bosquet profond, avec de grands champignons. */
function dessinerChampignons(facteur, baseY, couleur) {
  for (const { idx, x } of rangeeDeFond(facteur, 76)) {
    const h = 40 + ((idx * 29) % 4) * 18;
    const l = 22 + ((idx * 13) % 3) * 7;
    ctx.fillStyle = 'rgba(230,225,235,.22)';
    ctx.fillRect(x + 16 - 4, baseY - h, 8, h);
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.ellipse(x + 16, baseY - h, l, l * 0.62, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.arc(x + 16 - l * 0.4, baseY - h - 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 16 + l * 0.3, baseY - h - 12, 4, 0, Math.PI * 2); ctx.fill();
  }
}

/* Zone 3 : l'arene. Un cercle de menhirs, pour que le lieu se lise tout de
   suite comme « ici, on se bat ». */
function dessinerMenhirs(facteur, baseY, couleur) {
  for (const { idx, x } of rangeeDeFond(facteur, 82)) {
    const h = 82 + ((idx * 31) % 4) * 22;
    const l = 22 + ((idx * 17) % 3) * 6;
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(x + 4, baseY);
    ctx.lineTo(x + 10, baseY - h);
    ctx.lineTo(x + 10 + l, baseY - h + 8);
    ctx.lineTo(x + 8 + l, baseY);
    ctx.closePath();
    ctx.fill();
    // Gravure lumineuse : elle bat lentement, comme une veilleuse.
    const p = 0.18 + 0.14 * Math.sin(performance.now() / 700 + idx);
    ctx.fillStyle = 'rgba(180,140,255,' + p.toFixed(2) + ')';
    ctx.fillRect(x + 12, baseY - h + 26, l - 6, 4);
    ctx.fillRect(x + 12, baseY - h + 42, l - 12, 4);
  }
}

/* Niveau 1, zone 2 : la grotte. Stalactites au plafond, stalagmites au sol. */
function dessinerStalactites(facteur, couleur) {
  ctx.fillStyle = couleur;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  for (const { idx, x } of rangeeDeFond(facteur, 54)) {
    const h = 26 + ((idx * 17) % 5) * 13;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 22, 0); ctx.lineTo(x + 11, h);
    ctx.closePath(); ctx.fill();
    const hb = 18 + ((idx * 23) % 4) * 11;
    ctx.beginPath();
    ctx.moveTo(x + 27, 300); ctx.lineTo(x + 45, 300); ctx.lineTo(x + 36, 300 - hb);
    ctx.closePath(); ctx.fill();
  }
  // Quelques cristaux qui accrochent la lumiere
  for (const { idx, x } of rangeeDeFond(facteur * 1.4, 130)) {
    const y = 150 + ((idx * 31) % 5) * 22;
    const brille = 0.25 + 0.25 * Math.sin(performance.now() / 900 + idx);
    ctx.fillStyle = 'rgba(150,120,220,' + brille.toFixed(2) + ')';
    ctx.fillRect(x, y, 4, 10);
    ctx.fillRect(x + 6, y + 5, 3, 7);
  }
}

/* Toutes les couches de decor partagent le meme principe de defilement.

   Le motif est indexe sur une position ABSOLUE dans le monde, jamais sur la
   position de l'element a l'ecran. C'etait la cause des sautes de decor : en
   numerotant les elements a partir du bord gauche de l'ecran, chaque bouclage
   du motif decalait toute la rangee d'un cran, et les tours changeaient de
   hauteur d'un coup. Avec un index absolu, une tour donnee garde sa hauteur
   du debut a la fin du niveau.

   Renvoie, pour chaque element visible, son index absolu et son abscisse. */
function rangeeDeFond(facteur, pas) {
  const defilement = cam.x * facteur;
  const premier = Math.floor(defilement / pas) - 1;
  const nombre = Math.ceil(LARGEUR / pas) + 3;
  const out = [];
  for (let k = 0; k < nombre; k++) {
    const idx = premier + k;
    out.push({ idx, x: Math.round(idx * pas - defilement) });
  }
  return out;
}

function dessinerCollines(facteur, baseY, hauteur, couleur) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(-200, HAUTEUR);
  for (const { x } of rangeeDeFond(facteur, 120)) {
    ctx.lineTo(x, baseY);
    ctx.lineTo(x + 60, baseY - hauteur);
    ctx.lineTo(x + 120, baseY);
  }
  ctx.lineTo(LARGEUR + 200, HAUTEUR);
  ctx.closePath();
  ctx.fill();
}

/* Zone 1 : une skyline de tours, pour l'exterieur futuriste. */
function dessinerTours(facteur, baseY, couleur) {
  const motif = [58, 96, 34, 128, 72, 46, 110, 84];
  for (const { idx, x } of rangeeDeFond(facteur, 96)) {
    const h = motif[((idx % motif.length) + motif.length) % motif.length];
    ctx.fillStyle = couleur;
    ctx.fillRect(x, baseY - h, 64, h + HAUTEUR);
    // Fenetres : deux colonnes de points, assez discretes pour rester du fond.
    ctx.fillStyle = 'rgba(232,182,44,.14)';
    for (let f = 12; f < h - 8; f += 16) {
      ctx.fillRect(x + 14, baseY - h + f, 4, 5);
      ctx.fillRect(x + 42, baseY - h + f, 4, 5);
    }
  }
}

/* Zone 2 : des tuyaux verticaux, pour l'interieur du complexe. */
function dessinerTuyaux(facteur, couleur) {
  ctx.fillStyle = couleur;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ctx.fillStyle = 'rgba(255,255,255,.045)';
  for (const { idx, x } of rangeeDeFond(facteur, 72)) {
    ctx.fillRect(x, 0, 14, HAUTEUR);
    const rang = ((idx % 3) + 3) % 3;
    ctx.fillRect(x - 4, 90 + rang * 54, 22, 8);
  }
}

function dessinerNiveau() {
  const z = palette();
  for (const s of solides) {
    const x = Math.round(s.x - cam.x);
    const y = Math.round(s.y - cam.y);
    if (x > LARGEUR || x + s.w < 0) continue;
    ctx.fillStyle = z.solFace; ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = z.solHaut; ctx.fillRect(x, y, s.w, 6);
    ctx.fillStyle = z.solLigne; ctx.fillRect(x, y, s.w, 2);
  }
  for (const p of traversantes) {
    const x = Math.round(p.x - cam.x);
    const y = Math.round(p.y - cam.y);
    if (x > LARGEUR || x + p.w < 0) continue;
    ctx.fillStyle = '#8a6f4a'; ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, p.w, 1);
  }
}

/* La porte de sortie. Elle pulse doucement pour se signaler de loin : c'est le
   seul element du decor que le joueur doit chercher. */
function dessinerPorte() {
  if (!PORTE) return;
  const x = Math.round(PORTE.x - cam.x);
  const y = Math.round(PORTE.y - cam.y);
  if (x > LARGEUR + 40 || x + PORTE.w < -40) return;

  const pulsation = 0.5 + 0.5 * Math.sin(performance.now() / 420);

  ctx.fillStyle = '#14161f';
  ctx.fillRect(x, y, PORTE.w, PORTE.h);
  ctx.strokeStyle = 'rgba(232,182,44,' + (0.4 + pulsation * 0.45).toFixed(2) + ')';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, PORTE.w - 2, PORTE.h - 2);

  // Halo interieur
  const g = ctx.createLinearGradient(0, y + PORTE.h, 0, y);
  g.addColorStop(0, 'rgba(232,182,44,' + (0.28 + pulsation * 0.22).toFixed(2) + ')');
  g.addColorStop(1, 'rgba(232,182,44,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + 3, y + 3, PORTE.w - 6, PORTE.h - 6);

  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,182,44,.8)';
  ctx.fillText('SORTIE', x + PORTE.w / 2, y - 6);
  ctx.textAlign = 'left';
}

/* Le sas de passage entre les deux zones.

   Il ne bloque rien : c'est une piece de decor. Mais il donne une cause visible
   au changement d'ambiance — avant, la palette basculait derriere un fondu au
   noir sans que rien a l'ecran ne justifie pourquoi. */
/* Un niveau a un sas par changement de zone. On les dessine tous : le
   niveau 3 en a deux, et chacun annonce le decor qu'il ouvre. */
function dessinerSas() {
  for (const s of SAS_LISTE) {
    if (s.style === 'grotte') dessinerEntreeGrotte(s);
    else if (s.style === 'foret') dessinerArche(s, 'LA CLAIRIÈRE S\'OUVRE', '#3d7a44', '#5da155');
    else if (s.style === 'pierre') dessinerArche(s, 'CERCLE DE PIERRES', '#584772', '#9d7fd0');
    else if (s.style === 'grille') dessinerGrille(s);
    else dessinerSasMetal(s);
  }
}

function dessinerSasMetal(SAS) {
  const x = Math.round(SAS.x - cam.x);
  const y = Math.round(SAS.y - cam.y);
  if (x > LARGEUR + 60 || x + SAS.w < -60) return;

  const bas = y + SAS.h;

  // Ouverture des portes : elles coulissent quand Brad approche.
  const distance = Math.abs((brad.x + brad.w / 2) - (SAS.x + SAS.w / 2));
  const ouverture = Math.max(0, Math.min(1, (200 - distance) / 120));
  const battant = (SAS.w / 2) * (1 - ouverture);

  // Encadrement, en tôle claire pour se détacher du fond de ville
  ctx.fillStyle = '#525d75';
  ctx.fillRect(x - 6, y - 8, SAS.w + 12, 12);
  ctx.fillRect(x - 6, y - 8, 8, SAS.h + 8);
  ctx.fillRect(x + SAS.w - 2, y - 8, 8, SAS.h + 8);
  ctx.fillStyle = '#6e7b96';
  ctx.fillRect(x - 6, y - 8, SAS.w + 12, 3);
  ctx.fillRect(x - 6, y - 8, 3, SAS.h + 8);
  ctx.fillRect(x + SAS.w - 2, y - 8, 3, SAS.h + 8);
  ctx.fillStyle = 'rgba(232,182,44,.45)';
  ctx.fillRect(x - 6, y + 3, SAS.w + 12, 2);

  // Intérieur : un couloir sombre qui laisse deviner l'autre zone
  const g = ctx.createLinearGradient(0, y, 0, bas);
  g.addColorStop(0, '#0b0f14');
  g.addColorStop(1, '#141c1e');
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, y + 4, SAS.w - 4, SAS.h - 4);

  // Battants coulissants
  ctx.fillStyle = '#28303f';
  ctx.fillRect(x + 2, y + 4, battant, SAS.h - 4);
  ctx.fillRect(x + SAS.w - 2 - battant, y + 4, battant, SAS.h - 4);
  ctx.fillStyle = 'rgba(232,182,44,.5)';
  if (battant > 1) {
    ctx.fillRect(x + 2 + battant - 2, y + 4, 2, SAS.h - 4);
    ctx.fillRect(x + SAS.w - 2 - battant, y + 4, 2, SAS.h - 4);
  }

  // Bandes d'avertissement au sol, de part et d'autre
  ctx.fillStyle = 'rgba(232,182,44,.5)';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x - 26 + i * 5, bas - 3, 3, 3);
    ctx.fillRect(x + SAS.w + 8 + i * 5, bas - 3, 3, 3);
  }

  // Voyant et étiquette
  const allume = ouverture > 0.5;
  ctx.fillStyle = allume ? '#7ee08a' : '#e2553b';
  ctx.fillRect(x + SAS.w / 2 - 2, y - 6, 4, 4);
  ctx.font = '7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,182,44,.75)';
  ctx.fillText('SAS 02', x + SAS.w / 2, y - 12);
  ctx.textAlign = 'left';
}

/* Variante du sas pour le niveau 1 : une bouche de grotte, pas une porte
   metallique. Meme role — donner une cause visible au changement de decor. */
function dessinerEntreeGrotte(SAS) {
  const x = Math.round(SAS.x - cam.x);
  const y = Math.round(SAS.y - cam.y);
  if (x > LARGEUR + 80 || x + SAS.w < -80) return;
  const bas = y + SAS.h;

  // Masse rocheuse
  ctx.fillStyle = '#4a3b52';
  ctx.beginPath();
  ctx.moveTo(x - 30, bas);
  ctx.lineTo(x - 22, y + 14);
  ctx.lineTo(x - 4, y - 10);
  ctx.lineTo(x + SAS.w + 6, y - 6);
  ctx.lineTo(x + SAS.w + 26, y + 20);
  ctx.lineTo(x + SAS.w + 32, bas);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5d4b68';
  ctx.fillRect(x - 26, bas - 6, SAS.w + 56, 6);

  // Ouverture, plus sombre a mesure qu'on s'enfonce
  const g = ctx.createRadialGradient(x + SAS.w / 2, bas - 10, 4,
                                     x + SAS.w / 2, bas - 10, SAS.w);
  g.addColorStop(0, '#0a0710');
  g.addColorStop(1, '#241d2c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, bas);
  ctx.lineTo(x + 2, y + 26);
  ctx.lineTo(x + SAS.w / 2, y + 8);
  ctx.lineTo(x + SAS.w - 2, y + 26);
  ctx.lineTo(x + SAS.w, bas);
  ctx.closePath();
  ctx.fill();

  // Deux torches, allumees a l'approche de Brad
  const distance = Math.abs((brad.x + brad.w / 2) - (SAS.x + SAS.w / 2));
  const vif = Math.max(0, Math.min(1, (220 - distance) / 140));
  [x - 14, x + SAS.w + 12].forEach((tx, i) => {
    ctx.fillStyle = '#3a2d20';
    ctx.fillRect(tx - 2, bas - 44, 4, 20);
    const f = vif * (0.6 + 0.4 * Math.sin(performance.now() / 130 + i * 2));
    if (f <= 0.05) return;
    ctx.fillStyle = 'rgba(232,146,44,' + f.toFixed(2) + ')';
    ctx.fillRect(tx - 4, bas - 54, 8, 11);
    ctx.fillStyle = 'rgba(255,222,150,' + (f * 0.8).toFixed(2) + ')';
    ctx.fillRect(tx - 2, bas - 51, 4, 6);
  });

  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,182,44,.7)';
  ctx.fillText('LA GROTTE', x + SAS.w / 2, y - 16);
  ctx.textAlign = 'left';
}

/* Arche du niveau 3 : deux montants et un linteau, colores selon la zone
   qu'ils ouvrent. Meme role que le sas metallique — donner une cause visible
   au changement de decor — avec le vocabulaire de la vallee. */
function dessinerArche(SAS, titre, sombre, clair) {
  const x = Math.round(SAS.x - cam.x);
  const y = Math.round(SAS.y - cam.y);
  if (x > LARGEUR + 80 || x + SAS.w < -80) return;
  const bas = y + SAS.h;

  ctx.fillStyle = sombre;
  ctx.fillRect(x - 16, y - 4, 14, SAS.h + 4);
  ctx.fillRect(x + SAS.w + 2, y - 4, 14, SAS.h + 4);
  ctx.fillRect(x - 20, y - 16, SAS.w + 40, 14);
  ctx.fillStyle = clair;
  ctx.fillRect(x - 20, y - 16, SAS.w + 40, 3);
  ctx.fillRect(x - 16, y - 4, 3, SAS.h + 4);
  ctx.fillRect(x + SAS.w + 2, y - 4, 3, SAS.h + 4);

  // Le passage lui-meme : une lueur qui s'intensifie quand Brad approche.
  const distance = Math.abs((brad.x + brad.w / 2) - (SAS.x + SAS.w / 2));
  const vif = Math.max(0, Math.min(1, (240 - distance) / 150));
  const g = ctx.createLinearGradient(0, y, 0, bas);
  g.addColorStop(0, 'rgba(10,8,16,.9)');
  g.addColorStop(1, 'rgba(20,16,28,.6)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 2, y, SAS.w + 4, SAS.h);
  if (vif > 0.05) {
    ctx.globalAlpha = vif * (0.3 + 0.15 * Math.sin(performance.now() / 420));
    ctx.fillStyle = clair;
    ctx.fillRect(x - 2, y, SAS.w + 4, SAS.h);
    ctx.globalAlpha = 1;
  }

  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,182,44,.7)';
  ctx.fillText(titre, x + SAS.w / 2, y - 22);
  ctx.textAlign = 'left';
}

/* Sas du niveau 2 : une grille de cour, qu'on pousse en arrivant. */
function dessinerGrille(SAS) {
  const x = Math.round(SAS.x - cam.x);
  const y = Math.round(SAS.y - cam.y);
  if (x > LARGEUR + 60 || x + SAS.w < -60) return;
  const bas = y + SAS.h;

  const distance = Math.abs((brad.x + brad.w / 2) - (SAS.x + SAS.w / 2));
  const ouverture = Math.max(0, Math.min(1, (200 - distance) / 120));

  // Le mur qui la porte
  ctx.fillStyle = '#3b3630';
  ctx.fillRect(x - 14, y - 10, 12, SAS.h + 10);
  ctx.fillRect(x + SAS.w + 2, y - 10, 12, SAS.h + 10);
  ctx.fillStyle = '#57504a';
  ctx.fillRect(x - 14, y - 10, 12, 3);
  ctx.fillRect(x + SAS.w + 2, y - 10, 12, 3);

  ctx.fillStyle = 'rgba(8,10,16,.85)';
  ctx.fillRect(x - 2, y, SAS.w + 4, SAS.h);

  // Un seul battant, qui pivote vers l'interieur : la largeur suffit a le dire.
  const l = (SAS.w + 4) * (1 - ouverture * 0.85);
  ctx.strokeStyle = 'rgba(190,200,215,.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const gx = x - 2 + (l / 6) * i;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, bas); ctx.stroke();
  }
  for (let j = 0; j <= 4; j++) {
    const gy = y + (SAS.h / 4) * j;
    ctx.beginPath(); ctx.moveTo(x - 2, gy); ctx.lineTo(x - 2 + l, gy); ctx.stroke();
  }

  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,182,44,.7)';
  ctx.fillText('ARRIÈRE-COUR', x + SAS.w / 2, y - 16);
  ctx.textAlign = 'left';
}

function dessinerPanneaux() {
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const p of PANNEAUX) {
    const x = Math.round(p.x * TUILE - cam.x);
    const y = Math.round(p.y * TUILE - cam.y);
    if (x > LARGEUR + 300 || x < -340) continue;
    const l = ctx.measureText(p.texte).width + 10;
    ctx.fillStyle = 'rgba(10,12,20,.55)'; ctx.fillRect(x, y - 12, l, 15);
    ctx.fillStyle = 'rgba(232,182,44,.85)'; ctx.fillText(p.texte, x + 5, y - 1);
  }
}

/* -----------------------------------------------------------------------------
   5. RENDU DES ENNEMIS
   Les images sources ne contiennent qu'une seule pose. Toute l'animation est
   donc produite par le code : balancement de marche, etirement d'alerte,
   inclinaison de charge, ecrasement a la mort.
-------------------------------------------------------------------------- */

function dessinerEnnemis() {
  for (const e of ennemis) {
    if (ennemiHorsZone(e)) continue;
    // `e.t.sprite` permet a un type de reutiliser la planche d'un autre : le
    // boss est un Serra-Lourd agrandi, sa difference tient au comportement,
    // pas au dessin.
    const img = sprites[e.t.sprite || e.type];
    const cx = Math.round(e.x + e.w / 2 - cam.x);
    const bas = Math.round(e.y + e.h - cam.y);
    if (cx < -80 || cx > LARGEUR + 80) continue;

    if (!e.t.vole && e.etat !== 'mort') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(cx, bas, e.w * 0.45, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!img) {
      ctx.fillStyle = '#c9564f';
      ctx.fillRect(cx - e.w / 2, bas - e.h, e.w, e.h);
      continue;
    }

    // Deformations : chacune correspond a un etat lisible pour le joueur.
    let sx = 1, sy = 1, inclinaison = 0, dy = 0;

    if (e.etat === 'mort') {
      sy = e.ecrase; sx = 1 + (1 - e.ecrase) * 0.7;
    } else if (e.etat === 'alerte') {
      const p = Math.sin(e.phase * 14);
      sy = 1 + 0.1 + p * 0.05; sx = 1 / sy;
      dy = -2;
    } else if (e.dort) {
      // Endormi : une respiration lente suffit a montrer qu'il est vivant,
      // sans donner l'impression qu'il patrouille.
      sy = 1 + Math.sin(e.phase * 0.5) * 0.02; sx = 1 / sy;
    } else {
      const marche = Math.sin(e.phase * 2.2);
      sy = 1 + marche * 0.05;
      sx = 1 / sy;
      dy = -Math.abs(marche) * 2;
      if (e.etat === 'charge') inclinaison = e.sens * 0.14;
      if (e.t.vole) dy = 0;
    }

    const ech = e.t.echelle || 1;
    ctx.save();
    ctx.translate(cx, bas + dy);
    ctx.rotate(inclinaison);
    // e.t.sensNatif compense l'orientation dans laquelle le sprite a ete dessine.
    ctx.scale(e.sens * e.t.sensNatif * sx * ech, sy * ech);
    const source = e.flash > 0 ? silhouette(img) : img;
    ctx.globalAlpha = e.etat === 'mort' ? Math.max(0, e.minuteur / 0.32) : 1;
    ctx.drawImage(source, -img.width / 2, -img.height);
    ctx.globalAlpha = 1;
    ctx.restore();

    dessinerBlindage(cx, bas, e);

    if (e.etat === 'alerte' || (e.etat === 'charge' && Math.sin(e.phase * 6) > 0)) {
      dessinerExclamation(cx, bas - e.h - 12);
    }
    // Le boss a sa propre barre en haut de l'ecran : en doubler une au-dessus
    // de sa tete ne ferait qu'encombrer.
    if (e.pvMax > 1 && e.pv < e.pvMax && e.etat !== 'mort' && !e.estBoss) {
      barreDeVieEnnemi(cx, bas - e.h - 8, e);
    }
    if (OPTIONS.hitbox) {
      ctx.strokeStyle = e.dort ? 'rgba(120,140,255,.7)' : 'rgba(255,120,120,.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(e.x - cam.x) + .5, Math.round(e.y - cam.y) + .5, e.w - 1, e.h - 1);
    }
  }
}

/* Le point d'exclamation rouge demande dans les notes : c'est le seul signal
   qui previent le joueur qu'il a ete repere. */
function dessinerExclamation(x, y) {
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(x - 2, y - 10, 4, 7);
  ctx.fillRect(x - 2, y - 1, 4, 3);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(x - 2, y - 10, 1, 7);
}

function barreDeVieEnnemi(x, y, e) {
  const l = 22;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - l / 2 - 1, y - 1, l + 2, 4);
  ctx.fillStyle = ACCENT; ctx.fillRect(x - l / 2, y, l * (e.pv / e.pvMax), 2);
}

/* -----------------------------------------------------------------------------
   6. RENDU DE BRAD
-------------------------------------------------------------------------- */

/* La planche ne contient ni saut ni chute. On reutilise deux poses de course
   dont la silhouette se lit bien en l'air : jambes ecartees en montee, jambes
   ramenees en descente. A remplacer des que de vraies images existeront. */
const IMAGE_SAUT = { ligne: BRAD_PLANCHE.course, colonne: 1 };
const IMAGE_CHUTE = { ligne: BRAD_PLANCHE.course, colonne: 3 };

/* Choix de l'image, pour n'importe quel acteur ayant la forme de Brad. Sert au
   joueur comme au Brad autonome de la scene de menu. */
function poseBrad(a) {
  if (!a.auSol) return a.vy < 0 ? IMAGE_SAUT : IMAGE_CHUTE;
  const vitesse = Math.abs(a.vx);
  if (vitesse < 8) {
    const cadence = a.inactif > 14 ? 0.9 : 0.24;
    return { ligne: BRAD_PLANCHE.repos, colonne: Math.floor(a.phaseRepos / cadence) % 4 };
  }
  const ligne = vitesse > R.vitesseMarche * 1.08 ? BRAD_PLANCHE.course : BRAD_PLANCHE.marche;
  return { ligne, colonne: Math.floor(a.phaseMarche) % 4 };
}

function dessinerPlancheBrad(cx, bas, sens, etirement, pose) {
  if (!bradPret) {
    ctx.fillStyle = '#191b26';
    ctx.fillRect(cx - 11, bas - 46, 22, 46);
    return;
  }
  const { cw, ch, piedsDansCellule } = BRAD_PLANCHE;
  ctx.save();
  ctx.translate(cx, bas);
  ctx.scale(sens / etirement, etirement);
  ctx.drawImage(imgBrad, pose.colonne * cw, pose.ligne * ch, cw, ch,
                -cw / 2, -piedsDansCellule, cw, ch);
  ctx.restore();
}

function dessinerBrad() {
  const cx = Math.round(brad.x + brad.w / 2 - cam.x);
  const bas = Math.round(brad.y + brad.h - cam.y);

  ctx.fillStyle = brad.auSol ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.16)';
  ctx.beginPath();
  ctx.ellipse(cx, bas, brad.w * (brad.auSol ? 0.5 : 0.34), 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Clignotement d'invincibilite : Brad disparait une image sur deux.
  const clignote = brad.invincible > 0 && brad.scenarise <= 0 &&
                   Math.floor(brad.invincible * 14) % 2 === 0;

  // Entree dans la porte : Brad s'efface progressivement.
  const opacite = brad.scenarise > 0 ? Math.max(0, Math.min(1, brad.scenarise / 0.9)) : 1;

  if (!clignote) {
    ctx.globalAlpha = opacite;
    dessinerPlancheBrad(cx, bas, brad.sens, brad.etirement, poseBrad(brad));
    ctx.globalAlpha = 1;
  }

  if (brad.porte) dessinerBoule(cx - 7, bas - brad.h - 12, performance.now() / 90);
  dessinerCoup();
  dessinerInactivite(cx, bas);

  if (OPTIONS.hitbox) {
    ctx.strokeStyle = 'rgba(120,255,180,.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(brad.x - cam.x) + .5, Math.round(brad.y - cam.y) + .5,
                   brad.w - 1, brad.h - 1);
  }
}

/* Trace d'attaque : un arc qui s'efface. Sans image d'attaque dans la planche,
   c'est ce trait qui rend le coup lisible.

   L'arc doit etre MIROITE selon le regard de Brad. `ctx.arc(..., -0.9, 0.9)`
   dessine toujours le cote droit d'un cercle : dessine tel quel, le coup
   partait visuellement a droite meme quand Brad frappait a gauche. La zone de
   degats, elle, a toujours ete du bon cote — c'est bien l'image qui mentait. */
function dessinerCoup() {
  if (brad.attaque <= 0) return;
  const z = zoneAttaque();
  const p = 1 - brad.attaque / R.dureeAttaque;
  const cx = Math.round(brad.x + brad.w / 2 - cam.x);
  const cy = Math.round(z.y + z.h / 2 - cam.y);
  const rayon = (brad.w / 2 + z.w) * (0.45 + p * 0.55);

  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - p);
  ctx.strokeStyle = '#fff2c0';
  ctx.lineWidth = 3;
  ctx.translate(cx, cy);
  ctx.scale(brad.sens, 1);
  ctx.beginPath();
  ctx.arc(0, 0, rayon, -0.95, 0.95);
  ctx.stroke();
  ctx.restore();

  if (OPTIONS.hitbox) {
    ctx.strokeStyle = 'rgba(255,240,180,.9)'; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(z.x - cam.x) + .5, Math.round(z.y - cam.y) + .5, z.w, z.h);
  }
}

/* Animations d'inactivite decrites dans les notes. La planche n'a pas de pose
   dediee : le telephone et les Z sont dessines par-dessus les images de repos.
   Deux ou trois images suffiraient a remplacer proprement cette astuce. */
function dessinerInactivite(cx, bas) {
  if (brad.inactif <= 6) return;
  const t = performance.now() / 1000;

  if (brad.inactif <= 14) {
    const mx = cx + brad.sens * 12;
    const my = bas - 23 + Math.round(Math.sin(t * 2) * 0.5);
    ctx.fillStyle = '#0d0e16'; ctx.fillRect(mx - 2, my, 5, 9);
    ctx.fillStyle = 'rgba(150,210,255,.85)'; ctx.fillRect(mx - 1, my + 1, 3, 7);
    return;
  }
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 2; i++) {
    const p = (t * 0.5 + i * 0.5) % 1;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - p)).toFixed(2) + ')';
    ctx.fillText(i ? 'Z' : 'z', cx + 8 + p * 6, bas - 50 - p * 12);
  }
}

/* -----------------------------------------------------------------------------
   7. BOULES, RAMASSAGES, EFFETS
-------------------------------------------------------------------------- */

function dessinerBoule(x, y, phase) {
  const img = sprites['boule-serrano'];
  if (!img) {
    ctx.fillStyle = '#e07070';
    ctx.fillRect(x, y, 14, 14);
    return;
  }
  // Rotation par pas de 90 degres : plus lisible en pixel art qu'une
  // rotation continue, qui produirait des bords baveux.
  ctx.save();
  ctx.translate(x + 7, y + 7);
  ctx.rotate(Math.floor(phase % 4) * Math.PI / 2);
  ctx.drawImage(img, -7, -7);
  ctx.restore();
}

function dessinerBoules() {
  for (const b of boules) {
    // Clignotement quand la boule posee va disparaitre.
    if (b.posee > 0 && b.posee < 2 && Math.floor(b.posee * 8) % 2 === 0) continue;
    dessinerBoule(Math.round(b.x - cam.x), Math.round(b.y - cam.y), b.phase);
    if (b.posee > 0) {
      ctx.fillStyle = 'rgba(232,182,44,.5)';
      ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y + 15), 14, 1);
    }
  }
}

function dessinerRamassages() {
  for (const r of ramassages) {
    const x = Math.round(r.x - cam.x);
    const y = Math.round(r.y - cam.y);
    if (r.genre === 'objet') {
      dessinerObjetMajeur(x + r.w / 2, y + r.h / 2, r.objet, 1, true);
    } else if (r.genre === 'piece') {
      // Piece qui tourne sur elle-meme : la largeur suit un cosinus.
      const l = Math.abs(Math.cos(r.phase)) * 8;
      ctx.fillStyle = '#8a6a12';
      ctx.fillRect(x + 4 - l / 2, y, Math.max(1, l), 8);
      ctx.fillStyle = ACCENT;
      ctx.fillRect(x + 4 - l / 2, y, Math.max(1, l - 2), 7);
    } else {
      ctx.fillStyle = '#7ee08a';
      ctx.fillRect(x + 3, y, 4, 10);
      ctx.fillRect(x, y + 3, 10, 4);
    }
  }
}

function dessinerEffets() {
  for (const f of effets) {
    const p = f.t / f.duree;
    if (f.genre === 'particule') {
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = f.couleur;
      ctx.fillRect(Math.round(f.x - cam.x), Math.round(f.y - cam.y), 2, 2);
      ctx.globalAlpha = 1;
    } else if (f.genre === 'texte') {
      ctx.globalAlpha = 1 - p * p;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      // Contour sombre : le texte reste lisible sur n'importe quel decor.
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8,10,16,.75)';
      ctx.strokeText(f.texte, Math.round(f.x - cam.x), Math.round(f.y - cam.y));
      ctx.fillStyle = f.couleur;
      ctx.fillText(f.texte, Math.round(f.x - cam.x), Math.round(f.y - cam.y));
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    } else if (f.genre === 'onde') {
      ctx.globalAlpha = 0.75 * (1 - p);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(Math.round(f.x - cam.x), Math.round(f.y - cam.y), f.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function dessinerTraces() {
  if (!OPTIONS.traces) return;
  for (const p of traces) {
    ctx.fillStyle = p.sol ? 'rgba(120,255,180,.25)' : 'rgba(232,182,44,.45)';
    ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
  }
}

/* -----------------------------------------------------------------------------
   8. INTERFACE EN JEU
-------------------------------------------------------------------------- */

let fps = 60;

function hud() {
  // Barre de vie : une case par point, pour que le joueur lise sa vie d'un
  // coup d'oeil sans avoir a estimer une longueur.
  const x0 = 10, y0 = 8;
  for (let i = 0; i < brad.pvMax; i++) {
    const plein = i < brad.pv;
    ctx.fillStyle = plein ? '#d0453f' : 'rgba(255,255,255,.13)';
    ctx.fillRect(x0 + i * 9, y0, 7, 9);
    if (plein) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x0 + i * 9, y0, 7, 2); }
  }

  // Jauge de Brad-Shy
  const jx = x0, jy = y0 + 13, jl = 96;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(jx - 1, jy - 1, jl + 2, 7);
  ctx.fillStyle = brad.shy >= 100 ? '#fff0b0' : '#6f7bd0';
  ctx.fillRect(jx, jy, jl * (brad.shy / 100), 5);
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = brad.shy >= 100 ? ACCENT : 'rgba(255,255,255,.45)';
  ctx.fillText(brad.shy >= 100 ? 'BRAD-SHY PRÊT — C' : 'Brad-Shy', jx + jl + 6, jy + 5);

  // Compteur de pieces
  ctx.textAlign = 'right';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillText(brad.pieces + ' BC', LARGEUR - 10, 18);

  // Progression dans le niveau : une barre discrete, pour que le joueur sache
  // ou il en est dans un niveau volontairement long.
  const av = Math.max(0, Math.min(1, (brad.x - APPARITION.x) / (PORTE.x - APPARITION.x)));
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(LARGEUR - 90, 26, 80, 3);
  ctx.fillStyle = 'rgba(232,182,44,.75)';
  ctx.fillRect(LARGEUR - 90, 26, 80 * av, 3);
  ctx.textAlign = 'left';

  if (brad.porte) {
    ctx.textAlign = 'right';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('boule prête — X pour lancer', LARGEUR - 10, 42);
    ctx.textAlign = 'left';
  }
}

function bandeau() {
  ctx.fillStyle = 'rgba(10,12,20,.72)';
  ctx.fillRect(0, HAUTEUR - 18, LARGEUR, 18);
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8d93ab';
  const h = (R.forceSaut * R.forceSaut) / (2 * R.gravite);
  const eveilles = ennemis.filter(e => e.etat !== 'mort' && !e.dort).length;
  const infos = [
    'vx ' + Math.abs(brad.vx).toFixed(0).padStart(3),
    'saut ' + h.toFixed(0) + 'px',
    brad.auSol ? 'sol' : (brad.coyote > 0 ? 'coyote' : 'air'),
    'ennemis ' + eveilles + '/' + ennemis.filter(e => e.etat !== 'mort').length,
    'morts ' + mortsConsecutives + '/3',
    'zone ' + (zoneAffichee + 1),
    fps.toFixed(0) + 'fps',
  ];
  ctx.fillText(infos.join('  ·  '), 8, HAUTEUR - 5);
}

function ecranDeMort() {
  ctx.fillStyle = 'rgba(120,16,16,.86)';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  texteCentre('BRAD BITT EST MORT', HAUTEUR / 2 - 34,
              'bold 26px system-ui, sans-serif', '#ffe9e9');
  texteCentre('Terrassé par : ' + tueur, HAUTEUR / 2 - 8,
              '13px system-ui, sans-serif', 'rgba(255,220,220,.9)');
  texteCentre(CONSEILS[tueur] || 'Ça arrive aux meilleurs.', HAUTEUR / 2 + 16,
              'italic 11px system-ui, sans-serif', 'rgba(255,210,210,.72)');

  const suite = mortsConsecutives >= 3
    ? 'Trois morts d\'affilée : retour au début du niveau.'
    : 'Tu repars au dernier point sûr.  (' + mortsConsecutives + '/3)';
  texteCentre(suite, HAUTEUR / 2 + 44, '11px system-ui, sans-serif', 'rgba(255,255,255,.62)');

  // Un vrai bouton, et pas seulement « appuie sur Espace » : au doigt, il n'y
  // a pas de clavier. N'importe quel endroit de l'écran relance aussi.
  const l = 148, h = 32, x = (LARGEUR - l) / 2, y = HAUTEUR / 2 + 58;
  const survol = souris.survol && souris.survol.action === 'relancer-mort';
  ctx.fillStyle = survol ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)';
  ctx.fillRect(x, y, l, h);
  ctx.strokeStyle = 'rgba(255,225,225,.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, l - 1, h - 1);
  texteCentre('RÉESSAYER', y + 21, 'bold 14px system-ui, sans-serif', '#ffe9e9');
  zone(x, y, l, h, 'relancer-mort');

  // Second bouton : abandonner et rentrer a la base — mais seulement si la
  // base existe. Pendant le tout premier niveau, la seule issue est de
  // reessayer : on ne fuit pas une introduction qu'on n'a jamais finie.
  let yb = y + h + 8;
  if (baseAccessible()) {
    const lb = 118, xb = LARGEUR / 2 - lb / 2;
    const survolB = souris.survol && souris.survol.action === 'mort-hub';
    ctx.fillStyle = survolB ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)';
    ctx.fillRect(xb, yb, lb, 22);
    texteCentre('Retour à la base', yb + 15, '10px system-ui, sans-serif', 'rgba(255,255,255,.6)');
    zone(xb, yb, lb, 22, 'mort-hub');
    yb += 28;
  } else {
    texteCentre('Le BRADDY3000 monte encore la base. Pas d\'échappatoire pour l\'instant.',
                yb + 12, 'italic 9px system-ui, sans-serif', 'rgba(255,255,255,.3)');
    yb += 20;
  }

  texteCentre(estTactile ? 'Touche l\'écran pour repartir' : 'Espace, Entrée ou clic',
              yb + 8, '10px system-ui, sans-serif', 'rgba(255,255,255,.35)');
}

/* -----------------------------------------------------------------------------
   9. RENDU COMPLET
-------------------------------------------------------------------------- */

function rendreNiveau() {
  ctx.save();
  if (secousseEtat.t > 0) {
    const f = secousseEtat.force * (secousseEtat.t / 0.4);
    ctx.translate(Math.round((Math.random() - 0.5) * f), Math.round((Math.random() - 0.5) * f));
  }
  fond();
  dessinerNiveau();
  dessinerArene();
  dessinerTrampolines();
  dessinerMobiles();
  dessinerSas();
  dessinerPorte();
  dessinerTraces();
  dessinerPanneaux();
  dessinerRamassages();
  dessinerEnnemis();
  dessinerBoules();
  dessinerBrad();
  dessinerEffets();
  ctx.restore();

  hud();
  hudArene();
  bandeau();
  dessinerFonduTransition();
}

function rendu() {
  zones.length = 0;                    // les zones cliquables sont reconstruites

  switch (scene) {
    case 'accueil':   dessinerAccueil(); break;
    case 'logos':     dessinerEcranLogos(); break;
    case 'menu':      dessinerMenu(); break;
    case 'options':   dessinerOptions(); break;
    case 'credits':   dessinerCredits(); break;
    case 'difficulte': dessinerChoixDifficulte(); break;
    case 'dialogue':  dessinerDialogue(); break;
    case 'hub':       dessinerHub(); break;
    case 'boutique':  dessinerHub(); dessinerBoutique(); break;
    case 'vestiaire': dessinerHub(); dessinerVestiaire(); break;
    case 'carte':     dessinerHub(); dessinerCarte(); break;
    case 'arcade':    dessinerArcade(); break;
    case 'jukebox':   dessinerHub(); dessinerJukebox(); break;
    case 'pause':     dessinerPause(); break;
    case 'chargement': dessinerChargement(); break;
    case 'pret':      dessinerPret(); break;
    case 'jeu':       rendreNiveau(); break;
    case 'mort':      rendreNiveau(); ecranDeMort(); break;
    case 'fin':       rendreNiveau(); dessinerFinNiveau(); break;
  }

  souris.survol = zoneSousSouris();
  souris.bouge = false;             // consomme apres usage par les menus
  canvas.style.cursor = souris.survol ? 'pointer' : 'default';
  majAffichageTactile();
}

/* -----------------------------------------------------------------------------
   10. BOUCLE PRINCIPALE
   Pas de temps fixe : la physique avance par tranches de 1/120 s quelle que
   soit la frequence d'affichage. Les sensations sont donc identiques sur un
   ecran 60 Hz et sur un 144 Hz.
-------------------------------------------------------------------------- */

const PAS = 1 / 120;
let accumulateur = 0;
let dernier = performance.now();

function relancerNiveau(id) {
  chargerNiveau(id || niveauCourant);
  // Les ameliorations achetees au hub s'appliquent au depart du niveau.
  brad.pvMax = pvMaxDeBrad();
  brad.pv = brad.pvMax;
  brad.shy = 0;
  brad.pieces = 0;
  mortsConsecutives = 0;
  chrono = 0;
  zoneAffichee = 0;
  transition.actif = false;
  reapparaitre(true);
  reinitialiserEnnemis(true);
  effets.length = 0;
  boules.length = 0;
  cam.x = 0; cam.y = NIVEAU_H - HAUTEUR;
  scene = 'jeu';
}

function boucle(maintenant) {
  let delta = (maintenant - dernier) / 1000;
  dernier = maintenant;
  if (delta > 0.25) delta = 0.25;
  fps += (1 / Math.max(delta, 1e-4) - fps) * 0.1;

  accumulateur += delta;
  let garde = 0;
  while (accumulateur >= PAS && garde++ < 8) {
    if (scene === 'jeu') {
      chrono += PAS;
      majMobiles(PAS);          // avant Brad : il doit se poser sur leur
      majBrad(PAS);             // position de cette image, pas la precedente
      majEnnemis(PAS);
      majArene(PAS);
      majBoules(PAS);
      majRamassages(PAS);
      majCamera(PAS);
      majTransition(PAS);
    } else if (scene === 'logos') {
      majDemarrage(PAS);
    } else if (scene === 'menu' || scene === 'options' || scene === 'credits'
               || scene === 'difficulte') {
      majDemo(PAS);
      if (messageMenuT > 0) messageMenuT -= PAS;
    } else if (scene === 'dialogue') {
      majDialogue(PAS);
    } else if (scene === 'hub') {
      majHub(PAS);
    } else if (scene === 'boutique' || scene === 'vestiaire' || scene === 'carte') {
      // Le hub continue de vivre en fond de panneau (le BRADDY3000 flotte,
      // les ecrans defilent) mais Brad ne bouge plus.
      hub.t += PAS;
      hub.braddy.phase += PAS;
      if (hub.reponseT > 0) { hub.reponseT -= PAS; hub.reponseAge += PAS; }
    } else if (scene === 'arcade') {
      majArcade(PAS);
    } else if (scene === 'jukebox') {
      majJukebox(PAS);
    } else if (scene === 'chargement') {
      majChargement(PAS);
    } else if (scene === 'pause') {
      // Le niveau est fige, mais le decor doit continuer de respirer sous le
      // voile : une image totalement immobile ressemble a un plantage.
      majEffets(PAS);
    }
    majEffets(PAS);
    audio.maj(PAS);
    accumulateur -= PAS;
  }

  rendu();
  requestAnimationFrame(boucle);
}

/* -----------------------------------------------------------------------------
   11. PANNEAU DE REGLAGES
-------------------------------------------------------------------------- */

const panneau = document.getElementById('reglages');
const conteneurCurseurs = document.getElementById('curseurs');
const champs = {};

function basculerPanneau() { panneau.hidden = !panneau.hidden; }

document.getElementById('ouvrir-reglages').onclick = basculerPanneau;
document.getElementById('fermer-reglages').onclick = basculerPanneau;

SCHEMA.forEach(e => {
  if (e.groupe) {
    const t = document.createElement('div');
    t.className = 'groupe-titre';
    t.textContent = e.groupe;
    conteneurCurseurs.appendChild(t);
    return;
  }
  const bloc = document.createElement('div');
  bloc.className = 'curseur';
  const decimales = e.pas < 1 ? (e.pas < 0.05 ? 3 : 2) : 0;
  const afficher = v => v.toFixed(decimales) + (e.unite ? ' ' + e.unite : '');

  bloc.innerHTML =
    '<div class="ligne"><span class="nom"></span><span class="valeur"></span></div>' +
    '<input type="range">' + (e.note ? '<span class="note"></span>' : '');
  bloc.querySelector('.nom').textContent = e.nom;
  if (e.note) bloc.querySelector('.note').textContent = e.note;

  const val = bloc.querySelector('.valeur');
  const range = bloc.querySelector('input');
  range.min = e.min; range.max = e.max; range.step = e.pas; range.value = R[e.cle];
  val.textContent = afficher(R[e.cle]);
  range.addEventListener('input', () => {
    R[e.cle] = parseFloat(range.value);
    val.textContent = afficher(R[e.cle]);
    sauvegarderReglages();
  });

  champs[e.cle] = { range, val, afficher };
  conteneurCurseurs.appendChild(bloc);
});

/* Recopie les valeurs de R dans les curseurs du panneau. Appele aussi par le
   bouton « Rétablir » du menu Options, pour que les deux interfaces ne se
   contredisent jamais. */
function rafraichirPanneau() {
  Object.keys(champs).forEach(k => {
    champs[k].range.value = R[k];
    champs[k].val.textContent = champs[k].afficher(R[k]);
  });
}

document.getElementById('reinit').onclick = () => {
  Object.assign(R, DEFAUTS);
  rafraichirPanneau();
  sauvegarderReglages();
};

document.getElementById('exporter').onclick = async ev => {
  const texte = JSON.stringify(R, null, 2);
  try {
    await navigator.clipboard.writeText(texte);
    ev.target.textContent = 'Copié ✓';
  } catch (e) {
    ev.target.textContent = 'Voir la console';
    console.log(texte);
  }
  setTimeout(() => { ev.target.textContent = 'Copier le réglage'; }, 1600);
};

document.getElementById('relancer').onclick = () => { preparerNiveau(); };
document.getElementById('aller-menu').onclick = () => { retourAuMenu(); };

[['opt-double-saut', 'doubleSaut'], ['opt-saut-ennemi', 'sautEnnemi'],
 ['opt-hitbox', 'hitbox'], ['opt-traces', 'traces']]
  .forEach(([id, cle]) => {
    const el = document.getElementById(id);
    el.checked = OPTIONS[cle];
    el.addEventListener('change', () => {
      OPTIONS[cle] = el.checked;
      if (cle === 'traces' && !el.checked) traces.length = 0;
      sauvegarderReglages();
    });
  });

/* -----------------------------------------------------------------------------
   12. MISE A L'ECHELLE ET DEMARRAGE
   Le canvas garde sa resolution interne de 640x360 et n'est agrandi que par
   des entiers, pour que chaque pixel reste un carre net a l'ecran.
-------------------------------------------------------------------------- */

function redimensionner() {
  const facteur = Math.max(1, Math.min(
    Math.floor(innerWidth / LARGEUR),
    Math.floor(innerHeight / HAUTEUR)
  ));
  canvas.style.width = LARGEUR * facteur + 'px';
  canvas.style.height = HAUTEUR * facteur + 'px';
}

addEventListener('resize', redimensionner);
redimensionner();
chargerNiveau('intro');
reinitialiserEnnemis(true);
reinitialiserDemo();
reinitialiserHub();
requestAnimationFrame(boucle);
