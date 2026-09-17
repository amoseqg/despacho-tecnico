export type PerfilUsuario = 'administrador' | 'tecnico' | 'logistica';
export type Regiao = 'capital' | 'interior' | 'fernando_de_noronha';
export type StatusChamado = 'aberto' | 'despachado' | 'em_atendimento' | 'pendente' | 'concluido' | 'cancelado';
export type TipoAtividade = 'instalacao' | 'alteracao' | 'mudanca' | 'manutencao' | 'suporte' | 'vistoria';
export type CausaRaiz = 'Infracliente' | 'Elétrica cliente' | 'Elétrica concessionária' | 'Mau uso' | 'Vistoria';
export type StatusMaterial = 'solicitado' | 'separacao' | 'separado' | 'em_transito' | 'entregue';

export interface UsuarioNexoField {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  regiao?: Regiao;
  ativo: boolean;
}

export interface Chamado {
  id: string;
  protocoloMetodo: string;
  sdm?: string;
  osPeconecta?: string;
  circuito?: string;
  siteCliente: string;
  endereco?: string;
  cidade?: string;
  contato?: string;
  atividade: TipoAtividade;
  tecnicoId?: string;
  regiao: Regiao;
  status: StatusChamado;
  reincidente: boolean;
  tecnicoAnterior?: string;
  acaoAnterior?: string;
  prazoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm?: string | null;
}

export interface EncerramentoChamado {
  chamadoId: string;
  causaRaiz: CausaRaiz;
  solucaoTecnica: string;
  validacaoVectraUmtelecom: string;
  senha: string;
  relatorio?: string;
  concluidoEm: string;
}

export interface FotoServico {
  id: string;
  chamadoId: string;
  caminho: string;
  nomeArquivo: string;
  criadoEm: string;
}

export interface RelatorioVistoria {
  id: string;
  chamadoId: string;
  tecnicoId: string;
  observacao?: string;
  caminhoArquivo: string;
  nomeArquivo: string;
  criadoEm: string;
}

export interface MovimentacaoMaterial {
  id: string;
  chamadoId?: string;
  tecnicoId: string;
  materialId: string;
  quantidade: number;
  status: StatusMaterial;
  codigoRastreio?: string;
  previsaoEntrega?: string;
  criadoEm: string;
  atualizadoEm: string;
}
