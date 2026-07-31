'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import styles from './CommissionNotifications.module.css';

type NotificationStatus =
  | 'loading'
  | 'unsupported'
  | 'default'
  | 'denied'
  | 'enabled'
  | 'disabled';

type PushConfig = {
  ambassadorId: string;
  publicKey: string;
};

type CommissionNotification = {
  id: string;
  notification_type?: 'commission_released' | 'admin_message';
  title: string;
  body: string;
  amount?: number | string | null;
  sound_type?: 'none' | 'money';
  target_url?: string;
};

type NotificationContextValue = {
  status: NotificationStatus;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const OPT_OUT_KEY = 'bryza-push-opt-out';
const COMMISSION_SOUND_URL = '/sounds/commission-money.mp3';

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

let commissionAudio: HTMLAudioElement | null = null;
let commissionAudioUnlocked = false;

function getCommissionAudio() {
  if (typeof window === 'undefined') return null;
  if (!commissionAudio) {
    commissionAudio = new Audio(COMMISSION_SOUND_URL);
    commissionAudio.preload = 'auto';
    commissionAudio.volume = 0.9;
  }
  return commissionAudio;
}

function unlockAudio() {
  if (commissionAudioUnlocked) return;
  const audio = getCommissionAudio();
  if (!audio) return;

  audio.volume = 0.001;
  const playback = audio.play();
  if (!playback) return;

  void playback
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.9;
      commissionAudioUnlocked = true;
    })
    .catch(() => {
      audio.volume = 0.9;
    });
}

function playCommissionSound() {
  const audio = getCommissionAudio();
  if (!audio) return;

  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0.9;
  void audio.play()
    .then(() => {
      commissionAudioUnlocked = true;
    })
    .catch((error) => {
      console.warn('O navegador bloqueou o toque da comissão:', error);
    });
}

function getSubscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  };
}

