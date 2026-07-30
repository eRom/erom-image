# Plugin agence-image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le plugin Claude Code `agence-image`, distribué par erom-marketplace, exposant deux serveurs MCP de génération d'images (nanobanana/Gemini existant, gpt-image/OpenAI à construire) avec leurs skills de pilotage.

**Architecture:** Le repo `erom-agence-image` est un repo de développement dont seul le sous-dossier `plugin/` est distribué, via une source marketplace `git-subdir`. Les serveurs sont écrits en TypeScript dans `servers/<nom>/src/`, puis bundlés en fichier unique par `bun build --target=node` vers `plugin/servers/<nom>/dist/index.js` et committés : le cache d'installation d'un plugin n'a ni `node_modules` ni étape de build, seul un bundle autonome exécutable par `node` fonctionne.

**Tech Stack:** bun (runtime, packages, bundler, test runner), TypeScript, `@modelcontextprotocol/sdk`, `zod` v3, `@google/genai` (nanobanana), `fetch`/`FormData` natifs (gpt-image, zéro dépendance).

**Spec:** `docs/superpowers/specs/2026-07-30-agence-image-plugin-design.md` (lire la note de révision en tête : cinq faits API ont été corrigés après recherche dans la doc officielle).

## Global Constraints

- **Gestionnaire de paquets : `bun` exclusivement.** Jamais `npm`, `npx`, `pnpm`, ni `node` pour installer ou exécuter des scripts. `node` sert uniquement à exécuter les bundles produits (c'est ainsi que Claude Code les lancera).
- **Suppression de fichiers : `trash <chemin>`.** Jamais `rm`, `rmdir` ni `unlink`.
- **`zod` reste en `^3.23.8`** (résolu 3.25.76). Ne pas monter en zod 4 : la compatibilité de `server.registerTool` avec un `z.object(...)` passé en `inputSchema` est prouvée sur cette version, pas sur la 4.
- **Versions résolues de référence** (vérifiées le 2026-07-30, bundle + handshake verts avec elles) : `@modelcontextprotocol/sdk` 1.30.0, `zod` 3.25.76, `@google/genai` 1.52.0.
- **`plugin/` doit rester autonome** : aucun chemin sortant de ce dossier, aucune référence à `servers/*/src`, aucune dépendance à `node_modules`. Tout chemin interne au plugin s'écrit `${CLAUDE_PLUGIN_ROOT}/...`.
- **Modèle par défaut : `gpt-image-2`.** Ne pas exposer `chatgpt-image-latest`, `gpt-image-1.5` ni `gpt-image-1-mini` : dépréciés le 2026-06-02, retirés de l'API le 2026-12-01.
- **Langues** : code, commentaires et descriptions d'outils MCP en anglais (cohérence avec `servers/nanobanana/src`) ; fichiers `SKILL.md` en français (ils s'adressent à Romain et à l'agent qui le sert).
- **Ne jamais committer de clé API.** `OPENAI_API_KEY` et `GEMINI_API_KEY` viennent de l'environnement.
- **Commits** : conventionnels, un par tâche, avec les trailers du repo :
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
  ```
- **Aucun push** (ni `erom-agence-image`, ni `erom-marketplace`) sans demande explicite de Romain.

## File Structure

**Créés :**

| Fichier | Responsabilité |
|---|---|
| `package.json` | Racine bun : dépendances, scripts `build`/`test`/`typecheck` |
| `tsconfig.json` | Typecheck seul (`noEmit`) ; le build est fait par bun |
| `scripts/mcp-handshake.sh` | Liste les tools d'un bundle MCP ; vérification réutilisée par les tâches 1, 4 et 5 |
| `servers/gpt-image/src/constants.ts` | Modèles, presets, énumérations, `validateSize` |
| `servers/gpt-image/src/constants.test.ts` | Tests de `validateSize` |
| `servers/gpt-image/src/services/openai.ts` | Client Images API : constructeurs de requêtes, appel, écriture disque, format d'erreur |
| `servers/gpt-image/src/services/openai.test.ts` | Tests de la forme réelle des requêtes, contre un serveur HTTP local |
| `servers/gpt-image/src/tools/generate.ts` | Outil MCP `gpt_image_generate` |
| `servers/gpt-image/src/tools/edit.ts` | Outil MCP `gpt_image_edit` |
| `servers/gpt-image/src/index.ts` | Bootstrap du serveur, transport stdio |
| `plugin/.claude-plugin/plugin.json` | Manifeste du plugin |
| `plugin/README.md` | Documentation d'installation et prérequis (clés API) |
| `plugin/servers/nanobanana/dist/index.js` | Bundle généré, committé |
| `plugin/servers/gpt-image/dist/index.js` | Bundle généré, committé |
| `README.md` | Présentation du repo public |

**Modifiés :**

| Fichier | Changement |
|---|---|
| `plugin/.mcp.json` | Chemins `${CLAUDE_PLUGIN_ROOT}` au lieu de chemins relatifs |
| `plugin/skills/gpt-image/SKILL.md` | Réécrit intégralement (aujourd'hui : 5 lignes de frontmatter vide) |
| `plugin/skills/nanobanana/SKILL.md` | Préfixes d'outils mis à jour |
| `../erom-marketplace/.claude-plugin/marketplace.json` | Nouvelle entrée `agence-image` + bump `metadata.version` |

---

### Task 1: Toolchain bun et bundle nanobanana

Fonde la chaîne de build et prouve, sur le serveur existant, que le packaging tient. Aucune ligne de gpt-image ici.

**Files:**
- Create: `package.json`, `tsconfig.json`, `scripts/mcp-handshake.sh`
- Generate: `plugin/servers/nanobanana/dist/index.js`

**Interfaces:**
- Consumes: rien (première tâche)
- Produces: les scripts `bun run build`, `bun run typecheck`, `bun test` ; le script `scripts/mcp-handshake.sh <bundle.js>` qui imprime une ligne `nom<TAB>[params]` par outil exposé.

- [ ] **Step 1: Écrire `package.json`**

```json
{
  "name": "erom-agence-image",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "bun run build:nanobanana && bun run build:gpt-image",
    "build:nanobanana": "bun build servers/nanobanana/src/index.ts --target=node --outfile=plugin/servers/nanobanana/dist/index.js",
    "build:gpt-image": "bun build servers/gpt-image/src/index.ts --target=node --outfile=plugin/servers/gpt-image/dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@google/genai": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.6.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bun": "^1.3.5",
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2"
  }
}
```

Note : `build` échouera tant que la tâche 4 n'a pas créé `servers/gpt-image/src/index.ts`. C'est attendu ; cette tâche n'utilise que `build:nanobanana`.

- [ ] **Step 2: Écrire `tsconfig.json`**

Ce tsconfig a été validé contre le code réel : `fetch`, `FormData`, `Blob` et `Request` typent sans `lib: ["DOM"]`, grâce à `types: ["node", "bun"]`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node", "bun"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["servers/**/*.ts"]
}
```

`module: NodeNext` impose les extensions `.js` dans les imports relatifs (`import { x } from "./constants.js"`), ce que fait déjà le code de nanobanana. Conserver cette convention dans gpt-image.

- [ ] **Step 3: Installer les dépendances**

Run: `bun install`
Expected: installation sans erreur, `node_modules/` créé, `bun.lock` généré.

- [ ] **Step 4: Vérifier le typecheck sur le code existant**

Run: `bun run typecheck`
Expected: exit 0, aucune sortie.

- [ ] **Step 5: Écrire `scripts/mcp-handshake.sh`**

Commentaires en anglais, comme tout le code du repo (contrainte globale).

```bash
#!/usr/bin/env bash
# List the tools exposed by a stdio MCP server, through a minimal JSON-RPC handshake.
# Usage: scripts/mcp-handshake.sh <path/to/bundle.js>
# Environment variables (API keys) are inherited from the caller.
set -euo pipefail

BUNDLE="${1:?usage: mcp-handshake.sh <bundle.js>}"

printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"handshake","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node "$BUNDLE" 2>/dev/null \
  | jq -r 'select(.id == 2) | .result.tools[] | "\(.name)\t[\(.inputSchema.properties | keys | join(", "))]"'
```

