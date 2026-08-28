/* =============================================================================
   BRAD BITT, MAIS LE JEU — sauvegarde et progression

   Tout ce que le joueur accumule vit ici : Brad Coins, ameliorations achetees,
   uniformes debloques, niveaux termines, parties d'arcade du jour.

   Un seul emplacement pour l'instant ; les notes prevoient plusieurs
   sauvegardes par profil, d'ou la forme d'objet plat facile a dupliquer.
   ========================================================================== */
'use strict';

const CLE_SAUVEGARDE = 'bradbitt.partie.v2';

const DIFFICULTES = [
  { cle: 'touriste',    nom: 'Touriste',    note: 'Pour l\'histoire. Les ennemis tapent moins fort.',
    degats: 0.5, pvEnnemi: 1, recompense: 1 },
  { cle: 'connaisseur', nom: 'Connaisseur', note: 'L\'équilibre prévu.',
    degats: 1, pvEnnemi: 1, recompense: 1 },
  { cle: 'salé',        nom: 'Salé',        note: 'Le BRADDY3000 ne vous le recommande pas. +20 % de récompenses.',
    degats: 1.5, pvEnnemi: 1.5, recompense: 1.2 },
];

/* -----------------------------------------------------------------------------
   AMELIORATIONS

   Le prix part de 30 BC et monte de 5 a chaque palier deja achete : le premier
   coute 30, le deuxieme 35, le troisieme 40. Une amelioration reste donc un
   objectif de plusieurs niveaux, et le dernier palier se merite.
-------------------------------------------------------------------------- */

const COUT_AMELIORATION = 30;
const PALIER_AMELIORATION = 5;

const AMELIORATIONS = [
  {
    cle: 'vie', nom: 'Barre de vie', paliers: 5,
    detail: '+2 PV par palier, jusqu\'à 20',
    valeur: n => 10 + n * 2, unite: ' PV',
    phrase: 'Plus de PV, plus de marge d\'erreur.',
  },
  {
    cle: 'degats', nom: 'Dégâts', paliers: 10,
    detail: '+10 % par palier, jusqu\'à +100 %',
    valeur: n => n * 10, unite: ' %',
    phrase: 'Les coups, les sauts, l\'onde — tout tape plus fort.',
  },
  {
    cle: 'resistance', nom: 'Résistance', paliers: 10,
    detail: '+10 % par palier, jusqu\'à +100 %',
    valeur: n => n * 10, unite: ' %',
    phrase: 'Tu encaisses mieux. Le Serrano fait moins mal.',
  },
];

/* Bonus permanents : achetes une seule fois. 10 BC pour le confort, 20 BC
   pour ceux qui changent vraiment la donne. */
const PERMANENTS = [
  { cle: 'aimant', nom: 'Aimant à BC', cout: 10,
    detail: 'Les Brad Coins sont attirés de deux fois plus loin.',
    phrase: 'Fini les pièces ratées d\'un pixel.' },
  { cle: 'lenteur', nom: 'Serrano rassis', cout: 20,
    detail: 'Les ennemis patrouillent 15 % moins vite.',
    phrase: 'Ils traînent. C\'est déjà ça.' },
  { cle: 'chance', nom: 'Poches percées', cout: 20,
    detail: '+50 % de Brad Coins lâchés par les ennemis.',
    phrase: 'Ils perdent plus de monnaie en tombant.' },
  { cle: 'shy', nom: 'Brad-Shy affûté', cout: 20,
    detail: 'La jauge de Brad-Shy se remplit 30 % plus vite.',
    phrase: 'L\'onde de choc revient plus souvent.' },
];

/* -----------------------------------------------------------------------------
   UNIFORMES
   Purement cosmetiques, aucun bonus — c'est le choix assume des notes : le
   joueur ne met jamais ses Brad Coins en concurrence entre beaute et
   puissance. Ils se debloquent en accomplissant des choses.
-------------------------------------------------------------------------- */

