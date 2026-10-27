# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-27

### Added
- TypeScript (Node.js) and Python command-line converters with the same options.
- RFC 4180 CSV parsing: quoted delimiters, escaped quotes, embedded newlines, CRLF/LF/CR.
- Delimiter auto-detection (`,` `;` tab `|`).
- Safe type detection for numbers and booleans; leading-zero codes stay as text.
- Encoding detection: UTF-8 (with/without BOM), UTF-16 LE/BE, cp1252 fallback (Python).
- Bold, frozen, filterable header row; optional Excel table (`--table`); auto-fit column widths.
- Console progress bar with percentage and elapsed time.
- Unit tests (Vitest, pytest), shared BDD spec (Cucumber, behave), GitHub Actions CI.
