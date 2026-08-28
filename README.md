# Brad Bitt, mais le jeu — prototype 10

Le niveau d'introduction devient un vrai parcours, avec tout ce qui l'entoure :
écran d'accueil, animation des studios, menu jouable, musique, sauvegarde et
ligne d'arrivée.

## Lancer

Double-clique `index.html`. Aucune dépendance, aucun serveur nécessaire.
Déployable tel quel sur Netlify (racine du dépôt, pas de commande de build).

## Commandes

| Action | Touches |
|---|---|
| Déplacement | ← → · A D · Q D |
| Saut | Espace · ↑ · W · Z — **maintenir = plus haut** |
| Courir | Maj |
| Frapper / lancer la boule | X · J |
| Onde de choc (Brad-Shy plein) | C · K |
| Menus | ↑ ↓ pour choisir, ← → pour régler, Entrée, Échap |
| Retour au début du niveau | R |
| Panneau de développement | F1 |

AZERTY et QWERTY sont pris en charge sans configuration. Sur mobile, les
boutons tactiles n'apparaissent que pendant le jeu.

---

## Ce qui est nouveau

### Démarrage

`Jouer` → animation des deux logos → barre de chargement → menu.

Le bouton n'est pas décoratif : **les navigateurs interdisent toute lecture
audio tant que l'utilisateur n'a pas interagi avec la page**. C'est ce clic qui
autorise le son pour le reste de la session.

Le menu s'ouvre au plus tard des deux : la fin de l'animation des logos, ou la
fin du chargement **plus 3 secondes de marge**. Un chargement rapide ne coupe
donc pas l'animation, et un chargement lent ne saute rien.

### Menu

Nouvelle partie · Continuer (grisé sans sauvegarde) · Options · Crédits.

Le fond n'est pas une image : **Brad y joue tout seul**. Des Serra entrent par
les côtés, il va les écraser, grimpe sur les plateformes, et quand le calme
revient il flâne puis sort son téléphone. La simulation est complètement
séparée de celle du niveau.

Les options couvrent le volume de la musique, celui des effets, la difficulté
(Touriste / Connaisseur / Salé) et l'effacement de la sauvegarde. Les crédits
sont volontairement une page d'attente.

### Son

- La **musique** passe par un élément `<audio>` : une piste de 2 min 20 et
  2,3 Mo se diffuse, elle n'a rien à faire dans la mémoire du contexte audio.
- Les **effets** sont synthétisés à la volée en Web Audio — pas un seul fichier
  à télécharger. Ce sont des placeholders assumés : quand tu auras tes vrais
  sons, il suffira de remplacer le corps de `bruit()` dans `js/audio.js`.

Un bouton **Commencer** précède chaque niveau, comme demandé.

### Sauvegarde

`localStorage`, écrite à la fin d'un niveau : Brad Coins, PV max, difficulté,
temps joué. La structure prévoit déjà les champs de la Roadmap pour que le hub
et la boutique n'aient rien à casser.

### Le niveau

