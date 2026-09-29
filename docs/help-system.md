# Hilfe- und Onboarding-System

Die Lehreroberfläche lädt eine zentrale, kontextbezogene Hilfe. Der Einstieg ist das `?` in der Kopfleiste oder „Hilfe & Probleme lösen“ im mobilen Bereichsmenü.

## Aufbau

- `data/help/catalog.js`: versionierte Artikel, Suchbegriffe, Tour-Schritte, Problemlösungen und Abdeckungsmatrix.
- `tools/help-registry.js`: Kontextauflösung, fehlertolerante Suche und Qualitätsprüfung.
- `tools/help-center.js`: zugänglicher Drawer, Suche, Deep-Links, Onboarding und Touren.
- `tools/help-integrations.js`: Inline-Hilfe sowie direkte Hilfe aus realen Fehlerzuständen.
- `tools/teacher-shell.js`: globaler Einstieg auf Lehrerseiten.

Die Hilfe ist Teil des PWA-Caches. Ein Artikel ist über `?help=<artikel-id>` direkt verlinkbar.

## Definition of Done für neue Funktionen

Eine neue größere Funktion gilt erst dann als vollständig, wenn:

1. ein Übersichtsartikel mit realen Funktionsnamen existiert,
2. die Route in der Abdeckungsmatrix eingetragen ist,
3. mindestens ein auffindbarer Suchbegriff aus Lehrersicht vorhanden ist,
4. komplexe oder riskante Eingaben eine Inline-Hilfe besitzen,
5. relevante Fehler einen direkten Weg zu „Problem lösen“ anbieten,
6. Tour-Selektoren gegen die echte Oberfläche geprüft sind,
7. die Hilfe per Tastatur, mobil und offline erreichbar bleibt.

## Qualitätsprüfung

`tests/help-system.test.cjs` prüft Schema, Links, Suchbegriffe, Routen, Abdeckung, Tour-Ziele und Offline-Dateien. `tests/help-system-browser.cjs` prüft Drawer, Kontext, Suche, Deep-Link, Escape-Taste und Tour im Browser.
