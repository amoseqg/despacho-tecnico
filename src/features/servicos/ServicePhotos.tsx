'use client';

import { useEffect, useState } from 'react';
import { PhotoInputs } from './PhotoInputs';
import { carregarRascunho, criarFotoRascunho, salvarRascunho, type FotoRascunho } from './draft-store';

export function ServicePhotos({ chamadoId }: { chamadoId: string }) {
  const [fotos, setFotos] = useState<FotoRascunho[]>([]);

  useEffect(() => {
    let ativo = true;
    carregarRascunho(chamadoId).then(rascunho => {
      if (ativo && rascunho?.fotos) setFotos(rascunho.fotos);
    }).catch(() => undefined);
    return () => { ativo = false; };
  }, [chamadoId]);

  async function adicionar(files: File[]) {
    const novas = files.map(criarFotoRascunho);
    const atualizadas = [...fotos, ...novas];
    setFotos(atualizadas);
    const existente = await carregarRascunho(chamadoId);
    await salvarRascunho({
      chamadoId,
      campos: existente?.campos ?? {},
      fotos: atualizadas,
      atualizadoEm: new Date().toISOString(),
    });
  }

  return (
    <div className="service-photos">
      <PhotoInputs onFiles={adicionar} />
      <small>{fotos.length} foto(s) preservada(s) neste rascunho.</small>
    </div>
  );
}
