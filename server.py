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
        conn = sqlite3.connect(db_path); cursor = conn.cursor()
        cursor.execute('CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, opponent TEXT, score TEXT, status TEXT, opp_logo TEXT)')
        cursor.execute('CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT, role TEXT, photo TEXT, team TEXT, is_captain INTEGER)')
        
        cursor.execute("SELECT count(*) FROM players")
        if cursor.fetchone()[0] == 0:
            # ПРАВИЛЬНЫЙ СОСТАВ (5 человек, Капитан 3-й)
            players = [
                ('AWESOME', 'Sniper', 'awesome.png', 'main', 0),
                ('LASQUA', 'OpenFragger', 'lasqua.png', 'main', 0),
                ('SHNYROQ', 'In-Game Leader', 'shnyroq.png', 'main', 1),
                ('TAKUYA', 'Lurker', 'takuya.png', 'main', 0),
                ('AIMIR666', 'Support', 'aimir666.png', 'main', 0),
                # Junior
                ('UNKNOWN', 'Unknown', 'logo.png', 'junior', 0),
                ('UNKNOWN', 'Unknown', 'logo.png', 'junior', 0),
                ('UNKNOWN', 'Unknown', 'logo.png', 'junior', 0),
                ('UNKNOWN', 'Unknown', 'logo.png', 'junior', 0),
                ('UNKNOWN', 'Unknown', 'logo.png', 'junior', 0)
            ]
            cursor.executemany("INSERT INTO players (nickname, role, photo, team, is_captain) VALUES (?,?,?,?,?)", players)
        conn.commit(); conn.close()
    except Exception as e: print(f"DB Error: {e}")

# --- API ROUTES ---
@app.route('/')
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
def api_m():
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT opponent, score, status, opp_logo FROM matches ORDER BY id DESC LIMIT 5")
    d = [{"opponent": r[0], "score": r[1], "status": r[2], "opp_logo": r[3]} for r in cursor.fetchall()]
    conn.close(); return jsonify(d)
@app.route('/api/players')
def api_p():
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT nickname, role, photo, team, is_captain FROM players ORDER BY team ASC, id ASC")
    d = [{"nick": r[0], "role": r[1], "photo": r[2], "team": r[3], "cap": r[4]} for r in cursor.fetchall()]
    conn.close(); return jsonify(d)
@app.route('/opponents/<path:f>')
def serve_opp(f): return send_from_directory(OPPONENTS_DIR, f)
@app.route('/<path:path>')
def send_static(path): return send_from_directory(BASE_DIR, path)

# --- BOT LOGIC ---
bot = Bot(token=API_TOKEN); dp = Dispatcher(bot, storage=MemoryStorage())
class States(StatesGroup): m_t = State(); m_p = State(); p_t = State(); p_p = State()

@dp.message_handler(commands=['cancel'], state="*")
async def cancel(m: types.Message, state: FSMContext):
    await state.finish(); await m.answer("Отменено.", reply_markup=types.ReplyKeyboardRemove())

@dp.message_handler(commands=['start'], user_id=ALLOWED_IDS, state="*")
async def cmd_start(m: types.Message, state: FSMContext):
    await state.finish()
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("➕ Добавить игру", "👤 Изменить игрока")
    kb.add("🗑️ Удалить игрока", "🗑️ Очистить игры")
    kb.add("🩺 Статус", "📥 Скачать БД")
    await m.answer("Панель Rekinder eSports", reply_markup=kb)

@dp.message_handler(lambda m: m.from_user.id not in ALLOWED_IDS, state="*")
async def denied(m: types.Message): await m.answer("⛔ Доступ ограничен.")

# Удаление игрока (если их стало 6)
@dp.message_handler(lambda m: m.text == "🗑️ Удалить игрока", user_id=ALLOWED_IDS)
async def delete_p_list(m: types.Message):
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT id, nickname FROM players"); ps = cursor.fetchall(); conn.close()
    kb = types.InlineKeyboardMarkup()
    for p in ps: kb.add(types.InlineKeyboardButton(f"Удалить {p[1]}", callback_data=f"delp_{p[0]}"))
    await m.answer("Кого удалить навсегда?", reply_markup=kb)

@dp.callback_query_handler(lambda c: c.data.startswith('delp_'), user_id=ALLOWED_IDS)
async def delp_call(c: types.CallbackQuery):
    pid = c.data.split('_')[1]
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("DELETE FROM players WHERE id=?", (pid,))
    conn.commit(); conn.close()
    await c.answer("Удалено!"); await c.message.answer("Игрок удален из базы.")

