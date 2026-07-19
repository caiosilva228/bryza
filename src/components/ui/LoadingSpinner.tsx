'use client';

import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Carregando...',
  fullScreen = true,
}) => {
  const content = (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <div className={styles.glowEffect} />
        <img
          src="/onda-bryza.svg"
          alt="Bryza Loading"
          className={styles.logoImage}
        />
        <div className={styles.waveRipple} />
      </div>
      {message && <p className={styles.loadingText}>{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className={styles.fullScreenWrapper}>{content}</div>;
  }

  return content;
};
