-- TJMG Fiscal PWA - Supabase PRO Schema
-- Gerado a partir do código-fonte enviado pelo usuário.
-- Compatível com o app atual via tabelas app_users e inspections,
-- e com camada PRO normalizada por gatilhos sobre payload JSON.

begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ===== Funções utilitárias =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.norm_txt(v text)
returns text
language sql
immutable
as $$
  select nullif(btrim(v),'');
$$;

-- ===== Catálogos =====
create table if not exists public.regioes (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  cor text,
  cor_fundo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.polos (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid not null references public.regioes(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(regiao_id, nome)
);

create table if not exists public.comarcas (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid not null references public.regioes(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(regiao_id, nome)
);

create table if not exists public.edificacoes (
  id uuid primary key default gen_random_uuid(),
  regiao_id uuid not null references public.regioes(id) on delete cascade,
  polo_id uuid references public.polos(id) on delete set null,
  comarca_id uuid not null references public.comarcas(id) on delete cascade,
  nome text not null,
  grupo text not null check (grupo in ('A','B','C')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(regiao_id, comarca_id, nome)
);

create table if not exists public.grupo_rules (
  grupo text primary key check (grupo in ('A','B','C')),
  rotulo text not null,
  sistemas jsonb not null default '[]'::jsonb,
  skip jsonb not null default '{}'::jsonb,
  allowed jsonb not null default '{}'::jsonb,
  periodos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_types (
  codigo text primary key,
  rotulo text not null,
  cor text,
  cor_fundo text,
  icone text,
  etapas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.status_catalog (
  codigo text primary key,
  rotulo text not null,
  emoji text,
  cor text,
  cor_fundo text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.systems_catalog (
  id text primary key,
  codigo text,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities_catalog (
  id text primary key,
  system_id text not null references public.systems_catalog(id) on delete cascade,
  codigo text,
  nome text not null,
  descricao text,
  periodicidade_meses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_catalog (
  codigo text primary key,
  descricao text not null,
  unidade text not null,
  valor_ref numeric(14,2),
  origem_tipo text not null check (origem_tipo in ('periodica','programada','emergencial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prontuario_itens_catalog (
  codigo text primary key,
  rotulo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subestacao_secoes_catalog (
  codigo text primary key,
  rotulo text not null,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Tabelas do app / compatibilidade =====
create table if not exists public.app_users (
  id text primary key,
  nome text not null,
  mat text,
  pin text,
  reg text not null,
  cargo text,
  polo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.inspection_index (
  inspection_id text primary key references public.inspections(id) on delete cascade,
  tipo text,
  status text,
  comarca text,
  edificacao text,
  polo text,
  grupo text,
  regiao text,
  fiscal text,
  matricula text,
  data_registro timestamptz,
  data_vistoria date,
  os_numero text,
  descricao text,
  dt_inicio_exec date,
  dt_final_exec date,
  dias_prazo integer,
  ativ text,
  causas text,
  lim text,
  normas text,
  conclusao text,
  snapshot jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_systems (
  inspection_id text not null references public.inspections(id) on delete cascade,
  system_id text not null,
  created_at timestamptz not null default now(),
  primary key (inspection_id, system_id)
);

create table if not exists public.inspection_selected_activities (
  inspection_id text not null references public.inspections(id) on delete cascade,
  activity_id text not null,
  selecionada boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (inspection_id, activity_id)
);

create table if not exists public.inspection_items (
  inspection_id text not null references public.inspections(id) on delete cascade,
  item_key text not null,
  item_codigo text,
  nome text,
  status text,
  observacao text,
  fotos jsonb not null default '[]'::jsonb,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (inspection_id, item_key)
);

create table if not exists public.inspection_materials (
  inspection_id text not null references public.inspections(id) on delete cascade,
  origem text not null check (origem in ('global','item')),
  item_key text,
  codigo text not null,
  descricao text,
  unidade text,
  quantidade numeric(14,3),
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (inspection_id, origem, item_key, codigo)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  inspection_id text,
  user_id text,
  evento text not null,
  mensagem text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  inspection_id text,
  user_id text,
  origem text not null,
  mensagem text not null,
  detalhes jsonb not null default '{}'::jsonb,
  resolvido boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  dispositivo_id text,
  entidade text not null,
  entidade_pk text not null,
  operacao text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendente',
  tentativas integer not null default 0,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_regioes_updated_at on public.regioes;
create trigger trg_regioes_updated_at before update on public.regioes for each row execute function public.set_updated_at();
drop trigger if exists trg_polos_updated_at on public.polos;
create trigger trg_polos_updated_at before update on public.polos for each row execute function public.set_updated_at();
drop trigger if exists trg_comarcas_updated_at on public.comarcas;
create trigger trg_comarcas_updated_at before update on public.comarcas for each row execute function public.set_updated_at();
drop trigger if exists trg_edificacoes_updated_at on public.edificacoes;
create trigger trg_edificacoes_updated_at before update on public.edificacoes for each row execute function public.set_updated_at();
drop trigger if exists trg_grupo_rules_updated_at on public.grupo_rules;
create trigger trg_grupo_rules_updated_at before update on public.grupo_rules for each row execute function public.set_updated_at();
drop trigger if exists trg_form_types_updated_at on public.form_types;
create trigger trg_form_types_updated_at before update on public.form_types for each row execute function public.set_updated_at();
drop trigger if exists trg_status_catalog_updated_at on public.status_catalog;
create trigger trg_status_catalog_updated_at before update on public.status_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_systems_catalog_updated_at on public.systems_catalog;
create trigger trg_systems_catalog_updated_at before update on public.systems_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_activities_catalog_updated_at on public.activities_catalog;
create trigger trg_activities_catalog_updated_at before update on public.activities_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_material_catalog_updated_at on public.material_catalog;
create trigger trg_material_catalog_updated_at before update on public.material_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_prontuario_itens_catalog_updated_at on public.prontuario_itens_catalog;
create trigger trg_prontuario_itens_catalog_updated_at before update on public.prontuario_itens_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_subestacao_secoes_catalog_updated_at on public.subestacao_secoes_catalog;
create trigger trg_subestacao_secoes_catalog_updated_at before update on public.subestacao_secoes_catalog for each row execute function public.set_updated_at();
drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at before update on public.app_users for each row execute function public.set_updated_at();
drop trigger if exists trg_inspection_index_updated_at on public.inspection_index;
create trigger trg_inspection_index_updated_at before update on public.inspection_index for each row execute function public.set_updated_at();
drop trigger if exists trg_inspection_items_updated_at on public.inspection_items;
create trigger trg_inspection_items_updated_at before update on public.inspection_items for each row execute function public.set_updated_at();
drop trigger if exists trg_sync_queue_updated_at on public.sync_queue;
create trigger trg_sync_queue_updated_at before update on public.sync_queue for each row execute function public.set_updated_at();

-- ===== Parser do payload bruto para camada PRO =====
create or replace function public.sync_inspection_projection()
returns trigger
language plpgsql
as $$
declare
  p jsonb;
  d jsonb;
  item_key text;
  item_val jsonb;
  mat jsonb;
begin
  p := new.payload;
  d := coalesce(p->'d', '{}'::jsonb);

  insert into public.inspection_index (
    inspection_id, tipo, status, comarca, edificacao, polo, grupo, regiao,
    fiscal, matricula, data_registro, data_vistoria, os_numero, descricao,
    dt_inicio_exec, dt_final_exec, dias_prazo, ativ, causas, lim, normas, conclusao,
    snapshot, payload, created_at, updated_at
  )
  values (
    new.id,
    coalesce(p->>'tipo', p->>'form_type'),
    coalesce(p->>'st', p->>'status'),
    coalesce(p->>'com', d->>'com'),
    coalesce(p->>'edif', d->>'edif'),
    coalesce(p->>'polo', d->>'polo'),
    coalesce(p->>'grupo', d->>'grp', p->>'grp'),
    coalesce(p->>'reg', d->>'reg'),
    coalesce(p->>'fiscal', d->>'fiscal'),
    coalesce(p->>'mat', d->>'mat'),
    coalesce(nullif(p->>'data','')::timestamptz, now()),
    nullif(coalesce(p->>'dtVistoria', d->>'dtVistoria'),'')::date,
    coalesce(p->>'os', d->>'os'),
    coalesce(p->>'descricao', d->>'descricao'),
    nullif(coalesce(p->>'dtInicioExec', d->>'dtInicioExec'),'')::date,
    nullif(coalesce(p->>'dtFinalExec', d->>'dtFinalExec'),'')::date,
    nullif(coalesce(p->>'diasPrazo', d->>'diasPrazo'),'')::integer,
    p->>'ativ',
    p->>'causas',
    p->>'lim',
    p->>'normas',
    p->>'concl',
    coalesce(p->'snap','{}'::jsonb),
    p,
    coalesce(nullif(p->>'data','')::timestamptz, now()),
    now()
  )
  on conflict (inspection_id) do update set
    tipo = excluded.tipo,
    status = excluded.status,
    comarca = excluded.comarca,
    edificacao = excluded.edificacao,
    polo = excluded.polo,
    grupo = excluded.grupo,
    regiao = excluded.regiao,
    fiscal = excluded.fiscal,
    matricula = excluded.matricula,
    data_registro = excluded.data_registro,
    data_vistoria = excluded.data_vistoria,
    os_numero = excluded.os_numero,
    descricao = excluded.descricao,
    dt_inicio_exec = excluded.dt_inicio_exec,
    dt_final_exec = excluded.dt_final_exec,
    dias_prazo = excluded.dias_prazo,
    ativ = excluded.ativ,
    causas = excluded.causas,
    lim = excluded.lim,
    normas = excluded.normas,
    conclusao = excluded.conclusao,
    snapshot = excluded.snapshot,
    payload = excluded.payload,
    updated_at = now();

  delete from public.inspection_systems where inspection_id = new.id;
  insert into public.inspection_systems (inspection_id, system_id)
  select new.id, jsonb_array_elements_text(coalesce(p->'sistemas','[]'::jsonb));

  delete from public.inspection_selected_activities where inspection_id = new.id;
  insert into public.inspection_selected_activities (inspection_id, activity_id, selecionada)
  select new.id, key, (value in ('true'::jsonb, '1'::jsonb) or coalesce(value::text,'') in ('true','1'))
  from jsonb_each(coalesce(p->'ativSel','{}'::jsonb))
  where (value in ('true'::jsonb, '1'::jsonb) or coalesce(value::text,'') in ('true','1'));

  delete from public.inspection_items where inspection_id = new.id;
  delete from public.inspection_materials where inspection_id = new.id;

  for item_key, item_val in
    select key, value from jsonb_each(coalesce(p->'itens','{}'::jsonb))
  loop
    insert into public.inspection_items (
      inspection_id, item_key, item_codigo, nome, status, observacao, fotos, dados
    ) values (
      new.id,
      item_key,
      regexp_replace(item_key, '^[^_]*_', ''),
      coalesce(item_val->>'nm', item_val->>'nome'),
      coalesce(item_val->>'s', item_val->>'status'),
      coalesce(item_val->>'obs', item_val->>'observacao'),
      coalesce(item_val->'fotos', '[]'::jsonb),
      item_val
    );

    if jsonb_typeof(coalesce(item_val->'mats','[]'::jsonb)) = 'array' then
      for mat in select value from jsonb_array_elements(coalesce(item_val->'mats','[]'::jsonb))
      loop
        insert into public.inspection_materials (
          inspection_id, origem, item_key, codigo, descricao, unidade, quantidade, dados
        ) values (
          new.id,
          'item',
          item_key,
          coalesce(mat->>'c', md5(mat::text)),
          mat->>'d',
          mat->>'u',
          coalesce(nullif(mat->>'q','')::numeric, 1),
          mat
        )
        on conflict (inspection_id, origem, item_key, codigo)
        do update set
          descricao = excluded.descricao,
          unidade = excluded.unidade,
          quantidade = excluded.quantidade,
          dados = excluded.dados;
      end loop;
    end if;
  end loop;

  if jsonb_typeof(coalesce(p->'mats','[]'::jsonb)) = 'array' then
    for mat in select value from jsonb_array_elements(coalesce(p->'mats','[]'::jsonb))
    loop
      insert into public.inspection_materials (
        inspection_id, origem, item_key, codigo, descricao, unidade, quantidade, dados
      ) values (
        new.id,
        'global',
        null,
        coalesce(mat->>'c', md5(mat::text)),
        mat->>'d',
        mat->>'u',
        coalesce(nullif(mat->>'q','')::numeric, 1),
        mat
      )
      on conflict (inspection_id, origem, item_key, codigo)
      do update set
        descricao = excluded.descricao,
        unidade = excluded.unidade,
        quantidade = excluded.quantidade,
        dados = excluded.dados;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_inspection_projection on public.inspections;
create trigger trg_sync_inspection_projection after insert or update on public.inspections for each row execute function public.sync_inspection_projection();

-- ===== Storage =====
insert into storage.buckets (id, name, public) values ('relatorios','relatorios',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('inspecoes-fotos','inspecoes-fotos',false) on conflict (id) do nothing;

-- ===== RLS =====
alter table public.app_users enable row level security;
drop policy if exists p_all_app_users on public.app_users;
create policy p_all_app_users on public.app_users for all using (true) with check (true);
alter table public.inspections enable row level security;
drop policy if exists p_all_inspections on public.inspections;
create policy p_all_inspections on public.inspections for all using (true) with check (true);
alter table public.inspection_index enable row level security;
drop policy if exists p_all_inspection_index on public.inspection_index;
create policy p_all_inspection_index on public.inspection_index for all using (true) with check (true);
alter table public.inspection_systems enable row level security;
drop policy if exists p_all_inspection_systems on public.inspection_systems;
create policy p_all_inspection_systems on public.inspection_systems for all using (true) with check (true);
alter table public.inspection_selected_activities enable row level security;
drop policy if exists p_all_inspection_selected_activities on public.inspection_selected_activities;
create policy p_all_inspection_selected_activities on public.inspection_selected_activities for all using (true) with check (true);
alter table public.inspection_items enable row level security;
drop policy if exists p_all_inspection_items on public.inspection_items;
create policy p_all_inspection_items on public.inspection_items for all using (true) with check (true);
alter table public.inspection_materials enable row level security;
drop policy if exists p_all_inspection_materials on public.inspection_materials;
create policy p_all_inspection_materials on public.inspection_materials for all using (true) with check (true);
alter table public.audit_logs enable row level security;
drop policy if exists p_all_audit_logs on public.audit_logs;
create policy p_all_audit_logs on public.audit_logs for all using (true) with check (true);
alter table public.error_logs enable row level security;
drop policy if exists p_all_error_logs on public.error_logs;
create policy p_all_error_logs on public.error_logs for all using (true) with check (true);
alter table public.sync_queue enable row level security;
drop policy if exists p_all_sync_queue on public.sync_queue;
create policy p_all_sync_queue on public.sync_queue for all using (true) with check (true);
alter table public.regioes enable row level security;
drop policy if exists p_all_regioes on public.regioes;
create policy p_all_regioes on public.regioes for all using (true) with check (true);
alter table public.polos enable row level security;
drop policy if exists p_all_polos on public.polos;
create policy p_all_polos on public.polos for all using (true) with check (true);
alter table public.comarcas enable row level security;
drop policy if exists p_all_comarcas on public.comarcas;
create policy p_all_comarcas on public.comarcas for all using (true) with check (true);
alter table public.edificacoes enable row level security;
drop policy if exists p_all_edificacoes on public.edificacoes;
create policy p_all_edificacoes on public.edificacoes for all using (true) with check (true);
alter table public.grupo_rules enable row level security;
drop policy if exists p_all_grupo_rules on public.grupo_rules;
create policy p_all_grupo_rules on public.grupo_rules for all using (true) with check (true);
alter table public.form_types enable row level security;
drop policy if exists p_all_form_types on public.form_types;
create policy p_all_form_types on public.form_types for all using (true) with check (true);
alter table public.status_catalog enable row level security;
drop policy if exists p_all_status_catalog on public.status_catalog;
create policy p_all_status_catalog on public.status_catalog for all using (true) with check (true);
alter table public.systems_catalog enable row level security;
drop policy if exists p_all_systems_catalog on public.systems_catalog;
create policy p_all_systems_catalog on public.systems_catalog for all using (true) with check (true);
alter table public.activities_catalog enable row level security;
drop policy if exists p_all_activities_catalog on public.activities_catalog;
create policy p_all_activities_catalog on public.activities_catalog for all using (true) with check (true);
alter table public.material_catalog enable row level security;
drop policy if exists p_all_material_catalog on public.material_catalog;
create policy p_all_material_catalog on public.material_catalog for all using (true) with check (true);
alter table public.prontuario_itens_catalog enable row level security;
drop policy if exists p_all_prontuario_itens_catalog on public.prontuario_itens_catalog;
create policy p_all_prontuario_itens_catalog on public.prontuario_itens_catalog for all using (true) with check (true);
alter table public.subestacao_secoes_catalog enable row level security;
drop policy if exists p_all_subestacao_secoes_catalog on public.subestacao_secoes_catalog;
create policy p_all_subestacao_secoes_catalog on public.subestacao_secoes_catalog for all using (true) with check (true);

-- ===== Índices =====
create index if not exists idx_app_users_reg on public.app_users(reg);
create index if not exists idx_inspections_updated_at on public.inspections(updated_at desc);
create index if not exists idx_inspection_index_tipo_status on public.inspection_index(tipo, status);
create index if not exists idx_inspection_index_regiao_comarca on public.inspection_index(regiao, comarca);
create index if not exists idx_inspection_index_edificacao on public.inspection_index(edificacao);
create index if not exists idx_inspection_index_payload_gin on public.inspection_index using gin (payload);
create index if not exists idx_inspection_items_status on public.inspection_items(status);
create index if not exists idx_inspection_materials_codigo on public.inspection_materials(codigo);
create index if not exists idx_material_catalog_origem on public.material_catalog(origem_tipo);
create index if not exists idx_edificacoes_lookup on public.edificacoes(regiao_id, comarca_id, nome);

-- ===== Seed de regiões =====
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('NORTE', 'Norte', '#2563eb', '#dbeafe') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('CENTRAL', 'Central', '#7c3aed', '#ede9fe') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('LESTE', 'Leste', '#16a34a', '#dcfce7') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('ZONA_MATA', 'Zona da Mata', '#b45309', '#fef3c7') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('TRIANGULO', 'Triângulo', '#0891b2', '#cffafe') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('SUL', 'Sul', '#be185d', '#fce7f3') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;
insert into public.regioes (sigla, nome, cor, cor_fundo) values ('SUDOESTE', 'Sudoeste', '#65a30d', '#ecfccb') on conflict (sigla) do update set nome=excluded.nome, cor=excluded.cor, cor_fundo=excluded.cor_fundo;

-- ===== Seed de polos, comarcas e edificações =====
with r as (select id from public.regioes where sigla='NORTE') insert into public.polos (regiao_id, nome) select r.id, 'Montes Claros' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Montes Claros' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Bocaiúva' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Brasília de Minas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Coração de Jesus' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Diamantina' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Espinosa' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Francisco Sá' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Grão Mogol' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Itamarandiba' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Jaíba' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Janaúba' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Manga' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Montalvânia' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Monte Azul' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Porteirinha' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Rio Pardo de Minas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'São João da Ponte' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Montes Claros')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Bocaiúva')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Brasília de Minas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Coração de Jesus')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Diamantina')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Diamantina')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Antigo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Espinosa')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Francisco Sá')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Grão Mogol')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum / Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Itamarandiba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jaíba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum / Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Janaúba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Janaúba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Antigo JESP – Arquivo', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Manga')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Montalvânia')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Monte Azul')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Porteirinha')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Rio Pardo de Minas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São João da Ponte')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Itamarandiba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Manga')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Montes Claros'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Porteirinha')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE') insert into public.polos (regiao_id, nome) select r.id, 'Teófilo Otoni' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Teófilo Otoni' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Águas Formosas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Almenara' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Araçuaí' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Capelinha' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Carlos Chagas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Itambacuri' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Jacinto' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Jequitinhonha' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Malacacheta' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Medina' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Minas Novas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Nanuque' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Novo Cruzeiro' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Pedra Azul' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Salinas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'São João do Paraíso' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Taiobeiras' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Turmalina' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Teófilo Otoni')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum/Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Águas Formosas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Almenara')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Almenara')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Araçuaí')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Araçuaí')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Padre Paraíso – Novo Fórum Digital', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Capelinha')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Carlos Chagas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Itambacuri')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jacinto')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jequitinhonha')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Malacacheta')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Medina')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Minas Novas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Nanuque')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Novo Cruzeiro')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Pedra Azul')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Salinas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Salinas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Setores do Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São João do Paraíso')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Taiobeiras')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum / Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Turmalina')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Águas Formosas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jacinto')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Malacacheta')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Medina')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Teófilo Otoni'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Salinas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE') insert into public.polos (regiao_id, nome) select r.id, 'Paracatu' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Paracatu' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Arinos' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Bonfinópolis de Minas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Buenópolis' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Buritis' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Corinto' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Curvelo' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Januária' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'João Pinheiro' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Pirapora' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'São Francisco' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'São Romão' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Três Marias' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Unai' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Várzea da Palma' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Paracatu')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Arinos')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Arinos')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'CEJUSC', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Bonfinópolis de Minas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Buenópolis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Buritis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Corinto')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Curvelo')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Januária')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='João Pinheiro')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Pirapora')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São Francisco')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São Romão')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum / Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Três Marias')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Unai')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Várzea da Palma')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Buritis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Corinto')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Januária')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São Francisco')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Três Marias')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='NORTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Paracatu'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Várzea da Palma')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.polos (regiao_id, nome) select r.id, 'Contagem' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Contagem' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Ibirité' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Nova Lima' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Ribeirão das Neves' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Santa Luzia' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Bonfim' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Brumadinho' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Caeté' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Esmeraldas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Igarapé' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Juatuba' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Mateus Leme' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Sabará' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Contagem')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum / Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ibirité')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Nova Lima')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ribeirão das Neves')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Santa Luzia')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Bonfim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Brumadinho')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Caeté')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Contagem')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivos', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Esmeraldas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ibirité')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ibirité')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ibirité')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Setores do Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ibirité')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Zonas Eleitorais', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Igarapé')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Juatuba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Mateus Leme')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sabará')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sabará')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Brumadinho')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Contagem'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Esmeraldas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.polos (regiao_id, nome) select r.id, 'Sete Lagoas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Sete Lagoas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Vespasiano' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Jaboticatubas' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Lagoa Santa' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Matozinhos' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Paraopeba' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Pedro Leopoldo' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sete Lagoas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Vespasiano')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jaboticatubas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Lagoa Santa')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Matozinhos')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Paraopeba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Pedro Leopoldo')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sete Lagoas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Vespasiano')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Vespasiano')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Vespasiano')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'CEJUSC', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jaboticatubas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Sete Lagoas'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sete Lagoas')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.polos (regiao_id, nome) select r.id, 'Betim' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL') insert into public.comarcas (regiao_id, nome) select r.id, 'Betim' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Betim'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Betim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Betim'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Betim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='CENTRAL'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Betim'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Betim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE') insert into public.polos (regiao_id, nome) select r.id, 'Governador Valadares' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Caratinga' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Governador Valadares' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Manhuaçu' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Aimorés' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Conselheiro Pena' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Galiléia' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Inhapim' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Ipanema' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Itanhomi' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Lajinha' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Manhumirim' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Mantena' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Mutum' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Resplendor' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Santa Maria do Suaçuí' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'São João Evangelista' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Tarumirim' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Caratinga')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Governador Valadares')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Governador Valadares')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Manhuaçu')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum / Novo Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Aimorés')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Conselheiro Pena')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Galiléia')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Governador Valadares')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Inhapim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ipanema')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum/Ampliação', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Itanhomi')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Lajinha')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Manhumirim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Mantena')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Mutum')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Resplendor')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Santa Maria do Suaçuí')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São João Evangelista')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São João Evangelista')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Coluna (Fórum Digital)', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Tarumirim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Conselheiro Pena')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Governador Valadares')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo / Dep. de bens apreendidos', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Manhumirim')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Mantena')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Governador Valadares'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São João Evangelista')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE') insert into public.polos (regiao_id, nome) select r.id, 'Ipatinga' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Ipatinga' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Açucena' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Coronel Fabriciano' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Guanhães' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Mesquita' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Peçanha' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Rio Vermelho' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Sabinópolis' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Serro' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Timóteo' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Virginópolis' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ipatinga')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Açucena')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Coronel Fabriciano')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Guanhães')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ipatinga')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'JESP', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Mesquita')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Peçanha')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Rio Vermelho')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sabinópolis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Serro')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Antigo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Serro')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Timóteo')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Virginópolis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ipatinga')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Sabinópolis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Ipatinga'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Timóteo')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE') insert into public.polos (regiao_id, nome) select r.id, 'Itabira' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Itabira' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Abre Campo' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Alvinópolis' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Barão de Cocais' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Conceição do Mato Dentro' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Ferros' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Jequeri' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'João Monlevade' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Nova Era' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Ponte Nova' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Raul Soares' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Rio Casca' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Rio Piracicaba' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'Santa Bárbara' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE') insert into public.comarcas (regiao_id, nome) select r.id, 'São Domingos do Prata' from r on conflict (regiao_id, nome) do update set nome=excluded.nome;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Itabira')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'A'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Abre Campo')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Alvinópolis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Barão de Cocais')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Novo Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Conceição do Mato Dentro')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ferros')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Jequeri')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='João Monlevade')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Nova Era')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ponte Nova')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Raul Soares')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Rio Casca')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Rio Piracicaba')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Santa Bárbara')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='São Domingos do Prata')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Fórum', 'B'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Alvinópolis')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo / Dep. de bens apreendidos', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='João Monlevade')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Ponte Nova')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Raul Soares')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;
with r as (select id from public.regioes where sigla='LESTE'),
     p as (select p.id from public.polos p join r on p.regiao_id=r.id where p.nome='Itabira'),
     c as (select c.id, c.regiao_id from public.comarcas c join r on c.regiao_id=r.id where c.nome='Santa Bárbara')
