import axios from 'axios';

/**
 * Send push notification to Expo devices
 * @param {string|string[]} pushTokens - One or more ExponentPushToken[...]
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Extra payload
 */
export async function sendExpoPushNotification(pushTokens, title, body, data = {}) {
  const tokens = Array.isArray(pushTokens) ? pushTokens : [pushTokens];
  const validTokens = tokens.filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) {
    console.log('[PUSH] No valid Expo push tokens to send to');
    return;
  }

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    badge: 1,
    priority: 'high',
    channelId: 'default'
  }));

  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    console.log(`[PUSH] Sent ${messages.length} notifications. Status:`, response.data);
    return response.data;
  } catch (error) {
    console.error('[PUSH] Failed to send push notification:', error.response?.data || error.message);
  }
}
