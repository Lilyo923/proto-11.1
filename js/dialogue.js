/* =============================================================================
   BRAD BITT, MAIS LE JEU — dialogues

   Une boite de texte en bas d'ecran, un nom d'interlocuteur, un effet machine
   a ecrire, et un clic pour avancer. Le premier clic termine la ligne en
   cours plutot que de la sauter : c'est la convention que tout le monde
   connait, et elle evite de rater une replique en cliquant trop vite.

   Un dialogue est un simple tableau :
     [{ qui: 'brad', texte: '…', fond: 'ciel' }, …]
   `fond` est optionnel et change l'illustration derriere la boite.
   ========================================================================== */
'use strict';

const VITESSE_TEXTE = 42;        // caracteres par seconde

const PARLEURS = {
  brad:      { nom: 'BRAD BITT',   couleur: '#e8b62c' },
  braddy:    { nom: 'BRADDY3000',  couleur: '#6fd0e8' },
  narrateur: { nom: '',            couleur: '#9aa0bb' },
  kirby:     { nom: 'KIRBY 67',    couleur: '#e2553b' },
};

const dialogue = {
  lignes: [],
  index: 0,
  reveles: 0,        // caracteres affiches
  fini: false,
  suite: null,       // fonction appelee a la fin
  fond: 'ciel',
  surHub: false,     // joue par-dessus la base, avec Brad et le BRADDY3000 visibles
};

function lancerDialogue(lignes, suite) {
  dialogue.lignes = lignes;
  dialogue.index = 0;
  dialogue.reveles = 0;
  dialogue.fini = false;
  dialogue.suite = suite || null;
  dialogue.fond = lignes[0] && lignes[0].fond ? lignes[0].fond : 'ciel';
  // Un dialogue « sur le hub » se joue dans le decor de la base : on voit Brad,
  // on voit le BRADDY3000, et la camera se tourne vers ce dont il parle.
  dialogue.surHub = !!(lignes[0] && lignes[0].surHub);
  // Une bulle du BRADDY3000 encore ouverte se superposerait a la boite de
  // texte : deux repliques a la fois, illisible.
  hub.reponse = '';
  hub.reponseT = 0;
  hub.reponseAge = 0;
  scene = 'dialogue';
}

/* De combien la base est remontee pendant un dialogue joue devant elle. Sans
   ce decalage, le sol du hub tombe derriere la boite de texte et on ne voit
   plus ni Brad ni le robot — or c'est justement ce qu'on veut montrer. */
const REMONTEE_HUB = 62;

function ligneCourante() { return dialogue.lignes[dialogue.index] || null; }

function majDialogue(dt) {
  const l = ligneCourante();
  if (!l) return;
  if (dialogue.reveles < l.texte.length) {
    dialogue.reveles = Math.min(l.texte.length, dialogue.reveles + VITESSE_TEXTE * dt);
  }

  if (!dialogue.surHub) return;
  // La base continue de vivre pendant qu'on parle.
  hub.t += dt;
  hub.braddy.phase += dt;
  if (hub.brad) { hub.brad.phaseRepos += dt; hub.brad.inactif += dt; }

  // La camera se tourne vers le poste dont il est question. Montrer la chose
  // en meme temps qu'on en parle vaut mieux que de la decrire.
  const poste = l.regarde ? POSTES.find(p => p.cle === l.regarde) : null;
  const cible = poste ? poste.x - LARGEUR / 2
                      : (hub.brad ? hub.brad.x + hub.brad.w / 2 - LARGEUR / 2 : camHub.x);
  camHub.x += (cible - camHub.x) * Math.min(1, 2.2 * dt);
  camHub.x = Math.max(0, Math.min(HUB_L - LARGEUR, camHub.x));

  /* Les deux interlocuteurs suivent la visite. Le robot flotte a gauche de ce
     qu'il montre, Brad marche derriere lui : la camera peut ainsi se tourner
     vers n'importe quel poste sans jamais laisser la scene vide. */
  if (hub.brad) {
    const ancre = camHub.x + LARGEUR * 0.42;
    const suivi = Math.min(1, 1.8 * dt);
    hub.braddy.x += (ancre - hub.braddy.x) * suivi;
    const versBrad = ancre - 78 - hub.brad.w / 2;
    const avant = hub.brad.x;
    hub.brad.x += (versBrad - hub.brad.x) * suivi;
    hub.brad.x = Math.max(40, Math.min(HUB_L - 62, hub.brad.x));
    // Brad marche vraiment : le cycle de pas s'indexe sur la distance, jamais
    // sur le temps, sinon il pedale sur place.
    const pas = hub.brad.x - avant;
    if (Math.abs(pas) > 0.05) {
      hub.brad.sens = pas > 0 ? 1 : -1;
      hub.brad.phaseMarche += Math.abs(pas) / LONGUEUR_PAS;
      hub.brad.inactif = 0;
    }
  }
}

