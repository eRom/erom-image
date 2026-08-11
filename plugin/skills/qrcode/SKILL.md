---
name: qrcode
description: "Génère un QR-Code SVG ou PNG et vérifie par relecture qu'il pointe bien où il faut, ou décode un QR existant. Triggers: créer un QR code vers une URL, un wifi, un mail, un contact ou une position ; QR à intégrer dans une page, un flyer, une affiche, une carte de visite ; lire ou décoder un QR sur une image, une capture ou un scan ; vérifier qu'un QR pointe encore au bon endroit."
user-invocable: true
---

# QRCode

Génération et lecture de QR-Codes avec Segno, en local, sans API ni clé. Deux propriétés
structurent tout le reste :

- **Rien n'est écrit sur le disque sans avoir été relu.** Le symbole passe d'abord dans
  un décodeur, qui compare la charge utile à ce qui était demandé ; le fichier n'est
  produit qu'ensuite. Un QR qui ne se décode pas ne laisse aucune trace à nettoyer.
- **Toujours un QR classique, jamais un Micro QR.** `segno.make()` bascule en Micro QR
  dès que le contenu est court (`"A"` donne un M2-M), et la plupart des caméras de
  téléphone ne les lisent pas. `segno.make_qr()` force le format universel.

---

## Prérequis

`uv` résout les dépendances Python tout seul au premier appel (~6 s la première fois,
instantané ensuite). Rien à installer.

```bash
command -v uv >/dev/null 2>&1 || {
  echo "uv est requis : brew install uv (ou https://docs.astral.sh/uv/)" >&2; exit 1; }
```

---

## Génération

```bash
QR_DATA="https://exemple.fr/page?source=qr"  # charge utile ; voir « Contenus non-URL »
QR_OUT="qr.png"        # le format se déduit de l'extension : .png ou .svg
QR_SIZE=512            # PNG seulement : largeur visée en px, quiet zone comprise
QR_ECC="m"             # correction d'erreur : l|m|q|h (voir plus bas)
QR_DARK="#201e1d"      # modules
QR_LIGHT="#ffffff"     # fond ; "none" pour un fond transparent

uv run --quiet --with segno --with zxing-cpp --with pillow python - \
  "$QR_DATA" "$QR_OUT" "$QR_SIZE" "$QR_ECC" "$QR_DARK" "$QR_LIGHT" <<'PYEOF'
import io, sys
from pathlib import Path
import segno, zxingcpp
from PIL import Image

data, out, size, ecc, dark, light = sys.argv[1:7]
out, size = Path(out), int(size)
light = None if light.lower() in ("", "none", "transparent") else light
if out.exists():
    sys.exit(f"❌ {out} existe déjà : renomme-le ou choisis un autre nom.")

# make_qr, jamais make() : make() bascule en Micro QR sur un contenu court.
qr = segno.make_qr(data, error=ecc)
border = 4  # quiet zone ISO ; en dessous, les lecteurs décrochent

# Relecture AVANT écriture : rien n'atterrit sur le disque qui n'ait été décodé.
buf = io.BytesIO()
qr.save(buf, kind="png", border=border, scale=8, dark=dark, light=light or "#ffffff")
res = zxingcpp.read_barcode(Image.open(buf))
if res is None or res.text != data:
    sys.exit(f"❌ relecture impossible : {res.text if res else 'aucun code détecté'}")
if res.format != zxingcpp.BarcodeFormat.QRCode:
    sys.exit(f"❌ symbole {res.format}, pas un QR classique")

if out.suffix.lower() == ".svg":
    qr.save(out, kind="svg", border=border, dark=dark, light=light,
            omitsize=True, xmldecl=False, svgns=True)
    rendu = "SVG (dimensionné par le conteneur)"
else:
    modules, _ = qr.symbol_size(scale=1, border=border)
    scale = max(1, round(size / modules))  # entier : un scale fractionnaire déforme les modules
    qr.save(out, kind="png", border=border, scale=scale, dark=dark, light=light)
    w, h = qr.symbol_size(scale=scale, border=border)
    rendu = f"PNG {w}x{h}"

if light is None:
    print("⚠️  fond transparent : à poser sur un fond clair uniquement.")
apercu = res.text.splitlines()[0][:70] + ("…" if len(res.text) > 70 or "\n" in res.text else "")
print(f"✅ {qr.designator} · {rendu} · relu : {apercu}")
print(f"📁 Saved to: {out.resolve()}")
PYEOF
```

Termine toujours en annonçant le chemin réel, dans le style des autres outils du plugin.

---

## Défauts à appliquer sans demander

Si Romain ne précise rien, **ne pose pas de question** : le but est qu'un QR parte en un
tour. Il corrigera s'il veut autre chose.

| Question | Défaut |
|---|---|
| Format | `.png` ; `.svg` seulement pour une intégration web ou un support vectoriel |
| Taille | 512 px |
| Couleurs | `#201e1d` sur blanc |
| Correction | `m` |
| Emplacement | répertoire courant, nom tiré du contexte (`qr-inscription.png`) |

