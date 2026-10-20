// Configuração do front-end. Preencha os dois campos do Supabase.
// A chave anônima (anon / publishable) pode ficar no front-end: a tabela só aceita insert
// e o painel só devolve agregados.
window.SAS_CONFIG = {
  SUPABASE_URL: 'https://ytdeypwzobhsxiobpfgz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGV5cHd6b2Joc3hpb2JwZmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTk0MTIsImV4cCI6MjEwODA5NTQxMn0.FUkJNPTpyDkXOVbb2vId-1Jlbl9BKk0_-prhHERY62E',
  // 'teste' nos ensaios, 'ocahuna' no dia do evento.
  // Também dá para forçar por link: /?mesa=3&evento=teste
  EVENTO: 'ocahuna',
  // Total de pessoas esperadas, usado no contador do painel. Também aceita /painel/?total=27
  TOTAL_ESPERADO: 27
};
