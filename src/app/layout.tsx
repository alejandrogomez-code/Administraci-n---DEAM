import type { Metadata, Viewport } from 'next';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import { ThemeProvider, themeInitScript } from '@/components/ThemeProvider';
import { FeedbackHost } from '@/components/feedback';
import './globals.css';

export const metadata: Metadata = {
  title: 'Administración DEAM',
  description: 'Plataforma interna de administración DEAM SRL',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#15302C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <FeedbackHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
