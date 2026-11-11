'use client';

import { AuthGate } from '@/src/features/auth/AuthGate';
import { NexoFieldShell } from '@/src/features/app/NexoFieldShell';

export default function HomePage() {
  return (
    <AuthGate>
      {({ user, perfil }) => <NexoFieldShell user={user} perfil={perfil} />}
    </AuthGate>
  );
}
