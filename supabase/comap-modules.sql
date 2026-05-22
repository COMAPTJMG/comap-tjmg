-- ============================================================
-- COMAP MODULES — Tabelas para Emergencial, Periódica,
-- PCI, Diário de Fiscalização, Usuários e Pendências
-- Executar no SQL Editor do Supabase após o schema principal
-- ============================================================

-- ── Extensão útil ───────────────────────────────────────────
create extension if not exists pgcrypto;

-- ============================================================
-- 1. USUÁRIOS DO SISTEMA
-- ============================================================
create table if not exists public.comap_usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null unique,
  senha_hash  text not null,
  regiao      text not null,  -- NORTE|CENTRAL|LESTE|ZONA_MATA|TRIANGULO|SUL|SUDOESTE|MASTER|ADMIN
  cargo       text,
  polo        text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 2. EMERGENCIAIS (OSE)
-- ============================================================
create table if not exists public.comap_emergenciais (
  id              uuid primary key default gen_random_uuid(),
  ose             text not null,                -- Número da OSE
  contrato        text,
  data_abertura   date not null default current_date,
  hora_abertura   time,
  regiao          text not null,
  comarca         text not null,
  edificacao      text not null,
  descricao       text,
  status          text not null default 'ABERTO',
  -- ABERTO | EM ATRASO | ABERTO(REPROGRAMADO) | EM ATENDIMENTO
  -- CONCLUÍDO | CONCLUÍDO(ATRASO24) | CONCLUÍDO(ATRASO48) | CONCLUÍDO(ATRASOACIMA48)
  -- CANCELADO
  data_conclusao  date,
  hora_conclusao  time,
  sistema         text,
  subsistema      text,
  elemento        text,
  causa_raiz      text,
  motivo_cancelamento text,
  reprogramado_de date,     -- data original antes da reprogramação
  dias_atraso     integer default 0,
  prazo_limite    timestamptz,
  email_atraso_enviado boolean default false,
  usuario_id      uuid references public.comap_usuarios(id) on delete set null,
  usuario_nome    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_emergenciais_status   on public.comap_emergenciais(status);
create index if not exists idx_emergenciais_regiao   on public.comap_emergenciais(regiao);
create index if not exists idx_emergenciais_abertura on public.comap_emergenciais(data_abertura);

-- ============================================================
-- 3. PERIÓDICAS
-- ============================================================
create table if not exists public.comap_periodicas (
  id              uuid primary key default gen_random_uuid(),
  contrato        text,
  regiao          text not null,
  comarca         text not null,
  edificacao      text not null,
  grupo           text check (grupo in ('A','B','C')),
  polo            text,
  tipo_atendimento text default 'trimestral', -- trimestral|semestral|anual
  os_numero       text,
  descricao       text,
  fiscal_nome     text,
  fiscal_mat      text,
  status          text not null default 'AGENDADO',
  -- AGENDADO | EM ANDAMENTO | CONCLUIDO | CONCLUIDO_NO_PRAZO | CONCLUIDO_ATRASO | CANCELADO
  data_prog_inicio date,
  data_prog_fim    date,
  data_real_inicio date,
  data_real_fim    date,
  dias_trabalhados integer,
  checklist        jsonb default '{}'::jsonb,  -- itens do checklist
  materiais        jsonb default '[]'::jsonb,
  observacoes      text,
  usuario_id       uuid references public.comap_usuarios(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_periodicas_status  on public.comap_periodicas(status);
create index if not exists idx_periodicas_regiao  on public.comap_periodicas(regiao);
create index if not exists idx_periodicas_prog    on public.comap_periodicas(data_prog_fim);

-- ============================================================
-- 4. PCI — Prevenção e Combate a Incêndio
-- ============================================================
create table if not exists public.comap_pci (
  id              uuid primary key default gen_random_uuid(),
  contrato        text not null,
  regiao          text not null,
  comarca         text not null,
  edificacao      text not null,
  tipo_pci        text not null,  -- EXTINTOR AP|CO2|PQS|ABC | MANGUEIRA 15m|20m
  quantidade      integer not null default 1,
  data_recarga    date,
  data_validade   date not null,
  rti             text,           -- número do RTI
  rti_url         text,           -- link do arquivo RTI no Drive
  condenado       text,
  observacoes     text,
  suspenso        boolean default false,
  data_medicao_1  date,
  data_medicao_2  date,
  data_medicao_3  date,
  data_medicao_4  date,
  status_calculado text,          -- calculado no frontend: VENCIDO|VENCE EM 30|VIGENTE
  usuario_id       uuid references public.comap_usuarios(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_pci_regiao   on public.comap_pci(regiao);
create index if not exists idx_pci_comarca  on public.comap_pci(comarca);
create index if not exists idx_pci_validade on public.comap_pci(data_validade);

-- ============================================================
-- 5. DIÁRIO DE FISCALIZAÇÃO
-- ============================================================
create table if not exists public.comap_diario (
  id              uuid primary key default gen_random_uuid(),
  data_registro   date not null,
  local_trabalho  text not null,  -- CAMPO | ESCRITÓRIO
  regiao          text not null,
  usuario_id      uuid references public.comap_usuarios(id) on delete set null,
  usuario_nome    text,
  usuario_email   text,
  ferias_inicio   date,
  ferias_fim      date,
  -- Manutenção Periódica
  manut_periodica       jsonb default '[]'::jsonb,  -- [{comarca, equipe, modelo, padrao}]
  manut_dentro_periodo  boolean,
  manut_justif_periodo  text,
  plano_integral        boolean,
  plano_justif          text,
  plano_itens_pendentes text,
  -- Emergencial
  teve_chamados         boolean,
  chamados              jsonb default '[]'::jsonb,  -- [{comarca, ose}]
  chamados_no_prazo     boolean,
  chamados_justif       text,
  -- Programada
  ordens_programadas    jsonb default '[]'::jsonb,  -- [{os_numero, data_exec, status}]
  -- Notificações
  notif_email   integer default 0,
  notif_sei     integer default 0,
  notif_whats   integer default 0,
  -- Medição / Relatórios
  medicao_realizada     boolean,
  medicao_detalhes