Run: `chmod +x scripts/mcp-handshake.sh`

- [ ] **Step 6: Construire le bundle nanobanana**

Run: `bun run build:nanobanana`
Expected: `plugin/servers/nanobanana/dist/index.js` créé, sortie du type `Bundled 338 modules`, taille ~1,9 Mo.

- [ ] **Step 7: Vérifier le handshake sur le bundle**

Run: `GEMINI_API_KEY=probe ./scripts/mcp-handshake.sh plugin/servers/nanobanana/dist/index.js`
Expected: exactement ces 4 lignes (ordre inclus) :

```
nanobanana_generate	[aspect_ratio, filename, model, output_dir, prompt, resolution, style]
nanobanana_edit	[aspect_ratio, filename, image_path, model, output_dir, prompt, resolution]
nanobanana_icon	[model, output_dir, prompt, sizes, style, type]
nanobanana_diagram	[aspect_ratio, complexity, filename, model, output_dir, prompt, resolution, style, type]
```

- [ ] **Step 8: Vérifier l'échec propre sans clé API**

Run: `env -u GEMINI_API_KEY -u GOOGLE_API_KEY node plugin/servers/nanobanana/dist/index.js < /dev/null; echo "exit: $?"`
Expected: message `ERROR: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required.` puis `exit: 1`.

- [ ] **Step 9: Ignorer `node_modules` et committer**

Vérifier que `.gitignore` contient déjà `node_modules/` (c'est le cas). Le bundle `plugin/servers/**/dist/*.js` **doit** être committé : c'est l'artefact distribué.

```bash
git add package.json bun.lock tsconfig.json scripts/mcp-handshake.sh plugin/servers/nanobanana/dist/index.js
git commit -m "$(cat <<'EOF'
build: chaîne bun (bundle single-file) et bundle nanobanana

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

---

### Task 2: Constantes gpt-image et validation des tailles

La seule logique pure du serveur : quelles valeurs sont acceptées, et quelles tailles custom sont géométriquement légales pour gpt-image-2.

**Files:**
- Create: `servers/gpt-image/src/constants.ts`
- Test: `servers/gpt-image/src/constants.test.ts`

**Interfaces:**
- Consumes: le toolchain de la tâche 1 (`bun test`, `bun run typecheck`)
- Produces:
  - `DEFAULT_MODEL: "gpt-image-2"`, `MODELS: readonly ["gpt-image-2", "gpt-image-2-2026-04-21"]`
  - `SIZE_PRESETS`, `QUALITIES`, `OUTPUT_FORMATS`, `BACKGROUNDS`, `MODERATIONS` (tuples `as const`)
  - `validateSize(size: string): string` — retourne la taille si valide, lève une `Error` au message explicite sinon

- [ ] **Step 1: Écrire le test qui échoue**

Fichier `servers/gpt-image/src/constants.test.ts` :

```ts
import { expect, test } from "bun:test";
import { DEFAULT_MODEL, MODELS, validateSize } from "./constants.js";

test("defaults to gpt-image-2 and excludes deprecated models", () => {
  expect(DEFAULT_MODEL).toBe("gpt-image-2");
  expect(MODELS).toContain("gpt-image-2");
  expect(MODELS).not.toContain("chatgpt-image-latest");
  expect(MODELS).not.toContain("gpt-image-1.5");
  expect(MODELS).not.toContain("gpt-image-1-mini");
});

test("accepts size presets", () => {
  for (const preset of ["auto", "1024x1024", "1536x1024", "1024x1536", "2048x2048"]) {
    expect(validateSize(preset)).toBe(preset);
  }
});

test("accepts valid custom sizes", () => {
  expect(validateSize("2560x1440")).toBe("2560x1440");
  expect(validateSize("3072x1024")).toBe("3072x1024"); // exactly 3:1
  expect(validateSize("3840x2160")).toBe("3840x2160"); // documented maximum, exactly 8,294,400 px
});

test("rejects edges that are not multiples of 16", () => {
  expect(() => validateSize("1000x1000")).toThrow("multiples of 16");
});

test("rejects edges beyond 3840", () => {
  expect(() => validateSize("4096x1600")).toThrow("must not exceed 3840px");
});

test("rejects aspect ratios beyond 3:1", () => {
  expect(() => validateSize("3072x512")).toThrow("aspect ratio");
});

test("rejects sizes outside the pixel bounds", () => {
  expect(() => validateSize("512x512")).toThrow("total pixels"); // 262 144 < 655 360
  expect(() => validateSize("3824x3824")).toThrow("total pixels"); // 14.6 Mpx > 8.29 Mpx
});

test("rejects invalid syntax", () => {
  expect(() => validateSize("1024*1024")).toThrow("Invalid size");
  expect(() => validateSize("big")).toThrow("Invalid size");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `bun test servers/gpt-image/src/constants.test.ts`
Expected: FAIL, `Cannot find module './constants.js'`.

- [ ] **Step 3: Écrire `constants.ts`**

Ce code a été exécuté et passe les 8 tests ci-dessus.

```ts
/**
 * gpt-image MCP Server — Constants
 * Models, size presets and geometric constraints of the OpenAI Images API.
 */

// ─── Models ──────────────────────────────────────────────────────────────────
// gpt-image-2 only: chatgpt-image-latest, gpt-image-1.5 and gpt-image-1-mini were
// deprecated on 2026-06-02 and are removed from the API on 2026-12-01.
export const DEFAULT_MODEL = "gpt-image-2";

export const MODELS = ["gpt-image-2", "gpt-image-2-2026-04-21"] as const;
export type Model = (typeof MODELS)[number];

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const SIZE_PRESETS = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
] as const;

// gpt-image-2 constraints: edges multiple of 16 and up to 3840, long:short ratio
// up to 3:1, total pixels between 655_360 and 8_294_400 (3840x2160 hits the cap).
const MAX_EDGE = 3840;
const EDGE_MULTIPLE = 16;
const MAX_RATIO = 3;
const MIN_PIXELS = 655_360;
const MAX_PIXELS = 8_294_400;

/** Returns the size unchanged when valid, throws with an actionable message otherwise. */
export function validateSize(size: string): string {
  if ((SIZE_PRESETS as readonly string[]).includes(size)) return size;

  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) {
    throw new Error(
      `Invalid size "${size}". Use a preset (${SIZE_PRESETS.join(", ")}) or custom "WIDTHxHEIGHT" (e.g. 2560x1440).`
    );
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width % EDGE_MULTIPLE !== 0 || height % EDGE_MULTIPLE !== 0) {
    throw new Error(`Invalid size "${size}": both edges must be multiples of ${EDGE_MULTIPLE}.`);
  }
  if (width > MAX_EDGE || height > MAX_EDGE) {
    throw new Error(`Invalid size "${size}": each edge must not exceed ${MAX_EDGE}px.`);
  }

  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > MAX_RATIO) {
    throw new Error(
      `Invalid size "${size}": aspect ratio must not exceed ${MAX_RATIO}:1 (got ${ratio.toFixed(2)}:1).`
    );
  }

  const pixels = width * height;
  if (pixels < MIN_PIXELS || pixels > MAX_PIXELS) {
    throw new Error(
      `Invalid size "${size}": total pixels must be between ${MIN_PIXELS} and ${MAX_PIXELS} (got ${pixels}).`
    );
  }

  return size;
}

// ─── Enums ───────────────────────────────────────────────────────────────────
export const QUALITIES = ["auto", "low", "medium", "high"] as const;
export const OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
// "transparent" is intentionally absent: the API documentation states that
// gpt-image-2 requests using background:"transparent" fail.
export const BACKGROUNDS = ["auto", "opaque"] as const;
export const MODERATIONS = ["auto", "low"] as const;

export type Quality = (typeof QUALITIES)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Moderation = (typeof MODERATIONS)[number];
```

- [ ] **Step 4: Lancer les tests et le typecheck**

Run: `bun test servers/gpt-image/src/constants.test.ts && bun run typecheck`
Expected: `8 pass, 0 fail`, puis typecheck exit 0.

- [ ] **Step 5: Committer**

```bash
git add servers/gpt-image/src/constants.ts servers/gpt-image/src/constants.test.ts
git commit -m "$(cat <<'EOF'
feat(gpt-image): constantes et validation des tailles gpt-image-2

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

---

### Task 3: Service OpenAI Images API

Le cœur du serveur : construire les requêtes exactes attendues par l'API, écrire l'image sur disque, traduire les erreurs. Testé contre un vrai serveur HTTP local, donc sans dépendre du réseau ni de la facturation OpenAI.

**Files:**
- Create: `servers/gpt-image/src/services/openai.ts`
- Test: `servers/gpt-image/src/services/openai.test.ts`

**Interfaces:**
- Consumes: rien de la tâche 2 (le service ne valide pas les tailles, c'est le rôle des outils)
- Produces:
  - `interface ImageOptions { model?: string; size?: string; quality?: string; outputFormat?: string; outputCompression?: number; background?: string; moderation?: string; outputDir?: string; filename?: string }`
  - `interface EditOptions extends ImageOptions { maskPath?: string }`
  - `interface ImageResult { filePath: string; usage?: Record<string, unknown> }`
  - `generateImage(prompt: string, options: ImageOptions): Promise<ImageResult>`
  - `editImage(imagePaths: string[], prompt: string, options: EditOptions): Promise<ImageResult>`
  - `buildGenerationBody`, `buildEditForm`, `saveImage`, `formatApiError`, `generateFilename`, `extensionFor`

**Conventions externes, sources :**
- Clé multipart `image[]` répétée pour les images d'entrée : exemple curl officiel verbatim (`developers.openai.com/api/docs/guides/image-generation`), qui l'emploie avec `model=gpt-image-2`, y compris pour une seule image accompagnée d'un `mask`.
- Réponse : `data[0].b64_json` uniquement. `url` et `revised_prompt` sont documentés comme réservés à dall-e-2/dall-e-3 et absents des réponses gpt-image.
- `usage` : `input_tokens`, `input_tokens_details {image_tokens, text_tokens}`, `output_tokens`, `total_tokens`.
- Erreur générique : `{error: {message, type, param, code}}` — échantillon réel capturé le 2026-07-30 sur l'API (`billing_hard_limit_reached`).
- Erreur de modération, propre aux endpoints images, **sans champ `message`** : `{error: {type, code, moderation_details: {moderation_stage, categories}}}` (doc `guides/image-generation`).

- [ ] **Step 1: Écrire le test qui échoue**

Fichier `servers/gpt-image/src/services/openai.test.ts` :

```ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const PNG_1X1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let captured: { url: string; auth: string | null; contentType: string | null; body: any } | null = null;
let nextStatus = 200;
let nextPayload: unknown = null;
let server: ReturnType<typeof Bun.serve>;
let tmpDir: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const contentType = req.headers.get("content-type");
      let body: any;
      if (contentType?.includes("application/json")) {
        body = await req.json();
      } else {
        const form = await req.formData();
        body = {
          fields: Object.fromEntries(
            [...new Set([...form.keys()])].map((k) => [
              k,
              form.getAll(k).map((v) => (v instanceof File ? { name: v.name, type: v.type } : v)),
            ])
          ),
        };
      }
      captured = { url: new URL(req.url).pathname, auth: req.headers.get("authorization"), contentType, body };
      return Response.json(nextPayload, { status: nextStatus });
    },
  });

  process.env.OPENAI_BASE_URL = `http://localhost:${server.port}/v1`;
  process.env.OPENAI_API_KEY = "sk-probe";
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gptimg-svc-"));
});

