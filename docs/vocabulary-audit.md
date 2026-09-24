# Vocabulary full import audit

Audit date: 24 September 2026 · Result: **passed**

| Grade | Supplied screenshots | Prepared page halves | Main entries | Knowledge boxes |
| --- | ---: | ---: | ---: | ---: |
| 7 | 19 | 38 | 658 | 13 |
| 9 | 22 | 44 | 682 | 14 |
| **Total** | **41** | **82** | **1,340** | **27** |

The import starts from the supplied prepared page halves. Every half is recorded in `data/vocabulary/audit.json` with its textbook page, content kind, main-entry count and SHA-256 fingerprint. Introductory halves and the grade 9 page containing only the “Civil rights” knowledge box are explicitly recorded with zero main entries.

English headwords and IPA were reviewed visually against all supplied page halves. German source meanings and source notes were retained as structured text. Green information boxes were transcribed separately so that word families, collocations, usage guidance and topic vocabulary keep their relationships. Automated checks validate the catalog totals, source locators, required fields, unique IDs, JSON schema, offline inventory and the absence of raw source images.

The repository contains no screenshots or scans. `data/vocabulary/catalog.json` is the authoritative entry point; obsolete partial fragments are removed.
