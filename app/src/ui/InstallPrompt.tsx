import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { api } from '../api'

interface InstallChoice {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'hak.install.dismissed'
const WINDOWS_SETUP = '/downloads/HAK%20Wholesales%20Tracker%20Setup%201.0.0.exe'

function installedAlready() {
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
}

export function applyFavicon(logo: string) {
  if (!logo.startsWith('data:image/')) return
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/png'
  link.href = logo
}

export function InstallPrompt() {
  const [choice, setChoice] = useState<InstallChoice | null>(null)
  const [logo, setLogo] = useState('/favicon.png')
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === 'yes' || installedAlready() || location.protocol === 'app:')
  const [help, setHelp] = useState('')

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setChoice(event as Event & InstallChoice)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    let cancel = false
    api('/api/brand').then((brand) => {
      if (cancel || typeof brand.logo !== 'string' || !brand.logo.startsWith('data:image/')) return
      setLogo(brand.logo)
      applyFavicon(brand.logo)
    }).catch(() => {})
    return () => { cancel = true }
  }, [])

  if (hidden) return null

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const android = /android/i.test(navigator.userAgent)

  async function install() {
    if (choice) {
      await choice.prompt()
      const result = await choice.userChoice
      setChoice(null)
      if (result.outcome === 'accepted') setHidden(true)
      return
    }
    if (ios) {
      setHelp('Tap Share, then Add to Home Screen.')
      return
    }
    if (android) {
      setHelp('Open the browser menu and choose Install app.')
      return
    }
    window.location.assign(WINDOWS_SETUP)
  }

  return (
    <aside className="install-prompt" aria-label="Install HAK">
      <img src={logo} alt="" />
      <div>
        <strong>Install HAK</strong>
        <p>{help || 'Add HAK to your home screen for quick, full-screen access.'}</p>
        <button type="button" className="btn" onClick={() => void install()}>
          <Download aria-hidden="true" size={16} /> Install
        </button>
      </div>
      <button type="button" className="install-close" aria-label="Dismiss install" onClick={() => { localStorage.setItem(DISMISS_KEY, 'yes'); setHidden(true) }}>
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  )
}
