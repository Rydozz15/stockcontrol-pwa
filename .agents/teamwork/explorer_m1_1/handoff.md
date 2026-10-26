# Handoff Report: Milestone 1 — SvelteKit Scaffold & Build Tooling

**Agent**: `explorer_m1_1` (Scaffold & Tooling Explorer)  
**Working Directory**: `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/.agents/teamwork/explorer_m1_1`  
**Date**: 2026-10-25T20:34:00Z  

---

## 1. Observation

### 1.1 Environment Toolchain
Direct command execution:
```bash
node -v && npm -v
```
Results:
- Node.js: `v24.11.1`
- npm: `11.6.2`

### 1.2 Package Resolution & Critical Engine Constraints
1. **Firebase Package Resolution**:
   - Running `npm install firebase` (defaulting to latest `13.1.0`) triggers an engine rejection:
     ```text
     npm error code EBADENGINE
     npm error engine Unsupported engine
     npm error engine Not compatible with your version of node/npm: @firebase/ai@3.0.0
     npm error notsup Not compatible with your version of node/npm: @firebase/ai@3.0.0
     npm error notsup Required: {"node":">=24.12.0"}
     npm error notsup Actual:   {"npm":"11.6.2","node":"v24.11.1"}
     ```
   - Inspection of `firebase@11.4.0` via `npm info firebase@11.4.0 dependencies` confirmed that `firebase@^11.4.0` depends only on `@firebase/firestore@4.7.9`, `@firebase/auth@1.9.1`, `@firebase/app@0.11.2`, and does **not** pull `@firebase/ai@3.0.0`. Installation of `firebase@^11.4.0` succeeded with exit code 0.

2. **SvelteKit 3 vs SvelteKit 2 and `svelte.config.js`**:
   - Latest official Svelte CLI (`npx sv@1.1.1 create`) configures `@sveltejs/kit@^3.0.0`, `svelte@^5.57.1`, `@sveltejs/vite-plugin-svelte@^7.2.0`, `vite@^8.3.0`, and `typescript@^6.0.3`.
   - Inspection of `@sveltejs/kit/src/exports/vite/index.js` (lines 164 & 277-281) revealed:
     ```javascript
     // Line 164:
     // Prior to SvelteKit 3, config lived in a `svelte.config.js` file, which is no longer supported.
     // The ability to configure SvelteKit via `vite.config.js` was added in version 2.62.
     for (const file of ['svelte.config.js', 'svelte.config.ts']) {
         if (fs.existsSync(path.join(root, file))) {
             e.config_file_unsupported({ file });
         }
     }
     ```
   - Testing an empty `svelte.config.js` with `@sveltejs/kit@^3.0.0` caused build failure with verbatim error:
     ```text
     error during build:
     SvelteKit error: config_file_unsupported
     `svelte.config.js` is no longer used. Please pass configuration via the `sveltekit(...)` plugin in your Vite config.
     https://svelte.dev/e/kit/config_file_unsupported
     ```
   - Moving `@sveltejs/adapter-static` into `vite.config.ts`:
     ```typescript
     import adapter from '@sveltejs/adapter-static';
     import { sveltekit } from '@sveltejs/kit/vite';
     import { defineConfig } from 'vite';

     export default defineConfig({
         plugins: [
             sveltekit({
                 adapter: adapter({
                     pages: 'build',
                     assets: 'build',
                     fallback: 'index.html',
                     precompress: false,
                     strict: true
                 })
             })
         ],
         envPrefix: ['VITE_', 'PUBLIC_']
     });
     ```
     Result: `npm run build` completed in ~230ms and generated `build/index.html`.

3. **Icon Library**:
   - Running `npm install lucide-svelte` output:
     ```text
     npm warn deprecated lucide-svelte@1.0.1: Package deprecated. Please use @lucide/svelte instead.
     ```
   - Inspection of `@lucide/svelte` verified version `1.61.0` with peer dependency `svelte: "^5"`.

4. **Barcode / QR Scanner**:
   - `html5-qrcode` version `2.3.8` installed and verified without peer conflicts.

5. **Client Environment Variables (`PUBLIC_FIREBASE_*`)**:
   - In SvelteKit 3, environment variable exports for client modules derive from `src/env.ts` using `defineEnvVars({ ... })` from `@sveltejs/kit/env`.
   - Adding `envPrefix: ['VITE_', 'PUBLIC_']` in `vite.config.ts` ensures `import.meta.env.PUBLIC_*` is also natively available everywhere without ceremony.

