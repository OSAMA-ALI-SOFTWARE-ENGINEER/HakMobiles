import { describe, expect, it } from 'vitest'
import { installRoute } from './InstallPrompt'

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const chromeIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1'

describe('installRoute', () => {
  it('tells an iPhone in Safari to use Add to Home Screen', () => {
    expect(installRoute({ userAgent: iphone, maxTouchPoints: 5, standalone: false, protocol: 'https:' })).toBe('ios-safari')
  })

  it('tells an iPhone in Chrome to open Safari first', () => {
    expect(installRoute({ userAgent: chromeIos, maxTouchPoints: 5, standalone: false, protocol: 'https:' })).toBe('ios-browser')
  })

  it('treats a touch Mac as an iPad', () => {
    expect(installRoute({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', maxTouchPoints: 5, standalone: false, protocol: 'https:' })).toBe('ios-safari')
  })

  it('keeps Android on the browser install path', () => {
    expect(installRoute({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0.0.0 Mobile', maxTouchPoints: 5, standalone: false, protocol: 'https:' })).toBe('android')
  })

  it('hides the prompt once the app is already installed or running in the desktop app', () => {
    expect(installRoute({ userAgent: iphone, maxTouchPoints: 5, standalone: true, protocol: 'https:' })).toBe('skip')
    expect(installRoute({ userAgent: 'Windows', maxTouchPoints: 0, standalone: false, protocol: 'app:' })).toBe('skip')
  })
})
