import type { Metadata } from 'next';
import './globals.css';
import './extras.css';

export const metadata: Metadata = {
  title: 'NexoField | Gestão Inteligente de Operações de Campo',
  description: 'Gestão de chamados, técnicos, logística, vistorias e atividades de campo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
