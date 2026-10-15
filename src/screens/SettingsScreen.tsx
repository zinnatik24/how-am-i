import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { SupportedLanguage, CheckInRecord } from '../types';
import { clearAllCheckIns, seedSampleData } from '../storage/checkInStorage';
import { triggerHaptic } from '../utils/haptics';

interface SettingsScreenProps {
  onCheckInsUpdated: (records: CheckInRecord[]) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onCheckInsUpdated }) => {
  const { language, setLanguage, t } = useLanguage();

  const handleSelectLanguage = async (newLang: SupportedLanguage) => {
    triggerHaptic('light');
    await setLanguage(newLang);
  };

  const handleLoadDemo = async () => {
    triggerHaptic('success');
    const demo = await seedSampleData();
    onCheckInsUpdated(demo);
    if (Platform.OS === 'web') {
      alert(t('settings.demoLoadedSuccess'));
    } else {
      Alert.alert(t('settings.title'), t('settings.demoLoadedSuccess'));
    }
  };

  const handleClearData = () => {
    const executeClear = async () => {
      triggerHaptic('medium');
      await clearAllCheckIns();
      onCheckInsUpdated([]);
      if (Platform.OS === 'web') {
        alert(t('settings.clearDataSuccess'));
      } else {
        Alert.alert(t('settings.title'), t('settings.clearDataSuccess'));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('settings.clearDataConfirm'))) {
        executeClear();
      }
    } else {
      Alert.alert(
        t('settings.clearData'),
        t('settings.clearDataConfirm'),
        [
          { text: t('journal.cancel'), style: 'cancel' },
          { text: t('journal.delete'), style: 'destructive', onPress: executeClear },
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      {/* Language Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <Text style={styles.sectionSubtitle}>{t('settings.languageSelect')}</Text>

        <View style={styles.langButtonsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSelectLanguage('en')}
            style={[
              styles.langButton,
              language === 'en' && styles.langButtonActive,
            ]}
          >
            <Text style={styles.flagIcon}>🇬🇧</Text>
            <View>
              <Text
                style={[
                  styles.langName,
                  language === 'en' && styles.langNameActive,
                ]}
              >
                English
              </Text>
              <Text style={styles.langNative}>English</Text>
            </View>
            {language === 'en' && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#4FD1C5"
                style={styles.checkIcon}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSelectLanguage('ru')}
            style={[
              styles.langButton,
              language === 'ru' && styles.langButtonActive,
            ]}
          >
            <Text style={styles.flagIcon}>🇷🇺</Text>
            <View>
              <Text
                style={[
                  styles.langName,
                  language === 'ru' && styles.langNameActive,
                ]}
              >
                Русский
              </Text>
              <Text style={styles.langNative}>Russian</Text>
            </View>
            {language === 'ru' && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color="#4FD1C5"
                style={styles.checkIcon}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Privacy Guarantee */}
      <View style={styles.section}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="shield-checkmark" size={22} color="#4FD1C5" />
            <Text style={styles.infoTitle}>{t('settings.privacy')}</Text>
          </View>
          <Text style={styles.infoBody}>{t('settings.privacyText')}</Text>
        </View>
      </View>

      {/* Yale Methodology */}
      <View style={styles.section}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="school-outline" size={22} color="#F4A261" />
            <Text style={styles.infoTitle}>{t('settings.aboutTitle')}</Text>
          </View>
          <Text style={styles.infoBody}>{t('settings.aboutText')}</Text>
        </View>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.dataManagement')}</Text>
        <View style={styles.dataButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLoadDemo}
          >
            <Ionicons name="cloud-download-outline" size={20} color="#63B3ED" />
            <Text style={styles.actionButtonText}>{t('settings.loadDemo')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClearData}
          >
            <Ionicons name="trash-outline" size={20} color="#FC8181" />
            <Text style={[styles.actionButtonText, styles.dangerText]}>
              {t('settings.clearData')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>{t('settings.version')}</Text>
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#718096',
    fontSize: 13,
    marginBottom: 14,
  },
  langButtonsRow: {
    gap: 10,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141A22',
    borderWidth: 1.5,
    borderColor: '#222B36',
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  langButtonActive: {
    borderColor: '#4FD1C5',
    backgroundColor: '#1A232F',
  },
  flagIcon: {
    fontSize: 26,
  },
  langName: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
  },
  langNameActive: {
    color: '#FFFFFF',
  },
  langNative: {
    color: '#718096',
    fontSize: 12,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  infoCard: {
    backgroundColor: '#141A22',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBody: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 22,
  },
  dataButtons: {
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141A22',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222B36',
    gap: 12,
  },
  actionButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  dangerButton: {
    borderColor: '#4A1D24',
    backgroundColor: '#1C1317',
  },
  dangerText: {
    color: '#FC8181',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  versionText: {
    color: '#4A5568',
    fontSize: 13,
  },
});