/* Avance : d'abord completer la ligne, puis passer a la suivante. */
function avancerDialogue() {
  const l = ligneCourante();
  if (!l) return;
  if (dialogue.reveles < l.texte.length) {
    dialogue.reveles = l.texte.length;
    return;
  }
  dialogue.index++;
  dialogue.reveles = 0;
  const suivante = ligneCourante();
  if (!suivante) {
    dialogue.fini = true;
    const f = dialogue.suite;
    dialogue.suite = null;
    if (f) f();
    return;
  }
  if (suivante.fond) dialogue.fond = suivante.fond;
  if (suivante.surHub !== undefined) dialogue.surHub = !!suivante.surHub;
  audio.bruit('menu');
}

function passerDialogue() {
  dialogue.index = dialogue.lignes.length;
  dialogue.reveles = 0;
  dialogue.fini = true;
  const f = dialogue.suite;
  dialogue.suite = null;
  audio.bruit('menu');
  if (f) f();
}

/* -----------------------------------------------------------------------------
   RENDU
-------------------------------------------------------------------------- */

/* Illustrations de fond. Dessinees en primitives : produire des vraies images
   pour une intro qui sera reecrite serait du travail jete. */
function fondDialogue(nom) {
  const t = performance.now() / 1000;

  if (nom === 'ciel') {
    const g = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
    g.addColorStop(0, '#28406e'); g.addColorStop(1, '#8ea7c4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    // toits d'une ville tranquille, en contre-jour
    ctx.fillStyle = '#2a3350';
    for (let i = 0; i < 9; i++) {
      const h = 34 + ((i * 37) % 46);
      ctx.fillRect(i * 76 - 20, 232 - h, 62, h + 40);
      ctx.fillStyle = 'rgba(232,182,44,.18)';
      for (let f = 0; f < 3; f++) ctx.fillRect(i * 76 - 8 + f * 18, 240 - h + 8, 8, 9);
      ctx.fillStyle = '#2a3350';
    }
    ctx.fillStyle = '#1b2136'; ctx.fillRect(0, 272, LARGEUR, HAUTEUR - 272);
    ctx.fillStyle = '#232a44'; ctx.fillRect(0, 272, LARGEUR, 4);
    return;
  }

  if (nom === 'telephone') {
    ctx.fillStyle = '#12161f'; ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    // un ecran de telephone, en gros, au centre
    const w = 150, h = 210, x = (LARGEUR - w) / 2, y = 24;
    ctx.fillStyle = '#0a0d14'; ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = '#1d2740'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(111,208,232,' + (0.5 + 0.5 * Math.sin(t * 3)).toFixed(2) + ')';
    ctx.fillRect(x + 12, y + 26, w - 24, 34);
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0d14';
    ctx.fillText('1 NOUVEAU MESSAGE', x + w / 2, y + 47);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(x + 12, y + 76, w - 24, 6);
    ctx.fillRect(x + 12, y + 92, w - 60, 6);
    ctx.textAlign = 'left';
    return;
  }

  if (nom === 'portail') {
    ctx.fillStyle = '#0a0714'; ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    // spirale de teleportation
    ctx.save();
    ctx.translate(LARGEUR / 2, 150);
    for (let i = 8; i > 0; i--) {
      const r = i * 17 + Math.sin(t * 2 + i) * 4;
      ctx.strokeStyle = 'rgba(' + (140 - i * 8) + ',' + (60 + i * 14) + ',220,' + (0.15 + i * 0.05).toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r, t * (i % 2 ? 1 : -1) + i, t * (i % 2 ? 1 : -1) + i + 4.4);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (nom === 'complexe') {
    const g = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
    g.addColorStop(0, '#0f1520'); g.addColorStop(1, '#1d2a2c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 10; i++) ctx.fillRect(i * 68 + 10, 0, 14, HAUTEUR);
    // debris de telecommande au sol
    ctx.fillStyle = '#2a3140'; ctx.fillRect(LARGEUR / 2 - 26, 236, 52, 12);
    ctx.fillStyle = '#e2553b'; ctx.fillRect(LARGEUR / 2 - 18, 240, 6, 4);
    ctx.fillStyle = '#1a1f28';
    ctx.fillRect(LARGEUR / 2 + 12, 244, 18, 5);
    ctx.fillRect(LARGEUR / 2 - 42, 246, 12, 4);
    return;
  }

  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
}

function dessinerDialogue() {
  if (dialogue.surHub) {
    // Le bas de l'ecran appartient a la boite de texte : on remonte toute la
    // base pour que le sol, Brad et le robot restent au-dessus d'elle.
    ctx.fillStyle = '#232839';
    ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
    ctx.save();
    ctx.translate(0, -REMONTEE_HUB);
    dessinerHub();
    ctx.restore();
    // Un voile leger : le decor reste lisible mais passe derriere le texte.
    ctx.fillStyle = 'rgba(9,11,20,.42)';
    ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  } else {
    fondDialogue(dialogue.fond);
  }

  const l = ligneCourante();
  if (!l) return;
  const p = PARLEURS[l.qui] || PARLEURS.narrateur;

  // Boite de texte
  const bx = 34, bh = 92, by = HAUTEUR - bh - 20, bw = LARGEUR - bx * 2;
  ctx.fillStyle = 'rgba(9,11,20,.9)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(232,182,44,.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

  // Etiquette du parleur
  if (p.nom) {
    ctx.font = 'bold 11px system-ui, sans-serif';
    const l2 = ctx.measureText(p.nom).width + 16;
    ctx.fillStyle = 'rgba(9,11,20,.95)';
    ctx.fillRect(bx + 12, by - 10, l2, 19);
    ctx.strokeStyle = 'rgba(232,182,44,.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 12.5, by - 9.5, l2 - 1, 18);
    ctx.fillStyle = p.couleur;
    ctx.fillText(p.nom, bx + 20, by + 3);
  }

  // Texte, coupe en lignes et revele progressivement
  const visible = l.texte.slice(0, Math.floor(dialogue.reveles));
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#e6e8f0';
  const largeurMax = bw - 36;
  let ligne = '';
  let y = by + 30;
  for (const mot of visible.split(' ')) {
    const essai = ligne ? ligne + ' ' + mot : mot;
    if (ctx.measureText(essai).width > largeurMax && ligne) {
      ctx.fillText(ligne, bx + 18, y);
      y += 17;
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) ctx.fillText(ligne, bx + 18, y);

  // Curseur « continuer », une fois la ligne finie
  if (dialogue.reveles >= l.texte.length) {
    const c = Math.sin(performance.now() / 260) > 0 ? 1 : 0.35;
    ctx.globalAlpha = c;
    ctx.fillStyle = '#e8b62c';
    const fx = bx + bw - 22, fy = by + bh - 18;
    ctx.beginPath();
    ctx.moveTo(fx, fy); ctx.lineTo(fx + 9, fy); ctx.lineTo(fx + 4.5, fy + 6);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ATTENTION A L'ORDRE. zoneSousSouris() parcourt la pile a l'envers, donc la
  // DERNIERE zone enregistree gagne. Le rectangle plein ecran doit donc etre
  // pose EN PREMIER, sinon il recouvre le bouton « Passer » et l'avale.
  zone(0, 0, LARGEUR, HAUTEUR, 'avancer-dialogue');

  /* « Passer » se pose JUSTE AU-DESSUS de la boite de texte, pas dans le coin
     haut-droit. Le bouton HTML « ⚙ Réglages » est en position fixe dans ce
     coin, par-dessus le canvas : un clic y atterrissait sur lui et jamais sur
     « Passer ». C'est la vraie cause du bouton qui ne repondait pas. */
  const px = bx + bw - 80, py = by - 32, pw = 78, ph = 22;
  const survol = souris.survol && souris.survol.action === 'passer-dialogue';
  ctx.fillStyle = survol ? 'rgba(255,255,255,.2)' : 'rgba(9,11,20,.7)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = survol ? 'rgba(232,182,44,.7)' : 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + .5, py + .5, pw - 1, ph - 1);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = survol ? '#ffe9a8' : 'rgba(255,255,255,.7)';
  ctx.fillText('Passer  ▸▸', px + pw / 2, py + 15);

  // Le compteur se pose a GAUCHE du bouton, sur la meme ligne : pose au-dessus
  // de la boite comme avant, il finissait sous « Passer ».
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  ctx.fillText((dialogue.index + 1) + ' / ' + dialogue.lignes.length, px - 10, py + 15);
  ctx.textAlign = 'left';

  zone(px, py, pw, ph, 'passer-dialogue');
}

/* -----------------------------------------------------------------------------
   SCRIPTS
-------------------------------------------------------------------------- */

/* Ouverture du jeu. La version retenue dans les notes : Brad reçoit une
   notification, s'y rend, et casse la telecommande a l'atterrissage. */
const DIALOGUE_INTRO = [
  { qui: 'narrateur', fond: 'ciel',
    texte: 'Un mardi. Brad Bitt sort les poubelles, comme tous les mardis. Le quartier est calme. Trop calme, diront certains. Personne, en fait.' },
  { qui: 'brad', fond: 'ciel',
    texte: 'Voilà. Poubelles sorties. Journée productive.' },
  { qui: 'narrateur', fond: 'telephone',
    texte: 'Son téléphone vibre.' },
  { qui: 'braddy', fond: 'telephone',
    texte: 'BONJOUR BRAD. C\'EST MOI. LE BRADDY3000. J\'AI RETROUVÉ KIRBY 67. Il est dans le monde parallèle et il a commencé quelque chose de très moche.' },
  { qui: 'brad', fond: 'telephone',
    texte: 'Le monde parallèle ? Celui où je l\'avais justement envoyé pour qu\'il arrête d\'être un problème ?' },
  { qui: 'braddy', fond: 'telephone',
    texte: 'CELUI-LÀ MÊME. Il l\'a pris. Entièrement. Il appelle ça « un monde au Serrano ». Tout le monde y est heureux. C\'est le problème.' },
  { qui: 'brad', fond: 'telephone',
    texte: 'J\'arrive. Envoie les coordonnées.' },
  { qui: 'braddy', fond: 'portail',
    texte: 'ENVOYÉES. J\'AI PRÉPARÉ UNE TÉLÉCOMMANDE DE RETOUR. Ne la casse pas. Je le précise parce que statistiquement, tu vas la casser.' },
  { qui: 'brad', fond: 'portail',
    texte: 'Je ne casse jamais rien.' },
  { qui: 'narrateur', fond: 'complexe',
    texte: 'Brad Bitt atterrit dans le monde parallèle. La télécommande de retour atterrit trois mètres plus loin, en quatre morceaux.' },
  { qui: 'brad', fond: 'complexe',
    texte: '…' },
  { qui: 'braddy', fond: 'complexe',
    texte: 'JE NE DIRAI RIEN.' },
  { qui: 'brad', fond: 'complexe',
    texte: 'Bon. On fait comme d\'habitude, alors. Je traverse, je tape ce qui bouge, et je rentre à pied.' },
  { qui: 'braddy', fond: 'complexe',
    texte: 'C\'EST EXACTEMENT COMME ÇA QUE ÇA S\'EST PASSÉ LES TROIS FOIS PRÉCÉDENTES. Bonne chance, Brad.' },
];

/* Arrivee au hub, apres le niveau d'introduction.

   Ce dialogue-la se joue DANS la base : on voit Brad, on voit le BRADDY3000
   flotter, et la camera se tourne vers chaque poste au moment ou il en parle.
   Decrire un comptoir pendant qu'on le regarde vaut mieux que de le decrire
   sur fond noir. */
const DIALOGUE_HUB = [
  { qui: 'braddy', surHub: true,
    texte: 'BRAD. J\'AI TROUVÉ UN ABRI. Une vieille station du complexe, oubliée par tout le monde, Kirby 67 compris. J\'y ai monté une base.' },
  { qui: 'brad', surHub: true,
    texte: 'Tu as monté une base. En quarante minutes.' },
  { qui: 'braddy', surHub: true,
    texte: 'J\'AI EU LE TEMPS.' },

  { qui: 'braddy', surHub: true, regarde: 'boutique',
    texte: 'Là, c\'est la boutique. C\'est moi. Tes Brad Coins s\'y échangent contre de la vie, des dégâts, de la résistance. Ça monte à chaque palier, alors garde-en.' },
  { qui: 'braddy', surHub: true, regarde: 'vestiaire',
    texte: 'Là, le vestiaire. C\'est aussi moi. Les uniformes sont GRATUITS — ils se débloquent quand tu accomplis des choses.' },
  { qui: 'brad', surHub: true, regarde: 'vestiaire',
    texte: 'Donc je ne choisis jamais entre être fort et être beau.' },
  { qui: 'braddy', surHub: true, regarde: 'vestiaire',
    texte: 'EXACT. J\'AI RÉFLÉCHI À LA QUESTION PENDANT QUARANTE MINUTES.' },

  { qui: 'braddy', surHub: true, regarde: 'entrainement',
    texte: 'Le camp d\'entraînement. Les Serra y reviennent en boucle et rien n\'y rapporte quoi que ce soit. C\'est volontaire : on s\'y exerce, on n\'y travaille pas.' },
  { qui: 'braddy', surHub: true, regarde: 'arcade',
    texte: 'La borne, je l\'ai réparée parce que je m\'ennuyais. Trois parties par jour. Ne discute pas, c\'est moi qui compte.' },

  { qui: 'braddy', surHub: true, regarde: 'carte',
    texte: 'Et au fond, la carte. Dix niveaux avant de retrouver Kirby 67. Enfin, dix en théorie. Je n\'ai pas vérifié.' },
  { qui: 'brad', surHub: true, regarde: 'carte',
    texte: 'Tu n\'as jamais rien vérifié.' },
  { qui: 'braddy', surHub: true,
    texte: 'ET POURTANT NOUS VOILÀ. Vas-y quand tu veux, Brad. Je reste ici. Je n\'ai pas de jambes.' },
];

/* -----------------------------------------------------------------------------
   REPLIQUES DU BRADDY3000

   Deux usages : quand on lui parle dans la base (touche E ou clic), et quand
   on rentre d'un niveau. Elles changent selon l'avancement — un compagnon qui
   dit la meme chose au bout de dix niveaux cesse d'etre un compagnon.
-------------------------------------------------------------------------- */

function auHasard(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

/* Ce qu'il dit quand on rentre de mission. */
function repliqueRetourNiveau() {
  const n = partie.termines.length;
  const communes = [
    'Bien. Nous nous rapprochons de Kirby 67. Du moins en théorie.',
    'Encore un niveau derrière nous. Je tiens un tableau. Personne ne me l\'a demandé.',
    'Tu es rentré entier. Statistiquement, c\'était l\'issue la moins probable.',
    'J\'ai calculé ton itinéraire optimal pendant que tu jouais. Tu n\'as suivi aucune de mes recommandations.',
    'Le Serrano recule. Lentement. Comme une marée, mais en plus gras.',
  ];
  if (n <= 1) {
    return auHasard(communes.concat([
      'Premier niveau bouclé. Il en reste neuf. Ou dix. J\'ai perdu le compte.',
      'Passe à la boutique. Tu vas en avoir besoin, et moi j\'ai besoin de compagnie.',
    ]));
  }
  if (n < 5) {
    return auHasard(communes.concat([
      'Kirby 67 a forcément remarqué. Il n\'est pas malin, mais il est observateur.',
      'À ce rythme, on y sera pour février. Février de quelle année, je ne me prononce pas.',
    ]));
  }
  return auHasard(communes.concat([
    'La moitié du chemin. C\'est le moment où, dans les films, quelque chose tourne mal.',
    'J\'ai un mauvais pressentiment. Ou une surchauffe. Les deux se ressemblent beaucoup.',
  ]));
}

/* Ce qu'il dit quand on sort du camp d'entrainement. */
function repliqueSortieEntrainement() {
  return auHasard([
    'Bel entraînement. Aucune récompense, comme prévu. C\'est ce qui en fait un entraînement.',
    'Tu as tapé sur des Serra qui reviennent toujours. C\'est très sain. Ne le fais pas trop longtemps.',
    'J\'ai compté tes coups. Je ne te dirai pas combien tu en as raté.',
    'Les Serra du camp ne t\'en veulent pas. Ils n\'ont pas d\'opinion, en fait.',
  ]);
}

/* Ce qu'il dit quand Brad lui parle dans la base. */
function repliqueBraddy() {
  const n = partie.termines.length;
  const paliers = typeof paliersAchetes === 'function' ? paliersAchetes() : 0;

  const conseils = [];
  if (partie.pieces >= 30) {
    conseils.push('Tu as de quoi acheter quelque chose. Ça me ferait plaisir. Enfin, ça ferait quelque chose.');
  }
  if (paliers === 0) {
    conseils.push('Un conseil : la barre de vie en premier. Mourir coûte plus cher que tout le reste.');
  }
  if (partie.ameliorations.degats === 0 && paliers > 0) {
    conseils.push('Les dégâts, c\'est ce qui raccourcit les combats. Et les combats courts, c\'est moins de coups reçus.');
  }
  if (partie.entrainements === 0) {
    conseils.push('Le camp d\'entraînement ne rapporte rien. C\'est exactement pour ça qu\'il est utile.');
  }
  if (partie.meilleurArcade === 0) {
    conseils.push('Essaie la borne. Cent points valent un Brad Coin. Ce n\'est pas beaucoup, mais c\'est honnête.');
  }
  conseils.push('N\'oublie pas : tu peux marcher sur la tête du Serra-Lourd. Il déteste ça. Enfin je suppose.');
  conseils.push('Le Lanceur est blindé. Renvoie-lui sa boule. C\'est de la poésie, techniquement.');

  const absurdes = [
    'J\'ai rêvé cette nuit. Je ne dors pas, donc c\'est inquiétant.',
    'Est-ce que le Serrano est un fromage ? J\'ai passé trois heures dessus. Toujours pas de réponse.',
    'Si tu m\'écoutes assez longtemps, je finirai par dire quelque chose d\'utile. Statistiquement.',
    'J\'ai renommé mes fichiers internes en « truc_1 » à « truc_9000 ». Je le regrette déjà.',
    'Tu savais que j\'ai un mode furtif ? Il ne marche pas. Mais il existe.',
    'Ta cravate est réglementaire. J\'ai vérifié le règlement. Je l\'ai aussi écrit.',
    'Kirby 67 a un plan. J\'ai un tableur. Nous ne jouons pas dans la même catégorie.',
    'Parfois je me demande ce qu\'il y a derrière le mur du fond. Puis je me souviens que je l\'ai peint.',
    'On m\'a construit pour trier du courrier. Regarde où j\'en suis.',
  ];

  if (n >= 2) {
    absurdes.push('Deux niveaux. Je commence à croire que tu vas y arriver. Ne me déçois pas, j\'ai peu de sentiments et je les investis mal.');
  }
  if (n >= 5) {
    absurdes.push('À mi-parcours, les héros doutent. Toi tu manges. C\'est une approche.');
  }
  if (partie.uniforme === 'dore') {
    absurdes.push('Ce costume doré te va bien. Il te rend légèrement insupportable, mais il te va bien.');
  }

  /* Le fil rouge : l'appareil a raclette. Il en parle differemment selon ce
     qu'on a deja rapporte, et il en parle SOUVENT quand une piece vient
     d'arriver — c'est la seule chose qui fasse avancer l'histoire, il serait
     absurde qu'il l'evoque aussi rarement qu'une blague sur sa cravate. */
  conseils.push(...repliquesObjets());

  // Deux fois sur trois un conseil, une fois sur trois n'importe quoi.
  return Math.random() < 0.66 ? auHasard(conseils) : auHasard(absurdes);
}

/* -----------------------------------------------------------------------------
   L'APPAREIL A RACLETTE

   Trois pieces, trois boss, tous les trois niveaux. Le BRADDY3000 est le seul
   personnage a savoir pourquoi on les cherche : c'est donc lui qui porte
   l'histoire, replique par replique.
-------------------------------------------------------------------------- */

function repliquesObjets() {
  const n = objetsTrouves();

  if (n === 0) {
    return [
      'J\'ai une piste pour Kirby 67. Elle est ridicule. Elle implique une raclette.',
      'Kirby 67 ne répond à aucun appel. Mais il n\'a jamais résisté à une odeur de fromage fondu. C\'est documenté.',
      'Trois pièces : un poêlon, de quoi le remplir, et la machine. Réunies, elles le feront sortir de son trou.',
      'Chaque pièce est gardée. Évidemment qu\'elles sont gardées. Rien n\'est jamais posé sur une table.',
    ];
  }

  if (n === 1) {
    return [
      'Un poêlon. Un seul. Je ne vais pas te mentir, il en faudrait huit, mais on fera avec.',
      'La première pièce est là. Il en manque deux : la garniture et la machine. Dans cet ordre, si le monde est bien fait.',
      'Regarde la vitrine si tu doutes de nos progrès. Elle est aux deux tiers vide, mais elle existe.',
      'Le gardien du poêlon se blindait quand il avait peur. Nous avons tous nos méthodes.',
    ];
  }

  if (n === 2) {
    return [
      'Le poêlon et la garniture. Il ne manque que l\'appareil. C\'est-à-dire l\'essentiel.',
      'Deux pièces sur trois. À ce stade, ce n\'est plus un plan, c\'est presque un repas.',
      'La dernière pièce est loin. Très loin. Il faudra une fusée, et je préfère t\'en parler plus tard.',
    ];
  }

  return [
    'Les trois pièces sont là. Je peux calculer la position de Kirby 67. Enfin — je peux essayer, et cette fois j\'ai des données.',
    'Poêlon, garniture, appareil. Il va sentir le fromage à des kilomètres. Il viendra. Il vient toujours.',
    'L\'appareil est complet. Le manoir nous attend. Prends une cravate propre.',
  ];
}

/* Ce qu'il dit au retour d'un niveau ou une piece vient d'etre ramassee : ça
   prime sur le commentaire de mission habituel, l'evenement est trop gros. */
function repliqueObjetRapporte(cle) {
  const o = OBJETS_MAJEURS.find(x => x.cle === cle);
  if (!o) return null;
  const reste = OBJETS_MAJEURS.length - objetsTrouves();

  if (reste === 0) {
    return 'TU L\'AS. Les trois pièces. Je lance le calcul. Brad — je crois que je sais où il est.';
  }
  return o.prise + ' Encore ' + reste + ' pièce' + (reste > 1 ? 's' : '') + '.';
}
