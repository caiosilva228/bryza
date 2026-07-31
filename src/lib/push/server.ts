import webpush from 'web-push';

let configured = false;

export function getWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim()
    || 'mailto:notificacoes@bryza.com.br';

  if (!publicKey || !privateKey) {
    throw new Error('Web Push não configurado: informe as chaves VAPID.');
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return webpush;
}