afterAll(() => server.stop(true));

// Real gpt-image response shape: b64_json only in data[], no url,
// no revised_prompt (dall-e-3 only), usage with 4 fields.
const okPayload = {
  created: 1_770_000_000,
  data: [{ b64_json: PNG_1X1_B64 }],
  usage: {
    input_tokens: 34,
    input_tokens_details: { image_tokens: 0, text_tokens: 34 },
    output_tokens: 1200,
    total_tokens: 1234,
  },
  background: "opaque",
  size: "1024x1024",
  quality: "low",
  output_format: "png",
};

function writeFixtureImage(name: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, Buffer.from(PNG_1X1_B64, "base64"));
  return p;
}

test("generateImage: POSTs JSON to /images/generations, omitting undefined fields", async () => {
  const { generateImage } = await import("./openai.js");
  nextStatus = 200;
  nextPayload = okPayload;

  const result = await generateImage("a red apple on white", {
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "low",
    outputDir: tmpDir,
    filename: "apple.png",
  });

  expect(captured!.url).toBe("/v1/images/generations");
  expect(captured!.auth).toBe("Bearer sk-probe");
  expect(captured!.contentType).toContain("application/json");
  expect(captured!.body).toEqual({
    model: "gpt-image-2",
    prompt: "a red apple on white",
    size: "1024x1024",
    quality: "low",
  });
  expect(captured!.body).not.toHaveProperty("background");
  expect(captured!.body).not.toHaveProperty("output_compression");

  expect(fs.existsSync(result.filePath)).toBe(true);
  expect(fs.readFileSync(result.filePath).length).toBe(70);
  expect(result.usage).toEqual(okPayload.usage);
});

test("editImage: multipart with repeated image[], mask and optional fields", async () => {
  const { editImage } = await import("./openai.js");
  nextStatus = 200;
  nextPayload = okPayload;

  const a = writeFixtureImage("a.png");
  const b = writeFixtureImage("b.png");
  const mask = writeFixtureImage("mask.png");

  await editImage([a, b], "put Image 1 subject into Image 2 scene", {
    model: "gpt-image-2",
    maskPath: mask,
    quality: "high",
    outputFormat: "webp",
    outputCompression: 80,
    outputDir: tmpDir,
    filename: "composed.webp",
  });

  expect(captured!.url).toBe("/v1/images/edits");
  expect(captured!.contentType).toContain("multipart/form-data");

  const f = captured!.body.fields;
  expect(f["image[]"].length).toBe(2);
  expect(f["image[]"].map((x: any) => x.name)).toEqual(["a.png", "b.png"]);
  expect(f["image[]"][0].type).toBe("image/png");
  expect(f.mask.length).toBe(1);
  expect(f.mask[0].name).toBe("mask.png");
  expect(f.model).toEqual(["gpt-image-2"]);
  expect(f.prompt).toEqual(["put Image 1 subject into Image 2 scene"]);
  expect(f.quality).toEqual(["high"]);
  expect(f.output_format).toEqual(["webp"]);
  expect(f.output_compression).toEqual(["80"]);
  expect(f).not.toHaveProperty("size");
});

test("API error: message and code are relayed", async () => {
  const { generateImage } = await import("./openai.js");
  nextStatus = 400;
  // Real response captured from the API on 2026-07-30.
  nextPayload = {
    error: {
      message: "Billing hard limit has been reached.",
      type: "billing_limit_user_error",
      param: null,
      code: "billing_hard_limit_reached",
    },
  };

  expect(
    generateImage("x", { model: "gpt-image-2", outputDir: tmpDir, filename: "nope.png" })
  ).rejects.toThrow("OpenAI API 400 (billing_hard_limit_reached): Billing hard limit has been reached.");
});

test("moderation error: no message field, moderation_details used instead", async () => {
  const { formatApiError } = await import("./openai.js");
  // Documented shape, specific to the image endpoints (no message field).
  const moderationError = {
    error: {
      type: "image_generation_user_error",
      code: "moderation_blocked",
      moderation_details: { moderation_stage: "input", categories: ["harassment"] },
    },
  };

  expect(formatApiError(400, moderationError, "Bad Request")).toBe(
    "OpenAI API 400 (moderation_blocked): blocked at input stage for: harassment"
  );
});

test("error without a JSON body: falls back to statusText", async () => {
  const { formatApiError } = await import("./openai.js");
  expect(formatApiError(502, null, "Bad Gateway")).toBe("OpenAI API 502: Bad Gateway");
});

