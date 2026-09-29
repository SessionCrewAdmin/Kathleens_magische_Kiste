# English Knowledge Base

## Datenfluss

1. Der English Bulk Extractor liest ausgewählte Unterrichtsdokumente lokal.
2. Die Nutzerin prüft Klasse, Unit, Inhaltstyp und fachlichen Inhalt.
3. Der Scanner speichert den strukturierten Datensatz in IndexedDB `kathleen-english-bulk-extractor`, Store `documents`.
4. Die English Knowledge Base bildet daraus einzelne Content Units und zeigt Quelle, Hash, Seitenbezug, Prüfstatus und Freigaben.
5. Der Kurzarbeiten-Generator erhält ausschließlich die ausdrücklich ausgewählten, fachlich geprüften und für Leistungsnachweise freigegebenen Units derselben Klasse und Unit.

Originaldateien werden nicht in die Knowledge Base kopiert. Archivieren und Löschen verändern keine Originaldateien.

## Prüfstatus und Freigaben

- **Noch zu prüfen:** keine fachliche Freigabe; nicht für Leistungsnachweise nutzbar.
- **Geprüft:** kontrolliert, aber noch nicht als fachlich freigegeben markiert.
- **Fachlich geprüft:** fachlich bestätigt. Erst dann darf „Leistungsnachweis“ aktiviert werden.
- **Übung**, **Arbeitsblatt** und **Leistungsnachweis** sind getrennte Freigaben.

Die Generator-Bereitschaft nennt alle Sperrgründe, etwa fehlende Klasse, Unit oder Inhaltstyp, fehlenden Text, OCR-Bedarf, Fehler, Archivstatus oder fehlende Freigabe.

## Lokale Speicherung und Versionsstrategie

IndexedDB bleibt die maßgebliche Arbeitsquelle. Das bestehende Datenbank-Schema und der Object Store werden nicht ersetzt. Neue Verwaltungsfelder (`managerSchemaVersion` und `lifecycle`) sind optional und werden beim Lesen rückwärtskompatibel ergänzt. Alte Datensätze benötigen daher keine riskante Datenbankmigration.

## Sicherung, Wiederherstellung und Gerätewechsel

„Vollständige Sicherung“ exportiert alle lokalen Datensätze als JSON. Auf einem neuen Gerät wird diese Datei über „Sicherung einlesen“ geprüft. Die Vorschau meldet neue, ungültige und anhand von ID oder Dateihash doppelte Datensätze. Dubletten werden standardmäßig übersprungen. Ein bewusstes Ersetzen erhält vorhandene Prüfstatus und Freigaben.

JSONL exportiert die ausgewählten Rohdatensätze zeilenweise. „Nur Leistungsnachweise“ exportiert ausschließlich Datensätze mit mindestens einer generatorbereiten Unit.

## Verwendung im Kurzarbeiten-Generator

„Im Kurzarbeiten-Generator verwenden“ übergibt Englisch, Klasse, Unit, Aufgabenbereich und Knowledge-Base-ID. Der Generator zeigt den Baustein sichtbar vorausgewählt. Nicht freigegebene, archivierte oder unpassende Bausteine werden abgelehnt. Für Grammar, Reading, Writing, Mediation und Listening muss mindestens ein sichtbarer passender Baustein bewusst ausgewählt sein.

Aufgaben und Erwartungshorizont behalten Knowledge-Base-ID, Ursprungsdatei, Seitenbezug, Quellenhinweise und Warnungen.

## Supabase

Der lokale Modus funktioniert ohne Cloud. Es gibt keinen automatischen Upload. Der Stand der verbundenen Supabase-Instanz wurde geprüft: Die privaten Importtabellen und 139 strukturierte Einträge sind vorhanden; die Migration für Content Units und Task Blueprints ist dort nicht angewendet, und die English-KB-RPCs sind weder für `anon` noch `authenticated` ausführbar. Die Oberfläche zeigt deshalb korrekt „Cloud-Synchronisierung nicht eingerichtet“ und überträgt nichts.

Die vorbereiteten Migrationen aktivieren RLS und widerrufen Tabellen- und Funktionsrechte. Für einen späteren Browser-Sync ist zusätzlich ein echtes Supabase-Auth-Benutzermodell mit `user_id`, passenden `SELECT`-/`INSERT`-/`UPDATE`-Policies (`USING` und `WITH CHECK`) sowie expliziten Grants erforderlich. Ein Service-Role-Key darf niemals in den Browser gelangen.

## Datenschutz

- Originaldateien bleiben auf dem Gerät.
- Keine automatische Cloud-Synchronisierung.
- Exporte enthalten strukturierte Scanner-Daten und können Textauszüge enthalten; sie sind wie Unterrichtsmaterial sicher aufzubewahren.
- Endgültiges Löschen betrifft nur den IndexedDB-Datensatz und weist auf mögliche Referenzen in gespeicherten Kurzarbeiten hin.

## Bestandsaudit

- Scanner: IndexedDB-Dokumente mit `classification`, `content`, `quality`, `source`, `provenance`, Status und OCR-/Fehlerfeldern.
- Generator: `assessmentCandidates` verlangte bereits `reviewStatus=approved` und `approvedUses` mit `assessment`; bislang wurden alle passenden Units automatisch ausgewählt.
- Nur lokal: Scannerbestand, Archivstatus, Bearbeitungen und lokale Sicherungen.
- Supabase vorbereitet: Importbatch, Einträge, Content-Unit- und Blueprint-Migration; Live-Stand siehe Abschnitt Supabase.
- PWA: Knowledge-Base-Seite, Modell, Bibliothek, Styles und Skripte sind Teil des Offline-Caches `v121`.
