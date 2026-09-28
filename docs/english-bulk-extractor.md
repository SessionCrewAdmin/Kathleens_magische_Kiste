# English Bulk Extractor

## Nur Materialdateien einsammeln

Der separate **Materialsammler** unter `tools/material-file-collector/` kopiert die tatsächlichen Unterrichtsdateien in einen frei gewählten Zielordner. Er extrahiert keine Inhalte und erzeugt keine bloße Dateiliste. Dokumente, Präsentationen, Tabellen, Bilder, Audio und Video werden mit ihrer relativen Ordnerstruktur kopiert.

App-Dateien, Konfigurationen, Programme, Archive und typische Projektordner wie `src`, `tools`, `tests`, `assets`, `node_modules` und `.git` bleiben standardmäßig draußen. Quelldateien werden nicht verändert oder gelöscht; vorhandene Dateien im Ziel werden nicht überschrieben. Die Ordnerfreigabe und das Kopieren erfolgen ausschließlich lokal in Chrome oder Edge.

Der English Bulk Extractor erweitert den bestehenden Content Extractor V2. Gemeinsame, fachneutrale Funktionen liegen in `tools/content-extractor-core.js`; der History-Import bleibt ein separater Adapter mit unverändertem Review- und Supabase-Overlay.

## Lokaler Ablauf

Für DUA-/Unterrichtsassistent-Ordner ist standardmäßig **Nur inhaltlich relevante Dokumente scannen** aktiviert. Dieser Modus behält PDF, DOCX, DOC und TXT einschließlich der Unterrichtsmaterialien unter `content/media`, ignoriert aber App-Ressourcen, Hilfs-/Lizenzdateien und macOS-Schattenkopien (`._*`, `.DS_Store`). Der vollständige Inventarmodus bleibt durch Abwählen der Option erreichbar.

Der reale Testbestand `0. Green Line 2` enthielt 20.773 Dateien. Der Inhaltsfilter reduzierte ihn auf 501 Kandidaten: 263 PDF, 233 DOCX, 4 DOC und 1 TXT. Je fünf echte PDF- und DOCX-Dateien wurden stichprobenartig erfolgreich geöffnet und textuell ausgelesen.

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
