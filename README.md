# Kathleens magische Kiste

Unterrichtszentrale für Englisch und Geschichte am Gymnasium: Klassenorganisation, Stundenplanung, Whiteboard, Beobachtungen, Aufgaben, Gamification und interaktive Unterrichtsspiele in einer gemeinsamen PWA.

## Aktuelle Hauptbereiche

- Start / Lehrer-Dashboard
- Stundenplan
- Meine Klassen
- Whiteboard / Classroom Board
- Quest Mode
- Beobachtungen
- Material & Aufgaben
- Quiz & Spiele

## Wichtige Module

### Unterricht & Organisation
- `tools/class-cockpit/`
- `tools/class-lists/`
- `tools/seating-plan/`
- `tools/timetable/`
- `tools/mobile-observations/`
- `tools/schulaufgabenrechner/`
- `tools/todos/`
- `tools/homework-strikes/`
- `tools/homework-vouchers/`

### Whiteboard & Live-Unterricht
- `tools/classroom-board/`
- `tools/live-poll/`
- `tools/randomizer/`
- `tools/classroom-timer/`
- `tools/team-generator/`

### Assessments
- `tools/assessments/` – gemeinsame Assessment Engine mit History- und Vocabulary-Adaptern, Assessment-Plan, Erwartungshorizont, Korrekturbogen und lokaler Bibliothek.
- `data/assessment/` – versioniertes Schema, Operatorenreferenz Geschichte (Bayern, März 2025) und Status der noch nicht importierten LehrplanPLUS-/Grammar-KBs.
- `docs/assessment-engine-audit.md` – Repository- und Referenzdokument-Audit samt fehlenden Daten.

### Games
- `tools/quick-games/`
- `tools/quick-games/country-hunt/`
- `tools/quick-games/history-hunt/`
- `tools/quick-games/timeline-challenge/`
- `tools/english-world-quiz/`
- `tools/kalter-krieg/`
- `tools/escape-room/`

### Geschichte Knowledge Base
- Katalog: `data/history/catalog.json`
- Schema: `data/history/schema-v1.json`
- Klasse 7: `data/history/grade-7/`
- Content Center: `tools/history-content-center/`

Klasse 7 enthält aktuell sieben vollständig importierte Kapitel plus jahrgangsübergreifende Wiederholungsaufgaben. Die Datenbank speichert abgeleitete Wissensstrukturen, Fragen, Aufgabenkerne, Medienmetadaten und Quellenreferenzen; vollständige Lehrwerksseiten werden nicht im öffentlichen Repository dupliziert.

## Kernarchitektur

- `index.html` – Startseite / Dashboard
- `service-worker.js` – PWA und Offline-Core
- `manifest.webmanifest` – PWA-Metadaten
- `tools/teacher-shell.js` – gemeinsame Teacher Navigation
- `tools/classroom-tools-shared.js` – Klassenlisten und gemeinsamer Klassenkontext
- `tools/classroom-session.js` – Classroom Session
- `tools/lesson-mode.js` – Stundenkontext
- `tools/todo-store.js` – To-do-Datenlayer

## Backend

Supabase wird für persistente Funktionen wie Classroom Sessions, Live Poll, Push und weitere gemeinsame Daten verwendet.

- Funktionen: `supabase/functions/`
- neue Migrationen: `supabase/migrations/`
- historische Setup-/Patch-Skripte: `setup/`

Assessments der ersten Ausbaustufe werden lokal im Browser gespeichert. Sie nutzen die bestehenden Knowledge Bases, statt deren Inhalte zu duplizieren. Fehlende LehrplanPLUS-, Grammar- und Quellenmaterialien werden im Plan als Lücken angezeigt.

## PWA

Die Anwendung läuft über GitHub Pages und unterstützt Installation auf Desktop, iPad und iPhone. Der Service Worker hält die zentralen Teacher-Tools und die Geschichts-Knowledge-Base offline verfügbar.

## Cleanup

Das Repository wird aktuell abhängigkeitsbasiert konsolidiert. Alte Versionsdateien werden nur entfernt, wenn sie nicht mehr von Einstiegspunkten, Tools oder Service Worker referenziert werden.

Aktueller Cleanup-Plan und Audit:

`docs/architecture/CLEANUP_V1.md`
