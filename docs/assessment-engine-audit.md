# Assessment Engine: Repository- und Materialaudit

Auditbasis: `SessionCrewAdmin/Kathleens_magische_Kiste`, Branch `main`, Snapshot `52a98c9` (25.09.2026). Der Check erfolgte vor Änderungen; Implementierungen der bestehenden Knowledge Bases, des Schulaufgabenrechners, des Materialbereichs und der Druckansichten bleiben unangetastet.

## Bestand

| Bereich | Vorhanden | Konsequenz für Assessment Engine |
| --- | --- | --- |
| History Knowledge Base | Strukturierte Kapitel, Themen, Lernziele, Begriffe, Personen, Ereignisse, Fragen, Aufgaben, Lösungen, Medienmetadaten und Quellenreferenzen. Voll importiert für 7, 9, 10 und 12; redaktionell geprüft für 7 und 9. | Assessment-Adapter liest Katalog und Kapiteldateien direkt. Keine Kopie oder zweite fachliche Datenbank. Eine Quellenreferenz bedeutet nicht, dass die Originalquelle ausgeliefert wird. |
| Geschichte Klasse 8 | Kein Klasse-8-Eintrag in `data/history/catalog.json`; es gibt auch keine entsprechende Kapiteldatei. | Die angehängte Beispielarbeit füllt diese Lücke nicht. UI meldet die Lücke und erzeugt keine KB-Fakten für Klasse 8. |
| Vocabulary Knowledge Base | 1.340 geprüfte Einträge für Klasse 7 (658) und 9 (682), Units, Sections, Seiten, `source_note`, Wortart, Übersetzung und Provenienz. 27 separate Knowledge Boxes. | Vocabulary-Aufgaben verwenden nur ausgewählte Repository-Einträge und führen deren IDs, Unit, Section und Seitenfundstelle mit. |
| Grammar / Reading / Mediation / Writing / Listening | Kein strukturiertes Grammar- oder zentrale Audio-KB-Importset im Repository gefunden. Reading/Writing können Aufgabenrahmen, aber keine freigegebene Textquelle beisteuern. | Grammar und Listening werden als fehlende Daten ausgewiesen. Reading verlangt Materialbereitstellung. Writing und Mediation sind sichtbar als generierte Impulse markiert. |
| LehrplanPLUS | Keine eigenständige, strukturierte LehrplanPLUS-Datenbank gefunden. Kapiteldateien enthalten einzelne Lernziele und Kompetenzhinweise, jedoch keine systematische, nach Jahrgangsstufe geprüfte Kompetenz-KB. | Keine LehrplanPLUS-Kompetenzerwartungen erfunden oder als importiert ausgegeben. Die Datenbank ist mit Status `not_imported` vorbereitet. |
| Aufgaben/Material | History speichert Aufgabenkerne und bibliografische Fundorte; Vokabelstudio kann ausgewählte Wörter als druckbares Übungsblatt ausgeben. History Content Center zeigt Knowledge-Base-Inhalte. | Neue Assessment-Aufgaben verwenden Datenadapter; Originalmaterial muss separat hochgeladen/beigefügt werden. |
| Noten | `tools/schulaufgabenrechner/` führt vorhandene Leistungen und den linearen Notenschlüssel. | Keine zweite Notenschlüssel-Engine. Der Korrekturbogen verweist auf den bestehenden Rechner; eine automatische Übergabe ist noch nicht implementiert. |
| Persistenz / Export | Einzeltools verwenden Local Storage, Supabase für gemeinsame Klassen-/Unterrichtsdaten, Browserdruck für einzelne Arbeitsblätter. | Bibliothek v1 speichert Pläne gerätelokal in `localStorage`; Druckansicht/PDF über Browserdialog; DOCX noch offen. |

## Referenzmaterialien

### Operatorenliste Geschichte Gymnasium Bayern

