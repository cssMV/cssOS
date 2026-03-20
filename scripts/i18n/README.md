# i18n tooling

This folder is the first step of the upgraded i18n mainline:

- `en` is the source-of-truth locale.
- `build-registry.js` generates:
  - `public/i18n/registry.json`
  - `public/i18n/missing.json`

These generated files let us:

- see which locales are incomplete
- detect only newly added English keys
- prepare the next step: automatic translation generation into cached locale JSON files

Current workflow:

1. add/update English copy in `public/i18n/dict.js`
2. run `npm run i18n:build-registry`
3. run `npm run i18n:check`
4. inspect `public/i18n/missing.json`
5. optionally run `npm run i18n:auto-translate -- --locale ja`

Planned next upgrade:

- add an automatic translator that reads missing English keys
- translate only delta keys for a target locale
- persist generated locale JSON cache files under `public/i18n/generated/`
- merge generated locale cache at runtime before rendering
