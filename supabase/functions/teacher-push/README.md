# V23.4 Teacher Push – einmaliges Supabase-Setup

Der Push-Bereich ist ausschließlich für Kathleen/Frau Müller gedacht. Schülergeräte werden nicht registriert.

## 1. SQL
Im Supabase SQL Editor ausführen:

`setup/V23_4_TEACHER_PUSH.sql`

## 2. VAPID-Schlüsselpaar erzeugen
Zum Beispiel lokal:

```bash
npx web-push generate-vapid-keys
```

Den **Public Key** und **Private Key** getrennt aufbewahren. Den Private Key niemals in Git committen.

## 3. Edge-Function Secrets setzen

```bash
supabase secrets set VAPID_PUBLIC_KEY="DEIN_PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="DEIN_PRIVATE_KEY"
# optional: eigener VAPID-Kontakt; ohne Angabe wird die Kisten-URL verwendet
supabase secrets set VAPID_SUBJECT="https://sessioncrewadmin.github.io/Kathleens_magische_Kiste/"
```

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden von Supabase Edge Functions automatisch bereitgestellt.

## 4. Edge Function deployen

```bash
supabase functions deploy teacher-push --no-verify-jwt
```

`--no-verify-jwt` ist hier beabsichtigt: Die Aktionen zum Registrieren, Senden und Planen verwenden ein kurzlebiges Push-Admin-Token. Dieses wird nach Prüfung des Kisten-Adminpassworts über die SQL-RPC `teacher_push_issue_token` ausgestellt; das Adminpasswort wird nicht an die Edge Function gesendet. Nur `config` und der idempotente Cron-Lauf `run_due` sind ohne Adminpasswort erreichbar.

## 5. In Kathleens Kiste
**Push Center** öffnen → **Benachrichtigungen aktivieren** → Gerät registrieren → **Test-Push senden**.

### iPhone / iPad
Web Push funktioniert für die installierte Home-Screen-PWA. Die Kiste zuerst über Safari **Zum Home-Bildschirm** hinzufügen und dann aus der installierten App heraus die Benachrichtigungen aktivieren.

### Erinnerungen
Der SQL-Patch richtet einen Cronjob ein, der einmal pro Minute fällige Erinnerungen verarbeitet. Unterstützt werden:
- einmalig
- täglich
- werktags (Mo–Fr)

Die Zeitzone ist standardmäßig `Europe/Berlin`.


## V23.6 · Stundenplan-Erinnerungen

Für den Stundenplan kommt zusätzlich der nicht-destruktive SQL-Patch:

`setup/V23_6_TIMETABLE_PUSH.sql`

Er erweitert Teacher Push um **wöchentliche Erinnerungen** und um die Quelle `timetable`.
Danach die Edge Function erneut deployen:

```bash
supabase functions deploy teacher-push --no-verify-jwt
```

Im Stundenplan-Tool werden aktivierte Unterrichtsstunden über **Push synchronisieren** als wöchentliche Erinnerungen gespeichert. Der Zeitpunkt wird automatisch auf **10 Minuten vor Stundenbeginn** gesetzt.
