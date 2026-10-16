import React, { useState, useMemo } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Line,
  Text as SvgText,
  Circle,
  G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord, QuadrantId } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { getLocalizedEmotionName, getLocalizedContextTag } from '../utils/localizationHelper';
import { triggerHaptic } from '../utils/haptics';

export type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all';

interface TrendsScreenProps {
  checkIns: CheckInRecord[];
}

interface TimeBucket {
  label: string;
  fullDate: string;
  green: number;  // low_pleasant
  blue: number;   // low_unpleasant
  yellow: number; // high_pleasant
  red: number;    // high_unpleasant
  total: number;
}

// Cubic Bézier spline helper for buttery smooth curves
function getCubicSplinePath(points: { x: number; y: number }[], baselineY?: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const tension = 0.22;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    let cp1x = p1.x + (p2.x - p0.x) * tension;
    let cp1y = p1.y + (p2.y - p0.y) * tension;
    let cp2x = p2.x - (p3.x - p1.x) * tension;
    let cp2y = p2.y - (p3.y - p1.y) * tension;

    if (baselineY !== undefined) {
      if (Math.abs(p1.y - baselineY) < 0.5 && Math.abs(p2.y - baselineY) < 0.5) {
        cp1y = baselineY;
        cp2y = baselineY;
      } else {
        cp1y = Math.min(baselineY, cp1y);
        cp2y = Math.min(baselineY, cp2y);
      }
    }

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Build closed polygon path between top and bottom curve
function buildStackedAreaPath(
  topPoints: { x: number; y: number }[],
  bottomPoints: { x: number; y: number }[],
  baselineY?: number
): string {
  if (topPoints.length === 0 || bottomPoints.length === 0) return '';
  const topPath = getCubicSplinePath(topPoints, baselineY);
  const reversedBottom = [...bottomPoints].reverse();

  let bottomPath = '';
  const tension = 0.22;
  for (let i = 0; i < reversedBottom.length - 1; i++) {
    const p0 = i > 0 ? reversedBottom[i - 1] : reversedBottom[i];
    const p1 = reversedBottom[i];
    const p2 = reversedBottom[i + 1];
    const p3 = i < reversedBottom.length - 2 ? reversedBottom[i + 2] : p2;

    let cp1x = p1.x + (p2.x - p0.x) * tension;
    let cp1y = p1.y + (p2.y - p0.y) * tension;
    let cp2x = p2.x - (p3.x - p1.x) * tension;
    let cp2y = p2.y - (p3.y - p1.y) * tension;

    if (baselineY !== undefined) {
      if (Math.abs(p1.y - baselineY) < 0.5 && Math.abs(p2.y - baselineY) < 0.5) {
        cp1y = baselineY;
        cp2y = baselineY;
      } else {
        cp1y = Math.min(baselineY, cp1y);
        cp2y = Math.min(baselineY, cp2y);
      }
    }

    bottomPath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return `${topPath} L ${reversedBottom[0].x.toFixed(1)} ${reversedBottom[0].y.toFixed(1)} ${bottomPath} Z`;
}

export const TrendsScreen: React.FC<TrendsScreenProps> = ({ checkIns }) => {
  const { language, t } = useLanguage();
  const isRu = language === 'ru';

  // Period dropdown state (default is 'week' as requested)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Copy toast state
  const [isCopiedToast, setIsCopiedToast] = useState(false);

  // Responsive chart width
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 40, 560);
  const chartHeight = 220;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 32;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;

  // Filter check-ins based on selected period
  const filteredCheckIns = useMemo(() => {
    if (!checkIns || checkIns.length === 0) return [];
    const now = new Date().getTime();

    return checkIns.filter((item) => {
      const itemTime = new Date(item.timestamp).getTime();
      const diffMs = now - itemTime;

      switch (selectedPeriod) {
        case 'day':
          // Last 24 hours
          return diffMs <= 24 * 60 * 60 * 1000;
        case 'week':
          // Last 7 days (default)
          return diffMs <= 7 * 24 * 60 * 60 * 1000;
        case 'month':
          // Last 30 days
          return diffMs <= 30 * 24 * 60 * 60 * 1000;
        case 'year':
          // Last 365 days
          return diffMs <= 365 * 24 * 60 * 60 * 1000;
        case 'all':
        default:
          return true;
      }
    });
  }, [checkIns, selectedPeriod]);

  // Aggregate stats for filtered checkins
  const total = filteredCheckIns.length;

  const quadrantCounts: Record<QuadrantId, number> = useMemo(() => {
    const counts: Record<QuadrantId, number> = {
      high_unpleasant: 0,
      high_pleasant: 0,
      low_unpleasant: 0,
      low_pleasant: 0,
    };
    filteredCheckIns.forEach((item) => {
      const qId = item.quadrantId || 'low_pleasant';
      if (counts[qId] !== undefined) {
        counts[qId]++;
      }
    });
    return counts;
  }, [filteredCheckIns]);

  const emotionFrequency = useMemo(() => {
    const freq: Record<string, { count: number; id: string; name: string; quadrantId: QuadrantId }> = {};
    filteredCheckIns.forEach((item) => {
      const qId = item.quadrantId || 'low_pleasant';
      if (item.emotions && item.emotions.length > 0) {
        item.emotions.forEach((e) => {
          if (!freq[e.id]) {
            freq[e.id] = { count: 0, id: e.id, name: e.name, quadrantId: qId };
          }
          freq[e.id].count++;
        });
      } else {
        const id = item.emotionId;
        if (!freq[id]) {
          freq[id] = { count: 0, id, name: item.emotionName || id, quadrantId: qId };
        }
        freq[id].count++;
      }
    });
    return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredCheckIns]);

  const contextFrequency = useMemo(() => {
    const freq: Record<string, number> = {};
    filteredCheckIns.forEach((item) => {
      if (item.context) {
        [
          ...(item.context.people || []),
          ...(item.context.location || []),
          ...(item.context.activity || []),
        ].forEach((tag) => {
          freq[tag] = (freq[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredCheckIns]);

  // Build time buckets for the Stacked Area Chart
  const buckets: TimeBucket[] = useMemo(() => {
    const now = new Date();

    if (selectedPeriod === 'day') {
      // 6 buckets of 4 hours each (24h)
      const list: TimeBucket[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        const label = `${String(d.getHours()).padStart(2, '0')}:00`;
        list.push({
          label,
          fullDate: d.toLocaleString(),
          green: 0,
          blue: 0,
          yellow: 0,
          red: 0,
          total: 0,
        });
      }

      filteredCheckIns.forEach((item) => {
        const t = new Date(item.timestamp).getTime();
        const diffHours = (now.getTime() - t) / (1000 * 60 * 60);
        const bucketIdx = Math.max(0, Math.min(5, 5 - Math.floor(diffHours / 4)));
        const qId = item.quadrantId || 'low_pleasant';
        if (qId === 'low_pleasant') list[bucketIdx].green++;
        else if (qId === 'low_unpleasant') list[bucketIdx].blue++;
        else if (qId === 'high_pleasant') list[bucketIdx].yellow++;
        else if (qId === 'high_unpleasant') list[bucketIdx].red++;
        list[bucketIdx].total++;
      });
      return list;
    }

    if (selectedPeriod === 'week') {
      // 7 days (Пн, Вт, Ср, Чт, Пт, Сб, Вс or dates)
      const list: TimeBucket[] = [];
      const dayNamesRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayOfWeek = d.getDay();
        const name = isRu ? dayNamesRu[dayOfWeek] : dayNamesEn[dayOfWeek];
        const dateNum = d.getDate();
        list.push({
          label: `${name} ${dateNum}`,
          fullDate: d.toLocaleDateString(),
          green: 0,
          blue: 0,
          yellow: 0,
          red: 0,
          total: 0,
        });
      }

      filteredCheckIns.forEach((item) => {
        const t = new Date(item.timestamp);
        const diffDays = Math.floor(
          (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
            new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const bucketIdx = Math.max(0, Math.min(6, 6 - diffDays));
        const qId = item.quadrantId || 'low_pleasant';
        if (qId === 'low_pleasant') list[bucketIdx].green++;
        else if (qId === 'low_unpleasant') list[bucketIdx].blue++;
        else if (qId === 'high_pleasant') list[bucketIdx].yellow++;
        else if (qId === 'high_unpleasant') list[bucketIdx].red++;
        list[bucketIdx].total++;
      });
      return list;
    }

    if (selectedPeriod === 'month') {
      // 5 intervals of 6 days each
      const list: TimeBucket[] = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 6 * 24 * 60 * 60 * 1000);
        list.push({
          label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
          fullDate: d.toLocaleDateString(),
          green: 0,
          blue: 0,
          yellow: 0,
          red: 0,
          total: 0,
        });
      }

      filteredCheckIns.forEach((item) => {
        const diffDays = (now.getTime() - new Date(item.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        const bucketIdx = Math.max(0, Math.min(4, 4 - Math.floor(diffDays / 6)));
        const qId = item.quadrantId || 'low_pleasant';
        if (qId === 'low_pleasant') list[bucketIdx].green++;
        else if (qId === 'low_unpleasant') list[bucketIdx].blue++;
        else if (qId === 'high_pleasant') list[bucketIdx].yellow++;
        else if (qId === 'high_unpleasant') list[bucketIdx].red++;
        list[bucketIdx].total++;
      });
      return list;
    }

    if (selectedPeriod === 'year') {
      // 12 months
      const list: TimeBucket[] = [];
      const monthNamesRu = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
      const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const name = isRu ? monthNamesRu[d.getMonth()] : monthNamesEn[d.getMonth()];
        list.push({
          label: name,
          fullDate: `${name} ${d.getFullYear()}`,
          green: 0,
          blue: 0,
          yellow: 0,
          red: 0,
          total: 0,
        });
      }

      filteredCheckIns.forEach((item) => {
        const t = new Date(item.timestamp);
        const diffMonths = (now.getFullYear() - t.getFullYear()) * 12 + (now.getMonth() - t.getMonth());
        const bucketIdx = Math.max(0, Math.min(11, 11 - diffMonths));
        const qId = item.quadrantId || 'low_pleasant';
        if (qId === 'low_pleasant') list[bucketIdx].green++;
        else if (qId === 'low_unpleasant') list[bucketIdx].blue++;
        else if (qId === 'high_pleasant') list[bucketIdx].yellow++;
        else if (qId === 'high_unpleasant') list[bucketIdx].red++;
        list[bucketIdx].total++;
      });
      return list;
    }

    // 'all'
    const list: TimeBucket[] = [];
    const countBuckets = 6;
    for (let i = countBuckets - 1; i >= 0; i--) {
      list.push({
        label: `T-${i}`,
        fullDate: `Period ${countBuckets - i}`,
        green: 0,
        blue: 0,
        yellow: 0,
        red: 0,
        total: 0,
      });
    }

    filteredCheckIns.forEach((item, idx) => {
      const bucketIdx = Math.min(countBuckets - 1, Math.floor((idx / Math.max(1, filteredCheckIns.length)) * countBuckets));
      const qId = item.quadrantId || 'low_pleasant';
      if (qId === 'low_pleasant') list[bucketIdx].green++;
      else if (qId === 'low_unpleasant') list[bucketIdx].blue++;
      else if (qId === 'high_pleasant') list[bucketIdx].yellow++;
      else if (qId === 'high_unpleasant') list[bucketIdx].red++;
      list[bucketIdx].total++;
    });
    return list;
  }, [filteredCheckIns, selectedPeriod, isRu]);

  // Compute points and paths for the Stacked Area Chart
  const chartData = useMemo(() => {
    const numBuckets = buckets.length;
    const maxVal = Math.max(...buckets.map((b) => b.total), 4);

    const basePoints: { x: number; y: number }[] = [];
    const greenPoints: { x: number; y: number }[] = [];
    const bluePoints: { x: number; y: number }[] = [];
    const yellowPoints: { x: number; y: number }[] = [];
    const redPoints: { x: number; y: number }[] = [];

    buckets.forEach((b, i) => {
      const x = paddingLeft + (i / Math.max(1, numBuckets - 1)) * plotWidth;

      // Base line
      basePoints.push({ x, y: baselineY });

      // Green layer (bottom)
      const greenH = (b.green / maxVal) * plotHeight;
      const greenY = baselineY - greenH;
      greenPoints.push({ x, y: greenY });

      // Blue layer (stacked on green)
      const blueH = (b.blue / maxVal) * plotHeight;
      const blueY = greenY - blueH;
      bluePoints.push({ x, y: blueY });

      // Yellow layer (stacked on blue)
      const yellowH = (b.yellow / maxVal) * plotHeight;
      const yellowY = blueY - yellowH;
      yellowPoints.push({ x, y: yellowY });

      // Red layer (stacked on yellow)
      const redH = (b.red / maxVal) * plotHeight;
      const redY = yellowY - redH;
      redPoints.push({ x, y: redY });
    });

    return {
      maxVal,
      greenArea: buildStackedAreaPath(greenPoints, basePoints, baselineY),
      blueArea: buildStackedAreaPath(bluePoints, greenPoints, baselineY),
      yellowArea: buildStackedAreaPath(yellowPoints, bluePoints, baselineY),
      redArea: buildStackedAreaPath(redPoints, yellowPoints, baselineY),
      greenLine: getCubicSplinePath(greenPoints, baselineY),
      blueLine: getCubicSplinePath(bluePoints, baselineY),
      yellowLine: getCubicSplinePath(yellowPoints, baselineY),
      redLine: getCubicSplinePath(redPoints, baselineY),
      topPoints: redPoints,
    };
  }, [buckets, baselineY, plotHeight, plotWidth, paddingLeft]);

  // Copy structured report to clipboard for Psychologist or AI
  const handleCopyPsychologistReport = async () => {
    triggerHaptic('medium');
    const periodTitles: Record<TimePeriod, string> = {
      day: isRu ? 'Сутки (24 часа)' : 'Past 24 Hours',
      week: isRu ? 'Неделя (последние 7 дней)' : 'Past Week (7 Days)',
      month: isRu ? 'Месяц (последние 30 дней)' : 'Past Month (30 Days)',
      year: isRu ? 'Год (последние 365 дней)' : 'Past Year',
      all: isRu ? 'Всё время наблюдений' : 'All Recorded History',
    };

    const quadrantTitlesRu: Record<QuadrantId, string> = {
      high_unpleasant: 'Красный (Высокая энергия, неприятно)',
      high_pleasant: 'Жёлтый (Высокая энергия, приятно)',
      low_unpleasant: 'Синий (Низкая энергия, неприятно)',
      low_pleasant: 'Зелёный (Низкая энергия, приятно)',
    };

    let report = `# 📋 Отчёт об эмоциональном состоянии («Как я?» / Yale Mood Meter)\n`;
    report += `**Период анализа:** ${periodTitles[selectedPeriod]}\n`;
    report += `**Всего чекинов:** ${total}\n`;
    report += `**Дата формирования отчёта:** ${new Date().toLocaleString()}\n\n`;

    report += `## 📊 Распределение по 4 квадрантам:\n`;
    (['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'] as QuadrantId[]).forEach(
      (qId) => {
        const count = quadrantCounts[qId];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        report += `- ${quadrantTitlesRu[qId]}: ${count} (${pct}%)\n`;
      }
    );

    report += `\n---\n\n`;
    report += `## 🧠 Методологический контекст и промпт для анализа (Психологу / ИИ):\n`;
    report += `Данные собраны по методике Йельского центра эмоционального интеллекта (Marc Brackett, Ph.D. / Yale Mood Meter).\n`;
    report += `Эмоциональное состояние оценивается по двум базовым нейробиологическим шкалам:\n`;
    report += `1. Энергия (физиологическая активация: от глубокого покоя -5 до высокого возбуждения +5).\n`;
    report += `2. Приятность (субъективная валентность: от дискомфорта/боли -5 до радости/удовольствия +5).\n\n`;
    report += `**4 квадранта:**\n`;
    report += `• 🔴 Красный: мобилизация при стрессе, тревоге, злости, нарушении границ.\n`;
    report += `• 🟡 Жёлтый: прилив сил, творчество, воодушевление, радость, открытость.\n`;
    report += `• 🔵 Синий: замедление, грусть, усталость, необходимость восстановления и переоценки.\n`;
    report += `• 🟢 Зелёный: парасимпатическое спокойствие, благодарность, умиротворение, баланс.\n\n`;

    report += `**Запрос на глубокий анализ:**\n`;
    report += `Пожалуйста, изучите приведённый хронологический журнал чекинов:\n`;
    report += `1. Каковы преобладающие паттерны настроения и динамика энергии в течение выбранного периода?\n`;
    report += `2. В какие моменты происходят резкие смещения между квадрантами (например, с жёлтого/зелёного в красный/синий), и какие триггеры (люди, место, дела, заметки) прослеживаются?\n`;
    report += `3. Сформулируйте 2-3 бережные, научно обоснованные рекомендации по саморегуляции и восстановлению ресурса.\n\n`;

    report += `\n---\n\n`;
    report += `## 📝 Хронологический лог чекинов:\n`;

    if (filteredCheckIns.length === 0) {
      report += `За выбранный период чекинов не найдено.\n`;
    } else {
      filteredCheckIns.forEach((item, idx) => {
        const d = new Date(item.timestamp);
        const timeStr = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const qTitle = quadrantTitlesRu[item.quadrantId] || item.quadrantId;
        const emotionList =
          item.emotions && item.emotions.length > 0
            ? item.emotions.map((e) => e.name).join(', ')
            : item.emotionName || item.emotionId;

        const people = item.context?.people?.length ? `Люди: ${item.context.people.join(', ')}` : '';
        const place = item.context?.location?.length ? `Место: ${item.context.location.join(', ')}` : '';
        const act = item.context?.activity?.length ? `Дела: ${item.context.activity.join(', ')}` : '';
        const contextStr = [people, place, act].filter(Boolean).join(' | ');

        const noteText =
          item.note && !item.note.toLowerCase().startsWith('отметил')
            ? ` | Заметка: «${item.note.trim()}»`
            : '';

        report += `${idx + 1}. [${timeStr}] ${qTitle}\n   Чувства: ${emotionList}${contextStr ? ` | ${contextStr}` : ''}${noteText}\n\n`;
      });
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(report);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 3000);
    } else {
      Alert.alert(
        isRu ? 'Отчёт скопирован' : 'Report Copied',
        isRu ? 'Текст отчёта готов для отправки вашему психологу или ИИ!' : 'Report is ready to paste to psychologist or AI!'
      );
    }
  };

  const periodLabels: Record<TimePeriod, { ru: string; en: string }> = {
    day: { ru: 'День (24ч)', en: 'Day (24h)' },
    week: { ru: 'Неделя (7 дней)', en: 'Week (7 days)' },
    month: { ru: 'Месяц (30 дней)', en: 'Month (30 days)' },
    year: { ru: 'Год (365 дней)', en: 'Year (365 days)' },
    all: { ru: 'Всё время', en: 'All Time' },
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Toast Notification */}
      {isCopiedToast && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#4FD1C5" />
          <Text style={styles.toastText}>
            {isRu ? 'Отчёт для психолога или ИИ скопирован в буфер обмена!' : 'Report copied to clipboard!'}
          </Text>
        </View>
      )}

      {/* Screen Header with Title & Period Selector Dropdown */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.title}>{t('trends.title')}</Text>
            <Text style={styles.subtitle}>
              {isRu ? 'Динамика энергии и приятности' : 'Energy & Pleasantness dynamics'}
            </Text>
          </View>
        </View>

        {/* 1. PERIOD SELECTOR DROPDOWN (DEFAULT = WEEK) */}
        <View style={styles.periodDropdownWrapper}>
          <TouchableOpacity
            style={styles.periodDropdownButton}
            onPress={() => {
              triggerHaptic('light');
              setIsPeriodDropdownOpen(!isPeriodDropdownOpen);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.periodBtnLeft}>
              <Ionicons name="calendar-outline" size={16} color="#4FD1C5" />
              <Text style={styles.periodBtnLabel}>
                {isRu ? 'Период:' : 'Period:'}{' '}
                <Text style={styles.periodBtnActiveText}>
                  {isRu ? periodLabels[selectedPeriod].ru : periodLabels[selectedPeriod].en}
                </Text>
              </Text>
            </View>
            <Ionicons
              name={isPeriodDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#A0AEC0"
            />
          </TouchableOpacity>

          {isPeriodDropdownOpen && (
            <View style={styles.periodMenu}>
              {(['day', 'week', 'month', 'year', 'all'] as TimePeriod[]).map((pKey) => {
                const isActive = selectedPeriod === pKey;
                const label = isRu ? periodLabels[pKey].ru : periodLabels[pKey].en;
                return (
                  <TouchableOpacity
                    key={pKey}
                    style={[styles.periodMenuItem, isActive && styles.periodMenuItemActive]}
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedPeriod(pKey);
                      setIsPeriodDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.periodMenuText, isActive && styles.periodMenuTextActive]}>
                      {label}
                      {pKey === 'week' ? (isRu ? ' (по умолч.)' : ' (default)') : ''}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={16} color="#4FD1C5" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Total Stat Box */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryInnerRow}>
          <View>
            <Text style={styles.summaryNumber}>{total}</Text>
            <Text style={styles.summaryLabel}>
              {isRu ? 'Чекинов за выбранный период' : 'Check-ins in selected period'}
            </Text>
          </View>
          <View style={styles.summaryBadge}>
            <Ionicons name="pulse" size={20} color="#4FD1C5" />
          </View>
        </View>
      </View>

      {/* 2. SMOOTH STACKED AREA CHART (BÉZIER SPLINE CURVES) */}
      <View style={styles.card}>
        <View style={styles.chartHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>
              {isRu ? 'Карта динамики настроения' : 'Mood Dynamics Area Chart'}
            </Text>
            <Text style={styles.chartSubtitle}>
              {isRu
                ? 'Смягчённый срез чекинов по 4 цветам квадрантов'
                : 'Smoothed stacked area chart across 4 quadrants'}
            </Text>
          </View>
        </View>

        {total === 0 ? (
          <View style={styles.emptyChartBox}>
            <Ionicons name="bar-chart-outline" size={36} color="#4A5568" />
            <Text style={styles.emptyChartText}>
              {isRu
                ? 'Нет чекинов за этот период.\nСделайте чекин или выберите другой период вверху!'
                : 'No check-ins in this period.\nLog a check-in or choose another period above!'}
            </Text>
          </View>
        ) : (
          <View style={styles.svgWrapper}>
            <Svg width={chartWidth} height={chartHeight}>
              <Defs>
                {/* Red Gradient */}
                <LinearGradient id="grad_red" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#EF4444" stopOpacity="0.8" />
                  <Stop offset="1" stopColor="#EF4444" stopOpacity="0.25" />
                </LinearGradient>

                {/* Yellow Gradient */}
                <LinearGradient id="grad_yellow" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.8" />
                  <Stop offset="1" stopColor="#F59E0B" stopOpacity="0.25" />
                </LinearGradient>

                {/* Blue Gradient */}
                <LinearGradient id="grad_blue" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.8" />
                  <Stop offset="1" stopColor="#3B82F6" stopOpacity="0.25" />
                </LinearGradient>

                {/* Green Gradient */}
                <LinearGradient id="grad_green" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#10B981" stopOpacity="0.8" />
                  <Stop offset="1" stopColor="#10B981" stopOpacity="0.25" />
                </LinearGradient>
              </Defs>

              {/* Grid Lines */}
              <Line
                x1={paddingLeft}
                y1={paddingTop}
                x2={chartWidth - paddingRight}
                y2={paddingTop}
                stroke="#1E293B"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Line
                x1={paddingLeft}
                y1={paddingTop + plotHeight / 2}
                x2={chartWidth - paddingRight}
                y2={paddingTop + plotHeight / 2}
                stroke="#1E293B"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Line
                x1={paddingLeft}
                y1={baselineY}
                x2={chartWidth - paddingRight}
                y2={baselineY}
                stroke="#2D3748"
                strokeWidth={1.5}
              />

              {/* Y Axis Max Label */}
              <SvgText
                x={paddingLeft - 6}
                y={paddingTop + 4}
                fill="#718096"
                fontSize={10}
                textAnchor="end"
                fontWeight="600"
              >
                {chartData.maxVal}
              </SvgText>

              {/* Y Axis Mid Label */}
              <SvgText
                x={paddingLeft - 6}
                y={paddingTop + plotHeight / 2 + 4}
                fill="#718096"
                fontSize={10}
                textAnchor="end"
                fontWeight="600"
              >
                {Math.round(chartData.maxVal / 2)}
              </SvgText>

              {/* Y Axis Zero Label */}
              <SvgText
                x={paddingLeft - 6}
                y={baselineY + 4}
                fill="#718096"
                fontSize={10}
                textAnchor="end"
                fontWeight="600"
              >
                0
              </SvgText>

              {/* 1. GREEN LAYER (LOW PLEASANT) */}
              <Path d={chartData.greenArea} fill="url(#grad_green)" />
              <Path
                d={chartData.greenLine}
                fill="none"
                stroke="#10B981"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* 2. BLUE LAYER (LOW UNPLEASANT) */}
              <Path d={chartData.blueArea} fill="url(#grad_blue)" />
              <Path
                d={chartData.blueLine}
                fill="none"
                stroke="#3B82F6"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* 3. YELLOW LAYER (HIGH PLEASANT) */}
              <Path d={chartData.yellowArea} fill="url(#grad_yellow)" />
              <Path
                d={chartData.yellowLine}
                fill="none"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* 4. RED LAYER (HIGH UNPLEASANT) */}
              <Path d={chartData.redArea} fill="url(#grad_red)" />
              <Path
                d={chartData.redLine}
                fill="none"
                stroke="#EF4444"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* X Axis Bucket Labels & Dots */}
              {buckets.map((b, i) => {
                const x = paddingLeft + (i / Math.max(1, buckets.length - 1)) * plotWidth;
                return (
                  <G key={`bucket_${i}`}>
                    {b.total > 0 && (
                      <Circle
                        cx={x}
                        cy={chartData.topPoints[i]?.y || baselineY}
                        r={3}
                        fill="#FFFFFF"
                      />
                    )}
                    <SvgText
                      x={x}
                      y={baselineY + 16}
                      fill="#8C9BAE"
                      fontSize={10}
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {b.label}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>

            {/* Quadrants Legend */}
            <View style={styles.chartLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>
                  {isRu ? 'Красный' : 'Red'} ({quadrantCounts.high_unpleasant})
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>
                  {isRu ? 'Жёлтый' : 'Yellow'} ({quadrantCounts.high_pleasant})
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.legendText}>
                  {isRu ? 'Синий' : 'Blue'} ({quadrantCounts.low_unpleasant})
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>
                  {isRu ? 'Зелёный' : 'Green'} ({quadrantCounts.low_pleasant})
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Quadrant Percentage Breakdown Progress Bars */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('trends.quadrantDistribution')}</Text>

        {(
          ['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'] as QuadrantId[]
        ).map((qId) => {
          const q = QUADRANTS[qId];
          const count = quadrantCounts[qId];
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
          const name = q.translations[language] || q.translations.en;

          return (
            <View key={qId} style={styles.distRow}>
              <View style={styles.distLabelRow}>
                <View style={[styles.colorDot, { backgroundColor: q.color_hex }]} />
                <Text style={styles.distName}>{name}</Text>
                <Text style={styles.distPercent}>
                  {percentage}% ({count})
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: q.color_hex,
                      width: `${Math.max(percentage, 2)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Top Feelings */}
      {emotionFrequency.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('trends.topEmotions')}</Text>
          <View style={styles.emotionsList}>
            {emotionFrequency.map((item, idx) => {
              const q = QUADRANTS[item.quadrantId] || QUADRANTS['low_pleasant'];
              const emotionTitle = getLocalizedEmotionName(item.id, item.name, language);
              return (
                <View key={idx} style={styles.topEmotionRow}>
                  <View style={styles.topEmotionLeft}>
                    <View style={[styles.colorDot, { backgroundColor: q.color_hex }]} />
                    <Text style={styles.topEmotionName}>{emotionTitle}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{item.count}x</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Frequent Contexts */}
      {contextFrequency.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('trends.contextInfluence')}</Text>
          <View style={styles.contextGrid}>
            {contextFrequency.map(([tag, count]) => (
              <View key={tag} style={styles.contextStatPill}>
                <Text style={styles.contextStatTag}>{getLocalizedContextTag(tag, language)}</Text>
                <Text style={styles.contextStatCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. BUTTON: COPY REPORT FOR PSYCHOLOGIST OR AI (СКОПИРОВАТЬ ДЛЯ ПСИХОЛОГА ИЛИ ИИ) */}
      <View style={styles.copyReportSection}>
        <TouchableOpacity
          style={styles.copyReportBtn}
          onPress={handleCopyPsychologistReport}
          activeOpacity={0.85}
        >
          <View style={styles.copyReportIconCircle}>
            <Ionicons name="sparkles" size={20} color="#0A0D12" />
          </View>
          <View style={styles.copyReportTextCol}>
            <Text style={styles.copyReportBtnTitle}>
              {isRu ? 'Скопировать отчёт для психолога или ИИ' : 'Copy Report for Psychologist or AI'}
            </Text>
            <Text style={styles.copyReportBtnSub}>
              {isRu
                ? 'Формирует сводку чекинов и научный промпт о методике'
                : 'Generates check-ins log and psychological analysis prompt'}
            </Text>
          </View>
          <Ionicons name="copy-outline" size={18} color="#4FD1C5" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  content: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 60,
  },
  toastBanner: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 99,
    backgroundColor: '#1E293B',
    borderColor: '#4FD1C5',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  header: {
    marginBottom: 20,
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#8C9BAE',
    fontSize: 14,
    marginTop: 4,
  },

  // Period Selector Dropdown
  periodDropdownWrapper: {
    position: 'relative',
    zIndex: 20,
  },
  periodDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141A22',
    borderWidth: 1.5,
    borderColor: '#222B36',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  periodBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodBtnLabel: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '500',
  },
  periodBtnActiveText: {
    color: '#4FD1C5',
    fontWeight: '700',
  },
  periodMenu: {
    marginTop: 6,
    backgroundColor: '#141A22',
    borderWidth: 1.5,
    borderColor: '#2D3748',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  periodMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  periodMenuItemActive: {
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
  },
  periodMenuText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  periodMenuTextActive: {
    color: '#4FD1C5',
    fontWeight: '700',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#141A22',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  summaryInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#8C9BAE',
    fontSize: 13,
    marginTop: 2,
  },
  summaryBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cards
  card: {
    backgroundColor: '#141A22',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  chartHeaderRow: {
    marginBottom: 14,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  chartSubtitle: {
    color: '#718096',
    fontSize: 12,
  },
  emptyChartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyChartText: {
    color: '#718096',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  svgWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A232F',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#CBD5E0',
    fontSize: 11,
    fontWeight: '600',
  },

  // Quadrant distribution progress bars
  distRow: {
    marginBottom: 14,
  },
  distLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  distName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  distPercent: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#1E2633',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Top Feelings
  emotionsList: {
    gap: 10,
  },
  topEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  topEmotionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topEmotionName: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: '#1E2633',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    color: '#8C9BAE',
    fontSize: 12,
    fontWeight: '600',
  },

  // Frequent Contexts
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A232F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263445',
    gap: 8,
  },
  contextStatTag: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  contextStatCount: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },

  // 3. COPY REPORT BUTTON SECTION
  copyReportSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  copyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141A22',
    borderWidth: 1.5,
    borderColor: '#4FD1C5',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#4FD1C5',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  copyReportIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyReportTextCol: {
    flex: 1,
  },
  copyReportBtnTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  copyReportBtnSub: {
    color: '#718096',
    fontSize: 12,
    marginTop: 2,
  },
});
