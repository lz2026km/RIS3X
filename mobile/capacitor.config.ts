import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.g005.ris',
  appName: 'G005 RIS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1e3a5f',
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#1e3a5f',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
  },
}

export default config
