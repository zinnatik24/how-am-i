export type QuadrantId = 'high_unpleasant' | 'high_pleasant' | 'low_unpleasant' | 'low_pleasant';

export interface Quadrant {
  id: QuadrantId;
  name_key: string;
  color_hex: string;
  energy: 'high' | 'low';
  pleasantness: 'unpleasant' | 'pleasant';
  translations: {
    en: string;
    ru: string;
    [lang: string]: string;
  };
}

export interface Emotion {
  id: string;
  quadrant: QuadrantId;
  intensity: 1 | 2 | 3; // 1: Mild, 2: Moderate, 3: Intense
  en: {
    name: string;
    definition: string;
  };
  ru: {
    name: string;
    definition: string;
  };
  [lang: string]: any;
}

export type ContextCategory = 'people' | 'location' | 'activity';

export interface ContextTag {
  id: string;
  category: ContextCategory;
  icon: string;
  en: string;
  ru: string;
}

export interface SelectedEmotionItem {
  id: string;
  name: string;
  quadrantId: QuadrantId;
  intensity: 1 | 2 | 3;
}

export interface CheckInRecord {
  id: string;
  timestamp: string; // ISO string
  quadrantId: QuadrantId;
  emotionId: string;
  emotionName: string;
  intensity: 1 | 2 | 3;
  emotions?: SelectedEmotionItem[]; // Up to 3 emotions per check-in
  context: {
    people: string[];
    location: string[];
    activity: string[];
  };
  note?: string;
}

export interface FriendRecord {
  id: string;
  name: string;
  relationship: 'partner' | 'friend' | 'family' | 'other';
  avatarColor: string;
  lastCheckIn?: {
    quadrantId: QuadrantId;
    emotionId: string;
    emotionName: string;
    timeAgo: string;
    note?: string;
  };
  lastReactionSent?: string;
}

export type SupportedLanguage = 'en' | 'ru';
