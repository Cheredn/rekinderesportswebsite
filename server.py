import sqlite3
import threading
import os
import logging
import asyncio
from flask import Flask, jsonify, send_from_directory, send_file, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from aiogram import Bot, Dispatcher, types, executor
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup

# ==========================================
# 1. КОНФИГУРАЦИЯ И НАСТРОЙКИ
# ==========================================

# Токен твоего бота
API_TOKEN = '8818093384:AAF8FHurnJxHFmuMKO2zPyIxr127A8vKDag'

# Список ID администраторов (только они могут управлять ботом)
ALLOWED_IDS = [1014379451, 8868074209]

# Базовая папка проекта
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Настройка Flask
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

# АНТИ-ДДОС СИСТЕМА (Настроена так, чтобы не блокировать своих)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["10000 per day", "1000 per hour"], # Огромные лимиты для всего сайта
    storage_uri="memory://"
)

# Логирование событий
logging.basicConfig(level=logging.INFO)

# Создание папки для логотипов противников
OPPONENTS_DIR = os.path.join(BASE_DIR, 'opponents')
if not os.path.exists(OPPONENTS_DIR):
    os.makedirs(OPPONENTS_DIR)

# ==========================================
# 2. РАБОТА С БАЗОЙ ДАННЫХ
# ==========================================

