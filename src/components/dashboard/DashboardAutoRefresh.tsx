'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardAutoRefreshProps {
  intervalMs?: number;
  enabled?: boolean;
}

export function DashboardAutoRefresh({ intervalMs = 60000, enabled = true }: DashboardAutoRefreshProps) {
  const router = useRouter();
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const refreshDashboard = () => {
      if (isRefreshingRef.current) return;

      isRefreshingRef.current = true;
      router.refresh();

      window.setTimeout(() => {
        isRefreshingRef.current = false;
      }, 1000);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshDashboard();
      }
    }, intervalMs);

    const handleFocus = () => {
      refreshDashboard();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboard();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
