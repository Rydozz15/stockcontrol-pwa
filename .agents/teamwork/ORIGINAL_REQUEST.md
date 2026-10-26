# Original User Request

## 2026-10-25T20:14:25Z

Desarrollar y transformar el prototipo de StockControl en una Progressive Web App (PWA) colaborativa de nivel profesional para teléfonos y tablets usando Svelte/SvelteKit, con sincronización multi-usuario en tiempo real y persistencia offline sobre Firebase Firestore (100% gratuito) y despliegue continuo en Render Static Site ($0).

Working directory: /home/rydozz/Documents/Proyectos/StockControl_App_Telefono
Integrity mode: development

## Configuration & Environment Resources

- **GitHub Repository**: https://github.com/Rydozz15/stockcontrol-pwa.git (branch main)
- **Deploy Target**: Render Static Site (Build command: npm install && npm run build, Publish directory: build)
- **Firebase Project ID**: stockcontrol-86bb7
- **Firebase Web App Config**:
  - apiKey: AIzaSyBPp8SQcFoVsS0uczaMQNANZ2iFlUf8-bc
  - authDomain: stockcontrol-86bb7.firebaseapp.com
  - projectId: stockcontrol-86bb7
  - storageBucket: stockcontrol-86bb7.firebasestorage.app
  - messagingSenderId: 196470947864
  - appId: 1:196470947864:web:cb6d7cf6684bcb9ac3436d
  - measurementId: G-MNEZ8T6841

## Requirements

### R1. Módulo Colaborativo Multi-usuario y Espacios de Trabajo (Cero Fricción)
Permitir que el equipo de cocina y bodega trabaje en paralelo desde múltiples teléfonos y tablets en tiempo real:
- **Espacios de Trabajo / Códigos de Cocina**: Creación o unión a una cocina mediante un identificador o código de espacio de trabajo compartido (ej. cocina-principal, sucursal-norte), evitando barreras de registro complejo.
- **Identidad del Operador / Alias**: Selector o ingreso rápido de nombre de usuario/rol (ej. "Juan - Cocinero", "Marta - Bodega") guardado en el dispositivo.
- **Trazabilidad y Auditoría de Acciones**: Registro en cada producto de: quién lo registró, quién lo editó y quién lo dio de baja o consumió.
- **Sincronización en Tiempo Real sin Colisiones**: Integración con Firebase Firestore listeners (onSnapshot) para que las altas, bajas y modificaciones se reflejen en milisegundos en todos los dispositivos conectados.

### R2. Arquitectura Limpia y Modularización con SvelteKit (Stack 100% Gratuito)
Estructurar la aplicación bajo principios de Clean Code y Clean Architecture pragmática en SvelteKit:
- **Capa de Dominio (`src/lib/domain/`)**: Lógica pura de cálculo de caducidades, categorización reactiva de estados (vencido, vence hoy / 3 días, vence semana, vigente), reglas de mermas y alertas sin acoplamiento a la interfaz.
- **Capa de Repositorio y Datos (`src/lib/repositories/`)**: Abstracción ProductRepository sobre Firebase Firestore con persistencia offline nativa (enableIndexedDbPersistence), garantizando funcionamiento autónomo si se corta el WiFi en cámaras de frío.
- **Capa de Componentes y Stores (`src/lib/components/` & `src/lib/stores/`)**: Componentes Svelte desacoplados y stores reactivos para inventario, métricas, filtros y estado de conectividad (Online/Offline).

### R3. Experiencia de Usuario (UX) Móvil, Tablet y Ergonomía de Cocina
Diseñar e implementar una experiencia nativa fluida pensada para el ritmo de trabajo gastronómico:
- **Navegación Móvil Ergonómica**: Barra inferior fija (Bottom Navigation Bar) con iconos táctiles para uso con una sola mano: [Inventario / Vencimientos], [Escáner de Cámara], [Alertas Críticas], [Historial / Ajustes].
- **Acción Rápida (FAB)**: Botón flotante siempre visible para registrar productos rápidamente.
- **Atajos de Caducidad Rápida**: Botones de un toque para fechas comunes (+2 días, +3 días, +1 semana, +1 mes) para evitar abrir el calendario en cada registro.
- **Flujo de Consumo y Mermas (1 Tap)**: Botones directos en la tarjeta para "Consumir unidad" o "Descartar por merma/vencimiento", alimentando un historial de desperdicios.
- **Escáner de Código de Barras y QR con Cámara**: Lector de cámara integrado (mediante Barcode Detection API / librería de escaneo web) para autocompletar o localizar productos rápidamente.
- **Diseño Adaptativo para Tablet (Split-Screen)**: En pantallas medianas/grandes, distribución dividida: panel lateral de lista/métricas y panel principal de detalle/edición.
- **Soporte de Zonas Seguras**: Adaptado a safe-area-inset para evitar solapes con el notch o barras de gestos de Android e iOS.

### R4. Configuración PWA Nativa y Despliegue $0 en Render
Garantizar la experiencia de "seudo-aplicación" instalable y despliegue continuo gratuito:
- Compilación estática con @sveltejs/adapter-static para despliegue como Render Static Site (costo $0, HTTPS automático, sin suspensiones por inactividad).
- Manifiesto PWA (manifest.json) completo con iconos, temas gastronómicos y modo standalone.
- Service Worker optimizado para funcionamiento offline y caché de recursos estáticos.
- Respaldo de contingencia: Exportación e importación en CSV (UTF-8 con BOM para Excel) y JSON.
- Ejecutar commit y push a la rama main de https://github.com/Rydozz15/stockcontrol-pwa.git para activar el build en Render.

## Acceptance Criteria

### Colaboración y Sincronización
- [ ] Múltiples dispositivos conectados al mismo código de cocina ven los cambios de inventario en tiempo real sin recargar la página.
- [ ] Cada movimiento (alta, edición, consumo, descarte) registra el alias del operador y fecha/hora.
- [ ] En modo avión (sin internet), la aplicación permite agregar y modificar productos; al recuperar conexión, se sincroniza automáticamente con Firebase.

### Usabilidad Móvil y Hardware
- [ ] El escáner de cámara detecta códigos estándar (EAN-13, QR) y busca o precarga la ficha del producto.
- [ ] La interfaz dispone de navegación inferior accesible con el pulgar y objetivos táctiles de al menos 44x44px.
- [ ] En tablets (pantalla >= 768px), la vista cambia a distribución dividida (split-screen).

### Calidad de Código y Despliegue
- [ ] Código modularizado en carpetas de dominio, repositorios, stores y componentes.
- [ ] El proyecto compila limpiamente (npm run build) para sitio estático.
- [ ] Configuración lista para Render (render.yaml o script de build verificado).
- [ ] Costo de infraestructura total equivalente a $0 USD/mes.
- [ ] Código subido y sincronizado en el repositorio remoto GitHub en la rama main.

## Follow-up — 2026-10-26T00:49:36Z

Por favor continúa con la ejecución. El servidor se reinició y el usuario nos ha pedido expresamente retomar el trabajo.
Estado verificado:
- svelte-check: 0 errores y 0 warnings.
- E2E Tests: 302/302 tests aprobados.
- Hito M3: worker_m3 finalizó su handoff exitosamente.

Por favor prosigue con la compuerta de revisión/auditoría del Hito M3 y luego avanza de inmediato al Hito M4 (cámara/escáner, PWA manifest/Service Worker, contingencia CSV/JSON y despliegue/push a GitHub para Render).