test("response without an image: explicit error", async () => {
  const { generateImage } = await import("./openai.js");
  nextStatus = 200;
  nextPayload = { created: 1, data: [] };

  expect(
    generateImage("x", { model: "gpt-image-2", outputDir: tmpDir, filename: "nope.png" })
  ).rejects.toThrow("No image data in the API response");
});

test("missing input image: fails before any network call", async () => {
  const { editImage } = await import("./openai.js");
  expect(
    editImage([path.join(tmpDir, "ghost.png")], "x", { model: "gpt-image-2" })
  ).rejects.toThrow("Input image not found");
});

test("generateFilename: slug, extension and prefix", async () => {
  const { generateFilename, extensionFor } = await import("./openai.js");
  expect(generateFilename("A Red Apple, on White!", "jpeg")).toMatch(/^gptimage_a_red_apple_on_\d+\.jpg$/);
  expect(generateFilename("x", "png", "gptimage_edit")).toMatch(/^gptimage_edit_x_\d+\.png$/);
  expect(extensionFor("webp")).toBe("webp");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `bun test servers/gpt-image/src/services/openai.test.ts`
Expected: FAIL, `Cannot find module './openai.js'`.

- [ ] **Step 3: Écrire `services/openai.ts`**

Ce code a été exécuté et passe les 8 tests ci-dessus.

```ts
/**
 * gpt-image MCP Server — OpenAI Images API Service
 * Builds the exact requests the Images API expects, saves the returned image,
 * and translates API errors into actionable messages.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImageOptions {
  model?: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  outputCompression?: number;
  background?: string;
  moderation?: string;
  outputDir?: string;
  filename?: string;
}

export interface EditOptions extends ImageOptions {
  maskPath?: string;
}

export interface ImageResult {
  filePath: string;
  usage?: Record<string, unknown>;
}

// ─── Request builders ───────────────────────────────────────────────────────

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing API key. Set the OPENAI_API_KEY environment variable.");
  }
  return apiKey;
}

/** JSON body for /images/generations. Undefined options are omitted. */
export function buildGenerationBody(prompt: string, options: ImageOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    prompt,
  };
  if (options.size) body.size = options.size;
  if (options.quality) body.quality = options.quality;
  if (options.outputFormat) body.output_format = options.outputFormat;
  if (options.outputCompression !== undefined) body.output_compression = options.outputCompression;
  if (options.background) body.background = options.background;
  if (options.moderation) body.moderation = options.moderation;
  return body;
}

/**
 * FormData for /images/edits. Input images go under a repeated `image[]` key,
 * which the official curl examples use even for a single image.
 */
export function buildEditForm(imagePaths: string[], prompt: string, options: EditOptions): FormData {
  const form = new FormData();
  form.append("model", String(options.model));
  form.append("prompt", prompt);

  for (const imagePath of imagePaths) {
    const resolved = path.resolve(imagePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Input image not found: ${resolved}`);
    }
    const buffer = fs.readFileSync(resolved);
    form.append("image[]", new Blob([buffer], { type: getMimeType(resolved) }), path.basename(resolved));
  }

  if (options.maskPath) {
    const resolvedMask = path.resolve(options.maskPath);
    if (!fs.existsSync(resolvedMask)) {
      throw new Error(`Mask image not found: ${resolvedMask}`);
    }
    const maskBuffer = fs.readFileSync(resolvedMask);
    form.append("mask", new Blob([maskBuffer], { type: "image/png" }), path.basename(resolvedMask));
  }

  if (options.size) form.append("size", options.size);
  if (options.quality) form.append("quality", options.quality);
  if (options.outputFormat) form.append("output_format", options.outputFormat);
  if (options.outputCompression !== undefined) {
    form.append("output_compression", String(options.outputCompression));
  }
  if (options.background) form.append("background", options.background);

  return form;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Two documented error shapes: the generic one carries `message`, while the
 * moderation one has no `message` and carries `moderation_details` instead.
 */
export function formatApiError(
  status: number,
  json: Record<string, any> | null,
  statusText: string
): string {
  const error = json?.error;
  const code = error?.code ? ` (${error.code})` : "";

  let detail: string = error?.message ?? statusText;
  const moderation = error?.moderation_details;
  if (!error?.message && moderation) {
    const stage = moderation.moderation_stage ? `${moderation.moderation_stage} stage` : "moderation";
    const categories = Array.isArray(moderation.categories)
      ? moderation.categories.join(", ")
      : "unspecified";
    detail = `blocked at ${stage} for: ${categories}`;
  }

  return `OpenAI API ${status}${code}: ${detail}`;
}

async function request(endpoint: string, init: RequestInit): Promise<Record<string, any>> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: { Authorization: `Bearer ${getApiKey()}`, ...(init.headers ?? {}) },
  });

  const json = (await response.json().catch(() => null)) as Record<string, any> | null;

  if (!response.ok) {
    throw new Error(formatApiError(response.status, json, response.statusText));
  }
  if (!json) {
    throw new Error(`OpenAI API ${response.status}: unreadable response body.`);
  }
  return json;
}

// ─── Response handling ──────────────────────────────────────────────────────

/** GPT image models always return base64 data; `url` is a dall-e-only field. */
export function saveImage(
  json: Record<string, any>,
  outputDir: string,
  filename: string
): ImageResult {
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data in the API response (data[0].b64_json is missing).");
  }

  const dir = ensureDir(outputDir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

  return { filePath, usage: json.usage };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function generateImage(prompt: string, options: ImageOptions): Promise<ImageResult> {
  const json = await request("/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGenerationBody(prompt, options)),
  });
  return saveImage(
    json,
    options.outputDir || process.cwd(),
    options.filename || generateFilename(prompt, options.outputFormat)
  );
}

