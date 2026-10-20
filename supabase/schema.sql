-- Sua Área S.A. · schema do Supabase
-- Cole no SQL Editor do projeto (ou aplique como migração). Pode rodar mais de uma vez.

-- 1. Tabela ---------------------------------------------------------------

create table if not exists public.respostas (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  evento      text not null default 'ocahuna',
  mesa        smallint not null check (mesa between 1 and 6),
  nivel       text not null check (nivel in ('coordenacao','gerencia','executivo')),
  energia     jsonb not null check (jsonb_typeof(energia) = 'object'),
  expectativa jsonb not null check (jsonb_typeof(expectativa) = 'object'),
  impacto     jsonb not null check (jsonb_typeof(impacto) = 'object')
);

create index if not exists respostas_evento_idx on public.respostas (evento);

-- 2. Segurança (RLS): o anônimo só insere --------------------------------

alter table public.respostas enable row level security;

drop policy if exists "anon insere" on public.respostas;
create policy "anon insere"
  on public.respostas for insert
  to anon
  with check (true);
-- nenhuma policy de select: o anon não lê a tabela

grant insert on public.respostas to anon;

-- 3. Dados do painel (só agregados) --------------------------------------

create or replace function public.painel(p_evento text default 'ocahuna')
returns json
language sql
security definer
set search_path = public
as $$
with base as (
  select r.nivel, f.key as frente,
         (r.energia->>f.key)::int     as a,
         (r.expectativa->>f.key)::int as b,
         (r.impacto->>f.key)::int     as c
  from respostas r
  cross join lateral jsonb_each(r.energia) f
  where r.evento = p_evento
)
select json_build_object(
  'total', (select count(*) from respostas where evento = p_evento),
  'por_nivel', (select json_object_agg(nivel, n) from (
      select nivel, count(*) n from respostas where evento = p_evento group by nivel) t),
  'frentes', (select json_agg(t) from (
      select frente,
             round(avg(a),1) as media_energia,
             round(avg(b),1) as media_expectativa,
             round(avg(c),1) as media_impacto,
             count(*) filter (where a>=6 and b>=6) as m1_foco_certo,
             count(*) filter (where a>=6 and b<=5) as m1_aposta,
             count(*) filter (where a<=5 and b>=6) as m1_descoberto,
             count(*) filter (where a>=6 and c>=6) as m2_sistema,
             count(*) filter (where a>=6 and c<=5) as m2_delegar,
             count(*) filter (where a<=5 and c>=6) as m2_ponta_solta
      from base group by frente) t),
  -- por nível, com os mesmos contadores de quadrante, para o filtro do painel
  'por_nivel_frente', (select json_agg(t) from (
      select nivel, frente,
             count(*) as n,
             round(avg(a),1) as media_energia,
             round(avg(b),1) as media_expectativa,
             round(avg(c),1) as media_impacto,
             count(*) filter (where a>=6 and b>=6) as m1_foco_certo,
             count(*) filter (where a>=6 and b<=5) as m1_aposta,
             count(*) filter (where a<=5 and b>=6) as m1_descoberto,
             count(*) filter (where a>=6 and c>=6) as m2_sistema,
             count(*) filter (where a>=6 and c<=5) as m2_delegar,
             count(*) filter (where a<=5 and c>=6) as m2_ponta_solta
      from base group by nivel, frente) t)
);
$$;

revoke all on function public.painel(text) from public;
grant execute on function public.painel(text) to anon;
