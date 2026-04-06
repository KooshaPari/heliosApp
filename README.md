# heliosApp

heliosApp is a Module Federation remote module for the Phenotype ecosystem. It provides exportable components, pages, and utilities that can be dynamically loaded by a Module Federation host application.

## Architecture

This application follows Hexagonal Architecture principles:

- **Domain**: React components and hooks
- **Ports**: Module Federation exposes
- **Adapters**: Vite + React

## Features

- **Module Federation**: Configured as a remote module exposing Dashboard, Components, and Hooks
- **Standalone Mode**: Can run independently on port 3001
- **Federated Mode**: Can be loaded by a host application
- **TypeScript**: Full TypeScript support with strict type checking
- **Dual Mode**: Supports both standalone (`bun dev`) and federated (`bun dev:remote`) modes

## Project Structure

```
heliosApp/
├── src/
│   ├── components/        # Reusable components (Card, Button, Header)
│   ├── pages/            # Page components (Dashboard)
│   ├── hooks/            # Custom React hooks (useLocalStorage, useFetch)
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── index.html            # HTML entry point
├── vite.config.ts        # Vite + Module Federation config
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Quick Start

### Prerequisites

- Node.js >=22
- Bun >=1.1.42 (package manager)

### Installation

```bash
bun install
```

### Development

Run in standalone mode (default):

```bash
bun run dev
```

App will be available at `http://localhost:${VITE_PORT:-3001}`

### Federated Mode

Run in federated mode (for loading by a host):

```bash
bun run dev:remote
```

This serves the remote entry point at `http://localhost:${VITE_PORT:-3001}/remoteEntry.js`

### Local Process Compose

Run the remote in a reusable local process manager:

```bash
process-compose -f process-compose.yaml up
```

Useful overrides:

```bash
VITE_PORT=3311 HELIOS_APP_DEV_SCRIPT=dev process-compose -f process-compose.yaml up
```

This repo does not yet contain a verified live AuthKit/WorkOS implementation. Treat auth setup as
an explicit follow-on integration task rather than a config-only toggle.

### Build

Build for production (standalone):

```bash
bun run build
```

Build for federation (remote):

```bash
bun run build:remote
```

Outputs go to `dist/` or `dist-remote/` respectively.

## Module Federation Configuration

### Exposed Modules

The following modules are exported from this remote:

| Module | Path | Description |
|--------|------|-------------|
| `./Dashboard` | `src/pages/Dashboard.tsx` | Dashboard page component |
| `./Components` | `src/components/index.tsx` | Reusable components library |
| `./Hooks` | `src/hooks/index.ts` | Custom React hooks |

### Shared Dependencies

React and React DOM are shared with singleton mode to ensure only one version is loaded:

- `react` (v18+)
- `react-dom` (v18+)

### Consuming from Host

In your host application, import modules like:

```typescript
import Dashboard from 'heliosApp/Dashboard';
import { Card, Button, Header } from 'heliosApp/Components';
import { useLocalStorage, useFetch } from 'heliosApp/Hooks';
```

## Development

### Linting

```bash
bun run lint
```

Uses oxlint for code quality.

### Formatting

Check formatting:

```bash
bun run format:check
```

Fix formatting:

```bash
bun run format
```

Uses Prettier with opinionated settings.

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` | Run dev server in standalone mode |
| `dev:remote` | Run dev server in federated mode |
| `build` | Build for production (standalone) |
| `build:remote` | Build for production (federated) |
| `preview` | Preview production build |
| `lint` | Run linter |
| `format` | Format code with Prettier |
| `format:check` | Check code formatting |

## Integration with AgilePlus

This repository is part of the Phenotype ecosystem and tracked in AgilePlus:

- **Spec**: `005-heliosapp-completion`
- **Reference**: https://github.com/KooshaPari/AgilePlus

## Stack

- **Runtime**: TypeScript 5.6+, React 18.3+
- **Bundler**: Vite 6.0+
- **Linter**: oxlint 0.6+
- **Formatter**: Prettier 3.5+
- **Module Federation**: @module-federation/enhanced
- **Package Manager**: Bun 1.1.42+

## License

See LICENSE in repository root.

## Related

- [AgilePlus](https://github.com/KooshaPari/AgilePlus) - Task and project management
- [heliosCLI](../heliosCLI) - Command-line interface for Helios
- [Phenotype](https://github.com/KooshaPari/phenotype-infrakit) - Phenotype ecosystem
