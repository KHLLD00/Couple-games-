import { supabase } from './supabase.js'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SW_PATH = '/sw.js'

function supported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export async function registerPushServiceWorker() {
  if (!supported()) return null
  return navigator.serviceWorker.register(SW_PATH)
}

export async function enablePushNotifications() {
  if (!supported() || !PUBLIC_KEY) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission

  const registration = await registerPushServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  }, { onConflict: 'endpoint' })

  if (error) throw new Error(error.message || 'Could not save notification settings.')
  return 'granted'
}

export async function unregisterPushNotifications() {
  if (!supported()) return
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

export async function notifyPartner(roomCode, event) {
  if (!roomCode) return
  try {
    await supabase.functions.invoke('push-game-event', {
      body: { room_code: roomCode, event },
    })
  } catch {
    // Push is convenience only; game state must continue working if push fails.
  }
}
