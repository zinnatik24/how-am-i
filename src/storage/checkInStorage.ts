import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckInRecord, SupportedLanguage } from '../types';

const STORAGE_KEYS = {
  CHECK_INS: '@how_we_feel_checkins_v1',
  LANGUAGE: '@how_we_feel_language_v1',
  DEFAULT_SHARE_WITH_PARTNERS: '@how_am_i_default_share_partners_v1',
};

export async function getDefaultShareWithPartners(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_SHARE_WITH_PARTNERS);
    if (raw === null) return true; // Default to true initially
    return raw === 'true';
  } catch (error) {
    return true;
  }
}

export async function setDefaultShareWithPartners(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DEFAULT_SHARE_WITH_PARTNERS, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to save default share preference:', error);
  }
}

export async function getCheckIns(): Promise<CheckInRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHECK_INS);
    if (!raw) return [];
    const list: CheckInRecord[] = JSON.parse(raw);
    // Strictly filter out any demo/sample checkins
    const realCheckIns = list.filter((item) => !item.id.startsWith('demo-'));
    if (realCheckIns.length !== list.length) {
      await AsyncStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify(realCheckIns));
    }
    return realCheckIns.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Failed to get check-ins:', error);
    return [];
  }
}

export async function saveCheckIn(record: CheckInRecord): Promise<CheckInRecord[]> {
  try {
    const current = await getCheckIns();
    const updated = [record, ...current];
    await AsyncStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to save check-in:', error);
    throw error;
  }
}

export async function deleteCheckIn(id: string): Promise<CheckInRecord[]> {
  try {
    const current = await getCheckIns();
    const updated = current.filter((item) => item.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to delete check-in:', error);
    throw error;
  }
}

export async function clearAllCheckIns(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CHECK_INS);
  } catch (error) {
    console.error('Failed to clear check-ins:', error);
    throw error;
  }
}

export async function getStoredLanguage(): Promise<SupportedLanguage | null> {
  try {
    const lang = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (lang === 'en' || lang === 'ru') return lang;
    return null;
  } catch (error) {
    return null;
  }
}

export async function saveStoredLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
}

export async function seedSampleData(): Promise<CheckInRecord[]> {
  // Demo data permanently removed per user request
  return [];
}

