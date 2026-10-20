(function () {
  'use strict';

  var S = window.SAS;
  var CFG = window.SAS_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var evento = params.get('evento') || CFG.EVENTO || 'ocahuna';
  var totalEsperado = parseInt(params.get('total'), 10) || CFG.TOTAL_ESPERADO || 27;
  var filtro = 'todos';
  var vista = 'geral';
  var metrica = 'gap';
  var dados = null;
  var ultimoJSON = '';
  var sb = null;
  var DP_MAX = 4.5; // desvio padrão máximo possível com notas de 1 a 10 sem repetição

  var AVISO_SQL = '<div class="aviso-sql">Esta visão precisa da função painel atualizada no Supabase. Rode o arquivo supabase/atualizacao-painel.sql no SQL Editor.</div>';

  function el(id) { return document.getElementById(id); }

  function nomeFrente(sigla) {
    for (var i = 0; i < S.FRENTES.length; i++) if (S.FRENTES[i].sigla === sigla) return S.FRENTES[i].nome;
    return sigla;
  }

  function fmt(n) { return Number(n).toFixed(1).replace('.', ','); }
  function num(x) { var n = Number(x); return isNaN(n) ? 0 : n; }
  function status(msg) { el('status').textContent = msg; }

  function iniciarSupabase() {
    var url = CFG.SUPABASE_URL || '', chave = CFG.SUPABASE_ANON_KEY || '';
    if (!url || !chave || url.indexOf('COLE_') === 0 || chave.indexOf('COLE_') === 0) {
      status('Falta preencher config.js com a URL e a chave do Supabase.');
      return false;
    }
    sb = window.supabase.createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
    return true;
  }

  function buscar() {
    if (!sb) return;
    Promise.resolve(sb.rpc('painel', { p_evento: evento })).then(function (r) {
      if (r.error) { status('Sem conexão com o banco. Tentando de novo.'); return; }
      var json = JSON.stringify(r.data);
      status('Atualizado às ' + new Date().toLocaleTimeString('pt-BR'));
      if (json !== ultimoJSON) {
        ultimoJSON = json;
        dados = r.data;
        desenhar();
      }
    }, function () { status('Sem conexão com o banco. Tentando de novo.'); });
  }

  /* ---------- dados do filtro ---------- */

  function linhasDoFiltro() {
    if (!dados) return [];
    if (filtro === 'todos') return dados.frentes || [];
    return (dados.por_nivel_frente || []).filter(function (r) { return r.nivel === filtro; });
  }

  function totalDoFiltro() {
    if (!dados) return 0;
    if (filtro === 'todos') return num(dados.total);
    return num((dados.por_nivel || {})[filtro]);
  }

  /* ---------- contador ---------- */

  function desenharContador() {
    var total = dados ? num(dados.total) : 0;
    el('contador').innerHTML = '<span>' + total + '</span> de ' + totalEsperado + ' responderam';
    var pn = (dados && dados.por_nivel) || {};
    el('niveis').textContent = Object.keys(S.NIVEIS).map(function (k) { return S.NIVEIS[k] + ' ' + num(pn[k]); }).join(' · ');
    el('barra-progresso').style.width = Math.min(100, (total / totalEsperado) * 100) + '%';
  }

  /* ---------- visão geral ---------- */

  function desenharBarras(linhas) {
    var alvo = el('barras');
    if (!linhas.length) { alvo.innerHTML = '<div class="aguardando">Aguardando as primeiras respostas</div>'; return; }
    var itens = linhas.map(function (r) {
      var en = num(r.media_energia), ex = num(r.media_expectativa);
      return { sigla: r.frente, en: en, ex: ex, dif: ex - en };
    });
    itens.sort(function (a, b) { return Math.abs(b.dif) - Math.abs(a.dif); });
    alvo.innerHTML = itens.map(function (i) {
      var alerta = i.ex > i.en;
      var sinal = i.dif > 0 ? '+' : (i.dif < 0 ? '-' : '');
      return '<div class="linha-barra' + (alerta ? ' alerta' : '') + '">' +
        '<div class="nome"><b>' + i.sigla + '</b>' + nomeFrente(i.sigla) + '</div>' +
        '<div class="barras">' +
          '<div class="barra energia"><i style="width:' + (i.en * 10) + '%"></i><span>' + fmt(i.en) + '</span></div>' +
          '<div class="barra expectativa"><i style="width:' + (i.ex * 10) + '%"></i><span>' + fmt(i.ex) + '</span></div>' +
        '</div>' +
        '<div class="dif">' + sinal + fmt(Math.abs(i.dif)) + '</div>' +
      '</div>';
    }).join('');
  }

  function top3(linhas, campo, desempate) {
    return linhas
      .filter(function (r) { return num(r[campo]) > 0; })
      .sort(function (a, b) {
        var d = num(b[campo]) - num(a[campo]);
        return d !== 0 ? d : num(b[desempate]) - num(a[desempate]);
      })
      .slice(0, 3);
  }

  function desenharRanking(id, itens, campo, total) {
    var alvo = el(id);
    if (!itens.length) { alvo.innerHTML = '<li class="vazio" style="display:block;background:none;padding:.4rem 0">Nenhuma frente por aqui</li>'; return; }
    alvo.innerHTML = itens.map(function (r, i) {
      return '<li><span class="pos">' + (i + 1) + '</span>' +
        '<span class="nome"><b>' + r.frente + '</b>' + nomeFrente(r.frente) + '</span>' +
        '<span class="qtd">' + num(r[campo]) + ' <small>de ' + total + '</small></span></li>';
    }).join('');
  }

  function desenharGeral() {
    var linhas = linhasDoFiltro();
    var total = totalDoFiltro();
    desenharBarras(linhas);
    desenharRanking('sistema', top3(linhas, 'm2_sistema', 'media_impacto'), 'm2_sistema', total);
    desenharRanking('ponta', top3(linhas, 'm2_ponta_solta', 'media_impacto'), 'm2_ponta_solta', total);
    desenharRanking('descoberto', top3(linhas, 'm1_descoberto', 'media_expectativa'), 'm1_descoberto', total);
  }

  /* ---------- divergências ---------- */

  function desenharDiverg() {
    var linhas = linhasDoFiltro();
    var alvo = el('tabela-diverg');
    var topo = el('top-diverg');
    if (!linhas.length) {
      alvo.innerHTML = '<div class="aguardando">Aguardando as primeiras respostas</div>';
      topo.innerHTML = '';
      return;
    }
    if (linhas[0].dp_energia === undefined) { alvo.innerHTML = AVISO_SQL; topo.innerHTML = ''; return; }

    var dims = [
      { k: 'energia', nome: 'Energia', m: 'media_energia', d: 'dp_energia' },
      { k: 'expectativa', nome: 'Expectativa', m: 'media_expectativa', d: 'dp_expectativa' },
      { k: 'impacto', nome: 'Impacto', m: 'media_impacto', d: 'dp_impacto' }
    ];
    var itens = linhas.map(function (r) {
      var max = Math.max(num(r.dp_energia), num(r.dp_expectativa), num(r.dp_impacto));
      return { r: r, max: max };
    }).sort(function (a, b) { return b.max - a.max; });

    var html = '<table class="tabela"><thead><tr><th>Frente</th>' +
      dims.map(function (d) { return '<th>' + d.nome + '</th>'; }).join('') + '</tr></thead><tbody>';
    itens.forEach(function (i) {
      html += '<tr><td class="nome"><b>' + i.r.frente + '</b>' + nomeFrente(i.r.frente) + '</td>';
      dims.forEach(function (d) {
        var dp = num(i.r[d.d]);
        var forca = Math.min(1, dp / DP_MAX);
        var fundo = 'rgba(244,162,97,' + (forca * 0.38).toFixed(2) + ')';
        html += '<td><div class="cel' + (dp >= 3 ? ' alta' : '') + '" style="background:linear-gradient(0deg,' + fundo + ',' + fundo + '),#0D1B2A">' +
          '<span class="m">' + fmt(i.r[d.m]) + '</span><span class="d">±' + fmt(dp) + '</span></div></td>';
      });
      html += '</tr>';
    });
    alvo.innerHTML = html + '</tbody></table>';

    var celulas = [];
    linhas.forEach(function (r) {
      dims.forEach(function (d) { celulas.push({ frente: r.frente, dim: d.nome, dp: num(r[d.d]), media: num(r[d.m]) }); });
    });
    celulas.sort(function (a, b) { return b.dp - a.dp; });
    topo.innerHTML = celulas.slice(0, 5).map(function (c, i) {
      return '<li><span class="pos">' + (i + 1) + '</span>' +
        '<span class="nome"><b>' + c.frente + '</b>' + c.dim + '</span>' +
        '<span class="qtd">±' + fmt(c.dp) + ' <small>média ' + fmt(c.media) + '</small></span></li>';
    }).join('');
  }

  /* ---------- mesas ---------- */

  function valorMetrica(r) {
    if (metrica === 'gap') return num(r.media_expectativa) - num(r.media_energia);
    return num(r['media_' + metrica]);
  }

  function corCelula(v) {
    if (metrica === 'gap') {
      var f = Math.min(1, Math.abs(v) / 6);
      var base = v > 0 ? '247,108,94' : '42,157,143';
      return 'rgba(' + base + ',' + (f * 0.85).toFixed(2) + ')';
    }
    return 'rgba(42,157,143,' + (Math.min(1, v / 10) * 0.8).toFixed(2) + ')';
  }

  function textoValor(v) {
    if (metrica === 'gap') return (v > 0 ? '+' : (v < 0 ? '-' : '')) + fmt(Math.abs(v));
    return fmt(v);
  }

  function desenharMesas() {
    var alvo = el('tabela-mesas');
    var leitura = el('leitura-mesas');
    if (!dados || !num(dados.total)) { alvo.innerHTML = '<div class="aguardando">Aguardando as primeiras respostas</div>'; leitura.textContent = ''; return; }
    if (dados.por_mesa_frente === undefined) { alvo.innerHTML = AVISO_SQL; leitura.textContent = ''; return; }

    var porMesa = {};
    (dados.por_mesa_frente || []).forEach(function (r) {
      var m = porMesa[r.mesa] || (porMesa[r.mesa] = { n: num(r.n), frentes: {} });
      m.frentes[r.frente] = r;
    });

    var cab = '<tr><th></th>' + S.FRENTES.map(function (f) { return '<th>' + f.sigla + '</th>'; }).join('') + '</tr>';
    var corpo = '';
    for (var m = 1; m <= 6; m++) {
      var g = porMesa[m];
      corpo += '<tr><td class="mesa">Mesa ' + m + '<small>' + (g ? g.n + (g.n === 1 ? ' pessoa' : ' pessoas') : 'sem respostas') + '</small></td>';
      S.FRENTES.forEach(function (f) {
        var r = g && g.frentes[f.sigla];
        if (!r) { corpo += '<td class="c" style="color:#4A6279">·</td>'; return; }
        var v = valorMetrica(r);
        corpo += '<td class="c" style="background:linear-gradient(0deg,' + corCelula(v) + ',' + corCelula(v) + '),#0D1B2A">' + textoValor(v) + '</td>';
      });
      corpo += '</tr>';
    }
    // linha da sala inteira
    corpo += '<tr class="sala"><td class="mesa">Sala<small>' + num(dados.total) + ' pessoas</small></td>';
    var porFrente = {};
    (dados.frentes || []).forEach(function (r) { porFrente[r.frente] = r; });
    S.FRENTES.forEach(function (f) {
      var r = porFrente[f.sigla];
      if (!r) { corpo += '<td class="c">·</td>'; return; }
      var v = valorMetrica(r);
      corpo += '<td class="c" style="background:linear-gradient(0deg,' + corCelula(v) + ',' + corCelula(v) + '),#0D1B2A">' + textoValor(v) + '</td>';
    });
    corpo += '</tr>';
    alvo.innerHTML = '<table class="mesas"><thead>' + cab + '</thead><tbody>' + corpo + '</tbody></table>';

    leitura.textContent = metrica === 'gap'
      ? 'Coral: a mesa espera mais do que investe nessa frente. Teal: investe mais do que espera. Grupos pequenos: use como abertura de conversa, não como conclusão.'
      : 'Quanto mais forte o teal, maior a nota média da mesa. Grupos pequenos: use como abertura de conversa, não como conclusão.';
  }

  /* ---------- roteamento de vistas ---------- */

  function desenhar() {
    desenharContador();
    if (vista === 'geral') desenharGeral();
    else if (vista === 'diverg') desenharDiverg();
    else desenharMesas();
  }

  function mostrarVista(v) {
    vista = v;
    ['geral', 'diverg', 'mesas'].forEach(function (id) { el('vista-' + id).hidden = (id !== v); });
    Array.prototype.forEach.call(el('vistas').children, function (b) { b.classList.toggle('ativo', b.getAttribute('data-v') === v); });
    el('filtro').classList.toggle('desligado', v === 'mesas');
    desenhar();
  }

  el('vistas').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-v]');
    if (b) mostrarVista(b.getAttribute('data-v'));
  });

  el('filtro').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-f]');
    if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(el('filtro').children, function (x) { x.classList.toggle('ativo', x === b); });
    desenhar();
  });

  el('metricas').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-m]');
    if (!b) return;
    metrica = b.getAttribute('data-m');
    Array.prototype.forEach.call(el('metricas').children, function (x) { x.classList.toggle('ativo', x === b); });
    desenharMesas();
  });

  document.addEventListener('keydown', function (ev) {
    var mapa = { '1': 'geral', '2': 'diverg', '3': 'mesas' };
    if (mapa[ev.key]) mostrarVista(mapa[ev.key]);
  });

  desenhar();
  if (iniciarSupabase()) {
    buscar();
    setInterval(buscar, 5000);
  }
})();