**Correction d'erreur.** `m` (15 %) convient à l'écran et au papier propre. Passe à `q`
(25 %) ou `h` (30 %) pour un support exposé aux salissures, aux plis ou à l'impression
petite. Segno relève le niveau tout seul quand cela tient dans la même version du
symbole : demander `m` peut produire un `2-Q`, c'est un gain, pas une anomalie.

**Impression.** Repère de terrain : un QR se lit jusqu'à environ dix fois sa largeur de
distance, et devient fragile sous 2 cm de côté. Sur un flyer tenu en main, 2,5 à 3 cm
passent partout.

---

## Contenus non-URL

La nature du QR tient entièrement dans la charge utile encodée. Il suffit de changer
`QR_DATA` :

| Contenu | Charge utile |
|---|---|
| Page web | `https://exemple.fr/page` |
| Email | `mailto:contact@exemple.fr?subject=Devis&body=Bonjour` |
| Téléphone | `tel:+33612345678` |
| SMS | `SMSTO:+33612345678:Texte du message` |
| Position | `geo:48.8566,2.3522` |
| Wifi | `WIFI:T:WPA;S:<ssid>;P:<clé>;;` |

Le wifi et la vCard ne se recopient pas à la main dans `QR_DATA` : le premier échappe
`;` `:` `"` `\` à l'intérieur du SSID et du mot de passe, la seconde tient sur plusieurs
lignes séparées par des CRLF, et ni l'un ni l'autre ne survit intact à un aller-retour
par une variable shell. Construis la charge utile dans le script lui-même, en insérant
ces deux lignes juste après la lecture des arguments :

```python
from segno import helpers
data = helpers.make_wifi_data(ssid="Chez;Romain", password='a"b;c', security="WPA")
# ou : data = helpers.make_vcard_data(name="Ecarnot;Romain", displayname="Romain Ecarnot",
#                                     email="contact@exemple.fr", url="https://exemple.fr")
```

`QR_DATA` est alors ignoré, et la relecture vérifie la charge utile réellement encodée.
Le helper email, lui, s'appelle `make_make_email_data` : c'est une faute de frappe amont
dans segno 1.6.6, pas une erreur de ta part. Un `mailto:` écrit à la main fait aussi bien.

---

## Décodage

```bash
uv run --quiet --with zxing-cpp --with pillow python - image.png <<'PYEOF'
import sys
from pathlib import Path
import zxingcpp
from PIL import Image

for arg in sys.argv[1:]:
    path = Path(arg)
    if path.suffix.lower() == ".svg":
        print(f"{path.name} : SVG non lisible ici (zxing lit des images matricielles).")
        continue
    codes = zxingcpp.read_barcodes(Image.open(path))
    if not codes:
        print(f"{path.name} : aucun code détecté (cadrage, flou, contraste ou image trop petite).")
        continue
    for c in codes:
        print(f"{path.name} : [{c.format}] {c.text}")
PYEOF
```

Plusieurs fichiers peuvent être passés d'un coup, et plusieurs codes dans une même image
sont tous rendus. Un QR noyé dans une capture d'écran chargée est retrouvé sans recadrage
préalable. Le format annoncé entre crochets vaut information : un `[EAN-13]` ou un
`[Micro QR Code]` explique souvent pourquoi un lecteur grand public échoue là où celui-ci
réussit.

---

## Pièges vérifiés

| Piège | Ce qu'il faut savoir |
|---|---|
| `qr.matrix_size` | N'existe pas dans segno 1.6.6. La taille du symbole s'obtient par `qr.symbol_size(scale, border)`, qui rend un couple `(largeur, hauteur)` en modules. |
| SVG sans `light` | Segno produit un fond **transparent**. Un QR sombre posé sur une page sombre devient illisible, y compris pour un décodeur. Sur une maquette dark-first, fournis un fond clair explicite. |
| QR inversé | Modules clairs sur fond sombre : relu sans problème par le décodeur de cette skill, mais hors spec ISO, qui impose des modules sombres. Rien ne garantit qu'une caméra donnée l'accepte : sur un imprimé ou pour un public large, reste en sombre sur clair. |
| Scale fractionnaire | Un scale non entier produit des modules de largeurs inégales. Le bloc arrondit et annonce la taille réelle obtenue, qui diffère de la taille demandée. |
| Sortie SVG en mémoire | Le writer SVG de segno écrit des octets : `io.BytesIO`, jamais `io.StringIO`. |

---

## Limites connues

- **Pas de logo au centre.** Segno ne compose pas d'image ; il faudrait un post-traitement
  Pillow, et un niveau de correction `h` pour absorber la surface masquée.
- **La relecture valide la charge utile, pas l'intégration.** Elle prouve que le symbole
  est bien formé et décodable ; elle ne dit rien du contraste réel une fois le SVG posé
  dans une page, ni de la taille à l'impression.
- **Un SVG déjà écrit n'est pas relisible** sans rasteriseur, et la rasterisation demande
  une bibliothèque système (`cairo`) que ce plugin n'exige pas. Vérifie à la génération,
  où la relecture est faite sur le symbole en mémoire.
