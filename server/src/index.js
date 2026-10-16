import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
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

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'HowAmI_App_Bot';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

// Telegram Deep Link session creation
app.post('/api/auth/telegram/session', async (req, res) => {
  try {
    const authCode = crypto.randomBytes(12).toString('hex');
    await query(
      `INSERT INTO telegram_auth_sessions (auth_code, status) VALUES ($1, 'pending')`,
      [authCode]
    );
    const botUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=auth_${authCode}`;
    res.json({
      success: true,
      authCode,
      botUrl,
      botUsername: TELEGRAM_BOT_USERNAME,
    });
  } catch (err) {
    console.error('[AUTH] Telegram session create error:', err);
    res.status(500).json({ error: 'Не удалось создать сессию авторизации Telegram' });
  }
});

// Check if Telegram auth session was approved
app.get('/api/auth/telegram/session/status', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Не указан authCode' });
    }
    const sessionRes = await query(
      `SELECT * FROM telegram_auth_sessions WHERE auth_code = $1 AND expires_at > NOW()`,
      [code]
    );
    if (sessionRes.rows.length === 0) {
      return res.json({ completed: false, status: 'expired' });
    }
    const session = sessionRes.rows[0];
    if (session.status === 'completed' && session.user_id) {
      const userRes = await query('SELECT * FROM users WHERE id = $1', [session.user_id]);
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        const token = signUserToken(user);
        return res.json({
          completed: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            inviteCode: user.invite_code,
          },
        });
      }
    }
    res.json({ completed: false, status: session.status });
  } catch (err) {
    console.error('[AUTH] Telegram session status check error:', err);
    res.status(500).json({ error: 'Ошибка проверки сессии' });
  }
});

// Telegram Bot Webhook endpoint (handles /start auth_<code_here>)
app.post('/api/auth/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    const msg = update?.message;
    if (!msg || !msg.text) {
      return res.json({ ok: true });
    }

    const text = msg.text.trim();
    const from = msg.from;
    const chatId = msg.chat?.id;

    if (text.startsWith('/start auth_')) {
      const authCode = text.replace('/start auth_', '').trim();
      const tgId = String(from.id);
      const tgUsername = from.username ? `@${from.username}` : '';
      const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ') || tgUsername || 'Пользователь';
      const tgEmail = `tg_${tgId}@telegram.user`;

      // Find or create internal user (user.id is always internal UUID)
      let userRes = await query(
        'SELECT * FROM users WHERE telegram_id = $1 OR email = $2 OR google_id = $3',
        [tgId, tgEmail, `tg:${tgId}`]
      );
      let user;
      if (userRes.rows.length === 0) {
        const inviteCode = generateInviteCode(6);
        const insertRes = await query(
          `INSERT INTO users (telegram_id, email, name, invite_code)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [tgId, tgEmail, displayName, inviteCode]
        );
        user = insertRes.rows[0];
      } else {
        user = userRes.rows[0];
        await query(
          'UPDATE users SET telegram_id = $1, name = COALESCE(name, $2), updated_at = NOW() WHERE id = $3',
          [tgId, displayName, user.id]
        );
      }

      // Complete session
      await query(
        `UPDATE telegram_auth_sessions
         SET status = 'completed', user_id = $1, telegram_id = $2, telegram_user = $3
         WHERE auth_code = $4`,
        [user.id, tgId, JSON.stringify(from), authCode]
      );

      // Reply back to user in Telegram if BOT_TOKEN configured
      if (TELEGRAM_BOT_TOKEN && chatId) {
        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `✨ Добро пожаловать в «Как Я?», ${from.first_name || 'друг'}!\n\nАвторизация прошла успешно. Можете вернуться в приложение — вход выполнен автоматически!`,
          });
        } catch (tgErr) {
          console.warn('[AUTH] Could not send TG confirmation message:', tgErr.message);
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] Telegram webhook error:', err);
    res.json({ ok: true });
  }
});

// Telegram auth / direct registration fallback
app.post('/api/auth/telegram', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, photoUrl, name } = req.body;
    const rawId = telegramId || username;
    if (!rawId) {
      return res.status(400).json({ error: 'Укажите telegramId или username' });
    }

    const cleanUsername = username ? username.replace(/^@/, '').trim() : '';
    const cleanId = String(rawId).replace(/^@/, '').trim();
    const googleId = `tg:${cleanId.toLowerCase()}`;
    const tgId = /^\d+$/.test(cleanId) ? cleanId : null;
    const email = `tg_${cleanId.toLowerCase()}@telegram.user`;
    const displayName = name || [firstName, lastName].filter(Boolean).join(' ') || (cleanUsername ? `@${cleanUsername}` : cleanId);
    const avatarUrl = photoUrl || null;

    // Check if user exists by telegram_id, google_id or email
    let userRes = await query('SELECT * FROM users WHERE telegram_id = $1 OR google_id = $2 OR email = $3', [cleanId, googleId, email]);
    let user;

    if (userRes.rows.length === 0) {
      const inviteCode = generateInviteCode(6);
      const insertRes = await query(
        `INSERT INTO users (telegram_id, google_id, email, name, avatar_url, invite_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tgId || cleanId, googleId, email, displayName, avatarUrl, inviteCode]
      );
      user = insertRes.rows[0];
      console.log(`[AUTH] New Telegram user created: ${user.name} (${user.email}), code: ${user.invite_code}`);
    } else {
      user = userRes.rows[0];
      const updateRes = await query(
        `UPDATE users
         SET telegram_id = COALESCE($1, telegram_id),
             google_id = COALESCE($2, google_id),
             name = COALESCE($3, name),
             avatar_url = COALESCE($4, avatar_url),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [tgId || cleanId, googleId, displayName, avatarUrl, user.id]
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
    console.error('[AUTH] Telegram auth error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка авторизации через Telegram' });
  }
});

