export interface ModuloNexoField {
  id: string;
  nome: string;
  perfis: Array<'administrador' | 'tecnico' | 'logistica'>;
  status: 'mapeado' | 'em_migracao' | 'migrado';
}

export const modulosNexoField: ModuloNexoField[] = [
  { id: 'dashboard', nome: 'Dashboard e indicadores', perfis: ['administrador'], status: 'em_migracao' },
  { id: 'chamados', nome: 'Chamados, prazos e reincidência por circuito', perfis: ['administrador', 'tecnico'], status: 'em_migracao' },
  { id: 'execucao', nome: 'Execução do serviço, fotos e encerramento', perfis: ['tecnico'], status: 'em_migracao' },
  { id: 'vistorias', nome: 'Vistorias e relatórios anexos', perfis: ['administrador', 'tecnico'], status: 'em_migracao' },
  { id: 'tecnicos', nome: 'Cadastro, pesquisa e histórico de técnicos', perfis: ['administrador'], status: 'mapeado' },
  { id: 'logistica', nome: 'Estoque, separação, entrega e rastreamento', perfis: ['administrador', 'tecnico', 'logistica'], status: 'mapeado' },
  { id: 'pagamentos', nome: 'Pagamentos, parceiros e exportações', perfis: ['administrador'], status: 'mapeado' },
  { id: 'relatorios', nome: 'Relatórios operacionais e exportações', perfis: ['administrador'], status: 'mapeado' },
  { id: 'permissoes', nome: 'Autenticação, perfis e permissões', perfis: ['administrador', 'tecnico', 'logistica'], status: 'em_migracao' },
  { id: 'aparencia', nome: 'Tema verde petróleo, azul e branco', perfis: ['administrador', 'tecnico', 'logistica'], status: 'mapeado' },
];