Presque deux fois plus long (256 tuiles jusqu'à la porte), en **deux zones de
décor** : « Zone de largage » à l'extérieur, puis « Complexe — niveau -2 ».

Le passage de l'une à l'autre déclenche un fondu au noir et un effet sonore
**sans recharger la page ni changer de fichier** — c'est le mécanisme que
décrivent tes notes (« le niveau 1 où Brad va dans une grotte, c'est toujours
le niveau 1 »). La géométrie reste continue ; seule la palette bascule pendant
que l'écran est masqué. Ajouter une zone tient en une entrée dans `ZONES`.

Le niveau se termine par une **porte** dans laquelle Brad entre en marchant :
aucune touche à deviner. Il finit d'y entrer tout seul, puis le bilan
s'affiche (temps, ennemis, Brad Coins, prime de +5 BC).

---

## Les trois bugs signalés

### Les volants quittaient la map

Deux causes, deux correctifs.

**Rien ne les arrêtait.** Un ennemi terrestre est borné par les murs et les
bords de plateforme ; un volant, en plein ciel, n'a aucune de ces limites.
Chaque ennemi porte maintenant un **rayon de patrouille** autour de son point
de départ, et le volant est en plus tenu par une laisse appliquée *après* tous
ses déplacements — poursuite comprise. Il peut déborder un peu de sa zone,
jamais la quitter.

**Ils patrouillaient depuis le chargement.** Les 27 ennemis du niveau se
mettaient en marche dès la première image : au moment où le joueur arrivait,
ils étaient ailleurs. Un ennemi reste désormais **figé à son point de départ**
tant que Brad n'est pas à portée (460 px par défaut, réglable), et se rendort
quand il s'éloigne. Les volants regagnent alors tranquillement leur position :
revenir sur ses pas les retrouve là où on les avait laissés.

*Vérifié : après 25 s d'inactivité, dérive maximale de 88 px, aucun ennemi hors
de sa zone. Un volant lancé en poursuite s'écarte de 64 px puis revient à 6 px
de son ancre.*

### Le blocage sur le Serra-Lourd

Brad **se tient maintenant sur sa tête**. L'ancienne version le faisait
rebondir : coincé entre le Lourd et une marche d'escalier, il retombait dessus
et rebondissait sans fin. Faire du Lourd un sol solide supprime la boucle et
retourne le problème en outil — il devient une marche mobile.

Les ennemis terrestres tolèrent aussi maintenant **un décrochement d'une
tuile** : une marche se descend au lieu d'être traitée comme un précipice. Le
Lourd peut donc suivre un escalier. Son rayon de patrouille le garde malgré
tout à distance du haut des marches, là où le combat était le plus pénible.

*Vérifié : 0 rebond, 0 dégât, contact exact, et le saut depuis sa tête atteint
bien 70 px.*

### Les textes qui se superposaient

Deux traitements complémentaires : les gains identiques **se cumulent**
(« +2 BC » plutôt que deux « +1 BC » l'un sur l'autre), et les libellés
différents **s'empilent** en remontant. Un contour sombre a été ajouté pour que
le texte reste lisible sur n'importe quel décor.

---

## Structure

```
index.html
style.css
js/reglages.js      valeurs ajustables + persistance
js/audio.js         musique et effets synthétisés
js/monde.js         constantes, chargement, données du niveau, zones
js/sauvegarde.js    localStorage, difficultés
js/acteurs.js       Brad, ennemis, boules, ramassages, effets, porte
js/menu.js          démarrage, scène de fond, menu, options, crédits
js/entrees.js       clavier, souris, tactile — aiguillés par la scène
js/jeu.js           caméra, transitions, rendu, boucle
assets/brad/        planche de Brad (4×3)
assets/ennemis/     sprites extraits des JPG
assets/ui/          logos des studios, détourés
assets/audio/       musique du niveau d'introduction
tools/              scripts d'extraction
```

**Scripts classiques, pas de modules ES, aucun `fetch()`** : la page reste
ouvrable par double-clic. L'ordre des balises `<script>` compte.

Une seule variable, `scene`, pilote tout : la boucle sait quoi simuler, le
rendu sait quoi dessiner, les entrées savent qui écouter.

### Les deux encodages de la musique

`intro.m4a` est ton fichier d'origine ; `intro.mp3` en est une conversion.

Elle n'est pas décorative : **tous les navigateurs ne savent pas lire l'AAC**.
Les compilations libres de Chromium — plusieurs distributions Linux, et les
navigateurs livrés sans codecs propriétaires — le refusent, et le jeu serait
alors silencieux sans qu'on comprenne pourquoi. Le navigateur de test utilisé
ici est justement dans ce cas, ce qui a permis de s'en rendre compte.

Le jeu choisit au démarrage le premier format qu'il déclare savoir lire.

Le MP3 est transcodé depuis l'AAC, donc **légèrement dégradé** — deux
compressions successives. Pour la version finale, mieux vaut réexporter le MP3
depuis ton master d'origine plutôt que depuis le .m4a.

---

## Ce qui n'est pas encore là

Le hub façon Splatoon, la phase de dialogue d'introduction, la boutique, le
BRADDY3000, les uniformes, les mini-jeux, les Brad Coins secrets.

### À propos des uniformes

Ils ne sont pas branchables tels quels, pour une raison de format : chacun est
**une seule pose statique de face**, alors que le jeu utilise une planche de
12 images (repos ×4, marche ×4, course ×4).

Deux familles se dégagent :

- **Recolorations pures** — `classique`, `classique-bleu/orange/vert/violet`,
  `cravate-jaune`, `doré`. Même silhouette, seules les couleurs changent. Un
  échange de palette appliqué à la planche existante suffit : aucune image
  supplémentaire à produire.
- **Silhouettes différentes** — `t-shirt`, `pecheur`, `funky`, `exclu-beta`.
  Manches courtes, ciré à capuche, col ouvert, pantalon distinct. Ceux-là
  demandent une vraie planche de 12 images chacun.

À voir quand on y arrivera : c'est une décision de production, pas un blocage
technique.

---

## Corrections du prototype 06

### La chemise transparente de Brad

Le trou est dans la planche d'origine : entre les revers de la veste, les pixels
de la chemise ont un alpha nul, et le décor se voyait à travers le torse.

Le rebouchage se fait maintenant à l'extraction, et il distingue un **trou**
d'un **creux** par connexité : le fond extérieur touche forcément le bord de la
vignette, donc une zone transparente qui ne le touche pas est un trou à
remplir. L'échancrure entre les jambes, elle, débouche sur le bas de l'image :
elle reste intacte. Les douze images sont corrigées d'un coup, sans retouche
manuelle — si tu réexportes la planche un jour, relance simplement le script.

### Le décor qui sautait

Les tours étaient numérotées **à partir du bord gauche de l'écran**. À chaque
fois que le motif bouclait, toute la rangée se décalait d'un cran et les tours
changeaient de hauteur d'un coup — d'où le sursaut.

Elles sont désormais indexées sur une position **absolue dans le monde** : une
tour donnée garde sa hauteur du début à la fin du niveau. Vérifié en balayant
toute la largeur jouable : aucune incohérence, aucun saut.

### La frappe qui partait toujours à droite

La zone de dégâts a toujours été du bon côté — c'est l'image qui mentait.
`ctx.arc(…, -0.9, 0.9)` dessine invariablement le côté droit d'un cercle, donc
l'arc blanc partait à droite même quand Brad frappait à gauche. L'arc est
maintenant miroité selon son regard.

### Les options

- **Les volumes ne pouvaient plus descendre** parce qu'un pointeur immobile
  posé sur une autre ligne volait la sélection au clavier : les flèches
  réglaient la mauvaise valeur. Le survol ne prend la main que si la souris a
  réellement bougé.
- **Les jauges se manipulent directement** : cliquer à gauche baisse, cliquer à
  droite monte, et on peut glisser. Avant, tout clic incrémentait — impossible
  de baisser à la souris.
- **Les flèches ‹ › de difficulté** sont deux vrais boutons, chacun avec sa
  zone exactement sous le caractère. Avant, une seule zone couvrait la ligne et
  se trouvait décalée de 16 px vers le bas : cliquer sur « ‹ » avançait quand
  même d'un cran.
- **Bouton « Rétablir les réglages par défaut »** ajouté.

### La musique

Elle ne boucle plus bord à bord. À la fin du morceau, **10 à 15 secondes de
silence**, puis une reprise en fondu de 3,5 s. C'est ce qui évite d'entendre la
couture d'une piste qui n'a pas été composée pour tourner en rond.

### Le sas entre les deux zones

Le décor changeait sans qu'aucun élément ne l'explique. Il y a maintenant un
véritable sas à la frontière : encadrement métallique, portes coulissantes qui
s'ouvrent à l'approche de Brad, voyant qui passe au vert, bandes
d'avertissement au sol. Purement décoratif — rien ne bloque le passage — mais
le changement d'ambiance a enfin une cause visible.

### Le Brad du menu

Il ignorait purement les volants. Il les prend maintenant pour cible, et
surtout il sait **grimper** : il choisit la plateforme depuis laquelle la cible
est atteignable, enchaîne les paliers s'il en faut deux, puis saute.

### Mobile

- **Icônes SVG** à la place des émojis. Un émoji change de dessin d'un appareil
  à l'autre, arrive parfois en couleur et ne s'aligne pas pareil ; un tracé
  vectoriel est identique partout.
- **Demande de rotation** en portrait, avant même le bouton « Jouer » — qui
  reste neutralisé tant que l'appareil n'est pas en paysage. Le jeu est cadré
  en 16:9 : en portrait, l'image tiendrait dans une bande et les commandes
  recouvriraient la moitié de l'écran.
- **Relance au toucher après une mort** : un bouton « RÉESSAYER », et un
  toucher n'importe où sur l'écran fonctionne aussi. Il fallait la touche
  Espace, injouable au doigt.
- Le bouton de développement « Réglages » est masqué sur écran tactile : il
  chevauchait le compteur de Brad Coins. Le panneau reste accessible depuis
  Options → « Réglages de développement… ».

---

# Prototype 07 — le hub, l'intro et le niveau 1

## Le flux du jeu, maintenant

```
Jouer → logos → menu
  Nouvelle partie → dialogue d'intro → niveau d'introduction → dialogue → LA BASE
  Continuer       → LA BASE (ou l'intro si elle n'a jamais été finie)

LA BASE ⇄ boutique · vestiaire · arcade · carte
                                            └→ niveau → bilan → LA BASE
```

## La base

Une salle souterraine que Brad **parcourt à pied**. On ne choisit pas dans un
menu : on marche jusqu'au comptoir et on entre (Espace, ou le bouton ▲ au
doigt). Quatre postes, une mini-carte en bas d'écran pour se repérer, et le
BRADDY3000 qui flotte près de la boutique et commente.

