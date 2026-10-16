import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool, query, waitForDb } from './db.js';
import { signUserToken, authMiddleware, generateInviteCode } from './auth.js';
import { sendExpoPushNotification } from './push.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Redirect raw IP traffic to official HTTPS domain
app.use((req, res, next) => {
  const host = req.get('host') || '';
  if (host.includes('5.129.238.166') && !req.path.startsWith('/api') && req.path !== '/health') {
    return res.redirect(301, `https://how-am-i.famehub.ru${req.originalUrl}`);
  }
  next();
});

// 1. Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'how-am-i-api', time: new Date().toISOString() });
});

// 2. Google OAuth & Auth Endpoints
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken, accessToken, mockUser } = req.body;
    console.log(`[AUTH] Google login request received, idToken: ${!!idToken}, accessToken: ${!!accessToken}`);
    let googleId = null;
    let email = null;
    let name = null;
    let avatarUrl = null;

    if (idToken) {
      // Verify Google ID Token via Google's tokeninfo endpoint
      try {
        const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, {
          timeout: 5000,
        });
        const payload = googleRes.data;
        googleId = payload.sub;
        email = payload.email;
        name = payload.name || payload.given_name || 'Пользователь';
        avatarUrl = payload.picture || null;
      } catch (tokenErr) {
        console.warn('[AUTH] Google token verification failed:', tokenErr.message);
        return res.status(401).json({ error: 'Недействительный Google токен' });
      }
    } else if (accessToken) {
      // Alternative: fetch userinfo via Google Access Token
      try {
        const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 5000,
        });
        const payload = googleRes.data;
        googleId = payload.sub;
        email = payload.email;
        name = payload.name || 'Пользователь';
        avatarUrl = payload.picture || null;
      } catch (tokenErr) {
        console.warn('[AUTH] Google userinfo verification failed:', tokenErr.message);
        return res.status(401).json({ error: 'Не удалось получить профиль Google по access_token' });
      }
    } else if (mockUser && process.env.ALLOW_MOCK_AUTH === 'true') {
      googleId = mockUser.googleId || `demo_${Date.now()}`;
      email = mockUser.email || `demo_${Date.now()}@test.com`;
      name = mockUser.name || 'Тестовый пользователь';
      avatarUrl = mockUser.avatarUrl || null;
    } else {
      return res.status(400).json({ error: 'Требуется idToken или accessToken от Google' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Не удалось получить email пользователя' });
    }

    // Upsert user into database
    let userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userRes.rows.length === 0) {
      const inviteCode = generateInviteCode(6);
      const insertRes = await query(
        `INSERT INTO users (google_id, email, name, avatar_url, invite_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [googleId, email, name, avatarUrl, inviteCode]
      );
      user = insertRes.rows[0];
      console.log(`[AUTH] New user created: ${user.name} (${user.email}), code: ${user.invite_code}`);
    } else {
      user = userRes.rows[0];
      const updateRes = await query(
        `UPDATE users
         SET google_id = COALESCE($1, google_id),
             name = COALESCE($2, name),
             avatar_url = COALESCE($3, avatar_url),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [googleId, name, avatarUrl, user.id]
      );
      user = updateRes.rows[0];
    }

    const token = signUserToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        inviteCode: user.invite_code,
      },
    });
  } catch (err) {
    console.error('[AUTH] Google auth error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка авторизации' });
  }
});

