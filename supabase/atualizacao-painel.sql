-- Atualização da função painel: acrescenta divergência (desvio padrão das notas)
-- e agregados por mesa. Rode no SQL Editor do Supabase. Não mexe nos dados.
-- Pode rodar mais de uma vez.

create or replace function public.painel(p_evento text default 'ocahuna')
returns json
language sql
security definer
set search_path = public
as $$
with base as (
  select r.nivel, r.mesa, f.key as frente,
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
             round(coalesce(stddev_pop(a),0),1) as dp_energia,
             round(coalesce(stddev_pop(b),0),1) as dp_expectativa,
             round(coalesce(stddev_pop(c),0),1) as dp_impacto,
             count(*) filter (where a>=6 and b>=6) as m1_foco_certo,
             count(*) filter (where a>=6 and b<=5) as m1_aposta,
             count(*) filter (where a<=5 and b>=6) as m1_descoberto,
             count(*) filter (where a>=6 and c>=6) as m2_sistema,
             count(*) filter (where a>=6 and c<=5) as m2_delegar,
             count(*) filter (where a<=5 and c>=6) as m2_ponta_solta
      from base group by frente) t),
  'por_nivel_frente', (select json_agg(t) from (
      select nivel, frente,
             count(*) as n,
             round(avg(a),1) as media_energia,
             round(avg(b),1) as media_expectativa,
             round(avg(c),1) as media_impacto,
             round(coalesce(stddev_pop(a),0),1) as dp_energia,
             round(coalesce(stddev_pop(b),0),1) as dp_expectativa,
             round(coalesce(stddev_pop(c),0),1) as dp_impacto,
             count(*) filter (where a>=6 and b>=6) as m1_foco_certo,
             count(*) filter (where a>=6 and b<=5) as m1_aposta,
             count(*) filter (where a<=5 and b>=6) as m1_descoberto,
             count(*) filter (where a>=6 and c>=6) as m2_sistema,
             count(*) filter (where a>=6 and c<=5) as m2_delegar,
             count(*) filter (where a<=5 and c>=6) as m2_ponta_solta
      from base group by nivel, frente) t),
  'por_mesa_frente', (select json_agg(t) from (
      select mesa, frente,
             count(*) as n,
             round(avg(a),1) as media_energia,
             round(avg(b),1) as media_expectativa,
             round(avg(c),1) as media_impacto
      from base group by mesa, frente) t)
);
$$;

revoke all on function public.painel(text) from public;
grant execute on function public.painel(text) to anon;
