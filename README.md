# Zotero Kentridge

[![zotero target version](https://img.shields.io/badge/Zotero-8-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

Kentridge is a Zotero plugin for fetching and applying bibliographic metadata by title.

## Why “Kentridge”?

Kentridge is the location of the National University of Singapore, where the project author is doing a PhD.

It also exists for a practical reason: Zotero's built-in metadata coverage is not always enough for many computer science venues, especially conference-heavy ecosystems (for example, parts of the USENIX series). Kentridge helps fill that gap by querying external scholarly sources and applying structured metadata back to your items.

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

## Installation (Release)

1. Open the latest release page: [Releases](https://github.com/brant-ruan/zotero-kentridge/releases)
2. Download the `.xpi` file (for example: `zotero-kentridge.xpi`).
3. In Zotero, open `Tools -> Plugins`.
4. Click the gear icon in the plugin manager, then choose `Install Plugin From File...`.
5. Select the downloaded `.xpi` file and restart Zotero when prompted.

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
