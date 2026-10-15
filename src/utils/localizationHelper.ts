import { EMOTIONS } from '../data/emotionsData';
import { CONTEXT_TAGS } from '../data/contextTags';
import { SupportedLanguage } from '../types';

export function getLocalizedEmotionName(
  emotionId: string,
  fallbackName: string,
  lang: SupportedLanguage
): string {
  const emotion = EMOTIONS.find((e) => e.id === emotionId);
  if (!emotion) return fallbackName;
  return lang === 'ru' ? emotion.ru.name : emotion.en.name;
}

export function getLocalizedContextTag(
  tagId: string,
  lang: SupportedLanguage
): string {
  const tag = CONTEXT_TAGS.find((t) => t.id === tagId);
  if (!tag) return tagId;
  return lang === 'ru' ? tag.ru : tag.en;
}
