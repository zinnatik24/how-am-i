import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendRecord, CheckInRecord } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getFriends, addFriend, deleteFriend, recordFriendReaction } from '../storage/friendsStorage';
import { shareCheckIn } from '../utils/shareHelper';
import { getLocalizedEmotionName } from '../utils/localizationHelper';
import { triggerHaptic } from '../utils/haptics';

interface FriendsScreenProps {
  latestCheckIn?: CheckInRecord;
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({ latestCheckIn }) => {
  const { language, t } = useLanguage();
  const {
    user,
    isAuthenticated,
    partners,
    partnerFeed,
    signInWithGoogle,
    signInDemo,
    signOut,
    connectPartner,
    refreshFeed,
    pushToken,
  } = useAuth();

  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newRel, setNewRel] = useState<'partner' | 'friend' | 'family' | 'other'>('friend');

  // Partner connect code input
  const [partnerCodeInput, setPartnerCodeInput] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Custom demo login input modal
  const [isCustomLoginOpen, setIsCustomLoginOpen] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const list = await getFriends();
    setFriends(list);
  };

  const handleConnectPartner = async () => {
    if (!partnerCodeInput.trim()) {
      Alert.alert('Ошибка', 'Введите 6-значный код партнёра');
      return;
    }
    setIsConnecting(true);
    triggerHaptic('medium');
    const result = await connectPartner(partnerCodeInput.trim());
    setIsConnecting(false);

    if (result.success) {
      triggerHaptic('success');
      setPartnerCodeInput('');
      Alert.alert(
        'Успешно связано! ❤️',
        `Вы успешно подключились к пользователю ${result.partner?.name}. Теперь вы будете видеть настроение друг друга в реальном времени с push-уведомлениями!`
      );
    } else {
      triggerHaptic('light');
      Alert.alert('Не удалось подключить', result.error || 'Проверьте правильность кода');
    }
  };

  const handleShareMyMood = async () => {
    triggerHaptic('medium');
    if (latestCheckIn) {
      await shareCheckIn(latestCheckIn, language);
    } else {
      if (Platform.OS === 'web') {
        alert(t('friends.emptySubtitle'));
      } else {
        Alert.alert(t('friends.title'), t('friends.emptySubtitle'));
      }
    }
  };

  const handleSendReaction = async (friendId: string, reactionLabel: string) => {
    triggerHaptic('success');
    const updated = await recordFriendReaction(friendId, reactionLabel);
    setFriends(updated);
  };

  const handleAddFriend = async () => {
    if (!newName.trim()) return;
    triggerHaptic('medium');

    const colors = ['#E63946', '#F4A261', '#457B9D', '#2A9D8F', '#9B5DE5', '#F15BB5'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newRecord: FriendRecord = {
      id: `f-${Date.now()}`,
      name: newName.trim(),
      relationship: newRel,
      avatarColor: randomColor,
      lastCheckIn: {
        quadrantId: 'low_pleasant',
        emotionId: 'calm',
        emotionName: language === 'ru' ? 'Спокойствие' : 'Calm',
        timeAgo: language === 'ru' ? 'Только что' : 'Just now',
        note: language === 'ru' ? 'На связи с близкими!' : 'Connected with loved ones!',
      },
    };

    const updated = await addFriend(newRecord);
    setFriends(updated);
    setNewName('');
    setIsAddModalOpen(false);
  };

  const handleDeleteFriend = (id: string) => {
    const confirmAction = async () => {
      triggerHaptic('light');
      const updated = await deleteFriend(id);
      setFriends(updated);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('journal.deleteConfirm'))) {
        confirmAction();
      }
    } else {
      Alert.alert(
        t('friends.title'),
        t('journal.deleteConfirm'),
        [
          { text: t('friends.cancel'), style: 'cancel' },
          { text: t('journal.delete'), style: 'destructive', onPress: confirmAction },
        ]
      );
    }
  };

  const getRelLabel = (rel: string) => {
    if (rel === 'partner') return t('friends.relPartner');
    if (rel === 'family') return t('friends.relFamily');
    if (rel === 'friend') return t('friends.relFriend');
    return t('friends.relOther');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('friends.title')}</Text>
          <Text style={styles.subtitle}>{t('friends.subtitle')}</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            triggerHaptic('light');
            setIsAddModalOpen(true);
          }}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>{t('friends.addFriend')}</Text>
        </TouchableOpacity>
      </View>

      {/* Cloud & Live Sync Card */}
      {!isAuthenticated ? (
        <View style={styles.authCard}>
          <View style={styles.authHeader}>
            <View style={styles.authBadge}>
              <Ionicons name="cloud-outline" size={18} color="#4FD1C5" />
              <Text style={styles.authBadgeText}>Облако & Связь с близкими</Text>
            </View>
          </View>
          <Text style={styles.authTitle}>Синхронизация и Push-уведомления</Text>
          <Text style={styles.authDesc}>
            Войдите, чтобы ваши чекины никогда не терялись при обновлении, а муж/жена видели ваше настроение с мгновенными push-уведомлениями.
          </Text>

          {/* Login Buttons */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={signInWithGoogle}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.googleButtonText}>Войти через Google</Text>
          </TouchableOpacity>

          {/* Quick Demo Fast-Login */}
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#4299E1' }]}
              onPress={() => signInDemo('Вася', 'vasya@example.com')}
            >
              <Text style={styles.demoBtnText}>⚡ Вход: Вася</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#ED64A6' }]}
              onPress={() => signInDemo('Аня (Жена)', 'anya@example.com')}
            >
              <Text style={styles.demoBtnText}>🌸 Вход: Жена Васи</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#718096' }]}
              onPress={() => setIsCustomLoginOpen(true)}
            >
              <Text style={styles.demoBtnText}>✏️ Свой аккаунт</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileUser}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
            </TouchableOpacity>
          </View>

          {/* My Invite Code */}
          <View style={styles.inviteCodeBox}>
            <View>
              <Text style={styles.inviteCodeLabel}>Ваш код для привязки партнёра:</Text>
              <Text style={styles.inviteCodeValue}>{user?.inviteCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyCodeBtn}
              onPress={() => {
                triggerHaptic('success');
                Alert.alert(
                  'Код скопирован!',
                  `Передайте код ${user?.inviteCode} вашему партнёру (мужу/жене), чтобы он(а) ввёл(а) его в своём приложении.`
                );
              }}
            >
              <Ionicons name="copy-outline" size={18} color="#4FD1C5" />
              <Text style={styles.copyCodeText}>Скопировать</Text>
            </TouchableOpacity>
          </View>

          {/* Push Status */}
          <View style={styles.pushStatusRow}>
            <Ionicons name="notifications" size={16} color="#48BB78" />
            <Text style={styles.pushStatusText}>
              Push-уведомления для партнёров активны
            </Text>
          </View>

          {/* Connect Partner Section */}
          <View style={styles.connectPartnerSection}>
            <Text style={styles.connectTitle}>Подключить партнёра по коду:</Text>
            <View style={styles.connectInputRow}>
              <TextInput
                style={styles.connectInput}
                placeholder="Вставьте 6-значный код..."
                placeholderTextColor="#718096"
                value={partnerCodeInput}
                onChangeText={setPartnerCodeInput}
                autoCapitalize="characters"
                maxLength={8}
              />
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={handleConnectPartner}
                disabled={isConnecting}
              >
                <Text style={styles.connectBtnText}>
                  {isConnecting ? '...' : 'Связать'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Connected Partners List */}
          {partners.length > 0 && (
            <View style={styles.connectedPartnersWrap}>
              <Text style={styles.connectedTitle}>Ваша пара / Подключенные близкие:</Text>
              {partners.map((p) => (
                <View key={p.id} style={styles.partnerItem}>
                  <View style={styles.partnerItemLeft}>
                    <View style={styles.partnerDot} />
                    <Text style={styles.partnerItemName}>{p.name}</Text>
                  </View>
                  <Text style={styles.partnerActiveBadge}>❤️ На связи</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* LIVE PARTNER FEED */}
      {isAuthenticated && partners.length > 0 && (
        <View style={styles.liveFeedSection}>
          <View style={styles.liveFeedHeader}>
            <View style={styles.liveFeedHeaderLeft}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveFeedTitle}>Чекины партнёра в реальном времени</Text>
            </View>
            <TouchableOpacity onPress={refreshFeed} style={styles.refreshFeedBtn}>
              <Ionicons name="refresh" size={18} color="#4FD1C5" />
            </TouchableOpacity>
          </View>

          {partnerFeed.length === 0 ? (
            <View style={styles.emptyFeedBox}>
              <Ionicons name="heart-outline" size={32} color="#718096" />
              <Text style={styles.emptyFeedText}>
                Партнёр ещё не делал чекинов. Как только партнёр отметит настроение, вам придёт Push-уведомление, и оно появится здесь!
              </Text>
            </View>
          ) : (
            <View style={styles.feedList}>
              {partnerFeed.map((item) => {
                const quad = QUADRANTS[item.quadrant as keyof typeof QUADRANTS];
                const color = quad?.color_hex || '#4FD1C5';
                const date = new Date(item.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });

                return (
                  <View key={item.id} style={[styles.feedCard, { borderLeftColor: color }]}>
                    <View style={styles.feedCardTop}>
                      <View style={styles.feedUserRow}>
                        <View style={[styles.feedDot, { backgroundColor: color }]} />
                        <Text style={styles.feedUserName}>{item.user_name || 'Партнёр'}</Text>
                      </View>
                      <Text style={styles.feedTime}>{dateStr}, {timeStr}</Text>
                    </View>

                    <View style={styles.feedEmotionRow}>
                      <Text style={[styles.feedEmotionTitle, { color }]}>
                        {item.emotion_id.toUpperCase()}
                      </Text>
                      <Text style={styles.feedIntensity}>
                        Интенсивность: {item.intensity}/3
                      </Text>
                    </View>

                    {item.note && (
                      <Text style={styles.feedNote}>"{item.note}"</Text>
                    )}

                    {/* Context tags */}
                    <View style={styles.feedTagsRow}>
                      {item.context_people?.map((p, i) => (
                        <View key={i} style={styles.feedTag}>
                          <Text style={styles.feedTagText}>👤 {p}</Text>
                        </View>
                      ))}
                      {item.context_place?.map((p, i) => (
                        <View key={i} style={styles.feedTag}>
                          <Text style={styles.feedTagText}>📍 {p}</Text>
                        </View>
                      ))}
                      {item.context_activity?.map((p, i) => (
                        <View key={i} style={styles.feedTag}>
                          <Text style={styles.feedTagText}>⚡ {p}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Share My Mood Banner */}
      <TouchableOpacity
        style={styles.shareBanner}
        activeOpacity={0.85}
        onPress={handleShareMyMood}
      >
        <View style={styles.shareBannerLeft}>
          <View style={styles.shareIconCircle}>
            <Ionicons name="share-social" size={20} color="#4FD1C5" />
          </View>
          <View>
            <Text style={styles.shareBannerTitle}>{t('friends.shareMyMood')}</Text>
            <Text style={styles.shareBannerSub}>
              {latestCheckIn
                ? `${t('friends.recentFeeling')}: ${getLocalizedEmotionName(
                    latestCheckIn.emotionId,
                    latestCheckIn.emotionName,
                    language
                  )}`
                : t('home.noRecent')}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#718096" />
      </TouchableOpacity>

      {/* Local Friends List */}
      <View style={styles.localFriendsHeader}>
        <Text style={styles.localFriendsTitle}>Локальный список друзей</Text>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color="#4A5568" />
          <Text style={styles.emptyTitle}>{t('friends.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('friends.emptySubtitle')}</Text>
        </View>
      ) : (
        <View style={styles.friendsList}>
          {friends.map((friend) => {
            const checkIn = friend.lastCheckIn;
            const quadrant = checkIn ? QUADRANTS[checkIn.quadrantId] : null;
            const emotionTitle = checkIn
              ? getLocalizedEmotionName(checkIn.emotionId, checkIn.emotionName, language)
              : '';

            return (
              <View key={friend.id} style={styles.friendCard}>
                <View style={styles.friendHeader}>
                  <View style={styles.friendInfoLeft}>
                    <View style={[styles.avatar, { backgroundColor: friend.avatarColor }]}>
                      <Text style={styles.avatarInitial}>{friend.name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.friendName}>{friend.name}</Text>
                      <Text style={styles.friendRel}>{getRelLabel(friend.relationship)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteFriend(friend.id)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#718096" />
                  </TouchableOpacity>
                </View>

                {checkIn && quadrant && (
                  <View style={[styles.checkInBox, { borderLeftColor: quadrant.color_hex }]}>
                    <View style={styles.checkInTop}>
                      <View style={styles.emotionPill}>
                        <View style={[styles.quadrantDot, { backgroundColor: quadrant.color_hex }]} />
                        <Text style={styles.emotionName}>{emotionTitle}</Text>
                      </View>
                      <Text style={styles.timeAgo}>{checkIn.timeAgo}</Text>
                    </View>

                    {checkIn.note && (
                      <Text style={styles.friendNote} numberOfLines={2}>
                        "{checkIn.note}"
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.reactionsRow}>
                  {['❤️', '🤗', '💪', '🙏'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionBtn}
                      onPress={() => handleSendReaction(friend.id, emoji)}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal: Custom Demo Login */}
      <Modal
        visible={isCustomLoginOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsCustomLoginOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Быстрый вход</Text>
            <Text style={styles.modalSub}>Введите имя и email для создания сессии</Text>

            <TextInput
              style={styles.input}
              placeholder="Имя (например, Иван)"
              placeholderTextColor="#718096"
              value={customName}
              onChangeText={setCustomName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email (например, ivan@example.com)"
              placeholderTextColor="#718096"
              value={customEmail}
              onChangeText={setCustomEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCustomLoginOpen(false)}
              >
                <Text style={styles.modalCancelText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={async () => {
                  if (!customName.trim() || !customEmail.trim()) {
                    Alert.alert('Ошибка', 'Заполните имя и email');
                    return;
                  }
                  await signInDemo(customName.trim(), customEmail.trim());
                  setIsCustomLoginOpen(false);
                  setCustomName('');
                  setCustomEmail('');
                }}
              >
                <Text style={styles.modalSubmitText}>Войти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Local Friend */}
      <Modal
        visible={isAddModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('friends.addFriend')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('friends.friendNamePlaceholder')}
              placeholderTextColor="#718096"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.relTitle}>{t('friends.relationship')}</Text>
            <View style={styles.relChipsRow}>
              {(['partner', 'friend', 'family', 'other'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.relChip, newRel === r && styles.relChipActive]}
                  onPress={() => setNewRel(r)}
                >
                  <Text style={[styles.relChipText, newRel === r && styles.relChipTextActive]}>
                    {getRelLabel(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>{t('friends.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleAddFriend}
              >
                <Text style={styles.modalSubmitText}>{t('friends.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F7FAFC',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#A0AEC0',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3748',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Auth Card
  authCard: {
    backgroundColor: '#11151C',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  authBadgeText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  authTitle: {
    color: '#F7FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  authDesc: {
    color: '#A0AEC0',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA4335',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  demoBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  demoBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#11151C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  profileUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#0A0D12',
    fontSize: 18,
    fontWeight: '800',
  },
  profileName: {
    color: '#F7FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  logoutBtn: {
    padding: 8,
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A202C',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  inviteCodeLabel: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  inviteCodeValue: {
    color: '#4FD1C5',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  copyCodeText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  pushStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  pushStatusText: {
    color: '#48BB78',
    fontSize: 12,
    fontWeight: '600',
  },
  connectPartnerSection: {
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
    paddingTop: 12,
  },
  connectTitle: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  connectInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  connectInput: {
    flex: 1,
    backgroundColor: '#1A202C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  connectBtn: {
    backgroundColor: '#319795',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  connectedPartnersWrap: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
  },
  connectedTitle: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A202C',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  partnerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ED64A6',
  },
  partnerItemName: {
    color: '#F7FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  partnerActiveBadge: {
    color: '#ED64A6',
    fontSize: 11,
    fontWeight: '700',
  },

  // Live Partner Feed
  liveFeedSection: {
    marginBottom: 24,
  },
  liveFeedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveFeedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4FD1C5',
  },
  liveFeedTitle: {
    color: '#F7FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  refreshFeedBtn: {
    padding: 4,
  },
  emptyFeedBox: {
    backgroundColor: '#11151C',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  emptyFeedText: {
    color: '#A0AEC0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  feedList: {
    gap: 12,
  },
  feedCard: {
    backgroundColor: '#11151C',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  feedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedUserName: {
    color: '#F7FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  feedTime: {
    color: '#718096',
    fontSize: 11,
  },
  feedEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  feedEmotionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  feedIntensity: {
    color: '#A0AEC0',
    fontSize: 11,
  },
  feedNote: {
    color: '#E2E8F0',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 8,
  },
  feedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  feedTag: {
    backgroundColor: '#1A202C',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  feedTagText: {
    color: '#CBD5E0',
    fontSize: 11,
  },

  // Share Banner
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  shareBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  shareBannerSub: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 2,
  },

  // Local Friends
  localFriendsHeader: {
    marginBottom: 10,
  },
  localFriendsTitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#11151C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A202C',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  friendsList: {
    gap: 12,
  },
  friendCard: {
    backgroundColor: '#11151C',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1A202C',
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  friendRel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 1,
  },
  deleteButton: {
    padding: 4,
  },
  checkInBox: {
    backgroundColor: '#1A202C',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 10,
    marginTop: 10,
  },
  checkInTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quadrantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emotionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  timeAgo: {
    fontSize: 11,
    color: '#718096',
  },
  friendNote: {
    fontSize: 12,
    color: '#CBD5E0',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  reactionBtn: {
    backgroundColor: '#1A202C',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  reactionEmoji: {
    fontSize: 14,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1A202C',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F7FAFC',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#A0AEC0',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#11151C',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 12,
  },
  relTitle: {
    fontSize: 12,
    color: '#A0AEC0',
    marginBottom: 8,
  },
  relChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  relChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#11151C',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  relChipActive: {
    backgroundColor: '#2B6CB0',
    borderColor: '#4299E1',
  },
  relChipText: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  relChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: '#319795',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
