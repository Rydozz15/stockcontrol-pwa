<!--
  StockControl PWA — ExportImportModal.svelte
  Contingency Data Export & Import Modal (CSV & JSON v2)
  Path: src/lib/components/ExportImportModal.svelte
  Ergonomics: WCAG 2.5.5 Touch Targets (>=44x44px, min-height 48px)
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { workspaceStore } from '$lib/stores/workspaceStore';
  import { inventoryStore } from '$lib/stores/inventoryStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { productRepository } from '$lib/repositories/productRepository';
  import {
    exportProductsToCsv,
    exportWasteToCsv,
    exportJsonV2,
    parseCsv,
    importJson,
    validateImportItems,
    resolveImportConflicts,
    triggerFileDownload,
    type ConflictStrategy,
    type ParsedProduct,
    type ValidationResult
  } from '$lib/repositories/contingencyService';
  import type { HistoryLog } from '$lib/domain/models';

  export let isOpen: boolean = false;
  export let recentHistoryLogs: HistoryLog[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    imported: { count: number };
  }>();

  // Tab State
  type ActiveTab = 'export' | 'import';
  let activeTab: ActiveTab = 'export';

  // Conflict Resolution Selection
  let conflictStrategy: ConflictStrategy = 'merge';

  // Import Upload & Validation State
  let isDragging: boolean = false;
  let isCommitting: boolean = false;
  let uploadedFileName: string = '';
  let parsedProducts: ParsedProduct[] = [];
  let validationResult: ValidationResult | null = null;
  let fileError: string | null = null;

  // Real-time Date Stamp for Download Filenames
  const today = new Date().toISOString().slice(0, 10);

  function handleClose() {
    isOpen = false;
    resetImportState();
    dispatch('close');
  }

  function resetImportState() {
    uploadedFileName = '';
    parsedProducts = [];
    validationResult = null;
    fileError = null;
    isCommitting = false;
  }

  // Export Triggers
  function handleExportCsv() {
    try {
      const csvContent = exportProductsToCsv($inventoryStore.products);
      const filename = `stockcontrol-inventario-${$workspaceStore.workspaceId}-${today}.csv`;
      triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
      toastStore.success(`CSV descargado: ${$inventoryStore.products.length} productos`);
    } catch (err: any) {
      toastStore.error('Error al generar CSV: ' + (err.message || 'Error desconocido'));
    }
  }

  function handleExportWasteCsv() {
    try {
      const csvContent = exportWasteToCsv(recentHistoryLogs);
      const filename = `stockcontrol-mermas-haccp-${$workspaceStore.workspaceId}-${today}.csv`;
      triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8;');
      toastStore.success('Historial de mermas descargado en CSV');
    } catch (err: any) {
      toastStore.error('Error al exportar mermas: ' + (err.message || 'Error desconocido'));
    }
  }

  function handleExportJson() {
    try {
      const jsonContent = exportJsonV2(
        $inventoryStore.products,
        $workspaceStore.workspaceId,
        recentHistoryLogs
      );
      const filename = `stockcontrol-backup-${$workspaceStore.workspaceId}-${today}.json`;
      triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8;');
      toastStore.success(`Respaldo JSON v2 descargado`);
    } catch (err: any) {
      toastStore.error('Error al generar JSON: ' + (err.message || 'Error desconocido'));
    }
  }

  // File Processing
  async function processFile(file: File) {
    resetImportState();
    uploadedFileName = file.name;

    try {
      const text = await file.text();
      const isJson = file.name.endsWith('.json') || file.type.includes('json');

      if (isJson) {
        const result = importJson(text, $workspaceStore.workspaceId);
        parsedProducts = result.products as unknown as ParsedProduct[];
      } else {
        parsedProducts = parseCsv(text);
      }

      if (parsedProducts.length === 0) {
        fileError = 'El archivo no contiene productos válidos o está vacío.';
      } else {
        validationResult = validateImportItems(parsedProducts);
      }
    } catch (err: any) {
      fileError = 'Error al procesar archivo: ' + (err.message || 'Formato no soportado');
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      processFile(target.files[0]);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  // Commit Import
  async function handleCommitImport() {
    if (!validationResult || validationResult.valid.length === 0) return;
    isCommitting = true;

    try {
      const { toInsert, toUpdate, skippedCount } = resolveImportConflicts(
        validationResult.valid,
        $inventoryStore.products,
        conflictStrategy
      );

      let insertCount = 0;
      if (toInsert.length > 0) {
        insertCount = await productRepository.batchImport(
          $workspaceStore.workspaceId,
          toInsert,
          $workspaceStore.operatorAlias
        );
      }

      for (const update of toUpdate) {
        await productRepository.updateProduct(
          $workspaceStore.workspaceId,
          update.id,
          update.updates,
          $workspaceStore.operatorAlias
        );
      }

      const totalHandled = insertCount + toUpdate.length;
      toastStore.success(
        `Importación completada: ${insertCount} agregados, ${toUpdate.length} actualizados${
          skippedCount > 0 ? `, ${skippedCount} omitidos` : ''
        }.`
      );

      dispatch('imported', { count: totalHandled });
      handleClose();
    } catch (err: any) {
      toastStore.error('Error al guardar datos importados: ' + (err.message || 'Error de red'));
    } finally {
      isCommitting = false;
    }
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && isOpen && handleClose()} />

{#if isOpen}
  <div
    class="modal-backdrop"
    on:click={(e) => e.target === e.currentTarget && handleClose()}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-import-title"
    tabindex="-1"
  >
    <div class="modal-card">
      <!-- Header -->
      <header class="modal-header">
        <div class="header-titles">
          <h2 id="export-import-title" class="modal-title">Copia de Seguridad y Contingencia</h2>
          <span class="modal-subtitle">Exportación e importación offline de stock y mermas</span>
        </div>
        <button
          type="button"
          class="btn-close"
          on:click={handleClose}
          aria-label="Cerrar modal"
        >
          ✕
        </button>
      </header>

      <!-- Subnavigation Tabs -->
      <div class="modal-tabs" role="tablist">
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'export'}
          role="tab"
          aria-selected={activeTab === 'export'}
          on:click={() => (activeTab = 'export')}
        >
          📤 Exportar Datos
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'import'}
          role="tab"
          aria-selected={activeTab === 'import'}
          on:click={() => (activeTab = 'import')}
        >
          📥 Importar Datos
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        {#if activeTab === 'export'}
          <!-- Export Section -->
          <div class="export-pane">
            <div class="info-banner">
              <span class="info-icon">ℹ️</span>
              <p>
                Genera copias portátiles para contingencia en cocina sin conexión o para auditorías sanitarias HACCP.
              </p>
            </div>

            <!-- CSV Card -->
            <div class="action-card">
              <div class="card-icon">📊</div>
              <div class="card-details">
                <h3>Planilla Excel / CSV</h3>
                <p>Formato estándar RFC 4180 con BOM UTF-8 y separador (;) para Microsoft Excel.</p>
                <span class="card-badge">{$inventoryStore.products.length} productos listos</span>
              </div>
              <button
                type="button"
                class="btn-action primary"
                on:click={handleExportCsv}
                disabled={$inventoryStore.products.length === 0}
              >
                Descargar CSV
              </button>
            </div>

            <!-- JSON v2 Card -->
            <div class="action-card">
              <div class="card-icon">💾</div>
              <div class="card-details">
                <h3>Respaldo Total JSON v2</h3>
                <p>Copia completa de la base de datos con estructura versionada e historial.</p>
                <span class="card-badge">Compatible con restauración 1:1</span>
              </div>
              <button
                type="button"
                class="btn-action primary"
                on:click={handleExportJson}
                disabled={$inventoryStore.products.length === 0}
              >
                Descargar JSON
              </button>
            </div>

            <!-- Waste History Card -->
            <div class="action-card secondary">
              <div class="card-icon">📋</div>
              <div class="card-details">
                <h3>Libro de Mermas HACCP (CSV)</h3>
                <p>Exporta el registro de bajas, motivos de deterioro y firmas de operador.</p>
              </div>
              <button
                type="button"
                class="btn-action outline"
                on:click={handleExportWasteCsv}
              >
                Exportar Mermas
              </button>
            </div>
          </div>
        {:else}
          <!-- Import Section -->
          <div class="import-pane">
            <!-- Dropzone -->
            <div
              class="dropzone"
              class:dragging={isDragging}
              on:dragover|preventDefault={() => (isDragging = true)}
              on:dragleave={() => (isDragging = false)}
              on:drop={handleDrop}
              role="region"
              aria-label="Zona de carga de archivo"
            >
              <span class="drop-icon">📁</span>
              <p class="drop-text">Arrastra un archivo CSV o JSON aquí</p>
              <label class="file-picker-btn">
                <span>Seleccionar del dispositivo</span>
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  on:change={handleFileInput}
                  style="display: none;"
                />
              </label>
              <small class="drop-hint">Formatos soportados: CSV con encabezados estándar o JSON v1/v2</small>
            </div>

            <!-- Error Banner -->
            {#if fileError}
              <div class="error-banner" role="alert">
                <span>⚠️ {fileError}</span>
              </div>
            {/if}

            <!-- Validation Preview -->
            {#if validationResult}
              <div class="preview-section">
                <div class="preview-header">
                  <h4>Archivo: <strong>{uploadedFileName}</strong></h4>
                  <div class="pill-group">
                    <span class="pill-success">✓ {validationResult.summary.validCount} válidos</span>
                    {#if validationResult.summary.invalidCount > 0}
                      <span class="pill-error">✕ {validationResult.summary.invalidCount} errores</span>
                    {/if}
                  </div>
                </div>

                <!-- Conflict Resolution Strategy -->
                <div class="strategy-selector">
                  <label for="conflict-strategy">Acción ante duplicados:</label>
                  <select id="conflict-strategy" bind:value={conflictStrategy} class="select-input">
                    <option value="merge">Fusionar (sumar cantidades al stock actual)</option>
                    <option value="replace">Reemplazar (sobrescribir datos existentes)</option>
                    <option value="skip">Omitir duplicados</option>
                    <option value="append">Agregar siempre como nuevos productos</option>
                  </select>
                </div>

                <!-- Preview Table (first 5 rows) -->
                <div class="table-scroll">
                  <table class="preview-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>Vencimiento</th>
                        <th>Ubicación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each validationResult.valid.slice(0, 5) as p}
                        <tr>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.category}</td>
                          <td>{p.quantity} {p.unit}</td>
                          <td>{p.expiryDate}</td>
                          <td>{p.location}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                  {#if validationResult.valid.length > 5}
                    <div class="more-rows-hint">
                      ...y {validationResult.valid.length - 5} productos más listos para importar.
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <button type="button" class="btn-cancel" on:click={handleClose}>
          Cerrar
        </button>

        {#if activeTab === 'import' && validationResult && validationResult.valid.length > 0}
          <button
            type="button"
            class="btn-commit"
            on:click={handleCommitImport}
            disabled={isCommitting}
          >
            {isCommitting ? 'Importando...' : `Confirmar e Importar (${validationResult.valid.length})`}
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 16px;
  }

  .modal-card {
    background: #ffffff;
    border-radius: 20px;
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 18px 20px 14px;
    border-bottom: 1px solid #eadfd2;
    background: #faf5ee;
  }

  .modal-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: #4a2818;
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: #7c7168;
  }

  .btn-close {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    border: none;
    background: transparent;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .btn-close:active {
    background-color: #ede2d5;
  }

  .modal-tabs {
    display: flex;
    border-bottom: 2px solid #eadfd2;
    background-color: #faf5ee;
  }

  .tab-btn {
    flex: 1;
    min-height: 48px;
    border: none;
    background: transparent;
    font-weight: 700;
    font-size: 0.9rem;
    color: #7c7168;
    cursor: pointer;
    touch-action: manipulation;
    border-bottom: 3px solid transparent;
  }

  .tab-btn.active {
    color: #75472f;
    border-bottom-color: #75472f;
    background: #ffffff;
  }

  .modal-body {
    padding: 18px 20px;
    overflow-y: auto;
    flex: 1;
  }

  .info-banner {
    display: flex;
    gap: 10px;
    background: #fdf8f3;
    border: 1px solid #eadfd2;
    padding: 10px 14px;
    border-radius: 12px;
    margin-bottom: 16px;
    font-size: 0.85rem;
    color: #69412d;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1.5px solid #eadfd2;
    border-radius: 14px;
    margin-bottom: 12px;
    background: #faf5ee;
  }

  .action-card.secondary {
    background: #ffffff;
  }

  .card-icon {
    font-size: 1.8rem;
  }

  .card-details {
    flex: 1;
  }

  .card-details h3 {
    margin: 0 0 2px;
    font-size: 0.95rem;
    color: #4a2818;
  }

  .card-details p {
    margin: 0 0 4px;
    font-size: 0.78rem;
    color: #7c7168;
  }

  .card-badge {
    display: inline-block;
    font-size: 0.7rem;
    background: #ede2d5;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 600;
    color: #69412d;
  }

  .btn-action {
    min-height: 48px;
    min-width: 130px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    padding: 0 14px;
  }

  .btn-action.primary {
    background: #75472f;
    color: #ffffff;
    border: none;
  }

  .btn-action.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-action.outline {
    background: transparent;
    border: 1.5px solid #75472f;
    color: #75472f;
  }

  /* Dropzone */
  .dropzone {
    border: 2px dashed #bba998;
    background: #fdfaf6;
    border-radius: 16px;
    padding: 24px 16px;
    text-align: center;
    transition: background 0.2s;
  }

  .dropzone.dragging {
    background: #faede0;
    border-color: #75472f;
  }

  .drop-icon {
    font-size: 2.2rem;
    display: block;
    margin-bottom: 6px;
  }

  .drop-text {
    margin: 0 0 12px;
    font-weight: 600;
    color: #4a2818;
  }

  .file-picker-btn {
    display: inline-block;
    min-height: 48px;
    line-height: 48px;
    padding: 0 20px;
    background: #75472f;
    color: #ffffff;
    font-weight: 700;
    font-size: 0.9rem;
    border-radius: 12px;
    cursor: pointer;
    touch-action: manipulation;
  }

  .drop-hint {
    display: block;
    margin-top: 10px;
    color: #8c8075;
    font-size: 0.75rem;
  }

  .error-banner {
    margin-top: 14px;
    padding: 12px;
    background: #fde8e7;
    border: 1px solid #f8c2be;
    color: #b84035;
    border-radius: 10px;
    font-size: 0.85rem;
  }

  .preview-section {
    margin-top: 18px;
    border-top: 1px solid #eadfd2;
    padding-top: 14px;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .preview-header h4 {
    margin: 0;
    font-size: 0.9rem;
  }

  .pill-group {
    display: flex;
    gap: 6px;
  }

  .pill-success {
    background: #e2f0d9;
    color: #385623;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .pill-error {
    background: #fde8e7;
    color: #b84035;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .strategy-selector {
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .strategy-selector label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #4a2818;
  }

  .select-input {
    min-height: 48px;
    border-radius: 10px;
    border: 1.5px solid #eadfd2;
    padding: 0 12px;
    font-size: 0.88rem;
    background: #ffffff;
    color: #4a2818;
  }

  .table-scroll {
    overflow-x: auto;
    border: 1px solid #eadfd2;
    border-radius: 10px;
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    text-align: left;
  }

  .preview-table th,
  .preview-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f0e6da;
  }

  .preview-table th {
    background: #faf5ee;
    color: #7c7168;
    font-weight: 700;
  }

  .more-rows-hint {
    padding: 8px 10px;
    text-align: center;
    font-size: 0.75rem;
    color: #7c7168;
    background: #faf5ee;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #eadfd2;
    background: #faf5ee;
  }

  .btn-cancel {
    min-height: 48px;
    min-width: 90px;
    background: #f5ede4;
    border: 1.5px solid #eadfd2;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    color: #7c7168;
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-commit {
    min-height: 48px;
    padding: 0 20px;
    background: #75472f;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-size: 0.92rem;
    font-weight: 800;
    cursor: pointer;
    touch-action: manipulation;
    box-shadow: 0 4px 12px rgba(117, 71, 47, 0.25);
  }

  .btn-commit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
