import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckInRecord, SupportedLanguage } from '../types';
import { getLocalizedEmotionName, getLocalizedContextTag } from './localizationHelper';

export async function shareCheckIn(
  record: CheckInRecord,
  language: SupportedLanguage
): Promise<void> {
  let emotionDisplay = '';
  if (record.emotions && record.emotions.length > 0) {
    emotionDisplay = record.emotions
      .map((em) => getLocalizedEmotionName(em.id, em.name, language))
      .join(', ');
  } else {
    emotionDisplay = getLocalizedEmotionName(
      record.emotionId,
      record.emotionName,
      language
    );
  }

  // Determine user invite link
  let inviteUrl = 'https://how-am-i.famehub.ru/';
  try {
    const rawUser = await AsyncStorage.getItem('@howami_auth_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u && u.inviteCode) {
        const from = encodeURIComponent(u.name || 'Близкий');
        inviteUrl = `https://how-am-i.famehub.ru/?invite=${u.inviteCode}&from=${from}#friends`;
      }
    }
  } catch (e) {
    // fallback
  }

  let text = '';
  if (language === 'ru') {
    // Clean header without confusing single quadrant emoji/text for multi-emotions
    text = `✨ Мой чекин чувств: ${emotionDisplay}\n`;
    if (record.note) {
      text += `\n💬 «${record.note}»\n`;
    }
    const tags = [
      ...record.context.people.map((p) => `@${getLocalizedContextTag(p, 'ru')}`),
      ...record.context.location.map((l) => `📍${getLocalizedContextTag(l, 'ru')}`),
      ...record.context.activity.map((a) => `⚡${getLocalizedContextTag(a, 'ru')}`),
    ];
    if (tags.length > 0) {
      text += `\nКонтекст: ${tags.join(' ')}\n`;
    }
    text += `\n🌱 Отправлено из «Как я?» — Трекер чувств и настроения\nПрисоединяйтесь: ${inviteUrl}`;
  } else {
    text = `✨ My Feeling Check-in: ${emotionDisplay}\n`;
    if (record.note) {
      text += `\n💬 "${record.note}"\n`;
    }
    const tags = [
      ...record.context.people.map((p) => `@${getLocalizedContextTag(p, 'en')}`),
      ...record.context.location.map((l) => `📍${getLocalizedContextTag(l, 'en')}`),
      ...record.context.activity.map((a) => `⚡${getLocalizedContextTag(a, 'en')}`),
    ];
    if (tags.length > 0) {
      text += `\nContext: ${tags.join(' ')}\n`;
    }
    text += `\n🌱 Sent from "How Am I?" — Mood & Feelings Tracker\nJoin here: ${inviteUrl}`;
  }

  try {
    await Share.share({
      title: language === 'ru' ? 'Мой чекин в «Как я?»' : 'My check-in on "How Am I?"',
      message: text,
    });
  } catch (error) {
    console.error('Error sharing check-in:', error);
  }
}