6. **Static Assets Inspection**:
   - Existing repository assets in `/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/assets/`:
     - `logo-stockcontrol.png` (840,904 bytes, 1521x1521 PNG)
     - `icon-192.png` (30,175 bytes, 192x192 PNG)
     - `icon-512.png` (142,922 bytes, 512x512 PNG)
   - When copied to `static/assets/`, `@sveltejs/adapter-static` copies all files directly into `build/assets/`.
   - PWA manifest (`manifest.json`) in `static/` copies to `build/manifest.json`.

---

## 2. Logic Chain

1. **Host Environment (From Obs 1.1)**:
   The host has Node.js `v24.11.1`. Any package requiring Node `>= 24.12.0` (such as `@firebase/ai@3.0.0` in `firebase@12.x/13.x`) will abort installation with `EBADENGINE`.
2. **Firebase Pinned Version (From Obs 1.2 & PROJECT.md Line 222)**:
   PROJECT.md specifically requests `firebase (^11.x)`. Pinning `firebase` to `^11.4.0` satisfies both the architecture requirement and eliminates the `@firebase/ai` engine incompatibility.
3. **SvelteKit Tooling Configuration (From Obs 1.2)**:
   In modern SvelteKit 3, `svelte.config.js` is deprecated and actively rejected by the build plugin. Centralizing adapter configuration (`@sveltejs/adapter-static@4.0.0`) inside `sveltekit({ adapter: adapter(...) })` in `vite.config.ts` is required for builds to pass. If an implementer creates `svelte.config.js`, the build will fail immediately.
4. **SPA Mode Configuration (From Obs 1.2 & PROJECT.md Line 165)**:
   In `src/routes/+layout.ts`, setting `export const prerender = true;` and `export const ssr = false;` instructs SvelteKit to crawl the static shell and output client-side JS bundles. With `fallback: 'index.html'`, any SPA route requested by client browsers is handled by `build/index.html`.
5. **Static Asset Layout (From Obs 1.6 & PROJECT.md Lines 154-160)**:
   Files placed in `static/` are served from root URL `/`.
   Therefore:
   - `static/assets/logo-stockcontrol.png` -> `/assets/logo-stockcontrol.png`
   - `static/assets/icon-192.png` -> `/assets/icon-192.png`
   - `static/assets/icon-512.png` -> `/assets/icon-512.png`
   - `static/favicon.png` -> `/favicon.png`
   - `static/manifest.json` -> `/manifest.json`
6. **Zero-Cost Deployment (From ORIGINAL_REQUEST § R4 & PROJECT.md Line 148)**:
   Render Static Site deploys from the output directory `build` via build command `npm install && npm run build`. By declaring `render.yaml` with a static service and rewrite rule `source: /*` -> `destination: /index.html`, all client routes resolve to `index.html` at $0/month cost.

---

## 3. Caveats

1. **`svelte.config.js` in SvelteKit 3 vs SvelteKit 2**:
   While `PROJECT.md` shows `svelte.config.js` in the layout tree, SvelteKit 3 explicitly prohibits `svelte.config.js` with `config_file_unsupported`. The implementer must NOT create `svelte.config.js` when using `@sveltejs/kit@^3.0.0`.
   *(Note: If the orchestrator insists on having `svelte.config.js`, `@sveltejs/kit` must be locked down to `2.16.x` with `@sveltejs/adapter-static@3.0.8`, `vite@5.4.14`, and `@sveltejs/vite-plugin-svelte@4.0.0`). The recommended path is SvelteKit 3 without `svelte.config.js`.*
2. **SvelteKit Prerender Warning**:
   When using `fallback: 'index.html'` alongside a prerendered root page `/`, `@sveltejs/adapter-static` outputs a non-fatal informational notice: `Overwriting build/index.html with fallback page. Consider using a different name for the fallback.` This is standard and expected for single-page applications on static hosts like Render.

---

## 4. Conclusion & Concrete Specification

### 4.1 Target File Layout

```text
/home/rydozz/Documents/Proyectos/StockControl_App_Telefono/
├── .env                              # Firebase credentials (PUBLIC_FIREBASE_*)
├── .env.example
├── .gitignore
├── render.yaml                       # Render static site deployment config ($0/mo)
├── package.json                      # Pinned dependencies & build scripts
├── vite.config.ts                    # Centralized SvelteKit 3 & adapter-static config
├── tsconfig.json                     # Extends $app/tsconfig
├── static/
│   ├── assets/
│   │   ├── logo-stockcontrol.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── favicon.png                   # 192x192 favicon
│   └── manifest.json                 # Web App Manifest
└── src/
    ├── app.html                      # HTML shell with viewport-fit=cover & PWA meta
    ├── env.ts                        # SvelteKit 3 defineEnvVars for public credentials
    └── routes/
        ├── +layout.ts                # prerender = true, ssr = false (SPA mode)
        ├── +layout.svelte            # Global layout shell (handled by explorer_m1_3)
        └── +page.svelte              # Main application view (handled by explorer_m1_3)
```