export async function editImage(
  imagePaths: string[],
  prompt: string,
  options: EditOptions
): Promise<ImageResult> {
  const form = buildEditForm(imagePaths, prompt, options);
  const json = await request("/images/edits", { method: "POST", body: form });
  return saveImage(
    json,
    options.outputDir || path.dirname(path.resolve(imagePaths[0]!)),
    options.filename || generateFilename(prompt, options.outputFormat, "gptimage_edit")
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function generateFilename(prompt: string, outputFormat = "png", prefix = "gptimage"): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");
  return `${prefix}_${slug}_${Date.now()}.${extensionFor(outputFormat)}`;
}

export function extensionFor(outputFormat: string): string {
  return outputFormat === "jpeg" ? "jpg" : outputFormat;
}

function ensureDir(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/png";
}
```

- [ ] **Step 4: Lancer les tests et le typecheck**

Run: `bun test servers/gpt-image/src/services/openai.test.ts && bun run typecheck`
Expected: `8 pass, 0 fail`, puis typecheck exit 0.

- [ ] **Step 5: Committer**

```bash
git add servers/gpt-image/src/services/openai.ts servers/gpt-image/src/services/openai.test.ts
git commit -m "$(cat <<'EOF'
feat(gpt-image): service OpenAI Images (generations, edits multi-images)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

---

### Task 4: Outils MCP et serveur gpt-image

Câblage MCP des deux outils et bootstrap du serveur. Le livrable est un bundle qui répond au handshake avec `gpt_image_generate` et `gpt_image_edit`.

**Files:**
- Create: `servers/gpt-image/src/tools/generate.ts`, `servers/gpt-image/src/tools/edit.ts`, `servers/gpt-image/src/index.ts`
- Generate: `plugin/servers/gpt-image/dist/index.js`

**Interfaces:**
- Consumes: `constants.ts` (tâche 2) et `services/openai.ts` (tâche 3), signatures exactes listées dans leurs blocs Interfaces
- Produces: `registerGenerateTool(server: McpServer): void`, `registerEditTool(server: McpServer): void`, et le bundle `plugin/servers/gpt-image/dist/index.js`

**Convention SDK :** `server.registerTool(name, {title, description, inputSchema, annotations}, handler)` avec `inputSchema` recevant un `z.object(...)`. Cette forme est celle du serveur nanobanana existant et son fonctionnement est prouvé par le handshake de la tâche 1 (les propriétés apparaissent correctement dans `tools/list`).

- [ ] **Step 1: Écrire `tools/generate.ts`**

```ts
/**
 * gpt-image MCP Tool — gpt_image_generate
 * Text-to-image generation via the OpenAI Images API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  BACKGROUNDS,
  DEFAULT_MODEL,
  MODELS,
  MODERATIONS,
  OUTPUT_FORMATS,
  QUALITIES,
  validateSize,
} from "../constants.js";
import { generateImage } from "../services/openai.js";

const GenerateInputSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Description of the image to generate"),
  output_dir: z.string().default("./").describe("Output directory for the generated image"),
  filename: z.string().optional().describe("Output filename (auto-generated if omitted)"),
  size: z
    .string()
    .default("auto")
    .describe(
      'Image size: auto, 1024x1024, 1536x1024, 1024x1536, 2048x2048, or a custom "WIDTHxHEIGHT" (edges multiple of 16, up to 3840, ratio up to 3:1)'
    ),
  quality: z.enum(QUALITIES).default("auto").describe("Rendering quality; use medium or high for dense text"),
  output_format: z.enum(OUTPUT_FORMATS).default("png").describe("Encoding of the saved file"),
  output_compression: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Compression level 0-100, for jpeg and webp only"),
  background: z.enum(BACKGROUNDS).optional().describe("Background handling; gpt-image-2 has no transparent mode"),
  moderation: z.enum(MODERATIONS).optional().describe("Moderation strictness"),
  model: z.enum(MODELS).default(DEFAULT_MODEL).describe("OpenAI image model"),
});

type GenerateInput = z.infer<typeof GenerateInputSchema>;

export function registerGenerateTool(server: McpServer): void {
  server.registerTool(
    "gpt_image_generate",
    {
      title: "GPT Image — Generate Image",
      description: `Generate an image from a text prompt using the OpenAI Images API (gpt-image-2).

Strengths over other image models: accurate text rendering inside the image, UI mockups,
posters and typographic layouts, and instruction following on precise constraints.

Sizes: auto, 1024x1024, 1536x1024, 1024x1536, 2048x2048, or custom "WIDTHxHEIGHT"
(edges multiple of 16 and up to 3840, ratio up to 3:1, 2560x1440 is the recommended
reliability ceiling).
Quality: low (drafts, cheapest), medium, high (dense text, small type), auto.
Note: gpt-image-2 does not support transparent backgrounds.

Prompting tips: order the prompt background/scene -> subject -> key details -> constraints.
Put exact copy in quotes and specify typography (font style, size, colour, placement).`,
      inputSchema: GenerateInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: GenerateInput) => {
      try {
        const size = validateSize(params.size);

        const result = await generateImage(params.prompt, {
          model: params.model,
          size,
          quality: params.quality,
          outputFormat: params.output_format,
          outputCompression: params.output_compression,
          background: params.background,
          moderation: params.moderation,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Image generated successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `📐 Size: ${size}`,
          `✨ Quality: ${params.quality}`,
          `🤖 Model: ${params.model}`,
        ];
        if (result.usage?.total_tokens) {
          lines.push(`🧮 Tokens: ${result.usage.total_tokens}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
```

- [ ] **Step 2: Écrire `tools/edit.ts`**

```ts
/**
 * gpt-image MCP Tool — gpt_image_edit
 * Image editing and multi-image composition via the OpenAI Images API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  BACKGROUNDS,
  DEFAULT_MODEL,
  MODELS,
  OUTPUT_FORMATS,
  QUALITIES,
  validateSize,
} from "../constants.js";
import { editImage } from "../services/openai.js";

const EditInputSchema = z.object({
  image_paths: z
    .array(z.string())
    .min(1, "At least one input image is required")
    .max(16, "At most 16 input images are supported")
    .describe("Paths to the input images; reference them as Image 1, Image 2... in the prompt"),
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Editing instructions"),
  mask_path: z
    .string()
    .optional()
    .describe("Optional PNG mask with an alpha channel, matching the first image dimensions"),
  output_dir: z.string().optional().describe("Output directory (defaults to the first image directory)"),
  filename: z.string().optional().describe("Output filename (auto-generated if omitted)"),
  size: z.string().default("auto").describe("Output size; same rules as gpt_image_generate"),
  quality: z.enum(QUALITIES).default("auto").describe("Rendering quality"),
  output_format: z.enum(OUTPUT_FORMATS).default("png").describe("Encoding of the saved file"),
  output_compression: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Compression level 0-100, for jpeg and webp only"),
  background: z.enum(BACKGROUNDS).optional().describe("Background handling; gpt-image-2 has no transparent mode"),
  model: z.enum(MODELS).default(DEFAULT_MODEL).describe("OpenAI image model"),
});

type EditInput = z.infer<typeof EditInputSchema>;

export function registerEditTool(server: McpServer): void {
  server.registerTool(
    "gpt_image_edit",
    {
      title: "GPT Image — Edit or Compose Images",
      description: `Edit an existing image, or compose several images into one, using the
OpenAI Images API (gpt-image-2). Accepts 1 to 16 input images.

Use it for: high-fidelity retouching that must preserve identity and geometry,
compositing subjects or styles across images, and inpainting through a mask.

Prompting tips: reference inputs by index ("apply Image 2's style to Image 1's subject").
State what must not change: "change only X, keep everything else the same", and repeat
the preservation list on every iteration to prevent drift. gpt-image-2 always processes
inputs at high fidelity.`,
      inputSchema: EditInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: EditInput) => {
      try {
        const size = validateSize(params.size);

        const result = await editImage(params.image_paths, params.prompt, {
          model: params.model,
          size,
          quality: params.quality,
          outputFormat: params.output_format,
          outputCompression: params.output_compression,
          background: params.background,
          maskPath: params.mask_path,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Image edited successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `🖼️ Inputs: ${params.image_paths.length}`,
          `📐 Size: ${size}`,
          `✨ Quality: ${params.quality}`,
          `🤖 Model: ${params.model}`,
        ];
        if (params.mask_path) {
          lines.push(`🎭 Mask: ${params.mask_path}`);
        }
        if (result.usage?.total_tokens) {
          lines.push(`🧮 Tokens: ${result.usage.total_tokens}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error editing image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
```

- [ ] **Step 3: Écrire `index.ts`**

```ts
#!/usr/bin/env node
/**
 * gpt-image MCP Server
 *
 * MCP server for image generation and editing via the OpenAI Images API.
 * Provides 2 tools: generate, edit.
 *
 * Transport: stdio
 * Model: gpt-image-2 by default
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerEditTool } from "./tools/edit.js";
import { registerGenerateTool } from "./tools/generate.js";

// ─── Server Initialization ──────────────────────────────────────────────────

const server = new McpServer({
  name: "gpt-image-mcp-server",
  version: "1.0.0",
});

// ─── Register Tools ─────────────────────────────────────────────────────────

registerGenerateTool(server);
registerEditTool(server);

// ─── Run Server ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is required.");
    console.error("Set it with: export OPENAI_API_KEY=<your key>");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🎨 GPT Image MCP Server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- [ ] **Step 4: Typecheck et build**

Run: `bun run typecheck && bun run build`
Expected: typecheck exit 0 ; deux bundles construits, dont `plugin/servers/gpt-image/dist/index.js`.

- [ ] **Step 5: Vérifier le handshake**

Run: `OPENAI_API_KEY=probe ./scripts/mcp-handshake.sh plugin/servers/gpt-image/dist/index.js`
Expected: exactement 2 lignes :

```
gpt_image_generate	[background, filename, model, moderation, output_compression, output_dir, output_format, prompt, quality, size]
gpt_image_edit	[background, filename, image_paths, mask_path, model, output_compression, output_dir, output_format, prompt, quality, size]
```

Si les propriétés diffèrent, corriger le schéma zod correspondant avant de continuer : c'est cette liste que l'agent appelant verra.

- [ ] **Step 6: Vérifier l'échec propre sans clé API**

Run: `env -u OPENAI_API_KEY node plugin/servers/gpt-image/dist/index.js < /dev/null; echo "exit: $?"`
Expected: `ERROR: OPENAI_API_KEY environment variable is required.` puis `exit: 1`.

- [ ] **Step 7: Lancer toute la suite de tests**

Run: `bun test`
Expected: `16 pass, 0 fail` (8 de constants, 8 du service).

- [ ] **Step 8: Committer**

```bash
git add servers/gpt-image/src/tools servers/gpt-image/src/index.ts plugin/servers/gpt-image/dist/index.js
git commit -m "$(cat <<'EOF'
feat(gpt-image): outils MCP generate et edit, serveur stdio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

---

### Task 5: Packaging du plugin

Rendre `plugin/` autonome et installable : manifeste, chemins portables, documentation.

**Files:**
- Create: `plugin/.claude-plugin/plugin.json`, `plugin/README.md`, `README.md`
- Modify: `plugin/.mcp.json`

**Interfaces:**
- Consumes: les deux bundles produits par les tâches 1 et 4
- Produces: un dossier `plugin/` installable, dont le nom de plugin `agence-image` fixe le préfixe des outils : `mcp__plugin_agence-image_nanobanana__*` et `mcp__plugin_agence-image_gpt-image__*`

**Convention externe :** `${CLAUDE_PLUGIN_ROOT}` dans les `args` d'un `.mcp.json` est la forme utilisée par le plugin officiel `telegram` (`~/.claude/plugins/cache/claude-plugins-official/telegram/0.0.6/.mcp.json`), échantillon réel d'un plugin installé et fonctionnel.

- [ ] **Step 1: Écrire `plugin/.claude-plugin/plugin.json`**

```json
{
  "$schema": "https://www.schemastore.org/claude-code-plugin-manifest.json",
  "name": "agence-image",
  "description": "Génération et édition d'images : nanobanana (Gemini) pour images, icônes et diagrammes ; gpt-image (OpenAI gpt-image-2) pour texte exact, compositions multi-images et éditions haute fidélité.",
  "version": "0.1.0",
  "author": {
    "name": "Romain Ecarnot",
    "url": "https://github.com/eRom"
  },
  "repository": "https://github.com/eRom/erom-agence-image",
  "license": "MIT",
  "keywords": [
    "images",
    "image-generation",
    "mcp",
    "gemini",
    "nanobanana",
    "openai",
    "gpt-image"
  ],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

- [ ] **Step 2: Remplacer `plugin/.mcp.json`**

Le contenu actuel utilise des chemins relatifs (`./servers/...`), qui ne résolvent pas depuis le cache d'installation.

```json
{
  "mcpServers": {
    "nanobanana": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/nanobanana/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    },
    "gpt-image": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/gpt-image/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

- [ ] **Step 3: Vérifier qu'aucun chemin ne sort de `plugin/`**

Run: `grep -rn '\.\./\|servers/.*/src\|node_modules' plugin/ --include='*.json' --include='*.md' || echo 'OK: aucun chemin sortant'`
Expected: `OK: aucun chemin sortant`.

- [ ] **Step 4: Écrire `plugin/README.md`**

```markdown
# agence-image

Deux serveurs MCP de génération d'images, et les skills qui les pilotent.

| Serveur | Modèle | Points forts |
|---|---|---|
| `nanobanana` | Gemini (nano-banana-2 / pro) | images, icônes multi-tailles, diagrammes techniques, itération rapide |
| `gpt-image` | OpenAI `gpt-image-2` | texte exact dans l'image, maquettes UI, composition multi-images, édition haute fidélité |

## Prérequis

- `node` ≥ 18 (les serveurs sont distribués sous forme de bundles autonomes)
- `GEMINI_API_KEY` dans l'environnement, pour le serveur nanobanana
- `OPENAI_API_KEY` dans l'environnement, pour le serveur gpt-image

Chaque serveur démarre indépendamment : une seule des deux clés suffit pour utiliser le serveur correspondant.

## Installation

```bash
/plugin marketplace add eRom/erom-marketplace
/plugin install agence-image@erom-marketplace
```

## Outils exposés

- `gpt_image_generate`, `gpt_image_edit`
- `nanobanana_generate`, `nanobanana_edit`, `nanobanana_icon`, `nanobanana_diagram`

Les skills `gpt-image` et `nanobanana` décrivent quand utiliser lequel, et comment rédiger les prompts.

## Coûts

Les deux serveurs appellent des API payantes, facturées sur les clés fournies. Ordres de grandeur
pour `gpt-image-2` en 1024×1024 : `quality: low` ≈ $0,006, `medium` ≈ $0,05, `high` ≈ $0,21.
```

- [ ] **Step 5: Écrire `README.md` à la racine du repo**

```markdown
# erom-agence-image

Repo de développement du plugin Claude Code **agence-image** : deux serveurs MCP de génération
d'images (nanobanana/Gemini, gpt-image/OpenAI) et leurs skills.

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
```

- [ ] **Step 6: Vérifier ce que `git-subdir` livrerait réellement**

L'installation par la marketplace clone le dépôt et n'en extrait que le sous-dossier `plugin/`. Ce test reproduit cette extraction sans passer par le client, à partir du dernier commit de la branche : il faut donc avoir committé l'étape 7 avant, ou relancer ce test après.

```bash
DEST=/tmp/agence-image-subdir && mkdir -p "$DEST"
git archive --format=tar HEAD:plugin | tar -x -C "$DEST"
find "$DEST" -type f | sed "s|$DEST/||" | sort
```

Expected: exactement cette liste, ni plus ni moins.

```
.claude-plugin/plugin.json
.mcp.json
README.md
servers/gpt-image/dist/index.js
servers/nanobanana/dist/index.js
skills/gpt-image/SKILL.md
skills/nanobanana/SKILL.md
```

Aucun `docs/`, aucun `servers/*/src`, aucun `node_modules`, aucun `package.json`. Vérifier ensuite que les bundles extraits fonctionnent hors du dépôt :

```bash
OPENAI_API_KEY=probe /Users/recarnot/dev/erom-agence-image/scripts/mcp-handshake.sh "$DEST/servers/gpt-image/dist/index.js"
GEMINI_API_KEY=probe /Users/recarnot/dev/erom-agence-image/scripts/mcp-handshake.sh "$DEST/servers/nanobanana/dist/index.js"
```

Expected: 2 outils puis 4 outils, comme dans le dépôt.

- [ ] **Step 7: Charger le plugin dans un vrai Claude Code, en headless**

C'est le test qui exerce le manifeste, la découverte des skills et la résolution de `${CLAUDE_PLUGIN_ROOT}` par le vrai chargeur de plugins.

```bash
cd /tmp && claude --plugin-dir /Users/recarnot/dev/erom-agence-image/plugin --debug -p "Réponds uniquement: OK" 2>&1 | tee /tmp/agence-image-load.log | tail -5
```

Expected: la sortie se termine par `OK`, sans erreur de chargement de plugin. Puis, dans le journal :

```bash
grep -ciE 'nanobanana|gpt-image' /tmp/agence-image-load.log
grep -iE 'error|failed|cannot find|ENOENT' /tmp/agence-image-load.log | grep -iE 'plugin|mcp|nanobanana|gpt-image' || echo "aucune erreur de plugin"
```

Expected: le premier compte est non nul (les deux serveurs sont vus par le chargeur), le second n'affiche aucune erreur liée au plugin.

Si le chargement échoue pour une raison d'environnement (quota, réseau), ne pas maquiller : reporter l'échec tel quel et laisser l'étape non validée.

Nettoyage : `trash /tmp/agence-image-subdir /tmp/agence-image-load.log`.

- [ ] **Step 8: Committer**

Committer **avant** de rejouer l'étape 6 si elle a été lancée sur un état non committé : `git archive HEAD:plugin` ne voit que ce qui est dans l'historique.

```bash
git add plugin/.claude-plugin/plugin.json plugin/.mcp.json plugin/README.md README.md
git commit -m "$(cat <<'EOF'
feat(plugin): manifeste agence-image, chemins portables, documentation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

---

### Task 6: Skills

Ce que l'agent lit pour décider quel serveur appeler et comment rédiger le prompt. C'est la couche qui fait la différence entre deux MCP bruts et un outil utilisable.

**Files:**
- Modify: `plugin/skills/gpt-image/SKILL.md` (réécriture intégrale), `plugin/skills/nanobanana/SKILL.md` (préfixes d'outils)

**Interfaces:**
- Consumes: les noms d'outils et paramètres figés par les tâches 4 et 5
- Produces: rien pour les tâches suivantes

- [ ] **Step 1: Réécrire `plugin/skills/gpt-image/SKILL.md`**

Rédiger en français, en miroir structurel de la skill nanobanana existante (la lire d'abord : `plugin/skills/nanobanana/SKILL.md`). Le frontmatter :

```markdown
---
name: gpt-image
description: "Génération et édition d'images via GPT Image MCP (OpenAI gpt-image-2) : texte exact dans l'image, maquettes UI, affiches, composition multi-images, retouche haute fidélité. Triggers: image avec du texte, affiche, poster, maquette, mockup, bannière typographiée, composer plusieurs images, retoucher en préservant."
user-invocable: true
---
```

Sections obligatoires, dans cet ordre :

1. **Comportement général** — délégation obligatoire via sous-agent, en miroir exact de la skill nanobanana : ne jamais appeler `mcp__plugin_agence-image_gpt-image__*` directement dans le contexte principal, toujours passer par le Task tool avec `subagent_type: "general-purpose"`, le sous-agent charge le tool via `ToolSearch` et ne retourne que le chemin du fichier produit.

2. **Routage gpt-image vs nanobanana** — tableau à deux colonnes :
   - gpt-image : texte exact à rendre dans l'image, maquettes d'interface, affiches et typographie, composition de plusieurs images sources, retouche devant préserver identité et géométrie, photo produit.
   - nanobanana : icônes multi-tailles, diagrammes techniques, itération rapide et bon marché, ratios exotiques (21:9, 8:1), sorties 4K.

3. **Défauts intelligents** — `gpt-image-2`, `size: auto`, `quality: auto` ; `quality: low` pour brouillons et volume ; `quality: medium` ou `high` dès qu'il y a du texte dense ou de petits caractères ; répertoire de travail courant comme `output_dir` par défaut.

4. **Les deux outils** — une table de paramètres par outil, reprenant exactement les schémas de la tâche 4 (noms, types, défauts). Ne pas inventer de paramètre : `input_fidelity`, `n`, `stream` et `background: transparent` n'existent pas dans cette surface.

5. **Tailles** — presets et règles des tailles custom (bords multiples de 16, jusqu'à 3840, ratio jusqu'à 3:1, 2560x1440 comme plafond de fiabilité conseillé), avec les correspondances d'usage (bannière, portrait, paysage).

6. **Doctrine de prompting** (condensé du cookbook OpenAI, c'est la valeur de cette skill) :
   - Structure : arrière-plan/scène → sujet → détails clés → contraintes.
   - Texte exact : entre guillemets ou en CAPITALES, avec la typographie précisée (style, taille, couleur, emplacement) ; épeler les mots rares ; garder le texte court.
   - Photoréalisme : dire « photorealistic » explicitement, employer un vocabulaire photographique (objectif, direction de lumière, cadrage) plutôt que des spécifications techniques d'appareil, ajouter des textures (pores, usure, grain) pour éviter le rendu lisse et stérile.
   - Illustration : nommer le médium d'emblée (aquarelle, vectoriel, rendu 3D) et décrire matières et textures.
   - Édition : « change only X, keep everything else the same », répéter la liste de préservation (identité, géométrie, cadrage, lumière, arrière-plan) à chaque itération pour éviter la dérive.
   - Composition : référencer les entrées par index (« Image 1 : la photo produit… », « applique le style de Image 2 au sujet de Image 1 »).
   - Itération : une seule modification à la fois plutôt qu'une réécriture complète.
   - Pièges : prompts surchargés d'emblée, absence de contraintes explicites sur ce qui ne doit pas changer, styles vagues.

7. **Exemples** — au moins quatre appels typiques (affiche avec texte exact, maquette UI, composition de deux images, retouche préservant l'identité).

8. **Coûts et limitations** — ordres de grandeur `gpt-image-2` en 1024×1024 (low ≈ $0,006, medium ≈ $0,05, high ≈ $0,21) ; pas de fond transparent ; latence en `quality: high` (documenter `MCP_TOOL_TIMEOUT=120000`) ; vérification d'organisation OpenAI possible au premier usage ; plafond de facturation OpenAI à surveiller (message `billing_hard_limit_reached`).

- [ ] **Step 2: Mettre à jour les préfixes d'outils dans la skill nanobanana**

Le seul changement : les références `mcp__nanobanana__*` deviennent `mcp__plugin_agence-image_nanobanana__*`.

Run: `grep -n 'mcp__nanobanana' plugin/skills/nanobanana/SKILL.md`
Puis remplacer chaque occurrence. Ne rien modifier d'autre dans ce fichier.

Run: `grep -c 'mcp__plugin_agence-image_nanobanana' plugin/skills/nanobanana/SKILL.md`
Expected: le même nombre d'occurrences que celui trouvé avant remplacement, et `grep -c 'mcp__nanobanana__' plugin/skills/nanobanana/SKILL.md` renvoie 0.

- [ ] **Step 3: Vérifier le frontmatter des deux skills**

Run: `head -6 plugin/skills/gpt-image/SKILL.md plugin/skills/nanobanana/SKILL.md`
Expected: chaque fichier commence par `---`, avec `name:` et `description:` non vides.

- [ ] **Step 4: Contrôler la skill gpt-image contre ses exigences**

Cette skill est la valeur différenciante du plugin : deux MCP bruts sans elle ne valent pas grand-chose. Le contrôle est mécanique, pas subjectif.

```bash
S=plugin/skills/gpt-image/SKILL.md
echo "--- densité (la skill nanobanana fait 228 lignes) ---"
wc -l "$S"
echo "--- sections obligatoires ---"
for pattern in "Comportement général" "Routage" "Défauts" "gpt_image_generate" "gpt_image_edit" "Tailles" "prompting" "Exemples" "Coûts" "Limitations"; do
  grep -qi -- "$pattern" "$S" && echo "  ok   $pattern" || echo "  MANQUE $pattern"
done
echo "--- format tabulaire (comme la skill nanobanana) ---"
grep -c '^|' "$S"
echo "--- aucun paramètre inventé ---"
grep -n 'input_fidelity\|"transparent"\|partial_images\|response_format' "$S" || echo "  ok   aucun paramètre hors surface"
echo "--- préfixes d'outils corrects ---"
grep -c 'mcp__plugin_agence-image_gpt-image__' "$S"
```

Expected: aucune ligne `MANQUE`, au moins 20 lignes de tableau, aucun paramètre hors surface (la seule mention tolérée de `transparent` est une phrase disant qu'il n'est pas supporté, sans guillemets de valeur), et au moins une occurrence du préfixe d'outil complet.

- [ ] **Step 5: Committer**

```bash
git add plugin/skills
git commit -m "$(cat <<'EOF'
docs(skills): skill gpt-image complète, préfixes d'outils nanobanana

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

---

### Task 7: Enregistrement dans erom-marketplace

Dernière étape versionnée, dans l'autre repo. Aucun push : Romain décide.

**Files:**
- Modify: `/Users/recarnot/dev/erom-marketplace/.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: le plugin `agence-image` v0.1.0 des tâches 1 à 6
- Produces: rien

- [ ] **Step 1: Ajouter l'entrée du plugin**

Insérer cet objet à la fin du tableau `plugins` de `.claude-plugin/marketplace.json` :

```json
{
  "name": "agence-image",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/eRom/erom-agence-image.git",
    "path": "plugin",
    "ref": "main"
  },
  "description": "Génération et édition d'images par MCP : nanobanana (Gemini) pour images, icônes et diagrammes ; gpt-image (OpenAI gpt-image-2) pour texte exact dans l'image, compositions multi-images et éditions haute fidélité. Skills de routage et de prompting incluses.",
  "version": "0.1.0",
  "strict": true
}
```

- [ ] **Step 2: Bumper la version de la marketplace**

Passer `metadata.version` de `0.7.1` à `0.8.0`.

Ne pas toucher à `.agents/plugins/marketplace.json` : ce fichier Codex ne liste que `caserne`, c'est le motif existant du repo.

- [ ] **Step 3: Rejouer les validations de la CI en local**

Ce sont les mêmes assertions que `.github/workflows/validate.yml`.

```bash
cd /Users/recarnot/dev/erom-marketplace
python3 -c "import json, sys; data = json.load(open('.claude-plugin/marketplace.json')); \
  assert 'name' in data and 'owner' in data; \
  assert isinstance(data.get('plugins'), list); \
  [ (p.get('name') and p.get('source')) or sys.exit(f'plugin invalide: {p}') for p in data['plugins'] ]; \
  names = [p['name'] for p in data['plugins']]; \
  assert len(names) == len(set(names)), 'noms dupliqués'; \
  print(f'OK — {len(names)} plugins, version {data[\"metadata\"][\"version\"]}')"
