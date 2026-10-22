# Sua Área S.A.

Ferramenta da Rodada Performance Sustentável (Workshop Alcitá Advisory, Casa OcaHuna). Participante ordena as 10 frentes da sua área em três telas, vê as duas matrizes e baixa o PDF. A facilitadora projeta o painel com o retrato da sala. Especificação completa no documento "Sua Área S.A. · especificação do app da Rodada 2".

## Estrutura

| Arquivo | Para quê |
|---|---|
| `index.html`, `app.js`, `style.css` | App do participante (`/?mesa=3`) |
| `painel/index.html`, `painel/painel.js` | Painel do projetor (`/painel/`) |
| `shared.js` | Frentes, textos das telas, gabaritos, cores e regras de nota e quadrante |
| `config.js` | URL e chave do Supabase, evento e total esperado |
| `supabase/schema.sql` | Tabela, RLS e função `painel` (versão completa) |
| `supabase/atualizacao-painel.sql` | Só a função `painel` atualizada, para quem já rodou o `schema.sql` antes |
| `scripts/qrcodes.html` | Gera e imprime os 6 QR codes |
| `scripts/teste-carga.mjs` | 30 inserts simultâneos e verificação da RLS |

Tudo é HTML, CSS e JavaScript puro. Bibliotecas por CDN: supabase-js, SortableJS, jsPDF e as fontes do Google.

## Passo a passo

1. **Supabase.** No SQL Editor do projeto, cole e rode `supabase/schema.sql`.
2. **Config.** Em Project Settings > API, copie a URL e a chave anônima (anon ou publishable) para `config.js`.
3. **Publicar.** Suba a pasta para um repositório no GitHub e ative o GitHub Pages (ou importe na Vercel). Não precisa de build.
4. **QR codes.** Abra `scripts/qrcodes.html` no computador, informe o endereço publicado e imprima. Cada mesa recebe `https://<dominio>/?mesa=N`.
5. **Painel.** Abra `https://<dominio>/painel/` no computador do projetor, em tela cheia. `?total=27` muda o total esperado sem editar arquivo.

## Painel: três visões

Os botões no rodapé (ou as teclas 1, 2 e 3) alternam:

1. **Visão geral:** energia contra expectativa, onde a sala é o sistema, pontas soltas e expectativa a descoberto.
2. **Divergências:** média e divergência (desvio padrão) das notas de cada frente. Mostra onde a sala está dividida.
3. **Mesas:** mapa de calor das 6 mesas lado a lado, por frente. Alterna entre expectativa menos energia, energia, expectativa e impacto.

O seletor por nível vale para as visões 1 e 2. Se uma visão pedir a função atualizada, rode `supabase/atualizacao-painel.sql`.

## Ensaios e dia do evento

- `evento` separa teste de evento real. Nos ensaios use `/?mesa=3&evento=teste` e `/painel/?evento=teste`. No dia, o padrão de `config.js` (`ocahuna`) vale.
- `/?reset=1&mesa=3` apaga o progresso guardado no aparelho e recomeça. Útil para testar várias vezes no mesmo celular.
- Limpar os testes depois: `delete from respostas where evento = 'teste';`
- Teste de carga: `SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/teste-carga.mjs`. Ele também confirma que o anônimo não consegue ler a tabela.

## Comportamento que vale conhecer

- O progresso fica no `localStorage`. Recarregar retoma de onde parou, e a resposta enviada não duplica (o `id` é gerado no aparelho, então reenvios são idempotentes).
- Sem internet, a Tela 4 aparece normalmente e o envio é repetido a cada 15 segundos. Uma linha discreta no fim da tela informa se a resposta já foi enviada.
- Se o Wi-Fi da casa for incerto, baixe supabase-js, SortableJS e jsPDF para a pasta e troque os `<script src>` do CDN por arquivos locais. Assim o app não depende de CDN no dia.

## Checklist antes do evento

- [ ] Testar com 30 acessos simultâneos
- [ ] Testar em iPhone (Safari) e Android (Chrome): arrastar, botões ▲ ▼, tocar nos quadrantes e baixar o PDF
- [ ] Testar o Wi-Fi e o 4G na Casa OcaHuna, de preferência no horário do evento
- [ ] Imprimir os 6 QR codes na ficha da mesa
- [ ] Limpar os dados de teste
- [ ] Deixar `/painel/` aberto no computador do projetor
- [ ] Plano B: 6 kits de papel (cartões A, B, C e folha das matrizes)

## Desvios em relação à especificação

- **Posições em vez de notas na tela.** O participante ordena do 1º ao 10º lugar, e as matrizes, o PDF e o painel mostram posições. O banco continua guardando a nota (1º lugar = 10), então a tabela, a função `painel` e o `schema.sql` não mudam. A conversa é posição = 11 menos a nota.
- **Matrizes espelhadas na horizontal.** Com o 1º lugar no topo e à esquerda, o quadrante 1 ("alta e alta") fica no canto superior esquerdo. Números, nomes e textos dos quadrantes são os mesmos.
- **Diagnóstico ao tocar.** Tocar num quadrante (no desenho ou na faixa abaixo dele) abre o cartão com o texto do gabarito e as frentes com nome completo e posições. O PDF mostra os quatro diagnósticos.
- **Nomes no lugar dos códigos** nos pontos da matriz, nas listas do diagnóstico e na tabela do PDF (nomes curtos em `shared.js`, campo `curto`).
- **Código FOR.** A frente de fornecedores aparece como FOR nas telas e no painel. Internamente a chave gravada segue sendo PAR.
- A função `painel` também devolve `dp_*` (desvio padrão) e `por_mesa_frente`, usados nas visões Divergências e Mesas.
- `por_nivel_frente` na função `painel` também devolve `n` e os contadores de quadrante, para o seletor por nível funcionar nos blocos 3 e 4 (a especificação prevê essa extensão).
- Restrição `jsonb_typeof = 'object'` nas colunas de notas e índice em `evento`.
- Linha de status de envio no fim da Tela 4.
