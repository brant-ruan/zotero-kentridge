# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, but condensed to match this repository's current release history.

## [0.0.7] - 2026-05-18

### Changed

- Added Zotero 9.0.x compatibility by extending the add-on manifest and generated update manifests to `strict_max_version: 9.0.*`.
- Updated the build toolchain from `zotero-plugin-scaffold 0.8.2` to `0.8.6` so local builds work with current Node.js releases.
- Updated GitHub Actions workflows to Node 24 to match the scaffold runtime requirements.
- Strengthened the startup test to assert full plugin initialization during Zotero startup.
- Updated the README with release asset and compatibility details.

## [0.0.6] - 2026-02-26

### Added

- Added a context-menu action to copy a Zotero item link without opening a prompt.

## [0.0.5] - 2026-02-24

### Added

- Added batch assignment support for selected parent items.

## [0.0.4] - 2026-02-24

### Changed

- Refined project assets and icon packaging for the released plugin.

## [0.0.3] - 2026-02-09

### Added

- Added configurable CoRR demotion in metadata result ranking.

## [0.0.2] - 2026-02-08

### Added

- Added a local release script for versioning, tagging, and publishing.

## [0.0.1] - 2026-02-08

### Added

- Published the initial GitHub-backed plugin release workflow and baseline plugin packaging.
