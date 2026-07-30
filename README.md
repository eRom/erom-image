# erom-image

Repo de développement du plugin Claude Code **erom-image** : deux serveurs MCP de génération
d'images (nanobanana/Gemini, gpt/OpenAI) et leurs skills.

Seul le sous-dossier [`plugin/`](./plugin) est distribué, via la source `git-subdir` de
[erom-marketplace](https://github.com/eRom/erom-marketplace).

## Structure

```
servers/<nom>/src/     sources TypeScript des serveurs MCP
plugin/                artefact distribué : manifeste, skills, bundles
docs/superpowers/      spec et plan d'implémentation
```

## Développement

```bash
bun install
bun test           # suites de constants et du service OpenAI
bun run typecheck
bun run build      # bundles single-file vers plugin/servers/*/dist/
```

Les bundles sont committés : le cache d'installation d'un plugin n'a ni `node_modules`
ni étape de build.

## Licence

MIT