Brad y a son **propre acteur**, séparé de celui des niveaux. Le hub n'a ni PV,
ni Brad-Shy, ni combat : mélanger les deux états aurait exposé le jeu à des
bugs sournois — mourir dans le hub, ressortir du magasin avec une boule de
Serrano en main.

### Boutique

Deux onglets. Les **améliorations** de la Roadmap, à 3 BC l'unité : vie
(+2 PV par palier jusqu'à 20), dégâts et résistance (+10 % par palier jusqu'à
+100 %). Et des **bonus permanents** moins chers, achetés une seule fois :
ennemis ralentis, plus de Brad Coins lâchés, aimant à pièces, Brad-Shy plus
rapide.

Chaque achat passe par la confirmation du BRADDY3000 — « Es-tu sûr de vouloir
passer la transaction ? » / « Affirmatif » ou « Tout compte fait, non » — comme
le demandent les notes. Et ses répliques quand ça ne va pas : « Mhh. J'ai
jamais été bon en maths, mais je pense que les comptes n'y sont pas. »

**Les améliorations agissent réellement** : les PV max au départ du niveau, les
dégâts du poing et de l'onde, l'atténuation des coups reçus, la vitesse des
patrouilles, le rayon de l'aimant, le remplissage de la jauge.

### Vestiaire

Sept uniformes, **purement cosmétiques et gratuits** — c'est le choix assumé
des notes : le joueur ne met jamais ses Brad Coins en concurrence entre beauté
et puissance. Ils se débloquent en accomplissant des choses (finir un niveau,
éliminer 50 ennemis, faire 300 points à l'arcade, accumuler 40 BC, finir le
jeu). Les verrouillés montrent un cadenas et leur condition.

Les six variantes sont **pré-générées** par `tools/recolor_brad.py` plutôt que
recolorées dans le navigateur : un canvas nourri par une image locale est
teinté en `file://` et refuse `getImageData`, donc la recoloration à l'exécution
aurait cassé le mode double-clic.

### Arcade — SERRA INVADERS

Un Invaders remixé. Les notes demandaient de s'inspirer d'un jeu connu pour
n'avoir aucune règle à expliquer ; les variantes maison suffisent à le rendre
Brad Bitt :

- le rang du fond est composé de **Serra-Lourd** qui encaissent trois boules ;
- le rang suivant est composé de **Lanceurs** qui ripostent ;
- des **Volants** traversent l'écran en diagonale et valent le double ;
- Brad tire des **boules de Serrano**, pas des lasers.

100 points = 1 Brad Coin, et **3 parties par jour** — sinon la borne devient
une machine à monnaie. La limite se fie à l'horloge de la machine : une API de
temps ajouterait une dépendance réseau pour un enjeu nul, le joueur ne trichant
que contre lui-même.

### Carte

Les niveaux disponibles, terminés ou verrouillés — le suivant s'ouvre quand le
précédent est fini. La liste des huit niveaux à venir est affichée dessous,
pour montrer la route.

## Le dialogue d'introduction

Boîte de texte, effet machine à écrire, clic pour avancer. Le premier clic
**termine la ligne** au lieu de la sauter : c'est la convention que tout le
monde connaît, et elle évite de rater une réplique en cliquant trop vite. Un
bouton « Passer » pour ceux qui rejouent.

Quatorze répliques qui suivent la version retenue dans tes notes : Brad sort
les poubelles, reçoit une notification du BRADDY3000, se téléporte, et casse la
télécommande de retour à l'atterrissage. Six répliques de plus à l'arrivée au
hub. **C'est un premier jet à corriger** — le ton est celui que j'ai lu dans
tes notes, mais les vraies vannes sont les tiennes. Tout est dans
`js/dialogue.js`, en clair, en haut de fichier.

## Le niveau 1

