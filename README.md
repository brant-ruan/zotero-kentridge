# Zotero Kentridge

[![zotero target version](https://img.shields.io/badge/Zotero-8-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

Kentridge is a Zotero plugin for fetching and applying bibliographic metadata by title.

## Features

- Right-click menu in library items: `Kentridge -> Fetch Metadata by Title`
- Provider-based metadata fetching (currently DBLP)
- Batch mode for multiple selected items, with per-item candidate selection
- Candidate result dialog with readable multi-line cards
- Two update strategies:
  - `Replace existing metadata`
  - `Supplement existing metadata`
- Provider settings panel in Zotero Preferences

## Current Provider

- DBLP (`https://dblp.org/search/publ/api`)

DBLP results are normalized before applying:
- HTML entities are decoded (e.g. `&quot;`)
- trailing title period is removed when needed
- DBLP author suffixes like `0001` / `0002` are removed

## Installation (Development)

1. Install dependencies:

```bash
npm install
```

2. Copy environment config:

```bash
cp .env.example .env
```

3. Set Zotero executable/profile in `.env`.
4. Start development mode:

```bash
npm start
```

## Usage

1. Select one or more regular bibliography items in Zotero library.
2. Right click item(s): `Kentridge -> Fetch Metadata by Title`.
3. For each item, choose one returned metadata candidate and click `Apply`.
4. If some items fail to fetch metadata, a summary dialog is shown at the end.

## Preferences

Open `Zotero Preferences -> Kentridge`.

### Data Providers

- Enable/disable each provider.
- Enter API key for providers that require it (future providers).

### Metadata Update Strategy

- `Replace existing metadata`: overwrite existing values with selected metadata.
- `Supplement existing metadata`: only fill empty fields.

## Build

```bash
npm run build
```

Build artifacts are generated under `.scaffold/build/`.

## Repository

- Source: [https://github.com/brant-ruan/zotero-kentridge](https://github.com/brant-ruan/zotero-kentridge)
- Issues: [https://github.com/brant-ruan/zotero-kentridge/issues](https://github.com/brant-ruan/zotero-kentridge/issues)

## License

AGPL-3.0-or-later
