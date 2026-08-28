/* =============================================================================
   VERIFICATEUR DE NIVEAUX

   Trois familles de defauts que la relecture ne voit pas, mais qui rendent un
   niveau injouable. Toutes ont ete trouvees a la dure sur les niveaux 2 et 3 :

   1. SUPERPOSITION    deux solides qui se recouvrent. Le rendu devient sale et
                       les collisions se contredisent.
   2. ACCESSIBILITE    une plateforme qu'aucun saut ne permet d'atteindre. Brad
                       saute 74 px, soit 3 tuiles : au-dela il faut un relais.
   3. PLAFOND          un obstacle juste au-dessus d'un elan ou d'une marche.
                       Brad se cogne et retombe — dans le trou, ou nulle part.

   Le calcul de portee vient des VRAIS reglages du jeu (js/reglages.js), pas de
   constantes recopiees : si le saut change, le verificateur suit.

   Usage : node tools/verifier_niveaux.js
   Sortie : un rapport par niveau, code de sortie 1 si un defaut subsiste.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const TUILE = 24;

/* --- Chargement des fichiers du jeu, sans navigateur ---------------------- */

/* Tous les fichiers sont evalues DANS UN SEUL script : un `const` de haut
   niveau vit dans la portee lexicale du script, pas sur l'objet de contexte.
   En les concatenant, ils se voient les uns les autres, et la ligne finale
   expose ce dont le verificateur a besoin. */
function evaluerDansBac(fichiers, bac, sortie) {
  const vm = require('vm');
  const contexte = vm.createContext(bac);
  const code = fichiers
    .map(f => '/* ' + f + ' */\n' + fs.readFileSync(path.join(RACINE, f), 'utf8'))
    .join('\n;\n') + '\n;' + sortie;
  vm.runInContext(code, contexte, { filename: 'niveaux-groupes.js' });
  return bac;
}

/* reglages.js touche a localStorage et au DOM : on lui fournit juste assez de
   faux objets pour qu'il se charge, puis on lit SCHEMA. */
const bac = {
  NIVEAUX: {}, console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {} } }) },
  addEventListener: () => {},
};
evaluerDansBac(
  ['js/reglages.js', 'niveaux/intro.js', 'niveaux/niveau1.js',
   'niveaux/niveau2.js', 'niveaux/niveau3.js', 'niveaux/entrainement.js'],
  bac, 'this.SCHEMA = SCHEMA;');

/* Les valeurs par defaut viennent du SCHEMA, source unique de verite. */
const R = {};
for (const e of bac.SCHEMA) if (e.cle) R[e.cle] = e.defaut;
const HAUTEUR_SAUT = (R.forceSaut * R.forceSaut) / (2 * R.gravite);
const TEMPS_VOL = (2 * R.forceSaut) / R.gravite;
const PORTEE_MARCHE = R.vitesseMarche * TEMPS_VOL;
const PORTEE_COURSE = R.vitesseCourse * TEMPS_VOL;
const BRAD_H = 46, BRAD_W = 22;

/* --- Analyse ------------------------------------------------------------- */

