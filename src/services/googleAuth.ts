import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_CLIENT_ID_STORAGE_KEY = '@howami_google_client_id';

// Default Client ID from Google Cloud Console
export const DEFAULT_GOOGLE_CLIENT_ID =
  '363382599468-fol7ilnfdtcjpurkda5h1hmugmn0val8.apps.googleusercontent.com';

export async function getGoogleClientId(): Promise<string> {
  if (DEFAULT_GOOGLE_CLIENT_ID) return DEFAULT_GOOGLE_CLIENT_ID;
  try {
    const saved = await AsyncStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
    return saved || '';
  } catch {
    return '';
  }
}

export async function setGoogleClientId(clientId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, clientId.trim());
  } catch (e) {
    console.error('Failed to save Google Client ID:', e);
  }
}

/**
 * Loads Google Identity Services (GSI) script on Web dynamically
 */
export function loadGoogleGsiScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return resolve(false);
    }

    if ((window as any).google?.accounts?.oauth2) {
      return resolve(true);
    }

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Trigger Google OAuth popup on Web using Google Identity Services token client
 */
export async function promptGoogleSignInWeb(clientId: string): Promise<{ accessToken: string }> {
  const loaded = await loadGoogleGsiScript();
  if (!loaded || !(window as any).google?.accounts?.oauth2) {
    throw new Error('Не удалось загрузить библиотеку Google Identity Services');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else if (response.access_token) {
            resolve({ accessToken: response.access_token });
          } else {
            reject(new Error('Токен Google не получен'));
          }
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      reject(err);
    }
  });
}
