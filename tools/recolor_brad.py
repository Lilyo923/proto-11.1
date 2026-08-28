#!/usr/bin/env python3
"""
Brad Bitt, mais le jeu — generation des planches d'uniformes.

Les uniformes « recoloration pure » (couleur de cravate, costume dore) sont
produits ici a partir de la planche de base, plutot que recolores dans le
navigateur : un canvas nourri par une image locale est teinte en file:// et
interdit getImageData, donc la recoloration a l'execution casserait le mode
double-clic. Des PNG pre-generes marchent partout et ne coutent que ~30 Ko
chacun.

Detection des zones :
  * cravate  : rouge dominant (r nettement au-dessus de g et b) ;
  * costume  : pixels sombres mais pas noirs (les contours et chaussures,
               plus sombres encore, restent intacts).

Usage : python3 recolor_brad.py <planche_base.png> <dossier_sortie>
"""
import sys
import os
import numpy as np
from PIL import Image

# nom -> (couleur de cravate, couleur de costume ou None pour garder)
UNIFORMES = {
    "classique-bleu":   ((44, 108, 216), None),
    "classique-orange": ((226, 122, 32), None),
    "classique-vert":   ((52, 168, 74), None),
    "classique-violet": ((142, 74, 196), None),
    "cravate-jaune":    ((232, 190, 42), None),
    "classique-turquoise": ((32, 190, 186), None),
    "classique-bordeaux":  ((136, 22, 42), None),
    "dore":             ((250, 238, 190), (196, 152, 42)),
}


def recolorer(arr: np.ndarray, cravate, costume):
    out = arr.copy()
    r = arr[..., 0].astype(int)
    g = arr[..., 1].astype(int)
    b = arr[..., 2].astype(int)
    a = arr[..., 3]
    visible = a > 0

    # --- Cravate : rouge SATURE.
    #
    # La regle precedente (« rouge dominant, ecart absolu > 45 ») attrapait
    # aussi les ombres de peau : l'ombre sous la machoire vaut (187,114,68) et
    # le contour des cheveux (221,146,104) — du rouge dominant, mais de la
    # peau. Sur les planches recolorees, ces pixels prenaient la couleur de la
    # cravate et faisaient les taches signalees sur le visage.
    #
    # Ce qui separe vraiment les deux, c'est le NIVEAU ABSOLU du vert et du
    # bleu : la cravate tourne autour de (161,4,18) a (148,46,51), la peau ne
    # descend jamais sous ~100 de vert. D'ou les seuils durs ci-dessous.
    #
    # Le seuil de rouge est a 120 et non 100 : un dernier pixel d'ombre du
    # menton, (101,52,30), passait le filtre et se retrouvait colore. Les
    # vrais pixels de cravate ne descendent jamais sous 124.
    tie = visible & (r > 120) & (g < 95) & (b < 95) \
          & (r > g * 1.8) & (r > b * 1.8)
    if tie.any():
        # Conserve les nuances (ombre de la cravate) via la valeur du pixel.
        v = (r[tie] / max(1, int(r[tie].max()))).clip(0.35, 1.0)
        for c in range(3):
            out[..., c][tie] = (cravate[c] * v).astype(np.uint8)

    # --- Costume : sombre mais pas contour/chaussure.
    if costume is not None:
        lum = (r + g + b) / 3
        suit = visible & (lum >= 16) & (lum <= 62) & ~tie
        if suit.any():
            v = (lum[suit] / 62).clip(0.45, 1.0)
            for c in range(3):
                out[..., c][suit] = (costume[c] * v).astype(np.uint8)

    return out


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    base, sortie = sys.argv[1], sys.argv[2]
    os.makedirs(sortie, exist_ok=True)
    arr = np.array(Image.open(base).convert("RGBA"))
    for nom, (cravate, costume) in UNIFORMES.items():
        res = recolorer(arr, cravate, costume)
        Image.fromarray(res, "RGBA").save(os.path.join(sortie, f"brad-{nom}.png"))
        print(f"brad-{nom}.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
