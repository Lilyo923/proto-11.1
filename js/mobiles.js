/* =============================================================================
   BRAD BITT, MAIS LE JEU — plateformes mobiles

   Une barre qui fait la navette au-dessus du vide. Elle ouvre un type
   d'epreuve que le jeu n'avait pas : jusqu'ici, franchir un trou etait une
   question de timing du saut ; ici c'est une question de patience, puis de
   timing. On attend la barre, on monte, on descend au bon moment.

   Elle se declare dans le fichier du niveau :

     mobiles: [ { x1: 60, x2: 70, y: 13, w: 3, vitesse: 60, phase: 0 } ]

   x1/x2 sont les deux bouts de la course, en tuiles ; `vitesse` en pixels par
   seconde ; `phase` (0 a 1) decale le depart pour que deux barres voisines ne
   soient pas synchrones.

   DEUX PIEGES, tous deux traites ici :

   1. Brad doit etre PORTE. Sans ça, la barre glisse sous ses pieds et il tombe
      en restant immobile — l'effet est absurde et donne l'impression que le jeu
      est casse. On memorise donc sur quelle barre il se tient et on lui ajoute
      son deplacement.
   2. Elle ne doit jamais l'ecraser. Une barre qui remonte dans un Brad coince
      le pousserait dans le decor ; elles ne bougent donc qu'a l'horizontale,
      et rien ne les fait passer a travers un mur.
   ========================================================================== */
'use strict';

let MOBILES = [];              // les barres du niveau en cours

function chargerMobiles(d) {
  MOBILES = (d.mobiles || []).map(m => {
    const x1 = Math.min(m.x1, m.x2) * TUILE;
    const x2 = Math.max(m.x1, m.x2) * TUILE;
    return {
      x1, x2,
      w: (m.w || 3) * TUILE,
      h: 10,
      y: m.y * TUILE,
      vitesse: m.vitesse || 55,
      sens: 1,
      // La phase evite que toutes les barres d'un niveau partent ensemble.
      x: x1 + (x2 - x1) * (m.phase || 0),
      dx: 0,                   // deplacement de la derniere image, pour porter Brad
    };
  });
}

function majMobiles(dt) {
  for (const m of MOBILES) {
    const avant = m.x;
    m.x += m.sens * m.vitesse * dt;
    if (m.x <= m.x1) { m.x = m.x1; m.sens = 1; }
    else if (m.x + m.w >= m.x2) { m.x = m.x2 - m.w; m.sens = -1; }
    m.dx = m.x - avant;
  }
}

/* Brad est-il pose sur cette barre ? On accepte une petite tolerance verticale :
   le contact exact au pixel pres ne survit pas a un pas de temps fixe. */
function surMobile(m) {
  return brad.x + brad.w > m.x + 2 && brad.x < m.x + m.w - 2 &&
         brad.y + brad.h >= m.y - 3 && brad.y + brad.h <= m.y + m.h + 4 &&
         brad.vy >= 0;
}

/* Pose Brad sur la barre et le fait voyager avec elle. Appele APRES la
   resolution verticale : on corrige ce que le sol a decide. */
function poserSurMobiles() {
  for (const m of MOBILES) {
    if (!surMobile(m)) continue;
    brad.y = m.y - brad.h;
    brad.vy = 0;
    brad.auSol = true;
    // Le transport. Sans cette ligne, la barre file et Brad reste sur place.
    brad.x += m.dx;
    // On le garde dans le niveau : une barre qui pousse contre un mur ne doit
    // pas l'y enfoncer.
    for (const s of solides) {
      if (!chevauche(brad, s)) continue;
      brad.x = m.dx > 0 ? s.x - brad.w : s.x + s.w;
    }
    return true;
  }
  return false;
}

function dessinerMobiles() {
  for (const m of MOBILES) {
    const x = Math.round(m.x - cam.x);
    const y = Math.round(m.y - cam.y);
    if (x > LARGEUR + 60 || x + m.w < -60) continue;

    // Rail : on voit la course de la barre, donc on peut anticiper.
    const r1 = Math.round(m.x1 - cam.x), r2 = Math.round(m.x2 - cam.x);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(r1, y + 3, r2 - r1, 2);
    for (let k = r1; k <= r2; k += 16) ctx.fillRect(k, y, 2, 8);

    // La barre
    ctx.fillStyle = '#5a4a2c';
    ctx.fillRect(x, y, m.w, m.h);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x, y, m.w, 3);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x, y + m.h - 2, m.w, 2);
    // Chevrons dans le sens de la marche
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    for (let k = 0; k < 3; k++) {
      const cx = x + m.w / 2 - 12 + k * 12;
      ctx.beginPath();
      ctx.moveTo(cx + (m.sens > 0 ? 0 : 6), y + 3);
      ctx.lineTo(cx + (m.sens > 0 ? 6 : 0), y + 5);
      ctx.lineTo(cx + (m.sens > 0 ? 0 : 6), y + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
}
