import type { Metadata } from 'next';
import Script from 'next/script';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'BRYZA SYSTEM - Gestão Operacional',
  description: 'Sistema interno de gestão de material de limpeza.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
        <Script id="strip-bis-attrs" strategy="beforeInteractive">
          {`
            (() => {
              const attrName = 'bis_skin_checked';
              const stripAttr = (node) => {
                if (!(node instanceof Element)) return;
                if (node.hasAttribute(attrName)) node.removeAttribute(attrName);
                const tagged = node.querySelectorAll('[' + attrName + ']');
                for (const el of tagged) el.removeAttribute(attrName);
              };

              const startObserver = () => {
                stripAttr(document.documentElement);
                const observer = new MutationObserver((mutations) => {
                  for (const mutation of mutations) {
                    if (mutation.type === 'attributes') {
                      stripAttr(mutation.target);
                      continue;
                    }
                    for (const node of mutation.addedNodes) stripAttr(node);
                  }
                });

                observer.observe(document.documentElement, {
                  subtree: true,
                  childList: true,
                  attributes: true,
                  attributeFilter: [attrName],
                });

                window.addEventListener('load', () => stripAttr(document.documentElement), { once: true });
              };

              if (document.documentElement) {
                startObserver();
              } else {
                document.addEventListener('DOMContentLoaded', startObserver, { once: true });
              }
            })();
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  );
}