Die beigefügte Liste „Ergänzende Informationen zum LehrplanPLUS“, Stand März 2025, umfasst drei Seiten und ordnet Definitionen in die Abschnitte AFB I, II, III sowie „alle drei Anforderungsbereiche“ ein. Die 32 Operator-Bezeichnungen und Definitionen wurden als Referenzdaten in `data/assessment/history-operators-bayern-2025.json` strukturiert. Die in der Liste enthaltenen Gruppenzuordnungen bleiben im Datenbestand erhalten. Bei `darstellen`, `erörtern` und `interpretieren` ist AFB als I–III dokumentiert; die Engine deutet diese Operatoren nicht fest einem einzelnen Bereich zu.

### Beispiel-Kurzarbeit Geschichte, Klasse 8c

Die Arbeit ist eine 30-minütige Kurzarbeit mit 30 BE zum Sozialistengesetz und zur Sozialgesetzgebung. Drei Teile: Reichstag-Grundwissen (4 BE); Karikatur „Der Kampf des Riesen gegen den Zwerg“ mit Beschreibung/Aussage (5 BE) und historischer Beurteilung (5 BE); ein historischer Dialog zwischen Fabrikbesitzer und Schlosser in Berlin 1890 (16 BE, ca. drei Viertel DIN-A4-Seite). Das Rahmenszenario ist zeit- und rollenbezogen; es verbindet die Aufgaben in einer nachvollziehbaren historischen Situation. Die Arbeit bezieht eine im PDF abgebildete zeitgenössische Karikatur ein. Die Anlage stellt einen Stil- und Qualitätsbeleg dar, keine zu kopierende Aufgabenquelle.

### Erwartungshorizont

Der EWH übernimmt die drei Aufgabenblöcke und verteilt Teilpunkte mit konkret erwarteten Inhalten. Die Karikaturaufgabe bewertet sichtbare Bildelemente, Figurenidentifikation, Kernaussage und anschließende historische Beurteilung. Der Dialog ist offen: zwei nachvollziehbare Standpunkte, historische Tatsachen, wechselseitiger Bezug und rollenangemessene Sprache werden getrennt bewertet; mehrere inhaltlich stimmige Varianten sind zulässig. Das Modell für Assessment-Aufgaben erhält daher Kriterien und mögliche Inhalte statt einer einzigen zwingenden Formulierung. Der beigefügte EWH referenziert LehrplanPLUS-Kompetenzen, aber eine eigenständige LehrplanPLUS-Quelle ist nicht Teil der vorhandenen Repository-Daten.

Die PDFs bleiben Referenzmaterial und werden nicht ins öffentliche Repository kopiert. Die extrahierte Operatorenliste ist die einzige aus ihnen übernommene, allgemeingültige Fachdatenstruktur.

## Zielarchitektur v1

`data/history` / `data/vocabulary` / LehrplanPLUS-KB / hochgeladene Materialien → gemeinsame Assessment-Konfiguration und versionierter Plan → Fachadapter → Aufgaben und Qualitätswarnungen → Schülerfassung / EWH / Korrekturbogen → Print/PDF und lokale Bibliothek.

Die aktuelle Umsetzung ergänzt `data/assessment/` sowie `tools/assessments/`. Das Schema lässt `short_test`, `worksheet`, `practice`, `revision`, `exam` und `homework` zu; der vollständige Wizard ist zunächst auf Kurzarbeiten ausgerichtet. Lehrerbegründungen werden im Assessment-Plan gerendert und nicht in die Schülerfassung übernommen.

## Offene Voraussetzungen

- Geprüfte LehrplanPLUS-Kompetenzerwartungen für Geschichte und Englisch, Klassen 7–13.
- History-KB Klasse 8 und ein freigegebenes Schuljahr/Kapitel für den expliziten Testfall.
- Grammar-KB pro Unit; Audio-Inventar und zugelassene Listening-Dateien.
- Persistente/geräteübergreifende Assessment-Bibliothek, Uploadspeicherung, DOCX-Export und direkte Notenrechner-Übergabe.
- Fachlich geprüfte, granulare Punkteraster für generierte Aufgaben; Starteraster werden ausdrücklich als redaktionell zu prüfen markiert.
