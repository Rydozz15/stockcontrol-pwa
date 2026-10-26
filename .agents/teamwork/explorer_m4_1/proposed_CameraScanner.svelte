<!--
  StockControl PWA — CameraScanner.svelte
  Clean Architecture Presentation Component — Milestone 4 (Features 19, 20, 21)
  Path: src/lib/components/CameraScanner.svelte

  Dual-Engine Barcode & QR Scanner:
  1. Primary: Native browser BarcodeDetector API (hardware-accelerated, Chromium / Android).
  2. Fallback: Dynamic html5-qrcode library (iOS Safari, Firefox, legacy browsers).
  Lifecycle: Complete track teardown on close/unmount, torch toggling, visibility pause.
  Ergonomics: Touch targets >= 44x44px, >=8px spacing, high-contrast kitchen reticle.
-->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    resolveScannerEngine,
    inspectBarcode,
    BarcodeDebouncer,
    type ScannerEngineType
  } from '$lib/domain/barcode';

  export let isOpen: boolean = true;
  export let mode: 'modal' | 'inline' = 'modal';
  export let cooldownMs: number = 1000;
  export let onScan: ((data: { code: string; format: string }) => void) | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;

  const dispatch = createEventDispatcher<{
    scan: { code: string; format: string };
    close: void;
    error: { message: string };
  }>();

  // Component DOM references
  let videoElement: HTMLVideoElement | null = null;
  let containerElement: HTMLElement | null = null;

  // Scanner state
  let isMounted: boolean = false;
  let isScanning: boolean = false;
  let engine: ScannerEngineType = 'native_barcode_detector';
  let hardwareAccelerated: boolean = false;
  let errorMessage: string | null = null;
  let manualCodeInput: string = '';

  // Camera & hardware controls
  let stream: MediaStream | null = null;
  let activeTrack: MediaStreamTrack | null = null;
  let hasTorch: boolean = false;
  let isTorchOn: boolean = false;
  let facingMode: 'environment' | 'user' = 'environment';

  // Native detector & animation loop
  let nativeDetector: any = null;
  let animationFrameId: number | null = null;

  // Software fallback instance (html5-qrcode)
  let html5QrCodeInstance: any = null;
  const HTML5_VIEWPORT_ID = 'html5-qr-scanner-viewport';

  // Debouncer to avoid duplicate rapid scan triggers
  const debouncer = new BarcodeDebouncer(cooldownMs);

  // Scanned feedback animation
  let lastScannedCode: string | null = null;
  let isSuccessFlash: boolean = false;

  onMount(async () => {
    isMounted = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check: is secure context or localhost?
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      errorMessage = 'El escáner de cámara requiere una conexión segura HTTPS. En dispositivos móviles sobre WiFi, utiliza HTTPS.';
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      errorMessage = 'Tu navegador no soporta acceso a la cámara mediante MediaDevices API.';
      return;
    }

    await initializeScanner();
  });

  onDestroy(() => {
    isMounted = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    stopScanning();
  });

  async function initializeScanner() {
    errorMessage = null;

    // Detect if BarcodeDetector API is present and functional
    const hasNative = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    const resolved = resolveScannerEngine(hasNative);
    engine = resolved.engine;
    hardwareAccelerated = resolved.hardwareAccelerated;

    if (engine === 'native_barcode_detector') {
      try {
        const supported = await (window as any).BarcodeDetector.getSupportedFormats();
        const preferred = ['ean_13', 'qr_code', 'code_128', 'ean_8'];
        const formatsToUse = preferred.filter(f => supported.includes(f));
        nativeDetector = new (window as any).BarcodeDetector({
          formats: formatsToUse.length ? formatsToUse : ['ean_13', 'qr_code']
        });
        await startNativeCamera();
      } catch (err: any) {
        console.warn('[CameraScanner] Native BarcodeDetector initialization failed, falling back to software:', err);
        engine = 'software_fallback';
        hardwareAccelerated = false;
        await startSoftwareFallback();
      }
    } else {
      await startSoftwareFallback();
    }
  }

  async function startNativeCamera() {
    stopCurrentTracks();

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Handle unmount race condition
      if (!isMounted || !isOpen) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      stream = mediaStream;
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        activeTrack = tracks[0];
        checkTorchSupport(activeTrack);
      }

      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play();
        isScanning = true;
        startDetectionLoop();
      }
    } catch (err: any) {
      handleCameraError(err);
    }
  }

  function startDetectionLoop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    async function frame() {
      if (!isScanning || !videoElement || !nativeDetector || !isMounted) return;

      if (videoElement.readyState >= 2 && !document.hidden) {
        try {
          const barcodes = await nativeDetector.detect(videoElement);
          if (barcodes && barcodes.length > 0) {
            const first = barcodes[0];
            onCodeDetected(first.rawValue, first.format || 'ean_13');
          }
        } catch (e) {
          // Ignore intermittent frame detection errors
        }
      }

      if (isScanning) {
        animationFrameId = requestAnimationFrame(frame);
      }
    }

    animationFrameId = requestAnimationFrame(frame);
  }

  async function startSoftwareFallback() {
    stopCurrentTracks();

    try {
      // Dynamic import to avoid bundling when unused
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!isMounted || !isOpen) return;

      // Clean up previous instance
      if (html5QrCodeInstance) {
        try {
          if (html5QrCodeInstance.isScanning) {
            await html5QrCodeInstance.stop();
          }
          html5QrCodeInstance.clear();
        } catch {}
      }

      html5QrCodeInstance = new Html5Qrcode(HTML5_VIEWPORT_ID);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCodeInstance.start(
        { facingMode: { ideal: facingMode } },
        config,
        (decodedText: string, decodedResult: any) => {
          const format = decodedResult?.result?.format?.formatName || 'qr_code';
          onCodeDetected(decodedText, format);
        },
        () => {
          // Ignore per-frame non-detection
        }
      );

      isScanning = true;

      // Check torch capabilities in fallback
      try {
        const caps = html5QrCodeInstance.getRunningTrackCameraCapabilities();
        hasTorch = Boolean(caps && caps.torchFeature && caps.torchFeature().isSupported());
      } catch {
        hasTorch = false;
      }
    } catch (err: any) {
      handleCameraError(err);
    }
  }

  function checkTorchSupport(track: MediaStreamTrack) {
    try {
      const caps = (track as any).getCapabilities?.();
      hasTorch = Boolean(caps && caps.torch);
    } catch {
      hasTorch = false;
    }
  }

  async function toggleTorch() {
    if (!hasTorch) return;
    const nextState = !isTorchOn;

    try {
      if (engine === 'native_barcode_detector' && activeTrack) {
        await (activeTrack as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        isTorchOn = nextState;
      } else if (html5QrCodeInstance) {
        await html5QrCodeInstance.applyVideoConstraints({
          advanced: [{ torch: nextState }]
        });
        isTorchOn = nextState;
      }
    } catch (err: any) {
      console.warn('[CameraScanner] Torch toggle failed:', err);
    }
  }

  async function switchCamera() {
    // Stop current track before switching
    stopCurrentTracks();
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    isTorchOn = false;

    if (engine === 'native_barcode_detector') {
      await startNativeCamera();
    } else {
      await startSoftwareFallback();
    }
  }

  function stopCurrentTracks() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
      stream = null;
    }

    if (activeTrack) {
      try {
        activeTrack.stop();
      } catch {}
      activeTrack = null;
    }

    if (videoElement) {
      videoElement.srcObject = null;
    }

    hasTorch = false;
    isTorchOn = false;
  }

  function stopScanning() {
    isScanning = false;
    stopCurrentTracks();

    if (html5QrCodeInstance) {
      try {
        if (html5QrCodeInstance.isScanning) {
          html5QrCodeInstance.stop().catch(() => {});
        }
        html5QrCodeInstance.clear();
      } catch {}
      html5QrCodeInstance = null;
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      // Pause detection loop while tab is hidden
      isScanning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else if (isOpen && isMounted) {
      // Resume scanning when tab returns
      isScanning = true;
      if (engine === 'native_barcode_detector') {
        startDetectionLoop();
      }
    }
  }

  function handleCameraError(err: any) {
    stopScanning();
    const errorName = err?.name || '';
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      errorMessage = 'Permiso de cámara denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.';
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      errorMessage = 'No se encontró ninguna cámara disponible en este dispositivo.';
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      errorMessage = 'La cámara ya está siendo utilizada por otra aplicación.';
    } else {
      errorMessage = err?.message || 'Error al iniciar la cámara del dispositivo.';
    }
    dispatch('error', { message: errorMessage });
  }

  function onCodeDetected(rawCode: string, format: string) {
    if (!rawCode || typeof rawCode !== 'string') return;
    const clean = rawCode.trim();

    // Check debouncer cooldown to avoid double firing
    if (!debouncer.canProcess(clean)) return;

    // Haptic feedback if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(60);
      } catch {}
    }

    lastScannedCode = clean;
    isSuccessFlash = true;
    setTimeout(() => {
      isSuccessFlash = false;
    }, 600);

    const payload = { code: clean, format };
    if (onScan) onScan(payload);
    dispatch('scan', payload);
  }

  function handleManualSubmit() {
    if (!manualCodeInput.trim()) return;
    onCodeDetected(manualCodeInput.trim(), 'manual');
    manualCodeInput = '';
  }

  function handleClose() {
    stopScanning();
    if (onClose) onClose();
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div
    class="scanner-wrapper"
    class:is-modal={mode === 'modal'}
    bind:this={containerElement}
    role="dialog"
    aria-modal="true"
    aria-label="Escáner de código de barras"
  >
    <!-- Top Action Bar -->
    <header class="scanner-header">
      <div class="engine-indicator">
        <span class="engine-badge" class:hw={hardwareAccelerated}>
          {hardwareAccelerated ? '⚡ Hardware (BarcodeDetector)' : '🔄 Software (html5-qrcode)'}
        </span>
      </div>

      <div class="header-controls">
        {#if hasTorch}
          <button
            type="button"
            class="control-btn torch-btn"
            class:active={isTorchOn}
            on:click={toggleTorch}
            aria-label={isTorchOn ? 'Apagar linterna' : 'Encender linterna'}
            aria-pressed={isTorchOn}
          >
            {isTorchOn ? '🔦 On' : '🔦'}
          </button>
        {/if}

        <button
          type="button"
          class="control-btn flip-btn"
          on:click={switchCamera}
          aria-label="Cambiar entre cámara trasera y delantera"
        >
          🔄
        </button>

        <button
          type="button"
          class="control-btn close-btn"
          on:click={handleClose}
          aria-label="Cerrar escáner"
        >
          ✕
        </button>
      </div>
    </header>

    <!-- Camera Viewport & Overlay -->
    <div class="viewport-container">
      {#if engine === 'native_barcode_detector'}
        <!-- Native Video Element -->
        <video
          bind:this={videoElement}
          class="camera-video"
          playsinline
          muted
          autoplay
        ></video>
      {:else}
        <!-- Fallback Container for html5-qrcode -->
        <div id={HTML5_VIEWPORT_ID} class="html5-viewport"></div>
      {/if}

      <!-- Target Scanning Reticle Overlay -->
      <div class="reticle-overlay" class:success-flash={isSuccessFlash} aria-hidden="true">
        <div class="reticle-box">
          <span class="corner tl"></span>
          <span class="corner tr"></span>
          <span class="corner bl"></span>
          <span class="corner br"></span>
          <div class="scan-laser-line"></div>
        </div>
      </div>

      <!-- Helper / Guidance Prompt -->
      <div class="scan-instruction">
        {#if lastScannedCode}
          <div class="detected-pill">
            <span class="pill-check">✓</span>
            <span class="pill-code">{lastScannedCode}</span>
          </div>
        {:else}
          <p class="instruction-text">Apunta el código de barras o QR dentro del marco</p>
        {/if}
      </div>

      <!-- Error Message Banner -->
      {#if errorMessage}
        <div class="error-overlay" role="alert">
          <span class="err-icon">⚠️</span>
          <p class="err-message">{errorMessage}</p>
          <button type="button" class="btn-retry" on:click={initializeScanner}>
            Reintentar
          </button>
        </div>
      {/if}
    </div>

    <!-- Bottom Manual Code Input Fallback -->
    <footer class="manual-input-footer">
      <form class="manual-form" on:submit|preventDefault={handleManualSubmit}>
        <label for="manual-barcode-input" class="sr-only">Ingreso manual de código</label>
        <input
          id="manual-barcode-input"
          type="text"
          placeholder="O ingresa código manualmente..."
          class="manual-input"
          bind:value={manualCodeInput}
          autocomplete="off"
        />
        <button
          type="submit"
          class="btn-manual-submit"
          disabled={!manualCodeInput.trim()}
          aria-label="Buscar código ingresado"
        >
          Buscar
        </button>
      </form>
    </footer>
  </div>
{/if}

<style>
  .scanner-wrapper {
    position: relative;
    width: 100%;
    background-color: #12100e;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }

  .scanner-wrapper.is-modal {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background-color: rgba(18, 16, 14, 0.96);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .scanner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent);
    z-index: 20;
  }

  .engine-badge {
    font-size: 0.72rem;
    padding: 4px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.15);
    color: #d8cec4;
    font-weight: 600;
  }

  .engine-badge.hw {
    background: rgba(85, 214, 136, 0.2);
    color: #55d688;
    border: 1px solid rgba(85, 214, 136, 0.35);
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .control-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #ffffff;
    font-size: 1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
    transition: background-color 0.15s, transform 0.1s;
  }

  .control-btn:active {
    transform: scale(0.94);
    background: rgba(255, 255, 255, 0.3);
  }

  .torch-btn.active {
    background-color: #f59e0b;
    border-color: #f59e0b;
    color: #000000;
  }

  .viewport-container {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 320px;
  }

  .camera-video,
  .html5-viewport {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Scan Reticle & Guide Box */
  .reticle-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: background-color 0.2s;
  }

  .reticle-overlay.success-flash {
    background-color: rgba(85, 214, 136, 0.25);
  }

  .reticle-box {
    position: relative;
    width: 260px;
    height: 260px;
    max-width: 75vw;
    max-height: 75vw;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    overflow: hidden;
  }

  .corner {
    position: absolute;
    width: 28px;
    height: 28px;
    border-color: var(--color-brown-light, #c08056);
    border-style: solid;
    border-width: 0;
  }

  .reticle-overlay.success-flash .corner {
    border-color: #55d688;
  }

  .corner.tl {
    top: 0;
    left: 0;
    border-top-width: 4px;
    border-left-width: 4px;
    border-top-left-radius: 12px;
  }

  .corner.tr {
    top: 0;
    right: 0;
    border-top-width: 4px;
    border-right-width: 4px;
    border-top-right-radius: 12px;
  }

  .corner.bl {
    bottom: 0;
    left: 0;
    border-bottom-width: 4px;
    border-left-width: 4px;
    border-bottom-left-radius: 12px;
  }

  .corner.br {
    bottom: 0;
    right: 0;
    border-bottom-width: 4px;
    border-right-width: 4px;
    border-bottom-right-radius: 12px;
  }

  .scan-laser-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #ff6b4a, transparent);
    box-shadow: 0 0 8px #ff6b4a;
    animation: scanSweep 2s ease-in-out infinite;
  }

  @keyframes scanSweep {
    0% { top: 10%; opacity: 0.2; }
    50% { top: 90%; opacity: 1; }
    100% { top: 10%; opacity: 0.2; }
  }

  .scan-instruction {
    position: absolute;
    bottom: 24px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: center;
    z-index: 15;
    pointer-events: none;
  }

  .instruction-text {
    background: rgba(0, 0, 0, 0.65);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.82rem;
    color: #e5ded5;
    text-align: center;
  }

  .detected-pill {
    background: #55d688;
    color: #0b381e;
    padding: 8px 18px;
    border-radius: 20px;
    font-weight: 800;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(85, 214, 136, 0.4);
    animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes popIn {
    from { transform: scale(0.85); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .error-overlay {
    position: absolute;
    inset: 16px;
    background: rgba(24, 18, 16, 0.95);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
    z-index: 25;
  }

  .err-icon {
    font-size: 2.5rem;
  }

  .err-message {
    font-size: 0.95rem;
    color: #ffb8b0;
    line-height: 1.4;
    max-width: 380px;
  }

  .btn-retry {
    min-width: 44px;
    min-height: 44px;
    padding: 10px 24px;
    background-color: var(--color-brown, #75472f);
    border: none;
    border-radius: 22px;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  /* Manual Entry Footer */
  .manual-input-footer {
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    background-color: #1a1614;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 20;
  }

  .manual-form {
    display: flex;
    gap: 8px;
    max-width: 500px;
    margin: 0 auto;
  }

  .manual-input {
    flex: 1;
    min-height: 44px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.9rem;
    font-family: inherit;
    touch-action: manipulation;
  }

  .manual-input:focus {
    outline: none;
    border-color: var(--color-brown-light, #c08056);
    background: rgba(255, 255, 255, 0.14);
  }

  .btn-manual-submit {
    min-width: 44px;
    min-height: 44px;
    padding: 0 18px;
    background-color: var(--color-brown, #75472f);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-manual-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
