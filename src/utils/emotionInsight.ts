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

  // Construct coherent synthesized psychological narrative
  let narrative = '';
  if (items.length === 1) {
    const it = items[0];
    narrative = isRu
      ? `«${it.name}»: ${it.definition}`
      : `"${it.name}": ${it.definition}`;
  } else if (items.length === 2) {
    const it1 = items[0];
    const it2 = items[1];
    narrative = isRu
      ? `Комбинация чувств: светлое ощущение «${it1.name}» соединяется с переживанием «${it2.name}». Это отражает многогранное состояние, когда в теле и мыслях сплетаются разные потоки энергии.`
      : `Combination of feelings: experiencing "${it1.name}" alongside "${it2.name}". This shows emotional complexity where different energy dynamics coexist.`;
  } else {
    const it1 = items[0];
    const it2 = items[1];
    const it3 = items[2];
    narrative = isRu
      ? `Глубокая комбинация чувств: переплетение «${it1.name}», «${it2.name}» и «${it3.name}». Внутренний мир вмещает контрастные оттенки энергии, помогая тонко и бережно прочувствовать текущий момент.`
      : `Rich combination of feelings: blending "${it1.name}", "${it2.name}", and "${it3.name}". Your internal state reflects subtle emotional granularity across diverse spectrums.`;
  }

  return { items, narrative };
}