**Champ de tournesols**, puis **la grotte** — même fichier, même partie, le
décor bascule derrière un fondu, exactement comme l'intro. 236 tuiles, sa
musique (`level1.m4a`), et une entrée de grotte avec ses torches qui s'allument
à l'approche de Brad plutôt qu'un sas métallique.

Vérifié : un bot le traverse de bout en bout sans blocage.

## Un fichier par niveau

`monde.js` est devenu un **chargeur**. Chaque niveau vit dans `niveaux/` et
n'est que de la donnée : géométrie, zones, ennemis, musique, porte. Aucun code
de gameplay dedans.

```js
NIVEAUX['niveau1'] = { nom, musique, largeur, zones, solides, ennemis, porte, … };
```

Ajouter le niveau 2, c'est ajouter `niveaux/niveau2.js`, une balise `<script>`,
et une entrée dans `ORDRE_NIVEAUX`. C'est l'architecture que décrivent tes
notes, et elle est maintenant réelle.

## Structure

```
index.html
style.css
niveaux/intro.js      données du niveau d'introduction
niveaux/niveau1.js    données du niveau 1
js/reglages.js        valeurs ajustables + persistance
js/audio.js           musique et effets synthétisés
js/monde.js           constantes, chargement des assets, chargeur de niveaux
js/sauvegarde.js      progression, améliorations, uniformes, arcade
js/acteurs.js         Brad, ennemis, boules, ramassages, effets, porte
js/dialogue.js        système de dialogue + scripts d'intro
js/hub.js             la base : déplacement, boutique, vestiaire, carte
js/arcade.js          Serra Invaders
js/menu.js            démarrage, scène de fond, menu, options, crédits
js/entrees.js         clavier, souris, tactile — aiguillés par la scène
js/jeu.js             caméra, transitions, rendu, boucle
```

La sauvegarde passe en `bradbitt.partie.v2` : les anciennes parties ne sont pas
relues, la structure a trop changé.

## Ce qui n'est pas encore là

Les huit autres niveaux, les boss, les Brad Coins secrets et leurs aptitudes,
les mini-jeux supplémentaires, le camp d'entraînement, les uniformes à
silhouette différente (t-shirt, pêcheur, funky, exclu-bêta — ils demandent une
vraie planche de 12 images chacun).

---

# Prototype 08 — six bugs, sept ajouts

## Les six bugs

### La base était accessible avant d'avoir fini l'introduction

`baseAccessible()` répond maintenant « oui » seulement une fois au moins un
niveau terminé. Trois portes étaient ouvertes et sont fermées : le bouton
« Retour à la base » de l'écran de mort, la touche Échap pendant le niveau, et
« Continuer » depuis le menu (qui relance l'intro au lieu d'ouvrir le hub).
Le camp d'entraînement reste, lui, toujours quittable — c'est une salle de la
base, pas un niveau dont on s'échapperait.

### « Passer » ne fonctionnait pas dans la cinématique

Deux causes indépendantes, les deux corrigées.

La première est dans le code : `zoneSousSouris()` parcourt la pile de zones
cliquables à l'envers, donc la **dernière** enregistrée gagne. Le rectangle
plein écran qui fait avancer le dialogue était posé après le bouton, et
l'avalait. Il est maintenant posé en premier.

La seconde est de la mise en page, et c'est celle que tu voyais : le bouton
HTML « ⚙ Réglages » est en `position: fixed` dans le coin haut-droit, **par
dessus** le canvas. « Passer » était dessiné exactement dessous. Le clic
atterrissait sur le bouton de réglages et jamais sur « Passer ». Le bouton est
descendu juste au-dessus de la boîte de texte, là où rien ne le recouvre. Un
test vérifie désormais que les deux rectangles ne se croisent pas, et reclique
pour de vrai à trois tailles de fenêtre.

### Les ennemis de la zone 2 étaient visibles depuis la zone 1

`ennemiHorsZone()` compare la zone de l'ennemi à la zone affichée. Un ennemi
hors zone n'est ni mis à jour ni dessiné : il ne bouge pas, ne tire pas, et
n'apparaît pas au loin derrière le sas.

### Les cadenas des uniformes étaient des émojis

Remplacés par `dessinerCadenas()`, tracé en primitives, à l'échelle demandée et
dans la couleur demandée. Un émoji change de dessin d'un appareil à l'autre et
arrive parfois en couleur au milieu d'une ligne grise ; le tracé, lui, est
identique partout. La suite de tests refuse tout caractère émoji dans les
fichiers de rendu.

### L'économie

Les améliorations coûtent **30 BC**, plus **5 BC par palier déjà acheté** :
30, 35, 40, 45, 50… Les bonus permanents coûtent **10 BC** (l'aimant à Brad
Coins) ou **20 BC** (Serrano rassis, Poches percées, Brad-Shy affûté).

### La partie ne se sauvegardait pas

C'était le bug le plus bête et le plus grave. `sauvegarde.js` écrivait
correctement dans `localStorage`, mais l'appel `chargerPartie()` en fin de
fichier — la seule ligne qui relit la partie au chargement de la page — avait
disparu pendant la réécriture du prototype 07. La sauvegarde existait, personne
ne la lisait, « Continuer » restait gris. La ligne est revenue, avec un
commentaire qui explique pourquoi elle ne doit plus jamais partir.

## Les sept ajouts

### Confirmation avant une nouvelle partie

« Nouvelle partie » alors qu'une partie existe demande confirmation, en
rappelant ce qui va disparaître : les Brad Coins et les niveaux terminés.

### Choix de la difficulté avant la cinématique

Trois cartes — Touriste, Connaisseur, Salé — chacune avec quatre lignes qui
disent exactement ce qui change : dégâts subis, résistance des ennemis,
récompenses, et à qui ça s'adresse. La cinématique ne part qu'après.

### « Continuer » à la fin d'un niveau

L'écran de bilan propose « Continuer ▸ » en bouton principal (retour à la base)
et « Rejouer » en second. Espace fait la même chose que le clic. Au retour, le
BRADDY3000 commente — parfois sur la mission, parfois sur rien du tout.

