# Documentation

This directory contains all project documentation organized by type.

## Structure

```
docs/
├── README.md           # This file
├── adr/                # Architecture Decision Records
│   ├── README.md       # ADR index and guidelines
│   ├── template.md     # Template for new ADRs
│   ├── 0001-*.md       # Individual decisions
│   └── ...
└── prd/                # Product Requirements Documents
    └── PRD.md          # Main product requirements
```

## Documentation Types

### Architecture Decision Records (ADR)

Location: `docs/adr/`

ADRs capture important architectural decisions made during the project. Each ADR documents:
- The context and problem
- The decision made
- Consequences (positive and negative)

See [adr/README.md](./adr/README.md) for the full index and how to create new ADRs.

### Product Requirements Documents (PRD)

Location: `docs/prd/`

PRDs define the product vision, features, and requirements:
- [PRD.md](./prd/PRD.md) - Main product requirements document

## Contributing

When adding documentation:

1. **ADRs**: Use the template at `adr/template.md` and follow the numbering convention
2. **PRDs**: Update the existing PRD or create versioned documents for major changes
3. **General docs**: Add to the appropriate subdirectory or create a new one if needed

## Quick Links

- [ADR Index](./adr/README.md)
- [Product Requirements](./prd/PRD.md)