insert into public.edificacoes (regiao_id, polo_id, comarca_id, nome, grupo)
select c.regiao_id, p.id, c.id, 'Arquivo', 'C'
from c cross join p
on conflict (regiao_id, comarca_id, nome) do update set polo_id=excluded.polo_id, grupo=excluded.grupo, ativo=true;

-- ===== Seed de regras de grupo =====
insert into public.grupo_rules (grupo, rotulo, sistemas, skip, allowed, periodos) values ('A', 'Grupo A', '["1", "2", "3", "4", "5", "6", "7"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb) on conflict (grupo) do update set rotulo=excluded.rotulo, sistemas=excluded.sistemas, skip=excluded.skip, allowed=excluded.allowed, periodos=excluded.periodos;
insert into public.grupo_rules (grupo, rotulo, sistemas, skip, allowed, periodos) values ('B', 'Grupo B', '["1", "2", "3", "4", "5", "6", "7"]'::jsonb, '{"1.10": 1}'::jsonb, '{}'::jsonb, '{}'::jsonb) on conflict (grupo) do update set rotulo=excluded.rotulo, sistemas=excluded.sistemas, skip=excluded.skip, allowed=excluded.allowed, periodos=excluded.periodos;
insert into public.grupo_rules (grupo, rotulo, sistemas, skip, allowed, periodos) values ('C', 'Grupo C', '["1", "2", "3", "4"]'::jsonb, '{"1.10": 1, "2.0": 0}'::jsonb, '{"1.1": 1, "1.2": 1, "1.3": 1, "1.4": 1, "1.5": 1, "1.6": 1, "1.7": 1, "1.8": 1, "1.9": 1, "1.11": 1, "1.12": 1, "1.13": 1, "2.1": 1, "2.2": 1, "2.3": 1, "2.4": 1, "2.5": 1, "3.2": 1, "3.9": 1, "3.10": 1, "3.12": 1, "4.5": 1, "4.6": 1, "4.7": 1}'::jsonb, '{"1.1": 6, "1.2": 6, "1.3": 6, "1.4": 6, "1.5": 12, "1.6": 12, "1.7": 6, "1.8": 12, "1.9": 12, "1.11": 12, "1.12": 12, "1.13": 12, "2.1": 12, "2.2": 12, "2.3": 0, "2.4": 0, "2.5": 12, "3.2": 6, "3.9": 6, "3.10": 12, "3.12": 6, "4.5": 6, "4.6": 12, "4.7": 12}'::jsonb) on conflict (grupo) do update set rotulo=excluded.rotulo, sistemas=excluded.sistemas, skip=excluded.skip, allowed=excluded.allowed, periodos=excluded.periodos;

-- ===== Seed de tipos de formulário =====
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('periodica', 'RITMP – Manutenção Periódica', '#16a34a', '#dcfce7', '&#128295;', '["Dados", "Checklist", "Materiais", "Concluir"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('ose', 'RITE – Emergencial', '#dc2626', '#fee2e2', '&#9889;', '["Dados", "Sistemas", "Sel. Atividades", "Atividades", "Materiais", "Concluir"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('programada', 'RITP – Programada', '#2563eb', '#dbeafe', '&#128203;', '["Dados", "Sistemas", "Sel. Atividades", "Atividades", "Materiais", "Concluir"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('fachada', 'Fachada', '#7c3aed', '#ede9fe', '&#127963;', '["Dados", "Fachadas", "Conclusao"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('spda', 'SPDA', '#d97706', '#fef3c7', '&#9889;', '["Dados", "Inspecao Visual", "Medicoes", "Conclusao"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('prontuario', 'Laudos, prontuários e diagramas', '#0369a1', '#e0f2fe', '&#9889;&#65039;', '["Dados", "Documentos", "Concluir"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('subestacao', 'Manutencao Subestacao Anexo B.1', '#b45309', '#fef3c7', '&#9889;', '["Dados", "Checklist Sub", "Concluir"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;
insert into public.form_types (codigo, rotulo, cor, cor_fundo, icone, etapas) values ('osp', 'OSP – Abertura', '#0f766e', '#ccfbf1', '&#128221;', '["Dados OSP", "Sistemas", "Sel. Atividades", "Atividades", "Materiais", "Concluir"]'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, cor=excluded.cor, cor_fundo=excluded.cor_fundo, icone=excluded.icone, etapas=excluded.etapas;

-- ===== Seed de status =====
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('pendente', 'Pendente', '&#9203;', '#94a3b8', '#f1f5f9', 1) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('conforme', 'Conforme', '&#9989;', '#16a34a', '#dcfce7', 2) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('nao_conforme', 'Não Conf.', '&#10060;', '#dc2626', '#fee2e2', 3) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('nao_aplicavel', 'N/A', '&#10134;', '#64748b', '#f1f5f9', 4) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('fora_periodo', 'Fora Per.', '&#128260;', '#d97706', '#fef3c7', 5) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('programado', 'Programado', '&#128203;', '#7c3aed', '#ede9fe', 6) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('executado', 'Executado', '&#9989;', '#16a34a', '#dcfce7', 7) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('nao_executado', 'Não Exec.', '&#10060;', '#dc2626', '#fee2e2', 8) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;
insert into public.status_catalog (codigo, rotulo, emoji, cor, cor_fundo, ordem) values ('em_execucao', 'Em Execução', '&#9881;', '#d97706', '#fef3c7', 9) on conflict (codigo) do update set rotulo=excluded.rotulo, emoji=excluded.emoji, cor=excluded.cor, cor_fundo=excluded.cor_fundo, ordem=excluded.ordem;

-- ===== Seed de sistemas =====
insert into public.systems_catalog (id, codigo, nome) values ('1', '1.0', 'Instalações Civis') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;
insert into public.systems_catalog (id, codigo, nome) values ('2', '2.0', 'Instalações Hidrossanitárias') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;
insert into public.systems_catalog (id, codigo, nome) values ('3', '3.0', 'SPCIP - Prevenção e Combate a Incêndio') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;
insert into public.systems_catalog (id, codigo, nome) values ('4', '4.0', 'Instalações e Sistemas Elétricos') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;
insert into public.systems_catalog (id, codigo, nome) values ('5', '5.0', 'Rede de Voz e Dados') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;
insert into public.systems_catalog (id, codigo, nome) values ('6', '6.0', 'Bombeamento e Motorizações') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;
insert into public.systems_catalog (id, codigo, nome) values ('7', '7.0', 'Infraestrutura de GLP') on conflict (id) do update set codigo=excluded.codigo, nome=excluded.nome;

-- ===== Seed de atividades =====
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.1', '1', '1.1', 'Coberturas', 'Inspecionar integridade de calhas, rufos, chapins, telhas, policarbonatos, cumeeiras, engradamentos, estruturas, telas protetoras, impermeabilizações, escadas de marinheiro, alçapões e plataformas. Executar reparos de vedações, fixações, emendas, soldas, corrosões. Limpeza/desentupimento de calhas e saídas pluviais.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.2', '1', '1.2', 'Fachadas – inspeção visual', 'Efetuar inspeção visual de integridade dos diversos elementos das fachadas, com vistas à identificação e eliminação de riscos.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.3', '1', '1.3', 'Fachadas – esquadrias externas', 'Inspecionar esquadrias externas (metálicas, madeira), grades, brises, toldos, vidros, fixações, ferragens, vedações, guarnições, borrachas, suportes de ar-condicionado. Executar ajustes e reparos de funcionalidade, segurança e estanqueidade.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.4', '1', '1.4', 'Fachadas – revestimentos e percussão', 'Inspecionar revestimentos externos, rebocos, acabamentos, fixações, juntas de dilatação e rejuntamentos. Realizar testes à percussão para identificar som cavo, desplacamentos, fissuras e trincas. Executar ajustes e reconstituições.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.5', '1', '1.5', 'Fachadas – laudo técnico anual', 'Elaborar laudo técnico anual certificando as condições de segurança das fachadas e seus elementos constituintes. (NBR 5674)', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.6', '1', '1.6', 'Alvenarias e elementos estruturais', 'Inspecionar alvenarias, lajes, vigas, pilares, marquises e outros elementos estruturais, verificando fissuras, trincas, armações expostas e outras patologias.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.7', '1', '1.7', 'Painéis, guarda-corpos e corrimãos', 'Inspecionar painéis divisórios (madeira, vidro, granito, mármore), guarda-corpos, corrimãos e paredes de gesso. Executar ajustes de fixação e reparos para manutenção de funcionalidade e segurança.', 6) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.8', '1', '1.8', 'Revestimentos internos – pisos, paredes e tetos', 'Inspecionar revestimentos cerâmicos, porcelanatos, rebocos, pinturas e acabamentos de pisos, paredes e tetos. Verificar fissuras, trincas, desprendimentos e desgastes. Efetuar rejuntamentos necessários.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.9', '1', '1.9', 'Forros', 'Inspecionar integridade dos forros (gesso, fibra mineral, madeira, metálico e similares). Executar reparos e ajustes necessários à manutenção de funcionalidade e segurança.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.10', '1', '1.10', 'Tablados, pisos elevados e assoalhos', 'Inspecionar integridade de tablados, pisos elevados, assoalhos e similares. Executar reparos e ajustes necessários à manutenção de funcionalidade e segurança. (Grupo A)', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.11', '1', '1.11', 'Esquadrias internas', 'Inspecionar esquadrias internas (metálicas, madeira), acessórios, vidros, ferragens, fechaduras, fixações e vedações. Executar reparos, ajustes e regulagens para manutenção de funcionalidade e segurança.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.12', '1', '1.12', 'Áreas externas – muros e pisos', 'Inspecionar muros, pisos externos, passeios, calçadas e tampas de caixas das áreas externas. Verificar patologias e executar reparos e ajustes de funcionalidade e segurança.', 6) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('1.13', '1', '1.13', 'Áreas externas – gradis e portões', 'Inspecionar gradis, alambrados, portões, portas de enrolar, coberturas de garagens, toldos, mastros e outros elementos das áreas externas. Verificar patologias, executar ajustes de fixação e reparos.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('2.1', '2', '2.1', 'Água Fria – tubulações e reservatórios', 'Inspecionar tubulações (barriletes, shafts, coberturas, áreas externas). Inspecionar reservatórios (superiores e inferiores), tampas, registros, flanges, boias e chaves-boia, extravasores. Reparar vazamentos, tratar corrosões, recompor telas de proteção.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('2.2', '2', '2.2', 'Água Fria – torneiras, registros e válvulas', 'Inspecionar torneiras, registros, válvulas de retenção, válvulas de descarga, duchas higiênicas, engates flexíveis e mecanismos de caixas acopladas. Executar reparos de vazamentos e substituir componentes danificados.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('2.3', '2', '2.3', 'Louças e equipamentos sanitários', 'Inspecionar vasos sanitários, mictórios, lavatórios, cubas, caixas acopladas e similares. Reparar vazamentos, substituir vedações, solucionar entupimentos, revisar fixações e complementar rejuntamentos.', 0) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('2.4', '2', '2.4', 'Esgoto – ralos, grelhas e sifões', 'Inspecionar ralos, grelhas, caixas sifonadas e sifões. Solucionar entupimentos e vazamentos. Substituir elementos/componentes danificados.', 0) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('2.5', '2', '2.5', 'Esgoto – caixas de gordura e drenagem', 'Inspecionar caixas de gordura, caixas de passagem, canaletas e drenos. Efetuar limpeza das caixas de gordura. Solucionar vazamentos e entupimentos.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.1', '3', '3.1', 'Bombas de incêndio', 'Inspecionar bombas de incêndio, quadros de comando, pressostatos, chaves de fluxo, manômetros e válvulas de retenção. Substituir peças danificadas. Executar testes de funcionamento (mínimo 15 min.), reparos e ajustes.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.2', '3', '3.2', 'Iluminação de emergência', 'Verificar integridade das centrais de iluminação de emergência, luminárias e blocos autônomos. Efetuar testes de funcionamento e substituir peças danificadas conforme instruções do fabricante.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.3', '3', '3.3', 'Portas corta-fogo', 'Verificar integridade das portas corta-fogo. Testar movimentação (abertura e fechamento automático). Verificar dobradiças, fechaduras, pinturas, folhas de porta e selo de especificação. Executar ajustes e reparos.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.4', '3', '3.4', 'Hidrantes – tubulações e componentes', 'Inspecionar tubulações, hidrantes e componentes (registros, portas, vidros, pinturas, sinalizações, tampas, adaptadores, chaves Storz, bicos, britas). Desobstruir acessos, revisar fixações/vedações, reparar vazamentos, substituir peças danificadas.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.5', '3', '3.5', 'Hidrantes – mangueiras (inspeção NBR 12779)', 'Inspecionar integridade e validade das mangueiras conforme NBR 12779. Verificar conservação, acesso/desobstrução e armazenagem/enrolamento. Providenciar reposição de mangueiras faltantes e substituição de peças danificadas.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.6', '3', '3.6', 'Hidrantes – mangueiras (testes hidrostáticos)', 'Executar manutenção com testes hidrostáticos com emissão de relatórios/certificados e substituições necessárias, conforme NBR 12779.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.7', '3', '3.7', 'Sprinklers – inspeção', 'Inspecionar tubulações, conexões, suportes, chuveiros, válvulas de controle, alarmes, manômetros, registros e placas de dados. Executar ensaios de alarmes, chaves de fluxo e bombas. Substituir peças danificadas.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.8', '3', '3.8', 'Sprinklers – ensaios de drenos', 'Efetuar ensaios de drenos, investigar eventuais obstruções e lubrificar válvulas.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.9', '3', '3.9', 'Extintores – inspeção (NBR 12962)', 'Inspecionar integridade e validade conforme NBR 12962. Verificar acesso/desobstrução, lacre, manômetro, cilindro, mangueira, difusor, pino de segurança e estado do suporte/abrigo. Substituir peças danificadas e repor extintores faltantes.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.10', '3', '3.10', 'Extintores – manutenção e recarga (NBR 12962)', 'Executar manutenção com testes e recargas, emissão de relatórios/certificados e substituições necessárias, conforme NBR 12962.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.11', '3', '3.11', 'Alarme de incêndio (SDAI)', 'Verificar integridade das centrais de alarme, botoeiras, acionadores manuais, sirenes, detectores de fumaça, sensores e indicadores. Aferir tensões e baterias. Efetuar testes, limpeza, substituição de peças, ajustes e correção de programações.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('3.12', '3', '3.12', 'Sinalização de emergência', 'Verificar estado de conservação das placas e pictogramas (E5, E8, S1-S12, P1, P4, M4, A5, E1-E3, M2). Corrigir fixações e posicionamentos. Repor placas faltantes.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.1', '4', '4.1', 'Subestações – inspeção (a plena carga)', 'Inspecionar transformadores, cubículos MT, chaves seccionadoras, TPs, TCs, relés, caixas de medição, muflas, barramentos, disjuntores, contatores, DPS e multimedidores. Realizar medições elétricas (tensão, corrente) e termográficas. Substituir componentes danificados. Elaborar e manter Prontuário NR-10.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.2', '4', '4.2', 'Subestações – manutenção preventiva anual (Anexo B.1)', 'Executar manutenção preventiva anual conforme Anexo B.1: transformadores (limpeza, óleo, ensaios), disjuntores (PVO/vácuo), chaves seccionadoras, óleo isolante (análise físico-química e cromatográfica), muflas, relés microprocessados, barramentos blindados, painéis principais e salas de subestações.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.3', '4', '4.3', 'Sistema fotovoltaico – inspeção', 'Inspecionar módulos fotovoltaicos (integridade e limpeza), cabeamento, conectores e terminais, estruturas de fixação, microinversores (LED de status), ECU-R (LED1 em funcionamento, LED2 conectado ao servidor) e monitoramento remoto online.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.4', '4', '4.4', 'Sistema fotovoltaico – limpeza painéis', 'Efetuar limpeza dos painéis fotovoltaicos em conformidade com as instruções do fabricante.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.5', '4', '4.5', 'Quadros de distribuição – inspeção termográfica', 'Inspecionar quadros, caixas, barramentos, disjuntores, fusíveis, DRs e DPS. Realizar medições termográficas e elétricas (tensão, corrente) a plena carga. Conferir compatibilidade entre condutores e proteções. Substituir componentes danificados.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.6', '4', '4.6', 'Quadros de distribuição – manutenção anual', 'Executar reaperto das conexões, ajustes, limpeza, medições elétricas (tensão/corrente) a plena carga, afixar etiqueta de manutenção, recompor identificações dos circuitos e avisos de segurança.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.7', '4', '4.7', 'Iluminação, tomadas e no-breaks', 'Inspecionar luminárias, lâmpadas, reatores, ignitores, capacitores, interruptores, postes, refletores, programadores horários, relés fotoelétricos, sensores de presença, tomadas e no-breaks. Substituir componentes danificados (lâmpadas, reatores, tomadas, placas).', 0) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.8', '4', '4.8', 'SPDA – inspeção', 'Inspecionar malha de captação, descidas aparentes, caixas de aterramento e equalização. Substituir elementos danificados e efetuar reaperto das conexões acessíveis.', 6) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('4.9', '4', '4.9', 'SPDA – inspeção NBR 5419 (laudo)', 'Efetuar inspeção do sistema conforme NBR 5419, com emissão de relatório/laudo técnico específico e testes de continuidade.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('5.1', '5', '5.1', 'Telefonia fixa – manutenção', 'Ativar ramais/troncos/funcionalidades, atualizar software/firmware, adequar cabeamento, reparar tomadas e plugues telefônicos, reparar placas analógicas/digitais, substituir patch cords, fio jumper, fio FI, módulos de proteção avariados e executar transferência de ramais/linhas.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('5.2', '5', '5.2', 'Cabeamento estruturado (voz/dados) – inspeção', 'Inspecionar integridade e funcionalidade da infraestrutura de cabeamento (UTP, fibras, cabos telefônicos), CPDs, salas de telecomunicações, DGs, patch panels, DIOs, organizadores, patch cords, racks e protetores de linha. Executar ajustes e substituir componentes danificados.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('5.3', '5', '5.3', 'Cabeamento e telefonia – limpeza anual', 'Efetuar limpeza interna e externa de aparelhos e central telefônica. Limpeza e organização de racks e DGs.', 12) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('6.1', '6', '6.1', 'Bombas de abastecimento e drenagem', 'Inspecionar bombas de abastecimento (recalque) de água, de drenagens de esgoto e de águas pluviais, comandos e acessórios. Efetuar testes de funcionamento com medições elétricas (tensão e corrente), verificar alternância das bombas reservas, executar reparos e ajustes.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('6.2', '6', '6.2', 'Motorizações de portões e portas automatizadas', 'Inspecionar motores, braços de acionamento, comandos, sensores e acessórios de portões e portas automatizadas. Efetuar testes de funcionamento, lubrificar componentes, executar reparos e ajustes.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;
insert into public.activities_catalog (id, system_id, codigo, nome, descricao, periodicidade_meses) values ('7.1', '7', '7.1', 'GLP – centrais e tubulações', 'Inspecionar centrais de distribuição, tubulações, registros, válvulas (abastecimento, regulagem, segurança, bloqueio, alívio), manômetros, mangueiras de pressão, pinturas e sinalizações. Verificar ventilação dos abrigos e condições de acesso. Substituir peças danificadas, reparar vedações e fixações.', 3) on conflict (id) do update set system_id=excluded.system_id, codigo=excluded.codigo, nome=excluded.nome, descricao=excluded.descricao, periodicidade_meses=excluded.periodicidade_meses;

-- ===== Seed de materiais =====
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.1', 'Telha fibrocimento E=6mm', 'm²', 56.75, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.2', 'Telha fibrocimento E=8mm', 'm²', 68.08, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.3', 'Telha cerâmica', 'm²', 168.14, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.4', 'Telha metálica zincada E=0,65mm', 'm²', 123.58, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.5', 'Telha metálica sanduíche PU', 'm²', 208.58, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.6', 'Telha translúcida polipropileno E=1,1mm', 'm²', 117.53, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.7', 'Chapa policarbonato alveolar E=10mm', 'm²', 325.63, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.8', 'Cumeeira fibrocimento E=6mm', 'm', 91, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.9', 'Cumeeira fibrocimento E=8mm', 'm', 130.14, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.10', 'Cumeeira cerâmica', 'm', 57.06, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.11', 'Cumeeira galvanizada trapezoidal E=0,50mm', 'm', 98.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.12', 'Rufo/Contra rufo galvanizado desen.35cm', 'm', 60.46, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.13', 'Calha galvanizada desen.75cm', 'm', 186.92, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.1.14', 'Chapim galvanizado desen.55cm', 'm', 120.14, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.2.1', 'Argamassa polimérica', 'm²', 39.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.2.2', 'Manta asfáltica aluminizada E=3mm', 'm²', 127.52, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.2.3', 'Manta líquida acrílica 1kg/m²', 'm²', 56.27, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.3.1', 'Placa forro fibra mineral E=14mm NRC≥0,70', 'm²', 102.29, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.4.1', 'Braço articulado alumínio 400mm janela máximo-ar', 'Un', 154.18, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.4.2', 'Fecho alumínio janela máximo-ar 95mm', 'Un', 50.61, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.4.3', 'Chapa alumínio escovado E=1mm', 'm²', 224.04, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.4.4', 'Perfil L alumínio 5,6x3,0cm junta dilatação', 'm', 384.66, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.4.5', 'Perfil alumínio esquadrias E=1,5mm', 'm', 97.94, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.5.1', 'Mola reforçada 50mm porta enrolar até 4,50m', 'Un', 287.96, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.1', 'Fechadura reforçada cromada alavanca ≥11,5cm', 'Un', 281.08, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.2', 'Fechadura interna simples', 'Un', 193.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.3', 'Trinco latão 50mm', 'Un', 35.02, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.4', 'Cremona latão 110mm', 'Un', 98.8, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.5', 'Acionador basculante ferro 125mm', 'Un', 30.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.6', 'Dobradiça aço 3½"x3"', 'Un', 49.38, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.7', 'Roldana aço 2"', 'Un', 45.45, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.8', 'Roldana nylon 2"', 'Un', 63.87, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.9', 'Fechadura fecho tarjeta livre/ocupado', 'Un', 124.26, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.10', 'Fechadura porta divisória tubular', 'Un', 203.38, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.11', 'Fixador de porta aço cromado', 'Un', 31.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.12', 'Veda-porta', 'Un', 318.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.6.13', 'Mola hidráulica aérea porta madeira', 'Un', 285.42, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.7.1', 'Espelho cristal E=4mm', 'm²', 401.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.7.2', 'Fechadura porta vidro temperado 18x12x12cm', 'Un', 154.18, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.7.3', 'Puxador porta vidro temperado', 'Par', 326.47, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.7.4', 'Dobradiça porta vidro temperado 130x50mm', 'Un', 86.94, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.7.5', 'Mola piso porta vidro temperado', 'Un', 1182.14, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.7.6', 'Trinco porta vidro temperado', 'Un', 49.11, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.1', 'Massa corrida PVA', 'KG', 4.72, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.2', 'Massa acrílica', 'KG', 8.48, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.3', 'Tinta acrílica', 'L', 22.15, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.4', 'Tinta acrílica semi-brilho (barrado)', 'L', 50.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.5', 'Tinta esmalte sintético (barrado)', 'L', 57.22, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.6', 'Tinta esmalte sintético esquadria madeira', 'L', 57.22, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.7', 'Tinta esmalte sintético esquadria metálica', 'L', 58.34, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.8', 'Tinta resina acrílica', 'L', 58.3, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.9', 'Fundo anticorrosivo (zarcão)', 'L', 64.91, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.8.10', 'Verniz esquadria madeira', 'L', 46.97, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.9.1', 'Areia', 'KG', 0.2, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.9.2', 'Cimento', 'KG', 0.94, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.9.3', 'Argamassa ACIII', 'KG', 2.59, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.9.4', 'Rejunte', 'KG', 4.95, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.1.9.5', 'Fita adesiva antiderrapante', 'm', 19.95, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.1.1', 'Registro gaveta bruto 3/4"', 'Un', 69.98, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.1.2', 'Registro gaveta bruto 1"', 'Un', 110.47, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.1.3', 'Registro gaveta bruto 1¼"', 'Un', 150.56, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.1.4', 'Registro gaveta bruto 1½"', 'Un', 190.07, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.1.5', 'Registro gaveta bruto 2"', 'Un', 264.76, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.1.6', 'Registro gaveta bruto 2½"', 'Un', 549.08, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.2.1', 'Base registro pressão ½"', 'Un', 79.48, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.2.2', 'Base registro pressão ¾"', 'Un', 71.26, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.3', 'Acabamento cromado para registro', 'Un', 41.98, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.4', 'Válvula descarga 1½"', 'Un', 140.31, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.5', 'Acabamento cromado anti-vandalismo válvula descarga', 'Un', 346.17, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.6', 'Acabamento metálico válvula descarga', 'Un', 69, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.7', 'Reparo válvula descarga 1¼"-1½"', 'Un', 88.37, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.8', 'Válvula descarga mictório anti-vandalismo 3/4"', 'Un', 982.31, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.9', 'Válvula descarga eletrônica mictório 3/4"', 'Un', 2883.49, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.11', 'Válvula escoamento cromada lavatório', 'Un', 64.08, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.12', 'Válvula escoamento cromada pia', 'Un', 103.41, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.13', 'Válvula escoamento cromada tanque', 'Un', 130.26, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.14', 'Torneira lavatório mesa cromada ½"', 'Un', 86.28, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.15', 'Torneira pressão lavatório anti-vandalismo ½"', 'Un', 434.5, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.16', 'Torneira pressão pia parede cromada ½"', 'Un', 86.8, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.17', 'Torneira pressão tanque parede ½"', 'Un', 136.47, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.18', 'Torneira jardim parede ½"', 'Un', 93.12, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.19', 'Reparo para torneira', 'Un', 57.25, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.20', 'Ligação cromada flexível malha aço 40cm', 'Un', 76.01, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.21', 'Ducha higiênica manual registro ½" 1,20m', 'Un', 342.64, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.22', 'Gatilho ducha higiênica manual', 'Un', 123.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.23', 'Kit reparo descarga caixa acoplada', 'Un', 245.98, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.24', 'Assento plástico vaso sanitário', 'Un', 446.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.25', 'Sifão PVC inteligente pia/lavatório', 'Un', 12.66, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.26', 'Tubo ligação bacia sanitária cromado DN38', 'Un', 45.78, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.27.1', 'Tubo PVC soldável água fria Ø20mm', 'm', 4.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.27.2', 'Tubo PVC soldável água fria Ø25mm', 'm', 5.28, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.27.3', 'Tubo PVC soldável água fria Ø32mm', 'm', 11.4, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.27.4', 'Tubo PVC soldável água fria Ø50mm', 'm', 19.62, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.27.5', 'Tubo PVC soldável água fria Ø60mm', 'm', 32.28, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.29.1', 'Tubo PVC esgoto/pluvial Ø40mm', 'm', 8.49, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.29.2', 'Tubo PVC esgoto/pluvial Ø50mm', 'm', 14.02, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.29.3', 'Tubo PVC esgoto/pluvial Ø75mm', 'm', 18.4, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.29.4', 'Tubo PVC esgoto/pluvial Ø100mm', 'm', 19.44, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.31.1', 'Tubo PVC reforçado esgoto Ø150mm', 'm', 50.8, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.35.1', 'Caixa sifonada PVC 100x100x50mm', 'Un', 28.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.35.2', 'Caixa sifonada PVC 150x185x75mm', 'Un', 81.76, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.36', 'Ralo seco cilíndrico', 'Un', 22.97, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.37.1', 'Ralo semi-esférico abacaxi 100mm', 'Un', 21.98, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.37.2', 'Ralo semi-esférico abacaxi 150mm', 'Un', 51.64, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.38', 'Grelha e porta grelha piso 15x15cm', 'Un', 55.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.39.1', 'Caixa d''água polietileno 500L', 'Un', 368.72, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.39.2', 'Caixa d''água polietileno 1000L', 'Un', 609.7, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.40', 'Torneira bóia alta pressão 3/4" (DN20)', 'Un', 54.5, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.41', 'Torneira bóia alta pressão 1¼" (DN32)', 'Un', 127.07, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.2.42', 'Chave bóia bombeamento', 'Un', 65.19, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.1.1', 'Disjuntor monopolar DIN 16A curva C 3kA', 'Un', 11.89, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.1.2', 'Disjuntor monopolar DIN 20A curva C 3kA', 'Un', 13.35, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.1.3', 'Disjuntor monopolar DIN 32A curva C 3kA', 'Un', 14.51, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.2.1', 'Disjuntor monopolar NEMA 15A 5kA', 'Un', 33.61, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.2.2', 'Disjuntor monopolar NEMA 20A 5kA', 'Un', 33.61, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.3.1', 'Disjuntor bipolar DIN 2x20A curva C 3kA', 'Un', 51.11, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.3.2', 'Disjuntor bipolar DIN 2x25A curva C 3kA', 'Un', 54.84, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.3.3', 'Disjuntor bipolar DIN 2x63A curva C 3kA', 'Un', 57.11, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.5.1', 'Disjuntor tripolar DIN 3x40A curva C 5kA', 'Un', 58.92, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.5.2', 'Disjuntor tripolar DIN 3x50A curva C 5kA', 'Un', 66.49, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.5.3', 'Disjuntor tripolar DIN 3x63A curva C 5kA', 'Un', 58.92, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.6.1', 'Disjuntor tripolar DIN 3x80A 10kA', 'Un', 229.8, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.6.2', 'Disjuntor tripolar DIN 3x100A 10kA', 'Un', 231.74, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.6.3', 'Disjuntor tripolar DIN 3x125A 10kA', 'Un', 361.23, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.11.1', 'IDR bipolar 2x40A 30mA', 'Un', 227.52, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.12.1', 'IDR tetrapolar 4x40A 30mA', 'Un', 273.05, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.12.2', 'IDR tetrapolar 4x63A 30mA', 'Un', 299.26, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.12.3', 'IDR tetrapolar 4x80A 30mA', 'Un', 420.51, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.15', 'DPS trilho DIN 40kA 275V classe 2', 'Un', 43.57, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.2.16', 'DPS trilho DIN 25kA 275V classe 1', 'Un', 155.2, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.1.1', 'Cabo cobre flexível 450/750V #2,5mm²', 'm', 3.46, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.1.2', 'Cabo cobre flexível 450/750V #4,0mm²', 'm', 5.69, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.1.3', 'Cabo cobre flexível 450/750V #6,0mm²', 'm', 6.52, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.1.4', 'Cabo cobre flexível 450/750V #10mm²', 'm', 11.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.1.5', 'Cabo cobre flexível 450/750V #16mm²', 'm', 17.41, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.2.1', 'Cabo cobre flexível 1kV 90°C #4,0mm²', 'm', 5.25, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.2.2', 'Cabo cobre flexível 1kV 90°C #16mm²', 'm', 19.99, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.3.2.3', 'Cabo cobre flexível 1kV 90°C #25mm²', 'm', 32.4, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.4.1.1', 'Eletroduto aço carbono 3/4"', 'm', 20.74, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.4.1.2', 'Eletroduto aço carbono 1"', 'm', 29.82, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.4.5.1', 'Eletroduto PVC rígido rosqueável 3/4"', 'm', 6.75, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.4.5.2', 'Eletroduto PVC rígido rosqueável 1"', 'm', 10.55, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.4.14.1', 'Canaleta PVC antichama 20x10x2100mm', 'Un', 10.5, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.1', 'Interruptor 1 tecla simples 10A/250V', 'Un', 8.09, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.2', 'Interruptor 2 teclas simples 10A/250V', 'Un', 16.63, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.3', 'Interruptor 3 teclas simples 10A/250V', 'Un', 19.88, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.4', 'Interruptor bipolar 10A/250V', 'Un', 22.87, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.5', 'Interruptor bipolar 20A/250V', 'Un', 48.01, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.8', 'Tomada padrão brasileiro 20A NBR14136', 'Un', 18.28, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.9', 'Tomada RJ45 categoria 5E', 'Un', 13.64, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.10', 'Tomada RJ45 categoria 6', 'Un', 39.03, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.11', 'Tomada telefonia RJ11', 'Un', 23.26, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.23', 'Caixa 2x4" embutir PVC antichamas', 'Un', 3.59, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.5.24', 'Caixa 4x4" embutir PVC antichamas', 'Un', 7.14, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.6.1', 'Luminária arandela uso externo IP66 E27', 'Un', 239.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.6.2', 'Projetor LED 50W IP65 bivolt', 'Un', 42.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.6.3', 'Projetor LED 100W IP65 bivolt', 'Un', 57.22, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.6.4', 'Projetor LED 200W IP65 bivolt', 'Un', 168.39, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.4', 'Lâmpada LED T5 11W base G5', 'Un', 16.88, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.5', 'Lâmpada LED T5 20W base G5', 'Un', 36.39, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.6', 'Lâmpada LED T8 11W base G13', 'Un', 19.95, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.7', 'Lâmpada LED T8 20W base G13', 'Un', 16.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.8', 'Lâmpada bulbo LED 7W E27', 'Un', 6.08, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.9', 'Lâmpada bulbo LED 11W E27', 'Un', 6.57, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.10', 'Lâmpada ultra bulbo LED 40W E27', 'Un', 43.16, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.11', 'Lâmpada ultra bulbo LED 80W E40', 'Un', 212.68, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.12', 'Lâmpada LED tubular HO 240cm T8 40W', 'Un', 61.04, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.16', 'Reator driver LED 14-18W bivolt', 'Un', 20.74, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.17', 'Reator driver LED 19-24W bivolt', 'Un', 32.17, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.18', 'Reator driver LED 25-36W bivolt', 'Un', 36.76, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.19', 'Relé fotoelétrico 1000W bivolt', 'Un', 44.03, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.3.7.22', 'Sensor presença bivolt 360° uso interno', 'Un', 53.08, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.3.1', 'Extintor CO₂ 6kg', 'Un', 661.24, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.3.2', 'Extintor ABC 8kg', 'Un', 289.33, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.3.3', 'Extintor sobre rodas BC 50kg', 'Un', 3070.76, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.3.4', 'Abrigo metálico extintor ≥10kg vermelho', 'Un', 254.57, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.3.5', 'Suporte piso para extintor', 'Un', 49.67, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.3.6', 'Suporte parede para extintor', 'Un', 8.58, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.1', 'Mangueira incêndio NBR11861 tipo2 1½" 15m', 'Un', 638.71, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.2', 'Mangueira incêndio NBR11861 tipo2 1½" 20m', 'Un', 761.55, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.3', 'Mangueira incêndio NBR11861 tipo2 2½" 15m', 'Un', 856.6, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.4', 'Mangueira incêndio NBR11861 tipo2 2½" 20m', 'Un', 1078.78, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.5', 'Adaptador Storz 2½"x1½" latão', 'Un', 65.99, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.6', 'Adaptador Storz 2½"x2½" latão', 'Un', 84.32, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.7', 'Esguicho tronco cônico 1½"', 'Un', 74.98, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.8', 'Esguicho tronco cônico 2½"', 'Un', 124.65, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.9', 'Chave conexão engate Storz dupla', 'Un', 18.32, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.10', 'Tampão cego hidrante passeio 2½"', 'Un', 140.6, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.11', 'Registro globo angular hidrante 45° 2½"', 'Un', 192.47, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.14', 'Pressostato IP-30', 'Un', 507.01, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.4.15', 'Manômetro de processo', 'Un', 341.86, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.5.1', 'Acionador manual endereçável alarme incêndio', 'Un', 163.81, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.5.2', 'Avisador audiovisual 100dB endereçável', 'Un', 252.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.5.3', 'Sirene alta potência 24Vcc 120dB', 'Un', 104.87, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.1', 'Placa sinalização E5 extintor 30x30cm fotolum.', 'Un', 51.31, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.2', 'Placa sinalização E8 hidrante 30x30cm fotolum.', 'Un', 51.31, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.3', 'Placa sinalização S1 saída emergência direita 40x20cm', 'Un', 42.01, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.4', 'Placa sinalização S2 saída emergência esquerda 40x20cm', 'Un', 42.01, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.10', 'Placa sinalização S12 saída emergência 40x20cm', 'Un', 42.01, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.11', 'Placa sinalização P1 proibido fumar 30x30cm', 'Un', 51.31, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.13', 'Placa sinalização M4 porta corta-fogo fechada', 'Un', 32.26, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.6.14', 'Placa sinalização A5 risco choque elétrico', 'Un', 51.31, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.7.1', 'Dobradiça porta corta-fogo', 'Un', 66.27, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.7.2', 'Fechadura porta corta-fogo', 'Un', 308.99, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.8.2', 'Luminária emergência LED 24V', 'Un', 52.87, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.8.3', 'Luminária emergência bloco autônomo', 'Un', 32.21, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.9.1', 'Bateria chumbo ácido 12V/2,3Ah', 'Un', 100.48, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.9.2', 'Bateria chumbo ácido 12V/7Ah', 'Un', 122.57, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.9.3', 'Bateria chumbo ácido 12V/9Ah', 'Un', 216.07, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.9.4', 'Bateria chumbo ácido 12V/18Ah', 'Un', 301.86, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.9.5', 'Bateria chumbo ácido 12V/45Ah', 'Un', 949.84, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.4.9.6', 'Bateria chumbo ácido 6V/4,5Ah', 'Un', 77.27, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.5.1.1', 'Bomba centrífuga trifásica 1,5CV 220V 9900L/h', 'Un', 5168.83, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.5.1.2', 'Bomba centrífuga trifásica 3CV 220V 21000L/h', 'Un', 5437.85, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.5.1.3', 'Bomba centrífuga trifásica 5CV 220V 14600L/h', 'Un', 6856.39, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.5.1.4', 'Bomba centrífuga trifásica 7,5CV 220V 35000L/h', 'Un', 8188.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.5.1.5', 'Bomba submersível trifásica 0,5CV águas servidas', 'Un', 2773.78, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.6.1', 'Kit automatizador portão deslizante', 'Un', 955.42, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.6.2', 'Kit automatizador portão pivotante', 'Un', 3185.1, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.6.3', 'Placa motor portão universal bivolt', 'Un', 170.54, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.6.4', 'Cremalheira portão deslizante aço galvanizado', 'm', 104.93, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.7.1', 'Regulador pressão 1° estágio 9kg/h c/ manômetro', 'Un', 390.92, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.7.2', 'Regulador pressão 2° estágio 9kg/h', 'Un', 183.93, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.7.3', 'Mangote flexível pig tail ½"', 'Un', 41.22, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('6.7.4', 'Mangueira flexível ligação aparelhos 80cm ½"', 'Un', 25.19, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.1', 'Manutenção/recarga extintor AP 10L', 'Un', 34.77, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.3', 'Manutenção/recarga extintor CO₂ 4kg', 'Un', 74.51, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.4', 'Manutenção/recarga extintor CO₂ 6kg', 'Un', 105.55, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.6', 'Manutenção/recarga extintor PQS BC 4kg', 'Un', 37.25, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.8', 'Manutenção/recarga extintor PQS BC 6kg', 'Un', 43.46, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.12', 'Manutenção/recarga extintor ABC 4kg', 'Un', 48.71, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.14', 'Manutenção/recarga extintor ABC 6kg', 'Un', 73.07, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.1.15', 'Manutenção/recarga extintor ABC 8kg', 'Un', 91.34, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.2.1', 'Manutenção/teste mangueira incêndio 15m', 'Un', 24.84, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('5.3.2.2', 'Manutenção/teste mangueira incêndio 20m', 'Un', 24.84, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.9', 'Diária técnica ICD', 'Diária', 380.61, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('7.1', 'Transporte manutenções periódicas', 'km', 2.93, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('7.2', 'Transporte atendimentos periódicos complementares', 'km', 2.72, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('7.3', 'Transporte atendimentos corretivos emergenciais', 'km', 2.73, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('7.4', 'Transporte intervenções técnicas programadas', 'km', 6.46, 'periodica') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.1', 'Retirada telha fibrocimento, kalhetão e metálica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.2', 'Retirada telha cerâmica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.3', 'Retirada chapa policarbonato', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.4', 'Retirada rufo e chapim', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.5', 'Retirada cumeeira e calha', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.6', 'Retirada engradamento madeira telha cerâmica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.7', 'Retirada engradamento madeira telha fibrocimento', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.1.8', 'Retirada ripa em madeira', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.2.1', 'Retirada forro de madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.2.2', 'Demolição forro de gesso', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.1', 'Retirada revestimento melamínico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.2', 'Demolição revestimento pedra (granito/mármore/ardósia)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.3', 'Demolição revestimento cerâmico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.4', 'Demolição de alvenaria', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.5', 'Demolição reboco/emboço', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.6', 'Retirada manta asfáltica em reservatório de concreto', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.1', 'Retirada esquadria metálica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.2', 'Retirada esquadria em madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.3', 'Retirada porta em madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.4', 'Retirada divisória', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.5', 'Retirada vidro em esquadria', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.1', 'Retirada piso bloquete/intertravado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.2', 'Retirada piso taco de madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.3', 'Demolição piso cerâmico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.4', 'Demolição piso vinílico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.5', 'Demolição piso em pedras', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.6', 'Demolição contrapiso', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.7', 'Demolição piso em concreto', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.6.1', 'Retirada vaso sanitário', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.6.2', 'Retirada mictório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.6.3', 'Retirada lavatório/tanque', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.1', 'Telha fibrocimento E=6mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.2', 'Telha fibrocimento E=8mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.3', 'Telha fibrocimento kalhetão E=8mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.4', 'Telha cerâmica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.5', 'Telha metálica zincada E=0,65mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.6', 'Telha metálica sanduíche PU', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.7', 'Telha translúcida polipropileno E=1,1mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.8', 'Chapa policarbonato alveolar E=10mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.9', 'Cumeeira fibrocimento E=6mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.10', 'Cumeeira fibrocimento E=8mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.13', 'Rufo em fibrocimento E=6mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.14', 'Rufo/contra rufo galvanizado desen.35cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.15', 'Calha galvanizada desen.75cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.16', 'Chapim galvanizado desen.55cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.18', 'Engradamento madeira telha cerâmica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.19', 'Engradamento madeira telha fibrocimento', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.20', 'Engradamento metálico aço estrutural', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.21', 'Ripa de madeira para telha cerâmica', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.22', 'Lona impermeável antichama anti-mofo toldo', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.24', 'Espícula anti-pombo policarbonato', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.1', 'Impermeabilização argamassa polimérica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.2', 'Impermeabilização manta asfáltica aluminizada E=3mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.3', 'Impermeabilização manta asfáltica armada E=4mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.4', 'Impermeabilização manta líquida acrílica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.5', 'Camada regularização sob impermeabilização E=3cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.6', 'Camada proteção mecânica sobre impermeabilização E=3cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.8', 'Manta térmica telhado 2 faces refletividade ≥90%', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.9.1', 'Forro gesso acartonado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.9.2', 'Forro gesso em placa 60x60cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.9.3', 'Forro régua madeira angelim L=10cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.9.4', 'Placa forro fibra mineral E=14mm NRC≥0,70', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.1', 'Alvenaria tijolo cerâmico furado E=9cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.2', 'Alvenaria tijolo cerâmico furado E=14cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.3', 'Alvenaria bloco concreto E=14cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.4', 'Execução chapisco', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.6', 'Execução reboco', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.7', 'Revestimento cerâmico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.8', 'Revestimento granito E=2cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.10', 'Revestimento laminado decorativo alta pressão', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.12', 'Parede gesso dry-wall tipo ST (seco)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.13', 'Parede gesso dry-wall tipo RU (úmido)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.14', 'Divisória antichama E=35mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.15', 'Porta completa divisória painel antichama c/ fechadura', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.16', 'Bancada granito incl. testeira e rodabanca', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.19', 'Tratamento trinca alvenaria c/ tela galvanizada', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.11.1', 'Porta veneziana em alumínio', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.11.2', 'Janela máximo-ar em alumínio', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.11.3', 'Suporte alumínio ar condicionado janela', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.11.4', 'Braço articulado alumínio janela máximo-ar', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.11.9', 'Brise microperfurado 60° inclusive porta painel', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.1', 'Grade proteção ferro 15x30cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.4', 'Guarda-corpo metálico aço pintado H=1,10m', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.5', 'Corrimão aço pintado 1½"', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.6', 'Guarda-corpo inox sem corrimão H=110cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.7', 'Corrimão inox', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.8', 'Escada áreas internas', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.9', 'Escada marinheiro externa com gaiola', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.10', 'Alçapão metálico 65x65cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.12', 'Tampa metálica chapa xadrez galvanizada E=6mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.1', 'Porta sólida 82x210/80x210cm com marco, alizares e ferragens', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.1', 'Porta prancheta 60x210cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.2', 'Porta prancheta 70x210cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.3', 'Porta prancheta 80x210cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.4', 'Porta prancheta 90x210cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.6', 'Porta MDF fórmica c/ fecho livre/ocupado', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.7', 'Alizar madeira L=7cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.8', 'Marco madeira ajustável L=14-18cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.1', 'Fechadura reforçada cromada', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.2', 'Fechadura interna simples', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.3', 'Trinco latão 50mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.6', 'Dobradiça aço', 'CJ', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.7', 'Trilho aço', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.8', 'Guia aço', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.9', 'Roldana aço 2"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.13', 'Veda-porta', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.14.14', 'Mola hidráulica aérea porta madeira', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.1', 'Aplicação fundo preparador', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.2', 'Aplicação selador acrílico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.3', 'Emassamento base PVA (massa corrida)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.4', 'Emassamento base acrílica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.5', 'Textura acrílica tipo grafiato', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.6', 'Pintura interna acrílica (alvenaria)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.7', 'Pintura interna acrílica (teto)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.8', 'Pintura externa acrílica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.11', 'Pintura esmalte sintético esquadria madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.12', 'Pintura esmalte sintético esquadria metálica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.13', 'Fundo anticorrosivo superfície metálica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.14', 'Verniz esquadria madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.1', 'Contrapiso E=3cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.2', 'Piso cimentado natado E=3cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.3', 'Piso concreto FCK≥15MPA E=10cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.7', 'Piso elevado monolítico massa autonivelante', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.8', 'Piso cerâmico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.9', 'Piso porcelanato', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.11', 'Piso granito E=2cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.16', 'Piso vinílico E=2mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.17', 'Piso vinílico réguas padrão amadeirado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.22', 'Rodapé madeira H=7cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.23', 'Rodapé cerâmica H=7cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.24', 'Rodapé porcelanato H=10cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.28', 'Soleira granito', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.33', 'Raspação, calafetação e sinteco piso madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.17.1', 'Hidrojateamento', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.17.4', 'Tapume compensado resinado E=14mm H=2,20m', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.1.1', 'Registro gaveta bruto 3/4"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.1.2', 'Registro gaveta bruto 1"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.1.3', 'Registro gaveta bruto 1¼"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.1.4', 'Registro gaveta bruto 1½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.4', 'Válvula descarga 1½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.8', 'Válvula descarga mictório anti-vandalismo 3/4"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.11', 'Válvula escoamento cromada lavatório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.14', 'Torneira lavatório mesa cromada ½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.15', 'Torneira pressão lavatório anti-vandalismo ½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.16', 'Torneira pressão pia parede cromada ½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.21', 'Mictório c/ sifão integrado', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.22', 'Bacia sanitária sifonada convencional', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.23', 'Bacia sanitária para caixa acoplada', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.24', 'Bacia sanitária deficiente físico', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.26', 'Caixa acoplada à bacia sanitária', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.27', 'Lavatório louça sem coluna', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.28', 'Lavatório com coluna suspensa', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.30', 'Tanque cerâmico com coluna', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.31', 'Ducha higiênica manual registro ½" 1,20m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.33', 'Kit reparo descarga caixa acoplada', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.37.1', 'Tubo PVC soldável água fria Ø20mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.37.2', 'Tubo PVC soldável água fria Ø25mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.37.3', 'Tubo PVC soldável água fria Ø32mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.37.4', 'Tubo PVC soldável água fria Ø50mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.38.1', 'Tubo PVC esgoto/pluvial Ø40mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.38.2', 'Tubo PVC esgoto/pluvial Ø50mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.38.3', 'Tubo PVC esgoto/pluvial Ø75mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.38.4', 'Tubo PVC esgoto/pluvial Ø100mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.46.1', 'Caixa d''água polietileno 500L', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.46.2', 'Caixa d''água polietileno 1000L', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.52', 'Caixa inspeção esgoto 60x60 ferro fundido', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.7', 'No-Break 1000-1200VA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.10.1', 'Transformador óleo 150KVA trifásico 13,8/0,22kV', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.10.2', 'Transformador óleo 300KVA trifásico 13,8/0,22kV', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.1.1', 'Disjuntor monopolar DIN 16A curva C 3kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.1.2', 'Disjuntor monopolar DIN 20A curva C 3kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.3.1', 'Disjuntor bipolar DIN 2x20A curva C 3kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.5.1', 'Disjuntor tripolar DIN 3x40A curva C 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.6.1', 'Disjuntor tripolar DIN 3x80A 10kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.6.2', 'Disjuntor tripolar DIN 3x100A 10kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.6.3', 'Disjuntor tripolar DIN 3x125A 10kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.7.1', 'Disjuntor tripolar caixa moldada 3x160A 65kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.21', 'QDC sobrepor trifásico 44 pos. monop. 100A', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.22', 'QDC sobrepor trifásico 70 pos. monop. 225A', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.1', 'Cabo cobre flexível 450/750V #2,5mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.2', 'Cabo cobre flexível 450/750V #4,0mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.3', 'Cabo cobre flexível 450/750V #6,0mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.4', 'Cabo cobre flexível 450/750V #10mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.5', 'Cabo cobre flexível 450/750V #16mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.1.1', 'Eletroduto aço carbono 3/4" c/ acessórios', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.1.2', 'Eletroduto aço carbono 1" c/ acessórios', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.3.1', 'Eletroduto PVC rígido rosqueável 3/4"', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.3.2', 'Eletroduto PVC rígido rosqueável 1"', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.6.1', 'Interruptor 1 tecla simples 10A/250V', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.6.8', 'Tomada padrão brasileiro 20A NBR14136', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.1.1', 'Luminária sobrepor 2 lâmpadas T8 60cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.1.2', 'Luminária sobrepor 2 lâmpadas T8 120cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.2.2', 'Luminária embutir 2 lâmpadas T8 120cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.7', 'Projetor LED 50W IP65', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.8', 'Projetor LED 100W IP65', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.9', 'Projetor LED 200W IP65', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.10', 'Poste aço galvanizado reto 3m chumbado', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.11', 'Poste aço galvanizado reto 6m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.6', 'Lâmpada LED tubular T8 11W base G13', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.7', 'Lâmpada LED tubular T8 20W base G13', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.8', 'Lâmpada bulbo LED 7W base E27', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.9', 'Lâmpada bulbo LED 11W base E27', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.1.1', 'Extintor CO2 6kg', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.1.2', 'Extintor ABC 8kg', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.1.3', 'Extintor sobre rodas BC 50kg', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.1.4', 'Abrigo metálico extintor ≥10kg vermelho', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.1', 'Mangueira incêndio NBR11861 tipo 2 Ø1½" 15m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.2', 'Mangueira incêndio NBR11861 tipo 2 Ø1½" 20m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.3', 'Mangueira incêndio NBR11861 tipo 2 Ø2½" 15m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.11', 'Registro globo angular hidrante 45° 2½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.3.4', 'Central alarme incêndio endereçável classe B 100 disp.', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.4.1', 'Dobradiça porta corta-fogo', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.4.2', 'Fechadura porta corta-fogo', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.5.1', 'Central iluminação emergência 24Vcc 1800W', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.5.2', 'Luminária emergência LED 24V', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.1', 'Bomba centrífuga trifásica 1,5CV 220V vazão mín.9900L/h', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.2', 'Bomba centrífuga trifásica 3CV 220V vazão mín.21000L/h', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.3', 'Bomba centrífuga trifásica 5CV 220V vazão mín.14600L/h', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.4', 'Bomba centrífuga trifásica 7,5CV 220V vazão mín.35000L/h', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.5', 'Bomba centrífuga submersível ½CV águas servidas', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.6.1', 'Kit automatizador portão deslizante', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.6.2', 'Kit automatizador portão pivotante', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.6.3', 'Placa motor portão universal bivolt', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.6.4', 'Cremalheira portão deslizante aço galvanizado', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.1', 'Regulador pressão 1° estágio 9kg/h c/ manômetro Ø½" NTP', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.2', 'Regulador pressão 2° estágio 9kg/h Ø½" NTP', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.3', 'Mangote flexível pig tail Ø½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.4', 'Mangueira flexível aparelhos 80cm Ø½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.8.1', 'Módulo fotovoltaico 600-720Wp (vida útil 25 anos)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.8.2', 'Microinversor trifásico YC1000-3-220 AP Systems', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.2.1', 'Retirada forro de madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.2.2', 'Demolição forro de gesso', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.1', 'Retirada revestimento melamínico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.2', 'Demolição revestimento pedra (granito/mármore/ardósia)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.3', 'Demolição revestimento cerâmico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.4', 'Demolição de alvenaria', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.5', 'Demolição reboco/emboço', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.3.6', 'Retirada manta asfáltica em reservatório de concreto', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.1', 'Retirada esquadria metálica', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.2', 'Retirada esquadria em madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.3', 'Retirada porta em madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.4', 'Retirada divisória', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.4.5', 'Retirada vidro em esquadria', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.1', 'Retirada piso bloquete de concreto / intertravado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.2', 'Retirada piso taco de madeira', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.3', 'Demolição piso cerâmico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.4', 'Demolição piso vinílico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.5', 'Demolição piso em pedras (granito, mármore, ardósia)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.6', 'Demolição contrapiso', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.5.7', 'Demolição piso em concreto', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.6.1', 'Retirada vaso sanitário', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.6.2', 'Retirada mictório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.6.3', 'Retirada lavatório/tanque', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.11', 'Cumeeira cerâmica', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.12', 'Cumeeira galvanizada trapezoidal E=0,50mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.17', 'Chapim em concreto pré-moldado E=2cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.7.23', 'Tela para sombrite polietileno cobertura veículos', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.7', 'Fita anticorrosiva PVC autoadesiva L≥100mm proteção mecânica/elétrica', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.8.8', 'Manta térmica telhado 2 faces refletividade ≥90%', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.9.3', 'Forro régua madeira angelim L=10cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.5', 'Execução de emboço', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.9', 'Revestimento mármore E=2cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.11', 'Revestimento lambri madeira ipê champanhe réguas 10cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.17', 'Execução de elementos em concreto armado', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.18', 'Recuperação com argamassa fluida alta resistência >40MPa', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.20', 'Vedação de vão com espuma de poliéster E=3cm L=3cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.21', 'Bate maca em madeira angelim L=10cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.10.22', 'Cantoneira de alumínio abas iguais 1" E=3/16"', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.2', 'Tela para gradil metálico', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.3', 'Poste (montante) para gradil metálico H=2,43m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.11', 'Bate rodas metálico 1,60m', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.13', 'Tela metálica fina tipo passarinho/pinteiro', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.14', 'Chapa lisa 16', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.12.15', 'Perfil industrial em aço para esquadrias E=2mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.5', 'Porta maciça para verniz 80x210cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.13.2.9', 'Porta para shaft em madeira com revestimento laminado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.9', 'Pintura acrílica semi-brilho para parede (barrado)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.10', 'Pintura esmalte sintético para parede (barrado)', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.15', 'Pintura em piso de concreto', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.15.16', 'Pintura faixa de demarcação resina acrílica/vinílica', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.4', 'Piso bloquete de concreto intertravado vazado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.5', 'Piso bloquete de concreto maciço sextavado', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.6', 'Placa sistema piso elevado (concreto e aço) 0,60x0,60', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.10', 'Piso em ardósia', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.12', 'Piso em mármore E=2cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.13', 'Piso em marmorite E=8mm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.14', 'Piso pedra calçada portuguesa em mosaico', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.15', 'Piso pedra São Tomé quartzito E≥2cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.18', 'Piso em taco 7x21cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.19', 'Piso podotátil em ladrilho hidráulico alerta/direcional', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.20', 'Piso em ladrilho hidráulico E≥2cm', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.21', 'Piso de borracha tipo moeda', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.25', 'Rodapé em mármore H=10cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.26', 'Rodapé em granito H=10cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.27', 'Rodapé em ardósia H=10cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.29', 'Soleira em mármore', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.30', 'Meio fio em concreto armado', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.31', 'Bate rodas em concreto', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.16.34', 'Piso podotátil de borracha direcional/alerta', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.17.2', 'Escavação manual de vala para inspeção de patologias', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.17.3', 'Reaterro compactado', 'M3', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.1.17.5', 'Tela de proteção de fachada', 'M2', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.6', 'Acabamento metálico cromado para válvula de descarga', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.10.1', 'Válvula retenção horizontal bronze 1"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.10.2', 'Válvula retenção horizontal bronze 1½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.10.3', 'Válvula retenção horizontal bronze 2"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.10.4', 'Válvula retenção horizontal bronze 2½"', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.21', 'Mictório com sifão integrado', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.22', 'Bacia sanitária sifonada convencional', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.23', 'Bacia sanitária para caixa acoplada', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.24', 'Bacia sanitária convencional para deficiente físico', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.25', 'Bacia sanitária turca com sifão integrado', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.26', 'Caixa acoplada à bacia sanitária', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.27', 'Lavatório em louça sem coluna', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.28', 'Lavatório com coluna suspensa', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.29', 'Cuba de embutir oval', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.30', 'Tanque cerâmico com coluna', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.34', 'Assento plástico para vaso sanitário', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.35', 'Sifão de PVC inteligente para pia/lavatório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.36', 'Tubo de ligação bacia sanitária cromado DN38', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.39.1', 'Tubo PVC rígido reforçado esgoto/pluvial Ø150mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.40.1', 'Luva de correr PVC água fria Ø50mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.40.2', 'Luva de correr PVC água fria Ø60mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.41.1', 'Luva de correr PVC reforçado esgoto Ø75mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.41.2', 'Luva de correr PVC reforçado esgoto Ø100mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.41.3', 'Luva de correr PVC reforçado esgoto Ø150mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.42.1', 'Caixa sifonada PVC 100x100x50mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.42.2', 'Caixa sifonada PVC 150x185x75mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.43', 'Ralo seco cilíndrico', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.44.1', 'Ralo semi-esférico abacaxi 100mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.44.2', 'Ralo semi-esférico abacaxi 150mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.45', 'Grelha e porta grelha de piso 15x15cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.46.1', 'Caixa d''água polietileno 500L', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.46.2', 'Caixa d''água polietileno 1000L', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.47', 'Torneira bóia alta pressão 3/4" (DN20)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.48', 'Torneira bóia alta pressão 1¼" (DN32)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.49', 'Chave bóia para comando de bombeamento', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.50.1', 'Adaptador soldável com flanges caixa d''água 25mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.50.2', 'Adaptador soldável com flanges caixa d''água 32mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.50.3', 'Adaptador soldável com flanges caixa d''água 60mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.51', 'Mangueira cristal transparente D=25mm c/ conexões', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.52', 'Caixa inspeção esgoto 60x60 ferro fundido', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.53', 'Canaleta coletora água pluvial grelha ferro fundido D=80cm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.54', 'Caixa passagem esgoto polipropileno DN100', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.55', 'Aspersor spray emergente pop-up 15cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.56', 'Aspersor spray emergente pop-up 30cm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.57', 'Aspersor rotor 6" emergente por ação d''água', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.2.58', 'Aspersor rotor 12" emergente por ação d''água', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.1', 'Transformador de potencial TP 13,8kV TS 230/115V 1000VA classe 0,3P75', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.2', 'Transformador de corrente TC 15kV 800A classe 0,3C100 relação 800:5', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.3', 'Tapete isolante elétrico classe 2 20kV', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.4', 'Luva borracha isolamento elétrico classe 2 20kV', 'PAR', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.5', 'Óleo mineral isolante MT (transformadores/disjuntores)', 'L', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.6', 'Relé sobrecorrente microprocessado 50/50N 51/51N', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.8', 'Chave seccionadora tripolar 15kV abertura sem carga 630A', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.9', 'Chave seccionadora tripolar 15kV abertura sob carga 630A com base NH', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.10.1', 'Transformador óleo 150kVA trifásico 13,8/0,22kV', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.10.2', 'Transformador óleo 300kVA trifásico 13,8/0,22kV', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.11.1', 'Cabo cobre MT 20kV NBR7286 25mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.11.2', 'Cabo cobre MT 20kV NBR7286 35mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.11.3', 'Cabo cobre MT 20kV NBR7286 50mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.12', 'Terminal modular MT (mufla) 20kV externo/interno', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.13.1', 'Barramento cobre rígido nu MT vergalhão 1/4" (#20mm²)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.1.13.2', 'Barramento cobre rígido nu MT vergalhão 3/8" (#50mm²)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.1.1', 'Caixa padrão entrada energia BT CM-2', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.1.2', 'Caixa padrão entrada energia BT CM-3', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.1.3', 'Caixa padrão entrada energia BT CM-14', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.2.1', 'Poste metálico padrão entrada energia PA2', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.2.2', 'Poste metálico padrão entrada energia PA3', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.2.3', 'Poste metálico padrão entrada energia PA5', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.2.4', 'Poste metálico padrão entrada energia PA6', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.2.3', 'TC padrão entrada BT relação 200:5 classe 1% 600V', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.2.1', 'Disjuntor monopolar NEMA 15A 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.2.2', 'Disjuntor monopolar NEMA 20A 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.4.1', 'Disjuntor bipolar NEMA 2x20A 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.4.2', 'Disjuntor bipolar NEMA 2x25A 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.7.1', 'Disjuntor tripolar caixa moldada 3x160A 65kA IEC60947-2', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.7.2', 'Disjuntor tripolar caixa moldada 3x300A 65kA IEC60947-2', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.8.1', 'Disjuntor tripolar caixa moldada 3x160A 10kA IEC60947', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.8.2', 'Disjuntor tripolar caixa moldada 3x200A 10kA IEC60947', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.9.1', 'Disjuntor tripolar NEMA 3x40A 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.9.2', 'Disjuntor tripolar NEMA 3x60A 5kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.10.1', 'Disjuntor tripolar NEMA 3x120A 10kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.10.2', 'Disjuntor tripolar NEMA 3x150A 10kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.10.3', 'Disjuntor tripolar NEMA 3x200A 10kA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.11.1', 'IDR bipolar 2x40A 30mA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.12.1', 'IDR tetrapolar 4x40A 30mA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.12.2', 'IDR tetrapolar 4x63A 30mA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.12.3', 'IDR tetrapolar 4x80A 30mA', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.13', 'Caixa sobrepor PVC 4 disjuntores DIN', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.15', 'DPS trilho DIN 40kA 275V classe 2', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.16', 'DPS trilho DIN 25kA 275V classe 1', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.17', 'Pente barramento trifásico 100A 20 posições monopolares', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.18', 'Kit barramento trifásico N+T 150A 44 posições monopolares', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.19', 'Kit barramento trifásico N+T 225A 70 posições monopolares', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.20', 'Barramento cobre neutro/terra 20 posições 150A', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.21', 'QDC sobrepor trifásico 44 posições monopolares 100A IP40', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.22', 'QDC sobrepor trifásico 70 posições monopolares 225A IP40', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.23', 'QDC sobrepor trifásico 269A 18 pinos barramentos neutro por linha', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.24', 'Programador horário 20 memórias trilho DIN 1 saída relé', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.28', 'Relé térmico sobrecarga tripolar 25A para contator', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.29', 'Botão de comando 22mm IP40 1NA+1NF', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.30', 'Multimedidor grandezas elétricas para painel com memória de massa', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.31', 'Sinaleiro LED 22mm 220V IP65', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.33', 'Relé proteção falta de fase e inversão trilho DIN', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.34', 'Ventilador painéis elétricos venezianas ABS filtros IP54', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.35', 'Fusível cartucho porcelana 10x38 20A', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.3.36', 'Fusível diazed 4A', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.1', 'Cabo cobre unipolar flexível 450/750V #2,5mm² (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.2', 'Cabo cobre unipolar flexível 450/750V #4,0mm² (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.3', 'Cabo cobre unipolar flexível 450/750V #6,0mm² (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.4', 'Cabo cobre unipolar flexível 450/750V #10mm² (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.1.5', 'Cabo cobre unipolar flexível 450/750V #16mm² (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.2.4', 'Cabo cobre unipolar flexível 1kV 90°C #50mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.2.5', 'Cabo cobre unipolar flexível 1kV 90°C #70mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.2.6', 'Cabo cobre unipolar flexível 1kV 90°C #120mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.2.7', 'Cabo cobre unipolar flexível 1kV 90°C #240mm²', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.5.1', 'Cabo lógico UTP 4 pares LSZH categoria 5E (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.5.2', 'Cabo lógico UTP 4 pares LSZH categoria 6 (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.6.1', 'Patch-cord UTP 2m categoria 5E', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.6.2', 'Patch-cord UTP 2m categoria 6', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.7.1', 'Cabo telefônico externo CTP-APL 10 pares', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.7.2', 'Cabo telefônico externo CTP-APL 20 pares', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.7.3', 'Cabo telefônico externo CTP-APL 50 pares', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.8.1', 'Cabo telefônico interno CI 10 pares', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.8.2', 'Cabo telefônico interno CI 20 pares', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.4.8.3', 'Cabo telefônico interno CI 50 pares', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.1.1', 'Eletroduto aço carbono 3/4" c/ acessórios (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.1.2', 'Eletroduto aço carbono 1" c/ acessórios (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.1.3', 'Eletroduto aço carbono 1¼" c/ acessórios (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.2.1', 'Eletroduto aço galvanizado fogo 1½" c/ acessórios', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.2.2', 'Eletroduto aço galvanizado fogo 2" c/ acessórios', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.2.3', 'Eletroduto aço galvanizado fogo 2½" c/ acessórios', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.4.1', 'Eletroduto flexível sealtube 3/4" (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.4.2', 'Eletroduto flexível sealtube 1" (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.9.2', 'Canaleta PVC antichama 50x20x2100mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.5.9.3', 'Canaleta PVC antichama 110x20x2100mm', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.6.6', 'Interruptor 1 tecla paralela three way c/ placa 10A/250V (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.6.13', 'Placa PVC 2x4" 2 teclas interruptor simples/paralelo (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.6.14', 'Placa PVC 2x4" 3 teclas interruptor simples/paralelo (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.1.1', 'Luminária sobrepor 2 lâmpadas T8 60cm soquete antivibratório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.1.2', 'Luminária sobrepor 2 lâmpadas T8 120cm soquete antivibratório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.2.1', 'Luminária embutir 2 lâmpadas T8 60cm soquete antivibratório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.2.2', 'Luminária embutir 2 lâmpadas T8 120cm soquete antivibratório', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.3', 'Luminária embutir forro modulado 2 lâmpadas tubo LED c/ cabo 1,5mm²', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.4', 'Luminária pétala uso externo em poste IP66 LED 100W bivolt', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.5', 'Luminária embutir forro modular 2 lâmpadas tubo LED 1,5mm²', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.7.6', 'Luminária embutir forro modular 4 lâmpadas tubo LED 1,5mm²', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.1', 'Lâmpada multi vapor metálico 150W/220V base E40', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.2', 'Lâmpada vapor de sódio 250W/220V base E40', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.3', 'Lâmpada vapor de sódio 400W/220V base E40', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.13', 'Reator lâmpada vapor metálico 150W/220V externo', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.14', 'Reator lâmpada vapor sódio 250W/220V poste/projetor', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.15', 'Reator lâmpada vapor sódio 400W/220V poste/projetor', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.20', 'Relé temporizador partida estrela-triângulo 220V 3-30s', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.8.21', 'Base acoplamento relé fotoelétrico suporte aço galvanizado', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.9.1', 'Certificação ponto cabeamento estruturado cat5e/cat6 c/ identificações', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.9.2', 'Patch panel 1U 24 posições cat.5E', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.9.3', 'Patch panel 1U 24 posições cat.6', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.9.4', 'Guia cabos horizontal alta densidade 1U 19" 24 cabos', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.3.9.5', 'Régua tomadas 2P+T 10A 250V para rack 8 saídas NBR14136', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.3', 'Mangueira incêndio NBR11861 tipo 2 Ø2½" 15m (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.4', 'Mangueira incêndio NBR11861 tipo 2 Ø2½" 20m (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.5', 'Adaptador Storz 2½"x1½" latão (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.6', 'Adaptador Storz 2½"x2½" latão (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.7', 'Esguicho tronco cônico 1½" (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.8', 'Esguicho tronco cônico 2½" (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.14', 'Pressostato IP-30 (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.15', 'Manômetro de processo (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.16.1', 'Tubulação aço galvanizado NBR5580 2½" DN65mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.16.2', 'Tubulação aço galvanizado NBR5580 4" DN100mm', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.17', 'Tampa ferro fundido hidrante de recalque', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.18', 'Chuveiro automático tipo pendente resposta rápida', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.2.19', 'Chuveiro automático tipo em pé resposta rápida', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.3.4', 'Central alarme incêndio endereçável classe B 100 dispositivos', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.4.5.1', 'Central iluminação emergência 24Vcc 1800W', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.1', 'Bomba centrífuga trifásica 1,5CV 220V vazão mín.9900L/h (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.2', 'Bomba centrífuga trifásica 3CV 220V vazão mín.21000L/h (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.3', 'Bomba centrífuga trifásica 5CV 220V vazão mín.14600L/h (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.4', 'Bomba centrífuga trifásica 7,5CV 220V vazão mín.35000L/h (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.5.1.5', 'Bomba submersível ½CV águas servidas 2200L/h (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.6.3', 'Placa motor portão universal bivolt (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.6.4', 'Cremalheira portão deslizante aço galvanizado (instalação)', 'M', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.1', 'Regulador pressão 1° estágio 9kg/h c/ manômetro Ø½" NTP (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.2', 'Regulador pressão 2° estágio 9kg/h Ø½" NTP (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.3', 'Mangote flexível pig tail Ø½" (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.7.4', 'Mangueira flexível aparelhos 80cm Ø½" (instalação)', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.8.1', 'Módulo fotovoltaico 600-720Wp vida útil 25 anos IEC61730/61215', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.8.2', 'Microinversor trifásico YC1000-3-220 AP Systems 900W IP67', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.8.3', 'ECU-R AP Systems unidade comunicação microinversores', 'UN', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('4.9', 'Diária (conforme índice ICD)', 'DIÁRIA', NULL, 'programada') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, valor_ref=excluded.valor_ref, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('EMG-3.1', 'Atendimento corretivo emergencial em comarca polo', 'UN', NULL, 'emergencial') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, origem_tipo=excluded.origem_tipo;
insert into public.material_catalog (codigo, descricao, unidade, valor_ref, origem_tipo) values ('EMG-3.2', 'Atendimento corretivo emergencial nas demais comarcas', 'UN', NULL, 'emergencial') on conflict (codigo) do update set descricao=excluded.descricao, unidade=excluded.unidade, origem_tipo=excluded.origem_tipo;

-- ===== Seed de prontuário e subestação =====
insert into public.prontuario_itens_catalog (codigo, rotulo) values ('PE01', '{''id'': ''PE01'', ''n'': ''1'', ''nm'': ''Prontuário de Instalações Elétricas'', ''validade'': 12}') on conflict (codigo) do update set rotulo=excluded.rotulo;
insert into public.prontuario_itens_catalog (codigo, rotulo) values ('PE02', '{''id'': ''PE02'', ''n'': ''2'', ''nm'': ''Laudo de SPDA (ABNT NBR 5419)'', ''validade'': 12}') on conflict (codigo) do update set rotulo=excluded.rotulo;
insert into public.prontuario_itens_catalog (codigo, rotulo) values ('PE03', '{''id'': ''PE03'', ''n'': ''3'', ''nm'': ''Laudo de Fachada (NBR 5674)'', ''validade'': 12}') on conflict (codigo) do update set rotulo=excluded.rotulo;
insert into public.prontuario_itens_catalog (codigo, rotulo) values ('PE04', '{''id'': ''PE04'', ''n'': ''4'', ''nm'': ''Diagrama Unifilar'', ''validade'': 12}') on conflict (codigo) do update set rotulo=excluded.rotulo;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('A', 'Seção 1', '{"id": "A", "n": "Segurança e NR-10", "sempre": true, "itens": [{"id": "chk_seg_nr10", "d": "Procedimentos de segurança NR-10 executados (credenciamento, EPI, LOTO)"}, {"id": "chk_seg_aterramento_temp", "d": "Aterramento temporário instalado antes dos serviços"}, {"id": "chk_seg_desenergizacao", "d": "Instalação desenergizada, aterrada e sinalizada"}, {"id": "chk_seg_concessionaria", "d": "Contato e agendamento com concessionária local realizado"}, {"id": "chk_seg_cargas_deslig", "d": "Todas as cargas elétricas desligadas antes da manobra"}, {"id": "chk_seg_prontuario_nr10", "d": "Prontuário de Instalações Elétricas (NR-10) verificado e atualizado"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('B', 'Seção 2', '{"id": "B", "n": "Transformadores", "sempre": true, "itens": [{"id": "chk_tr_desconexao", "d": "Entrada e saída de energia desconectadas"}, {"id": "chk_tr_limpeza", "d": "Limpeza completa de isoladores, suportes, abas, parafusos e aletas"}, {"id": "chk_tr_inspecao_ext", "d": "Inspeção minuciosa do exterior do transformador e adjacências"}, {"id": "chk_tr_vazamentos", "d": "Verificação e ausência de vazamentos de óleo"}, {"id": "chk_tr_trincas_buchas", "d": "Buchas inspecionadas — sem trincas, fissuras ou contaminações"}, {"id": "chk_tr_instrumentos", "d": "Instrumentos e acessórios inspecionados (termômetros, indicadores de nível)"}, {"id": "chk_tr_reaperto", "d": "Reaperto de todas as conexões elétricas"}, {"id": "chk_tr_aterramento_conexoes", "d": "Conexões de aterramento verificadas"}, {"id": "chk_tr_iso_cc", "d": "Ensaio de resistência de isolamento (corrente contínua)"}, {"id": "chk_tr_ohmica", "d": "Ensaio de resistência ôhmica dos enrolamentos (variação ≤ 3%)"}, {"id": "chk_tr_ttr", "d": "Ensaio da relação de transformação (TTR)"}, {"id": "chk_tr_oleo_coleta", "d": "[ANUAL] Óleo coletado para análise antes da manutenção", "anual": true}, {"id": "chk_tr_oleo_analise_fq", "d": "[ANUAL] Análise físico-química (rigidez dielétrica, teor de água, fator de potência, índice de neutralização, tensão interfacial, densidade, cor)", "anual": true}, {"id": "chk_tr_oleo_cromatografia", "d": "[ANUAL] Análise cromatográfica (C₂H₂, C₂H₄, H₂, CO, CO₂, CH₄)", "anual": true}, {"id": "chk_tr_oleo_nivel", "d": "[ANUAL] Nível de óleo verificado e complementado", "anual": true}, {"id": "chk_tr_prateamento", "d": "[ANUAL] Pontos de contato com desgaste de camada prateada tratados", "anual": true}, {"id": "chk_tr_reconexao", "d": "Entradas e saídas reconectadas após ensaios"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('CD', 'Seção 3', '{"id": "CD", "n": "Disjuntores de Média Tensão", "sempre": true, "itens": [{"id": "chk_dj_inspecao_ext", "d": "Inspeção externa e limpeza geral"}, {"id": "chk_dj_mecanismo", "d": "Mecanismo de comando inspecionado, limpo e lubrificado"}, {"id": "chk_dj_conexoes", "d": "Conexões reapertadas com torque adequado"}, {"id": "chk_dj_oleo_pvo", "d": "[PVO] Óleo mineral parafínico substituído (ABNT IEC 60296)", "pvo": true}, {"id": "chk_dj_grandezas", "d": "Grandezas elétricas características ensaiadas"}, {"id": "chk_dj_resist_contato", "d": "Resistência de contato ensaiada (R, S, T)"}, {"id": "chk_dj_iso", "d": "Resistência de isolamento ensaiada (aberto e fechado)"}, {"id": "chk_dj_operacao", "d": "Operação do disjuntor testada (abertura e fechamento)"}, {"id": "chk_dj_reles", "d": "Relés primários ajustados"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('E', 'Seção 4', '{"id": "E", "n": "Chaves Seccionadoras", "sempre": true, "itens": [{"id": "chk_sc_inspecao", "d": "Inspeção e limpeza geral da chave"}, {"id": "chk_sc_contatos", "d": "Contatos desoxidados e polidos"}, {"id": "chk_sc_lubrificacao", "d": "Partes articuladas lubrificadas"}, {"id": "chk_sc_resist_contato", "d": "Resistência de contato ensaiada (R1-R2, S1-S2, T1-T2)"}, {"id": "chk_sc_iso", "d": "Resistência de isolamento ensaiada (aberta e fechada)"}, {"id": "chk_sc_conexoes", "d": "Conexões elétricas reapertadas"}, {"id": "chk_sc_molas", "d": "Pressão das molas ajustada"}, {"id": "chk_sc_teste", "d": "Operação da chave testada"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('G', 'Seção 5', '{"id": "G", "n": "Muflas", "anual": true, "itens": [{"id": "chk_muf_visual", "d": "Inspeção visual de todas as muflas"}, {"id": "chk_muf_termico", "d": "Medições com termômetro digital e imagens térmicas"}, {"id": "chk_muf_limpeza", "d": "Limpeza executada"}, {"id": "chk_muf_iso", "d": "Testes de isolamento realizados"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('H', 'Seção 6', '{"id": "H", "n": "Relés Secundários", "anual": true, "abrigada": true, "itens": [{"id": "chk_rel_operacional", "d": "Condições operacionais de funcionamento verificadas"}, {"id": "chk_rel_nobreak", "d": "Nobreak verificado — baterias testadas e substituídas se necessário"}, {"id": "chk_rel_configuracao", "d": "Relés com perda de configuração reconfigurados"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('I', 'Seção 7', '{"id": "I", "n": "Barramentos Blindados", "anual": true, "abrigada": true, "itens": [{"id": "chk_bb_visual", "d": "Inspeção visual em toda extensão dos barramentos, cofres, pluglins e conexões"}, {"id": "chk_bb_torque", "d": "Reaperto com torquímetro em emendas, cofres, derivações e conexões"}, {"id": "chk_bb_limpeza", "d": "Limpeza com soprador em toda extensão (remoção de poeira)"}, {"id": "chk_bb_termico", "d": "Medições termográficas para pontos de aquecimento"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('J', 'Seção 8', '{"id": "J", "n": "Painéis Principais", "anual": true, "abrigada": true, "itens": [{"id": "chk_pan_limpeza_geral", "d": "Limpeza geral de barramentos, cubículos/celas, isoladores e painéis"}, {"id": "chk_pan_reaperto", "d": "Conexões elétricas (inclusive aterramento) reapertadas com torque adequado"}, {"id": "chk_pan_limpeza_dependencias", "d": "Dependências onde os painéis estão instalados limpas"}, {"id": "chk_pan_parafusos", "d": "Parafusos, conectores e terminais faltantes supridos"}, {"id": "chk_pan_corrosao", "d": "Corrosões tratadas e pintura de proteção aplicada"}, {"id": "chk_pan_termico", "d": "Inspeção com termômetro digital para pontos de aquecimento"}, {"id": "chk_pan_iluminacao", "d": "Iluminação interna dos painéis mantida em condições adequadas"}, {"id": "chk_pan_coolers", "d": "Coolers/exaustores inspecionados e em perfeito funcionamento"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('K', 'Seção 9', '{"id": "K", "n": "Sala da Subestação", "abrigada": true, "itens": [{"id": "chk_sala_limpeza", "d": "Limpeza das áreas internas, portas, portões, grades e pisos"}, {"id": "chk_sala_grades_portas", "d": "Grades, suportes metálicos, portas e portões — reparos de segurança executados"}, {"id": "chk_sala_cadeados", "d": "Cadeados nas portas, portões e grades inspecionados e repostos"}, {"id": "chk_sala_ilum_geral", "d": "Iluminação geral e de emergência inspecionadas — lâmpadas substituídas"}, {"id": "chk_sala_limpeza_sup", "d": "Limpeza da parte superior das cabines e painéis executada"}, {"id": "chk_sala_conectores", "d": "Conectores e terminais faltantes repostos"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;
insert into public.subestacao_secoes_catalog (codigo, rotulo, dados) values ('DOC', 'Seção 10', '{"id": "DOC", "n": "Documentação e Relatório", "sempre": true, "itens": [{"id": "chk_rel_fotos", "d": "Relatório fotográfico elaborado"}, {"id": "chk_rel_valores", "d": "Valores dos ensaios registrados no relatório técnico"}, {"id": "chk_rel_conformidades", "d": "Conformidades e não conformidades documentadas"}, {"id": "chk_rel_corretivos", "d": "Serviços corretivos detectados documentados"}, {"id": "chk_rel_religacao", "d": "Instalação reenergizada — todas as cargas restabelecidas"}, {"id": "chk_rel_fiscalizacao", "d": "Relatório a entregar à Fiscalização em até 10 dias úteis"}]}'::jsonb) on conflict (codigo) do update set rotulo=excluded.rotulo, dados=excluded.dados;

-- ===== Seed de usuários legados do app =====
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u1', 'Edenias Gonzaga Leão', 'P0155070', '0872', 'NORTE', 'Apoio Técnico', 'Montes Claros', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u2', 'Túlio Heleno L. Lobato', 'T2183-2', '2183', 'NORTE', 'Fiscal', 'Montes Claros', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u3', 'Jarém Guarany Gomes Jr.', 'T006387-5', '6387', 'CENTRAL', 'Fiscal', 'Contagem', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u4', 'Luís Cláudio F. Cunha', '600.94701', '4701', 'CENTRAL', 'Fiscal', 'Betim', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u5', 'Márcia Gomes Alvarenga', 'T008172-9', '8172', 'LESTE', 'Fiscal', 'Gov. Valadares', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u6', 'Guilherme A. Alencar', 'P0094702', '4702', 'LESTE', 'Fiscal', 'Ipatinga', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u7', 'Rui Cassiano R. Lima', 'P0117128', '7128', 'LESTE', 'Fiscal', 'Itabira', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u8', 'José Agostinho H. R. Assunção', '', '8001', 'ZONA_MATA', 'Fiscal', 'Juiz de Fora', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u9', 'Thiago Abreu', '', '9001', 'ZONA_MATA', 'Fiscal', 'Juiz de Fora', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u10', 'Alisson Cruz Pereira', '8546-4', '5461', 'TRIANGULO', 'Fiscal', '', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u11', 'Flávio Ferreira Ribeiro', '60130718', '3071', 'TRIANGULO', 'Fiscal', '', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u12', 'Raphael Alan Ferreira', 'P0115765', '1157', 'SUL', 'Fiscal', '', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u13', 'Diego Henrique C. Oliveira', 'P0128696', '2869', 'SUL', 'Fiscal', '', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u14', 'Vanderlúcio de Jesus Ferreira', '', '7743', 'SUDOESTE', 'Fiscal', '', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;
insert into public.app_users (id, nome, mat, pin, reg, cargo, polo, ativo) values ('u15', 'Taciano de Paula Costa Bastos', '', '9254', 'SUDOESTE', 'Fiscal', '', true) on conflict (id) do update set nome=excluded.nome, mat=excluded.mat, pin=excluded.pin, reg=excluded.reg, cargo=excluded.cargo, polo=excluded.polo, ativo=excluded.ativo;

-- ===== Reprocessar inspeções já existentes =====
update public.inspections set payload = payload;

commit;