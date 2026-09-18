export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function notify(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  try { new Notification(title, { body, tag: 'same-page' }) } catch {}
}
