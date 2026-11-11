'use client';

import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';

export type PerfilDb = {
  id: string;
  nome: string;
  email: string | null;
  usuario: string;
  tipo: 'admin' | 'tecnico' | 'logistica';
  regiao: 'capital' | 'interior' | 'noronha' | null;
  areas: string[];
  skills: string[];
  admin_geral: boolean;
  ativo: boolean;
};

export async function obterPerfilAtual(userId: string): Promise<PerfilDb | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('perfis')
    .select('id,nome,email,usuario,tipo,regiao,areas,skills,admin_geral,ativo')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as PerfilDb | null;
}
