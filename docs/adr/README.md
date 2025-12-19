# Architecture Decision Records (ADR)

Este directorio contiene los registros de decisiones arquitectónicas para el proyecto MCP Server EventKit.

## Decisiones Tomadas

| ADR | Decisión | Estado |
|-----|----------|--------|
| [0001](./0001-use-native-eventkit-integration.md) | Usar integración nativa con EventKit (no SQLite standalone) | ✅ Aceptado |
| [0002](./0002-typescript-with-bun-ffi-bridge.md) | TypeScript + Bun FFI para bridge con Swift | ✅ Aceptado |

### Resumen

El proyecto usa **integración nativa con EventKit de macOS** (ADR 0001) implementada mediante un **servidor TypeScript/Bun que se comunica con Swift via Bun FFI** (ADR 0002).

```
Claude Desktop → MCP Server (TypeScript/Bun) → FFI → Swift → EventKit → Reminders.app
```

## ¿Qué es un ADR?

Un Architecture Decision Record documenta una decisión arquitectónica importante junto con su contexto y consecuencias.

### Estructura

- **Contexto**: Situación que requiere una decisión
- **Decisión**: La decisión tomada
- **Justificación**: Por qué se tomó esta decisión
- **Consecuencias**: Impacto positivo y negativo
- **Alternativas**: Opciones consideradas y por qué se rechazaron

### Cuándo Crear un ADR

Crea un ADR cuando:
- Tomas una decisión arquitectónica significativa
- Eliges entre múltiples opciones técnicas viables
- La decisión afecta múltiples componentes
- Futuras personas necesitarán entender el "por qué"

**No necesitas un ADR para:** decisiones triviales, convenciones de código, o decisiones fácilmente reversibles.

## Crear Nuevo ADR

```bash
cp adr/template.md adr/NNNN-titulo-descriptivo.md
```

Ver [template.md](./template.md) para la estructura.

## Referencias

- [PRD del Proyecto](../PRD.md) - Contiene detalles de implementación
- [ADR by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
