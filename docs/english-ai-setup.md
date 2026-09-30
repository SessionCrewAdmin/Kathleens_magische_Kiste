# Optionale KI für die English Knowledge Base

Die lokale Erkennung bleibt immer der erste und vollständig nutzbare Weg. Claude oder OpenAI werden nur nach einem bewussten Klick für einen einzelnen Aufgabenausschnitt aufgerufen.

## Architektur

- Der Browser zeigt vorab exakt, welche Metadaten, Texte und gegebenenfalls welcher Bildausschnitt übertragen werden.
- Die Lehrkraft bestätigt jede Übertragung einzeln.
- Der Browser enthält keine Anbieter-Schlüssel.
- Die Supabase Edge Function `english-ai-assistant` prüft die Anmeldung und ruft den gewählten Anbieter serverseitig auf.
- Vollständige Originaldateien werden nicht übertragen.
- Antworten werden als ungeprüfte KI-Vorschläge lokal gespeichert. Prüfstatus und Freigaben bleiben unverändert.
- Neu erzeugte Bilder werden getrennt von Originalbildern gespeichert und als KI-generiert markiert.

## Anbieter

Claude und OpenAI können parallel eingerichtet werden. Claude eignet sich als Textanbieter für Analyse, Lösungsvorschläge und Varianten. OpenAI unterstützt dieselben Textaktionen und zusätzlich die Bildneuerstellung.

Eine Claude.ai- oder ChatGPT-Mitgliedschaft enthält nicht automatisch API-Nutzung. Für die App werden getrennte API-Zugänge und deren eigene Abrechnung benötigt.

## Einmalige Aktivierung

Die Schlüssel niemals in Quellcode, Chat, Browser-Speicher oder GitHub eintragen. Im Supabase-Dashboard unter **Edge Functions → Secrets** setzen:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Optionale Modellauswahl:

- `ANTHROPIC_MODEL=claude-sonnet-5`
- `OPENAI_TEXT_MODEL=gpt-6-luna`
- `OPENAI_IMAGE_MODEL=gpt-image-2.5-flare`

Es genügt, nur einen Textanbieter einzurichten. Für neue Bilder ist ein OpenAI-API-Zugang erforderlich. Nach dem Setzen der Secrets muss die bereits veröffentlichte Edge Function nicht erneut bereitgestellt werden.

## Datenschutz und Kosten

Vor jeder Anfrage nennt die Oberfläche Zweck, Anbieter und übertragenen Ausschnitt. Anbieter-Verarbeitung und API-Kosten richten sich nach dem jeweiligen Konto. Die App erteilt niemals automatisch eine fachliche Freigabe und lädt keine Originaldokumente im Hintergrund hoch.
