'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CommissionNotificationButton } from './CommissionNotifications';
import styles from './AmbassadorNotificationBell.module.css';

type InboxNotification = {
  id: string;
  notification_type: 'commission_released' | 'admin_message';
  title: string;
  body: string;
  amount: number | string | null;
  target_url: string;
  sound_type: 'none' | 'money';
  read_at: string | null;
  created_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('pt-BR', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(date);
}

export function AmbassadorNotificationBell() {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/push/inbox', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as {
        notifications?: InboxNotification[];
        unreadCount?: number;
      };
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Erro ao atualizar o sininho:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);
    const handleNewNotification = () => void loadNotifications();
    window.addEventListener('bryza:notification-received', handleNewNotification);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('bryza:notification-received', handleNewNotification);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current
        && !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const markRead = async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.read_at) return;

    setNotifications((current) => current.map((item) =>
      item.id === id ? { ...item, read_at: new Date().toISOString() } : item
    ));
    setUnreadCount((current) => Math.max(0, current - 1));
    await fetch('/api/push/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const openNotification = async (notification: InboxNotification) => {
    await markRead(notification.id);
    window.location.assign(notification.target_url || '/embaixador/dashboard');
  };

  const markAllRead = async () => {
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({
      ...item,
      read_at: item.read_at || readAt,
    })));
    setUnreadCount(0);
    await fetch('/api/push/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.bell}
        onClick={() => {
          setIsOpen((current) => !current);
          if (!isOpen) void loadNotifications();
        }}
        aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`}
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className={styles.badge}>{Math.min(unreadCount, 99)}</span>
        )}
      </button>

      {isOpen && (
        <section className={styles.dropdown} aria-label="Central de notificações">
          <header className={styles.header}>
            <div>
              <strong>Notificações</strong>
              <span>{unreadCount ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}</span>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()}>
                Marcar todas como lidas
              </button>
            )}
          </header>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.empty}>Carregando notificações...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>
                <span className="material-symbols-outlined">notifications_none</span>
                Você ainda não recebeu notificações.
              </div>
            ) : notifications.map((notification) => {
              const isCommission = notification.notification_type === 'commission_released';
              return (
                <button
                  type="button"
                  key={notification.id}
                  className={`${styles.item} ${!notification.read_at ? styles.unread : ''}`}
                  onClick={() => void openNotification(notification)}
                >
                  <span className={`${styles.icon} ${isCommission ? styles.money : ''}`}>
                    <span className="material-symbols-outlined">
                      {isCommission ? 'payments' : 'campaign'}
                    </span>
                  </span>
                  <span className={styles.content}>
                    <span className={styles.itemTop}>
                      <strong>{notification.title}</strong>
                      <time>{formatDate(notification.created_at)}</time>
                    </span>
                    <span className={styles.body}>{notification.body}</span>
                  </span>
                  {!notification.read_at && <span className={styles.unreadDot} />}
                </button>
              );
            })}
          </div>

          <footer className={styles.footer}>
            <CommissionNotificationButton />
          </footer>
        </section>
      )}
    </div>
  );
}