### Le camp d'entraînement

Une salle de la base, accessible depuis le hub. Le drapeau `entrainement` du
fichier de niveau coupe **toute** récompense : aucun Brad Coin dans le décor,
aucun lâché par les ennemis, aucun comptage d'éliminations, aucune progression.
Les ennemis réapparaissent en boucle et mourir n'y coûte rien. La garantie est
posée dans la donnée, pas dispersée dans le code : c'est ce qui empêche la
salle de devenir une ferme à pièces.

Le seul effet du camp sur la progression est cosmétique : un passage débloque
la cravate turquoise.

### La scène de découverte de la base

Douze répliques entre Brad et le BRADDY3000, jouées **dans** la base : la
caméra se tourne vers chaque poste dont il parle, le robot le suit, et Brad
marche à côté. Toute la base est remontée de 62 pixels pendant le dialogue,
sinon le sol — et donc les deux personnages — se retrouve derrière la boîte de
texte. Elle ne se joue qu'une fois par partie : le drapeau vit dans la
sauvegarde, pas dans une variable de session.

### Deux uniformes de plus

- **Cravate turquoise** — un passage au camp d'entraînement.
- **Cravate bordeaux** — les 25 paliers d'améliorations achetés, santé, dégâts
  et résistance au maximum. C'est la récompense la plus longue du jeu.

Le vestiaire est passé de quatre à cinq colonnes : à neuf uniformes, une grille
de quatre débordait sur une troisième rangée qui recouvrait la description et le
bouton « Sortir ».

### Parler au BRADDY3000

Approche-le dans la base : « E pour parler » apparaît (« Touche-le pour
parler » sur mobile). Son corps reste cliquable même pendant qu'il répond, pour
relancer la conversation au doigt sans attendre. Il donne des conseils liés à
ton avancement — argent, améliorations non achetées, niveaux restants — deux
fois sur trois, et dit n'importe quoi le reste du temps.

## Vérification

`101` contrôles automatisés, tous verts : les treize points ci-dessus, plus
un pilote automatique qui traverse l'introduction et le niveau 1 de bout en
bout, une passe mobile en portrait puis en paysage, et un contrôle qu'aucune
erreur JavaScript n'est apparue de toute la session.

## Structure

```
niveaux/entrainement.js   le camp — aucune récompense, ennemis en boucle
```

Le reste est inchangé. La sauvegarde reste `bradbitt.partie.v2`, avec un champ
`hubVu` en plus (les parties du prototype 07 restent lisibles : un champ absent
prend sa valeur par défaut).

## Ce qui n'est pas encore là

Les niveaux 2 à 10, les boss, les Brad Coins secrets et leurs aptitudes, et les
uniformes à silhouette différente (t-shirt, pêcheur, funky, exclu-bêta — ils
demandent une vraie planche de 12 images chacun, la recoloration ne suffit pas).

---

# Prototype 09 — les niveaux 2 et 3, le premier boss, l'appareil à raclette

## L'appareil à raclette

Le fil rouge de l'aventure, en trois pièces, une tous les trois niveaux :

| Pièce | Niveau | Ce que c'est |
|---|---|---|
| **Le poêlon** | 3 — la vallée enchantée | Un poêlon. Un seul. Il en faudrait huit. |
| **La garniture** | 6 — la maison hantée | Le fromage et la charcuterie. |
| **L'appareil** | 9 — l'espace | La machine elle-même. |

Réunies, elles permettent d'attirer Kirby 67 et de situer sa position — ce qui
ouvre le niveau 10 et son boss. Les trois sont déjà déclarées dans le code :
la vitrine de la base montre les deux emplacements encore vides, avec le niveau
où les trouver. Le joueur sait donc dès la première visite ce qui l'attend.

Les pièces vivent dans la sauvegarde (`partie.objets`), filtrées à la relecture :
une sauvegarde bricolée à la main ne peut pas s'inventer une quatrième pièce.

### La vitrine

Trois emplacements au mur de la base, entre le vestiaire et le camp. Ce n'est
pas un poste : rien à activer, rien à acheter. Un mur qui se remplit. Les pièces
manquantes apparaissent en silhouette avec un cadenas — montrer la forme absente
vaut mieux qu'un point d'interrogation.

## Le premier boss

Le **Serra-Colosse** garde le poêlon dans le cercle de pierres, au bout du
niveau 3. C'est le principe demandé : *un Serra-Lourd avec plus de vie et plus
de dégâts, qui se blinde par moments et qu'il faut redevenir vulnérable en
nettoyant la salle.*

Concrètement, il a quatorze points de vie et trois seuils. À chaque seuil
franchi il se blinde et appelle une vague de renforts — 2, puis 3, puis 4, de
plus en plus mobiles. Tant qu'un renfort tient debout, **les coups portés au
boss rebondissent**, onde de choc comprise. La vague nettoyée, le blindage
tombe et il repart, plus rapide.

C'est ce qui évite le boss-sac-à-points-de-vie : on ne gagne pas en tapant plus
fort, on gagne en gérant la salle.

Trois garde-fous, parce qu'un combat bloqué est pire qu'un combat trop dur :

- **La porte de sortie est verrouillée** tant que le boss vit — et elle le dit,
  plutôt que d'ignorer un Brad qui la piétine.
- **Les renforts volants apparaissent bas** (rangée 11) et ne renoncent jamais
  à poursuivre Brad. Un sbire hors d'atteinte transformerait la phase blindée
  en salle d'attente.
- **Au bout de trente secondes de blindage, l'armure lâche seule.** Aucune
  partie normale n'atteint ce délai — les vagues se nettoient en une dizaine de
  secondes — mais si un renfort se coince quelque part, le joueur récupère la
  main au lieu de devoir quitter le niveau.

