import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { api } from '../api'

interface InstallChoice {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'hak.install.dismissed'
const WINDOWS_SETUP = '/downloads/HAK%20Wholesales%20Tracker%20Setup%201.0.0.exe'

export type InstallRoute = 'skip' | 'ios-safari' | 'ios-browser' | 'android' | 'windows'

export function installRoute(input: { userAgent: string; maxTouchPoints: number; standalone: boolean; protocol: string }): InstallRoute {
  if (input.standalone || input.protocol === 'app:') return 'skip'
  const ua = input.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && input.maxTouchPoints > 1)
  if (ios) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|FBAN|FBAV|Instagram|Line\//i.test(ua)
    return otherBrowser ? 'ios-browser' : 'ios-safari'
  }
  if (/android/i.test(ua)) return 'android'
  return 'windows'
}

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
  const [expanded, setExpanded] = useState(false)
  const route = installRoute({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: installedAlready(),
    protocol: location.protocol,
  })

  useEffect(() => {
    const onPrompt = (event: Event) => {
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

  if (hidden || route === 'skip') return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'yes')
    setHidden(true)
  }

  async function install() {
    if (choice) {
      try {
        await choice.prompt()
        const result = await choice.userChoice
        setChoice(null)
        if (result.outcome === 'accepted') setHidden(true)
        return
      } catch {
        setChoice(null)
      }
    }
    if (route === 'android') {
      setHelp('Open the browser menu and choose Install app or Add to Home screen.')
      return
    }
    window.location.assign(WINDOWS_SETUP)
  }

  if (route === 'ios-safari' || route === 'ios-browser') {
    const steps = route === 'ios-safari'
      ? [
          'Tap the Share button at the bottom of Safari. It is the square with an arrow.',
          'Scroll the share menu and tap Add to Home Screen.',
          'Tap Add. HAK then opens full screen from its icon.',
        ]
      : [
          'This page is not in Safari. iPhone only installs apps from Safari.',
          'Open the browser menu and choose Open in Safari.',
          'In Safari, tap Share, then Add to Home Screen, then Add.',
        ]
    return (
      <aside className={`install-prompt install-ios${expanded ? ' expanded' : ''}`} aria-label="Install HAK">
        <img src={logo} alt="" />
        <div>
          <strong>{route === 'ios-safari' ? 'Add HAK to your Home Screen' : 'Open this page in Safari'}</strong>
          {expanded && (
            <ol className="install-steps">
              {steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}
            </ol>
          )}
        </div>
        <button type="button" className="btn" onClick={() => setExpanded(true)}>Add</button>
        <button type="button" className="install-close" aria-label="Dismiss install" onClick={dismiss}>
          <X aria-hidden="true" size={16} />
        </button>
      </aside>
    )
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
      <button type="button" className="install-close" aria-label="Dismiss install" onClick={dismiss}>
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  )
}
