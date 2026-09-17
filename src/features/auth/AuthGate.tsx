'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/src/lib/supabase/client';
import { obterPerfilAtual, type PerfilDb } from './perfil.service';
import { NEXOFIELD_RELEASE } from '@/src/lib/version';

export function AuthGate({ children }: { children: (ctx: { user: User; perfil: PerfilDb }) => ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilDb | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const { data } = await supabase.auth.getUser();
      if (!ativo) return;
      setUser(data.user ?? null);
      if (data.user) {
        try {
          setPerfil(await obterPerfilAtual(data.user.id));
        } catch (e) {
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar o perfil.');
        }
      }
      setCarregando(false);
    }

    carregar();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!ativo) return;
      setUser(session?.user ?? null);
      if (session?.user) setPerfil(await obterPerfilAtual(session.user.id));
      else setPerfil(null);
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    setErro('');
    setCarregando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      setErro('Usuário ou senha inválidos.');
      setCarregando(false);
      return;
    }
    const perfilAtual = data.user ? await obterPerfilAtual(data.user.id) : null;
    if (!perfilAtual?.ativo) {
      await supabase.auth.signOut();
      setErro('Perfil não encontrado ou inativo.');
      setCarregando(false);
      return;
    }
    setUser(data.user);
    setPerfil(perfilAtual);
    setCarregando(false);
  }

  if (carregando) return <main className="shell"><section className="panel"><p>Carregando NexoField...</p></section></main>;

  if (!user || !perfil) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <span className="eyebrow">{NEXOFIELD_RELEASE.label}</span>
          <h1>Acesso ao sistema</h1>
          <p>Use o mesmo usuário cadastrado no NexoField atual.</p>
          <form onSubmit={entrar} className="login-form">
            <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
            <label>Senha<input type="password" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" /></label>
            {erro && <div className="error-box">{erro}</div>}
            <button type="submit">Entrar</button>
          </form>
        </section>
      </main>
    );
  }

  return <>{children({ user, perfil })}</>;
}