Mourir pendant le combat le remet à zéro proprement. Mourir *après* la victoire
ne ressuscite pas le boss, et la pièce tombée mais pas encore ramassée est
reposée au sol : sans ça elle disparaissait avec le reste et l'objet du niveau
devenait à jamais inatteignable.

## Le niveau 2 — la ville, en été

Deux zones. Les rues, avec leurs immeubles à fenêtres allumées, leurs
réservoirs sur les toits et leurs échafaudages. Puis l'arrière-cour, derrière
une grille : murs grillagés, cordes à linge, poubelles, et des lanceurs postés
en hauteur. C'est un niveau de métier, sans objet majeur — les pièces sont aux
niveaux 3, 6 et 9.

## Le niveau 3 — la vallée enchantée

Trois zones, une de plus que les niveaux précédents. La clairière (montagnes
enneigées, sapins, lucioles), le bosquet profond (champignons géants), puis le
cercle de pierres — l'arène. Le moteur accepte désormais plusieurs sas par
niveau, un par changement de décor.

L'arène est plate et large exprès : le combat a besoin de place pour courir
entre le boss et ses renforts. Une salle encombrée de plateformes rendrait la
phase blindée illisible.

## La règle de tracé des niveaux

Ce round a coûté trois blocages de niveau qu'aucune relecture n'aurait
attrapés. Ils sont devenus une règle, écrite en tête des deux fichiers :

1. **Le chemin du sol est le chemin garanti.** Ses trous ne dépassent jamais
   4 tuiles (96 px) là où Brad court à 141 px de portée.
2. **Rien au-dessus d'un élan.** Une plateforme posée juste avant un trou fait
   cogner Brad en plein saut et le précipite dedans. C'est le pire bug de
   niveau qui soit : il ressemble à une erreur du joueur.
3. **Pas de plafond bas au-dessus d'une marche.** Un bloc de 2 tuiles sous une
   plateforme à 72 px est infranchissable — Brad n'a pas la place de sauter.
4. **Les obstacles posés au sol font 2 tuiles au plus**, et jamais contre le
   bord d'un trou.

Tout ce qui monte plus haut est une voie *optionnelle* : des pièces, un
raccourci, une position de tir. Jamais un passage obligé.

Deux analyseurs automatiques vérifient ces règles sur les cinq niveaux, et
c'est eux qui ont trouvé le mur de 96 px du niveau 2, les cinq plateformes
posées au-dessus d'un élan, et le plafond à 72 px au-dessus d'une marche. Un
troisième contrôle, ajouté après coup, a trouvé la porte du niveau 3 placée
*au-delà* du mur de droite : elle était tout simplement hors du niveau.

## Le BRADDY3000 parle moins vite

Une réplique restait 3,4 secondes à l'écran quelle que soit sa longueur. Deux
changements :

- **La durée se calcule sur le texte** — 2,2 s de base plus 55 ms par
  caractère, plafonnée à 14 s. Une réplique courante tient maintenant 6 à 9
  secondes.
- **Et surtout, la bulle attend qu'on la ferme.** Passé un court délai de
  lecture, un « E pour fermer ▸ » clignote dans le coin ; réappuyer sur E (ou
  toucher la bulle, au doigt) la referme ou enchaîne. Le minuteur reste comme
  filet : si Brad s'éloigne ou fait autre chose, elle finit par se refermer
  seule.

Le délai avant que l'appui ne ferme est là exprès : sans lui, le E qui vient
d'ouvrir la bulle la refermerait dans la même seconde.

Il a aussi de quoi parler. Ses répliques sur l'appareil à raclette changent
complètement selon le nombre de pièces rapportées, et rentrer d'un niveau avec
une pièce déclenche une réplique dédiée qui prime sur son commentaire de
mission habituel.

## Vérification

`81` contrôles automatisés, tous verts. Ils couvrent la durée et la fermeture
des répliques, la géométrie des deux niveaux, la structure de l'arène, le
déroulement complet du combat (y compris : le boss encaisse bien **zéro** dégât
pendant le blindage), le ramassage de la pièce, sa persistance après
rechargement, le comportement en cas de mort avant et après la victoire, le
filet anti-blocage, et une traversée automatique des **quatre** niveaux de bout
en bout — le pilote bat le boss et rapporte le poêlon.

## Structure

```
niveaux/niveau2.js    la ville, en été
niveaux/niveau3.js    la vallée enchantée et l'arène
js/boss.js           arènes, blindage, vagues de renforts, pièces majeures
```

Le chargeur de niveaux accepte maintenant plusieurs sas (`SAS_LISTE`) et un
bloc `arene`. La sauvegarde reste `bradbitt.partie.v2`, avec `objets` et
`bossVaincus` en plus : les parties du prototype 08 restent lisibles.

## Ce qui n'est pas encore là

Les niveaux 4 à 10, les boss des niveaux 6 et 9, le boss final sous le manoir,
les Brad Coins secrets et leurs aptitudes, et les uniformes à silhouette
différente. Les niveaux 2 et 3 réutilisent la musique du niveau 1 en attendant
leurs propres pistes.

---

# Prototype 10 — le jukebox, la pause, et douze corrections

## Le jukebox

Une borne dans la base, entre l'arcade et la carte. Six morceaux : trois
disponibles d'entrée — **Classique** (le thème de la base), **Chill** et
**Techno** — et trois derrière un code : **3IRL**, **CORE**, **N2S3**. Chacun a
sa description ; les morceaux verrouillés restent visibles, en gris, avec un
cadenas, pour qu'on sache qu'il y a quelque chose à chercher.

L'onglet « Code » a un clavier à l'écran **et** accepte la frappe au clavier
physique. Le clavier à l'écran n'est pas qu'une concession au tactile : le jeu
est dessiné dans un canvas, il n'a pas de champ de saisie, et un joueur devant
un rectangle vide n'a aucune raison de deviner qu'il peut taper. Un code valide
prévient, ajoute le morceau à la liste, bascule dessus, et fait réagir le
BRADDY3000.

