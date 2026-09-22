import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHandler } from "./handler.mjs";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const table = () => db.from("canva_connections");
async function checked(query: any) { const {data,error} = await query; if(error) throw new Error("Datenbank nicht bereit."); return data; }
const store = {
  async authenticate(pass: string) { const {data,error} = await db.rpc("classroom_authenticate", {p_passphrase:pass}); return !error && data === true; },
  async cleanup(now: number) { await checked(table().delete().lt("expires_at",now)); },
  async insert(row: any) { await checked(table().insert(row)); },
  async get(hash: string) { return checked(table().select("*").eq("token_hash",hash).maybeSingle()); },
  async update(hash: string, patch: any) { await checked(table().update(patch).eq("token_hash",hash)); },
  async remove(hash: string) { await checked(table().delete().eq("token_hash",hash)); },
  async lock(hash: string, now: number) { return !!(await checked(table().update({lock_until:now+120000}).eq("token_hash",hash).lt("lock_until",now).select("token_hash").maybeSingle())); }
};
Deno.serve(createHandler({store, env: name => Deno.env.get(name), fetch: globalThis.fetch}));
