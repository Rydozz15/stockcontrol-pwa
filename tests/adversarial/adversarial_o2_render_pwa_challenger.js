/**
 * Milestone O2 Adversarial Challenger Suite: Render Configuration, SPA Fallback & PWA Static Assets
 * 
 * Verifies:
 * 1. Build output artifacts (index.html, manifest.json, service-worker.js, assets, and 200.html investigation)
 * 2. render.yaml Blueprint specification, headers, and SPA rewrite rules
 * 3. tests/e2e/harness/pwa.js complete adversarial validation
 * 4. Live simulated Render edge router with subpaths, query parameters, deep links, and caching headers
 * 5. Live Firebase Cloud Firestore probe on stockcontrol-86bb7
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// Simple YAML parser for render.yaml
function parseRenderYaml(content) {
  const lines = content.split('\n');
  const result = { services: [] };
  let currentService = null;
  let inHeaders = false;
  let inRoutes = false;
  let currentHeader = null;
  let currentRoute = null;

  for (let line of lines) {
    const raw = line;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);

    if (trimmed.startsWith('- type:')) {
      if (indent === 2) {
        currentService = { type: trimmed.split(':')[1].trim() };
        result.services.push(currentService);
        inHeaders = false;
        inRoutes = false;
        continue;
      }
    }

    if (!currentService) continue;

    if (indent === 4 && trimmed === 'headers:') {
      currentService.headers = [];
      inHeaders = true;
      inRoutes = false;
      continue;
    }

    if (indent === 4 && trimmed === 'routes:') {
      currentService.routes = [];
      inRoutes = true;
      inHeaders = false;
      continue;
    }

    if (inHeaders) {
      if (indent === 6 && trimmed.startsWith('- path:')) {
        currentHeader = { path: trimmed.replace('- path:', '').trim() };
        currentService.headers.push(currentHeader);
      } else if (indent === 8 && currentHeader) {
        const [k, ...v] = trimmed.split(':');
        currentHeader[k.trim()] = v.join(':').trim();
      }
    } else if (inRoutes) {
      if (indent === 6 && trimmed.startsWith('- type:')) {
        currentRoute = { type: trimmed.replace('- type:', '').trim() };
        currentService.routes.push(currentRoute);
      } else if (indent === 8 && currentRoute) {
        const [k, ...v] = trimmed.split(':');
        currentRoute[k.trim()] = v.join(':').trim();
      }
    } else if (indent === 4) {
      const [k, ...v] = trimmed.split(':');
      currentService[k.trim()] = v.join(':').trim();
    }
  }

  return result;
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('STARTING MILESTONE O2 BUILD & PWA ADVERSARIAL CHALLENGER SUITE');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log('================================================================\n');

  const {
    validateManifest,
    inspectPngBuffer,
    inspectServiceWorker,
    validateRenderYaml
  } = require('../e2e/harness/pwa.js');

  // ============================================================================
  // SUITE 1: Build Output & Artifact Invariants
  // ============================================================================
  console.log('--- SUITE 1: Build Output & Static Artifact Integrity ---');

  test('build/ directory exists on disk', () => {
    assert.strictEqual(fs.existsSync(BUILD_DIR), true);
  });

  test('build/index.html exists and is valid SPA shell', () => {
    const indexPath = path.join(BUILD_DIR, 'index.html');
    assert.strictEqual(fs.existsSync(indexPath), true);
    const content = fs.readFileSync(indexPath, 'utf8');
    assert.ok(content.length > 500, 'index.html has substantial content');
    assert.ok(content.includes('<!doctype html>'), 'index.html has DOCTYPE');
    assert.ok(content.includes('viewport-fit=cover'), 'index.html has safe area viewport');
    assert.ok(content.includes('/manifest.json'), 'index.html links to manifest');
    assert.ok(content.includes('/service-worker.js'), 'index.html registers service worker');
    assert.ok(content.includes('kit.start'), 'index.html initiates SvelteKit SPA runtime');
  });

  test('build/manifest.json exists and satisfies PWA requirements', () => {
    const manifestPath = path.join(BUILD_DIR, 'manifest.json');
    assert.strictEqual(fs.existsSync(manifestPath), true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const res = validateManifest(manifest);
    assert.strictEqual(res.valid, true, `Manifest invalid: ${res.errors.join(', ')}`);
    assert.strictEqual(manifest.display, 'standalone');
    assert.strictEqual(manifest.theme_color, '#75472f');
    assert.strictEqual(manifest.background_color, '#fbf6ee');
  });

  test('build/service-worker.js exists and implements PWA offline caching', () => {
    const swPath = path.join(BUILD_DIR, 'service-worker.js');
    assert.strictEqual(fs.existsSync(swPath), true);
    const swCode = fs.readFileSync(swPath, 'utf8');
    const res = inspectServiceWorker(swCode);
    assert.strictEqual(res.hasInstall, true, 'SW has install listener with cache open');
    assert.strictEqual(res.hasActivate, true, 'SW has activate listener with cleanup/claim');
    assert.strictEqual(res.hasFetch, true, 'SW has fetch listener with respondWith');
    assert.strictEqual(res.hasCacheMatch, true, 'SW matches cache');
    assert.ok(swCode.includes('/index.html'), 'SW precaches index.html');
  });

  test('build/assets/ PNG icons exist and validate dimensions', () => {
    const icon192 = inspectPngBuffer(fs.readFileSync(path.join(BUILD_DIR, 'assets/icon-192.png')));
    const icon512 = inspectPngBuffer(fs.readFileSync(path.join(BUILD_DIR, 'assets/icon-512.png')));
    const logo = inspectPngBuffer(fs.readFileSync(path.join(BUILD_DIR, 'assets/logo-stockcontrol.png')));

    assert.strictEqual(icon192.valid, true);
    assert.strictEqual(icon192.width, 192);
    assert.strictEqual(icon192.height, 192);

    assert.strictEqual(icon512.valid, true);
    assert.strictEqual(icon512.width, 512);
    assert.strictEqual(icon512.height, 512);

    assert.strictEqual(logo.valid, true);
    assert.ok(logo.width > 0 && logo.height > 0);
  });

  test('build/200.html empirical analysis: adapter-static SPA fallback routing', () => {
    const p200 = path.join(BUILD_DIR, '200.html');
    const pIndex = path.join(BUILD_DIR, 'index.html');
    const has200 = fs.existsSync(p200);
    const hasIndex = fs.existsSync(pIndex);

    // Document empirical finding:
    // SvelteKit adapter-static with `fallback: 'index.html'` outputs `index.html` as the SPA fallback shell.
    // Render Static Sites routes use `destination: /index.html`.
    // 200.html is the convention for Surge.sh, whereas index.html is the canonical convention for Render.
    assert.strictEqual(hasIndex, true, 'index.html must exist as primary SPA entry point');
    console.log(`    Note on 200.html: Exists = ${has200}. Render rewrite maps /* to /index.html directly.`);
  });

  // ============================================================================
  // SUITE 2: render.yaml Specification & Security Headers
  // ============================================================================
  console.log('\n--- SUITE 2: render.yaml Specification & Rule Coverage ---');

  const rawRenderYaml = fs.readFileSync(path.join(PROJECT_ROOT, 'render.yaml'), 'utf8');
  const parsedYaml = parseRenderYaml(rawRenderYaml);

  test('render.yaml passes validateRenderYaml harness check', () => {
    const res = validateRenderYaml(parsedYaml);
    assert.strictEqual(res.valid, true, `Validation failed: ${res.errors.join(', ')}`);
  });

  test('render.yaml enforces $0/month cost constraints', () => {
    const svc = parsedYaml.services[0];
    assert.strictEqual(svc.type, 'web');
    assert.strictEqual(svc.env, 'static');
    assert.ok(!svc.plan || svc.plan === 'free');
    assert.ok(!rawRenderYaml.includes('plan: starter'));
    assert.ok(!rawRenderYaml.includes('plan: standard'));
    assert.ok(!rawRenderYaml.includes('plan: pro'));
  });

  test('render.yaml configures SPA rewrite to /index.html', () => {
    const svc = parsedYaml.services[0];
    assert.ok(Array.isArray(svc.routes), 'routes is an array');
    const rewrite = svc.routes.find(r => r.type === 'rewrite');
    assert.ok(rewrite, 'rewrite route exists');
    assert.strictEqual(rewrite.source, '/*');
    assert.strictEqual(rewrite.destination, '/index.html');
  });

  test('render.yaml configures required security headers (X-Frame-Options, X-Content-Type-Options)', () => {
    const svc = parsedYaml.services[0];
    assert.ok(Array.isArray(svc.headers), 'headers is an array');
    const xfo = svc.headers.find(h => h.path === '/*' && h.name === 'X-Frame-Options');
    assert.ok(xfo, 'X-Frame-Options is defined for /*');
    assert.strictEqual(xfo.value, 'SAMEORIGIN');

    const xcto = svc.headers.find(h => h.path === '/*' && h.name === 'X-Content-Type-Options');
    assert.ok(xcto, 'X-Content-Type-Options is defined for /*');
    assert.strictEqual(xcto.value, 'nosniff');
  });

  test('render.yaml configures differential Cache-Control headers', () => {
    const svc = parsedYaml.services[0];
    const rootCache = svc.headers.find(h => h.path === '/*' && h.name === 'Cache-Control');
    assert.ok(rootCache, 'Cache-Control defined for /*');
    assert.strictEqual(rootCache.value, 'no-cache');

    const immutableApp = svc.headers.find(h => h.path === '/_app/immutable/*' && h.name === 'Cache-Control');
    assert.ok(immutableApp, 'Cache-Control defined for /_app/immutable/*');
    assert.ok(immutableApp.value.includes('immutable'));
    assert.ok(immutableApp.value.includes('max-age=31536000'));

    const assetsCache = svc.headers.find(h => h.path === '/assets/*' && h.name === 'Cache-Control');
    assert.ok(assetsCache, 'Cache-Control defined for /assets/*');
    assert.ok(assetsCache.value.includes('immutable'));
  });

  // ============================================================================
  // SUITE 3: Adversarial Validation of tests/e2e/harness/pwa.js
  // ============================================================================
  console.log('\n--- SUITE 3: Adversarial Fuzzing of tests/e2e/harness/pwa.js ---');

  test('validateManifest rejects non-objects and primitives', () => {
    assert.strictEqual(validateManifest(null).valid, false);
    assert.strictEqual(validateManifest(undefined).valid, false);
    assert.strictEqual(validateManifest('string').valid, false);
    assert.strictEqual(validateManifest(123).valid, false);
  });

  test('validateManifest detects missing or invalid fields', () => {
    assert.strictEqual(validateManifest({ short_name: 'A', display: 'standalone', theme_color: '#fff', background_color: '#fff', icons: [{ sizes: '192x192' }, { sizes: '512x512' }] }).valid, false);
    assert.strictEqual(validateManifest({ name: 'A', display: 'standalone', theme_color: '#fff', background_color: '#fff', icons: [{ sizes: '192x192' }, { sizes: '512x512' }] }).valid, false);
    assert.strictEqual(validateManifest({ name: 'A', short_name: 'B', display: 'browser', theme_color: '#fff', background_color: '#fff', icons: [{ sizes: '192x192' }, { sizes: '512x512' }] }).valid, false);
    assert.strictEqual(validateManifest({ name: 'A', short_name: 'B', display: 'standalone', theme_color: 'red', background_color: '#fff', icons: [{ sizes: '192x192' }, { sizes: '512x512' }] }).valid, false);
    assert.strictEqual(validateManifest({ name: 'A', short_name: 'B', display: 'standalone', theme_color: '#fff', background_color: 'blue', icons: [{ sizes: '192x192' }, { sizes: '512x512' }] }).valid, false);
    assert.strictEqual(validateManifest({ name: 'A', short_name: 'B', display: 'standalone', theme_color: '#fff', background_color: '#fff', icons: [{ sizes: '192x192' }] }).valid, false);
    assert.strictEqual(validateManifest({ name: 'A', short_name: 'B', display: 'standalone', theme_color: '#fff', background_color: '#fff', icons: [{ sizes: '256x256' }, { sizes: '512x512' }] }).valid, false);
  });

  test('inspectPngBuffer detects non-PNGs and corrupted buffers', () => {
    assert.strictEqual(inspectPngBuffer(Buffer.alloc(10)).valid, false);
    assert.strictEqual(inspectPngBuffer('not-a-buffer').valid, false);
    assert.strictEqual(inspectPngBuffer(Buffer.from('GIF89a......')).valid, false);

    // Valid header but wrong chunk type
    const fakeChunk = Buffer.alloc(30);
    fakeChunk[0] = 0x89; fakeChunk[1] = 0x50; fakeChunk[2] = 0x4e; fakeChunk[3] = 0x47;
    fakeChunk[4] = 0x0d; fakeChunk[5] = 0x0a; fakeChunk[6] = 0x1a; fakeChunk[7] = 0x0a;
    fakeChunk.write('NOTI', 12, 'ascii');
    assert.strictEqual(inspectPngBuffer(fakeChunk).valid, false);
  });

  test('inspectServiceWorker identifies missing lifecycle handlers', () => {
    assert.strictEqual(inspectServiceWorker(null).hasInstall, false);
    assert.strictEqual(inspectServiceWorker('').hasFetch, false);
    assert.strictEqual(inspectServiceWorker('console.log("hello");').hasActivate, false);
  });

  test('validateRenderYaml detects invalid configurations', () => {
    assert.strictEqual(validateRenderYaml(null).valid, false);
    assert.strictEqual(validateRenderYaml({}).valid, false);
    assert.strictEqual(validateRenderYaml({ services: [] }).valid, false);
    assert.strictEqual(validateRenderYaml({ services: [{ type: 'web', env: 'node' }] }).valid, false);
    assert.strictEqual(validateRenderYaml({ services: [{ type: 'web', env: 'static', buildCommand: 'make' }] }).valid, false);
    assert.strictEqual(validateRenderYaml({ services: [{ type: 'web', env: 'static', buildCommand: 'npm run build', staticPublishPath: 'dist' }] }).valid, false);
    assert.strictEqual(validateRenderYaml({ services: [{ type: 'web', env: 'static', buildCommand: 'npm run build', staticPublishPath: 'build', plan: 'standard' }] }).valid, false);
  });

  // ============================================================================
  // SUITE 4: Live Render Static Edge Router Simulation
  // ============================================================================
  console.log('\n--- SUITE 4: Live Render Edge Router Simulation & Edge Cases ---');

  // Create an in-memory HTTP server replicating Render static site edge routing rules
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Apply headers according to render.yaml rules
    // Match in reverse or priority order
    let headersToApply = {};
    for (const rule of parsedYaml.services[0].headers || []) {
      const pattern = rule.path;
      let matched = false;
      if (pattern === '/*') {
        matched = true;
      } else if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (pathname.startsWith(prefix)) matched = true;
      } else if (pattern === pathname) {
        matched = true;
      }
      if (matched) {
        headersToApply[rule.name] = rule.value;
      }
    }

    // Set headers
    for (const [k, v] of Object.entries(headersToApply)) {
      res.setHeader(k, v);
    }

    // Check if file exists on disk
    let relativePath = pathname.replace(/^\/+/, '');
    if (!relativePath) relativePath = 'index.html';

    let filePath = path.join(BUILD_DIR, relativePath);
    let fileExists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();

    if (!fileExists && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      const dirIndex = path.join(filePath, 'index.html');
      if (fs.existsSync(dirIndex)) {
        filePath = dirIndex;
        fileExists = true;
      }
    }

    if (fileExists) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.statusCode = 200;
      return res.end(fs.readFileSync(filePath));
    }

    // Render Rewrite Rule:
    const rewrite = (parsedYaml.services[0].routes || []).find(r => r.type === 'rewrite');
    if (rewrite && rewrite.source === '/*') {
      const destPath = path.join(BUILD_DIR, rewrite.destination.replace(/^\/+/, ''));
      if (fs.existsSync(destPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200; // Render serves rewritten SPA requests with HTTP 200
        return res.end(fs.readFileSync(destPath));
      }
    }

    // Default 404
    res.statusCode = 404;
    res.end('Not Found');
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  async function request(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${urlPath}`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }).on('error', reject);
    });
  }

  await asyncTest('Root GET / serves index.html with 200 OK and no-cache', async () => {
    const res = await request('/');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['cache-control'], 'no-cache');
    assert.ok(res.body.includes('__sveltekit_'));
  });

  await asyncTest('Root with query string GET /?workspace=cocina-principal serves index.html', async () => {
    const res = await request('/?workspace=cocina-principal&operator=chef');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('__sveltekit_'));
  });

  await asyncTest('Direct deep link GET /scanner rewrites to index.html with 200 OK', async () => {
    const res = await request('/scanner');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.body.includes('__sveltekit_'));
    assert.strictEqual(res.headers['cache-control'], 'no-cache');
  });

  await asyncTest('Deep nested subpath GET /workspaces/cocina-principal/products/123 rewrites to index.html', async () => {
    const res = await request('/workspaces/cocina-principal/products/123');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('__sveltekit_'));
  });

  await asyncTest('Deep link with query params and encoded chars GET /workspace/cocina%20norte?tab=waste rewrites to index.html', async () => {
    const res = await request('/workspace/cocina%20norte?tab=waste&sort=date');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('__sveltekit_'));
  });

  await asyncTest('Static asset GET /manifest.json is served with 200 OK and no-cache', async () => {
    const res = await request('/manifest.json');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('application/json'));
    assert.strictEqual(res.headers['cache-control'], 'no-cache');
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.short_name, 'StockControl');
  });

  await asyncTest('Static asset GET /service-worker.js is served with 200 OK and no-cache (PWA freshness)', async () => {
    const res = await request('/service-worker.js');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('application/javascript'));
    assert.strictEqual(res.headers['cache-control'], 'no-cache');
    assert.ok(res.body.includes('stockcontrol-pwa'));
  });

  await asyncTest('PNG asset GET /assets/icon-192.png has 1-year immutable caching', async () => {
    const res = await request('/assets/icon-192.png');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'image/png');
    assert.strictEqual(res.headers['cache-control'], 'public, max-age=31536000, immutable');
  });

  await asyncTest('PNG asset GET /assets/logo-stockcontrol.png has 1-year immutable caching', async () => {
    const res = await request('/assets/logo-stockcontrol.png');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'image/png');
    assert.strictEqual(res.headers['cache-control'], 'public, max-age=31536000, immutable');
  });

  // Check immutable JS chunk caching
  const immutableEntryDir = path.join(BUILD_DIR, '_app/immutable/entry');
  const files = fs.readdirSync(immutableEntryDir);
  const startFile = files.find(f => f.startsWith('start.'));

  await asyncTest(`Immutable JS chunk GET /_app/immutable/entry/${startFile} has 1-year immutable caching`, async () => {
    const res = await request(`/_app/immutable/entry/${startFile}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'application/javascript');
    assert.strictEqual(res.headers['cache-control'], 'public, max-age=31536000, immutable');
  });

  server.close();

  // ============================================================================
  // SUITE 5: Live Cloud Firestore Connection & Data Seed Empirical Probe
  // ============================================================================
  console.log('\n--- SUITE 5: Live Cloud Firestore (stockcontrol-86bb7) Empirical Probe ---');

  // Read .env file for credentials
  const envContent = fs.readFileSync(path.join(PROJECT_ROOT, '.env'), 'utf8');
  const envVars = {};
  for (let l of envContent.split('\n')) {
    const trimmed = l.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim();
  }

  await asyncTest('Query live Cloud Firestore cocina-principal products and history', async () => {
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs } = await import('firebase/firestore');

    const app = initializeApp({
      apiKey: envVars.PUBLIC_FIREBASE_API_KEY,
      authDomain: envVars.PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: envVars.PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: envVars.PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: envVars.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: envVars.PUBLIC_FIREBASE_APP_ID
    }, `challenger-probe-${Date.now()}`);

    const db = getFirestore(app);
    const productsSnap = await getDocs(collection(db, 'workspaces', 'cocina-principal', 'products'));
    const historySnap = await getDocs(collection(db, 'workspaces', 'cocina-principal', 'history'));

    console.log(`    Live Firestore Products count: ${productsSnap.size}`);
    console.log(`    Live Firestore History count : ${historySnap.size}`);

    assert.ok(productsSnap.size >= 20, `Expected >= 20 seeded products in cocina-principal, got ${productsSnap.size}`);
    assert.ok(historySnap.size >= 20, `Expected >= 20 history entries in cocina-principal, got ${historySnap.size}`);

    // Verify product structure
    const sampleProductDoc = productsSnap.docs[0].data();
    assert.ok(typeof sampleProductDoc.name === 'string', 'Product has name');
    assert.ok(typeof sampleProductDoc.quantity === 'number', 'Product has numeric quantity');
    assert.ok(typeof sampleProductDoc.expiryDate === 'string', 'Product has expiryDate');
    assert.ok(typeof sampleProductDoc.createdBy === 'string', 'Product has createdBy audit stamp');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('       MILESTONE O2 ADVERSARIAL CHALLENGER SUITE SUMMARY       ');
  console.log('================================================================');
  console.log(` TOTAL ASSERTIONS : ${totalTests}`);
  console.log(` PASSED           : ${passedTests}`);
  console.log(` FAILED           : ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`>>> ADVERSARIAL CHALLENGER FAILED WITH ${failedTests} FAILURES. VERDICT: REQUEST_CHANGES.`);
    process.exit(1);
  } else {
    console.log('>>> ALL ADVERSARIAL CHALLENGES PASSED (100%). VERDICT: APPROVE.\n');
    process.exit(0);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal Test Exception in Challenger Suite:', err);
  process.exit(1);
});
