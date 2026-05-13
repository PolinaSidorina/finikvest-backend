const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SALT_ROUNDS = 10;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.message);
  } else {
    console.log('PostgreSQL подключена');

    release();
  }
});

app.get('/', (req, res) => {
  res.send('Сервер Финиквестов работает!');
});

app.post('/api/auth/register', async (req, res) => {
  let { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [username, email, hashedPassword]
      );

      const userId = userResult.rows[0].id;
      await client.query('INSERT INTO user_progress (user_id) VALUES ($1)', [userId]);
      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Пользователь создан',
        userId: userId,
        username: username,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    res.json({
      success: true,
      userId: user.id,
      username: user.username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

app.get('/api/progress/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'userId обязателен' });
  }
  try {
    const result = await pool.query(
      'SELECT balance, budget, covers, completed_quests, current_quest_id, goal FROM user_progress WHERE user_id=$1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Прогресс не найден' });
    }
    const progress = result.rows[0];
    if (progress.covers) {
      if (typeof progress.covers === 'string') {
        progress.covers = JSON.parse(progress.covers);
      }
    }
    if (progress.goal && typeof progress.goal === 'string') {
      progress.goal = JSON.parse(progress.goal);
    } else if (progress.goal) {
      progress.goal = progress.goal;
    }
    res.json(progress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки прогресса' });
  }
});

app.post('/api/progress', async (req, res) => {
  const { userId, balance, budget, covers, completedQuests, currentQuestId, goal } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId обязателен' });
  }
  try {
    const coverJson = JSON.stringify(covers);
    const goalJson = goal ? JSON.stringify(goal) : null;

    const result = await pool.query(
      `UPDATE user_progress
        SET balance=$1,
        budget=$2,
        covers=$3,
        completed_quests=$4,
        current_quest_id=$5,
        goal=$6,
        updated_at=NOW()
        WHERE user_id=$7
        RETURNING *`,
      [balance, budget, coverJson, completedQuests, currentQuestId, goalJson, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ success: true, message: 'Прогресс сохранен' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения прогресса' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/quests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quests ORDER BY id');
    const quests = result.rows.map((quest) => ({
      ...quest,
      steps: quest.steps,
    }));
    res.json(quests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения списка квестов' });
  }
});

app.post('/api/admin/quests', async (req, res) => {
  const { title, description, reward, type, x, y, steps } = req.body;
  if (!title || !description || !reward || !type || !x || !y || !steps) {
    return res.status(400).json({ error: 'Не хватает данных для создания квеста' });
  }
  try {
    const stepsJson = JSON.stringify(steps);
    const result = await pool.query(
      `INSERT INTO quests (title, description, reward, type, x, y, steps)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      RETURNING *`,
      [title, description, reward, type, x, y, stepsJson]
    );
    const newQuest = result.rows[0];
    newQuest.steps = newQuest.steps;
    res.status(201).json(newQuest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания квеста на сервере' });
  }
});

app.put('/api/admin/quests/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, reward, type, x, y, steps } = req.body;

  if (!title || !description || !reward || !type || !x || !y || !steps) {
    return res.status(400).json({ error: 'Не хватает данных для обновления квеста' });
  }
  try {
    const stepsJson = JSON.stringify(steps);
    const result = await pool.query(
      `UPDATE quests
      SET title=$1, description=$2,reward=$3, type=$4, x=$5, y=$6, steps=$7
      WHERE id=$8
      RETURNING *`,
      [title, description, reward, type, x, y, stepsJson, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Квест не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления квеста' });
  }
});

app.delete('/api/admin/quests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM quests WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Квест не найден' });
    }
    res.json({ success: true, message: 'Квест удален' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления квеста' });
  }
});

app.post('/api/auth/send-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email обязателен' });
  }

  try {
    const result = await pool.query('SELECT id, is_verified FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    const user = result.rows[0];
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email уже подтвержден' });
    }
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Код для ${email}: ${verificationCode}`);

    await pool.query('UPDATE users SET verification_code=$1 WHERE id=$2', [
      verificationCode,
      user.id,
    ]);
    //TODO
    res.json({ success: true, message: 'Код подтверждения отправлен (проверьте консоль сервера)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при отправке кода' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email и код обязательны' });
  }
  try {
    const result = await pool.query(
      'SELECT id, verification_code, is_verified FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];
    if (user.is_verified) {
      return res.status(400).json({ error: 'Email уже подтверждён' });
    }
    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }
    await pool.query(
      'UPDATE users SET is_verified = true, verification_code = NULL WHERE id = $1',
      [user.id]
    );

    res.json({ success: true, message: 'Email успешно подтверждён!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка при подтверждении email' });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
}
