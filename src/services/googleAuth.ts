import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_CLIENT_ID_STORAGE_KEY = '@howami_google_client_id';

// Official Web Client ID from Google Cloud Console
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
 * Standard, robust OAuth 2.0 Redirect Flow.
 * Works on Desktop, Mobile, iOS Safari, Android Chrome, and in-app webviews (Telegram/WhatsApp).
 * No popup blocking issues.
 */
export function startGoogleOAuthRedirect(clientId: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  const redirectUri = window.location.origin; // https://how-am-i.famehub.ru
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: 'openid email profile',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log('🔗 [AUTH] Redirecting to Google OAuth:', authUrl);
  window.location.href = authUrl;
}

/**
 * Parses OAuth 2.0 callback parameters from URL hash (#access_token=... or ?access_token=...)
 */
export function parseGoogleOAuthCallback(): { accessToken?: string; error?: string; errorDescription?: string } | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash ? window.location.hash.substring(1) : '';
  const search = window.location.search ? window.location.search.substring(1) : '';

  if (!hash && !search) {
    return null;
  }

  const params = new URLSearchParams(hash || search);
  const accessToken = params.get('access_token');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (accessToken || error) {
    // Clean hash from URL bar without reloading the page
    try {
      const cleanUrl = window.location.pathname + window.location.search.replace(/[?&]access_token=[^&]+/, '');
      window.history.replaceState({}, document.title, cleanUrl || '/');
    } catch (e) {
      // Ignore history state errors
    }

    return {
      accessToken: accessToken || undefined,
      error: error || undefined,
      errorDescription: errorDescription || undefined,
    };
  }

  return null;
}
