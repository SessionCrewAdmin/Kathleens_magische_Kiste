# LehrplanPLUS Gymnasium: importierter Lehrplanbestand

Stand: 27.09.2026 · Extractor/Importschema: 1.0 · Herkunft: offizielle Fachlehrplanseiten von LehrplanPLUS Bayern.

## Bestände

- `lehrplanplus-gymnasium-index-v1.json`: 23 offizielle Fachlehrplanvarianten samt Jahrgangs- und Variantenverfügbarkeit.
- `lehrplanplus-history-competencies-v1.json`: 10 Geschichtsvarianten, 58 Lernbereichsabschnitte, 554 strukturierte Kompetenzerwartungs- und Inhaltsitems. Davon 334 Aussagen in Kompetenzblöcken („Die Schülerinnen und Schüler …“).
- `lehrplanplus-english-competencies-v1.json`: 13 Englischvarianten, 189 Abschnitte, 649 strukturierte Kompetenz-/Inhaltsitems. Davon 549 Aussagen in Kompetenzblöcken.
- Die Serviceinventare enthalten je 142 offizielle Servicematerial-/Zusatzmaterialseiten mit den jeweils gelisteten Materiallinks. Die eigentlichen Dateien bleiben auf ihren offiziellen Ursprungsseiten und werden nicht ins Repository gespiegelt.

## Varianten und Grenzen

Englisch berücksichtigt 1. und 2. Fremdsprache, gemeinsame Fachlehrpläne und grundlegendes/erhöhtes Anforderungsniveau, wo LehrplanPLUS diese unterscheidet. Geschichte beginnt in Jahrgangsstufe 6; ein Fachlehrplan Geschichte 5 ist nicht ausgewiesen. Jahrgangsstufen, die dieselbe offizielle Lehrplanseite verwenden, bleiben in den Metadaten als gemeinsame Variante erkennbar.

Die Assessment Engine bietet die originalen Kompetenzformulierungen als auswählbare Vorschläge an. Eine ausgewählte Kompetenz wird erst dann einer Aufgabe zugerechnet, wenn die Lehrkraft sie im Assessment-Plan konkret zuweist. Nicht zugeordnete Aufgaben erhalten einen Qualitätshinweis. Fundstellen und Lehrplanvariante werden an den Kompetenzobjekten gespeichert.

Englisch-Grammatikdaten sind weiterhin nicht als eigene Grammar Knowledge Base importiert. Das Vorhandensein von Lehrplan-Kompetenzen ersetzt keine schulbuchgebundene Grammar Knowledge Base. Zusatzmaterialdateien, die hinter Serviceinformationsseiten liegen, werden verlinkt, nicht archiviert oder öffentlich kopiert.
