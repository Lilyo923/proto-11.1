/* =============================================================================
   BRAD BITT, MAIS LE JEU — le jukebox de la base

   Une borne posee dans la base. On l'active comme les autres postes, et elle
   choisit la musique d'ambiance : trois morceaux disponibles d'entree, trois
   autres caches derriere un code.

   Les codes viennent d'autres projets du studio. Ils ne se devinent pas : ils
   se donnent. C'est le principe — un code qu'on trouve en cherchant dans le
   jeu serait un secret, un code qu'on recoit est un clin d'oeil.

   Le morceau choisi est sauvegarde, comme les codes deja entres : revenir dans
   la base retrouve son ambiance.
   ========================================================================== */
'use strict';

const PISTES_JUKEBOX = [
  {
    cle: 'menu', nom: 'Classique', code: null,
    detail: 'Le thème de la base. Celui que le BRADDY3000 met en boucle depuis qu\'il a des enceintes.',
  },
  {
    cle: 'menu-chill', nom: 'Chill', code: null,
    detail: 'Plus lent, plus large. Pour compter ses Brad Coins sans se presser.',
  },
  {
    cle: 'menu-techno', nom: 'Techno', code: null,
    detail: 'Le BRADDY3000 assure que c\'est bon pour la productivité. Personne n\'a vérifié.',
  },
  {
    cle: 'menu-3IRL', nom: '3IRL', code: '3IRL',
    detail: 'Venu d\'un autre projet du studio. Le robot refuse d\'expliquer comment il l\'a eu.',
  },
  {
    cle: 'menu-CORE', nom: 'CORE', code: 'CORE',
    detail: 'Plus dense, plus sombre. À écouter quand la carte commence à faire peur.',
  },
  {
    cle: 'menu-N2S3', nom: 'N2S3', code: 'N2S3',
    detail: 'Le morceau le plus long de la borne. Le BRADDY3000 dit qu\'il « raconte quelque chose ».',
  },
];

const CODES_JUKEBOX = PISTES_JUKEBOX.filter(p => p.code);

function pisteJukebox(cle) { return PISTES_JUKEBOX.find(p => p.cle === cle) || PISTES_JUKEBOX[0]; }

/* Une piste sans code est toujours la ; une piste a code attend le sien. */
function pisteDebloquee(p) {
  return !p.code || partie.codes.indexOf(p.code) >= 0;
}

function pistesJukeboxVisibles() {
  // Les pistes verrouillees restent affichees, en gris : voir qu'il existe
  // trois morceaux de plus donne envie de chercher les codes.
  return PISTES_JUKEBOX;
}

/* La musique d'ambiance de la base, choisie au jukebox. */
function musiqueDeLaBase() {
  const p = pisteJukebox(partie.piste);
  return sourceMusique(pisteDebloquee(p) ? p.cle : 'menu');
}

function choisirPiste(cle) {
  const p = pisteJukebox(cle);
  if (!pisteDebloquee(p)) { audio.bruit('refus'); return false; }
  partie.piste = p.cle;
  enregistrerPartie();
  audio.bruit('valider');
  // On change de morceau tout de suite : le joueur doit entendre son choix
  // sans avoir a ressortir du jukebox.
  audio.jouerMusiqueDifferee(sourceMusique(p.cle), 0.8);
  return true;
}

/* -----------------------------------------------------------------------------
   SAISIE DES CODES
-------------------------------------------------------------------------- */

const jukebox = {
  onglet: 0,            // 0 = musiques, 1 = code
  index: 0,             // piste survolee
  saisie: '',           // code en cours de frappe
  message: '',
  messageT: 0,
  succes: false,
};

const CLAVIER_CODE = [
  'ABCDEFGHIJKLM'.split(''),
  'NOPQRSTUVWXYZ'.split(''),
  '0123456789'.split(''),
];