def init_db():
    """Инициализация базы данных и проверка колонок"""
    try:
        db_path = os.path.join(BASE_DIR, 'matches.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Создаем таблицу если её нет
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                opponent TEXT, 
                score TEXT, 
                status TEXT, 
                opp_logo TEXT
            )
        ''')
        
        # Проверяем, есть ли колонка для логотипов (на случай старой БД)
        cursor.execute("PRAGMA table_info(matches)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'opp_logo' not in columns:
            cursor.execute("ALTER TABLE matches ADD COLUMN opp_logo TEXT")
            print("База данных обновлена: добавлена колонка opp_logo")
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Критическая ошибка БД: {e}")

def get_matches():
    """Получение последних 5 матчей из базы"""
    try:
        db_path = os.path.join(BASE_DIR, 'matches.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT opponent, score, status, opp_logo FROM matches ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "opponent": r[0], 
                "score": r[1], 
                "status": r[2], 
                "opp_logo": r[3]
            } for r in rows
        ]
    except Exception as e:
        print(f"Ошибка при чтении матчей: {e}")
        return None

# ==========================================
# 3. МАРШРУТЫ САЙТА (FLASK)
# ==========================================

@app.route('/')
@app.route('/main')
@limiter.exempt # Снимаем любые ограничения на вход на сайт
def index():
    """Раздача главной страницы"""
    return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/style.css')
@limiter.exempt # Снимаем лимит на стили
def serve_css():
    """Раздача CSS с правильным типом данных"""
    response = make_response(send_file(os.path.join(BASE_DIR, 'style.css')))
    response.headers['Content-Type'] = 'text/css'
    return response

@app.route('/script.js')
@limiter.exempt # Снимаем лимит на скрипты
def serve_js():
    """Раздача JS с правильным типом данных"""
    response = make_response(send_file(os.path.join(BASE_DIR, 'script.js')))
    response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/api/matches', methods=['GET'])
@limiter.limit("120 per minute") # Ограничение только на обновление данных матчей
def api_get_matches():
    """Отдача данных о матчах в формате JSON"""
    data = get_matches()
    return jsonify(data if data is not None else [])

@app.route('/opponents/<path:filename>')
def serve_opp_logos(filename):
    """Раздача логотипов противников из папки"""
    return send_from_directory(OPPONENTS_DIR, filename)

@app.route('/<path:path>')
def send_static_files(path):
    """Раздача всех остальных файлов (картинки игроков и т.д.)"""
    return send_from_directory(BASE_DIR, path)

# ==========================================
# 4. ЛОГИКА ТЕЛЕГРАМ БОТА
# ==========================================

bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot, storage=MemoryStorage())

class MatchState(StatesGroup):
    waiting_for_text = State()
    waiting_for_photo = State()

async def notify_admins(text):
    """Рассылка системных уведомлений админам"""
    for admin_id in ALLOWED_IDS:
        try:
            await bot.send_message(admin_id, text)
        except:
            pass

# Проверка на права администратора
def is_admin(user_id):
    return user_id in ALLOWED_IDS

@dp.message_handler(lambda m: not is_admin(m.from_user.id), content_types=types.ContentTypes.ANY, state="*")
async def denied(message: types.Message):
    await message.answer("⛔ Доступ к управлению Rekinder eSports ограничен.")

@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("➕ Добавить игру", "🗑️ Очистить историю")
    kb.add("🩺 Статус сайта")
    await message.answer(f"Панель управления Rekinder eSports активна.\nВаш ID: {message.from_user.id}", reply_markup=kb)

@dp.message_handler(lambda message: message.text == "➕ Добавить игру")
async def add_start(message: types.Message):
    await message.answer("Шаг 1: Отправьте данные матча текстом.\nФормат: Соперник | Счет | WIN или LOSS")
    await MatchState.waiting_for_text.set()

@dp.message_handler(state=MatchState.waiting_for_text)
async def process_text(message: types.Message, state: FSMContext):
    if '|' not in message.text:
        await message.answer("❌ Ошибка формата! Используйте '|'.\nПример: NAVI | 13:5 | WIN")
        return
    await state.update_data(text=message.text)
    await message.answer("Шаг 2: Теперь отправьте ЛОГОТИП противника как фото.")
    await MatchState.waiting_for_photo.set()

@dp.message_handler(content_types=['photo'], state=MatchState.waiting_for_photo)
async def process_photo(message: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        parts = data['text'].split('|')
        opp, score, stat = parts[0].strip(), parts[1].strip(), parts[2].strip().upper()
        
        # Генерация имени файла логотипа
        photo_name = f"logo_{opp.replace(' ', '_').lower()}.png"
        photo_path = os.path.join(OPPONENTS_DIR, photo_name)
        
        # Скачивание фото
        await message.photo[-1].download(destination_file=photo_path)
        
        # Запись в базу данных
        db_path = os.path.join(BASE_DIR, 'matches.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO matches (opponent, score, status, opp_logo) VALUES (?, ?, ?, ?)", 
            (opp, score, stat, photo_name)
        )
        # Ограничиваем базу данных последними 5 записями
        cursor.execute("DELETE FROM matches WHERE id NOT IN (SELECT id FROM matches ORDER BY id DESC LIMIT 5)")
        conn.commit()
        conn.close()
        
        await message.answer("✅ Матч успешно добавлен и отображается на сайте!")
    except Exception as e:
        await message.answer(f"❌ Произошла ошибка: {e}")
        await notify_admins(f"🚨 Ошибка при добавлении матча: {e}")
    await state.finish()

@dp.message_handler(lambda message: message.text == "🗑️ Очистить историю")
async def clear_history(message: types.Message):
    try:
        db_path = os.path.join(BASE_DIR, 'matches.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM matches")
        conn.commit()
        conn.close()
        await message.answer("🗑️ Вся история матчей удалена с сайта.")
    except Exception as e:
        await message.answer("❌ Ошибка при очистке.")

@dp.message_handler(lambda message: message.text == "🩺 Статус сайта")
async def check_status(message: types.Message):
    matches = get_matches()
    status = "🟢 ОНЛАЙН" if matches is not None else "🔴 ОШИБКА БД"
    count = len(matches) if matches else 0
    await message.answer(f"Статус системы: {status}\nМатчей в базе: {count}")

@dp.errors_handler()
async def global_error_handler(update, exception):
    await notify_admins(f"⚠️ ВНУТРЕННЯЯ ОШИБКА БОТА:\n{exception}")
    return True

# ==========================================
# 5. ЗАПУСК СЕРВЕРА
# ==========================================

def run_flask():
    """Запуск Flask сервера на порту хостинга"""
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Инициализируем БД
    init_db()
    # Запускаем Flask в отдельном потоке
    threading.Thread(target=run_flask, daemon=True).start()
    print(">>> Сервер Rekinder eSports запущен и готов к работе.")
    # Запускаем бота
    executor.start_polling(dp, skip_updates=True)