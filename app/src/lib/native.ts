import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

/** Phone-app-only setup. Does nothing in a normal browser. */
export async function setupNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  // Status bar icons follow the phone's light or dark setting, like the app.
  await SystemBars.setStyle({ style: SystemBarsStyle.Default })
}
