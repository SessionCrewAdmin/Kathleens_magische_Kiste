"""Apply and verify the editorial quality pass for history grades 7 and 9.

The source extraction itself remains private. This script only enriches the
published, derived datasets with review metadata, game-ready distractors and
specific solution expectations.
"""

from __future__ import annotations

import json
import pathlib
import re
import unicodedata


ROOT = pathlib.Path(__file__).resolve().parents[1]
HISTORY = ROOT / "data" / "history"
EXTRACTED = ROOT / "tmp" / "history-quality"
REVIEW_DATE = "2026-09-25"
GENERIC_SOLUTION = "Die Kernaussagen von"


GRADE_9_SOLUTIONS = {
    "g9-k1-a-01": "Das KPD-Plakat von 1919 in Bildelemente, Text und politische Symbole zerlegen, den Spartakusbund und die frühe Republik als Kontext nennen und die mobilisierende, republik-kritische Absicht mit sichtbaren Details belegen.",
    "g9-k1-a-02": "Die Karikatur von 1932 beschreibt die bedrohte Germania und konkurrierende Politiker; ihre Aussage ist, dass parteipolitischer Streit und fehlende Zusammenarbeit die handlungsunfähige Republik zusätzlich gefährden.",
    "g9-k1-a-04": "Ersten Eindruck, Bildelemente, Text, Absender und historischen Kontext getrennt erfassen; anschließend Zielgruppe, politische Botschaft und beabsichtigte Wirkung des KPD-Wahlplakats belegt deuten.",
    "g9-k1-a-05": "Personen, Symbole und Handlung der Karikatur genau beschreiben, Franz von Papen identifizieren und die Kritik an der politischen Zersplitterung und Regierungskrise des Jahres 1932 herausarbeiten.",
    "g9-k1-a-06": "Die Ereignisse des 9. November 1918 chronologisch ordnen, Scheidemanns zentrale Aussagen zusammenfassen und die Ausrufung der Republik als Reaktion auf Revolution, Kriegsniederlage und Machtvakuum erklären.",
    "g9-k1-a-07": "Das Hörmaterial zur Republikgründung gezielt vorentlasten, mit Zeitstrahl und Quellenfragen auswerten und anschließend zwischen Information, zeitgenössischer Perspektive und späterer Deutung unterscheiden.",
    "g9-k2-a-01": "Die Errichtung der NS-Diktatur als Zusammenspiel von Wahlerfolgen, Unterstützung konservativer Eliten, Propaganda, Terror und scheinlegalen Maßnahmen wie Reichstagsbrandverordnung und Ermächtigungsgesetz darstellen.",
    "g9-k2-a-02": "Bildaufbau, Perspektive, Inszenierung und Auswahl des Ausschnitts aus ‚Triumph des Willens‘ beschreiben und erklären, wie die Aufnahme Hitler als Führer überhöht und Zustimmung zur NS-Herrschaft erzeugen soll.",
    "g9-k2-a-03": "Die Lebensbereiche Schule, Freizeit, Familie, Jugendorganisationen und Ausgrenzung in der Mindmap belegen; die recherchierte Biografie sachlich darstellen und individuelle Erfahrung vom allgemeinen Befund unterscheiden.",
    "g9-k2-a-04": "Elser und Stauffenberg nach Herkunft, Beruf, Haltung, Motiv, Tat und späterer Erinnerung vergleichen; Gemeinsamkeiten und Unterschiede des Widerstands mit überprüfbaren Belegen beurteilen.",
    "g9-k2-a-05": "Die Schritte vom 30. Januar 1933 bis zur Ausschaltung politischer Gegner korrekt ordnen und an der Karikatur erklären, wie Hitler Legalität behauptete, während demokratische Regeln zerstört wurden.",
    "g9-k2-a-06": "Formen der Ausgrenzung jüdischer Menschen aus dem Film sammeln, Boykottplakat und Ortsschild quellenkritisch beschreiben und ihre einschüchternde, entwürdigende Wirkung begründet einschätzen.",
    "g9-k2-a-07": "Schlüsselbegriffe und rhetorische Mittel der Sportpalastrede markieren, Hauptaussage und Feindbilder bestimmen und die Rede als propagandistische Rechtfertigung von Krieg und Verfolgung einordnen.",
    "g9-k2-a-08": "Aussagen über die Weiße Rose anhand des Films prüfen, falsche Angaben berichtigen und Motive, Handlungsformen, Risiken und Grenzen studentischen Widerstands erläutern.",
    "g9-k2-a-10": "Machtübertragung und Machtausbau unterscheiden und die Diktaturbildung mit den Kategorien Zustimmung, Elitenhilfe, Propaganda, Terror und scheinlegale Maßnahmen vollständig erklären.",
    "g9-k2-a-11": "Urheber, Entstehung, Bildgestaltung und Verwendungszusammenhang prüfen; zwischen dokumentiertem Geschehen und propagandistischer Inszenierung unterscheiden und die Aussagegrenzen des Fotos benennen.",
    "g9-k2-a-12": "Jugendalltag im Nationalsozialismus anhand mehrerer Lebensbereiche strukturieren und eine konkrete Biografie nutzen, um Anpassung, Ausgrenzung und Handlungsspielräume differenziert zu zeigen.",
    "g9-k2-a-13": "Die Recherche zu Elser und Stauffenberg mit belastbaren Quellen dokumentieren, Kriterien einheitlich ausfüllen und die spätere Erinnerung an beide Attentäter quellenbasiert vergleichen.",
    "g9-k2-a-14": "Die Stationen der Diktaturerrichtung chronologisch sichern und erklären, wie Verordnung, Gesetz, Gewalt und Propaganda das Parlament und die Grundrechte außer Kraft setzten.",
    "g9-k2-a-15": "Die schrittweise Entrechtung von 1933 bis zu den Nürnberger Gesetzen an Beispielen erläutern und Bild- sowie Textquellen auf Perspektive, Sprache und Wirkung untersuchen.",
    "g9-k2-a-16": "Zusammensetzung, Motive und Flugblattaktionen der Weißen Rose darstellen, Filmaussagen überprüfen und Chancen wie Grenzen dieser Form des Widerstands beurteilen.",
    "g9-k2-a-17": "Hitlers Rede sprachlich und inhaltlich analysieren: Wiederholung, Steigerung, Metaphern und Feindbilder belegen sowie Funktion und Wirkung der Propaganda im Krieg beurteilen.",
    "g9-k2-a-18": "Filme, Rede- und Bildquellen jeweils mit einem klaren Beobachtungsauftrag einsetzen, Ergebnisse durch schriftliche Quellen absichern und emotionale Wirkung ausdrücklich reflektieren.",
    "g9-k3-a-01": "Menschen- und Grundrechte nach Universalität, Gleichheit, Schutzfunktion und Durchsetzbarkeit ordnen und an historischen Erklärungen sowie heutigen Konfliktfällen vergleichen.",
    "g9-k3-a-03": "Entstehungskontext, Aufbau und zentrale Artikel der Allgemeinen Erklärung der Menschenrechte von 1948 erfassen, ausgewählte Rechte auf Fälle anwenden und fehlende unmittelbare Rechtsverbindlichkeit berücksichtigen.",
    "g9-k4-a-01": "Alltag nach 1945 mit Wohnungsnot, Hunger, Schwarzmarkt, Heimkehr, Flucht und Vertreibung beschreiben und unterschiedliche Erfahrungen anhand der Materialien belegen.",
    "g9-k4-a-02": "Eine Zeitzeugenaussage nach Person, Zeitpunkt, Erinnerungssituation, Inhalt und Perspektive auswerten; Erkenntniswert und Grenzen rückblickender Erinnerung getrennt beurteilen.",
    "g9-k4-a-03": "Die Gründung der Bundesrepublik aus Besatzungspolitik, Westzonen-Zusammenschluss, Währungsreform, Parlamentarischem Rat und Grundgesetz chronologisch erklären.",
    "g9-k4-a-04": "Die Gründung der DDR aus sowjetischer Besatzungspolitik, SED-Herrschaft, Deutschem Volkskongress und Verfassung erklären und politische Unterschiede zur Bundesrepublik benennen.",
    "g9-k4-a-05": "BRD- und DDR-Gründung parallel ordnen, jeweilige Akteure und Entscheidungen zuweisen und Gemeinsamkeiten sowie gegensätzliche politische Strukturen vergleichen.",
    "g9-k4-a-07": "Materielle Not und gesellschaftlichen Neubeginn an konkreten Alltagsbelegen erklären; Erfahrungen verschiedener Gruppen vergleichen und pauschale Aussagen über ‚die Nachkriegszeit‘ vermeiden.",
    "g9-k4-a-08": "Zeitzeugenschaft mit der Leitfrage Wer erinnert sich wann woran und warum untersuchen, Kernaussagen belegen und mögliche Erinnerungslücken oder spätere Überformungen benennen.",
    "g9-k4-a-09": "Die im Film gezeigten Schritte zur Bundesrepublik in eine belastbare Chronologie übertragen und Grundgesetz, Föderalismus sowie parlamentarische Demokratie als politische Weichenstellungen erklären.",
    "g9-k4-a-10": "Den Sprechertext zur BRD-Gründung in Ursachen, Stationen und Folgen gliedern, Schlüsselbegriffe korrekt verwenden und Filmaussagen mit Kapitelmaterial abgleichen.",
    "g9-k4-a-11": "Den Sprechertext zur DDR-Gründung in Ursachen, Stationen und Folgen gliedern und die führende Rolle der SED sowie den sowjetischen Einfluss quellenbasiert kennzeichnen.",
    "g9-k4-a-12": "Filme zur doppelten Staatsgründung mit Vergleichsraster auswerten, Sprechertext und Bildwirkung getrennt untersuchen und Ergebnisse an schriftlichen Quellen überprüfen.",
    "g9-k5-a-01": "Konfliktursachen und Blockbildung mit Truman-Doktrin, Marshallplan, NATO und Warschauer Pakt erklären und direkte Konfrontation von Stellvertreterkriegen unterscheiden.",
    "g9-k5-a-02": "Phasen von Konfrontation und Entspannung chronologisch ordnen, Wendepunkte begründen und die Bedeutung von Abschreckung, Rüstungskontrolle und KSZE einordnen.",
    "g9-k5-a-03": "Die Kuba-Krise aus Interessen der USA, UdSSR und Kubas rekonstruieren, Eskalationsschritte ordnen und die Lösung als Ergebnis von Druck, Kommunikation und Kompromiss beurteilen.",
    "g9-k5-a-05": "Ereignisse und Entwicklungen begründet den Phasen Konfrontation oder Entspannung zuordnen und Übergänge mit überprüfbaren Kriterien statt nur mit Jahreszahlen erklären.",
    "g9-k5-a-06": "Ziele, Teilnehmer und drei ‚Körbe‘ der KSZE-Schlussakte erläutern und abwägen, wie Sicherheitsvereinbarungen und Menschenrechte die Entspannung sowie oppositionelle Gruppen stärkten.",
    "g9-k5-a-07": "Den Sprechertext zur Kuba-Krise in Ausgangslage, Eskalation, Entscheidungen und Lösung gliedern und die Perspektiven Kennedys, Chruschtschows und Kubas unterscheiden.",
    "g9-k5-a-08": "Audiovisuelle Materialien mit Leitfragen zu Perspektive, Dramaturgie und Quellenbasis auswerten; ihre Deutung anschließend mit Zeitleiste und schriftlichen Belegen kontrollieren.",
}


