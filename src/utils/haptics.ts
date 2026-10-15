import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export async function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (type === 'medium') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (e) {
    // Graceful fallback if haptics is unsupported
  }
}
