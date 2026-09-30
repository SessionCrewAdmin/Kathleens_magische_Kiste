# English Knowledge Base

## Datenfluss

1. Der English Bulk Extractor liest ausgewählte Unterrichtsdokumente lokal.
2. Die Nutzerin prüft Klasse, Unit, Inhaltstyp und fachlichen Inhalt.
3. Der Scanner speichert den strukturierten Datensatz in IndexedDB `kathleen-english-bulk-extractor`, Store `documents`.
4. Extractor V3 entfernt wiederkehrende Kopf- und Fußtexte, trennt einzelne Aufgaben und verbindet erkannte Lösungsseiten.
5. Die English Knowledge Base bildet daraus einzelne Content Units und zeigt Quelle, Hash, Seitenbezug, Prüfstatus und Freigaben.
6. Der Kurzarbeiten-Generator erhält ausschließlich die ausdrücklich ausgewählten, fachlich geprüften und für Leistungsnachweise freigegebenen Units derselben Klasse und Unit.

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

## Extractor V3 und Schnellprüfung

PDFs werden layoutbezogen statt nur als flache Textfolge gelesen. Textpositionen, Seitenzonen, Arbeitsaufträge und Lösungsüberschriften dienen der Aufgabentrennung. Fotos werden lokal auf Seitenränder untersucht, zugeschnitten, perspektivisch entzerrt, kontrastiert und auf Unschärfe beziehungsweise abgeschnittene Bereiche geprüft. Vor der OCR erscheint eine Vorschau. Die Originaldatei wird nicht verändert.

Die mobile Schnellprüfung bestätigt per Wischen nach rechts, stellt per Wischen nach links zurück und öffnet per Wischen nach oben die Bearbeitung. Dieselben Aktionen stehen als Schaltflächen und per Tastatur bereit. Bestätigen setzt nur „Geprüft“ und erteilt keine Freigabe für Leistungsnachweise.

„Mit Extractor V3 erneut analysieren“ zeigt einen Vergleich. Manuelle Felder, Prüfstatus und Freigaben bleiben erhalten; ältere Aufgaben werden nicht automatisch gelöscht.

Bestätigte Korrekturen können auf Nachfrage als sichtbare lokale Erkennungsregel gespeichert werden. Regeln für Klasse, Unit, Thema, Inhaltstyp, Lösungsseiten oder zu ignorierende Texte sind in der Knowledge Base einsehbar, bearbeitbar, deaktivierbar und löschbar. Ohne ausdrückliche Bestätigung wird keine Regel angelegt.

Ist eine Originaldatei nicht mehr erreichbar, bleibt der strukturierte Baustein erhalten. „Originaldatei wieder verbinden“ akzeptiert die gewählte Datei nur bei identischem SHA-256-Dateihash. Ein ähnlicher Dateiname allein genügt nicht. Unterstützt der Browser dauerhafte Dateiberechtigungen, wird lediglich das lokale Zugriffsrecht gespeichert; andernfalls gilt die Verbindung für die aktuelle Sitzung.

## Übungswerkstatt

Geprüfte Bausteine können als ähnliche Variante, neuer Kontext oder Transferaufgabe ausgegeben werden. Leicht, mittel und schwer verändern die Hilfen im Arbeitsauftrag. Eine fünfstufige Übungsreihe führt vom Erkennen über Ergänzen, Umformen und Fehlerkorrektur zur freien Anwendung. Varianten sind stets ungeprüfte Entwürfe und behalten die ID der Ausgangsaufgabe.

## Supabase

Der lokale Modus funktioniert ohne Cloud. Es gibt keinen automatischen Upload. Die Migration `english_extractor_v3_private_sync` wurde im verbundenen Projekt angewendet. Sie stellt eine benutzergebundene Tabelle mit vier RLS-Regeln sowie den privaten Bucket `english-kb-previews` bereit. Zum Synchronisieren ist ein Supabase-Auth-Konto erforderlich; derzeit existiert im Projekt noch kein Auth-Benutzerkonto.

Der Browser verwendet ausschließlich den Publishable Key und ein angemeldetes Benutzer-JWT. `anon` besitzt keinen Tabellenzugriff. Vorschaubilder liegen privat und benutzergebunden; vollständige Originaldateien werden nicht synchronisiert. Konflikte auf beiden Geräten werden nicht automatisch überschrieben.

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
- PWA: Extractor V3, Foto-Vorschau, lokale Erkennungsregeln, Wiederverknüpfung, Schnellprüfung, Übungswerkstatt, Knowledge Base und ihre lokalen Kerne sind Teil des Offline-Caches `v123`.