// Demo login for quick testing (e.g. "Вася" and "Жена Васи")
app.post('/api/auth/demo', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Укажите name и email' });
    }

    let userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userRes.rows.length === 0) {
      const inviteCode = generateInviteCode(6);
      const insertRes = await query(
        `INSERT INTO users (email, name, invite_code)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [email, name, inviteCode]
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
      if (user.name !== name) {
        const updateRes = await query(
          'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [name, user.id]
        );
        user = updateRes.rows[0];
      }
    }

    const token = signUserToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        inviteCode: user.invite_code,
      },
    });
  } catch (err) {
    console.error('[AUTH] Demo auth error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. User profile & partner info
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const userRes = await query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const user = userRes.rows[0];

    // Get partners
    const partnersRes = await query(
      `SELECT u.id, u.name, u.avatar_url, u.email, f.status, f.created_at
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'`,
      [user.id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        inviteCode: user.invite_code,
        pushToken: user.push_token,
      },
      partners: partnersRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Save Expo Push Token
app.post('/api/push-token', authMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ error: 'pushToken is required' });
    }
    await query('UPDATE users SET push_token = $1, updated_at = NOW() WHERE id = $2', [
      pushToken,
      req.user.userId,
    ]);
    res.json({ success: true, pushToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Connect with partner using invite code
app.post('/api/partner/connect', authMiddleware, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Укажите код приглашения' });
    }

    const code = inviteCode.trim().toUpperCase();
    const partnerRes = await query('SELECT * FROM users WHERE invite_code = $1', [code]);
    if (partnerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь с таким кодом не найден' });
    }

    const partner = partnerRes.rows[0];
    if (partner.id === req.user.userId) {
      return res.status(400).json({ error: 'Нельзя привязать свой собственный код' });
    }

    // Mutual friendship insertion
    await query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [req.user.userId, partner.id]
    );

    await query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [partner.id, req.user.userId]
    );

    // Notify partner with push notification!
    if (partner.push_token) {
      const senderRes = await query('SELECT name FROM users WHERE id = $1', [req.user.userId]);
      const senderName = senderRes.rows[0]?.name || 'Партнёр';
      sendExpoPushNotification(
        partner.push_token,
        '👥 Новая связь в приложении!',
        `${senderName} подключил(а) ваш профиль. Теперь вы видите настроение друг друга!`,
        { type: 'partner_connected', partnerId: req.user.userId }
      );
    }

    res.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        avatarUrl: partner.avatar_url,
      },
    });
  } catch (err) {
    console.error('[PARTNER] Connect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Check-ins: Save new checkin & notify partner
app.post('/api/checkins', authMiddleware, async (req, res) => {
  try {
    const {
      localId,
      emotionId,
      energy,
      pleasantness,
      intensity,
      quadrant,
      contextPeople,
      contextPlace,
      contextActivity,
      note,
      createdAt,
      emotionNameRu,
      emotionNameEn,
      quadrantNameRu,
      emotions = [],
      shareWithPartners = true,
    } = req.body;

    if (!emotionId || !energy || !pleasantness || !quadrant) {
      return res.status(400).json({ error: 'Обязательные поля: emotionId, energy, pleasantness, quadrant' });
    }

    const insertRes = await query(
      `INSERT INTO checkins (
         user_id, local_id, emotion_id, energy, pleasantness, intensity, quadrant,
         context_people, context_place, context_activity, note, share_with_partners, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, NOW()))
       RETURNING *`,
      [
        req.user.userId,
        localId || null,
        emotionId,
        energy,
        pleasantness,
        intensity || 2,
        quadrant,
        JSON.stringify(contextPeople || []),
        JSON.stringify(contextPlace || []),
        JSON.stringify(contextActivity || []),
        note || null,
        shareWithPartners !== false,
        createdAt || null,
      ]
    );

    const checkin = insertRes.rows[0];

    // Find all partners to share checkin and send push notification
    if (shareWithPartners !== false) {
      const partnersRes = await query(
        `SELECT u.id as partner_id, u.push_token, u.name as partner_name, cur.name as sender_name
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         JOIN users cur ON cur.id = f.user_id
         WHERE f.user_id = $1 AND f.status = 'accepted' AND (f.share_checkins = true OR f.share_checkins IS NULL)`,
        [req.user.userId]
      );

      if (partnersRes.rows.length > 0) {
        const senderName = partnersRes.rows[0].sender_name || 'Близкий человек';
        const emotionsList = (emotions && emotions.length > 0)
          ? emotions
          : [
              {
                id: emotionId,
                name: emotionNameRu || emotionId,
                quadrantId: quadrant,
                intensity: intensity || 2,
              }
            ];

        const cleanNote = (note && note.trim() && !note.trim().toLowerCase().startsWith('отметил'))
          ? note.trim()
          : null;

        const checkinPayload = {
          checkin_id: checkin.id,
          emotion_id: emotionId,
          emotionNameRu: emotionNameRu || emotionId,
          quadrant,
          quadrantNameRu: quadrantNameRu || quadrant,
          energy,
          pleasantness,
          intensity,
          emotions: emotionsList,
          context_people: contextPeople || [],
          context_place: contextPlace || [],
          context_activity: contextActivity || [],
          note: cleanNote,
          created_at: checkin.created_at,
        };

        // Insert checkin card into chat messages for each partner
        for (const p of partnersRes.rows) {
          const convId = [req.user.userId, p.partner_id].sort().join('_');
          await query(
            `INSERT INTO messages (conversation_id, from_user_id, to_user_id, type, content, checkin_data)
             VALUES ($1, $2, $3, 'checkin', $4, $5)`,
            [
              convId,
              req.user.userId,
              p.partner_id,
              cleanNote,
              JSON.stringify(checkinPayload),
            ]
          ).catch((e) => console.warn('[CHECKIN] Could not insert to messages:', e));
        }

        const tokens = partnersRes.rows.map(p => p.push_token).filter(Boolean);
        if (tokens.length > 0) {
          const emotionTitle = emotionsList.map(e => e.name).join(', ') || emotionNameRu || emotionId;
          sendExpoPushNotification(
            tokens,
            `💛 ${senderName} отметил(а) настроение`,
            `Чувствует: ${emotionTitle}${cleanNote ? ` — «${cleanNote}»` : ''}`,
            {
              type: 'checkin',
              checkinId: checkin.id,
              senderName,
              emotionId,
            }
          );
        }
      }
    }

    res.json({ success: true, checkin });
  } catch (err) {
    console.error('[CHECKIN] Save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Get user's checkins
app.get('/api/checkins', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const checkinsRes = await query(
      'SELECT * FROM checkins WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.userId, limit]
    );
    res.json({ checkins: checkinsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Partner feed: Get partners' checkins (only if shared)
app.get('/api/partner/feed', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '30', 10);
    const feedRes = await query(
      `SELECT c.*, u.name as user_name, u.avatar_url as user_avatar
       FROM checkins c
       JOIN users u ON u.id = c.user_id
       JOIN friendships f ON f.friend_id = c.user_id
       WHERE f.user_id = $1 AND f.status = 'accepted' AND f.share_checkins = true AND (c.share_with_partners = true OR c.share_with_partners IS NULL)
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [req.user.userId, limit]
    );
    res.json({ feed: feedRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Partner Care Ping («Спросить: Как ты?»)
app.post('/api/partner/ping', authMiddleware, async (req, res) => {
  try {
    const { partnerId } = req.body;
    const senderRes = await query('SELECT name FROM users WHERE id = $1', [req.user.userId]);
    const senderName = senderRes.rows[0]?.name || 'Близкий человек';

    const targetPartner = partnerId
      ? await query('SELECT id, push_token FROM users WHERE id = $1', [partnerId])
      : await query(
          `SELECT u.id, u.push_token
           FROM friendships f
           JOIN users u ON u.id = f.friend_id
           WHERE f.user_id = $1 AND f.status = 'accepted'
           LIMIT 1`,
          [req.user.userId]
        );

    if (targetPartner.rows.length === 0) {
      return res.status(404).json({ error: 'Партнёр не найден' });
    }

    const partner = targetPartner.rows[0];
    const pingLabel = '💭 Интересуется: «Как ты?»';

    // Save ping to partner_reactions
    await query(
      `INSERT INTO partner_reactions (from_user_id, to_user_id, reaction_type, reaction_label)
       VALUES ($1, $2, $3, $4)`,
      [req.user.userId, partner.id, 'ping', pingLabel]
    );

    // Save ping to messages
    const convId = [req.user.userId, partner.id].sort().join('_');
    const msgInsert = await query(
      `INSERT INTO messages (conversation_id, from_user_id, to_user_id, type, content)
       VALUES ($1, $2, $3, 'ping', $4)
       RETURNING *`,
      [convId, req.user.userId, partner.id, pingLabel]
    );

    if (partner.push_token) {
      sendExpoPushNotification(
        partner.push_token,
        `💭 ${senderName} интересуется: «Как ты?»`,
        'Уделите минутку, чтобы отметить своё настроение в приложении.',
        { type: 'care_ping', senderId: req.user.userId, senderName }
      );
    }

    res.json({ success: true, message: 'Пинг заботы отправлен!', chatMessage: msgInsert.rows[0] });
  } catch (err) {
    console.error('[PING] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Partner Care Reactions (Обнять, Я рядом, Горжусь, Хочешь поговорить?)
app.post('/api/partner/reaction', authMiddleware, async (req, res) => {
  try {
    const { partnerId, reactionType, reactionLabel } = req.body;
    if (!reactionLabel) {
      return res.status(400).json({ error: 'Укажите reactionLabel' });
    }

    const senderRes = await query('SELECT name FROM users WHERE id = $1', [req.user.userId]);
    const senderName = senderRes.rows[0]?.name || 'Близкий человек';

    // Target partner
    const targetPartner = partnerId
      ? await query('SELECT id, push_token FROM users WHERE id = $1', [partnerId])
      : await query(
          `SELECT u.id, u.push_token
           FROM friendships f
           JOIN users u ON u.id = f.friend_id
           WHERE f.user_id = $1 AND f.status = 'accepted'
           LIMIT 1`,
          [req.user.userId]
        );

    if (targetPartner.rows.length === 0) {
      return res.status(404).json({ error: 'Партнёр не найден' });
    }

    const partner = targetPartner.rows[0];

    // Save reaction
    await query(
      `INSERT INTO partner_reactions (from_user_id, to_user_id, reaction_type, reaction_label)
       VALUES ($1, $2, $3, $4)`,
      [req.user.userId, partner.id, reactionType || 'hug', reactionLabel]
    );

    // Save reaction to messages
    const convId = [req.user.userId, partner.id].sort().join('_');
    const msgInsert = await query(
      `INSERT INTO messages (conversation_id, from_user_id, to_user_id, type, content)
       VALUES ($1, $2, $3, 'reaction', $4)
       RETURNING *`,
      [convId, req.user.userId, partner.id, reactionLabel]
    );

    // Send push
    if (partner.push_token) {
      sendExpoPushNotification(
        partner.push_token,
        `❤️ ${senderName} отправил(а) знак заботы`,
        reactionLabel,
        { type: 'care_reaction', senderId: req.user.userId, reactionLabel }
      );
    }

    res.json({ success: true, message: 'Реакция отправлена!', chatMessage: msgInsert.rows[0] });
  } catch (err) {
    console.error('[REACTION] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 11. Get Incoming Care Reactions & Pings Received by Current User
app.get('/api/partner/reactions', authMiddleware, async (req, res) => {
  try {
    const reactions = await query(
      `SELECT r.*, u.name as from_name, u.avatar_url as from_avatar
       FROM partner_reactions r
       JOIN users u ON u.id = r.from_user_id
       WHERE r.to_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [req.user.userId]
    );
    res.json(reactions.rows);
  } catch (err) {
    console.error('[REACTIONS GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 12. Chat Messages: GET conversation messages
app.get('/api/messages', authMiddleware, async (req, res) => {
  try {
    let { partnerId, limit = 100 } = req.query;

    if (!partnerId) {
      const friendRes = await query(
        `SELECT friend_id FROM friendships
         WHERE user_id = $1 AND status = 'accepted'
         LIMIT 1`,
        [req.user.userId]
      );
      if (friendRes.rows.length === 0) {
        return res.json({ messages: [], conversationId: null });
      }
      partnerId = friendRes.rows[0].friend_id;
    }

    const conversationId = [req.user.userId, partnerId].sort().join('_');
    const msgsRes = await query(
      `SELECT m.*, u.name as from_name, u.avatar_url as from_avatar
       FROM messages m
       JOIN users u ON u.id = m.from_user_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2`,
      [conversationId, parseInt(limit, 10)]
    );

    res.json({ messages: msgsRes.rows, conversationId });
  } catch (err) {
    console.error('[MESSAGES GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 13. Chat Messages: POST a message (text, checkin, reaction, ping)
app.post('/api/messages', authMiddleware, async (req, res) => {
  try {
    const { partnerId, content, type = 'text', checkinData } = req.body;
    let targetPartnerId = partnerId;

    if (!targetPartnerId) {
      const friendRes = await query(
        `SELECT friend_id FROM friendships
         WHERE user_id = $1 AND status = 'accepted'
         LIMIT 1`,
        [req.user.userId]
      );
      if (friendRes.rows.length === 0) {
        return res.status(404).json({ error: 'Партнёр не найден' });
      }
      targetPartnerId = friendRes.rows[0].friend_id;
    }

    const conversationId = [req.user.userId, targetPartnerId].sort().join('_');

    const insertRes = await query(
      `INSERT INTO messages (conversation_id, from_user_id, to_user_id, type, content, checkin_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        conversationId,
        req.user.userId,
        targetPartnerId,
        type,
        content || null,
        checkinData ? JSON.stringify(checkinData) : null,
      ]
    );

    const senderRes = await query('SELECT name, avatar_url FROM users WHERE id = $1', [req.user.userId]);
    const sender = senderRes.rows[0] || { name: 'Близкий человек' };
    const insertedMessage = {
      ...insertRes.rows[0],
      from_name: sender.name,
      from_avatar: sender.avatar_url,
    };

    // Push notification to partner
    const partnerRes = await query('SELECT push_token FROM users WHERE id = $1', [targetPartnerId]);
    if (partnerRes.rows.length > 0 && partnerRes.rows[0].push_token) {
      let pushTitle = `💬 ${sender.name}`;
      let pushBody = content || 'Новое сообщение';

      if (type === 'checkin') {
        const emotionsList = checkinData?.emotions && checkinData.emotions.length > 0
          ? checkinData.emotions.map(e => e.name).join(', ')
          : (checkinData?.emotionNameRu || checkinData?.emotion_id || 'настроением');
        pushTitle = `💛 ${sender.name} поделился(лась) настроением`;
        const hasRealNote = checkinData?.note && !checkinData.note.toLowerCase().startsWith('отметил');
        pushBody = `Чувствует: ${emotionsList}${hasRealNote ? ` — «${checkinData.note}»` : ''}`;
      } else if (type === 'reaction') {
        pushTitle = `❤️ ${sender.name} отправил(а) знак заботы`;
        pushBody = content || 'Знак заботы';
      } else if (type === 'ping') {
        pushTitle = `💭 ${sender.name}`;
        pushBody = 'Интересуется: «Как ты?»';
      }

      sendExpoPushNotification(partnerRes.rows[0].push_token, pushTitle, pushBody, {
        type: 'chat_message',
        messageId: insertedMessage.id,
        conversationId,
        senderId: req.user.userId,
      });
    }

    res.json({ success: true, message: insertedMessage });
  } catch (err) {
    console.error('[MESSAGES POST] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 14. Conversations List (Telegram / WhatsApp style conversation stream)
app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const friendsRes = await query(
      `SELECT u.id, u.name, u.avatar_url, u.email, f.status, f.created_at as friendship_date
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 AND f.status = 'accepted'
       ORDER BY f.created_at ASC`,
      [req.user.userId]
    );

    const conversations = [];

    for (const friend of friendsRes.rows) {
      const convId = [req.user.userId, friend.id].sort().join('_');

      // Get last message in this conversation
      const lastMsgRes = await query(
        `SELECT m.*, u.name as from_name
         FROM messages m
         JOIN users u ON u.id = m.from_user_id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [convId]
      );

      // Get friend's latest check-in
      const latestCheckinRes = await query(
        `SELECT c.*
         FROM checkins c
         WHERE c.user_id = $1 AND (c.share_with_partners = true OR c.share_with_partners IS NULL)
         ORDER BY c.created_at DESC
         LIMIT 1`,
        [friend.id]
      );

      conversations.push({
        partner: {
          id: friend.id,
          name: friend.name,
          email: friend.email,
          avatarUrl: friend.avatar_url,
          status: friend.status,
        },
        conversationId: convId,
        lastMessage: lastMsgRes.rows[0] || null,
        latestCheckin: latestCheckinRes.rows[0] || null,
      });
    }

    // Sort conversations so that the one with the most recent message or checkin is on top
    conversations.sort((a, b) => {
      const timeA = new Date(a.lastMessage?.created_at || a.latestCheckin?.created_at || 0).getTime();
      const timeB = new Date(b.lastMessage?.created_at || b.latestCheckin?.created_at || 0).getTime();
      return timeB - timeA;
    });

    res.json({ conversations });
  } catch (err) {
    console.error('[CONVERSATIONS GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9. Web Mobile App Static Serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

if (fs.existsSync(distPath)) {
  console.log(`📦 [WEB] Serving Web Mobile App from: ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
async function start() {
  try {
    await waitForDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 [API] How Am I Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('❌ [API] Failed to start server:', err);
    process.exit(1);
  }
}

start();