// Apple Sign In (App Store Guideline 4.8 compliant)
app.post('/api/auth/apple', async (req, res) => {
  try {
    const { appleId, email, fullName, identityToken } = req.body;
    if (!appleId && !email && !identityToken) {
      return res.status(400).json({ error: 'Требуется appleId, email или identityToken' });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanAppleId = appleId ? String(appleId).trim() : (identityToken ? `apple_${crypto.createHash('sha256').update(identityToken).digest('hex').slice(0, 16)}` : null);
    const userEmail = cleanEmail || (cleanAppleId ? `apple_${cleanAppleId.slice(-8)}@privaterelay.appleid.com` : null);
    const displayName = fullName || (cleanEmail ? cleanEmail.split('@')[0] : 'Пользователь Apple');

    // Find existing user by apple_id OR email (crucial for account linking!)
    let userRes = await query(
      `SELECT * FROM users WHERE (apple_id IS NOT NULL AND apple_id = $1) OR (email IS NOT NULL AND email = $2)`,
      [cleanAppleId, userEmail]
    );
    let user;

    if (userRes.rows.length === 0) {
      const inviteCode = generateInviteCode(6);
      const insertRes = await query(
        `INSERT INTO users (apple_id, email, name, invite_code)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [cleanAppleId, userEmail, displayName, inviteCode]
      );
      user = insertRes.rows[0];
      console.log(`[AUTH] New Apple user created: ${user.name} (${user.email}), code: ${user.invite_code}`);
    } else {
      user = userRes.rows[0];
      const updateRes = await query(
        `UPDATE users
         SET apple_id = COALESCE(apple_id, $1),
             name = COALESCE(name, $2),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [cleanAppleId, displayName, user.id]
      );
      user = updateRes.rows[0];
      console.log(`[AUTH] Apple account linked to user: ${user.name} (${user.email})`);
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
    console.error('[AUTH] Apple auth error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка авторизации через Apple' });
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

    // Update user's last_seen_at timestamp
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]).catch(() => {});

    // Get partners with online status (active within last 3 minutes)
    const partnersRes = await query(
      `SELECT u.id, u.name, u.avatar_url, u.email, f.status, f.created_at,
              u.last_seen_at,
              (u.last_seen_at IS NOT NULL AND (NOW() - u.last_seen_at) < INTERVAL '3 minutes') as is_online
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
      partners: partnersRes.rows.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        avatarUrl: p.avatar_url,
        status: p.status,
        isOnline: Boolean(p.is_online),
        lastSeenAt: p.last_seen_at,
      })),
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

    let finalEnergy = energy;
    let finalPleasantness = pleasantness;
    if (!finalEnergy || !finalPleasantness) {
      if (quadrant === 'high_pleasant') {
        finalEnergy = finalEnergy || 'high';
        finalPleasantness = finalPleasantness || 'pleasant';
      } else if (quadrant === 'high_unpleasant') {
        finalEnergy = finalEnergy || 'high';
        finalPleasantness = finalPleasantness || 'unpleasant';
      } else if (quadrant === 'low_pleasant') {
        finalEnergy = finalEnergy || 'low';
        finalPleasantness = finalPleasantness || 'pleasant';
      } else if (quadrant === 'low_unpleasant') {
        finalEnergy = finalEnergy || 'low';
        finalPleasantness = finalPleasantness || 'unpleasant';
      } else {
        finalEnergy = finalEnergy || 'low';
        finalPleasantness = finalPleasantness || 'pleasant';
      }
    }

    if (!emotionId || !quadrant) {
      return res.status(400).json({ error: 'Обязательные поля: emotionId, quadrant' });
    }

    const insertRes = await query(
      `INSERT INTO checkins (
         user_id, local_id, emotion_id, energy, pleasantness, intensity, quadrant,
         context_people, context_place, context_activity, note, share_with_partners, created_at, emotions, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, NOW()), $14, false)
       RETURNING *`,
      [
        req.user.userId,
        localId || null,
        emotionId,
        finalEnergy,
        finalPleasantness,
        intensity || 2,
        quadrant,
        JSON.stringify(contextPeople || []),
        JSON.stringify(contextPlace || []),
        JSON.stringify(contextActivity || []),
        note || null,
        shareWithPartners !== false,
        createdAt || null,
        JSON.stringify(emotions || []),
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

// 7. Get user's checkins (excluding soft-deleted)
app.get('/api/checkins', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '200', 10);
    const checkinsRes = await query(
      'SELECT * FROM checkins WHERE user_id = $1 AND (is_deleted = false OR is_deleted IS NULL) ORDER BY created_at DESC LIMIT $2',
      [req.user.userId, limit]
    );
    res.json({ checkins: checkinsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7a. Batch sync check-ins from guest session to authenticated profile
app.post('/api/checkins/sync-batch', authMiddleware, async (req, res) => {
  try {
    const { checkins } = req.body;
    if (!Array.isArray(checkins) || checkins.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    let inserted = 0;
    for (const item of checkins) {
      const localId = item.id || item.localId;
      const emotionId = item.emotionId || item.emotions?.[0]?.id || 'доволен';
      const quadrant = item.quadrantId || item.quadrant || 'low_pleasant';
      const energy = item.energy || (quadrant.includes('high') ? 'high' : 'low');
      const pleasantness = item.pleasantness || (quadrant.includes('pleasant') && !quadrant.includes('unpleasant') ? 'pleasant' : 'unpleasant');
      const intensity = item.intensity || 2;
      const emotionsList = item.emotions && item.emotions.length > 0 ? item.emotions : [{ id: emotionId, quadrantId: quadrant, intensity }];
      const contextPeople = item.context?.people || [];
      const contextPlace = item.context?.location || item.context?.place || [];
      const contextActivity = item.context?.activity || [];
      const note = item.note || null;
      const createdAt = item.timestamp || item.created_at || null;

      // Check if this checkin already exists
      const existing = await query(
        `SELECT id FROM checkins 
         WHERE user_id = $1 AND (
           (local_id IS NOT NULL AND local_id = $2)
           OR (created_at = $3::timestamp with time zone)
         )`,
        [req.user.userId, localId, createdAt]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO checkins (
             user_id, local_id, emotion_id, energy, pleasantness, intensity, quadrant,
             context_people, context_place, context_activity, note, share_with_partners, created_at, emotions, is_deleted
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, COALESCE($12, NOW()), $13, false)`,
          [
            req.user.userId,
            localId,
            emotionId,
            energy,
            pleasantness,
            intensity,
            quadrant,
            JSON.stringify(contextPeople),
            JSON.stringify(contextPlace),
            JSON.stringify(contextActivity),
            note,
            createdAt,
            JSON.stringify(emotionsList),
          ]
        );
        inserted++;
      }
    }

    res.json({ success: true, count: inserted });
  } catch (err) {
    console.error('[CHECKIN] Batch sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7b. Soft Delete Check-in (never physically destroy or overwrite records!)
app.delete('/api/checkins/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE checkins 
       SET is_deleted = true, deleted_at = NOW() 
       WHERE user_id = $1 AND (id::text = $2 OR local_id = $2)
       RETURNING id, local_id, is_deleted, deleted_at`,
      [req.user.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    res.json({ success: true, softDeleted: true, checkin: result.rows[0] });
  } catch (err) {
    console.error('[CHECKIN] Soft delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Partner feed: Get partners' checkins (excluding soft-deleted)
app.get('/api/partner/feed', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '30', 10);
    const feedRes = await query(
      `SELECT c.*, u.name as user_name, u.avatar_url as user_avatar
       FROM checkins c
       JOIN users u ON u.id = c.user_id
       JOIN friendships f ON f.friend_id = c.user_id
       WHERE f.user_id = $1 AND f.status = 'accepted' AND f.share_checkins = true 
         AND (c.share_with_partners = true OR c.share_with_partners IS NULL)
         AND (c.is_deleted = false OR c.is_deleted IS NULL)
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

    // Mark messages sent to current user in this conversation as read
    await query(
      `UPDATE messages
       SET is_read = true
       WHERE conversation_id = $1 AND to_user_id = $2 AND is_read = false`,
      [conversationId, req.user.userId]
    ).catch(() => {});

    // Update current user's activity
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [req.user.userId]).catch(() => {});

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
      `SELECT u.id, u.name, u.avatar_url, u.email, f.status, f.created_at as friendship_date,
              u.last_seen_at,
              (u.last_seen_at IS NOT NULL AND (NOW() - u.last_seen_at) < INTERVAL '3 minutes') as is_online
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
          isOnline: Boolean(friend.is_online),
          lastSeenAt: friend.last_seen_at,
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
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
async function start() {
  try {
    await waitForDb();

    // Auto-migrate database schema for Telegram deep link & Apple auth
    try {
      await query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id) WHERE apple_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS telegram_auth_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            auth_code VARCHAR(64) UNIQUE NOT NULL,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            telegram_id VARCHAR(64),
            telegram_user JSONB,
            status VARCHAR(32) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes'
        );
        CREATE INDEX IF NOT EXISTS idx_tg_auth_code ON telegram_auth_sessions(auth_code);
      `);
      console.log('✅ [DB] Schema migrations applied (telegram_id, apple_id, telegram_auth_sessions)');
    } catch (migErr) {
      console.warn('[DB] Migration note:', migErr.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 [API] How Am I Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('❌ [API] Failed to start server:', err);
    process.exit(1);
  }
}

start();
