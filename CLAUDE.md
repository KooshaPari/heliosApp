# heliosApp - Claude Code Instructions

## Project Overview

**heliosApp** is a Module Federation remote module for the Phenotype ecosystem. It exposes reusable React components, pages, and hooks that can be dynamically loaded by host applications.

## Current Checkout State

- **Branch**: `feat/fix-typescript-vite-federation`
- **Worktree**: `/Users/kooshapari/CodeProjects/Phenotype/repos/heliosApp`
- **Primary focus**: keep the federation remote stable while the host integration lane is validated
- **Next step**: verify the remote build path and host-facing expose map before adding new surface area

## Architecture

### Hexagonal Architecture Pattern

```
Domain (React Components, Hooks)
  ↓
Ports (Module Federation Exposes)
  ↓
Adapters (Vite, Deployment)
```

### Layers

- **Domain**: Dashboard page, Card/Button/Header components, custom hooks
- **Ports**: Module Federation exposes (Dashboard, Components, Hooks)
- **Adapters**: Vite bundler, React DOM renderer, federation config

## Key Technologies

| Category | Technology | Version |
|----------|-----------|---------|
| **Runtime** | TypeScript | 5.6+ |
| **Framework** | React | 18.3+ |
| **Bundler** | Vite | 6.0+ |
| **Federation** | @module-federation/enhanced | 0.7+ |
| **Package Manager** | Bun | 1.1.42+ |
| **Linter** | oxlint | 0.6+ |
| **Formatter** | Prettier | 3.5+ |

## Project Structure

```
heliosApp/
├── src/
│   ├── components/
│   │   ├── Card.tsx          # Reusable card component
│   │   ├── Button.tsx        # Reusable button component
│   │   ├── Header.tsx        # Reusable header component
│   │   └── index.tsx         # Component exports
│   ├── pages/
│   │   └── Dashboard.tsx     # Dashboard page (EXPOSED)
│   ├── hooks/
│   │   ├── useLocalStorage.ts  # Storage hook
│   │   ├── useFetch.ts        # Fetch hook
│   │   └── index.ts          # Hook exports (EXPOSED)
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   ├── App.tsx               # Root component
│   ├── main.tsx              # Entry point
│   └── index.css             # Global styles
├── vite.config.ts            # Vite + Module Federation config
├── tsconfig.json             # TypeScript strict configuration
├── package.json              # Dependencies and scripts
├── README.md                 # Project documentation
└── index.html                # HTML entry point
```

## Module Federation Configuration

### Exposed Modules

From `vite.config.ts`:

```typescript
exposes: {
  './Dashboard': './src/pages/Dashboard.tsx',
  './Components': './src/components/index.tsx',
  './Hooks': './src/hooks/index.ts',
}
```

### Shared Dependencies

```typescript
shared: {
  react: {
    singleton: true,
    requiredVersion: '^18.0.0',
    strictVersion: false,
  },
  'react-dom': {
    singleton: true,
    requiredVersion: '^18.0.0',
    strictVersion: false,
  },
}
```

## Development Workflow

### Installation

```bash
bun install
```

### Development Modes

**Standalone (default)**:
```bash
bun run dev
```
- Port: 3001
- Full development experience
- Use for isolated feature work

**Federated (for host integration)**:
```bash
bun run dev:remote
```
- Serves remote entry
- Output: `dist-remote/`
- Use when testing with host app

### Building

**Standalone build**:
```bash
bun run build
```
Output: `dist/`

**Federated build**:
```bash
bun run build:remote
```
Output: `dist-remote/`

### Code Quality

**Lint**:
```bash
bun run lint
```

**Format check**:
```bash
bun run format:check
```

**Format fix**:
```bash
bun run format
```

## Design Principles

| Principle | Application |
|-----------|-------------|
| **SOLID** | Small, focused components with single responsibility |
| **DRY** | Hooks abstract common patterns (storage, fetching) |
| **KISS** | Minimal, understandable API surface |
| **YAGNI** | Only export what's needed by hosts |
| **Law of Demeter** | Components don't reach into sibling state |

## Integration Guidelines

### For Host Applications

1. **Configure Remote in Host**:
   ```typescript
   remotes: {
     heliosApp: 'heliosApp@http://localhost:3001/remoteEntry.js'
   }
   ```

2. **Import and Use**:
   ```typescript
   import Dashboard from 'heliosApp/Dashboard';
   import { Card, Button } from 'heliosApp/Components';
   import { useLocalStorage } from 'heliosApp/Hooks';
   ```

3. **Ensure Shared React**:
   - Host must have React 18.0.0+
   - React configured as singleton in host federation config

## Adding New Components

### Component Template

```typescript
// src/components/NewComponent.tsx
import React from 'react';

interface NewComponentProps {
  // Props...
}

export default function NewComponent({ ...props }: NewComponentProps) {
  return <div>...</div>;
}
```

### Export from Library

```typescript
// src/components/index.tsx
export { default as NewComponent } from './NewComponent';
```

## Adding New Hooks

### Hook Template

```typescript
// src/hooks/useNewHook.ts
import { useState } from 'react';

export function useNewHook(): ReturnType {
  // Implementation...
}
```

### Export from Library

```typescript
// src/hooks/index.ts
export { useNewHook } from './useNewHook';
```

## Testing Strategy

- **Unit Tests**: Test individual components and hooks
- **Integration Tests**: Test component composition
- **Manual Tests**: Test federation loading from host
- **Performance**: Monitor bundle size, HMR performance

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Lint check
- Build (both modes)
- Type check

## Troubleshooting

### Port 3001 Already in Use

Edit `vite.config.ts`:
```typescript
server: {
  port: 3002, // Change port
  hmr: { port: 3002 }
}
```

### React Version Conflicts

Ensure host has React 18.0.0+. Check `package.json` and federation config.

### Remote Not Loading

1. Verify heliosApp is running
2. Check remoteEntry.js exists
3. Verify URL in host federation config

## Dependency Preferences (Enforced)

- **Bleeding-edge**: Always use latest stable versions
- **Wrap over handroll**: Prefer existing libraries
- **Rich UI**: Use Radix/shadcn when needed (future)
- **No manual utilities**: Use established packages

## Related Projects

- **AgilePlus**: Main host application (planned integration)
- **heliosCLI**: Command-line interface sibling
- **phenotype-infrakit**: Ecosystem infrastructure
- **Phenotype**: Organization project portfolio

## Governance

- **Branch discipline**: Feature branches, PR review required
- **Commit discipline**: Small, focused commits
- **Documentation**: Keep README and CLAUDE.md synchronized
- **Quality**: No merge without passing CI

## References

- Module Federation: https://module-federation.io/
- Vite Config: vite.config.ts
- TypeScript Config: tsconfig.json
- GitHub Actions: .github/workflows/
