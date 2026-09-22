# Canva-Konto mit dem Whiteboard verbinden

## Einmalige Freischaltung

Die Oberfläche und die Serverfunktion gehören zum Repository. GitHub Pages allein kann keine Canva-Zugangsdaten sicher verarbeiten. Die Funktion muss zusätzlich im bestehenden Supabase-Projekt veröffentlicht werden.

1. Im [Canva-Entwicklerportal](https://www.canva.com/developers/integrations) eine Integration für „Kathleens magische Kiste“ anlegen. Den für das eigene Konto verfügbaren Integrationsmodus wählen; für eine öffentliche Nutzung durch weitere Konten die aktuellen Canva-Prüfanforderungen beachten.
2. Die Berechtigungen `design:meta:read` und `design:content:read` aktivieren. Es werden keine Schreibrechte benötigt.
3. Als Redirect-URL exakt die veröffentlichte Whiteboard-URL mit `canva-callback.html` verwenden. Für die GitHub-Pages-Standardadresse lautet sie:
   `https://sessioncrewadmin.github.io/Kathleens_magische_Kiste/tools/classroom-board/canva-callback.html`
   Bei einer eigenen Domain muss stattdessen deren tatsächliche URL verwendet werden. Herkunft und Redirect müssen zu dem Whiteboard passen, das die Lehrkraft öffnet.
4. Im Supabase SQL Editor `supabase/migrations/202609220001_canva_connections.sql` ausführen.
5. Im Supabase-Projekt unter **Edge Functions → Secrets** diese Werte eintragen:
   - `CANVA_CLIENT_ID`: Client-ID der Canva-Integration
   - `CANVA_CLIENT_SECRET`: Client-Secret der Canva-Integration
   - `CANVA_REDIRECT_URI`: dieselbe vollständige Redirect-URL wie in Schritt 3
   - `CANVA_TOKEN_KEY`: 32 zufällige Bytes, Base64-kodiert. Beispielsweise lokal mit `openssl rand -base64 32` erzeugen.
   Die automatisch gesetzten Werte `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` verwendet die Funktion ebenfalls.
6. Die Funktion aus dem Repository veröffentlichen:
   ```sh
   supabase functions deploy canva-connect --project-ref fzqxnjhuvgpgovcovosl --no-verify-jwt
   ```
   Sie prüft selbst das bestehende Kisten-Adminpasswort beim Verbindungsaufbau und anschließend eine zufällige, gehashte Sitzung. Supabase-JWT-Verifikation darf diese Anfragen nicht vorher abweisen.

**Client-Secret, Token-Schlüssel und Service-Role-Key gehören ausschließlich in die Supabase-Secrets, niemals in GitHub, das Whiteboard oder einen Chat.**

## Verwendung

Im Whiteboard die Widgets öffnen, **Canva** auswählen und **Canva-Konto verbinden** anklicken. Das Kisten-Adminpasswort eingeben, falls es noch nicht in der Sitzung vorliegt. Canva öffnet sich in einem eigenen Fenster. Nach der Zustimmung erscheinen die eigenen und freigegebenen Designs mit Suchfunktion und weiteren Ergebnisseiten.

Ein Design anklicken: Es wird über einen PDF-Export in einzelne Folienbilder umgewandelt. Erst nach vollständigem Import wird das Board ergänzt bzw. das ausgewählte Canva-Element ersetzt. Die Folien werden zusammen mit dem Board im Browser gespeichert. Auf dem Element kann die Lehrkraft vor- und zurückblättern; der bestehende Classroom-Abgleich überträgt die Folienposition auf Beamer und Schüleransichten.

Das Konto kann in der Canva-Auswahl getrennt werden. Bereits importierte Folien bleiben dabei erhalten. Die Verbindung gilt für die aktuelle Browsersitzung, höchstens acht Stunden; danach ist eine neue Verbindung erforderlich. Abgelaufene serverseitige Datensätze werden beim nächsten erfolgreichen Verbindungsaufbau bereinigt. OAuth-Tokens sind AES-GCM-verschlüsselt und ausschließlich für die Serverfunktion lesbar.

## Grenzen

- Der Import enthält statische Folien. Animationen, Videos, Musik und klickbare Canva-Links bleiben in Canva.
- Änderungen in Canva werden über **Ersetzen / aktualisieren** und erneute Auswahl desselben Designs übernommen.
- Maximal 60 Seiten, 25 MB Export-PDF und 8 MB gespeicherte Folienbilder pro Element. Die Grenzen schützen den lokalen Boardspeicher und die Classroom-Übertragung.
- Die ausgewählten Inhalte werden Teil des geteilten Boards. Canva-Kontotokens sowie persönliche, zeitlich begrenzte Ansichts- und Bearbeitungslinks werden dabei nicht mitgespeichert.
- Canva muss den Export des gewählten Designs erlauben; Premium-Inhalte können ihn je nach Konto einschränken.
- Der Live-Test mit einem echten Canva-Konto ist erst nach der obigen Freischaltung möglich. Automatisierte Tests verwenden isolierte Testantworten, keine echten Kontodaten.

## Technische Prüfung

`node --test tests/canva-server.test.mjs` prüft Anmeldung, Sitzungsbindung, Verschlüsselung, Token-Erneuerung, Fehlerfälle und Exportzugriff. `node tests/canva-browser.cjs` prüft die Oberfläche, Import, Speichern, Folienwechsel sowie Desktop-/Mobilansichten mit Playwright und einem lokalen Server auf Port 8765. Siehe Testdatei für Voraussetzungen.

Referenzen: [Canva-Anmeldung](https://www.canva.dev/docs/connect/authentication/), [Designauswahl](https://www.canva.dev/docs/connect/api-reference/designs/list-designs/), [Designexport](https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/).