Le morceau choisi et les codes trouvés vivent dans la sauvegarde : revenir dans
la base retrouve son ambiance.

Les six morceaux ne sont **pas** préchargés au lancement — ce serait une
trentaine de mégaoctets d'attente pour un seul qui sera écouté. Ils se chargent
à la demande, avec un garde-fou : si le joueur change d'avis pendant le
chargement, le morceau abandonné ne démarre pas par-dessus le nouveau.

## Le menu de pause

Échap coupait le niveau et renvoyait à la base **sans rien demander** — donc
sans prévenir que les Brad Coins ramassés étaient perdus. Il ouvre maintenant un
menu : Reprendre, Recommencer le niveau, Options, Retour à la base, Menu
principal.

L'avertissement est affiché **deux fois**, et c'est voulu : en rouge sous les
choix, avec le compte exact (« 14 BC ramassés seraient perdus »), puis dans une
confirmation. Le joueur doit connaître le risque avant de viser le bouton, pas
seulement après l'avoir cliqué.

Les options ouvertes depuis la pause y reviennent, au lieu de retomber au menu
principal en abandonnant le niveau.

## L'écran de chargement

« Continuer » basculait dans la base en une image. Sept secondes de logo, de
barre et d'un conseil tiré parmi quatorze rendent la transition supportable — et
donnent enfin une place aux conseils qu'aucun écran n'affichait. Le chargement
du lancement (les deux logos studio) est conservé tel quel.

## Les plateformes mobiles

Une barre qui fait la navette au-dessus du vide, avec son rail visible pour
qu'on puisse anticiper. Deux au niveau 2, une au niveau 3.

Deux règles ont guidé leur placement. D'abord Brad est **porté** : sans cela la
barre glisse sous ses pieds et il tombe en restant immobile, ce qui ressemble à
un jeu cassé. Ensuite, chaque barre survole un trou que Brad peut **déjà**
franchir d'un saut : elle est un confort et une variation de rythme, jamais le
seul passage. Un niveau qui dépend d'une plateforme mobile devient injouable si
elle se bloque.

## Les musiques

Les niveaux 2 et 3 ont enfin les leurs, et les mini-boss des niveaux 3, 6 et 9
ont chacun la sienne. Celle du boss remplace celle du niveau au déclenchement du
combat, et rend la main à la fin.

Le dossier `assets/audio` pèse maintenant environ 77 Mo (onze pistes en deux
encodages, AAC et MP3). C'est beaucoup pour un site : si le poids devient
gênant, le MP3 peut sauter — il n'existe que pour les compilations de Chromium
sans AAC, tous les navigateurs grand public lisent le `.m4a`.

## Les douze corrections

### Le « Sortir » de Serra Invaders

`texteCentre()` dessine **toujours** au milieu du canvas. S'en servir pour
étiqueter un bouton placé ailleurs pose le mot au centre de l'écran, à 224
pixels de sa zone cliquable. Le joueur cliquait sur le mot « Sortir » ; le
bouton, lui, était un rectangle vide dans le coin. Sur l'écran de fin de partie,
c'était pire : les deux étiquettes se superposaient au milieu et aucune n'était
sur son bouton. Un `texteCentreEn(texte, x, …)` a été ajouté et les deux écrans
corrigés.

### Les taches de couleur sur le visage de Brad

La détection de la cravate cherchait « du rouge dominant » : elle attrapait
aussi l'ombre sous la mâchoire (187,114,68) et le contour des cheveux
(221,146,104), qui sont du rouge dominant — mais de la peau. Ces pixels
prenaient la couleur de la cravate sur chaque planche recolorée.

Ce qui sépare vraiment les deux, c'est le **niveau absolu** du vert et du bleu :
la cravate tourne autour de (161,4,18), la peau ne descend jamais sous ~100 de
vert. Le filtre exige maintenant `r > 120`, `g < 95` et `b < 95`. Un test
compare chaque planche recolorée à l'originale et **refuse le moindre pixel
modifié au-dessus de la ligne du col**.

### « Cravate Serrano »

Ce n'était pas une erreur : c'est bien la cravate **jaune**, débloquée à 40
Brad Coins. Mais le nom ne permettait pas de le deviner. Elle s'appelle
maintenant « Cravate jaune », et le surnom Serrano est passé dans la
description, où il amuse sans égarer.

### La cinématique de la base fermée trop vite

Pendant la scène, la caméra se promène et les deux personnages la suivent : la
passer déposait Brad là où la mise en scène l'avait laissé — souvent à l'autre
bout de la base, parfois déjà dans la zone d'activation d'un poste. Et la bulle
du BRADDY3000, qui a sa propre durée, survivait à la scène.

La fin de la scène remet maintenant tout en place : Brad à l'entrée, le robot à
son comptoir, la caméra au bord gauche, aucune réplique en cours. Cela vaut
aussi bien pour la scène regardée en entier que pour la scène passée.

### Les fenêtres qui clignotaient

Le pire des douze, parce qu'il n'est pas seulement laid. L'état de chaque
fenêtre était tiré de sa position **à l'écran** — qui change à chaque pixel de
défilement. Le même carreau se rallumait plusieurs fois par seconde dès que
Brad marchait : toute la façade stroboscopait, ce qui est franchement risqué
pour une personne photosensible.

L'état dépend maintenant du numéro de l'immeuble et du rang de la fenêtre dans
cet immeuble — deux nombres qui ne bougent jamais. Un test mesure les pixels
allumés à huit positions de caméra consécutives et refuse toute variation
notable.

### Les plateformes inatteignables et superposées

Vingt-quatre défauts trouvés, sur les **cinq** niveaux, pas seulement les
nouveaux. Un outil a été écrit pour ça — `tools/verifier_niveaux.js` — qui
charge les fichiers de niveau et les règlages réels du jeu, puis vérifie trois
choses : aucun solide n'en recouvre un autre ; chaque plateforme est atteignable
par une chaîne de sauts depuis le sol ; et rien ne fait plafond au-dessus d'un
élan ou d'une marche.

