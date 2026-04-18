# Architecture Diagrams

This repository includes a LikeC4 scaffold under `architecture/likec4/`.

- `architecture/likec4/specification.c4` defines the element kinds.
- `architecture/likec4/views.c4` is generated on every sync from the inferred workspace structure.
- `architecture/likec4/generated/model.c4` is generated from recursive workspace discovery, imports, workflow commands, and external URL references.

Local commands:

- `npm run arch:sync` regenerates the model and views from the current codebase.
- `npm run arch:validate` validates the LikeC4 workspace.
- `npm run arch:build` builds a shareable single-file site in `dist/architecture-site`.
- `npm run arch:export:mermaid` exports Mermaid files to `dist/architecture-mermaid`.
- `npm run arch:serve` regenerates the model and starts a local LikeC4 preview server.
