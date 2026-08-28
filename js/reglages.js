/* =============================================================================
   BRAD BITT, MAIS LE JEU — reglages
   Toutes les valeurs ajustables en direct depuis le panneau (F1).
   Unites : pixels et secondes, jamais "par image".
   ========================================================================== */
'use strict';

const SCHEMA = [
  { groupe: 'Course au sol' },
  { cle: 'vitesseMarche', nom: 'Vitesse de marche', min: 60, max: 260, pas: 5, defaut: 150, unite: 'px/s',
    note: "Vitesse maximale sans maintenir Maj." },
  { cle: 'vitesseCourse', nom: 'Vitesse de course', min: 100, max: 420, pas: 5, defaut: 250, unite: 'px/s' },
  { cle: 'acceleration', nom: 'Accélération', min: 200, max: 4000, pas: 50, defaut: 1300, unite: 'px/s²',
    note: "Trop bas = impression de patinage." },
  { cle: 'freinage', nom: 'Freinage', min: 200, max: 5000, pas: 50, defaut: 1900, unite: 'px/s²' },
  { cle: 'demiTour', nom: 'Gain de demi-tour', min: 1, max: 4, pas: 0.1, defaut: 2.2, unite: '×',
    note: "Multiplie l'accélération quand Brad change de sens : réactif sans supprimer le poids." },

  { groupe: 'Saut' },
  { cle: 'forceSaut', nom: 'Impulsion de saut', min: 200, max: 700, pas: 5, defaut: 470, unite: 'px/s' },
  { cle: 'gravite', nom: 'Gravité (montée)', min: 400, max: 3500, pas: 25, defaut: 1500, unite: 'px/s²' },
  { cle: 'graviteChute', nom: 'Gravité (chute)', min: 1, max: 3, pas: 0.05, defaut: 1.55, unite: '×',
    note: "Au-dessus de 1, la chute est plus rapide que la montée : saut nerveux plutôt que flottant." },
  { cle: 'graviteRelache', nom: 'Gravité (bouton relâché)', min: 1, max: 5, pas: 0.1, defaut: 2.6, unite: '×',
    note: "Mécanisme du saut à hauteur variable." },
  { cle: 'chuteMax', nom: 'Vitesse de chute max', min: 200, max: 1400, pas: 10, defaut: 720, unite: 'px/s' },

  { groupe: 'Permissivité' },
  { cle: 'coyote', nom: 'Coyote time', min: 0, max: 0.25, pas: 0.005, defaut: 0.10, unite: 's',
    note: "Saut encore possible après le bord. Au-delà de ~0,15 s, le joueur sent la triche." },
  { cle: 'tampon', nom: 'Jump buffer', min: 0, max: 0.3, pas: 0.005, defaut: 0.12, unite: 's' },

  { groupe: 'Contrôle en l\'air' },
  { cle: 'controleAir', nom: 'Contrôle aérien', min: 0, max: 1, pas: 0.05, defaut: 0.55, unite: '×' },
  { cle: 'freinageAir', nom: 'Freinage aérien', min: 0, max: 1, pas: 0.05, defaut: 0.25, unite: '×' },

  { groupe: 'Attaque de Brad' },
  { cle: 'porteeAttaque', nom: 'Portée du coup', min: 12, max: 46, pas: 1, defaut: 26, unite: 'px',
    note: "Largeur de la zone de dégâts devant Brad." },
  { cle: 'dureeAttaque', nom: 'Durée du coup', min: 0.06, max: 0.4, pas: 0.01, defaut: 0.16, unite: 's' },
  { cle: 'recharge', nom: 'Délai entre deux coups', min: 0.05, max: 0.8, pas: 0.01, defaut: 0.28, unite: 's',
    note: "Le corps-à-corps est gratuit et illimité : seul ce délai le limite." },
  { cle: 'degatsBrad', nom: 'Dégâts du coup', min: 1, max: 5, pas: 1, defaut: 1, unite: 'PV' },
  { cle: 'rebond', nom: 'Rebond après écrasement', min: 0, max: 1, pas: 0.05, defaut: 0.62, unite: '×',
    note: "Fraction de l'impulsion de saut rendue quand Brad retombe sur un ennemi. Permet d'enchaîner." },

  { groupe: 'Brad-Shy' },
  { cle: 'gainBradShy', nom: 'Gain par élimination', min: 2, max: 50, pas: 1, defaut: 14, unite: '%',
    note: "Valeur de base ; un ennemi coriace en donne davantage." },
  { cle: 'rayonOnde', nom: 'Rayon de l\'onde de choc', min: 40, max: 220, pas: 5, defaut: 110, unite: 'px' },
  { cle: 'degatsOnde', nom: 'Dégâts de l\'onde', min: 1, max: 12, pas: 1, defaut: 5, unite: 'PV' },

  { groupe: 'Ennemis' },
  { cle: 'vitesseEnnemi', nom: 'Vitesse de patrouille', min: 10, max: 140, pas: 5, defaut: 42, unite: 'px/s' },
  { cle: 'gainCharge', nom: 'Gain en charge', min: 1, max: 4, pas: 0.1, defaut: 2.1, unite: '×',
    note: "Multiplie la vitesse quand l'ennemi a repéré Brad." },
  { cle: 'porteeDetection', nom: 'Portée de détection', min: 40, max: 400, pas: 10, defaut: 190, unite: 'px',
    note: "L'ennemi repère Brad même de dos, comme demandé. Laisse assez de marge pour préparer une attaque." },
  { cle: 'delaiAlerte', nom: 'Délai avant la charge', min: 0, max: 1.2, pas: 0.05, defaut: 0.35, unite: 's',
    note: "Temps d'affichage du « ! » avant que l'ennemi ne s'élance. C'est la fenêtre de réaction du joueur." },
  { cle: 'distanceReveil', nom: 'Distance de réveil', min: 200, max: 1200, pas: 20, defaut: 460, unite: 'px',
    note: "Un ennemi reste figé à son point de départ tant que Brad n'est pas à cette distance. Sans ça, tous les ennemis du niveau patrouillent dès le chargement et se retrouvent n'importe où quand le joueur arrive." },
  { cle: 'amplitudePatrouille', nom: 'Amplitude de patrouille', min: 24, max: 300, pas: 6, defaut: 96, unite: 'px',
    note: "Distance maximale entre un ennemi et son point de départ. Empêche la dérive, surtout pour les volants que rien n'arrête en plein ciel." },

  { groupe: 'Son' },
  { cle: 'volMusique', nom: 'Volume de la musique', min: 0, max: 1, pas: 0.05, defaut: 0.55, unite: '' },
  { cle: 'volEffets', nom: 'Volume des effets', min: 0, max: 1, pas: 0.05, defaut: 0.5, unite: '' },

  { groupe: 'Dégâts subis' },
  { cle: 'invincibilite', nom: 'Invincibilité après un coup', min: 0.2, max: 3, pas: 0.1, defaut: 1.2, unite: 's',
    note: "Empêche qu'un contact continu vide la barre de vie d'un coup." },
  { cle: 'reculX', nom: 'Recul horizontal', min: 0, max: 400, pas: 10, defaut: 190, unite: 'px/s' },
  { cle: 'reculY', nom: 'Recul vertical', min: 0, max: 400, pas: 10, defaut: 210, unite: 'px/s' },

  { groupe: 'Caméra' },
  { cle: 'camAnticipation', nom: 'Anticipation', min: 0, max: 160, pas: 5, defaut: 70, unite: 'px' },
  { cle: 'camSouplesse', nom: 'Souplesse', min: 1, max: 14, pas: 0.5, defaut: 5, unite: '/s' },
  { cle: 'camZoneY', nom: 'Zone morte verticale', min: 0, max: 140, pas: 5, defaut: 72, unite: 'px' },
];

const DEFAUTS = {};
SCHEMA.forEach(e => { if (e.cle) DEFAUTS[e.cle] = e.defaut; });

const CLE_STOCKAGE = 'bradbitt.feel.v1';
const R = Object.assign({}, DEFAUTS);
const OPTIONS = { doubleSaut: false, hitbox: false, traces: false, sautEnnemi: true };

try {
  const sauve = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
  if (sauve) {
    // On ne relit que les cles connues : une sauvegarde ancienne reste
    // valable quand de nouveaux reglages apparaissent.
    Object.keys(DEFAUTS).forEach(k => { if (typeof sauve[k] === 'number') R[k] = sauve[k]; });
    if (sauve._options) Object.assign(OPTIONS, sauve._options);
  }
} catch (e) { /* navigation privee : on garde les defauts */ }

function sauvegarderReglages() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(Object.assign({}, R, { _options: OPTIONS })));
  } catch (e) { /* ignore */ }
}
