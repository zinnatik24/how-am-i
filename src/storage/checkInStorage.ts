import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckInRecord, SupportedLanguage } from '../types';

const STORAGE_KEYS = {
  CHECK_INS: '@how_we_feel_checkins_v1',
  LANGUAGE: '@how_we_feel_language_v1',
};

export async function getCheckIns(): Promise<CheckInRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHECK_INS);
    if (!raw) return [];
    const list: CheckInRecord[] = JSON.parse(raw);
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
  const now = new Date();
  const lang = await getStoredLanguage();
  const isRu = lang !== 'en'; // default to Russian

  const sampleEntries: CheckInRecord[] = [
    {
      id: 'demo-1',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      quadrantId: 'low_pleasant',
      emotionId: 'calm',
      emotionName: isRu ? 'Спокойствие' : 'Calm',
      intensity: 1,
      context: {
        people: ['alone'],
        location: ['home'],
        activity: ['resting'],
      },
      note: isRu ? 'Утренний кофе и спокойное чтение книги.' : 'Morning coffee and quiet reading time.',
    },
    {
      id: 'demo-2',
      timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
      quadrantId: 'high_pleasant',
      emotionId: 'joyful',
      emotionName: isRu ? 'Радость' : 'Joyful',
      intensity: 3,
      context: {
        people: ['friends'],
        location: ['cafe'],
        activity: ['socializing'],
      },
      note: isRu ? 'Встреча с друзьями в уютном кафе на бранч.' : 'Met with friends for brunch at a cafe.',
    },
    {
      id: 'demo-3',
      timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      quadrantId: 'high_unpleasant',
      emotionId: 'stressed',
      emotionName: isRu ? 'Стресс' : 'Stressed',
      intensity: 2,
      context: {
        people: ['coworkers'],
        location: ['work'],
        activity: ['working'],
      },
      note: isRu ? 'Дедлайн перед запуском проекта.' : 'Deadline crunch before release.',
    },
    {
      id: 'demo-4',
      timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
      quadrantId: 'low_unpleasant',
      emotionId: 'drained',
      emotionName: isRu ? 'Истощенно' : 'Drained',
      intensity: 1,
      context: {
        people: ['alone'],
        location: ['home'],
        activity: ['resting'],
      },
      note: isRu ? 'Насыщенная рабочая неделя, упадок сил.' : 'Long week catching up with me.',
    },
    {
      id: 'demo-5',
      timestamp: new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString(),
      quadrantId: 'low_pleasant',
      emotionId: 'grateful',
      emotionName: isRu ? 'Благодарность' : 'Grateful',
      intensity: 2,
      context: {
        people: ['family'],
        location: ['home'],
        activity: ['eating'],
      },
      note: isRu ? 'Тёплый воскресный ужин с близкими.' : 'Sunday dinner with family.',
    },
  ];

  await AsyncStorage.setItem(STORAGE_KEYS.CHECK_INS, JSON.stringify(sampleEntries));
  return sampleEntries;
}
