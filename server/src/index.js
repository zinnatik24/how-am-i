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

    // Find all partners to send push notification ONLY IF sharing is enabled
    if (shareWithPartners !== false) {
      const partnersRes = await query(
        `SELECT u.push_token, u.name as partner_name, cur.name as sender_name
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         JOIN users cur ON cur.id = f.user_id
         WHERE f.user_id = $1 AND f.status = 'accepted' AND f.notify_push = true AND u.push_token IS NOT NULL`,
        [req.user.userId]
      );

      if (partnersRes.rows.length > 0) {
        const senderName = partnersRes.rows[0].sender_name || 'Близкий человек';
        const emotionTitle = emotionNameRu || emotionId;
        const quadTitle = quadrantNameRu ? ` (${quadrantNameRu})` : '';

        const tokens = partnersRes.rows.map(p => p.push_token);
        sendExpoPushNotification(
          tokens,
          `💛 ${senderName} отметил(а) настроение`,
          `Чувствует: ${emotionTitle}${quadTitle}`,
          {
            type: 'checkin',
            checkinId: checkin.id,
            senderName,
            emotionId,
          }
        );
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
    if (partner.push_token) {
      sendExpoPushNotification(
        partner.push_token,
        `💭 ${senderName} интересуется: «Как ты?»`,
        'Уделите минутку, чтобы отметить своё настроение в приложении.',
        { type: 'care_ping', senderId: req.user.userId, senderName }
      );
    }

    res.json({ success: true, message: 'Пинг заботы отправлен!' });
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

    // Send push
    if (partner.push_token) {
      sendExpoPushNotification(
        partner.push_token,
        `❤️ ${senderName} отправил(а) знак заботы`,
        reactionLabel,
        { type: 'care_reaction', senderId: req.user.userId, reactionLabel }
      );
    }

    res.json({ success: true, message: 'Реакция отправлена!' });
  } catch (err) {
    console.error('[REACTION] Error:', err);
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
