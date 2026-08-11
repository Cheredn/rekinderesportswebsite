import sqlite3, threading, os, logging, asyncio
from flask import Flask, jsonify, send_from_directory, send_file, make_response
from flask_cors import CORS
from aiogram import Bot, Dispatcher, types, executor
from aiogram.contrib.fsm_storage.memory import MemoryStorage
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup

# --- CONFIG ---
API_TOKEN = '8818093384:AAF8FHurnJxHFmuMKO2zPyIxr127A8vKDag'
ALLOWED_IDS = [1014379451, 8868074209]
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

logging.basicConfig(level=logging.INFO)
OPPONENTS_DIR = os.path.join(BASE_DIR, 'opponents')
if not os.path.exists(OPPONENTS_DIR): os.makedirs(OPPONENTS_DIR)

# --- DATABASE SETUP ---
def init_db():
    try:
        db_path = os.path.join(BASE_DIR, 'matches.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Таблица матчей
        cursor.execute('''CREATE TABLE IF NOT EXISTS matches 
            (id INTEGER PRIMARY KEY AUTOINCREMENT, opponent TEXT, score TEXT, status TEXT, opp_logo TEXT)''')
        # Таблица игроков
        cursor.execute('''CREATE TABLE IF NOT EXISTS players 
            (id INTEGER PRIMARY KEY, nickname TEXT, role TEXT, photo TEXT, team TEXT, is_captain INTEGER)''')
        
        # Дефолтный состав
        cursor.execute("SELECT count(*) FROM players")
        if cursor.fetchone()[0] == 0:
            # Main
            main = [
                (1, 'SAL1CH', 'OpenFragger', 'sal1ch.png', 'main', 0),
                (2, 'AWESOME', 'Sniper', 'awesome.png', 'main', 0),
                (3, 'SHNYROQ', 'In-Game Leader', 'shnyroq.png', 'main', 1),
                (4, 'TAKUYA', 'Lurker', 'takuya.png', 'main', 0),
                (5, 'LASQUA', 'OpenFragger', 'lasqua.png', 'main', 0)
            ]
            # Junior
            junior = [(i, 'UNKNOWN', 'Unknown', 'logo.png', 'junior', 0) for i in range(10, 15)]
            cursor.executemany("INSERT INTO players VALUES (?,?,?,?,?,?)", main + junior)
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

# --- API ROUTES ---
@app.route('/')
@app.route('/main')
def index(): return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/style.css')
def serve_css():
    res = make_response(send_file(os.path.join(BASE_DIR, 'style.css')))
    res.headers['Content-Type'] = 'text/css'; return res

@app.route('/script.js')
def serve_js():
    res = make_response(send_file(os.path.join(BASE_DIR, 'script.js')))
    res.headers['Content-Type'] = 'application/javascript'; return res

@app.route('/api/matches')
def api_matches():
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT opponent, score, status, opp_logo FROM matches ORDER BY id DESC LIMIT 5")
    data = [{"opponent": r[0], "score": r[1], "status": r[2], "opp_logo": r[3]} for r in cursor.fetchall()]
    conn.close(); return jsonify(data)

@app.route('/api/players')
def api_players():
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT nickname, role, photo, team, is_captain FROM players ORDER BY id ASC")
    data = [{"nick": r[0], "role": r[1], "photo": r[2], "team": r[3], "cap": r[4]} for r in cursor.fetchall()]
    conn.close(); return jsonify(data)

@app.route('/opponents/<path:f>')
def serve_opp(f): return send_from_directory(OPPONENTS_DIR, f)

@app.route('/<path:path>')
def send_static(path): return send_from_directory(BASE_DIR, path)

# --- BOT LOGIC ---
bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot, storage=MemoryStorage())

class States(StatesGroup):
    m_t = State() # match text
    m_p = State() # match photo
    p_t = State() # player text
    p_p = State() # player photo

# ПРОВЕРКА ДОСТУПА: Если не админ - игнорим или отвечаем
@dp.message_handler(lambda m: m.from_user.id not in ALLOWED_IDS, state="*")
async def denied(m: types.Message):
    await m.answer("⛔ Доступ ограничен.")

@dp.message_handler(commands=['start'], user_id=ALLOWED_IDS)
async def cmd_start(m: types.Message):
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("➕ Добавить игру", "👤 Изменить игрока")
    kb.add("🗑️ Очистить игры", "🩺 Статус")
    await m.answer("Управление Rekinder eSports", reply_markup=kb)

