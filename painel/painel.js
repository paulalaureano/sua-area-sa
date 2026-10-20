(function () {
  'use strict';

  var S = window.SAS;
  var CFG = window.SAS_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var evento = params.get('evento') || CFG.EVENTO || 'ocahuna';
  var totalEsperado = parseInt(params.get('total'), 10) || CFG.TOTAL_ESPERADO || 27;
  var filtro = 'todos';
  var dados = null;
  var ultimoJSON = '';
  var sb = null;

  function el(id) { return document.getElementById(id); }

  function nomeFrente(sigla) {
    for (var i = 0; i < S.FRENTES.length; i++) if (S.FRENTES[i].sigla === sigla) return S.FRENTES[i].nome;
    return sigla;
  }

  function fmt(n) { return Number(n).toFixed(1).replace('.', ','); }

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
      var agora = new Date().toLocaleTimeString('pt-BR');
      status('Atualizado às ' + agora);
      if (json !== ultimoJSON) {
        ultimoJSON = json;
        dados = r.data;
        desenhar();
      }
    }, function () { status('Sem conexão com o banco. Tentando de novo.'); });
  }

  function linhasDoFiltro() {
    if (!dados) return [];
    if (filtro === 'todos') return dados.frentes || [];
    return (dados.por_nivel_frente || []).filter(function (r) { return r.nivel === filtro; });
  }

  function totalDoFiltro() {
    if (!dados) return 0;
    if (filtro === 'todos') return Number(dados.total) || 0;
    return Number((dados.por_nivel || {})[filtro]) || 0;
  }

  function desenharContador() {
    var total = dados ? Number(dados.total) || 0 : 0;
    el('contador').innerHTML = '<span>' + total + '</span> de ' + totalEsperado + ' responderam';
    var pn = (dados && dados.por_nivel) || {};
    var partes = Object.keys(S.NIVEIS).map(function (k) { return S.NIVEIS[k] + ' ' + (Number(pn[k]) || 0); });
    el('niveis').textContent = partes.join(' · ');
    el('barra-progresso').style.width = Math.min(100, (total / totalEsperado) * 100) + '%';
  }

  function desenharBarras(linhas) {
    var alvo = el('barras');
    if (!linhas.length) { alvo.innerHTML = '<div class="aguardando">Aguardando as primeiras respostas</div>'; return; }
    var itens = linhas.map(function (r) {
      var en = Number(r.media_energia), ex = Number(r.media_expectativa);
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
      .filter(function (r) { return Number(r[campo]) > 0; })
      .sort(function (a, b) {
        var d = Number(b[campo]) - Number(a[campo]);
        if (d !== 0) return d;
        return Number(b[desempate]) - Number(a[desempate]);
      })
      .slice(0, 3);
  }

  function desenharRanking(id, itens, campo, total) {
    var alvo = el(id);
    if (!itens.length) { alvo.innerHTML = '<li class="vazio" style="display:block;background:none;padding:.4rem 0">Nenhuma frente por aqui</li>'; return; }
    alvo.innerHTML = itens.map(function (r, i) {
      return '<li><span class="pos">' + (i + 1) + '</span>' +
        '<span class="nome"><b>' + r.frente + '</b>' + nomeFrente(r.frente) + '</span>' +
        '<span class="qtd">' + Number(r[campo]) + ' <small>de ' + total + '</small></span></li>';
    }).join('');
  }

  function desenhar() {
    desenharContador();
    var linhas = linhasDoFiltro();
    var total = totalDoFiltro();
    desenharBarras(linhas);
    desenharRanking('sistema', top3(linhas, 'm2_sistema', 'media_impacto'), 'm2_sistema', total);
    desenharRanking('ponta', top3(linhas, 'm2_ponta_solta', 'media_impacto'), 'm2_ponta_solta', total);
    desenharRanking('descoberto', top3(linhas, 'm1_descoberto', 'media_expectativa'), 'm1_descoberto', total);
  }

  el('filtro').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-f]');
    if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(el('filtro').children, function (x) { x.classList.toggle('ativo', x === b); });
    desenhar();
  });

  desenhar();
  if (iniciarSupabase()) {
    buscar();
    setInterval(buscar, 5000);
  }
})();