function formatCommission(value: number | string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

export function CommissionNotificationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<NotificationStatus>('loading');
  const [config, setConfig] = useState<PushConfig | null>(null);
  const seenIds = useRef(new Set<string>());
  const isAmbassadorPortal = pathname.startsWith('/embaixador/')
    && !pathname.startsWith('/embaixador/login');

  const announce = useCallback((notification: CommissionNotification) => {
    if (!notification.id || seenIds.current.has(notification.id)) return;
    seenIds.current.add(notification.id);
    const isCommission = notification.notification_type !== 'admin_message';
    if (notification.sound_type === 'money' || (isCommission && !notification.sound_type)) {
      playCommissionSound();
    }
    toast.success(notification.title || 'Nova comissão liberada!', {
      description: isCommission
        ? `${formatCommission(notification.amount || 0)} disponível para saque.`
        : notification.body,
      duration: 9000,
      action: {
        label: isCommission ? 'Ver comissão' : 'Abrir',
        onClick: () => window.location.assign(
          notification.target_url || '/embaixador/comissoes',
        ),
      },
    });
    window.dispatchEvent(new CustomEvent('bryza:notification-received', {
      detail: notification,
    }));
  }, []);

  const saveSubscription = useCallback(async (subscription: PushSubscription) => {
    const response = await fetch('/api/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getSubscriptionPayload(subscription)),
    });
    if (!response.ok) throw new Error('Falha ao registrar este dispositivo.');
  }, []);

  const subscribe = useCallback(async (
    registration: ServiceWorkerRegistration,
    publicKey: string,
  ) => {
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
    await saveSubscription(subscription);
    setStatus('enabled');
  }, [saveSubscription]);

  useEffect(() => {
    if (!isAmbassadorPortal) {
      setStatus('disabled');
      return;
    }
    if (
      !('serviceWorker' in navigator)
      || !('PushManager' in window)
      || !('Notification' in window)
    ) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    const initialize = async () => {
      try {
        const [registration, response] = await Promise.all([
          navigator.serviceWorker.register('/sw.js'),
          fetch('/api/push/subscriptions'),
        ]);
        if (!response.ok) throw new Error('Configuração de push indisponível.');
        const pushConfig = await response.json() as PushConfig;
        if (cancelled) return;
        setConfig(pushConfig);

        if (Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await saveSubscription(existing);
          if (!cancelled) setStatus('enabled');
          return;
        }

        if (
          Notification.permission === 'granted'
          && localStorage.getItem(OPT_OUT_KEY) !== 'true'
        ) {
          await subscribe(registration, pushConfig.publicKey);
          return;
        }

        setStatus(
          localStorage.getItem(OPT_OUT_KEY) === 'true' ? 'disabled' : 'default',
        );
      } catch (error) {
        console.error('Erro ao inicializar notificações de comissão:', error);
        if (!cancelled) setStatus('unsupported');
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [isAmbassadorPortal, saveSubscription, subscribe]);

  useEffect(() => {
    if (!isAmbassadorPortal || !config?.ambassadorId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`commission-notifications-${config.ambassadorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ambassador_notifications',
          filter: `ambassador_id=eq.${config.ambassadorId}`,
        },
        (event) => announce(event.new as CommissionNotification),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [announce, config?.ambassadorId, isAmbassadorPortal]);

  useEffect(() => {
    if (!isAmbassadorPortal || !('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'bryza-push') return;
      const payload = event.data.payload as {
        id?: string;
        type?: 'commission_released' | 'admin_message';
        title?: string;
        body?: string;
        amount?: number | null;
        sound?: 'none' | 'money';
        url?: string;
      };
      announce({
        id: payload.id || crypto.randomUUID(),
        notification_type: payload.type,
        title: payload.title || 'Nova comissão liberada!',
        body: payload.body || '',
        amount: payload.amount,
        sound_type: payload.sound,
        target_url: payload.url,
      });
    };
    const handleFirstInteraction = () => unlockAudio();

    navigator.serviceWorker.addEventListener('message', handleMessage);
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [announce, isAmbassadorPortal]);

  const enable = useCallback(async () => {
    if (!config || !('serviceWorker' in navigator) || !('Notification' in window)) {
      toast.error('Este navegador não oferece suporte a notificações push.');
      return;
    }

    setStatus('loading');
    unlockAudio();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus(permission === 'denied' ? 'denied' : 'default');
      if (permission === 'denied') {
        toast.error('Permissão bloqueada. Libere as notificações nas configurações do navegador.');
      }
      return;
    }

    try {
      localStorage.removeItem(OPT_OUT_KEY);
      const registration = await navigator.serviceWorker.ready;
      await subscribe(registration, config.publicKey);
      toast.success('Notificações de comissão ativadas neste dispositivo.');
    } catch (error) {
      console.error('Erro ao ativar Web Push:', error);
      setStatus('default');
      toast.error('Não foi possível ativar as notificações neste dispositivo.');
    }
  }, [config, subscribe]);

  const disable = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      localStorage.setItem(OPT_OUT_KEY, 'true');
      setStatus('disabled');
      toast.success('Notificações desativadas neste dispositivo.');
    } catch (error) {
      console.error('Erro ao desativar Web Push:', error);
      toast.error('Não foi possível desativar as notificações.');
    }
  }, []);

  const value = useMemo(
    () => ({ status, enable, disable }),
    [disable, enable, status],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function CommissionNotificationButton() {
  const context = useContext(NotificationContext);
  if (!context || context.status === 'unsupported') return null;

  const enabled = context.status === 'enabled';
  const loading = context.status === 'loading';
  const denied = context.status === 'denied';

  return (
    <button
      type="button"
      className={`${styles.button} ${enabled ? styles.enabled : ''}`}
      onClick={() => void (enabled ? context.disable() : context.enable())}
      disabled={loading || denied}
      title={denied
        ? 'Libere a permissão nas configurações do navegador.'
        : undefined}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {enabled ? 'notifications_active' : denied ? 'notifications_off' : 'notifications'}
      </span>
      {loading
        ? 'Configurando...'
        : enabled
          ? 'Notificações ativas'
          : denied
            ? 'Notificações bloqueadas'
            : 'Ativar notificações'}
    </button>
  );
}