function analyser(id) {
  const d = bac.NIVEAUX[id];
  const px = ([x, y, w, h]) => ({ x: x * TUILE, y: y * TUILE, w: w * TUILE, h: h * TUILE });
  const solides = d.solides.map(px);
  const traversantes = (d.traversantes || []).map(([x, y, w]) =>
    ({ x: x * TUILE, y: y * TUILE, w: w * TUILE, h: 6 }));
  const mobiles = (d.mobiles || []).map(m => ({
    x: Math.min(m.x1, m.x2) * TUILE, y: m.y * TUILE,
    w: (m.w || 3) * TUILE, h: 10,
    xMax: Math.max(m.x1, m.x2) * TUILE,
  }));
  const NIVEAU_H = (d.hauteur || 18) * TUILE;
  const NIVEAU_L = d.largeur * TUILE;

  /* Les murs de bord de niveau : hauts de toute la carte, poses aux deux
     extremites. Ils ne sont pas des plateformes et n'ont pas a etre
     atteignables. */
  const estBord = s => s.h >= 16 * TUILE && (s.x < TUILE || s.x + s.w >= NIVEAU_L - 3 * TUILE);

  /* 1. Superpositions ------------------------------------------------------ */
  const superpositions = [];
  for (let i = 0; i < solides.length; i++) {
    for (let j = i + 1; j < solides.length; j++) {
      const a = solides[i], b = solides[j];
      if (estBord(a) || estBord(b)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) {
        superpositions.push(`[${a.x / TUILE},${a.y / TUILE},${a.w / TUILE},${a.h / TUILE}]` +
                            ` recouvre [${b.x / TUILE},${b.y / TUILE},${b.w / TUILE},${b.h / TUILE}]`);
      }
    }
  }

  /* 2. Accessibilite -------------------------------------------------------
     On part des surfaces posees au sol, puis on propage : une surface est
     atteignable si l'on peut y sauter depuis une autre deja atteignable. */
  const surfaces = solides.concat(traversantes).concat(mobiles)
    .filter(s => !estBord(s))
    .map(s => ({ x: s.x, y: s.y, w: s.w, xMax: s.xMax }));

  // Le « sol » : toute surface dans la rangee basse du niveau.
  const atteignable = new Set();
  surfaces.forEach((s, i) => { if (s.y >= NIVEAU_H - 100) atteignable.add(i); });

  const peutSauterVers = (a, b) => {
    const monte = a.y - b.y;                      // positif = b est plus haut
    if (monte > HAUTEUR_SAUT) return false;
    if (monte < -400) return false;               // chute demesuree
    // Distance horizontale entre les deux surfaces (0 si elles se chevauchent).
    const aFin = (a.xMax || a.x + a.w), bFin = (b.xMax || b.x + b.w);
    const ecart = Math.max(0, Math.max(b.x - aFin, a.x - bFin));
    /* Portee horizontale reelle a la hauteur visee. Brad avance pendant toute
       la montee, PUIS pendant la redescente jusqu'a cette hauteur. Un modele
       en « pourcentage de la portee a plat » sous-estimait grossierement les
       petites marches et condamnait des plateformes parfaitement atteignables. */
    const tMontee = R.forceSaut / R.gravite;
    const restant = Math.max(0, HAUTEUR_SAUT - Math.max(0, monte));
    const tDescente = Math.sqrt(2 * restant / (R.gravite * R.graviteChute));
    const budget = R.vitesseMarche * (tMontee + tDescente) * 0.9;   // 10 % de marge
    return ecart <= budget;
  };

  let change = true;
  while (change) {
    change = false;
    for (let i = 0; i < surfaces.length; i++) {
      if (atteignable.has(i)) continue;
      for (const j of atteignable) {
        if (peutSauterVers(surfaces[j], surfaces[i])) { atteignable.add(i); change = true; break; }
      }
    }
  }
  const inatteignables = surfaces
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !atteignable.has(i))
    .map(({ s }) => `[${s.x / TUILE},${s.y / TUILE},${s.w / TUILE}]`);

  /* 3. Plafonds ------------------------------------------------------------
     a) au-dessus de l'elan qui precede un trou du sol ;
     b) au-dessus d'une marche a grimper. */
  const sols = solides.filter(s => s.y >= NIVEAU_H - 100 && s.h >= 48 && !estBord(s))
                      .sort((a, b) => a.x - b.x);
  /* Seuls les SOLIDES font plafond. Une traversante est franchissable par le
     bas — deplacerY() ne la teste qu'en descente — donc Brad la traverse en
     montant sans jamais s'y cogner. La compter comme un obstacle condamnait a
     tort la moitie des perchoirs. */
  const obstacles = solides.filter(s => !estBord(s));
  const plafonds = [];

  // a) elans
  for (let i = 1; i < sols.length; i++) {
    const bord = sols[i - 1].x + sols[i - 1].w;
    const largeur = sols[i].x - bord;
    if (largeur <= 0 || largeur > 400) continue;
    if (largeur > PORTEE_COURSE) {
      plafonds.push(`trou de ${largeur} px en x=${bord / TUILE} (portee ${Math.round(PORTEE_COURSE)})`);
    }
    for (const o of obstacles) {
      if (o.x + o.w < bord - 70 || o.x > bord + 10) continue;
      const libre = sols[i - 1].y - (o.y + o.h);
      if (libre > 4 && libre < HAUTEUR_SAUT + 40) {
        plafonds.push(`plafond a ${Math.round(libre)} px devant le trou de x=${bord / TUILE}`);
      }
    }
  }

  // b) marches
  for (const sol of sols) {
    for (let x = sol.x + 6; x < sol.x + sol.w; x += 6) {
      let marche = 0;
      for (const o of solides) {
        if (o === sol || estBord(o)) continue;
        if (x + BRAD_W >= o.x && x + BRAD_W <= o.x + o.w &&
            o.y < sol.y && o.y + o.h >= sol.y - 2) marche = Math.max(marche, sol.y - o.y);
      }
      if (marche <= 0) continue;
      let plafond = -1e9;
      for (const o of obstacles) {
        if (x >= o.x - 24 && x <= o.x + o.w && o.y + o.h <= sol.y - marche - 4) {
          plafond = Math.max(plafond, o.y + o.h);
        }
      }
      const libre = plafond === -1e9 ? 9999 : sol.y - plafond;
      if (libre < marche + BRAD_H + 8) {
        plafonds.push(`marche de ${marche} px sous un plafond de ${Math.round(libre)} px, x=${Math.round(x / TUILE)}`);
        break;   // une alerte par dalle suffit
      }
    }
  }

  return { superpositions, inatteignables, plafonds: Array.from(new Set(plafonds)) };
}

/* --- Rapport -------------------------------------------------------------- */

console.log('Saut : ' + Math.round(HAUTEUR_SAUT) + ' px de haut, ' +
            Math.round(PORTEE_MARCHE) + ' px de portee au pas, ' +
            Math.round(PORTEE_COURSE) + ' en courant.\n');

let defauts = 0;
for (const id of Object.keys(bac.NIVEAUX)) {
  const r = analyser(id);
  const n = r.superpositions.length + r.inatteignables.length + r.plafonds.length;
  defauts += n;
  console.log((n === 0 ? '  OK   ' : '  ECHEC ') + id + (n === 0 ? '' : ' — ' + n + ' defaut(s)'));
  r.superpositions.forEach(m => console.log('     superposition : ' + m));
  r.inatteignables.forEach(m => console.log('     inatteignable : ' + m));
  r.plafonds.forEach(m => console.log('     plafond       : ' + m));
}
console.log('\n' + (defauts === 0 ? 'Aucun defaut.' : defauts + ' defaut(s) au total.'));
process.exit(defauts ? 1 : 0);
