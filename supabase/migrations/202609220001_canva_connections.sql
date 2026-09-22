-- Only the Edge Function may read Canva credentials. No browser policies.
create table if not exists public.canva_connections (
  token_hash text primary key,
  expires_at bigint not null,
  lock_until bigint not null default 0,
  state_hash text,
  verifier text,
  pending_until bigint,
  credentials jsonb,
  export_id text
);
alter table public.canva_connections enable row level security;
revoke all on public.canva_connections from public, anon, authenticated;
grant select, insert, update, delete on public.canva_connections to service_role;
create index if not exists canva_connections_expiry on public.canva_connections(expires_at);