# --- ИЗМЕНЕНИЕ ИГРОКА ---
@dp.message_handler(lambda m: m.text == "👤 Изменить игрока", user_id=ALLOWED_IDS)
async def edit_p(m: types.Message):
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT id, nickname, team FROM players")
    ps = cursor.fetchall(); conn.close()
    kb = types.InlineKeyboardMarkup()
    for p in ps:
        kb.add(types.InlineKeyboardButton(f"{p[2].upper()}: {p[1]}", callback_data=f"p_{p[0]}"))
    await m.answer("Кого меняем?", reply_markup=kb)

@dp.callback_query_handler(lambda c: c.data.startswith('p_'), user_id=ALLOWED_IDS)
async def p_call(c: types.CallbackQuery, state: FSMContext):
    await state.update_data(pid=c.data.split('_')[1])
    await c.message.answer("Пиши: НИК | РОЛЬ | КАПИТАН(1/0)\nНапр: LASQUA | OpenFragger | 0")
    await States.p_t.set()

@dp.message_handler(state=States.p_t, user_id=ALLOWED_IDS)
async def p_txt(m: types.Message, state: FSMContext):
    await state.update_data(t=m.text)
    await m.answer("Скинь ФОТО игрока")
    await States.p_p.set()

@dp.message_handler(content_types=['photo'], state=States.p_p, user_id=ALLOWED_IDS)
async def p_photo(m: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        parts = data['t'].split('|')
        nick, role, cap = parts[0].strip(), parts[1].strip(), int(parts[2].strip())
        fn = f"{nick.lower()}.png"
        await m.photo[-1].download(os.path.join(BASE_DIR, fn))
        conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
        cursor.execute("UPDATE players SET nickname=?, role=?, photo=?, is_captain=? WHERE id=?", 
                       (nick.upper(), role, fn, cap, data['pid']))
        conn.commit(); conn.close()
        await m.answer("✅ Игрок обновлен!"); await state.finish()
    except Exception as e:
        await m.answer(f"❌ Ошибка: {e}")

# --- ДОБАВЛЕНИЕ МАТЧА ---
@dp.message_handler(lambda m: m.text == "➕ Добавить игру", user_id=ALLOWED_IDS)
async def add_g(m: types.Message):
    await m.answer("Отправь: Соперник | Счет | WIN или LOSS")
    await States.m_t.set()

@dp.message_handler(state=States.m_t, user_id=ALLOWED_IDS)
async def m_txt(m: types.Message, state: FSMContext):
    if '|' not in m.text:
        await m.answer("❌ Формат!")
        return
    await state.update_data(t=m.text)
    await m.answer("Скинь ЛОГО противника")
    await States.m_p.set()

@dp.message_handler(content_types=['photo'], state=States.m_p, user_id=ALLOWED_IDS)
async def m_photo(m: types.Message, state: FSMContext):
    try:
        data = await state.get_data()
        parts = data['t'].split('|')
        opp, score, stat = parts[0].strip(), parts[1].strip(), parts[2].strip().upper()
        fn = f"logo_{opp.lower().replace(' ', '_')}.png"
        await m.photo[-1].download(os.path.join(OPPONENTS_DIR, fn))
        conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
        cursor.execute("INSERT INTO matches (opponent, score, status, opp_logo) VALUES (?,?,?,?)", 
                       (opp, score, stat, fn))
        cursor.execute("DELETE FROM matches WHERE id NOT IN (SELECT id FROM matches ORDER BY id DESC LIMIT 5)")
        conn.commit(); conn.close()
        await m.answer("✅ Матч добавлен!")
    except Exception as e:
        await m.answer(f"❌ Ошибка: {e}")
    await state.finish()

@dp.message_handler(lambda m: m.text == "🗑️ Очистить игры", user_id=ALLOWED_IDS)
async def clr(m: types.Message):
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("DELETE FROM matches"); conn.commit(); conn.close()
    await m.answer("🧹 Очищено")

@dp.message_handler(lambda m: m.text == "🩺 Статус", user_id=ALLOWED_IDS)
async def sts(m: types.Message):
    await m.answer("Сервер: 🟢 Работает")

def run_flask():
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

if __name__ == '__main__':
    init_db()
    threading.Thread(target=run_flask, daemon=True).start()
    executor.start_polling(dp, skip_updates=True)