```

Expected: `OK — 4 plugins, version 0.8.0`.

- [ ] **Step 4: Committer dans le repo marketplace**

```bash
cd /Users/recarnot/dev/erom-marketplace
git add .claude-plugin/marketplace.json
git commit -m "$(cat <<'EOF'
chore(marketplace): agence-image 0.1.0, metadata 0.8.0

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Mywr26KwR4frD3jmtL8Rd7
EOF
)"
```

- [ ] **Step 5: S'arrêter avant les pushs**

Ne pas pousser. Rendre compte à Romain de ce qui reste à sa main :

1. `git push` du repo `erom-agence-image` (public) puis de `erom-marketplace`.
2. Relever le plafond de facturation OpenAI, pour débloquer la tâche 8.
3. Retirer l'entrée globale `nanobanana` de `~/.claude.json` (elle pointe vers `/Users/recarnot/dev/claude-nanobanana-mcp/dist/index.js`), sinon les outils nanobanana existeront en double une fois le plugin installé.

---

### Task 8: Smoke test réel — bloqué côté OpenAI

Vérification finale contre les vraies API. **Prérequis non satisfait au moment de l'écriture du plan :** la clé `OPENAI_API_KEY` locale renvoie `billing_hard_limit_reached` sur tout appel image (constaté le 2026-07-30 sur `/v1/images/generations` et `/v1/images/edits`). La partie nanobanana est exécutable immédiatement ; la partie gpt-image attend que Romain relève le plafond.

**Files:** aucun fichier modifié ; tâche de vérification pure.

**Interfaces:**
- Consumes: les deux bundles et la configuration du plugin

- [ ] **Step 1: Smoke nanobanana (exécutable maintenant)**

```bash
mkdir -p /tmp/agence-image-smoke
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nanobanana_generate","arguments":{"prompt":"a single red apple on a white background","resolution":"512px","output_dir":"/tmp/agence-image-smoke","filename":"smoke_nb.png"}}}' \
  | node plugin/servers/nanobanana/dist/index.js 2>/dev/null | tail -1
