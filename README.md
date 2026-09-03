# Despacho Técnico

Aplicação web para gestão de chamados, técnicos, materiais e atividades de campo, integrada ao Supabase.

## Estrutura

- `index.html` — aplicação principal.
- `.gitignore` — arquivos que não devem ser versionados.

## Banco de dados

A aplicação utiliza Supabase para autenticação e persistência dos dados.

## Publicação

O projeto pode ser publicado como site estático no Vercel. O arquivo `index.html` deve permanecer na raiz do repositório.

## Segurança

A aplicação cliente deve conter apenas a Publishable Key do Supabase. Nunca adicione chaves Secret ou `service_role` ao repositório.

## Registro de versão

A versão de produto começa em **1.0.0**, consolidando as funcionalidades já existentes.
`release-info.js` é a fonte do número, da data e do histórico exibidos em Sobre / Versão.
A informação identifica a versão carregada, inclusive em uma aba ainda não atualizada.

A cada publicação:
1. Adicionar uma entrada no início de `releases`, preservando as anteriores.
2. Usar PATCH para correções (1.0.1), MINOR para funções compatíveis (1.1.0) ou MAJOR para mudanças incompatíveis (2.0.0).
3. Registrar a data real da publicação e um resumo em linguagem de usuário.
4. Atualizar o parâmetro `v` do script em `app.part3` para o mesmo número.
5. Executar `node scripts/validate-release.mjs` e os demais testes antes de publicar.

O número não é incrementado automaticamente; deve corresponder ao conteúdo da publicação.
O histórico do Git mantém o código de cada publicação. Este painel não restaura banco de dados.