Deux enseignements en sont sortis. Le premier : mon modèle de portée était trop
sévère et condamnait des plateformes parfaitement atteignables — il calcule
maintenant le vrai temps de vol à la hauteur visée. Le second : **les
plateformes traversables ne font pas plafond**, puisque Brad les franchit par en
dessous ; les compter comme des obstacles condamnait à tort la moitié des
perchoirs.

Le verdict est aujourd'hui « aucun défaut » sur les cinq niveaux, et le test
échoue si cela change.

### Le Serra-Boost coincé près de la sortie du niveau 2

Quatre ennemis apparaissaient **à l'intérieur** d'un bloc et onze au-dessus du
vide — conséquence des plateformes déplacées. Un contrôle compare chaque point
d'apparition à la géométrie et refuse tout ennemi encastré ou suspendu.

### L'arène

- **Des trampolines dans les deux coins.** Sans eux, un joueur acculé par le
  Colosse n'avait aucune sortie : le boss est plus large que Brad, il le plaquait
  contre le mur, et le combat se terminait par une mort qui ne devait rien à son
  niveau de jeu. Le rebond a dû être exempté de la « gravité bouton relâché »,
  sans quoi il ne montait qu'à 68 px au lieu de 176 — et ne servait à rien.
- **Les corniches sont descendues** de la rangée 10 à la 12 : à 120 px du sol,
  elles étaient hors de portée d'un saut de 74 px.
- **On ne reste plus coincé sur le boss.** Atterrir sur son crâne ne coûte
  désormais aucun point de vie et éjecte Brad vers le centre de la salle.

Deux effets de bord, trouvés par les tests : le trampoline de droite était posé
**sur la porte de sortie** — Brad rebondissait par-dessus au lieu d'entrer — et
la corniche droite se trouvait au point de chute du poêlon, qui atterrissait donc
sur une étagère au lieu du sol de l'arène. Les deux ont été déplacés.

## Vérification

`83` contrôles automatisés, tous verts, plus l'outil de géométrie sur les cinq
niveaux. La suite tourne sur un petit serveur HTTP local : en `file://`,
`getImageData()` refuse de lire un canvas qui a reçu une image locale, et le
test anti-clignotement en a besoin.

Le pilote automatique traverse les quatre niveaux, bat le boss et rapporte le
poêlon. Il a fallu lui apprendre deux choses au passage, toutes deux
révélatrices : ne pas sauter un trou avec un ennemi dans les pattes — le recul
d'un coup reçu en plein saut coupe l'élan et fait tomber dans le vide — et,
après le boss, aller chercher la pièce puis la porte au lieu de continuer vers
le mur du fond.

## Structure

```
js/jukebox.js         la borne, les codes, les six morceaux
js/pause.js           menu de pause et écran de chargement
js/mobiles.js         plateformes mobiles
tools/verifier_niveaux.js   contrôle de géométrie des niveaux
```

La sauvegarde reste `bradbitt.partie.v2`, avec `piste` et `codes` en plus.

## Ce qui n'est pas encore là

Les niveaux 4 à 10, les boss des niveaux 6 et 9, le boss final, les Brad Coins
secrets, et les uniformes à silhouette différente.

---

# Prototype 10a — le silence, et les codes qui se donnaient

## Pourquoi il n'y avait plus de musique

Le défaut était dans `audio.precharger()`, et il était **invisible par
construction**. Quand le fichier du format choisi ne se chargeait pas, la
fonction résolvait sa promesse **sans rien enregistrer** : pas d'erreur, pas de
trace, juste une table de pistes vide. Tous les `jouerMusique()` suivants ne
faisaient alors plus rien du tout. Le jeu tournait parfaitement, en silence
complet, sans que quoi que ce soit n'indique pourquoi — dans les niveaux comme
au jukebox.

`EXT_AUDIO` choisit le format une fois pour toutes au démarrage, en demandant
son avis au navigateur via `canPlayType()`. Or cet avis n'est qu'un avis : la
méthode répond « maybe » pour des formats que le navigateur refuse ensuite
réellement de lire. Un seul mauvais pronostic, et toute la bande-son
disparaissait.

Deux garde-fous :

1. **Repli automatique sur l'autre format.** Chaque morceau existe en `.m4a` et
   en `.mp3`. `EXT_AUDIO` n'est plus qu'une *préférence* : si le fichier préféré
   échoue, l'autre est chargé et rangé sous la clé d'origine — le reste du jeu
   ignore ce repli. Le délai de sécurité ne déclare plus une piste bonne sans
   avoir vérifié que le navigateur en a lu quelque chose.
2. **Les échecs se voient.** Ce qui n'a pu être chargé d'aucune façon atterrit
   dans `audio.echecs`, et le menu principal affiche une ligne rouge nommant le
   premier fichier fautif. Un son manquant doit être un fait constaté, pas un
   mystère.

Un test rejoue précisément la panne : il force le jeu à demander le `.m4a` dans
un navigateur qui l'annonce sans savoir le lire, et vérifie que la musique sort
quand même. Un autre cache les deux encodages d'une piste et vérifie que le jeu
le signale.

## Les morceaux à code ne donnent plus leur code

Le nom affiché **était** le code : « 3IRL », « CORE », « N2S3 » se lisaient dans
la liste, et il n'y avait plus rien à chercher. Les morceaux verrouillés
s'affichent désormais `? ? ?`, avec « code requis » à droite et « Verrouillé. Il
existe un code pour ça. » en description. Le nom apparaît au déblocage.

Un test intercepte tout le texte réellement dessiné à l'écran et **échoue si un
seul des trois codes y apparaît**.

## Vérification

`30` contrôles, tous verts : les deux scénarios audio, l'absence de fuite des
codes, la géométrie des cinq niveaux, et la traversée automatique des quatre
niveaux.
