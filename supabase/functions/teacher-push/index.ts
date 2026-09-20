import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "https://sessioncrewadmin.github.io/Kathleens_magische_Kiste/";
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function configured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
async function hasAdminToken(token: string) {
  if (!token) return false;
  const { data, error } = await db.rpc("teacher_push_check_token", { p_token: token });
  return !error && data === true;
}
function cleanText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}
function safeTarget(value: unknown) {
  const v = cleanText(value, 500);
  if (!v) return "./";
  if (v.startsWith("https://sessioncrewadmin.github.io/Kathleens_magische_Kiste/")) return v;
  if (v.startsWith("./") || v.startsWith("../") || v.startsWith("/Kathleens_magische_Kiste/")) return v;
  return "./";
}
async function activeSubscriptions() {
  const { data, error } = await db.from("teacher_push_subscriptions").select("*").eq("active", true);
  if (error) throw error;
  return data || [];
}
async function sendPayload(payload: Record<string, unknown>) {
  if (!configured()) return { delivered: 0, failed: 0, configured: false };
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const subscriptions = await activeSubscriptions();
  let delivered = 0, failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, JSON.stringify(payload), { TTL: 3600, urgency: "normal" });
      delivered++;
      await db.from("teacher_push_subscriptions").update({
        last_success_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
    } catch (err) {
      failed++;
      const status = Number((err as any)?.statusCode || (err as any)?.status || 0);
      const message = String((err as any)?.message || err).slice(0, 500);
      await db.from("teacher_push_subscriptions").update({
        active: !(status === 404 || status === 410),
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
    }
  }
  return { delivered, failed, configured: true, subscriptions: subscriptions.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const action = String(body?.action || "");

  try {
    if (action === "config") {
      return json({ ok: true, configured: configured(), publicKey: VAPID_PUBLIC_KEY || null });
    }

    if (action === "run_due") {
      if (!configured()) return json({ ok: false, error: "push_not_configured" }, 503);
      const { data: due, error } = await db.rpc("teacher_push_claim_due", { p_limit: 20 });
      if (error) throw error;
      let processed = 0, delivered = 0;
      for (const reminder of due || []) {
        const result = await sendPayload({
          title: reminder.title,
          body: reminder.body,
          url: reminder.target_url || "./",
          tag: "teacher-reminder-" + reminder.id,
          reminderId: reminder.id,
        });
        const ok = result.delivered > 0;
        await db.rpc("teacher_push_finish_reminder", { p_id: reminder.id, p_delivered: ok });
        processed++;
        delivered += result.delivered;
      }
      return json({ ok: true, processed, delivered });
    }

    const adminToken = String(body?.adminToken || "");
    if (!(await hasAdminToken(adminToken))) return json({ ok: false, error: "admin_required" }, 401);

    if (action === "sync_timetable") {
      const timezone = cleanText(body?.timezone, 80) || "Europe/Berlin";
      const rawEntries = Array.isArray(body?.entries) ? body.entries.slice(0, 100) : [];
      const keepKeys: string[] = [];
      let synced = 0;

      for (const raw of rawEntries) {
        const sourceKey = cleanText(raw?.key, 120);
        const title = cleanText(raw?.title, 120);
        const message = cleanText(raw?.body, 500);
        const scheduledFor = new Date(String(raw?.scheduledFor || ""));
        if (!sourceKey || !title || Number.isNaN(scheduledFor.getTime())) continue;
        if (scheduledFor.getTime() < Date.now() - 60000) continue;

        keepKeys.push(sourceKey);
        const payload = {
          title,
          body: message,
          target_url: safeTarget(raw?.url),
          scheduled_for: scheduledFor.toISOString(),
          recurrence: "weekly",
          timezone_name: timezone,
          active: true,
          processing_at: null,
          source: "timetable",
          source_key: sourceKey,
          updated_at: new Date().toISOString(),
        };

        const { data: existing, error: findError } = await db.from("teacher_push_reminders")
          .select("id")
          .eq("source", "timetable")
          .eq("source_key", sourceKey)
          .limit(1)
          .maybeSingle();
        if (findError) throw findError;

        if (existing?.id) {
          const { error } = await db.from("teacher_push_reminders").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await db.from("teacher_push_reminders").insert(payload);
          if (error) throw error;
        }
        synced++;
      }

      const { data: activeTimetable, error: listError } = await db.from("teacher_push_reminders")
        .select("id,source_key")
        .eq("source", "timetable")
        .eq("active", true);
      if (listError) throw listError;

      const stale = (activeTimetable || []).filter((r: any) => !keepKeys.includes(String(r.source_key || "")));
      for (const row of stale) {
        const { error } = await db.from("teacher_push_reminders")
          .update({ active: false, processing_at: null, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) throw error;
      }

      return json({ ok: true, synced, disabled: stale.length });
    }

    if (action === "subscribe") {
      const s = body?.subscription || {};
      const endpoint = cleanText(s.endpoint, 4000);
      const p256dh = cleanText(s?.keys?.p256dh, 1000);
      const auth = cleanText(s?.keys?.auth, 1000);
      if (!endpoint || !p256dh || !auth) return json({ ok: false, error: "invalid_subscription" }, 400);

      const { error } = await db.from("teacher_push_subscriptions").upsert({
        endpoint, p256dh, auth,
        device_label: cleanText(body?.deviceLabel, 80) || "Kathleens Gerät",
        user_agent: cleanText(body?.userAgent, 500),
        active: true, last_error: null, updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "unsubscribe") {
      const endpoint = cleanText(body?.endpoint, 4000);
      if (!endpoint) return json({ ok: false, error: "endpoint_required" }, 400);
      const { error } = await db.from("teacher_push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("endpoint", endpoint);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "status") {
      const { data: devices, error: e1 } = await db.from("teacher_push_subscriptions")
        .select("id,device_label,active,last_success_at,last_error,created_at,updated_at")
        .order("updated_at", { ascending: false });
      if (e1) throw e1;
      const { data: reminders, error: e2 } = await db.from("teacher_push_reminders")
        .select("id,title,body,target_url,scheduled_for,recurrence,timezone_name,active,last_sent_at,source,source_key")
        .eq("active", true).order("scheduled_for", { ascending: true }).limit(100);
      if (e2) throw e2;
      return json({ ok: true, configured: configured(), devices: devices || [], reminders: reminders || [] });
    }

    if (action === "test" || action === "send") {
      const title = cleanText(body?.title, 120) || "Kathleens Kiste";
      const message = cleanText(body?.body, 500) || "Push-Benachrichtigungen funktionieren.";
      const result = await sendPayload({ title, body: message, url: safeTarget(body?.url), tag: "teacher-push-" + Date.now() });
      return json({ ok: true, ...result });
    }

    if (action === "schedule") {
      const title = cleanText(body?.title, 120);
      const message = cleanText(body?.body, 500);
      const scheduledFor = new Date(String(body?.scheduledFor || ""));
      const recurrence = ["none", "daily", "weekdays", "weekly"].includes(String(body?.recurrence)) ? String(body.recurrence) : "none";
      if (!title || Number.isNaN(scheduledFor.getTime())) return json({ ok: false, error: "invalid_reminder" }, 400);
      if (scheduledFor.getTime() < Date.now() - 60000) return json({ ok: false, error: "reminder_in_past" }, 400);

      const { data, error } = await db.from("teacher_push_reminders").insert({
        title, body: message, target_url: safeTarget(body?.url),
        scheduled_for: scheduledFor.toISOString(), recurrence,
        timezone_name: cleanText(body?.timezone, 80) || "Europe/Berlin",
      }).select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data?.id });
    }

    if (action === "cancel") {
      const id = cleanText(body?.id, 80);
      const { error } = await db.from("teacher_push_reminders").update({ active: false, processing_at: null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String((err as any)?.message || err).slice(0, 800) }, 500);
  }
});
