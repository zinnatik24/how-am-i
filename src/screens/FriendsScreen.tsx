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
import { getFriends, addFriend, deleteFriend, recordFriendReaction } from '../storage/friendsStorage';
import { shareCheckIn } from '../utils/shareHelper';
import { getLocalizedEmotionName } from '../utils/localizationHelper';
import { triggerHaptic } from '../utils/haptics';

interface FriendsScreenProps {
  latestCheckIn?: CheckInRecord;
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({ latestCheckIn }) => {
  const { language, t } = useLanguage();
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newRel, setNewRel] = useState<'partner' | 'friend' | 'family' | 'other'>('friend');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const list = await getFriends();
    setFriends(list);
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
        t('journal.delete'),
        t('journal.deleteConfirm'),
        [
          { text: t('journal.cancel'), style: 'cancel' },
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

      {/* Friends List */}
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
                {/* Friend Header */}
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

                {/* Friend Check-In Content */}
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

                {/* Sent reaction status */}
                {friend.lastReactionSent && (
                  <View style={styles.reactionStatusBadge}>
                    <Ionicons name="checkmark-done" size={14} color="#4FD1C5" />
                    <Text style={styles.reactionStatusText}>
                      {t('friends.reactionSent')}: {friend.lastReactionSent}
                    </Text>
                  </View>
                )}

                {/* Quick Support Reactions */}
                <View style={styles.reactionsRow}>
                  {[
                    { label: t('friends.sendHug'), icon: '❤️' },
                    { label: t('friends.sendSupport'), icon: '🤗' },
                    { label: t('friends.sendJoy'), icon: '🎉' },
                    { label: t('friends.sendTea'), icon: '☕' },
                  ].map((reaction) => (
                    <TouchableOpacity
                      key={reaction.label}
                      style={styles.reactionButton}
                      onPress={() =>
                        handleSendReaction(
                          friend.id,
                          `${reaction.icon} ${reaction.label}`
                        )
                      }
                    >
                      <Text style={styles.reactionIcon}>{reaction.icon}</Text>
                      <Text style={styles.reactionLabel}>{reaction.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Friend Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('friends.addModalTitle')}</Text>
            <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
              <Ionicons name="close" size={24} color="#CBD5E0" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>{t('friends.friendName')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('friends.friendNamePlaceholder')}
              placeholderTextColor="#718096"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>{t('friends.relationship')}</Text>
            <View style={styles.relSelector}>
              {(['partner', 'friend', 'family', 'other'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.relPill,
                    newRel === r && styles.relPillActive,
                  ]}
                  onPress={() => setNewRel(r)}
                >
                  <Text
                    style={[
                      styles.relText,
                      newRel === r && styles.relTextActive,
                    ]}
                  >
                    {getRelLabel(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleAddFriend}
            >
              <Text style={styles.modalSaveText}>{t('friends.save')}</Text>
            </TouchableOpacity>
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
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 10,
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
    maxWidth: 240,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E252E',
    borderWidth: 1,
    borderColor: '#384454',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#222B36',
    padding: 16,
    borderRadius: 18,
    marginBottom: 24,
  },
  shareBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  shareBannerSub: {
    color: '#8C9BAE',
    fontSize: 13,
    marginTop: 2,
  },
  friendsList: {
    gap: 16,
  },
  friendCard: {
    backgroundColor: '#141A22',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  friendInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  friendName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  friendRel: {
    color: '#718096',
    fontSize: 12,
    marginTop: 1,
  },
  deleteButton: {
    padding: 4,
  },
  checkInBox: {
    backgroundColor: '#1E252E',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  checkInTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  emotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quadrantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emotionName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  timeAgo: {
    color: '#718096',
    fontSize: 12,
  },
  friendNote: {
    color: '#CBD5E0',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reactionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  reactionStatusText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '600',
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reactionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#1E252E',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  reactionIcon: {
    fontSize: 14,
  },
  reactionLabel: {
    color: '#CBD5E0',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#718096',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F1318',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    gap: 16,
  },
  inputLabel: {
    color: '#CBD5E0',
    fontSize: 14,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: '#1E252E',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  relSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1E252E',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  relPillActive: {
    backgroundColor: '#4FD1C5',
    borderColor: '#4FD1C5',
  },
  relText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  relTextActive: {
    color: '#0A0D12',
    fontWeight: '700',
  },
  modalSaveButton: {
    backgroundColor: '#4FD1C5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSaveText: {
    color: '#0A0D12',
    fontSize: 16,
    fontWeight: '800',
  },
});
