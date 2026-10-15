import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { AuthProvider } from './src/context/AuthContext';
import { CheckInRecord } from './src/types';
import { getCheckIns, seedSampleData } from './src/storage/checkInStorage';
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
  const [currentTab, setCurrentTab] = useState<TabKey>('today');
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [isCheckInOpen, setIsCheckInOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        const stored = await getCheckIns();
        if (stored.length === 0) {
          // Initialize with helpful demo data on very first launch
          const seeded = await seedSampleData();
          setCheckIns(seeded);
        } else {
          setCheckIns(stored);
        }
      } catch (e) {
        console.error('Failed to load check-ins', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleTabChange = (tab: TabKey) => {
    triggerHaptic('light');
    setCurrentTab(tab);
  };

  const handleNewCheckInSaved = (record: CheckInRecord) => {
    setCheckIns((prev) => [record, ...prev]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <FriendsScreen latestCheckIn={checkIns[0]} />
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
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('today')}
        >
          <Ionicons
            name={currentTab === 'today' ? 'calendar' : 'calendar-outline'}
            size={22}
            color={currentTab === 'today' ? '#4FD1C5' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'today' && styles.tabLabelActive,
            ]}
          >
            {t('tab.today')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('journal')}
        >
          <Ionicons
            name={currentTab === 'journal' ? 'book' : 'book-outline'}
            size={22}
            color={currentTab === 'journal' ? '#4FD1C5' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'journal' && styles.tabLabelActive,
            ]}
          >
            {t('tab.journal')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('friends')}
        >
          <Ionicons
            name={currentTab === 'friends' ? 'people' : 'people-outline'}
            size={22}
            color={currentTab === 'friends' ? '#4FD1C5' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'friends' && styles.tabLabelActive,
            ]}
          >
            {t('tab.friends')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('trends')}
        >
          <Ionicons
            name={currentTab === 'trends' ? 'pie-chart' : 'pie-chart-outline'}
            size={22}
            color={currentTab === 'trends' ? '#4FD1C5' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'trends' && styles.tabLabelActive,
            ]}
          >
            {t('tab.trends')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabChange('settings')}
        >
          <Ionicons
            name={currentTab === 'settings' ? 'settings' : 'settings-outline'}
            size={22}
            color={currentTab === 'settings' ? '#4FD1C5' : '#718096'}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'settings' && styles.tabLabelActive,
            ]}
          >
            {t('tab.settings')}
          </Text>
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
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096',
  },
  tabLabelActive: {
    color: '#4FD1C5',
    fontWeight: '700',
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