function ouvrirJukebox() {
  jukebox.onglet = 0;
  jukebox.index = Math.max(0, PISTES_JUKEBOX.findIndex(p => p.cle === partie.piste));
  jukebox.saisie = '';
  jukebox.message = '';
  jukebox.messageT = 0;
  scene = 'jukebox';
  audio.bruit('valider');
}

function noterJukebox(texte, succes) {
  jukebox.message = texte;
  jukebox.messageT = 4.0;
  jukebox.succes = !!succes;
}

function tapeCode(c) {
  if (jukebox.saisie.length >= 8) return;
  jukebox.saisie += c;
  audio.bruit('menu');
}

function effaceCode() {
  jukebox.saisie = jukebox.saisie.slice(0, -1);
  audio.bruit('menu');
}

/* Validation d'un code. La comparaison ignore la casse et les espaces : un
   joueur qui tape « n2s3 » a evidemment le bon code. */
function validerCode() {
  const saisi = jukebox.saisie.trim().toUpperCase();
  if (!saisi) return;
  const p = CODES_JUKEBOX.find(x => x.code === saisi);

  if (!p) {
    noterJukebox('Code inconnu. Le BRADDY3000 fait semblant de n\'avoir rien vu.', false);
    audio.bruit('refus');
    jukebox.saisie = '';
    return;
  }
  if (partie.codes.indexOf(p.code) >= 0) {
    noterJukebox('« ' + p.nom +' » est déjà dans la borne.', false);
    audio.bruit('refus');
    jukebox.saisie = '';
    return;
  }

  partie.codes.push(p.code);
  enregistrerPartie();
  jukebox.saisie = '';
  noterJukebox('« ' + p.nom + ' » ajouté à la borne !', true);
  audio.bruit('victoire');
  // On bascule sur la liste : le joueur voit immediatement le morceau
  // apparaitre en clair parmi les autres.
  jukebox.onglet = 0;
  jukebox.index = PISTES_JUKEBOX.indexOf(p);
  braddyDit('Un nouveau morceau. Je ne demande pas où tu l\'as eu. ' + p.nom + '.');
}

/* -----------------------------------------------------------------------------
   RENDU
-------------------------------------------------------------------------- */

function majJukebox(dt) {
  if (jukebox.messageT > 0) jukebox.messageT -= dt;
  hub.t += dt;
  hub.braddy.phase += dt;
  if (hub.reponseT > 0) { hub.reponseT -= dt; hub.reponseAge += dt; }
}

function dessinerJukebox() {
  cadrePanneau('JUKEBOX', 'La borne du BRADDY3000. Six morceaux, dont trois qu\'il cache.');

  // Onglets
  ['Musiques', 'Code'].forEach((nom, i) => {
    const x = 56 + i * 150, y = 76, w = 140, h = 24;
    const actif = jukebox.onglet === i;
    const survol = souris.survol && souris.survol.action === 'onglet-jukebox' &&
                   souris.survol.valeur === i;
    ctx.fillStyle = actif ? 'rgba(232,182,44,.2)'
                  : (survol ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)');
    ctx.fillRect(x, y, w, h);
    if (actif) { ctx.fillStyle = ACCENT; ctx.fillRect(x, y + h - 2, w, 2); }
    texteCentreEn(nom, x + w / 2, y + 16, (actif ? 'bold ' : '') + '11px system-ui, sans-serif',
                  actif ? '#ffe9a8' : 'rgba(255,255,255,.6)');
    zone(x, y, w, h, 'onglet-jukebox', i);
  });

  if (jukebox.onglet === 0) dessinerListePistes();
  else dessinerSaisieCode();

  // Message commun aux deux onglets
  if (jukebox.messageT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, jukebox.messageT);
    texteCentre(jukebox.message, HAUTEUR - 52, '11px system-ui, sans-serif',
                jukebox.succes ? '#7ee08a' : '#e2553b');
    ctx.restore();
  }

  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillText(jukebox.onglet === 0
    ? 'Flèches choisir  ·  Entrée écouter  ·  ← → onglet  ·  Échap sortir'
    : 'Tape le code au clavier ou touche les lettres  ·  Entrée valider  ·  Échap sortir',
    56, HAUTEUR - 33);
}