# Изменение игрока
@dp.message_handler(lambda m: m.text == "👤 Изменить игрока", user_id=ALLOWED_IDS)
async def edit_p(m: types.Message):
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("SELECT id, nickname, team FROM players"); ps = cursor.fetchall(); conn.close()
    kb = types.InlineKeyboardMarkup()
    for p in ps: kb.add(types.InlineKeyboardButton(f"{p[2].upper()}: {p[1]}", callback_data=f"p_{p[0]}"))
    await m.answer("Кого меняем?", reply_markup=kb)

@dp.callback_query_handler(lambda c: c.data.startswith('p_'), user_id=ALLOWED_IDS)
async def p_call(c: types.CallbackQuery, state: FSMContext):
    await state.update_data(pid=c.data.split('_')[1])
    await c.message.answer("Пиши: НИК | РОЛЬ | КАПИТАН(1/0)")
    await States.p_t.set()

@dp.message_handler(state=States.p_t, user_id=ALLOWED_IDS)
async def p_txt(m: types.Message, state: FSMContext):
    if '|' not in m.text: return await m.answer("Используй |")
    await state.update_data(t=m.text); await m.answer("Скинь ФОТО"); await States.p_p.set()

@dp.message_handler(content_types=['photo'], state=States.p_p, user_id=ALLOWED_IDS)
async def p_photo(m: types.Message, state: FSMContext):
    try:
        data = await state.get_data(); parts = data['t'].split('|')
        nick, role, cap = parts[0].strip(), parts[1].strip(), int(parts[2].strip())
        fn = f"{nick.lower()}.png"; await m.photo[-1].download(destination_file=os.path.join(BASE_DIR, fn))
        conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
        cursor.execute("UPDATE players SET nickname=?, role=?, photo=?, is_captain=? WHERE id=?", (nick.upper(), role, fn, cap, data['pid']))
        conn.commit(); conn.close(); await m.answer("✅ Готово!"); await state.finish()
    except: await m.answer("Ошибка формата!")

# Остальное...
@dp.message_handler(lambda m: m.text == "➕ Добавить игру", user_id=ALLOWED_IDS)
async def add_g(m: types.Message): await m.answer("Соперник | Счет | WIN/LOSS"); await States.m_t.set()
@dp.message_handler(state=States.m_t, user_id=ALLOWED_IDS)
async def m_txt(m: types.Message, state: FSMContext): await state.update_data(t=m.text); await m.answer("ЛОГО"); await States.m_p.set()
@dp.message_handler(content_types=['photo'], state=States.m_p, user_id=ALLOWED_IDS)
async def m_photo(m: types.Message, state: FSMContext):
    data = await state.get_data(); parts = data['t'].split('|')
    opp, sc, st = parts[0].strip(), parts[1].strip(), parts[2].strip().upper()
    fn = f"logo_{opp.lower()}.png"; await m.photo[-1].download(destination_file=os.path.join(OPPONENTS_DIR, fn))
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor()
    cursor.execute("INSERT INTO matches (opponent, score, status, opp_logo) VALUES (?,?,?,?)", (opp, sc, st, fn))
    cursor.execute("DELETE FROM matches WHERE id NOT IN (SELECT id FROM matches ORDER BY id DESC LIMIT 5)")
    conn.commit(); conn.close(); await m.answer("✅ Матч добавлен"); await state.finish()
@dp.message_handler(lambda m: m.text == "📥 Скачать БД", user_id=ALLOWED_IDS)
async def dl_db(m: types.Message):
    if os.path.exists(os.path.join(BASE_DIR, 'matches.db')):
        with open(os.path.join(BASE_DIR, 'matches.db'), 'rb') as f: await m.answer_document(f)
@dp.message_handler(lambda m: m.text == "🗑️ Очистить игры", user_id=ALLOWED_IDS)
async def clr(m: types.Message):
    conn = sqlite3.connect(os.path.join(BASE_DIR, 'matches.db')); cursor = conn.cursor(); cursor.execute("DELETE FROM matches"); conn.commit(); conn.close(); await m.answer("🧹 Очищено")
@dp.message_handler(lambda m: m.text == "🩺 Статус", user_id=ALLOWED_IDS)
async def sts(m: types.Message): await m.answer("Сервер: 🟢")

def run_flask():
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
if __name__ == '__main__':
    init_db()
    threading.Thread(target=run_flask, daemon=True).start()
    executor.start_polling(dp, skip_updates=True)
