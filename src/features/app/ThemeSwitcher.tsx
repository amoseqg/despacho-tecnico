'use client';

import { useEffect, useState } from 'react';

type Tema = 'petroleo' | 'azul' | 'branco';

export function ThemeSwitcher() {
  const [tema,setTema]=useState<Tema>('petroleo');
  useEffect(()=>{ const salvo=(localStorage.getItem('nexofield-tema') as Tema|null) ?? 'petroleo'; setTema(salvo); document.documentElement.dataset.theme=salvo; },[]);
  function aplicar(valor:Tema){ setTema(valor); localStorage.setItem('nexofield-tema',valor); document.documentElement.dataset.theme=valor; }
  return <label className="theme-switcher"><span>Tema</span><select value={tema} onChange={e=>aplicar(e.target.value as Tema)}><option value="petroleo">Verde petróleo</option><option value="azul">Azul</option><option value="branco">Branco</option></select></label>;
}
