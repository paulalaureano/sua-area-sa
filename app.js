(function () {
  'use strict';

  var S = window.SAS;
  var CFG = window.SAS_CONFIG || {};
  var KEY = 'sas_estado_v1';
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var sb = null;
  var estado = null;
  var sortable = null;
  var enviando = false;
  var travaArmada = false;

  /* ---------- utilidades ---------- */

  function aleatorio(n) {
    if (window.crypto && crypto.getRandomValues) {
      var a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function embaralhar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = aleatorio(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function frente(sigla) {
    for (var i = 0; i < S.FRENTES.length; i++) if (S.FRENTES[i].sigla === sigla) return S.FRENTES[i];
    return null;
  }

  function mesaValida(n) { return n >= 1 && n <= 6; }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('visivel');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('visivel'); }, 3200);
  }

  /* ---------- estado e localStorage ---------- */

  function novoEstado(mesa, evento) {
    return {
      v: 1, mesa: mesa || null, evento: evento, nivel: null, etapa: 'boas',
      ordens: { A: null, B: null, C: null },
      notas: { A: null, B: null, C: null },
      resposta: null, enviado: false
    };
  }

  function carregar() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1 && s.ordens && s.notas) return s;
    } catch (e) { /* ignora */ }
    return null;
  }

  function salvar() {
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (e) { /* ignora */ }
  }

  /* ---------- envio ao Supabase ---------- */

  function iniciarSupabase() {
    var url = CFG.SUPABASE_URL || '';
    var chave = CFG.SUPABASE_ANON_KEY || '';
    if (!url || !chave || url.indexOf('COLE_') === 0 || chave.indexOf('COLE_') === 0) {
      console.warn('config.js sem URL e chave do Supabase: as respostas ficam só neste aparelho.');
      return;
    }
    if (!window.supabase || !window.supabase.createClient) return;
    sb = window.supabase.createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  function atualizarStatusEnvio() {
    var el = document.getElementById('status-envio');
    if (!el) return;
    if (estado.enviado) el.textContent = 'Resposta enviada.';
    else el.textContent = 'Resposta guardada neste aparelho. Reenviando quando houver conexão.';
  }

  function enviar() {
    if (!estado || !estado.resposta || estado.enviado) return Promise.resolve(true);
    if (!sb || enviando) return Promise.resolve(false);
    enviando = true;
    var feito = function (ok) { enviando = false; return ok; };
    return Promise.resolve(sb.from('respostas').insert(estado.resposta)).then(function (r) {
      if (!r.error || r.error.code === '23505') { // 23505: já gravada numa tentativa anterior
        estado.enviado = true;
        salvar();
        atualizarStatusEnvio();
        return feito(true);
      }
      console.warn('Falha ao enviar:', r.error);
      return feito(false);
    }, function (e) {
      console.warn('Falha ao enviar:', e);
      return feito(false);
    });
  }

  function comTempo(promessa, ms) {
    return Promise.race([promessa, new Promise(function (res) { setTimeout(function () { res(false); }, ms); })]);
  }

  /* ---------- trava do botão voltar ---------- */

  function armarTrava() {
    if (travaArmada) return;
    travaArmada = true;
    history.pushState({ sas: 1 }, '');
    window.addEventListener('popstate', function () {
      history.pushState({ sas: 1 }, '');
      toast('As telas já confirmadas não podem ser reabertas');
    });
  }

  /* ---------- tela 0 ---------- */

  function renderBoas() {
    var mesa = estado.mesa;
    var mostrarSeletor = !mesa;
    var botoesMesa = '';
    for (var m = 1; m <= 6; m++) {
      botoesMesa += '<button type="button" class="btn' + (mesa === m ? ' ativo' : '') + '" data-mesa="' + m + '">Mesa ' + m + '</button>';
    }
    var botoesNivel = '';
    Object.keys(S.NIVEIS).forEach(function (k) {
      botoesNivel += '<button type="button" class="btn' + (estado.nivel === k ? ' ativo' : '') + '" data-nivel="' + k + '">' + S.NIVEIS[k] + '</button>';
    });

    app.innerHTML =
      '<section class="tela boas">' +
        '<div class="marca">Alcitá Advisory · Performance Sustentável</div>' +
        '<h1>Sua Área S.A.</h1>' +
        '<p class="texto">A sua área é uma companhia, e você é o(a) CEO. Em três telas, você vai ordenar as 10 frentes dela. Leva uns 5 minutos. Nada aqui identifica você.</p>' +
        '<div class="mesa-linha">' +
          '<span class="mesa-num" id="mesa-num">' + (mesa ? 'Mesa nº ' + mesa : 'Escolha a sua mesa') + '</span>' +
          (mesa ? '<button type="button" class="link" id="trocar-mesa">não é a minha mesa</button>' : '') +
        '</div>' +
        '<div class="seletor-mesa" id="seletor-mesa"' + (mostrarSeletor ? '' : ' hidden') + '>' + botoesMesa + '</div>' +
        '<div class="rotulo-campo">Seu nível hoje</div>' +
        '<div class="niveis" id="niveis">' + botoesNivel + '</div>' +
        '<button type="button" class="btn primario" id="comecar">Começar</button>' +
      '</section>';

    var seletor = document.getElementById('seletor-mesa');
    var comecar = document.getElementById('comecar');

    function atualizarBotao() {
      comecar.disabled = !(estado.mesa && estado.nivel);
    }

    var trocar = document.getElementById('trocar-mesa');
    if (trocar) trocar.addEventListener('click', function () { seletor.hidden = false; });

    seletor.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-mesa]');
      if (!b) return;
      estado.mesa = parseInt(b.getAttribute('data-mesa'), 10);
      salvar();
      renderBoas();
    });

    document.getElementById('niveis').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-nivel]');
      if (!b) return;
      estado.nivel = b.getAttribute('data-nivel');
      salvar();
      Array.prototype.forEach.call(document.querySelectorAll('[data-nivel]'), function (x) {
        x.classList.toggle('ativo', x === b);
      });
      atualizarBotao();
    });

    comecar.addEventListener('click', function () {
      if (!(estado.mesa && estado.nivel)) return;
      estado.etapa = 'A';
      salvar();
      armarTrava();
      render();
    });

    atualizarBotao();
  }

  /* ---------- telas 1 a 3: rankings ---------- */

  function garantirOrdem(letra) {
    if (!estado.ordens[letra]) {
      estado.ordens[letra] = embaralhar(S.FRENTES.map(function (f) { return f.sigla; }));
      salvar();
    }
  }

  var ICONE_ALCA = '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="6" cy="4" r="1.6"/><circle cx="12" cy="4" r="1.6"/><circle cx="6" cy="9" r="1.6"/><circle cx="12" cy="9" r="1.6"/><circle cx="6" cy="14" r="1.6"/><circle cx="12" cy="14" r="1.6"/></svg>';

  function renderRanking(letra) {
    garantirOrdem(letra);
    var t = S.TELAS[letra];
    var n = { A: 1, B: 2, C: 3 }[letra];
    app.innerHTML =
      '<section class="tela rank">' +
        '<div class="progresso">Tela ' + n + ' de 3 · ' + t.nome + '</div>' +
        '<div class="letra-pergunta"><span class="letra">' + letra + '</span><h1>' + t.pergunta + '</h1></div>' +
        '<p class="instrucao">' + t.instrucao + '</p>' +
        '<div class="rotulo-lista">1º lugar · mais</div>' +
        '<ol class="lista" id="lista"></ol>' +
        '<div class="rotulo-lista">10º lugar · menos</div>' +
        '<button type="button" class="btn primario" id="confirmar">Confirmar ordem</button>' +
      '</section>';
    desenharLista(letra);
    document.getElementById('confirmar').addEventListener('click', function () { abrirConfirmacao(letra); });
  }

  function desenharLista(letra) {
    var lista = document.getElementById('lista');
    var ordem = estado.ordens[letra];
    var html = '';
    for (var i = 0; i < ordem.length; i++) {
      var f = frente(ordem[i]);
      html +=
        '<li class="cartao" data-sigla="' + f.sigla + '">' +
          '<div class="selo-nota">' + (i + 1) + 'º</div>' +
          '<div class="corpo">' +
            '<div class="titulo"><span class="sigla">' + f.rotulo + '</span>' + f.nome + '</div>' +
            '<div class="desc">' + f.desc + '</div>' +
          '</div>' +
          '<div class="alca" title="Arrastar">' + ICONE_ALCA + '</div>' +
          '<div class="controles">' +
            '<button type="button" class="mover sobe" aria-label="Subir ' + f.nome + '"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button>' +
            '<button type="button" class="mover desce" aria-label="Descer ' + f.nome + '"' + (i === ordem.length - 1 ? ' disabled' : '') + '>&#9660;</button>' +
          '</div>' +
        '</li>';
    }
    lista.innerHTML = html;

    lista.onclick = function (ev) {
      var b = ev.target.closest('.mover');
      if (!b || b.disabled) return;
      var li = b.closest('.cartao');
      mover(letra, li.getAttribute('data-sigla'), b.classList.contains('sobe') ? -1 : 1);
    };

    if (sortable) { sortable.destroy(); sortable = null; }
    if (window.Sortable) {
      sortable = window.Sortable.create(lista, {
        handle: '.alca',
        animation: 150,
        ghostClass: 'fantasma',
        chosenClass: 'escolhido',
        forceFallback: false,
        onEnd: function () {
          var nova = Array.prototype.map.call(lista.children, function (li) { return li.getAttribute('data-sigla'); });
          estado.ordens[letra] = nova;
          salvar();
          atualizarCartoes(lista, nova);
        }
      });
    }
  }

  // Atualiza selos e botões desativados sem redesenhar (usado depois de arrastar)
  function atualizarCartoes(lista, ordem) {
    var itens = lista.children;
    for (var i = 0; i < itens.length; i++) {
      itens[i].querySelector('.selo-nota').textContent = (i + 1) + 'º';
      itens[i].querySelector('.sobe').disabled = (i === 0);
      itens[i].querySelector('.desce').disabled = (i === itens.length - 1);
    }
  }

  function mover(letra, sigla, delta) {
    var ordem = estado.ordens[letra];
    var i = ordem.indexOf(sigla);
    var j = i + delta;
    if (i < 0 || j < 0 || j >= ordem.length) return;
    ordem.splice(i, 1);
    ordem.splice(j, 0, sigla);
    salvar();
    desenharLista(letra);
    var li = document.querySelector('.cartao[data-sigla="' + sigla + '"]');
    if (li) {
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      var alvo = li.querySelector(delta < 0 ? '.sobe' : '.desce');
      if (alvo && alvo.disabled) alvo = li.querySelector(delta < 0 ? '.desce' : '.sobe');
      if (alvo && !alvo.disabled) { try { alvo.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }
    }
  }

  function abrirConfirmacao(letra) {
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<p>Depois de confirmar, não dá para voltar a esta tela.</p>' +
        '<div class="acoes">' +
          '<button type="button" class="btn secundario" id="m-revisar">Revisar</button>' +
          '<button type="button" class="btn primario" id="m-confirmar">Confirmar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('m-revisar').addEventListener('click', function () { ov.remove(); });
    document.getElementById('m-confirmar').addEventListener('click', function () {
      this.disabled = true;
      confirmarTela(letra, ov);
    });
  }

  function confirmarTela(letra, ov) {
    estado.notas[letra] = S.notasDaOrdem(estado.ordens[letra]);
    if (letra === 'A') { estado.etapa = 'B'; salvar(); ov.remove(); render(); return; }
    if (letra === 'B') { estado.etapa = 'C'; salvar(); ov.remove(); render(); return; }

    // Tela C: monta a resposta, tenta enviar (até 3 s) e mostra as matrizes
    estado.resposta = {
      id: uuid(),
      evento: estado.evento,
      mesa: estado.mesa,
      nivel: estado.nivel,
      energia: estado.notas.A,
      expectativa: estado.notas.B,
      impacto: estado.notas.C
    };
    estado.enviado = false;
    estado.etapa = 'matrizes';
    salvar();
    comTempo(enviar(), 3000).then(function () {
      ov.remove();
      render();
    });
  }

  /* ---------- tela 4: matrizes ---------- */

  var estadoQuadrante = { 0: null, 1: null };

  function matrizSVG(m, A, X) {
    var cell = 28, gx = 44, gy = 28, W = cell * 10;
    var C = S.CORES;
    var s = '<svg class="matriz" viewBox="0 0 352 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + m.titulo + '">';

    [1, 2, 3, 4].forEach(function (q) {
      var p = S.POS_Q[q];
      s += '<rect class="qr qr' + q + '" data-q="' + q + '" x="' + (gx + p[0] * cell) + '" y="' + (gy + p[1] * cell) + '" width="' + (5 * cell) + '" height="' + (5 * cell) + '" fill="' + C.q[q].fundo + '"/>';
    });

    for (var i = 1; i < 10; i++) {
      s += '<line class="nt" x1="' + (gx + i * cell) + '" y1="' + gy + '" x2="' + (gx + i * cell) + '" y2="' + (gy + W) + '" stroke="#fff" stroke-width="1" opacity=".85"/>';
      s += '<line class="nt" x1="' + gx + '" y1="' + (gy + i * cell) + '" x2="' + (gx + W) + '" y2="' + (gy + i * cell) + '" stroke="#fff" stroke-width="1" opacity=".85"/>';
    }
    s += '<rect class="nt" x="' + gx + '" y="' + gy + '" width="' + W + '" height="' + W + '" fill="none" stroke="#B9C0C7" stroke-width="1"/>';
    s += '<line class="nt" x1="' + (gx + 5 * cell) + '" y1="' + gy + '" x2="' + (gx + 5 * cell) + '" y2="' + (gy + W) + '" stroke="' + C.navy + '" stroke-width="1.6" stroke-dasharray="6 4"/>';
    s += '<line class="nt" x1="' + gx + '" y1="' + (gy + 5 * cell) + '" x2="' + (gx + W) + '" y2="' + (gy + 5 * cell) + '" stroke="' + C.navy + '" stroke-width="1.6" stroke-dasharray="6 4"/>';

    // 1º lugar no topo (eixo vertical) e à esquerda (eixo horizontal)
    for (var v = 1; v <= 10; v++) {
      s += '<text class="nt" x="' + (gx + (v - 0.5) * cell) + '" y="' + (gy + W + 18) + '" text-anchor="middle" font-size="10" fill="' + C.cinza + '">' + S.ordinal(v) + '</text>';
      s += '<text class="nt" x="' + (gx - 9) + '" y="' + (gy + (v - 0.5) * cell + 3.5) + '" text-anchor="middle" font-size="10" fill="' + C.cinza + '">' + S.ordinal(v) + '</text>';
    }

    s += '<text class="nt" x="' + (gx + W / 2) + '" y="' + (gy + W + 44) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + C.navy + '">' + m.eixoX + '</text>';
    s += '<text class="nt" transform="translate(12 ' + (gy + W / 2) + ') rotate(-90)" text-anchor="middle" font-size="12" font-weight="700" fill="' + C.navy + '">A · Energia</text>';

    var selos = { 1: [gx - 12, gy - 12], 2: [gx + W + 12, gy - 12], 3: [gx - 12, gy + W + 12], 4: [gx + W + 12, gy + W + 12] };
    [1, 2, 3, 4].forEach(function (q) {
      s += '<g data-q="' + q + '" class="selo-svg"><circle cx="' + selos[q][0] + '" cy="' + selos[q][1] + '" r="10" fill="' + C.q[q].selo + '"/>' +
        '<text x="' + selos[q][0] + '" y="' + (selos[q][1] + 4.5) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">' + q + '</text></g>';
    });

    S.FRENTES.forEach(function (f) {
      var pX = S.posicao(X[f.sigla]), pA = S.posicao(A[f.sigla]);
      var cx = gx + (pX - 0.5) * cell;
      var cy = gy + (pA - 0.5) * cell;
      var larg = f.curto.length * 5.9;
      var inverte = (cx + 9 + larg) > (gx + W + 6);
      s += '<circle class="nt" cx="' + cx + '" cy="' + cy + '" r="6" fill="' + C.coral + '" stroke="#fff" stroke-width="1.5"/>';
      s += '<text class="nt sigla-ponto" x="' + (inverte ? cx - 9 : cx + 9) + '" y="' + (cy + 3.6) + '" text-anchor="' + (inverte ? 'end' : 'start') + '" font-size="10" font-weight="700" fill="' + C.navy + '">' + f.curto + '</text>';
    });

    return s + '</svg>';
  }

  function porQuadrante(A, X) {
    var r = { 1: [], 2: [], 3: [], 4: [] };
    S.FRENTES.forEach(function (f) { r[S.quadrante(A[f.sigla], X[f.sigla])].push(f); });
    return r;
  }

  function blocoMatriz(m, idx, A, X) {
    var porQ = porQuadrante(A, X);
    var chips = '';
    [1, 2, 3, 4].forEach(function (q) {
      chips +=
        '<button type="button" class="chip q' + q + '" data-q="' + q + '" aria-pressed="false">' +
          '<span class="selo-q">' + q + '</span>' +
          '<span class="chip-nome">' + m.quadrantes[q].nome + '</span>' +
          '<span class="chip-n">' + porQ[q].length + '</span>' +
        '</button>';
    });
    return '<div class="bloco-matriz" data-m="' + idx + '">' +
      '<h2>' + m.titulo + '</h2>' +
      '<p class="legenda-eixos">O 1º lugar fica no topo e à esquerda. Toque em um quadrante para ver o diagnóstico.</p>' +
      matrizSVG(m, A, X) +
      '<div class="faixa-q" role="group" aria-label="Quadrantes">' + chips + '</div>' +
      '<div class="diagnostico" aria-live="polite"></div>' +
    '</div>';
  }

  function textoDiagnostico(idx, q) {
    var m = S.MATRIZES[idx];
    var A = estado.notas.A, X = estado.notas[m.tela];
    var d = m.quadrantes[q];
    var lista = porQuadrante(A, X)[q].slice().sort(function (a, b) { return A[b.sigla] - A[a.sigla]; });
    var itens = lista.map(function (f) {
      return '<li><strong>' + f.nome + '</strong><span>energia ' + S.ordinal(S.posicao(A[f.sigla])) +
        ' · ' + m.dimX + ' ' + S.ordinal(S.posicao(X[f.sigla])) + '</span></li>';
    }).join('');
    return '<div class="diag q' + q + '">' +
      '<div class="diag-topo"><span class="selo-q grande">' + q + '</span>' +
      '<div><h3>' + d.nome + '</h3><span class="pos">' + d.pos + '</span></div></div>' +
      '<p class="diag-texto">' + d.texto + '</p>' +
      (itens ? '<ul class="diag-lista">' + itens + '</ul>' : '<p class="diag-vazio">Nenhuma frente caiu neste quadrante.</p>') +
    '</div>';
  }

  function selecionarQuadrante(bloco, q) {
    var idx = parseInt(bloco.getAttribute('data-m'), 10);
    var atual = estadoQuadrante[idx];
    var novo = (atual === q) ? null : q;
    estadoQuadrante[idx] = novo;

    var svg = bloco.querySelector('svg.matriz');
    svg.setAttribute('class', 'matriz' + (novo ? ' tem-sel sel' + novo : ''));
    Array.prototype.forEach.call(bloco.querySelectorAll('.chip'), function (c) {
      var on = novo !== null && parseInt(c.getAttribute('data-q'), 10) === novo;
      c.classList.toggle('ativo', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var alvo = bloco.querySelector('.diagnostico');
    alvo.innerHTML = novo ? textoDiagnostico(idx, novo) : '';
    if (novo) {
      try { alvo.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignora */ }
    }
  }

  function renderMatrizes() {
    var A = estado.notas.A, B = estado.notas.B, C = estado.notas.C;
    estadoQuadrante = { 0: null, 1: null };
    app.innerHTML =
      '<section class="tela matrizes">' +
        '<h1>As suas matrizes</h1>' +
        blocoMatriz(S.MATRIZES[0], 0, A, B) +
        blocoMatriz(S.MATRIZES[1], 1, A, C) +
        '<button type="button" class="btn primario" id="baixar-pdf">Baixar PDF</button>' +
        '<div class="aviso-final">Pronto. Responda a folha de reflexão. Você pode guardar o celular quando terminar.</div>' +
        '<p class="status-envio" id="status-envio"></p>' +
      '</section>';

    Array.prototype.forEach.call(app.querySelectorAll('.bloco-matriz'), function (bloco) {
      bloco.addEventListener('click', function (ev) {
        var alvo = ev.target.closest('[data-q]');
        if (!alvo || !bloco.contains(alvo)) return;
        selecionarQuadrante(bloco, parseInt(alvo.getAttribute('data-q'), 10));
      });
    });

    document.getElementById('baixar-pdf').addEventListener('click', function () {
      try { gerarPDF(); } catch (e) {
        console.error(e);
        toast('Não foi possível gerar o PDF. Tente de novo.');
      }
    });
    atualizarStatusEnvio();
  }

  /* ---------- PDF (jsPDF, vetorial) ---------- */

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function pdfMatriz(doc, m, A, X, ox, oy) {
    var C = S.CORES;
    var cell = 7.3, gx = ox + 9, gy = oy + 6, W = cell * 10;
    var c;

    [1, 2, 3, 4].forEach(function (q) {
      var p = S.POS_Q[q];
      c = rgb(C.q[q].fundo);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(gx + p[0] * cell, gy + p[1] * cell, 5 * cell, 5 * cell, 'F');
    });

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.15);
    for (var i = 1; i < 10; i++) {
      doc.line(gx + i * cell, gy, gx + i * cell, gy + W);
      doc.line(gx, gy + i * cell, gx + W, gy + i * cell);
    }
    doc.setDrawColor(185, 192, 199);
    doc.setLineWidth(0.2);
    doc.rect(gx, gy, W, W, 'S');

    c = rgb(C.navy);
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 1], 0);
    doc.line(gx + 5 * cell, gy, gx + 5 * cell, gy + W);
    doc.line(gx, gy + 5 * cell, gx + W, gy + 5 * cell);
    doc.setLineDashPattern([], 0);

    c = rgb(C.cinza);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    for (var v = 1; v <= 10; v++) {
      doc.text(S.ordinal(v), gx + (v - 0.5) * cell, gy + W + 3.6, { align: 'center' });
      doc.text(S.ordinal(v), gx - 1.2, gy + (v - 0.5) * cell + 0.8, { align: 'right' });
    }

    c = rgb(C.navy);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(m.eixoX, gx + W / 2, gy + W + 8.2, { align: 'center' });
    var rot = 'A · Energia';
    doc.text(rot, ox + 2.2, gy + W / 2 + doc.getTextWidth(rot) / 2, { angle: 90 });

    var selos = { 1: [gx - 3.4, gy - 3], 2: [gx + W + 3, gy - 3], 3: [gx - 3.4, gy + W + 3.4], 4: [gx + W + 3, gy + W + 3.4] };
    [1, 2, 3, 4].forEach(function (q) {
      c = rgb(C.q[q].selo);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.circle(selos[q][0], selos[q][1], 2.4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(String(q), selos[q][0], selos[q][1] + 0.9, { align: 'center' });
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    S.FRENTES.forEach(function (f) {
      var cx = gx + (S.posicao(X[f.sigla]) - 0.5) * cell;
      var cy = gy + (S.posicao(A[f.sigla]) - 0.5) * cell;
      c = rgb(C.coral);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.circle(cx, cy, 1.2, 'F');
      c = rgb(C.navy);
      doc.setTextColor(c[0], c[1], c[2]);
      var w = doc.getTextWidth(f.curto);
      if (cx + 1.9 + w > gx + W + 0.5) doc.text(f.curto, cx - 1.9, cy + 0.8, { align: 'right' });
      else doc.text(f.curto, cx + 1.9, cy + 0.8);
    });
  }

  // Desenha o gabarito e devolve a posição vertical em que terminou
  function pdfGabarito(doc, m, A, X, ox, oy) {
    var porQ = porQuadrante(A, X);
    var y = oy;
    [1, 2, 3, 4].forEach(function (q) {
      var d = m.quadrantes[q];
      var c = rgb(S.CORES.q[q].selo);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(ox, y - 2.4, 1.2, 2.9, 'F');

      doc.setTextColor(c[0], c[1], c[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(q + ' · ' + d.nome, ox + 2.6, y);
      y += 3.3;

      var n = rgb(S.CORES.navy);
      doc.setTextColor(n[0], n[1], n[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      var linhas = doc.splitTextToSize(d.texto, 82);
      doc.text(linhas, ox + 2.6, y);
      y += linhas.length * 3.0;

      doc.setFont('helvetica', 'bold');
      doc.text('Neste quadrante:', ox + 2.6, y);
      y += 3.0;
      doc.setFont('helvetica', 'normal');
      var nomes = porQ[q].map(function (f) { return f.nome; }).join(', ');
      var l2 = doc.splitTextToSize(nomes || 'nenhuma', 82);
      doc.text(l2, ox + 2.6, y);
      y += l2.length * 3.0 + 2.2;
    });
    return y;
  }

  function gerarPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF indisponível');
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var C = S.CORES;
    var A = estado.notas.A, B = estado.notas.B, Cn = estado.notas.C;
    var c;

    c = rgb(C.navy);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Sua Área S.A. · Workshop Alcitá Advisory', 15, 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    c = rgb(C.cinza);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(new Date().toLocaleDateString('pt-BR'), 195, 19, { align: 'right' });

    c = rgb(C.teal);
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(0.8);
    doc.line(15, 23, 195, 23);

    c = rgb(C.navy);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Nível: ' + S.NIVEIS[estado.nivel] + ' · Mesa ' + estado.mesa, 15, 30);

    pdfMatriz(doc, S.MATRIZES[0], A, B, 15, 35);
    pdfMatriz(doc, S.MATRIZES[1], A, Cn, 109, 35);
    var y1 = pdfGabarito(doc, S.MATRIZES[0], A, B, 15, 131);
    var y2 = pdfGabarito(doc, S.MATRIZES[1], A, Cn, 109, 131);

    // Tabela de posições
    var ty = Math.max(200, y1, y2) + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    c = rgb(C.navy);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text('Posição por frente (1º = mais, 10º = menos)', 15, ty);
    ty += 3;

    var colLabel = 30, colW = 15;
    var rowH = 7.5;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(15, ty, colLabel + colW * 10, rowH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    S.FRENTES.forEach(function (f, i) {
      doc.text(f.curto, 15 + colLabel + i * colW + colW / 2, ty + 4.8, { align: 'center' });
    });

    doc.setFontSize(8);
    var linhas = [['A · Energia', A], ['B · Expectativa', B], ['C · Impacto', Cn]];
    linhas.forEach(function (l, r) {
      var y = ty + rowH * (r + 1);
      if (r % 2 === 0) { doc.setFillColor(238, 241, 243); doc.rect(15, y, colLabel + colW * 10, rowH, 'F'); }
      c = rgb(C.navy);
      doc.setTextColor(c[0], c[1], c[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(l[0], 17, y + 5);
      doc.setFont('helvetica', 'normal');
      S.FRENTES.forEach(function (f, i) {
        doc.text(S.ordinal(S.posicao(l[1][f.sigla])), 15 + colLabel + i * colW + colW / 2, y + 5, { align: 'center' });
      });
    });
    doc.setDrawColor(185, 192, 199);
    doc.setLineWidth(0.2);
    doc.rect(15, ty, colLabel + colW * 10, rowH * 4, 'S');

    // Rodapé
    doc.setDrawColor(217, 220, 223);
    doc.line(15, 282, 195, 282);
    c = rgb(C.cinza);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Alcitá Advisory · Performance Sustentável', 105, 287, { align: 'center' });

    doc.save('sua-area-sa-matrizes.pdf');
  }

  /* ---------- roteamento ---------- */

  function render() {
    window.scrollTo(0, 0);
    if (estado.etapa === 'boas') renderBoas();
    else if (estado.etapa === 'A' || estado.etapa === 'B' || estado.etapa === 'C') renderRanking(estado.etapa);
    else renderMatrizes();
  }

  function iniciar() {
    var mesaParam = parseInt(params.get('mesa'), 10);
    var mesaUrl = mesaValida(mesaParam) ? mesaParam : null;
    var eventoUrl = params.get('evento');

    if (params.get('reset') === '1') {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignora */ }
      history.replaceState(null, '', location.pathname + (mesaUrl ? '?mesa=' + mesaUrl : ''));
    }

    estado = carregar();
    if (!estado) {
      estado = novoEstado(mesaUrl, eventoUrl || CFG.EVENTO || 'ocahuna');
    } else if (estado.etapa === 'boas') {
      if (mesaUrl) estado.mesa = mesaUrl;
      if (eventoUrl) estado.evento = eventoUrl;
    }
    salvar();

    iniciarSupabase();
    if (estado.etapa !== 'boas') armarTrava();
    render();

    setInterval(function () { if (estado.resposta && !estado.enviado) enviar(); }, 15000);
    window.addEventListener('online', function () { if (estado.resposta && !estado.enviado) enviar(); });
    if (estado.resposta && !estado.enviado) enviar();
  }

  iniciar();
})();
