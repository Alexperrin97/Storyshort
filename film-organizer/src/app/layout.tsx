import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Film Organizer',
  description: 'Organisateur de tournage collaboratif',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