function dessinerListePistes() {
  const liste = pistesJukeboxVisibles();
  let y = 116;

  liste.forEach((p, i) => {
    const actif = i === jukebox.index;
    const ouverte = pisteDebloquee(p);
    const jouee = partie.piste === p.cle && ouverte;
    const survol = souris.survol && souris.survol.action === 'piste' && souris.survol.valeur === i;
    if (survol && souris.bouge && i !== jukebox.index) jukebox.index = i;

    ctx.fillStyle = actif ? 'rgba(232,182,44,.14)' : 'rgba(255,255,255,.03)';
    ctx.fillRect(56, y - 12, LARGEUR - 112, 26);
    if (jouee) { ctx.fillStyle = ACCENT; ctx.fillRect(56, y - 12, 3, 26); }

    if (ouverte) {
      // Petit egaliseur anime devant la piste en cours : on voit tout de suite
      // laquelle sort des enceintes.
      if (jouee) {
        for (let k = 0; k < 3; k++) {
          const h = 3 + Math.abs(Math.sin(hub.t * 4 + k)) * 8;
          ctx.fillStyle = ACCENT;
          ctx.fillRect(68 + k * 4, y + 5 - h, 3, h);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.beginPath();
        ctx.moveTo(68, y - 4); ctx.lineTo(78, y + 1); ctx.lineTo(68, y + 6);
        ctx.closePath(); ctx.fill();
      }
    } else {
      dessinerCadenas(73, y + 1, 0.55, 'rgba(255,255,255,.25)');
    }

    /* Un morceau verrouille ne dit PAS son nom : le nom EST le code. L'afficher
       revenait a donner la reponse, et le secret n'en etait plus un. On garde
       seulement le fait qu'il existe quelque chose a trouver. */
    ctx.font = (actif ? 'bold ' : '') + '12px system-ui, sans-serif';
    ctx.fillStyle = ouverte ? (jouee ? ACCENT : '#e6e8f0') : 'rgba(255,255,255,.3)';
    ctx.fillText(ouverte ? p.nom : '? ? ?', 90, y + 2);

    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.textAlign = 'right';
    ctx.fillText(ouverte ? (jouee ? 'en cours' : '') : 'code requis', LARGEUR - 64, y + 2);
    ctx.textAlign = 'left';

    zone(56, y - 12, LARGEUR - 112, 26, 'piste', i);
    y += 30;
  });

  // Description de la piste survolee
  const p = liste[jukebox.index];
  if (p) {
    ctx.font = 'italic 10px system-ui, sans-serif';
    ctx.fillStyle = pisteDebloquee(p) ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.32)';
    envelopper(pisteDebloquee(p) ? p.detail
                                 : 'Verrouillé. Il existe un code pour ça.',
               56, HAUTEUR - 74, LARGEUR - 112, 13);
  }
}

