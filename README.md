# StockControl — Control de Vencimientos Gastronómicos (PWA Móvil)

> **Prototipo actual**: Aplicación Web Progresiva (PWA) *single-file* orientada al control rápido de fechas de caducidad e inventario crítico en cocinas, restaurantes y almacenes gastronómicos.

---

## 📱 Estado Actual del Proyecto

El proyecto actual es un prototipo funcional basado en arquitectura de un solo archivo (**Single-File Web App**), empaquetado para funcionar como **PWA** (Progressive Web App) en teléfonos móviles y tablets sin dependencias externas ni compiladores.

### 📁 Estructura del Repositorio

```text
StockControl_App_Telefono/
├── index.html            # Interfaz completa, estilos CSS y lógica JavaScript unificada
├── manifest.json         # Manifiesto de PWA (nombre, tema, iconos, modo standalone)
├── sw.js                 # Service Worker para funcionamiento offline y caché local
├── LEEME.txt             # Instrucciones básicas de despliegue y uso
├── README.md             # Documentación técnica completa del proyecto
└── assets/               # Recursos gráficos
    ├── logo-stockcontrol.png
    ├── icon-192.png
    └── icon-512.png
```

---

## ⚙️ Funcionalidades Implementadas

1. **Gestión de Inventario (CRUD Local)**:
   - Registro de producto con campos especializados para gastronomía:
     - Nombre, Categoría (Lácteos, Carnes, Pescados/mariscos, Frutas/verduras, Congelados, Abarrotes, Panadería, Salsas, Bebidas, Otros).
     - Cantidad y Unidad de medida (`unidad`, `kg`, `g`, `L`, `ml`, `porción`, `caja`, `paquete`, `botella`).
     - Fechas: Recepción y Vencimiento.
     - Ubicación física de almacenamiento (`Refrigerador`, `Congelador`, `Bodega seca`, `Vitrina`, `Otro`).
     - Metadatos: Lote/código, Proveedor y Observaciones.
   - Edición y eliminación de registros existentes con confirmación.

2. **Cálculo Automático de Caducidades**:
   - Detección reactiva de días restantes hasta el vencimiento:
     - 🔴 **Vencido**: Días negativos (marca cantidad de días transcurridos).
     - 🟠 **Vence hoy / en 3 días**: Alerta crítica inmediata.
     - 🟡 **Vence en 7 días**: Alerta preventiva semanal.
     - 🟢 **Vigente**: Con más de 7 días de vida útil.

3. **Panel de Métricas (Dashboard Superior)**:
   - Contadores en tiempo real de: Total de productos, Vencidos, Vencen en 3 días, Vencen en 7 días.

4. **Búsqueda y Filtros**:
   - Búsqueda en tiempo real por texto (coincidencia en nombre, lote, proveedor y ubicación).
   - Filtro por categoría culinaria.
   - Filtro por estado de riesgo de vencimiento.
   - Ordenamiento automático por fecha de vencimiento más próxima primero.

5. **Persistencia y Portabilidad de Datos**:
   - Persistencia local mediante `localStorage` (clave `stockcontrol_expiry_v1`).
   - **Exportación a CSV**: Formateado con codificación UTF-8 con BOM y separador `;` para apertura directa en Microsoft Excel o Google Sheets.
   - **Copia de Respaldo JSON**: Exportación del archivo completo de registros con timestamp.
   - **Restauración de Respaldo**: Importación directa de archivos JSON con confirmación previa.

6. **Capacidades PWA (Offline & Mobile)**:
   - Web App Manifest configurado en modo `standalone` con orientación `portrait`.
   - Service Worker (`sw.js`) con estrategia Cache-First para cargar sin conexión a internet.
   - Meta etiquetas para iOS (Safari) y Android (Chrome).

---

## 🚀 Cómo Probar Localmente

1. **Prueba rápida en navegador**:
   - Puedes abrir `index.html` directamente en cualquier navegador web de escritorio o móvil.
2. **Prueba completa PWA (Offline + Instalación)**:
   - Las PWAs requieren un contexto seguro (`HTTPS` o `localhost`).
   - Sirve el directorio con cualquier servidor estático local, por ejemplo:
     ```bash
     # Usando Python 3
     python3 -m http.server 8080
     
     # Usando npx serve
     npx serve .
     ```
   - Abre `http://localhost:8080` en Chrome o Edge para ver las opciones de instalación PWA.

---

## 🔍 Limitaciones Técnicas del Prototipo Actual

- **Almacenamiento monodispositivo**: Los datos residen exclusivamente en el `localStorage` del navegador donde se registraron. No hay sincronización en la nube ni entre diferentes miembros del equipo de cocina.
- **Escalabilidad de código**: Toda la lógica (CSS, HTML, JS de persistencia, lógica de negocio y renderizado de DOM) convive en 110 líneas de `index.html`.
- **Falta de escaneo**: No cuenta con lector de código de barras o códigos QR mediante la cámara del móvil.
- **Sin notificaciones push**: No emite alertas proactivas al dispositivo cuando un lote está por vencer a menos que la app esté abierta.
