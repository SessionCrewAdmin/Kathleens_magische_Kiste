# Global Cleanup · Phase A

Stand: 2026-09-23

## Ziel

Kathleens magische Kiste wird von einer historisch gewachsenen Sammlung einzelner Tools zu einer konsistenten Unterrichtsplattform konsolidiert. Cleanup erfolgt abhängigkeitsbasiert: aktive Pfade bleiben stabil, Altcode wird erst entfernt, wenn weder Einstiegspunkt noch Service Worker noch Integration darauf verweisen.

## Aktive Kernbereiche

- `index.html` – Lehrer-Dashboard / Start
- `service-worker.js` + `manifest.webmanifest` – PWA
- `tools/teacher-shell.js` – gemeinsame Navigation / Teacher Shell
- `tools/classroom-tools-shared.js` – Klassenlisten, globaler Klassenkontext und Shared Storage
- `tools/classroom-session.js` – Session-Kontext
- `tools/lesson-mode.js` – Stunden-/Unterrichtskontext
- `tools/todo-store.js` – zentrale To-do-Daten
- `tools/classroom-board/` – Whiteboard und Schüleransicht
- `tools/quick-games/` – Games Hub
- `tools/history-content-center/` + `data/history/` – Geschichts-Knowledge-Base
- `tools/quest-mode/` – Gamification
- `tools/timetable/`, `tools/class-cockpit/`, `tools/class-lists/`, `tools/seating-plan/`, `tools/mobile-observations/`, `tools/schulaufgabenrechner/` – Klassen- und Unterrichtsorganisation

## Phase A · bereits bereinigt

Folgende Dateien waren weder im aktuellen `index.html` noch im aktuellen Service-Worker-CORE eingebunden und stammen aus ersetzten Start-/Dashboard-Iterationen. Sie wurden entfernt:

- `README.txt`
- `home-layout-v25.js`
- `assets/home-layout-v25.css`
- `home-observer-guard-v49.js`
- `kathleen-dashboard-v26.js`
- `kathleen-dashboard-v27.js`
- `assets/kathleen-dashboard-v26.css`
- `assets/kathleen-dashboard-v27.css`
- `start-v42.js`
- `start-icons-v45.js`
- `assets/start-v42.css`
- `assets/start-quest-shell-v43.css`
- `assets/start-hero-v44.css`
- `assets/start-icons-v45.css`
- `assets/start-polish-v46.css`

## Noch nicht löschen

Diese Dateien tragen alte Versionsnummern, sind aber aktuell aktiv referenziert und bleiben bis zur Konsolidierung bestehen:

- `home-native-v47.js`
- `assets/home-native-v47.css`
- `mobile-teacher-v34.js`
- `tools/teacher-design-v50.css`
- `tools/teacher-page-adapters-v50.css`
- `tools/teacher-shell-overrides-v54.css`
- `tools/teacher-runtime-v54.js`
- `tools/teacher-premium-pages-v57.css`
- `tools/quick-games/demo-packs-v66.js`
- `tools/quick-games/quick-games-v68.js`
- `tools/quick-games/country-hunt/premium-v71.css`
- `tools/quick-games/country-hunt/premium-v71.js`
- `tools/todos/todos-v69.js`
- `tools/seating-plan/v27.css`
- `tools/seating-plan/v27.js`

Die Versionsnummer im Dateinamen allein ist kein Löschkriterium.

## Nächste Cleanup-Phasen

### B · App Context
Ein gemeinsamer `AppContext` soll aktive Klasse, Fach, Stunde und Session als eine Quelle bereitstellen. Bestehende LocalStorage-/Shared-State-APIs werden zunächst adaptiert, nicht gebrochen.

### C · Teacher Shell
Navigation, More-Menü, Session-Bar und aktive Tool-Zustände werden aus einer gemeinsamen Registry generiert. Einzelne Integrationsskripte sollen danach schrumpfen oder entfallen.

### D · Game Platform
Country Hunt, History Hunt, Timeline Challenge und Quick Games erhalten gemeinsame Module für Teams, Timer, Punkte, Beamer, Session und Ergebnisübergabe.

### E · Design
Aktive Teacher-CSS-Dateien werden zu einer klaren Design-Layer-Struktur konsolidiert. Erst danach werden die bisherigen `v50/v54/v57` Dateien entfernt.

### F · Daten & Backend
Klassen-, Session-, Aufgaben-, Beobachtungs- und Fachkontext werden auf konsistente IDs und Speicherregeln geprüft. Supabase-Migrationen bleiben als Historie erhalten; operative neue Migrationen gehören nach `supabase/migrations/`.

### G · PWA / Release
Service-Worker-CORE wird aus der finalen aktiven Dateiliste neu aufgebaut. Danach Regression für Desktop, iPad und iPhone und ein sauberer Baseline-Release.

## Cleanup-Regeln

1. Keine Datei nur wegen einer alten Versionsnummer löschen.
2. Vor Löschung Referenzen in Einstiegspunkten, Tool-Dateien und Service Worker prüfen.
3. Öffentliche Legacy-Redirects nur entfernen, wenn kein externer Link mehr davon abhängen kann.
4. Datenmigrationen und produktive Supabase-Funktionen nicht als UI-Altlast behandeln.
5. Nach jeder größeren Konsolidierung PWA-Pfade und Offline-Core aktualisieren.
6. Neue Features während des Cleanup nur, wenn sie für die Architektur zwingend nötig sind.
