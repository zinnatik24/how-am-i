import React from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { deleteCheckIn } from '../storage/checkInStorage';
import { softDeleteCheckInApi } from '../services/api';
import { triggerHaptic } from '../utils/haptics';
import { shareCheckIn } from '../utils/shareHelper';
import { CheckInCard } from '../components/CheckInCard';

interface JournalScreenProps {
  checkIns: CheckInRecord[];
  onCheckInsUpdated: (updated: CheckInRecord[]) => void;
}

export const JournalScreen: React.FC<JournalScreenProps> = ({
  checkIns,
  onCheckInsUpdated,
}) => {
  const { language, t } = useLanguage();

  // Exclude any legacy sample/demo entries
  const realCheckIns = checkIns.filter((c) => !c.id.startsWith('demo-'));

  const handleDelete = (id: string) => {
    const confirmDelete = async () => {
      triggerHaptic('medium');
      // Soft-delete on cloud so data is never permanently lost
      softDeleteCheckInApi(id).catch(() => {});
      const updated = await deleteCheckIn(id);
      onCheckInsUpdated(updated);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('journal.deleteConfirm'))) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        t('journal.delete'),
        t('journal.deleteConfirm'),
        [
          { text: t('journal.cancel'), style: 'cancel' },
          { text: t('journal.delete'), style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const renderItem = ({ item }: { item: CheckInRecord }) => {
    return (
      <CheckInCard
        record={item}
        language={language}
        onDelete={handleDelete}
        onShare={(rec) => shareCheckIn(rec, language)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('journal.title')}</Text>
        <Text style={styles.subtitle}>{t('journal.subtitle')}</Text>
      </View>

      {realCheckIns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color="#4A5568" />
          <Text style={styles.emptyTitle}>{t('journal.empty')}</Text>
          <Text style={styles.emptySubtitle}>{t('journal.emptySubtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={realCheckIns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8C9BAE',
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 60,
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#718096',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