const UNIFORMES = [
  { cle: 'classique', nom: 'Le classique', condition: null,
    detail: 'Costard noir, cravate rouge. Depuis toujours.' },
  { cle: 'classique-bleu', nom: 'Cravate bleue', condition: 'niveaux>=1',
    detail: 'Débloqué en terminant un niveau.' },
  { cle: 'classique-vert', nom: 'Cravate verte', condition: 'niveaux>=2',
    detail: 'Débloqué en terminant deux niveaux.' },
  { cle: 'classique-orange', nom: 'Cravate orange', condition: 'ennemis>=50',
    detail: 'Débloqué en éliminant 50 ennemis.' },
  { cle: 'classique-violet', nom: 'Cravate violette', condition: 'arcade>=300',
    detail: 'Débloqué en faisant 300 points à l\'arcade.' },
  // Anciennement « Cravate Serrano » : personne ne pouvait deviner qu'il
  // s'agissait du jaune. Le surnom reste dans la description, ou il amuse
  // sans empecher de reconnaitre l'uniforme.
  { cle: 'cravate-jaune', nom: 'Cravate jaune', condition: 'pieces>=40',
    detail: 'Jaune Serrano, dit le BRADDY3000. Débloqué en accumulant 40 Brad Coins.' },
  { cle: 'classique-turquoise', nom: 'Cravate turquoise', condition: 'entrainement>=1',
    detail: 'Débloqué en passant une fois au camp d\'entraînement.' },
  { cle: 'classique-bordeaux', nom: 'Cravate bordeaux', condition: 'ameliorations>=25',
    detail: 'Débloqué en achetant TOUTES les améliorations, jusqu\'au dernier palier.' },
  { cle: 'dore', nom: 'Le costume d\'or', condition: 'niveaux>=10',
    detail: 'Débloqué en terminant le jeu. Bon courage.' },
];

/* -----------------------------------------------------------------------------
   LES TROIS PIECES DE L'APPAREIL A RACLETTE

   Le fil rouge de l'aventure. Chaque piece garde un boss, tous les trois
   niveaux : 3, 6 et 9. Reunies, elles permettent d'attirer KIRBY67 et de
   situer sa position — ce qui ouvre le niveau 10 et son boss.

   La liste porte les trois pieces des maintenant, meme si seule la premiere
   est atteignable : la vitrine de la base montre ainsi les deux emplacements
   vides, et le joueur sait des le premier niveau ce qu'il lui reste a faire.
-------------------------------------------------------------------------- */

const OBJETS_MAJEURS = [
  {
    cle: 'poelon', nom: 'Le poêlon', niveau: 'niveau3',
    court: 'Poêlon',
    detail: 'Un poêlon à raclette. Un seul. Il en faudrait huit pour une soirée correcte, mais on commence par un.',
    ou: 'Niveau 3 — la vallée enchantée',
    prise: 'Un poêlon. En pleine vallée enchantée. Personne ne trouvera ça normal, et c\'est très bien.',
  },
  {
    cle: 'garniture', nom: 'Le fromage et la charcuterie', niveau: 'niveau6',
    court: 'Garniture',
    detail: 'Une meule et de quoi l\'accompagner. La partie périssable du plan.',
    ou: 'Niveau 6 — la maison hantée',
    prise: 'Le fromage. La charcuterie. Le plan devient sérieux, et légèrement odorant.',
  },
  {
    cle: 'appareil', nom: 'L\'appareil à raclette', niveau: 'niveau9',
    court: 'Appareil',
    detail: 'La machine elle-même. Sans elle, les deux autres pièces ne sont qu\'un pique-nique.',
    ou: 'Niveau 9 — l\'espace',
    prise: 'L\'appareil. Le vrai. Il ne manque plus rien.',
  },
];

function aObjet(cle) { return partie.objets.indexOf(cle) >= 0; }
function objetsTrouves() { return partie.objets.length; }
function serieComplete() { return partie.objets.length >= OBJETS_MAJEURS.length; }

/* La piece que garde ce niveau, s'il en garde une. */
function objetDuNiveau(id) { return OBJETS_MAJEURS.find(o => o.niveau === id) || null; }

function ramasserObjet(cle) {
  if (!cle || aObjet(cle)) return false;
  partie.objets.push(cle);
  enregistrerPartie();
  return true;
}

/* -----------------------------------------------------------------------------
   ETAT
-------------------------------------------------------------------------- */

