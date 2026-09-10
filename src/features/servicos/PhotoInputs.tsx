'use client';

import { ChangeEvent, useRef } from 'react';

interface PhotoInputsProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function PhotoInputs({ onFiles, disabled }: PhotoInputsProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function receber(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onFiles(files);
    // Permite selecionar/tirar novamente o mesmo arquivo sem apagar os anteriores.
    event.target.value = '';
  }

  return (
    <div className="photo-actions">
      <button type="button" className="button primary" disabled={disabled} onClick={() => cameraRef.current?.click()}>
        Tirar foto
      </button>
      <button type="button" className="button secondary" disabled={disabled} onClick={() => galleryRef.current?.click()}>
        Anexar da galeria
      </button>

      <input
        ref={cameraRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={receber}
      />
      <input
        ref={galleryRef}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={receber}
      />
    </div>
  );
}