```

Expected: une réponse contenant `Image generated successfully` et le chemin `/tmp/agence-image-smoke/smoke_nb.png`.

Run: `file /tmp/agence-image-smoke/smoke_nb.png`
Expected: `PNG image data`.

- [ ] **Step 2: Vérifier que le plafond OpenAI est levé**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2","prompt":"a single red apple on a white background","size":"1024x1024","quality":"low"}'
```

Expected: `200`. Si `400` avec `billing_hard_limit_reached`, s'arrêter ici et le signaler : les étapes 3 à 5 restent non exécutées, et il faut le dire explicitement plutôt que de les cocher.

- [ ] **Step 3: Smoke `gpt_image_generate`**

```bash
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"gpt_image_generate","arguments":{"prompt":"a poster with the exact headline \"HELLO WORLD\" in bold black sans-serif on a cream background","size":"1024x1024","quality":"low","output_dir":"/tmp/agence-image-smoke","filename":"smoke_gpt.png"}}}' \
  | node plugin/servers/gpt-image/dist/index.js 2>/dev/null | tail -1
```

Expected: `Image generated successfully`, fichier PNG valide dans `/tmp/agence-image-smoke/`.

- [ ] **Step 4: Smoke `gpt_image_edit` sur l'image produite**

```bash
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"gpt_image_edit","arguments":{"image_paths":["/tmp/agence-image-smoke/smoke_gpt.png"],"prompt":"change only the background colour to pale blue, keep everything else the same","quality":"low","output_dir":"/tmp/agence-image-smoke","filename":"smoke_gpt_edit.png"}}}' \
  | node plugin/servers/gpt-image/dist/index.js 2>/dev/null | tail -1
```