function dessinerSaisieCode() {
  texteCentre('Un code te donne un morceau d\'un autre projet du studio.',
              108, '11px system-ui, sans-serif', 'rgba(255,255,255,.5)');

  // Champ de saisie
  const l = 220, x = (LARGEUR - l) / 2, y = 122;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.fillRect(x, y, l, 30);
  ctx.strokeStyle = 'rgba(232,182,44,.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, l - 1, 29);
  const curseur = Math.sin(hub.t * 5) > 0 ? '_' : ' ';
  texteCentreEn((jukebox.saisie || '') + curseur, x + l / 2, y + 21,
                'bold 16px monospace, monospace', '#ffe9a8');

  /* Clavier a l'ecran. Il ne sert pas qu'au tactile : le canvas n'a pas de
     champ de texte, et un joueur qui ne sait pas qu'il peut taper au clavier
     resterait bloque devant un rectangle vide. */
  const cw = 30, ch = 22;
  let ky = 164;
  for (const rangee of CLAVIER_CODE) {
    const total = rangee.length * cw;
    let kx = (LARGEUR - total) / 2;
    for (const c of rangee) {
      const survol = souris.survol && souris.survol.action === 'code-touche' &&
                     souris.survol.valeur === c;
      ctx.fillStyle = survol ? 'rgba(232,182,44,.25)' : 'rgba(255,255,255,.06)';
      ctx.fillRect(kx + 1, ky, cw - 2, ch);
      texteCentreEn(c, kx + cw / 2, ky + 15, '11px system-ui, sans-serif',
                    survol ? '#ffe9a8' : 'rgba(255,255,255,.7)');
      zone(kx + 1, ky, cw - 2, ch, 'code-touche', c);
      kx += cw;
    }
    ky += ch + 3;
  }

  // Effacer / Valider
  const bl = 110, by = ky + 6;
  [['Effacer', 'code-effacer', LARGEUR / 2 - bl - 6],
   ['Valider', 'code-valider', LARGEUR / 2 + 6]].forEach(([nom, action, bx]) => {
    const survol = souris.survol && souris.survol.action === action;
    const primaire = action === 'code-valider';
    ctx.fillStyle = primaire
      ? (survol ? 'rgba(232,182,44,.32)' : 'rgba(232,182,44,.16)')
      : (survol ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)');
    ctx.fillRect(bx, by, bl, 24);
    ctx.strokeStyle = primaire ? '#e8b62c' : 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + .5, by + .5, bl - 1, 23);
    texteCentreEn(nom, bx + bl / 2, by + 16,
                  (primaire ? 'bold ' : '') + '12px system-ui, sans-serif',
                  primaire ? '#ffe9a8' : 'rgba(255,255,255,.7)');
    zone(bx, by, bl, 24, action);
  });

  // Compteur de codes trouves
  texteCentre(partie.codes.length + ' / ' + CODES_JUKEBOX.length + ' codes trouvés',
              HAUTEUR - 68, '10px system-ui, sans-serif', 'rgba(255,255,255,.35)');
}

/* -----------------------------------------------------------------------------
   LA BORNE, DANS LE DECOR DE LA BASE
-------------------------------------------------------------------------- */

function dessinerBorneJukebox(x) {
  // Caisson
  ctx.fillStyle = '#2a2036';
  ctx.fillRect(x - 26, -78, 52, 78);
  ctx.fillStyle = '#3b2f4c';
  ctx.fillRect(x - 26, -78, 52, 6);
  // Dome lumineux
  ctx.fillStyle = '#4a3a60';
  ctx.beginPath();
  ctx.ellipse(x, -78, 26, 14, 0, Math.PI, 0);
  ctx.fill();
  const pulse = 0.35 + 0.3 * Math.sin(hub.t * 2.2);
  ctx.fillStyle = 'rgba(232,120,200,' + pulse.toFixed(2) + ')';
  ctx.beginPath();
  ctx.ellipse(x, -80, 18, 9, 0, Math.PI, 0);
  ctx.fill();

  // Vitre : les disques
  ctx.fillStyle = '#141020';
  ctx.fillRect(x - 20, -68, 40, 30);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#e8b62c', '#6fd0e8', '#e8789b'][i];
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(x - 12 + i * 12, -53 + Math.sin(hub.t * 1.5 + i) * 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#141020';
    ctx.beginPath();
    ctx.arc(x - 12 + i * 12, -53 + Math.sin(hub.t * 1.5 + i) * 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grille de haut-parleur
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let gy = -34; gy < -8; gy += 4) ctx.fillRect(x - 18, gy, 36, 2);

  // Egaliseur, cale sur la piste en cours
  for (let k = 0; k < 5; k++) {
    const h = 3 + Math.abs(Math.sin(hub.t * 5 + k * 1.3)) * 9;
    ctx.fillStyle = 'rgba(232,182,44,.6)';
    ctx.fillRect(x - 14 + k * 7, -6 - h, 4, h);
  }
}
