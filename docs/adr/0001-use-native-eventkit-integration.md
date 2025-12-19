# ADR 0001: Usar Integración Nativa con EventKit de macOS

**Estado:** Aceptado

**Fecha:** 2025-12-19

**Decisores:** Equipo de desarrollo

---

## Contexto

Necesitamos decidir cómo implementar el servidor MCP para gestión de recordatorios. El requisito principal del usuario es que los recordatorios creados desde Claude "se vean reflejados" en el sistema de recordatorios de macOS/iOS.

Existen dos enfoques fundamentales:

1. **Implementación Standalone**: Replicar el modelo de datos de EventKit en una base de datos SQLite propia, sin conexión al sistema nativo
2. **Integración Nativa**: Conectarse directamente a EventKit de macOS para interactuar con la aplicación Reminders del sistema

## Decisión

**Hemos decidido usar integración nativa con EventKit de macOS** en lugar de una implementación standalone con base de datos propia.

## Justificación

### Ventajas

1. **Sincronización Real**
   - Los recordatorios creados desde Claude aparecen inmediatamente en Reminders.app
   - Los cambios en Reminders.app son visibles para Claude
   - Sincronización automática con iCloud y dispositivos iOS

2. **Ecosistema Apple**
   - Aprovecha notificaciones del sistema, Siri, y widgets
   - Integración con Calendar.app para recordatorios con fecha
   - Soporte nativo de recurrencias complejas

3. **Confiabilidad**
   - EventKit es una API madura y estable
   - Manejo robusto de zonas horarias y recurrencias
   - Persistencia garantizada por el sistema

4. **Cumple el Requisito Principal**
   - El usuario requiere que los recordatorios "se vean reflejados" en el sistema
   - No es solo modelar datos como EventKit, sino integrarse con él

### Desventajas Aceptadas

1. **Plataforma Específica**
   - Solo funciona en macOS
   - No portable a Linux/Windows
   - **Mitigación**: Es aceptable para el caso de uso objetivo

2. **Requiere Permisos del Sistema**
   - El usuario debe autorizar acceso a Reminders
   - **Mitigación**: Flujo estándar de macOS, bien documentado

3. **Dependencia del Sistema**
   - Requiere macOS 10.8+
   - **Mitigación**: EventKit es API estable desde hace años

## Opciones Consideradas

### Opción A: Implementación Standalone ❌ (Rechazada)

**Pros:**
- Multiplataforma (Linux, Windows, macOS)
- Simple de implementar con SQLite
- No requiere permisos del sistema

**Contras:**
- No cumple con el requisito de "reflejarse" en Reminders.app
- Crea silo de datos separado del sistema
- Sin sincronización iCloud
- El usuario tendría dos sistemas de recordatorios separados

**Por qué se rechazó:** No cumple con el objetivo principal del proyecto.

---

### Opción B: Integración Nativa con EventKit ✅ (Seleccionada)

**Pros:**
- Sincronización bidireccional con Reminders.app
- iCloud sync automático a todos los dispositivos
- Integración completa con macOS/iOS
- Un solo sistema de recordatorios para el usuario

**Contras:**
- Solo macOS
- Requiere permisos
- Mayor complejidad técnica (bridge a APIs nativas)

**Por qué se seleccionó:** Cumple con el requisito fundamental y proporciona mejor experiencia de usuario.

## Consecuencias

### Positivas

1. ✅ Los recordatorios viven en el sistema nativo del usuario
2. ✅ Sincronización automática con iCloud
3. ✅ Notificaciones nativas del sistema
4. ✅ Interoperabilidad con Siri y widgets

### Negativas

1. ❌ El servidor solo funciona en macOS
2. ❌ Requiere implementar bridge hacia APIs nativas de Apple
3. ❌ El usuario debe otorgar permisos de acceso

### Neutral

1. 📝 La decisión de cómo implementar el bridge (Swift puro vs TypeScript con FFI) se documenta en [ADR 0002](./0002-typescript-with-bun-ffi-bridge.md)

## Métricas de Éxito

1. ✅ Recordatorios creados desde Claude aparecen en Reminders.app
2. ✅ Cambios en Reminders.app son visibles para Claude
3. ✅ Sincronización con iCloud funciona automáticamente
4. ✅ Todas las propiedades de EKReminder se mapean correctamente

## Referencias

- [EventKit Framework - Apple Developer](https://developer.apple.com/documentation/eventkit)
- [EKReminder Class Reference](https://developer.apple.com/documentation/eventkit/ekreminder)
- [ADR 0002: TypeScript + Bun FFI Bridge](./0002-typescript-with-bun-ffi-bridge.md)

## Historial de Cambios

- 2025-12-19: Limpieza del ADR para seguir mejores prácticas (una decisión por ADR)
- 2025-12-19: Decisión inicial de usar integración nativa con EventKit