const partie = {
  existe: false,
  pieces: 0,
  difficulte: 'connaisseur',
  tempsJoue: 0,
  ennemisTotal: 0,
  meilleurArcade: 0,
  uniforme: 'classique',
  termines: [],                 // ids des niveaux termines
  ameliorations: { vie: 0, degats: 0, resistance: 0 },
  permanents: [],               // cles achetees
  arcadeJour: '',               // date locale AAAA-MM-JJ
  arcadeParties: 0,
  entrainements: 0,             // passages au camp — ne rapporte rien d'autre
  hubVu: false,                 // le dialogue de decouverte de la base a deja eu lieu
  piste: 'menu',                // morceau choisi au jukebox
  codes: [],                    // codes du jukebox deja entres
  objets: [],                   // pieces de l'appareil a raclette recuperees
  bossVaincus: [],              // ids des niveaux dont le boss est tombe
  maj: 0,
};

const ARCADE_PAR_JOUR = 3;

function chargerPartie() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_SAUVEGARDE) || 'null');
    if (!brut || typeof brut !== 'object') return false;
    // On ne relit que les cles connues : une sauvegarde ancienne reste
    // valable quand de nouveaux champs apparaissent.
    ['pieces', 'tempsJoue', 'ennemisTotal', 'meilleurArcade', 'arcadeParties',
     'entrainements', 'maj']
      .forEach(k => { if (typeof brut[k] === 'number') partie[k] = brut[k]; });
    if (DIFFICULTES.some(d => d.cle === brut.difficulte)) partie.difficulte = brut.difficulte;
    if (UNIFORMES.some(u => u.cle === brut.uniforme)) partie.uniforme = brut.uniforme;
    if (Array.isArray(brut.termines)) partie.termines = brut.termines.filter(id => id in NIVEAUX);
    if (Array.isArray(brut.permanents)) {
      partie.permanents = brut.permanents.filter(c => PERMANENTS.some(p => p.cle === c));
    }
    if (brut.ameliorations && typeof brut.ameliorations === 'object') {
      AMELIORATIONS.forEach(a => {
        const n = brut.ameliorations[a.cle];
        if (typeof n === 'number') partie.ameliorations[a.cle] = Math.max(0, Math.min(a.paliers, n));
      });
    }
    if (typeof brut.arcadeJour === 'string') partie.arcadeJour = brut.arcadeJour;
    if (typeof brut.hubVu === 'boolean') partie.hubVu = brut.hubVu;
    if (typeof brut.piste === 'string' && PISTES_JUKEBOX.some(p => p.cle === brut.piste)) {
      partie.piste = brut.piste;
    }
    if (Array.isArray(brut.codes)) {
      partie.codes = brut.codes.filter(c => CODES_JUKEBOX.some(p => p.code === c));
    }
    if (Array.isArray(brut.objets)) {
      partie.objets = brut.objets.filter(c => OBJETS_MAJEURS.some(o => o.cle === c));
    }
    if (Array.isArray(brut.bossVaincus)) {
      partie.bossVaincus = brut.bossVaincus.filter(id => id in NIVEAUX);
    }
    partie.existe = true;
    return true;
  } catch (e) {
    return false;
  }
}

function enregistrerPartie() {
  partie.existe = true;
  partie.maj = Date.now();
  try {
    localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(partie));
  } catch (e) { /* navigation privee : la partie reste jouable, sans suivi */ }
}

function effacerPartie() {
  try { localStorage.removeItem(CLE_SAUVEGARDE); } catch (e) { /* ignore */ }
  partie.existe = false;
  partie.pieces = 0;
  partie.tempsJoue = 0;
  partie.ennemisTotal = 0;
  partie.meilleurArcade = 0;
  partie.uniforme = 'classique';
  partie.termines = [];
  partie.ameliorations = { vie: 0, degats: 0, resistance: 0 };
  partie.permanents = [];
  partie.arcadeJour = '';
  partie.arcadeParties = 0;
  partie.entrainements = 0;
  partie.hubVu = false;
  partie.objets = [];
  partie.bossVaincus = [];
  partie.piste = 'menu';
  partie.codes = [];
}

/* -----------------------------------------------------------------------------
   LECTURES DERIVEES
-------------------------------------------------------------------------- */

function reglageDifficulte() {
  return DIFFICULTES.find(d => d.cle === partie.difficulte) || DIFFICULTES[1];
}

function aPermanent(cle) { return partie.permanents.indexOf(cle) >= 0; }

function pvMaxDeBrad() { return 10 + partie.ameliorations.vie * 2; }
function bonusDegats() { return 1 + partie.ameliorations.degats * 0.1; }
function bonusResistance() { return 1 - partie.ameliorations.resistance * 0.1 * 0.5; }

