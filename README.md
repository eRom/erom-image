# erom-image

![erom-image](plugin/assets/erom-image.png)

Repo de développement du plugin Claude Code **erom-image** : deux serveurs MCP de génération
d'images (nanobanana/Gemini, gpt/OpenAI) avec leurs skills, une skill de filigrane image/PDF,
et une skill de QR-Code.

Seul le sous-dossier [`plugin/`](./plugin) est distribué, via la source `git-subdir` de
[erom-marketplace](https://github.com/eRom/erom-marketplace).

## Structure

```
servers/<nom>/src/     sources TypeScript des serveurs MCP
filigrane/             source Python du moteur de filigrane (uv, pytest)
scripts/               vendoring et outillage
plugin/                artefact distribué : manifeste, skills, bundles, script embarqué
docs/superpowers/      spec et plan d'implémentation
```

## Développement

```bash
bun install
bun test           # suites TypeScript + suite Python du filigrane
bun run typecheck
bun run build      # bundles single-file + vendoring du filigrane vers plugin/
```

Pour n'exercer que le moteur de filigrane :

```bash
uv run --project filigrane pytest
```

## Le principe qui gouverne tout

Rien dans `plugin/` n'est écrit à la main, et rien n'y suppose un environnement préparé :
le cache d'installation d'un plugin n'a ni `node_modules`, ni environnement virtuel, ni
étape de build. Chaque toolchain produit donc un artefact autoportant, committé :

- **TypeScript** → `bun build --target=node` inline les dépendances dans un fichier unique
- **Python** → un entrypoint [PEP 723](https://peps.python.org/pep-0723/) déclare ses
  dépendances dans son en-tête, et `uv` les résout à la volée au premier appel

Les modifications se font toujours dans les sources (`servers/`, `filigrane/`), jamais
dans `plugin/`.

## Licence

MIT