### 4.2 Exact File Contents for Implementation

#### `package.json`
```json
{
  "name": "stockcontrol-pwa",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "prepare": "svelte-kit sync || echo ''",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "test": "node tests/e2e/runner.js"
  },
  "dependencies": {
    "@lucide/svelte": "^1.61.0",
    "firebase": "^11.4.0",
    "html5-qrcode": "^2.3.8"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^4.0.0",
    "@sveltejs/kit": "^3.1.0",
    "@sveltejs/vite-plugin-svelte": "^7.2.0",
    "svelte": "^5.57.1",
    "svelte-check": "^4.6.0",
    "typescript": "^6.0.3",
    "vite": "^8.3.5"
  }
}
```

#### `vite.config.ts`
```typescript
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: true
			})
		})
	],
	envPrefix: ['VITE_', 'PUBLIC_']
});
```

#### `tsconfig.json`
```json
{
	"extends": "$app/tsconfig",
	"compilerOptions": {
		"strict": true
	},
	"include": ["src", "vite.config.ts"]
}
```

#### `src/env.ts`
```typescript
import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_FIREBASE_API_KEY: { public: true, static: true },
	PUBLIC_FIREBASE_AUTH_DOMAIN: { public: true, static: true },
	PUBLIC_FIREBASE_PROJECT_ID: { public: true, static: true },
	PUBLIC_FIREBASE_STORAGE_BUCKET: { public: true, static: true },
	PUBLIC_FIREBASE_MESSAGING_SENDER_ID: { public: true, static: true },
	PUBLIC_FIREBASE_APP_ID: { public: true, static: true },
	PUBLIC_FIREBASE_MEASUREMENT_ID: { public: true, static: true }
});
```

#### `src/routes/+layout.ts`
```typescript
export const prerender = true;
export const ssr = false;
```

#### `src/app.html`
```html
<!doctype html>
<html lang="es">
	<head>
		<meta charset="utf-8" />
		<link rel="icon" type="image/png" href="/assets/icon-192.png" />
		<link rel="apple-touch-icon" href="/assets/icon-192.png" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="theme-color" content="#75472f" />
		<meta name="description" content="Control de vencimiento de productos gastronómicos colaborativo y en tiempo real" />
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
		<meta name="apple-mobile-web-app-title" content="StockControl" />
		<link rel="manifest" href="/manifest.json" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

#### `static/manifest.json`
```json
{
  "name": "StockControl - Control de Vencimientos",
  "short_name": "StockControl",
  "description": "Control de vencimiento de productos gastronómicos colaborativo y en tiempo real.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#f7f2eb",
  "theme_color": "#75472f",
  "icons": [
    {
      "src": "/assets/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

#### `render.yaml`
```yaml
services:
  - type: web
    name: stockcontrol-pwa
    runtime: static
    buildCommand: npm install && npm run build
    staticPublishPath: ./build
    pullRequestPreviewsEnabled: false
    headers:
      - path: /*
        name: X-Frame-Options
        value: SAMEORIGIN
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

#### Static Asset Migration Steps
1. Create directory `static/assets/`.
2. Copy `assets/logo-stockcontrol.png`, `assets/icon-192.png`, and `assets/icon-512.png` into `static/assets/`.
3. Copy `assets/icon-192.png` to `static/favicon.png`.
4. Copy updated `manifest.json` to `static/manifest.json`.

---

## 5. Verification Method

Once the implementer applies the scaffold:

1. **Verify Dependencies Installation**:
   ```bash
   cd /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
   npm install
   ```
   *Expected Outcome*: Clean install with exit code 0, no `EBADENGINE` errors.

2. **Verify Type-Checking**:
   ```bash
   npm run check
   ```
   *Expected Outcome*: `svelte-check found 0 errors and 0 warnings` with exit code 0.

3. **Verify Static Build Output**:
   ```bash
   npm run build
   ```
   *Expected Outcome*:
   - Exit code 0.
   - `build/` directory generated.
   - Files present: `build/index.html`, `build/manifest.json`, `build/favicon.png`, `build/assets/logo-stockcontrol.png`, `build/assets/icon-192.png`, `build/assets/icon-512.png`, and `build/_app/`.

4. **Verify SPA Routing Preview**:
   ```bash
   npm run preview
   ```
   *Expected Outcome*: Serves static build locally on port 4173 with SPA fallback.

5. **Invalidation Conditions**:
   - If `svelte.config.js` is created while using `@sveltejs/kit@^3.0.0`, the build will invalidate with `config_file_unsupported`.
   - If `firebase` is upgraded to `13.x` on Node `v24.11.1`, the install will invalidate with `EBADENGINE`.
