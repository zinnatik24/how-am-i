import { Share } from 'react-native';
import { CheckInRecord, SupportedLanguage } from '../types';
import { QUADRANTS } from '../data/emotionsData';
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
  const quadrant = QUADRANTS[record.quadrantId];
  const quadrantName = quadrant.translations[language] || quadrant.translations.en;

  const quadEmoji =
    record.quadrantId === 'high_unpleasant'
      ? '🔴'
      : record.quadrantId === 'high_pleasant'
      ? '🟡'
      : record.quadrantId === 'low_unpleasant'
      ? '🔵'
      : '🟢';

  let text = '';
  if (language === 'ru') {
    text = `✨ Мой чекин чувств: ${emotionDisplay} ${quadEmoji} (${quadrantName})\n`;
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
    text += `\n🌱 Отправлено из «Как я?» — Трекер чувств и настроения`;
  } else {
    text = `✨ My Feeling Check-in: ${emotionDisplay} ${quadEmoji} (${quadrantName})\n`;
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
    text += `\n🌱 Sent from "How Am I?" — Mood & Feelings Tracker`;
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
