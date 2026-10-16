import { EMOTIONS, QUADRANTS } from '../data/emotionsData';
import { QuadrantId, SupportedLanguage } from '../types';

export interface EmotionInsightItem {
  id: string;
  name: string;
  quadrantId: QuadrantId;
  definition: string;
  quadrantName: string;
  color: string;
}

export interface EmotionInsightResult {
  items: EmotionInsightItem[];
  narrative: string;
}

/**
 * Builds psychological insights and synthesizes a coherent narrative for single or multiple emotions
 */
export function getEmotionsInsight(
  emotions: Array<{ id?: string; name?: string; quadrantId?: string; intensity?: number }>,
  language: SupportedLanguage = 'ru'
): EmotionInsightResult {
  const isRu = language === 'ru';
  if (!emotions || emotions.length === 0) {
    return {
      items: [],
      narrative: isRu
        ? 'Чувства помогают нам бережно ориентироваться в своём внутреннем состоянии.'
        : 'Feelings help us navigate our internal state.',
    };
  }

  const items: EmotionInsightItem[] = emotions.map((em) => {
    const rawId = (em.id || '').toLowerCase();
    const rawName = (em.name || '').toLowerCase();

    // Look up in 144 EMOTIONS taxonomy
    const found = EMOTIONS.find(
      (e) =>
        e.id.toLowerCase() === rawId ||
        e.ru.name.toLowerCase() === rawName ||
        e.en.name.toLowerCase() === rawName
    );

    const quadId = ((em.quadrantId || found?.quadrant || 'low_pleasant') as QuadrantId);
    const quad = QUADRANTS[quadId];
    const name = isRu ? (found?.ru.name || em.name || rawId) : (found?.en.name || em.name || rawId);
    const definition = isRu
      ? (found?.ru.definition || 'Состояние эмоционального переживания и внутреннего отклика.')
      : (found?.en.definition || 'An emotional state reflecting your inner experience.');

    return {
      id: found?.id || rawId,
      name,
      quadrantId: quadId,
      definition,
      quadrantName: (isRu ? quad?.translations?.ru : quad?.translations?.en) || quadId,
      color: quad?.color_hex || '#4FD1C5',
    };
  });

  // Construct coherent synthesized psychological narrative (only when 2+ emotions exist)
  let narrative = '';
  if (items.length === 1) {
    // When only 1 emotion is chosen, do not repeat the definition in narrative header
    narrative = '';
  } else if (items.length === 2) {
    const it1 = items[0];
    const it2 = items[1];
    narrative = isRu
      ? `Сочетание чувств «${it1.name}» и «${it2.name}»: объединяет разные оттенки состояния в сбалансированный эмоциональный фон.`
      : `Combining "${it1.name}" and "${it2.name}": reflects subtle nuances across different energy levels.`;
  } else {
    const it1 = items[0];
    const it2 = items[1];
    const it3 = items[2];
    narrative = isRu
      ? `Многогранное состояние («${it1.name}», «${it2.name}», «${it3.name}»): одновременное проживание нескольких чувств помогает точнее распознать свои потребности.`
      : `Multi-layered state ("${it1.name}", "${it2.name}", "${it3.name}"): recognizing multiple emotions helps identify your current needs.`;
  }

  return { items, narrative };
}
