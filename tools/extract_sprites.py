#!/usr/bin/env python3
"""
Brad Bitt, mais le jeu — extraction des sprites d'ennemis.

Prend les JPG d'origine (fond blanc, haute resolution) et produit des PNG
transparents pretes a l'emploi dans le jeu.

Etapes :
  1. seuil sur la luminance pour separer le sujet du fond blanc
  2. suppression des taches isolees (artefacts JPEG) par composantes connexes
  3. recadrage sur la boite englobante
  4. reduction a une hauteur cible avec LANCZOS
  5. alpha binaire (pas de semi-transparence -> rendu pixel art net)
  6. legere resaturation pour compenser le flou du JPEG

Usage : python3 extract_sprites.py <dossier_source> <dossier_sortie> [hauteur]
"""
import sys
import os
import json
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

# Hauteur de chaque ennemi, exprimee en multiple de la hauteur de reference
# passee en argument. Le Lourd domine, le Volant est plus ramasse.
HAUTEURS = {
    "Serra": 1.00,          # ennemi de base, le "goomba" du jeu
    "Serra-Boost": 1.00,    # le coureur
    "Serra-Lanceur": 1.05,  # lance des boules de Serrano
    "Serra-Lourd": 1.25,
    "Serra-Volant": 0.95,
}

# Elements qui ne sont pas des ennemis : hauteur fixe, independante du reste.
OBJETS = {
    "Projetcile du Serra-Lanceur": ("boule-serrano", 14),
}

SEUIL_FOND = 232      # au-dessus de cette valeur moyenne RGB -> considere blanc
MIN_BLOB = 0.002      # une composante < 0.2% des pixels du sujet est un artefact


def masque_sujet(rgb: np.ndarray) -> np.ndarray:
    """Masque booleen du sujet, artefacts JPEG retires."""
    luminance = rgb.mean(axis=2)
    brut = luminance < SEUIL_FOND

    # Les bords du fond blanc contiennent du bruit JPEG isole : on ne garde
    # que les composantes connexes significatives.
    etiquettes, n = ndimage.label(brut)
    if n == 0:
        raise ValueError("aucun sujet detecte")
    tailles = ndimage.sum(brut, etiquettes, range(1, n + 1))
    seuil = max(brut.sum() * MIN_BLOB, 12)
    gardees = {i + 1 for i, t in enumerate(tailles) if t >= seuil}
    masque = np.isin(etiquettes, list(gardees))

    # Bouche les trous internes (yeux blancs, reflets) pour ne pas percer le sprite
    return ndimage.binary_fill_holes(masque)


def extraire(chemin: str, hauteur_cible: int) -> Image.Image:
    src = Image.open(chemin).convert("RGB")
    rgb = np.array(src)
    masque = masque_sujet(rgb)

    ys, xs = np.where(masque)
    boite = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

    rgba = np.dstack([rgb, np.where(masque, 255, 0).astype(np.uint8)])
    img = Image.fromarray(rgba, "RGBA").crop(boite)

    largeur = max(1, round(img.width * hauteur_cible / img.height))
    petit = img.resize((largeur, hauteur_cible), Image.LANCZOS)

    # Alpha binaire : indispensable pour un rendu pixel art net une fois
    # reagrandi a l'ecran avec image-rendering: pixelated.
    arr = np.array(petit)
    arr[..., 3] = np.where(arr[..., 3] > 140, 255, 0)
    # Les pixels devenus transparents gardent parfois une couleur delavee
    # heritee du fond blanc : on les neutralise.
    arr[arr[..., 3] == 0] = 0
    petit = Image.fromarray(arr, "RGBA")

    return ImageEnhance.Color(petit).enhance(1.12)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    source, sortie = sys.argv[1], sys.argv[2]
    base = int(sys.argv[3]) if len(sys.argv) > 3 else 48
    os.makedirs(sortie, exist_ok=True)

    manifeste = {}
    for fichier in sorted(os.listdir(source)):
        if not fichier.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        nom = os.path.splitext(fichier)[0]
        if nom in HAUTEURS:
            sortie_nom, h = nom, round(base * HAUTEURS[nom])
        elif nom in OBJETS:
            sortie_nom, h = OBJETS[nom]
        else:
            continue
        img = extraire(os.path.join(source, fichier), h)
        img.save(os.path.join(sortie, f"{sortie_nom}.png"))
        manifeste[sortie_nom] = {"fichier": f"{sortie_nom}.png", "w": img.width, "h": img.height}
        print(f"{sortie_nom:16s} -> {img.width:3d}x{img.height:3d} px")

    with open(os.path.join(sortie, "manifeste.json"), "w", encoding="utf-8") as f:
        json.dump(manifeste, f, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