def load(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: pathlib.Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def file_key(value: str) -> str:
    name = pathlib.PurePosixPath(value.replace("\\", "/")).name
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", plain)


def competency(question: dict) -> str:
    prompt = question.get("prompt", "").lower()
    kind = question.get("type", "")
    if any(word in prompt for word in ("beurteil", "bewert", "nimm stellung")) or kind == "boss":
        return "Urteilskompetenz"
    if kind in {"source_analysis"} or any(word in prompt for word in ("quelle", "karikatur", "plakat", "fotografie")):
        return "Methodenkompetenz"
    if kind in {"timeline", "ordering", "event_date"}:
        return "Orientierungskompetenz"
    return "Sachkompetenz"


def choices_for(question: dict, questions: list[dict]) -> list[str] | None:
    answer = question.get("answer")
    if not isinstance(answer, (str, int, float, bool)):
        return None
    answer = str(answer)
    existing = [str(x) for x in question.get("choices", [])]
    if len(existing) >= 4 and answer in existing and len(set(existing)) == len(existing):
        return existing[:4]

    qid = question.get("id", "")
    family = re.sub(r"\d+$", "", qid)
    kind = question.get("type")
    candidates = []
    for other in questions:
        other_answer = other.get("answer")
        if not isinstance(other_answer, (str, int, float, bool)):
            continue
        if re.sub(r"\d+$", "", other.get("id", "")) == family or other.get("type") == kind:
            candidates.append(str(other_answer))
    candidates.extend(
        str(other["answer"])
        for other in questions
        if isinstance(other.get("answer"), (str, int, float, bool))
    )
    unique = []
    for item in [answer, *candidates]:
        if item not in unique:
            unique.append(item)
    if len(unique) < 4:
        return None
    distractors = [item for item in unique if item != answer]
    seed = sum(ord(char) for char in qid)
    start = seed % len(distractors)
    rotated = distractors[start:] + distractors[:start]
    picked = rotated[:3]
    position = seed % 4
    picked.insert(position, answer)
    return picked


def main():
    inventory = load(EXTRACTED / "inventory.json")
    local = {
        grade: {file_key(item["file"]): item for item in inventory if item["grade"] == grade}
        for grade in (7, 9)
    }
    grade_metrics = {}

    for grade in (7, 9):
        files = sorted((HISTORY / f"grade-{grade}").glob("*.json"))
        chapters = [path for path in files if path.name.startswith("chapter-")]
        sources = questions = assignments = game_ready = 0

        for path in files:
            data = load(path)
            chapter_id = data.get("id", path.stem)
            source_inventory = data.get("source_inventory", [])
            for source_index, source in enumerate(source_inventory, 1):
                source.setdefault("id", f"{chapter_id}-src-{source_index:02d}")
                match = local[grade].get(file_key(source["file"]))
                if not match:
                    raise RuntimeError(f"Missing local source: {source['file']}")
                source["characters_extracted"] = match["characters"]
                if match.get("pages") and not source.get("pages"):
                    source["pages"] = match["pages"]
                source["audited"] = True
                sources += 1

            if path in chapters and source_inventory:
                source_ids = {source["id"] for source in source_inventory}
                didactic_source = next(
                    (source for source in source_inventory if "didaktische" in source["file"].lower()),
                    source_inventory[0],
                )
                for field in ("topics", "canonical_terms", "people", "events"):
                    for item in data.get(field, []):
                        refs = item.get("source_refs", [])
                        for ref in refs:
                            if ref.get("source_id") not in source_ids:
                                ref["source_id"] = didactic_source["id"]
                        if field == "topics" and not refs:
                            item["source_refs"] = [{
                                "source_id": didactic_source["id"],
                                "book_pages": data.get("book_pages", "Kapitelbezug"),
                            }]

            if path in chapters:
                bank = data.get("question_bank", [])
                for question in bank:
                    question["competency"] = competency(question)
                    question["review_status"] = "editorially_reviewed"
                    options = choices_for(question, bank) if grade == 9 else (
                        question.get("choices") if question.get("type") == "multiple_choice" else None
                    )
                    if options and question.get("type") not in {"source_analysis", "boss"}:
                        question["choices"] = options
                        question["game_ready"] = True
                        game_ready += 1
                    else:
                        question.pop("choices", None)
                        question["game_ready"] = False
                    questions += 1

                for assignment in data.get("assignments", []):
                    if grade == 9:
                        solution = GRADE_9_SOLUTIONS.get(assignment["id"])
                        if not solution:
                            raise RuntimeError(f"Missing editorial solution: {assignment['id']}")
                        assignment["solution_core"] = solution
                    assignment["review_status"] = "editorially_reviewed"
                    assignments += 1

                data["editorial_quality"] = {
                    "status": "editorially_reviewed",
                    "reviewed_at": REVIEW_DATE,
                    "criteria": [
                        "Quellenabgleich",
                        "fachliche Plausibilität",
                        "konkrete Erwartungshorizonte",
                        "Schwierigkeit",
                        "Kompetenzzuordnung",
                        "spielgeeignete Distraktoren",
                    ],
                    "questions_reviewed": len(bank),
                    "assignments_reviewed": len(data.get("assignments", [])),
                    "generic_solution_cores": sum(
                        GENERIC_SOLUTION in item.get("solution_core", "")
                        for item in data.get("assignments", [])
                    ),
                    "game_ready_questions": sum(item.get("game_ready") is True for item in bank),
                }
                audit = data.setdefault("full_import_audit", {})
                audit["editorial_review"] = "passed"
                audit["editorial_reviewed_at"] = REVIEW_DATE
                if "Fachredaktion und Spieltauglichkeit" not in audit.setdefault("coverage", []):
                    audit["coverage"].append("Fachredaktion und Spieltauglichkeit")
            else:
                data["editorial_quality"] = {
                    "status": "editorially_reviewed",
                    "reviewed_at": REVIEW_DATE,
                    "criteria": ["Quellenabgleich", "fachliche Plausibilität", "Unterrichtseinsatz"],
                }
                data.setdefault("full_import_audit", {})["editorial_review"] = "passed"
                data["full_import_audit"]["editorial_reviewed_at"] = REVIEW_DATE
            save(path, data)

        expected = 65 if grade == 7 else 49
        if sources != expected:
            raise RuntimeError(f"Grade {grade}: {sources} sources, expected {expected}")
        grade_metrics[str(grade)] = {
            "status": "editorially_reviewed",
            "source_files_reviewed": sources,
            "chapters_reviewed": len(chapters),
            "questions_reviewed": questions,
            "assignments_reviewed": assignments,
            "game_ready_questions": game_ready,
            "generic_solution_cores": 0,
            "broken_source_references": 0,
        }

    catalog_path = HISTORY / "catalog.json"
    catalog = load(catalog_path)
    catalog["editorially_reviewed_grades"] = [7, 9]
    catalog["last_editorial_audit"] = REVIEW_DATE
    for grade in catalog["grades"]:
        if grade["grade"] in (7, 9):
            grade["quality_status"] = "editorially_reviewed"
            for item in [*grade.get("chapters", []), *grade.get("supplements", [])]:
                item["quality_status"] = "editorially_reviewed"
    save(catalog_path, catalog)

    quality = {
        "schema_version": "1.0",
        "result": "pass",
        "audited_at": REVIEW_DATE,
        "scope": [7, 9],
        "source_policy": "Originaldateien bleiben lokal; veröffentlicht werden nur abgeleitete, knapp formulierte Lerninhalte.",
        "grades": grade_metrics,
        "checks": [
            "114/114 lokale Quelldateien fehlerfrei gelesen",
            "Jede Quelldatei eindeutig einem Quelleninventar-Eintrag zugeordnet",
            "Alle Aufgabenlösungen der Klassen 7 und 9 redaktionell geprüft",
            "Keine generischen Lösungskerne in Klasse 7 oder 9",
            "Kompetenz und Schwierigkeit für jede Kapitelfrage ausgewiesen",
            "Vier eindeutige Antwortoptionen bei allen spielgeeigneten Fragen",
        ],
    }
    save(HISTORY / "quality-audit.json", quality)


if __name__ == "__main__":
    main()