Expected: `Image edited successfully`, fichier PNG valide. Cette étape confirme empiriquement la clé multipart `image[]` sur un appel réel.

- [ ] **Step 5: Confirmer les deux comportements incertains**

La doc est ambiguë sur ces points ; seul un appel réel tranche.

```bash
# background transparent : la doc annonce un échec sur gpt-image-2
curl -s https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2","prompt":"a red apple","size":"1024x1024","quality":"low","background":"transparent"}' \
  | jq -c '.error // {ok: true}'

# taille custom aux bornes : 3840x2160 doit passer
curl -s -o /dev/null -w 'custom size 3840x2160 -> %{http_code}\n' https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2","prompt":"a red apple","size":"3840x2160","quality":"low"}'
```

Reporter les résultats réels dans la section 9 du spec. Si `3840x2160` est refusé, corriger `MAX_EDGE`/`MAX_PIXELS` dans `constants.ts`, ajuster le test correspondant, rebuilder et recommitter.

Nettoyage : `trash /tmp/agence-image-smoke`.

---

## Notes de vérification déjà effectuée

Ces points ont été probés pendant l'écriture du plan, l'implémenteur n'a pas à les redécouvrir :

| Point | Résultat |
|---|---|
| `bun build --target=node` sur le serveur nanobanana | 338 modules inlinés, bundle 1,9 Mo, 58 ms |
| Bundle exécuté hors de tout `node_modules` | handshake MCP OK, 4 outils listés avec leurs schémas |
| Boot sans clé API | message d'erreur clair, exit 1 |
| tsconfig avec `types: ["node","bun"]`, sans `lib: DOM` | `tsc --noEmit` vert sur le code réel, `fetch`/`FormData`/`Blob` typés |
| `FormData` avec clé `image[]` répétée | 2 entrées distinctes, multipart avec boundary, `filename` correct |
| Round-trip `b64_json` → fichier | PNG valide, signature correcte |
| Assertions `expect(...).rejects.toThrow()` | échouent bien quand elles doivent (vérifié par tests-sondes négatifs) |
| Modèles image réellement exposés par la clé | `gpt-image-2`, `gpt-image-2-2026-04-21`, `gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`, `chatgpt-image-latest` |
| Appels images sur la clé locale | `400 billing_hard_limit_reached` — bloque la tâche 8 |
| **Code des tâches 2, 3 et 4 extrait verbatim de ce plan et exécuté** | `bun test` : **16 pass, 0 fail** ; `tsc --noEmit` : exit 0 ; `bun build` : 0,67 Mo ; handshake : les deux outils avec exactement les propriétés annoncées à l'étape 5 de la tâche 4 |

Autrement dit : les blocs de code des tâches 2 à 4 ne sont pas du code de plan non testé. Ils ont été assemblés dans un projet jetable, typés, buildés, et leur suite de tests passe. Ce qui reste non exécuté, et donc à la charge de l'implémenteur : la prose des skills (tâche 6), l'installation E2E (tâche 5, étape 6) et tout ce qui touche l'API OpenAI réelle (tâche 8).
