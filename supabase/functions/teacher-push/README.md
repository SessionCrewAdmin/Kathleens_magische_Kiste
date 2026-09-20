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
supabase secrets set VAPID_SUBJECT="mailto:DEINE_MAILADRESSE"
```

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden von Supabase Edge Functions automatisch bereitgestellt.

## 4. Edge Function deployen

```bash
supabase functions deploy teacher-push --no-verify-jwt
```

`--no-verify-jwt` ist hier beabsichtigt: Die Aktionen zum Registrieren, Senden und Planen prüfen zusätzlich das Kisten-Adminpasswort. Nur `config` und der idempotente Cron-Lauf `run_due` sind ohne Adminpasswort erreichbar.

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
