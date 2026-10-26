<script lang="ts">
  /**
   * StockControl PWA — WorkspaceModal.svelte
   * Zero-friction kitchen workspace switcher & operator alias modal.
   * Features:
   * - Quick kitchen workstation chips (cocina-principal, cuarto-frio, pasteleria, etc.)
   * - Real-time auto-slug sanitization preview (NFD accent removal, lowercase, hyphenation)
   * - Operator alias picker with brigade suggestions (Chef, Cocinero, Bodeguero, etc.)
   * - Persistent storage to localStorage & reactive workspaceStore
   * - Touch-friendly ergonomics (targets >= 44x44px, spacing >= 8px)
   * - Multi-tab real-time sync notification
   *
   * Path: src/lib/components/WorkspaceModal.svelte
   */

  import {
    workspaceStore,
    sanitizeWorkspaceId,
    sanitizeOperatorAlias,
    DEFAULT_WORKSPACE,
    DEFAULT_OPERATOR
  } from '$lib/stores/workspaceStore';
  import { connectivityStore } from '$lib/stores/connectivityStore';
  import { toastStore } from '$lib/stores/toastStore';

  interface Props {
    open?: boolean;
    onClose?: () => void;
  }

  let {
    open = false,
    onClose
  }: Props = $props();

  // Local Form State initialized from active workspaceStore
  let workspaceInput = $state($workspaceStore.workspaceId);
  let operatorInput = $state($workspaceStore.operatorAlias);

  // Synchronize local input whenever modal opens
  $effect(() => {
    if (open) {
      workspaceInput = $workspaceStore.workspaceId;
      operatorInput = $workspaceStore.operatorAlias;
    }
  });

  // Real-time live sanitization
  const sanitizedWorkspaceSlug = $derived(sanitizeWorkspaceId(workspaceInput));
  const sanitizedOperator = $derived(sanitizeOperatorAlias(operatorInput));
  const hasSlugModification = $derived(
    workspaceInput.trim().length > 0 && workspaceInput.trim() !== sanitizedWorkspaceSlug
  );

  // Standard Commercial Kitchen Stations
  interface KitchenStation {
    id: string;
    label: string;
    icon: string;
    area: string;
  }

  const KITCHEN_STATIONS: KitchenStation[] = [
    { id: 'cocina-principal', label: 'Cocina Principal', icon: '🍳', area: 'Producción general' },
    { id: 'cuarto-frio', label: 'Cuarto Frío', icon: '🥩', area: 'Carnicería y pescados' },
    { id: 'pasteleria', label: 'Pastelería', icon: '🥐', area: 'Panes y repostería' },
    { id: 'bodega-central', label: 'Bodega Central', icon: '📦', area: 'Abarrotes y secos' },
    { id: 'linea-caliente', label: 'Línea Caliente', icon: '🔥', area: 'Servicio y despacho' },
    { id: 'bar', label: 'Bar & Cafetería', icon: '🍹', area: 'Bebidas e insumos' }
  ];

  // Brigade Role Suggestions
  const OPERATOR_ROLES = [
    'Chef Ejecutivo',
    'Sous Chef',
    'Cocinero Turno Mañana',
    'Cocinero Turno Tarde',
    'Turno Noche',
    'Pastelero',
    'Bodeguero',
    'Ayudante de Cocina'
  ];

  function selectKitchenStation(id: string) {
    workspaceInput = id;
  }

  function selectOperatorRole(role: string) {
    operatorInput = role;
  }

  function handleSave() {
    const finalWorkspace = workspaceStore.setWorkspace(workspaceInput);
    const finalOperator = workspaceStore.setOperator(operatorInput);

    toastStore.success(`Conectado a [${finalWorkspace}] como "${finalOperator}"`);
    if (onClose) onClose();
  }

  function handleReset() {
    workspaceStore.reset();
    workspaceInput = DEFAULT_WORKSPACE;
    operatorInput = DEFAULT_OPERATOR;
    toastStore.info('Espacio y operador restablecidos a valores por defecto');
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open && onClose) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="ws-modal-title"
  >
    <div class="modal-card">
      <!-- Header -->
      <header class="modal-header">
        <div class="header-titles">
          <h2 id="ws-modal-title" class="modal-title">Cocina y Operador</h2>
          <span class="modal-subtitle">Conexión colaborativa multi-dispositivo sin contraseñas</span>
        </div>
        <button
          type="button"
          class="btn-close"
          onclick={onClose}
          aria-label="Cerrar ventana"
        >
          ✕
        </button>
      </header>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- Station / Kitchen Section -->
        <section class="section-block">
          <div class="section-header">
            <label for="ws-input" class="field-title">
              <span>Código de Cocina / Estación</span>
              <span class="req">*</span>
            </label>
            <span class="pill-current">
              Actual: <strong>{$workspaceStore.workspaceId}</strong>
            </span>
          </div>

          <!-- Direct Input -->
          <input
            id="ws-input"
            type="text"
            class="text-input"
            placeholder="ej. cocina-principal, sucursal-norte..."
            bind:value={workspaceInput}
            autocomplete="off"
            spellcheck="false"
          />

          <!-- Live Auto-Slug Sanitization Preview -->
          {#if hasSlugModification}
            <div class="slug-preview" role="status" aria-live="polite">
              <span class="preview-label">Identificador normalizado en Firestore:</span>
              <code class="slug-badge">{sanitizedWorkspaceSlug}</code>
            </div>
          {/if}

          <!-- Quick Kitchen Station Pills -->
          <div class="quick-pills-label">Estaciones recomendadas:</div>
          <div class="stations-grid" role="group" aria-label="Estaciones rápidas de cocina">
            {#each KITCHEN_STATIONS as station}
              {@const isSelected = sanitizedWorkspaceSlug === station.id}
              <button
                type="button"
                class="station-card"
                class:active={isSelected}
                onclick={() => selectKitchenStation(station.id)}
                aria-pressed={isSelected}
              >
                <span class="station-icon">{station.icon}</span>
                <div class="station-info">
                  <span class="station-label">{station.label}</span>
                  <span class="station-area">{station.area}</span>
                </div>
              </button>
            {/each}
          </div>
        </section>

        <!-- Operator Identity Section -->
        <section class="section-block">
          <div class="section-header">
            <label for="op-input" class="field-title">
              <span>Tu Nombre / Alias de Operador</span>
              <span class="req">*</span>
            </label>
            <span class="pill-current">
              Actual: <strong>{$workspaceStore.operatorAlias}</strong>
            </span>
          </div>

          <!-- Operator Input -->
          <input
            id="op-input"
            type="text"
            class="text-input"
            placeholder="ej. Juan - Cocinero, Marta - Bodega..."
            bind:value={operatorInput}
            autocomplete="name"
          />

          <!-- Role Suggestion Pills -->
          <div class="quick-pills-label">Roles y turnos frecuentes:</div>
          <div class="roles-wrap" role="group" aria-label="Sugerencias de rol">
            {#each OPERATOR_ROLES as role}
              {@const isSelected = operatorInput.trim().toLowerCase() === role.toLowerCase()}
              <button
                type="button"
                class="role-pill"
                class:active={isSelected}
                onclick={() => selectOperatorRole(role)}
                aria-pressed={isSelected}
              >
                {role}
              </button>
            {/each}
          </div>
        </section>

        <!-- Collaboration & Status Info Banner -->
        <div class="collab-info-banner">
          <div class="banner-icon">📡</div>
          <div class="banner-text">
            <strong>Sincronización en tiempo real activa</strong>
            <p>
              Cualquier dispositivo conectado a <code>{sanitizedWorkspaceSlug}</code> verá altas, consumos y mermas en milisegundos con auditoría firmada por <code>{sanitizedOperator}</code>.
            </p>
          </div>
        </div>

        <!-- Diagnostic Device Info -->
        <div class="device-diagnostics">
          <span class="diag-item">
            <span class="status-dot" class:online={$connectivityStore.online}></span>
            <span>{$connectivityStore.online ? 'Conectado a Firebase' : 'Modo Offline (Almacenamiento Local)'}</span>
          </span>
          <span class="diag-item diag-dev" title={`Dispositivo: ${$workspaceStore.deviceId}`}>
            ID: {$workspaceStore.deviceId.slice(0, 12)}...
          </span>
        </div>
      </div>

      <!-- Footer Actions -->
      <footer class="modal-footer">
        <button
          type="button"
          class="btn-reset"
          onclick={handleReset}
          title="Restablecer cocina y operador por defecto"
        >
          Valores por defecto
        </button>
        <div class="primary-actions">
          <button
            type="button"
            class="btn-cancel"
            onclick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-save"
            onclick={handleSave}
          >
            Guardar y Conectar
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* Modal Overlay */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(38, 33, 28, 0.7);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    max-height: 90dvh;
    background-color: var(--color-surface, #ffffff);
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.32);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes popIn {
    from { transform: scale(0.96); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px 20px;
    border-bottom: 1px solid var(--color-line, #eadfd2);
    background-color: #faf5ee;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-ink, #302821);
    letter-spacing: -0.01em;
  }

  .modal-subtitle {
    font-size: 0.8rem;
    color: var(--color-muted, #7c7168);
  }

  .btn-close {
    min-width: var(--touch-min, 44px);
    min-height: var(--touch-min, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--color-muted, #7c7168);
    font-size: 1.2rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .btn-close:active {
    background-color: #ede2d5;
  }

  /* Body */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .field-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-ink, #302821);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .req {
    color: var(--color-red, #b84035);
  }

  .pill-current {
    font-size: 0.75rem;
    color: var(--color-muted, #7c7168);
    background-color: #f5ede4;
    padding: 3px 8px;
    border-radius: 8px;
  }

  .text-input {
    width: 100%;
    min-height: 48px;
    padding: 10px 14px;
    font-size: 1rem;
    font-family: inherit;
    color: var(--color-ink, #302821);
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    transition: border-color 0.15s, box-shadow 0.15s;
    touch-action: manipulation;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-brown, #75472f);
    box-shadow: 0 0 0 3px rgba(117, 71, 47, 0.15);
    background-color: #ffffff;
  }

  /* Slug Sanitization Preview */
  .slug-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background-color: #f7f2ea;
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--color-muted, #7c7168);
  }

  .preview-label {
    flex-shrink: 0;
  }

  .slug-badge {
    background-color: var(--color-brown-light, #9a623e);
    color: #ffffff;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-family: monospace;
    font-size: 0.82rem;
  }

  .quick-pills-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-muted, #7c7168);
    margin-top: 2px;
  }

  /* Station Grid */
  .stations-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .station-card {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background-color: #fbf8f4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    touch-action: manipulation;
    text-align: left;
  }

  .station-card:hover {
    background-color: #f5ede4;
  }

  .station-card.active {
    background-color: var(--color-brown, #75472f);
    border-color: var(--color-brown-dark, #69412d);
    color: #ffffff;
    box-shadow: 0 3px 10px rgba(117, 71, 47, 0.25);
  }

  .station-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .station-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .station-label {
    font-size: 0.85rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .station-area {
    font-size: 0.7rem;
    color: var(--color-muted, #7c7168);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .station-card.active .station-area {
    color: #ded1c4;
  }

  /* Operator Roles Wrap */
  .roles-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .role-pill {
    min-height: var(--touch-min, 44px);
    padding: 8px 14px;
    background-color: #f7f2eb;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 20px;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--color-ink, #302821);
    cursor: pointer;
    transition: all 0.15s ease;
    touch-action: manipulation;
  }

  .role-pill:hover {
    background-color: #efe5d9;
  }

  .role-pill.active {
    background-color: #3b2c23;
    border-color: #271c16;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(39, 28, 22, 0.25);
  }

  /* Collaboration Info Banner */
  .collab-info-banner {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    background-color: #fdfaf5;
    border: 1.5px dashed var(--color-line, #eadfd2);
    border-radius: 12px;
    font-size: 0.82rem;
    color: var(--color-ink, #302821);
  }

  .banner-icon {
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .banner-text strong {
    display: block;
    margin-bottom: 2px;
    color: var(--color-brown, #75472f);
  }

  .banner-text p {
    margin: 0;
    line-height: 1.35;
    color: var(--color-muted, #7c7168);
  }

  .banner-text code {
    background-color: #ede2d5;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.8rem;
    color: var(--color-brown-dark, #69412d);
  }

  /* Diagnostics */
  .device-diagnostics {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-muted, #7c7168);
    padding: 2px 4px;
  }

  .diag-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--color-red, #b84035);
  }

  .status-dot.online {
    background-color: var(--color-green, #4c7860);
  }

  .diag-dev {
    font-family: monospace;
    opacity: 0.8;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-top: 1px solid var(--color-line, #eadfd2);
    background-color: #faf5ee;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn-reset {
    min-height: var(--touch-min, 44px);
    background: transparent;
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    padding: 6px 8px;
    text-decoration: underline;
    touch-action: manipulation;
  }

  .btn-reset:hover {
    color: var(--color-brown, #75472f);
  }

  .primary-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .btn-cancel {
    min-height: 48px;
    min-width: 90px;
    background-color: #f5ede4;
    border: 1.5px solid var(--color-line, #eadfd2);
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-muted, #7c7168);
    cursor: pointer;
    touch-action: manipulation;
    padding: 0 16px;
  }

  .btn-cancel:active {
    background-color: #ebe0d4;
  }

  .btn-save {
    min-height: 48px;
    background-color: var(--color-brown, #75472f);
    border: none;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 800;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(117, 71, 47, 0.25);
    transition: transform 0.1s ease, background-color 0.15s;
    touch-action: manipulation;
    padding: 0 20px;
  }

  .btn-save:active {
    transform: scale(0.98);
    background-color: var(--color-brown-dark, #69412d);
  }
</style>
