create table if not exists public."zelo-leads-lançamento" (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  whatsapp_normalizado text not null,
  origem text not null default 'direto',
  canal text not null default 'direto',
  campanha text,
  conjunto_anuncio text,
  criativo text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  click_id text,
  click_id_tipo text,
  referrer text,
  landing_page text,
  tracking_data jsonb not null default '{}'::jsonb,
  device_type text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint zelo_leads_lancamento_nome_check
    check (char_length(btrim(nome)) between 2 and 120),
  constraint zelo_leads_lancamento_whatsapp_check
    check (whatsapp_normalizado ~ '^[0-9]{8,15}$'),
  constraint zelo_leads_lancamento_origem_check
    check (char_length(origem) between 2 and 50),
  constraint zelo_leads_lancamento_canal_check
    check (char_length(canal) between 2 and 80),
  constraint zelo_leads_lancamento_whatsapp_unique
    unique (whatsapp_normalizado)
);

comment on table public."zelo-leads-lançamento" is
  'Leads do pré-lançamento Zelo com atribuição completa de marketing.';
comment on column public."zelo-leads-lançamento".origem is
  'Origem normalizada: trafego_pago, organico, instagram_dm, whatsapp, direto ou outro.';
comment on column public."zelo-leads-lançamento".canal is
  'Canal normalizado, por exemplo meta_ads, google_ads, instagram, whatsapp ou direto.';
comment on column public."zelo-leads-lançamento".tracking_data is
  'JSON com first_touch, last_touch e parâmetros de campanha permitidos.';

create index if not exists zelo_leads_lancamento_created_at_idx
  on public."zelo-leads-lançamento" (created_at desc);
create index if not exists zelo_leads_lancamento_origem_canal_idx
  on public."zelo-leads-lançamento" (origem, canal);
create index if not exists zelo_leads_lancamento_campanha_idx
  on public."zelo-leads-lançamento" (campanha);
create index if not exists zelo_leads_lancamento_criativo_idx
  on public."zelo-leads-lançamento" (criativo);

alter table public."zelo-leads-lançamento" enable row level security;

revoke all on table public."zelo-leads-lançamento" from anon, authenticated;
grant insert on table public."zelo-leads-lançamento" to anon, authenticated;

drop policy if exists "zelo_leads_lancamento_public_insert" on public."zelo-leads-lançamento";
create policy "zelo_leads_lancamento_public_insert"
  on public."zelo-leads-lançamento"
  for insert
  to anon, authenticated
  with check (true);