function niveauTermine(id) { return partie.termines.indexOf(id) >= 0; }

/* La base n'existe, dans la fiction, qu'une fois le niveau d'introduction
   franchi : c'est le BRADDY3000 qui la monte pendant que Brad traverse. Y
   acceder avant reviendrait a s'y refugier pour fuir un niveau qu'on n'a pas
   encore terminé, et casserait l'ouverture du jeu. */
function baseAccessible() { return partie.termines.length > 0; }

/* Un niveau est jouable s'il est le premier, ou si le precedent est fini. */
function niveauDebloque(id) {
  const i = ORDRE_NIVEAUX.indexOf(id);
  if (i <= 0) return true;
  return niveauTermine(ORDRE_NIVEAUX[i - 1]);
}

function prochainNiveau() {
  return ORDRE_NIVEAUX.find(id => !niveauTermine(id)) || ORDRE_NIVEAUX[ORDRE_NIVEAUX.length - 1];
}

function uniformeDebloque(u) {
  if (!u.condition) return true;
  const m = /^(\w+)>=(\d+)$/.exec(u.condition);
  if (!m) return false;
  const seuil = Number(m[2]);
  switch (m[1]) {
    case 'niveaux': return partie.termines.length >= seuil;
    case 'ennemis': return partie.ennemisTotal >= seuil;
    case 'pieces': return partie.pieces >= seuil;
    case 'arcade': return partie.meilleurArcade >= seuil;
    case 'entrainement': return partie.entrainements >= seuil;
    case 'ameliorations': return paliersAchetes() >= seuil;
  }
  return false;
}

/* Nombre total de paliers d'amelioration achetes, tous types confondus.
   25 = tout au maximum (5 vie + 10 degats + 10 resistance). */
function paliersAchetes() {
  return AMELIORATIONS.reduce((n, a) => n + partie.ameliorations[a.cle], 0);
}
function paliersTotal() {
  return AMELIORATIONS.reduce((n, a) => n + a.paliers, 0);
}

/* -----------------------------------------------------------------------------
   ARCADE — limite journaliere
   Les notes evoquent une limite de parties puis une attente. On se fie a
   l'horloge de la machine : une API de temps officielle ajouterait une
   dependance reseau pour un enjeu nul (le joueur ne triche que contre lui).
-------------------------------------------------------------------------- */

function aujourdHui() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

function partiesArcadeRestantes() {
  if (partie.arcadeJour !== aujourdHui()) return ARCADE_PAR_JOUR;
  return Math.max(0, ARCADE_PAR_JOUR - partie.arcadeParties);
}

function consommerPartieArcade() {
  const jour = aujourdHui();
  if (partie.arcadeJour !== jour) { partie.arcadeJour = jour; partie.arcadeParties = 0; }
  partie.arcadeParties++;
  enregistrerPartie();
}

/* -----------------------------------------------------------------------------
   ACHATS
-------------------------------------------------------------------------- */

/* Le prix monte avec le palier deja atteint : 30, 35, 40... */
function coutAmelioration(a) {
  return COUT_AMELIORATION + partie.ameliorations[a.cle] * PALIER_AMELIORATION;
}

function peutAcheterAmelioration(a) {
  return partie.ameliorations[a.cle] < a.paliers && partie.pieces >= coutAmelioration(a);
}

function acheterAmelioration(a) {
  if (!peutAcheterAmelioration(a)) return false;
  partie.pieces -= coutAmelioration(a);
  partie.ameliorations[a.cle]++;
  enregistrerPartie();
  return true;
}

function peutAcheterPermanent(p) {
  return !aPermanent(p.cle) && partie.pieces >= p.cout;
}

function acheterPermanent(p) {
  if (!peutAcheterPermanent(p)) return false;
  partie.pieces -= p.cout;
  partie.permanents.push(p.cle);
  enregistrerPartie();
  return true;
}

function dureeLisible(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ' min ' + String(r).padStart(2, '0');
}

/* Relecture au chargement de la page. Cette ligne est la seule chose qui
   ressuscite une partie : sans elle, la sauvegarde s'ecrit correctement mais
   n'est jamais relue, et « Continuer » reste gris pour toujours. */
chargerPartie();
