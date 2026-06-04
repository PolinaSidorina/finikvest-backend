# Финиквест — Бэкенд

Серверная часть веб-приложения для обучения детей финансовой грамотности.

## Демо

Базовый URL: https://finikvest-backend-production.up.railway.app

Проверка здоровья: https://finikvest-backend-production.up.railway.app/api/health

## О проекте

Бэкенд обеспечивает хранение пользовательских данных, аутентификацию, управление прогрессом и квестами.

Основные возможности:

- Регистрация и аутентификация пользователей
- Подтверждение email через Resend
- Сохранение и загрузка прогресса
- Управление квестами (CRUD через админ-панель)

## Технологии

- Node.js 18.20.8
- Express 4.18.2
- PostgreSQL 15+
- bcrypt 5.1.0
- Resend

## Установка и запуск

Требования:

- Node.js 18.x или выше
- PostgreSQL 15.x (или облачный Supabase)

Установка зависимости:
npm install

Настройка окружения:

Создайте файл .env в корне проекта:

PORT=5000

DB*USER=postgres

DB_HOST=localhost

DB_NAME=finikvest_db

DB_PASSWORD=ваш*пароль

DB*PORT=5432

RESEND_API_KEY=ваш_api*ключ

Создание базы данных:

Подключитесь к PostgreSQL и выполните SQL-скрипты создания таблиц

-- Таблица пользователей

CREATE TABLE IF NOT EXISTS users (

    id SERIAL PRIMARY KEY,

    username VARCHAR(100) NOT NULL,

    email TEXT UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    is_verified BOOLEAN DEFAULT FALSE,

    verification_code TEXT,

    created_at TIMESTAMP DEFAULT NOW()

);

-- Таблица прогресса

CREATE TABLE IF NOT EXISTS user_progress (

    id SERIAL PRIMARY KEY,

    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    balance INTEGER DEFAULT 0,

    budget INTEGER DEFAULT 0,

    covers JSONB DEFAULT '{"needs":0,"wants":0,"savings":0,"good":0}',
    
    completed_quests INTEGER[] DEFAULT '{}',

    current_quest_id INTEGER,

    goal JSONB DEFAULT NULL,

    updated_at TIMESTAMP DEFAULT NOW()

);

-- Таблица квестов

CREATE TABLE IF NOT EXISTS quests (

    id SERIAL PRIMARY KEY,

    title TEXT NOT NULL,

    description TEXT NOT NULL,

    reward INTEGER NOT NULL,

    type TEXT NOT NULL,

    x TEXT NOT NULL,

    y TEXT NOT NULL,

    steps JSONB NOT NULL,

    created_at TIMESTAMP DEFAULT NOW()

);

Запуск в режиме разработки:
npm run dev

Сервер будет доступен по адресу: http://localhost:5000

Запуск в продакшен-режиме:
npm start

## Структура проекта

├── server.js Главный файл сервера

├── package.json Зависимости

├── .env Переменные окружения

└── node_modules/ Зависимости

## API Эндпоинты

Аутентификация:

| Метод | Эндпоинт                    | Назначение                  |
| ----- | --------------------------- | --------------------------- |
| POST  | /api/auth/register          | Регистрация                 |
| POST  | /api/auth/login             | Вход                        |
| POST  | /api/auth/send-verification | Отправка кода подтверждения |
| POST  | /api/auth/verify-email      | Подтверждение email         |

Прогресс пользователя:

| Метод | Эндпоинт              | Назначение           |
| ----- | --------------------- | -------------------- |
| GET   | /api/progress/:userId | Получение прогресса  |
| POST  | /api/progress         | Сохранение прогресса |

Квесты (админ-панель):

| Метод  | Эндпоинт              | Назначение               |
| ------ | --------------------- | ------------------------ |
| GET    | /api/quests           | Получение списка квестов |
| POST   | /api/admin/quests     | Создание квеста          |
| PUT    | /api/admin/quests/:id | Обновление квеста        |
| DELETE | /api/admin/quests/:id | Удаление квеста          |

Проверка здоровья:

| Метод | Эндпоинт    | Назначение                 |
| ----- | ----------- | -------------------------- |
| GET   | /api/health | Проверка работоспособности |

## База данных

Таблицы:

- users — пользователи (id, username, email, password_hash, is_verified, verification_code)
- user_progress — прогресс пользователя (balance, budget, covers, completed_quests, goal)
- quests — квесты (title, description, reward, type, x, y, steps)

Связи:

- user_progress.user_id -> users.id (один к одному, каскадное удаление)

## Деплой

Проект развёрнут на платформе Railway. Автоматический деплой происходит при пуше в GitHub. Переменные окружения настраиваются в панели управления.

## Автор

Сидорина Полина Андреевна, ННГУ им. Н.И. Лобачевского, 2026