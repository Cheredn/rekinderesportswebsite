import sqlite3
import threading
import os
import logging
import asyncio
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from aiogram import Bot, Dispatcher, types, executor
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup

# --- НАСТРОЙКИ ---
API_TOKEN = '8818093384:AAF8FHurnJxHFmuMKO2zPyIxr127A8vKDag'
ALLOWED_IDS = [1014379451, 8868074209]

# Указываем Flask, что текущая папка содержит сайт
app = Flask(__name__, static_folder='.', template_folder='.')
CORS(app)

# АНТИ-ДДОС (Лимит запросов к API)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["300 per day", "100 per hour"],
    storage_uri="memory://"
)

logging.basicConfig(level=logging.INFO)

if not os.path.exists('opponents'):
    os.makedirs('opponents')

# --- БАЗА ДАННЫХ ---
def init_db():
    try:
        conn = sqlite3.connect('matches.db')
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS matches 
                          (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                           opponent TEXT, score TEXT, status TEXT, opp_logo TEXT)''')
        cursor.execute("PRAGMA table_info(matches)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'opp_logo' not in columns:
            cursor.execute("ALTER TABLE matches ADD COLUMN opp_logo TEXT")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

def get_matches():
    try:
        conn = sqlite3.connect('matches.db')
        cursor = conn.cursor()
        cursor.execute("SELECT opponent, score, status, opp_logo FROM matches ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()
        conn.close()
        return [{"opponent": r[0], "score": r[1], "status": r[2], "opp_logo": r[3]} for r in rows]
    except:
        return None

# --- МАРШРУТЫ САЙТА ---

@app.route('/')
@app.route('/main')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/matches', methods=['GET'])
@limiter.limit("20 per minute")
def api_get_matches():
    data = get_matches()
    return jsonify(data if data is not None else [])

@app.route('/opponents/<path:filename>')
def serve_opp_logos(filename):
    return send_from_directory('opponents', filename)

@app.route('/<path:path>')
def send_static(path):
    return send_from_directory('.', path)

# --- ТЕЛЕГРАМ БОТ ---
bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot, storage=MemoryStorage())

async def notify_admins(text):
    for admin_id in ALLOWED_IDS:
        try: await bot.send_message(admin_id, text)
        except: pass

class MatchState(StatesGroup):
    waiting_for_text = State()
    waiting_for_photo = State()

@dp.message_handler(lambda m: m.from_user.id not in ALLOWED_IDS, content_types=types.ContentTypes.ANY, state="*")
async def denied(m: types.Message):
    await m.answer("⛔ Доступ ограничен.")

@dp.message_handler(commands=['start'])
async def cmd_start(m: types.Message):
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("➕ Добавить игру", "🗑️ Очистить историю", "🩺 Статус")
    await m.answer(f"Rekinder eSports Admin Panel.\nID: {m.from_user.id}", reply_markup=kb)

@dp.message_handler(lambda m: m.text == "➕ Добавить игру")
async def add_start(m: types.Message):
    await m.answer("Шаг 1: Соперник | Счет | WIN или LOSS")
    await MatchState.waiting_for_text.set()

@dp.message_handler(state=MatchState.waiting_for_text)
async def process_t(m: types.Message, state: FSMContext):
    if '|' not in m.text:
        await m.answer("❌ Формат! Пример: NAVI | 13:5 | WIN")
        return
    await state.update_data(text=m.text)
    await m.answer("Шаг 2: Отправь ЛОГО (картинкой)")
    await MatchState.waiting_for_photo.set()

@dp.message_handler(content_types=['photo'], state=MatchState.waiting_for_photo)
async def process_p(m: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        parts = data['text'].split('|')
        opp, score, stat = parts[0].strip(), parts[1].strip(), parts[2].strip().upper()
        photo_name = f"logo_{opp.replace(' ', '_')}.png"
        await m.photo[-1].download(destination_file=os.path.join('opponents', photo_name))
        conn = sqlite3.connect('matches.db')
        cursor = conn.cursor()
        cursor.execute("INSERT INTO matches (opponent, score, status, opp_logo) VALUES (?, ?, ?, ?)", (opp, score, stat, photo_name))
        cursor.execute("DELETE FROM matches WHERE id NOT IN (SELECT id FROM matches ORDER BY id DESC LIMIT 5)")
        conn.commit(); conn.close()
        await m.answer("✅ Матч добавлен!")
    except Exception as e:
        await m.answer(f"Ошибка: {e}")
    await state.finish()

@dp.message_handler(lambda m: m.text == "🗑️ Очистить историю")
async def clr(m: types.Message):
    conn = sqlite3.connect('matches.db'); cursor = conn.cursor()
    cursor.execute("DELETE FROM matches"); conn.commit(); conn.close()
    await m.answer("🗑️ История очищена.")

@dp.message_handler(lambda m: m.text == "🩺 Статус")
async def sts(m: types.Message):
    matches = get_matches()
    await m.answer(f"Сервер: 🟢\nБаза: {len(matches) if matches else 0}")

def run_flask():
    # Render сам подставит порт в переменную окружения PORT
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

if __name__ == '__main__':
    init_db()
    threading.Thread(target=run_flask, daemon=True).start()
    executor.start_polling(dp, skip_updates=True)