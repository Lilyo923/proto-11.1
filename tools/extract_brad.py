#!/usr/bin/env python3
"""
Brad Bitt, mais le jeu — decoupe de la planche de sprites de Brad.

La planche source est une grille 4 colonnes x 3 lignes :
  ligne 0 : repos      (4 images)
  ligne 1 : marche     (4 images)
  ligne 2 : course     (4 images)

Le script produit UNE planche PNG a cellules regulieres, plus un JSON decrivant
les animations. Deux precautions importantes :

  * toutes les images sont mises a la meme echelle (celle de la plus haute),
    sinon Brad grandirait et retrecirait pendant l'animation ;
  * l'alignement horizontal se fait sur le CENTRE DE LA TETE et non sur la
    boite englobante. Les bras qui se balancent elargissent la boite d'une
    image a l'autre : un centrage sur la boite ferait vibrer le personnage
    lateralement a chaque pas.

Usage : python3 extract_brad.py <planche.png> <dossier_sortie> [hauteur]
"""
import sys
import os
import json
import numpy as np
from PIL import Image
from scipy import ndimage

COLONNES = 4
LIGNES = 3

# La planche d'origine a la chemise TRANSPARENTE entre les revers de la veste :
# le trou laisse voir le decor a travers le torse de Brad. On le rebouche a
# l'extraction. Blanc releve sur l'uniforme « classique » de reference.
BLANC_CHEMISE = (255, 255, 255)
ANIMATIONS = {
    "repos":  {"ligne": 0, "images": [0, 1, 2, 3], "duree": 0.22},
    "marche": {"ligne": 1, "images": [0, 1, 2, 3], "duree": 0.13},
    "course": {"ligne": 2, "images": [0, 1, 2, 3], "duree": 0.09},
}


def bandes(occupe: np.ndarray, axe: int):
    """Intervalles contigus de lignes/colonnes non vides."""
    presence = occupe.any(axis=1 - axe)
    out, debut = [], None
    for i, v in enumerate(presence):
        if v and debut is None:
            debut = i
        elif not v and debut is not None:
            out.append((debut, i))
            debut = None
    if debut is not None:
        out.append((debut, len(presence)))
    return out


def reboucher_trous(arr: np.ndarray, occupe: np.ndarray, boite) -> None:
    """Remplit de blanc les trous transparents ENFERMES dans le sprite.

    On distingue un trou d'un creux par connexite : le fond exterieur touche
    forcement le bord de la vignette. Une zone transparente qui ne le touche
    pas est un trou a reboucher — ici la chemise. L'echancrure entre les
    jambes, elle, debouche sur le bas de la vignette : elle est donc reliee au
    bord et reste intacte.
    """
    x0, y0, x1, y1 = boite
    sous = occupe[y0:y1, x0:x1]
    vide = ~sous

    etiquettes, n = ndimage.label(vide)
    if n == 0:
        return

    # Etiquettes qui touchent l'un des quatre bords : c'est le fond.
    dehors = set(etiquettes[0, :]) | set(etiquettes[-1, :]) \
           | set(etiquettes[:, 0]) | set(etiquettes[:, -1])
    dehors.discard(0)

    trous = np.isin(etiquettes, [i for i in range(1, n + 1) if i not in dehors])
    if not trous.any():
        return

    ys, xs = np.where(trous)
    arr[y0 + ys, x0 + xs, 0] = BLANC_CHEMISE[0]
    arr[y0 + ys, x0 + xs, 1] = BLANC_CHEMISE[1]
    arr[y0 + ys, x0 + xs, 2] = BLANC_CHEMISE[2]
    arr[y0 + ys, x0 + xs, 3] = 255
    occupe[y0 + ys, x0 + xs] = True


def centre_tete(sous_masque: np.ndarray) -> float:
    """Abscisse moyenne du quart superieur du sprite (la tete, stable)."""
    haut = sous_masque[: max(1, sous_masque.shape[0] // 4)]
    xs = np.where(haut)[1]
    return float(xs.mean()) if xs.size else sous_masque.shape[1] / 2


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    source, sortie = sys.argv[1], sys.argv[2]
    hauteur_cible = int(sys.argv[3]) if len(sys.argv) > 3 else 46
    os.makedirs(sortie, exist_ok=True)

    img = Image.open(source).convert("RGBA")
    arr = np.array(img)
    occupe = arr[..., 3] > 10
    if not occupe.any():
        # Planche sans canal alpha : on retombe sur un seuil de blanc.
        occupe = arr[..., :3].astype(int).sum(axis=2) < 700

    bx = bandes(occupe, 1)
    by = bandes(occupe, 0)
    if len(bx) != COLONNES or len(by) != LIGNES:
        print(f"Grille inattendue : {len(bx)} colonnes x {len(by)} lignes "
              f"(attendu {COLONNES}x{LIGNES}).")
        return 2

    # Premiere passe : boites englobantes, rebouchage, centres de tete.
    infos = []
    hauteur_max = 0
    for (y0, y1) in by:
        for (x0, x1) in bx:
            sm = occupe[y0:y1, x0:x1]
            ys, xs = np.where(sm)
            bb = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
            reboucher_trous(arr, occupe, bb)
            sm2 = occupe[bb[1]:bb[3], bb[0]:bb[2]]
            infos.append({"bb": bb, "tete": centre_tete(sm2)})
            hauteur_max = max(hauteur_max, bb[3] - bb[1])

    # Le rebouchage a modifie `arr` : on repart de la version corrigee.
    img = Image.fromarray(arr, "RGBA")

    echelle = hauteur_cible / hauteur_max
    cellule_h = hauteur_cible + 2
    cellule_w = int(max((i["bb"][2] - i["bb"][0]) for i in infos) * echelle) + 4
    if cellule_w % 2:
        cellule_w += 1

    planche = Image.new("RGBA", (cellule_w * COLONNES, cellule_h * LIGNES), (0, 0, 0, 0))

    for idx, info in enumerate(infos):
        ligne, col = divmod(idx, COLONNES)
        bb = info["bb"]
        vignette = img.crop(bb)
        nw = max(1, round(vignette.width * echelle))
        nh = max(1, round(vignette.height * echelle))
        petit = vignette.resize((nw, nh), Image.LANCZOS)

        # Alpha binaire : rendu net une fois reagrandi par le jeu.
        px = np.array(petit)
        px[..., 3] = np.where(px[..., 3] > 120, 255, 0)
        px[px[..., 3] == 0] = 0
        petit = Image.fromarray(px, "RGBA")

        # Centrage sur la tete, pieds cales sur le bas de la cellule.
        dx = round(cellule_w / 2 - info["tete"] * echelle)
        dy = cellule_h - nh - 1
        planche.paste(petit, (col * cellule_w + dx, ligne * cellule_h + dy), petit)

    planche.save(os.path.join(sortie, "brad.png"))

    meta = {
        "fichier": "brad.png",
        "cellule": {"w": cellule_w, "h": cellule_h},
        "colonnes": COLONNES,
        "lignes": LIGNES,
        "hauteurPersonnage": hauteur_cible,
        "animations": ANIMATIONS,
    }
    with open(os.path.join(sortie, "brad.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"planche {planche.width}x{planche.height} — cellule "
          f"{cellule_w}x{cellule_h} — Brad {hauteur_cible} px de haut")
    return 0


if __name__ == "__main__":
    sys.exit(main())
