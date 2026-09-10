export interface FotoRascunho {
  id: string;
  arquivo: Blob;
  nome: string;
  tipo: string;
  criadoEm: string;
}

export interface RascunhoServico {
  chamadoId: string;
  campos: Record<string, string>;
  fotos: FotoRascunho[];
  atualizadoEm: string;
}

const DB_NAME = 'nexofield';
const DB_VERSION = 1;
const STORE = 'rascunhos-servico';

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'chamadoId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function salvarRascunho(rascunho: RascunhoServico): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...rascunho, atualizadoEm: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function carregarRascunho(chamadoId: string): Promise<RascunhoServico | null> {
  const db = await abrirBanco();
  const valor = await new Promise<RascunhoServico | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(chamadoId);
    req.onsuccess = () => resolve((req.result as RascunhoServico | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return valor;
}

export async function limparRascunho(chamadoId: string): Promise<void> {
  const db = await abrirBanco();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(chamadoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function criarFotoRascunho(file: File): FotoRascunho {
  return {
    id: crypto.randomUUID(),
    arquivo: file,
    nome: file.name || `foto-${Date.now()}.jpg`,
    tipo: file.type || 'image/jpeg',
    criadoEm: new Date().toISOString(),
  };
}
