'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import styles from './InstallAppButton.module.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    setIsInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      toast.success('App Bryza adicionado à tela inicial.');
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Não foi possível registrar o app Bryza:', error);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (isInstalled) {
      window.location.assign('https://ev.bryza.com.br');
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
      return;
    }

    setShowInstructions(true);
  };

  return (
    <>
      <button className={styles.button} type="button" onClick={handleInstall}>
        <span className={`material-symbols-outlined ${styles.icon}`} aria-hidden="true">
          {isInstalled ? 'open_in_browser' : 'install_mobile'}
        </span>
        {isInstalled ? 'Abrir app Bryza' : 'Instalar app no celular'}
      </button>

      {showInstructions && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowInstructions(false);
          }}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-app-title"
          >
            <div className={styles.dialogIcon} aria-hidden="true">
              <span className="material-symbols-outlined">add_to_home_screen</span>
            </div>
            <h2 id="install-app-title">Adicionar Bryza à tela inicial</h2>
            <p>
              Crie um atalho para abrir o Espaço do Embaixador diretamente em
              ev.bryza.com.br.
            </p>

            <ol className={styles.steps}>
              {isIos ? (
                <>
                  <li>Toque no botão Compartilhar do Safari.</li>
                  <li>Escolha “Adicionar à Tela de Início”.</li>
                  <li>Confirme tocando em “Adicionar”.</li>
                </>
              ) : (
                <>
                  <li>Abra o menu do navegador.</li>
                  <li>Toque em “Instalar app” ou “Adicionar à tela inicial”.</li>
                  <li>Confirme a instalação.</li>
                </>
              )}
            </ol>

            <button
              className={styles.closeButton}
              type="button"
              onClick={() => setShowInstructions(false)}
              autoFocus
            >
              Entendi
            </button>
          </section>
        </div>
      )}
    </>
  );
}
