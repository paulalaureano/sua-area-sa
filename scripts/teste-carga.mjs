// Teste de carga: 30 inserts simultâneos com evento 'teste'.
// Uso (Node 18 ou mais novo):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=chave node scripts/teste-carga.mjs [quantidade]
// Depois, para limpar:  delete from respostas where evento = 'teste';

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_ANON_KEY;
const quantidade = parseInt(process.argv[2], 10) || 30;

if (!url || !chave) {
  console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY.');
  process.exit(1);
}

const siglas = ['FIN', 'PES', 'OPE', 'CLI', 'PRO', 'MKT', 'EST', 'PAR', 'RP', 'CON'];
const niveis = ['coordenacao', 'gerencia', 'executivo'];

function permutacao() {
  const a = siglas.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const notas = {};
  a.forEach((s, i) => { notas[s] = 10 - i; });
  return notas;
}

async function inserir(i) {
  const corpo = {
    evento: 'teste',
    mesa: (i % 6) + 1,
    nivel: niveis[i % 3],
    energia: permutacao(),
    expectativa: permutacao(),
    impacto: permutacao()
  };
  const t0 = Date.now();
  const r = await fetch(`${url}/rest/v1/respostas`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(corpo)
  });
  return { ok: r.ok, status: r.status, ms: Date.now() - t0 };
}

const inicio = Date.now();
const resultados = await Promise.all(Array.from({ length: quantidade }, (_, i) => inserir(i)));
const ok = resultados.filter((r) => r.ok).length;
const lentos = resultados.map((r) => r.ms).sort((a, b) => a - b);
console.log(`${ok} de ${quantidade} inserts ok em ${Date.now() - inicio} ms`);
console.log(`Tempo por insert: mediana ${lentos[Math.floor(lentos.length / 2)]} ms, pior ${lentos[lentos.length - 1]} ms`);
if (ok < quantidade) console.log('Falhas:', resultados.filter((r) => !r.ok).map((r) => r.status).join(', '));

// O painel deve responder só com agregados:
const p = await fetch(`${url}/rest/v1/rpc/painel`, {
  method: 'POST',
  headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_evento: 'teste' })
});
const j = await p.json();
console.log('painel(teste): total =', j.total, '| por nível =', JSON.stringify(j.por_nivel));

// E a tabela não pode ser lida pelo anônimo:
const l = await fetch(`${url}/rest/v1/respostas?select=id&limit=1`, { headers: { apikey: chave, Authorization: `Bearer ${chave}` } });
const linhas = await l.json();
console.log('Leitura direta da tabela pelo anon:', Array.isArray(linhas) && linhas.length === 0 ? 'bloqueada (ok)' : 'ATENÇÃO, conferir a RLS: ' + JSON.stringify(linhas).slice(0, 120));
