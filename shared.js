// Conteúdo fixo e regras puras, compartilhados pelo app e pelo painel.
//
// Convenção dos dados: o banco guarda a NOTA (1º lugar = 10, ... 10º lugar = 1).
// As telas mostram a POSIÇÃO (1º a 10º), que é 11 menos a nota. Nada no banco muda.
(function (g) {
  'use strict';

  // sigla = chave interna gravada no banco (não mudar).
  // rotulo = código mostrado nas telas. curto = nome usado nos pontos da matriz.
  var FRENTES = [
    { sigla: 'FIN', rotulo: 'FIN', curto: 'Finanças', nome: 'Finanças', desc: 'Orçamento × realizado, custo da área e retorno do que ela investe' },
    { sigla: 'PES', rotulo: 'PES', curto: 'Pessoas', nome: 'Pessoas', desc: 'Formação, desenvolvimento, sucessão e cultura do time' },
    { sigla: 'OPE', rotulo: 'OPE', curto: 'Operações', nome: 'Operações', desc: 'Qualidade e prazo do que sai da área, melhoria contínua de processos e automação' },
    { sigla: 'CLI', rotulo: 'CLI', curto: 'Visão cliente', nome: 'Visão cliente', desc: 'Entender continuamente a necessidade de clientes internos e externos para acelerar a entrega de valor' },
    { sigla: 'PRO', rotulo: 'PRO', curto: 'Produtos', nome: 'Produtos', desc: 'O portfólio de entregas da área: o que oferece, para quem e como evolui' },
    { sigla: 'MKT', rotulo: 'MKT', curto: 'Marketing', nome: 'Marketing', desc: 'Comunicar o valor do que a área entrega, de acordo com a necessidade de cada cliente' },
    { sigla: 'EST', rotulo: 'EST', curto: 'Estratégia', nome: 'Estratégia e inovação', desc: 'Para onde a área vai em 12 a 24 meses e o que precisa começar a construir hoje' },
    { sigla: 'PAR', rotulo: 'FOR', curto: 'Fornecedores', nome: 'Gestão de fornecedores e parcerias', desc: 'Pares e áreas de quem você depende para entregar: acordos, prazos e qualidade' },
    { sigla: 'RP', rotulo: 'RP', curto: 'Rel. públicas', nome: 'Relações públicas', desc: 'Confiança de longo prazo e marca pessoal, dentro e fora da empresa' },
    { sigla: 'CON', rotulo: 'CON', curto: 'Conselho', nome: 'Conselho', desc: 'Relacionamento com os líderes diretos e indiretos: prioridades, alinhamento e prestação de contas' }
  ];

  var TELAS = {
    A: {
      chave: 'energia', nome: 'Energia',
      pergunta: 'Onde invisto mais energia hoje?',
      instrucao: 'Ordene do 1º ao 10º lugar. No topo, a que mais recebe a sua energia hoje; embaixo, a que menos recebe.'
    },
    B: {
      chave: 'expectativa', nome: 'Expectativa',
      pergunta: 'Onde esperam que eu invista maior energia?',
      instrucao: 'Ordene do 1º ao 10º lugar. No topo, onde esperam que você invista maior energia; embaixo, onde menos esperam.'
    },
    C: {
      chave: 'impacto', nome: 'Impacto',
      pergunta: 'O que mais travaria se eu ficasse 30 dias fora, sem celular?',
      instrucao: 'Ordene do 1º ao 10º lugar. No topo, a que mais travaria sem você; embaixo, a que menos travaria.'
    }
  };

  var NIVEIS = { coordenacao: 'Coordenação', gerencia: 'Gerência', executivo: 'Executivo' };

  var CORES = {
    navy: '#0D1B2A', teal: '#2A9D8F', tealTexto: '#1F7A6F', coral: '#F76C5E', offwhite: '#F7F7F3',
    cinza: '#6A7480',
    q: {
      1: { fundo: '#DCE3EA', selo: '#0D1B2A' },
      2: { fundo: '#E4F2F0', selo: '#1F7A6F' },
      3: { fundo: '#FDE7E4', selo: '#C4473C' },
      4: { fundo: '#EFEFEA', selo: '#6A7480' }
    }
  };

  // Posição de cada quadrante no desenho (coluna, linha), em casas de 5x5.
  // Com o 1º lugar no topo e à esquerda, "alta e alta" cai no canto superior esquerdo.
  var POS_Q = { 1: [0, 0], 2: [5, 0], 3: [0, 5], 4: [5, 5] };

  var MATRIZES = [
    {
      id: 1, titulo: 'Matriz 1 · Energia × Expectativa', eixoX: 'B · Expectativa', tela: 'B', letraX: 'B', dimX: 'expectativa',
      quadrantes: {
        1: { pos: 'A alta, B alta', nome: 'Foco certo', texto: 'Energia onde esperam. A pergunta é se o resultado está sendo visto.' },
        2: { pos: 'A alta, B baixa', nome: 'Aposta ou desvio?', texto: 'Energia que ninguém pediu: antecipação a comunicar, ou energia a realocar.' },
        3: { pos: 'A baixa, B alta', nome: 'Expectativa a descoberto', texto: 'Esperam muito e você investe pouco. É onde a performance cai primeiro.' },
        4: { pos: 'A baixa, B baixa', nome: 'Fora do radar', texto: 'Pouca energia e pouca expectativa. Certo, se for escolha.' }
      }
    },
    {
      id: 2, titulo: 'Matriz 2 · Energia × Impacto', eixoX: 'C · Impacto', tela: 'C', letraX: 'C', dimX: 'impacto',
      quadrantes: {
        1: { pos: 'A alta, C alta', nome: 'Você é o sistema', texto: 'Muita energia e muito impacto se você sair: funciona porque você está lá.' },
        2: { pos: 'A alta, C baixa', nome: 'Candidata a delegar', texto: 'Muita energia em algo que roda sem você.' },
        3: { pos: 'A baixa, C alta', nome: 'Ponta solta', texto: 'Pouca energia, mas sem você trava. Quase sempre algo informal.' },
        4: { pos: 'A baixa, C baixa', nome: 'Fora do foco', texto: 'Pouca energia e pouco impacto. Escolha consciente ou esquecimento?' }
      }
    }
  ];

  function frentePor(sigla) {
    for (var i = 0; i < FRENTES.length; i++) if (FRENTES[i].sigla === sigla) return FRENTES[i];
    return null;
  }

  // 1ª posição = nota 10, 2ª = 9, ... 10ª = 1
  function notasDaOrdem(ordem) {
    var o = {};
    for (var i = 0; i < ordem.length; i++) o[ordem[i]] = 10 - i;
    return o;
  }

  // nota <-> posição (a conta é a mesma nos dois sentidos)
  function posicao(nota) { return 11 - nota; }
  function ordinal(pos) { return Math.round(pos) + 'º'; }

  // Nota de 6 a 10 (posição 1º a 5º) é alta; nota de 1 a 5 (6º a 10º) é baixa.
  // 1 = alta/alta, 2 = A alta/X baixa, 3 = A baixa/X alta, 4 = baixa/baixa
  function quadrante(a, x) {
    var altoA = a >= 6, altoX = x >= 6;
    if (altoA && altoX) return 1;
    if (altoA && !altoX) return 2;
    if (!altoA && altoX) return 3;
    return 4;
  }

  g.SAS = {
    FRENTES: FRENTES, TELAS: TELAS, NIVEIS: NIVEIS, CORES: CORES, MATRIZES: MATRIZES, POS_Q: POS_Q,
    frentePor: frentePor, notasDaOrdem: notasDaOrdem, posicao: posicao, ordinal: ordinal, quadrante: quadrante
  };
})(typeof window !== 'undefined' ? window : globalThis);
