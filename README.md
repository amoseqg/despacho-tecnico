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
