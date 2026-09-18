import { useEffect, useState } from 'react'
import { isSoundEnabled, setSoundEnabled, playTap } from '../lib/sounds.js'
import { requestNotifications, notificationPermission } from '../lib/notifications.js'

export default function SoundToggle() {
  const [sound, setSound] = useState(isSoundEnabled())
  const [notifications, setNotifications] = useState(notificationPermission())

  useEffect(() => setSound(isSoundEnabled()), [])

  function toggleSound() {
    const next = !sound
    setSoundEnabled(next)
    setSound(next)
    playTap()
  }

  async function enableNotifications() {
    const permission = await requestNotifications()
    setNotifications(permission)
  }

  return (
    <div className="fixed right-4 top-4 z-40 flex gap-2">
      <button
        type="button"
        onClick={toggleSound}
        aria-label={sound ? 'Turn sounds off' : 'Turn sounds on'}
        className="rounded-full border border-cream/15 bg-ink/75 px-3 py-2 text-xs text-cream/70 backdrop-blur"
      >
        {sound ? 'Sound on' : 'Sound off'}
      </button>
      {notifications !== 'granted' && notifications !== 'unsupported' && (
        <button
          type="button"
          onClick={enableNotifications}
          className="rounded-full border border-cream/15 bg-ink/75 px-3 py-2 text-xs text-cream/70 backdrop-blur"
        >
          {notifications === 'denied' ? 'Notifications blocked' : 'Enable notifications'}
        </button>
      )}
    </div>
  )
}
