# filigrane

Moteur du filigrane : appose un texte tuilé en diagonale sur des **images**
(PNG/JPG/TIFF/WebP/HEIC) et des **PDF**. La sortie est toujours une copie ; la source
n'est jamais modifiée et le PDF n'est pas rasterisé, donc son texte d'origine reste
extractible.

## Rôle dans ce dépôt

Ce sous-projet est la **source**. L'artefact distribué est le paquet vendoré dans
`plugin/skills/filigrane/scripts/filigrane/`, régénéré par :

```bash
./scripts/vendor-filigrane.sh
```

C'est le pendant Python de `bun build` pour les serveurs TypeScript, et il répond à
la même contrainte : le cache d'installation d'un plugin n'a ni environnement virtuel
ni étape de build. Toute modification se fait **ici**, jamais dans `plugin/`.

## Développement

```bash
uv run pytest          # suite complète
uv run filigrane --help
```

Les fixtures de test (PDF multi-pages, PNG avec canal alpha) sont **générées** par
`tests/conftest.py`. Aucun binaire n'est commité, et la suite tourne à l'identique sur
n'importe quelle machine.

## Plancher de version

`requires-python = ">=3.12"`, et `.python-version` épingle 3.12 pour que le
développement s'exerce sur la configuration la plus contrainte que l'on annonce.
