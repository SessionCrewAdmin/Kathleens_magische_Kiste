# English Bulk Extractor

Der English Bulk Extractor erweitert den bestehenden Content Extractor V2. Gemeinsame, fachneutrale Funktionen liegen in `tools/content-extractor-core.js`; der History-Import bleibt ein separater Adapter mit unverändertem Review- und Supabase-Overlay.

## Lokaler Ablauf

1. `tools/english-bulk-extractor/` über einen lokalen Webserver in Chrome oder Edge öffnen.
2. Den Englisch-Hauptordner auswählen. Die Anwendung inventarisiert rekursiv, hasht jede Datei einzeln und speichert nur Manifest und Extraktion in IndexedDB.
3. Standardmäßig ist OCR **On demand**: scanartige PDF-Seiten werden markiert, aber nicht automatisch durch OCR geschickt.
4. Analyse starten. Zwei kontrollierte Worker sind der Standard; Pause und Fortsetzen persistieren nach jeder Datei.
5. Unsichere Zuordnungen in **Needs Review** filtern und gleiche Ordnergruppen per Bulk-Aktion bestätigen.
6. Die lokale Bibliothek als JSONL sichern. Nur bestätigte Einträge erscheinen im separaten Export **Geprüfte KB-Kandidaten**.

Originaldateien werden nicht in IndexedDB, Supabase oder das Repository kopiert. Nach einem Browser-Neustart muss der Quellordner aus Sicherheitsgründen erneut freigegeben werden; unveränderte Dateien werden anhand Pfad, Größe und Änderungszeit übersprungen. SHA-256 dient der exakten Dublettenerkennung.

Browser geben aus Datenschutzgründen keinen echten Laufwerksbuchstaben oder absoluten Systempfad preis. Deshalb speichert diese Desktop/PWA-Ausbaustufe den vollständigen Pfad relativ zum ausgewählten Hauptordner sowie dessen sichtbaren Namen; das Schema hält `absolutePath` für einen späteren nativen Desktop-Wrapper bereit.

## Formate

- PDF: Textlayer, Seitenprovenienz, Scan-Erkennung; OCR aus / on demand / automatisch.
- DOCX: Überschriften, Absätze, Listen, Tabellen, Hyperlinks, Header, Abschnitte und Bildreferenzen.
- TXT/MD: strukturierte Zeilenextraktion.
- DOC, PPTX, XLSX, Audio, Bilder, ZIP und sonstige Formate: Inventar und klare Kennzeichnung; noch keine Inhaltsanalyse.

## Knowledge Base und Assessment Engine

Der JSONL-Kandidatenexport ist der kontrollierte Übergabepunkt: Review, Mapping und Validierung finden vor einem späteren Supabase-Import statt. Kategorie, Klasse, Unit, Topic, Confidence, Qualitätsdaten, Hash und Quellenpfad bleiben erhalten. Es gibt absichtlich keinen blinden Massenimport und keinen zweiten inkompatiblen KB-Speicher.

## Stufentest für den echten Bestand

Zuerst 10 repräsentative Dateien, dann 100, anschließend einen größeren Unterordner und erst danach den vollständigen Bestand verarbeiten. Für den Volllauf Chrome/Edge geöffnet lassen, Netzbetrieb verwenden und zunächst zwei Worker sowie OCR **On demand** beibehalten. Die JSONL-Sicherung nach jeder Stufe extern sichern.
