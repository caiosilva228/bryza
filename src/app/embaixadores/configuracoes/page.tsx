import type { Metadata } from 'next';
import { MainLayout } from '@/components/layout/MainLayout';
import { getAmbassadorProgramSettings } from './actions';
import { ProgramSettingsForm } from './ProgramSettingsForm';
import styles from './settings.module.css';

export const metadata: Metadata = {
  title: 'Configurações do programa | Bryza',
};

export default async function AmbassadorProgramSettingsPage() {
  const settings = await getAmbassadorProgramSettings();

  return (
    <MainLayout>
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Programa de Embaixadores · Administração</span>
            <h1>Configurações</h1>
            <p>Centralize as regras operacionais, financeiras e de crescimento do programa.</p>
          </div>
          <div className={styles.headerBadge}>
            <span className="material-symbols-outlined">shield_lock</span>
            <span><strong>Área administrativa</strong><small>Alterações ficam registradas</small></span>
          </div>
        </header>

        <ProgramSettingsForm initialSettings={settings} />
      </main>
    </MainLayout>
  );
}
