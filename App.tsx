import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Line } from 'react-native-svg';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CheckInRecord } from './src/types';
import { getCheckIns } from './src/storage/checkInStorage';
import { fetchUserCheckinsApi } from './src/services/api';
import { HomeScreen } from './src/screens/HomeScreen';
import { JournalScreen } from './src/screens/JournalScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { TrendsScreen } from './src/screens/TrendsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CheckInModal } from './src/screens/CheckInModal';
import { triggerHaptic } from './src/utils/haptics';

type TabKey = 'today' | 'journal' | 'friends' | 'trends' | 'settings';

function MainApp() {
  const { t } = useLanguage();
  const { user, isAuthenticated, refreshFeed, broadcastCheckinToChat } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentTab, setCurrentTab] = useState<TabKey>('today');
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [isCheckInOpen, setIsCheckInOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        const stored = await getCheckIns();
        setCheckIns(stored);
      } catch (e) {
        console.error('Failed to load check-ins', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // When user is authenticated, sync check-ins from cloud to ensure complete history
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserCheckinsApi().then((cloudItems) => {
        if (cloudItems && cloudItems.length > 0) {
          setCheckIns((prev) => {
            const cloudRecords: CheckInRecord[] = cloudItems.map((c) => ({
              id: c.local_id || c.id,
              timestamp: c.created_at,
              emotionId: c.emotion_id,
              emotionName: c.emotion_name_ru || c.emotion_id,
              quadrantId: c.quadrant,
              energy: c.energy,
              pleasantness: c.pleasantness,
              intensity: c.intensity || 2,
              emotions: c.emotions && c.emotions.length > 0
                ? c.emotions
                : [
                    {
                      id: c.emotion_id,
                      name: c.emotion_name_ru || c.emotion_id,
                      quadrantId: c.quadrant,
                      intensity: c.intensity || 2,
                    },
                  ],
              context: {
                people: Array.isArray(c.context_people) ? c.context_people : [],
                location: Array.isArray(c.context_place) ? c.context_place : [],
                activity: Array.isArray(c.context_activity) ? c.context_activity : [],
              },
              note: c.note || '',
            }));

            const existingIds = new Set(prev.map((r) => r.id));
            const newFromCloud = cloudRecords.filter((r) => !existingIds.has(r.id));
            if (newFromCloud.length === 0) return prev;

            const merged = [...newFromCloud, ...prev].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            AsyncStorage.setItem('@how_we_feel_checkins_v1', JSON.stringify(merged)).catch(() => {});
            return merged;
          });
        }
      }).catch((e) => console.log('[APP] Cloud checkins fetch skip:', e));
    }
  }, [isAuthenticated, user?.id]);

  // Sync tab with URL hash on Web (#today, #friends, #journal, etc.)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleHashChange = () => {
        const raw = window.location.hash.replace('#', '').toLowerCase();
        const validTabs: Record<string, TabKey> = {
          today: 'today',
          journal: 'journal',
          friends: 'friends',
          blizkie: 'friends',
          trends: 'trends',
          settings: 'settings',
        };
        if (validTabs[raw]) {
          setCurrentTab(validTabs[raw]);
        }
      };
      handleHashChange();
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);

  const handleTabChange = (tab: TabKey) => {
    triggerHaptic('light');
    setCurrentTab(tab);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      window.location.hash = tab;
    }
  };

  const handleNewCheckInSaved = (record: CheckInRecord) => {
    setCheckIns((prev) => [record, ...prev]);
    broadcastCheckinToChat(record);
    // Immediately refresh partner feed and chats so checkin appears in chat
    setTimeout(() => {
      refreshFeed();
    }, 400);
    setTimeout(() => {
      refreshFeed();
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {currentTab === 'today' && (
          <HomeScreen
            checkIns={checkIns}
            onOpenCheckIn={() => setIsCheckInOpen(true)}
          />
        )}
        {currentTab === 'journal' && (
          <JournalScreen
            checkIns={checkIns}
            onCheckInsUpdated={setCheckIns}
          />
        )}
        {currentTab === 'friends' && (
          <FriendsScreen
            latestCheckIn={checkIns[0]}
            onOpenCheckIn={() => setIsCheckInOpen(true)}
          />
        )}
        {currentTab === 'trends' && <TrendsScreen checkIns={checkIns} />}
        {currentTab === 'settings' && (
          <SettingsScreen onCheckInsUpdated={setCheckIns} />
        )}
      </View>

      {/* Check In Modal */}
      <CheckInModal
        visible={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onCheckInSaved={handleNewCheckInSaved}
      />

      {/* Bottom Tab Bar */}
      <View
        nativeID="bottom-tab-bar"
        accessibilityRole="navigation"
        style={[
          styles.tabBar,
          {
            paddingBottom: Platform.select({
              ios: Math.max(12, insets.bottom),
              android: Math.max(6, insets.bottom),
              web: Math.max(12, insets.bottom || 0),
              default: 10,
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('today')}
          accessibilityLabel={t('tab.today')}
          activeOpacity={0.75}
        >
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Line
              x1="5"
              y1="14"
              x2="23"
              y2="14"
              stroke={currentTab === 'today' ? '#4FD1C5' : '#718096'}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
            <Line
              x1="14"
              y1="5"
              x2="14"
              y2="23"
              stroke={currentTab === 'today' ? '#4FD1C5' : '#718096'}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('journal')}
          accessibilityLabel={t('tab.journal')}
          activeOpacity={0.75}
        >
          <Ionicons
            name={currentTab === 'journal' ? 'book' : 'book-outline'}
            size={25}
            color={currentTab === 'journal' ? '#4FD1C5' : '#718096'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('friends')}
          accessibilityLabel={t('tab.friends')}
          activeOpacity={0.75}
        >
          <Ionicons
            name={currentTab === 'friends' ? 'people' : 'people-outline'}
            size={25}
            color={currentTab === 'friends' ? '#4FD1C5' : '#718096'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('trends')}
          accessibilityLabel={t('tab.trends')}
          activeOpacity={0.75}
        >
          <Ionicons
            name={currentTab === 'trends' ? 'pie-chart' : 'pie-chart-outline'}
            size={25}
            color={currentTab === 'trends' ? '#4FD1C5' : '#718096'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('settings')}
          accessibilityLabel={t('tab.settings')}
          activeOpacity={0.75}
        >
          <Ionicons
            name={currentTab === 'settings' ? 'settings' : 'settings-outline'}
            size={25}
            color={currentTab === 'settings' ? '#4FD1C5' : '#718096'}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#11151C',
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  quickAddButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2B6CB0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#2B6CB0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
});
