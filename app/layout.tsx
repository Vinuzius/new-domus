import type { Metadata } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Public_Sans } from 'next/font/google';
import { MotionConfig } from 'motion/react';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-public-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Domus Finance — Organização Financeira Doméstica',
  description:
    'Aplicação web pessoal para organização financeira doméstica com controle de despesas, categorias, responsáveis e contas bancárias.',
  openGraph: {
    title: 'Domus Finance — Organização Financeira Doméstica',
    description:
      'Aplicação web pessoal para organização financeira doméstica com controle de despesas, categorias, responsáveis e contas bancárias.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Domus Finance — Organização Financeira Doméstica',
    description:
      'Aplicação web pessoal para organização financeira doméstica com controle de despesas, categorias, responsáveis e contas bancárias.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${plusJakarta.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <body suppressHydrationWarning className="min-h-screen bg-slate-50 text-slate-900">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
