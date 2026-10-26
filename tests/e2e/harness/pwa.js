/**
 * PWA, Static Assets & Render Deployment Contract Reference Oracle
 * Authoritative source: ORIGINAL_REQUEST.md § R4, PROJECT.md § Feature 5, 22, 23, 27
 */

const fs = require('fs');

/**
 * Validates web app manifest object.
 * @param {object} manifest
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'] };
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Manifest missing or invalid "name"');
  }
  if (!manifest.short_name || typeof manifest.short_name !== 'string') {
    errors.push('Manifest missing or invalid "short_name"');
  }
  if (manifest.display !== 'standalone') {
    errors.push(`Manifest display must be "standalone", got "${manifest.display}"`);
  }
  if (!manifest.theme_color || !/^#[0-9a-fA-F]{3,8}$/.test(manifest.theme_color)) {
    errors.push(`Manifest theme_color must be valid hex color, got "${manifest.theme_color}"`);
  }
  if (!manifest.background_color || !/^#[0-9a-fA-F]{3,8}$/.test(manifest.background_color)) {
    errors.push(`Manifest background_color must be valid hex color, got "${manifest.background_color}"`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
    errors.push('Manifest icons array must contain at least 2 icons (192 and 512)');
  } else {
    const has192 = manifest.icons.some(i => i.sizes === '192x192');
    const has512 = manifest.icons.some(i => i.sizes === '512x512');
    if (!has192) errors.push('Manifest icons missing 192x192 size');
    if (!has512) errors.push('Manifest icons missing 512x512 size');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a PNG binary buffer by checking magic bytes and reading IHDR chunk dimensions.
 * PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
 * IHDR starts at byte 12, width is 4 bytes at offset 16, height is 4 bytes at offset 20.
 * @param {Buffer} buffer
 * @returns {{ valid: boolean; width: number; height: number; bitDepth?: number; colorType?: number }}
 */
function inspectPngBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    return { valid: false, width: 0, height: 0 };
  }
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== magic[i]) {
      return { valid: false, width: 0, height: 0 };
    }
  }

  // IHDR chunk
  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') {
    return { valid: false, width: 0, height: 0 };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  return { valid: true, width, height, bitDepth, colorType };
}

/**
 * Validates service worker source code contents for PWA caching patterns.
 * @param {string} code
 * @returns {{ hasInstall: boolean; hasActivate: boolean; hasFetch: boolean; hasCacheMatch: boolean }}
 */
function inspectServiceWorker(code) {
  if (!code || typeof code !== 'string') {
    return { hasInstall: false, hasActivate: false, hasFetch: false, hasCacheMatch: false };
  }
  return {
    hasInstall: code.includes('install') && (code.includes('caches.open') || code.includes('CACHE_NAME')),
    hasActivate: code.includes('activate') && (code.includes('caches.keys') || code.includes('clients.claim')),
    hasFetch: code.includes('fetch') && code.includes('respondWith'),
    hasCacheMatch: code.includes('caches.match')
  };
}

/**
 * Validates render.yaml deployment configuration object.
 * @param {object} yamlConfig
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateRenderYaml(yamlConfig) {
  const errors = [];
  if (!yamlConfig || typeof yamlConfig !== 'object') {
    return { valid: false, errors: ['render.yaml content must be an object'] };
  }
  if (!Array.isArray(yamlConfig.services) || yamlConfig.services.length === 0) {
    return { valid: false, errors: ['render.yaml must declare a "services" array'] };
  }

  const staticService = yamlConfig.services.find(s => s.type === 'web' && s.env === 'static');
  if (!staticService) {
    errors.push('render.yaml must contain a service with type: web and env: static');
  } else {
    if (!staticService.buildCommand || !staticService.buildCommand.includes('npm run build')) {
      errors.push('buildCommand must include "npm run build"');
    }
    const pub = staticService.staticPublishPath || staticService.publishDir || '';
    if (!pub.includes('build')) {
      errors.push(`staticPublishPath must point to build directory, got "${pub}"`);
    }
    if (staticService.plan && staticService.plan !== 'free') {
      errors.push(`Plan must be free ($0/month), got "${staticService.plan}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateManifest,
  inspectPngBuffer,
  inspectServiceWorker,
  validateRenderYaml
};
