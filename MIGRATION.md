# Migração NexoField 2.0

Esta branch converte gradualmente o NexoField de HTML/JavaScript monolítico para Next.js + React + TypeScript, preservando Supabase e Vercel.

## Regra de segurança

- `main` continua sendo a versão estável 1.1.5.
- Nenhuma alteração desta branch deve substituir produção antes de validação funcional.
- O banco Supabase existente deve ser reutilizado; mudanças de schema devem ser compatíveis e versionadas.
- Somente URL e Publishable Key podem ser expostas no cliente. Nunca usar `service_role` no frontend.

## Funcionalidades que precisam ser preservadas

- Perfis Administrador, Técnico e Logística.
- Autenticação, permissões e visibilidade por perfil/região.
- Chamados, manutenção, serviços, prazos e reincidência por circuito.
- Identificação do técnico anterior e ação realizada.
- Dashboard, pendências, relatórios e exportações.
- Cadastro e pesquisa de técnicos por nome/protocolo.
- Execução do serviço e encerramento obrigatório.
- Causa raiz: Infracliente, Elétrica cliente, Elétrica concessionária, Mau uso e Vistoria.
- Atividade Vistoria no valor de R$ 150,00 e relatório anexo.
- Fotos: Tirar foto separado de Anexar da galeria, mantendo fotos anteriores.
- Rascunho recuperável após recarga no Chrome/Android.
- Estoque, solicitação, separação, aceite, entrega, trânsito para interior e rastreamento.
- Cadastro de endereço/CEP dos técnicos do interior.
- Exclusão lógica com histórico preservado.
- Pagamentos e bases exportáveis.
- Temas verde petróleo, azul e branco.

## Estratégia

1. Criar domínio TypeScript e cliente Supabase.
2. Migrar autenticação e sessão.
3. Migrar chamados e regras de reincidência.
4. Migrar execução do técnico, fotos, rascunho e vistorias.
5. Migrar logística e materiais.
6. Migrar dashboard, relatórios, pagamentos e exportações.
7. Migrar preferências visuais e responsividade.
8. Executar testes de regressão no desktop e Chrome/Android.
9. Validar preview Vercel.
10. Somente depois promover a nova versão para produção.

## Entregue nesta etapa

- Base Next.js + React + TypeScript.
- Tipos de domínio para usuários, chamados, encerramento, fotos, vistorias e materiais.
- Cliente Supabase baseado em variáveis públicas.
- Autenticação e recuperação de perfil usando as contas atuais.
- Consulta, criação, edição, pesquisa, arquivamento e restauração de chamados.
- Reincidência por circuito com técnico e ação anteriores.
- Persistência de rascunho e fotos via IndexedDB.
- Componente React com câmera e galeria separadas.
- Encerramento obrigatório, atividade Vistoria e relatório em PDF.
- Dashboard, aprovações, pagamentos, desempenho e exportações administrativas.
- Trâmite de materiais, histórico, exportação, rastreamento e endereços dos técnicos.
- Temas verde petróleo, azul e branco com persistência por conta.
- Interface responsiva do NexoField 2.0 para os três perfis.

## Situação atual

- Versão de trabalho: `2.0.0-migration.4`.
- Campo Motivo do chamado incluído no cadastro administrativo, com captura automática da descrição colada e persistência em coluna própria do banco.
- A compilação de produção e a verificação TypeScript estão aprovadas.
- Os testes automatizados da versão estável 1.1.5 continuam aprovados para comparação de regressão.
- Ainda falta validar os fluxos completos com contas reais dos três perfis, inclusive no Chrome/Android, antes da promoção para produção.

## Critério para troca da produção

A branch só pode substituir `main` quando todas as funções acima estiverem marcadas como migradas e os fluxos principais passarem em teste de regressão sem perda de dados.
