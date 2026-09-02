import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendBookingStatusUpdateEmail } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const BLOCKED_DATES_FILE = path.join(__dirname, 'blockedDates.json');
const PLAYERS_FILE = path.join(__dirname, 'players.json');
const MATCHES_FILE = path.join(__dirname, 'matches.json');

// Initialize data stores
let bookings = [];
let blockedDates = [];
let players = [];
let matches = [];

function loadBookings() {
  try {
    if (fs.existsSync(BOOKINGS_FILE)) {
      const data = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
      bookings = JSON.parse(data || '[]');
    } else {
      bookings = [];
      saveBookings();
    }
  } catch (err) {
    console.error('Error loading bookings:', err);
    bookings = [];
  }
}

function saveBookings() {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving bookings:', err);
  }
}

function loadBlockedDates() {
  try {
    if (fs.existsSync(BLOCKED_DATES_FILE)) {
      const data = fs.readFileSync(BLOCKED_DATES_FILE, 'utf-8');
      blockedDates = JSON.parse(data || '[]');
    } else {
      blockedDates = [];
      saveBlockedDates();
    }
  } catch (err) {
    console.error('Error loading blocked dates:', err);
    blockedDates = [];
  }
}

function saveBlockedDates() {
  try {
    fs.writeFileSync(BLOCKED_DATES_FILE, JSON.stringify(blockedDates, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving blocked dates:', err);
  }
}

const DEFAULT_ROSTER_PLAYERS = [
  // Main Roster (5 UNKNOWN players, middle is Captain)
  { nick: "UNKNOWN", role: "Rifler", team: "main", cap: 0, photo: "logo.png" },
  { nick: "UNKNOWN", role: "Rifler", team: "main", cap: 0, photo: "logo.png" },
  { nick: "UNKNOWN", role: "Captain", team: "main", cap: 1, photo: "logo.png" },
  { nick: "UNKNOWN", role: "Sniper", team: "main", cap: 0, photo: "logo.png" },
  { nick: "UNKNOWN", role: "Support", team: "main", cap: 0, photo: "logo.png" }
];

function loadPlayers() {
  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const data = fs.readFileSync(PLAYERS_FILE, 'utf-8');
      const parsed = JSON.parse(data || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        players = parsed;
      } else {
        players = [...DEFAULT_ROSTER_PLAYERS];
        savePlayers();
      }
    } else {
      players = [...DEFAULT_ROSTER_PLAYERS];
      savePlayers();
    }
  } catch (err) {
    console.error('Error loading players:', err);
    players = [...DEFAULT_ROSTER_PLAYERS];
    savePlayers();
  }
}

function savePlayers() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving players:', err);
  }
}

const DEFAULT_MATCHES = [
  { opponent: "NAVI Junior", score: "13:9", status: "WIN", opp_logo: "navi.png", date: "2026-03-01" },
  { opponent: "Spirit Academy", score: "13:11", status: "WIN", opp_logo: "spirit.png", date: "2026-02-28" },
  { opponent: "MOUZ NXT", score: "9:13", status: "LOSS", opp_logo: "mouz.png", date: "2026-02-26" },
  { opponent: "Astralis Talent", score: "13:7", status: "WIN", opp_logo: "astralis.png", date: "2026-02-24" }
];

function loadMatches() {
  try {
    if (fs.existsSync(MATCHES_FILE)) {
      const data = fs.readFileSync(MATCHES_FILE, 'utf-8');
      const parsed = JSON.parse(data || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        matches = parsed;
      } else {
        matches = [...DEFAULT_MATCHES];
        saveMatches();
      }
    } else {
      matches = [...DEFAULT_MATCHES];
      saveMatches();
    }
  } catch (err) {
    console.error('Error loading matches:', err);
    matches = [...DEFAULT_MATCHES];
    saveMatches();
  }
}

function saveMatches() {
  try {
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(matches, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving matches:', err);
  }
}

// Whitelisted Admin Telegram IDs for Rekinder eSports Management
export const DEFAULT_ALLOWED_ADMIN_IDS = ['1014379451', '8868074209'];

export function getAllowedAdminIds() {
  const allowed = new Set(DEFAULT_ALLOWED_ADMIN_IDS);
  if (process.env.ALLOWED_ADMIN_IDS) {
    process.env.ALLOWED_ADMIN_IDS.split(',').forEach(id => {
      const trimmed = id.trim();
      if (trimmed) allowed.add(trimmed);
    });
  }
  if (process.env.TELEGRAM_CHAT_ID) {
    process.env.TELEGRAM_CHAT_ID.split(',').forEach(id => {
      const trimmed = id.trim();
      if (trimmed) allowed.add(trimmed);
    });
  }
  return allowed;
}

export function isUserAllowedAdmin(userId) {
  if (!userId) return false;
  const allowed = getAllowedAdminIds();
  return allowed.has(String(userId).trim());
}

// Registered manager chats persistent storage
const CHATS_FILE = path.join(__dirname, 'manager_chats.json');
let managerChatIds = new Set();

function loadManagerChats() {
  managerChatIds.clear();
  
  // Always include default authorized admins
  DEFAULT_ALLOWED_ADMIN_IDS.forEach(id => managerChatIds.add(id));

  try {
    if (fs.existsSync(CHATS_FILE)) {
      const data = fs.readFileSync(CHATS_FILE, 'utf-8');
      const parsed = JSON.parse(data || '[]');
      if (Array.isArray(parsed)) {
        parsed.forEach(id => {
          const strId = String(id).trim();
          if (isUserAllowedAdmin(strId)) {
            managerChatIds.add(strId);
          }
        });
      }
    }
  } catch (e) {
    console.error('Error loading manager_chats.json:', e.message);
  }

  if (process.env.TELEGRAM_CHAT_ID) {
    process.env.TELEGRAM_CHAT_ID.split(',').forEach(id => {
      const trimmed = id.trim();
      if (trimmed && isUserAllowedAdmin(trimmed)) managerChatIds.add(trimmed);
    });
  }

  saveManagerChats();
}

function saveManagerChats() {
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(Array.from(managerChatIds), null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving manager_chats.json:', e.message);
  }
}

loadBookings();
loadBlockedDates();
loadPlayers();
loadMatches();
loadManagerChats();

function deleteBookingById(id) {
  const index = bookings.findIndex(b => b.id.toUpperCase() === id.toUpperCase());
  if (index !== -1) {
    const deleted = bookings.splice(index, 1)[0];
    saveBookings();
    return deleted;
  }
  return null;
}

// Telegram Bot API Helper
class TelegramBotService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.pollingActive = false;
    this.lastUpdateId = 0;
  }

  isConfigured() {
    return Boolean(this.token && this.token.trim() !== '');
  }

  async sendApiRequest(method, payload = {}) {
    if (!this.isConfigured()) return null;
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    // If long-polling with timeout parameter, allow enough HTTP timeout (e.g. 20s poll timeout + 10s grace)
    const reqTimeout = (method === 'getUpdates' && payload.timeout) ? (payload.timeout + 10) * 1000 : 10000;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(reqTimeout)
      });
      const data = await response.json();
      return data;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        // Normal in long polling when no updates occurred during the poll window
        return null;
      }
      console.error(`Telegram API error [${method}]:`, err.message);
      return null;
    }
  }

  // Format booking card for Telegram
  formatBookingMessage(booking) {
    const teamTitle = 'Rekinder eSports';
    const statusEmoji = booking.status === 'confirmed' ? '✅ ПОДТВЕРЖДЕН' :
                        booking.status === 'declined' ? '❌ ОТКЛОНЕН' : '⏳ В ОЖИДАНИИ';

    const cleanContact = (booking.contact || '').replace(/^@/, '');
    const tgLink = booking.contact ? `https://t.me/${encodeURIComponent(cleanContact)}` : null;

    // Helper to sanitize markdown
    const esc = (str) => (str || '').replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    let text = `🎮 *ЗАЯВКА НА ПРАКК (SCRIM) #${booking.id}*\n\n`;
    text += `🛡️ *Команда Rekinder:* ${teamTitle}\n`;
    text += `⚔️ *Противник:* ${esc(booking.opponentTeam)}\n`;
    text += `📅 *Дата:* ${booking.date}\n`;
    text += `⏰ *Время:* ${booking.time} (МСК)\n`;
    text += `🗺️ *Формат:* ${esc(booking.format || 'BO3')}\n`;
    text += `👤 *Контакт:* ${esc(booking.contact)}\n`;
    if (booking.email) {
      text += `📧 *Email:* ${esc(booking.email)}\n`;
    }
    if (booking.teamLogo) {
      text += `🖼️ *Логотип:* Прикреплен к заявке на сайте\n`;
    }
    if (booking.teamLink) {
      text += `🔗 *Ссылка на команду:* ${booking.teamLink}\n`;
    }
    if (booking.comment) {
      text += `💬 *Комментарий:* _${esc(booking.comment)}_\n`;
    }
    text += `\n📌 *Статус:* ${statusEmoji}\n`;
    if (booking.managerDecisionBy) {
      text += `⚡ *Решение:* ${esc(booking.managerDecisionBy)} (${new Date(booking.managerDecisionAt || Date.now()).toLocaleTimeString('ru-RU')})\n`;
    }

    return { text, tgLink };
  }

  // Send new booking notification to all registered manager chats
  async notifyNewBooking(booking) {
    const { text, tgLink } = this.formatBookingMessage(booking);

    const inlineKeyboard = [
      [
        { text: '✅ Принять', callback_data: `confirm:${booking.id}` },
        { text: '❌ Отклонить', callback_data: `decline:${booking.id}` },
        { text: '🗑️ Удалить', callback_data: `delete:${booking.id}` }
      ]
    ];

    if (tgLink) {
      inlineKeyboard.push([
        { text: '💬 Написать в Telegram', url: tgLink }
      ]);
    }

    if (managerChatIds.size === 0 && !process.env.TELEGRAM_CHAT_ID) {
      console.log(`[TelegramBot] No manager chat IDs registered. Booking created: #${booking.id}`);
      return;
    }

    for (const chatId of managerChatIds) {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
    }
  }

  // Build main menu inline keyboard
  getMainMenuKeyboard() {
    return [
      [
        { text: '⏳ Ожидающие заявки', callback_data: 'menu:pending' },
        { text: '📋 Все пракки', callback_data: 'menu:bookings' }
      ],
      [
        { text: '🔒 Закрыть день', callback_data: 'menu:block_select_team:all' },
        { text: '🔓 Закрытые дни', callback_data: 'menu:blocked' }
      ],
      [
        { text: '⚔️ Матчи и Игры', callback_data: 'menu:matches' },
        { text: '👥 Составы и Игроки', callback_data: 'menu:players' }
      ],
      [
        { text: '📊 Статус системы', callback_data: 'menu:status' },
        { text: '💾 Экспорт БД', callback_data: 'menu:get_db' }
      ],
      [
        { text: '🔄 Обновить меню', callback_data: 'menu:main' }
      ]
    ];
  }

  // Modern persistent bottom Reply Keyboard (replaces old bottom keyboards)
  getReplyKeyboard() {
    return {
      keyboard: [
        [{ text: '⏳ Ожидающие заявки' }, { text: '📋 Все пракки' }],
        [{ text: '🔒 Закрыть день' }, { text: '🔓 Закрытые дни' }],
        [{ text: '⚔️ Матчи и Игры' }, { text: '👥 Составы и Игроки' }],
        [{ text: '📊 Статус системы' }, { text: '💾 Экспорт БД' }]
      ],
      resize_keyboard: true,
      is_persistent: true
    };
  }

  // Render Main Menu (supports both inline edit and new message)
  async renderMainMenu(chatId, messageId = null, fromUser = 'Менеджер', sendReplyKeyboard = false) {
    const text = `👋 Привет, *${fromUser}*!\n\n` +
      `🎮 *Панель управления Rekinder eSports*\n\n` +
      `Выберите нужное действие кнопками в сообщении или используйте нижнюю клавиатуру:\n` +
      `• ⏳ *Ожидающие заявки* — просмотр и подтверждение\n` +
      `• 📋 *Все пракки* — расписание и статус\n` +
      `• 🔒 *Закрыть день* — календарь на 14 дней в 1 клик\n` +
      `• 🔓 *Закрытые дни* — управление заблокированными датами\n` +
      `• ⚔️ *Матчи и Игры* — результаты, W/L статистика\n` +
      `• 👥 *Состав* — Main ростер и капитан\n` +
      `• 💾 *Экспорт БД* — мгновенная выгрузка базы данных в чат`;

    if (sendReplyKeyboard) {
      // Send keyboard sync message first to guarantee bottom bar update
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: '⌨️ *Клавиатура управления обновлена!*',
        parse_mode: 'Markdown',
        reply_markup: this.getReplyKeyboard()
      });
    }

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: this.getMainMenuKeyboard() }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: this.getMainMenuKeyboard() }
      });
    }
  }

  // Render Pending Bookings
  async renderPendingBookings(chatId, messageId = null) {
    const pending = bookings.filter(b => b.status === 'pending');
    if (pending.length === 0) {
      const emptyText = '✨ *Ожидающих заявок нет!* Все пракки обработаны.';
      const keyboard = [[{ text: '🔙 Назад в меню', callback_data: 'menu:main' }]];
      if (messageId) {
        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: emptyText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: emptyText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      return;
    }

    let resp = `⏳ *Ожидающие заявки на пракк (${pending.length}):*\n\n`;
    const keyboard = [];

    pending.forEach((b, idx) => {
      resp += `${idx + 1}. *#${b.id}* — ${b.opponentTeam} vs ${b.team.toUpperCase()}\n`;
      resp += `   📅 ${b.date} в ${b.time} (МСК) | ${b.format || 'BO3'}\n`;
      resp += `   👤 Контакт: ${b.contact}\n\n`;

      keyboard.push([
        { text: `✅ #${b.id}`, callback_data: `confirm:${b.id}` },
        { text: `❌ #${b.id}`, callback_data: `decline:${b.id}` },
        { text: `🗑️ #${b.id}`, callback_data: `delete:${b.id}` }
      ]);
    });

    keyboard.push([{ text: '🔙 Назад в меню', callback_data: 'menu:main' }]);

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Render All Bookings
  async renderAllBookings(chatId, messageId = null) {
    const list = bookings.slice(0, 8);
    if (list.length === 0) {
      const emptyText = 'ℹ️ Список заявок пока пуст.';
      const keyboard = [[{ text: '🔙 Назад в меню', callback_data: 'menu:main' }]];
      if (messageId) {
        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: emptyText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: emptyText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      return;
    }

    let resp = `📋 *Последние заявки на пракки (${list.length}):*\n\n`;
    const keyboard = [];

    list.forEach((b, idx) => {
      const statusIcon = b.status === 'confirmed' ? '✅' : b.status === 'declined' ? '❌' : '⏳';
      resp += `${statusIcon} *#${b.id}* | ${b.date} ${b.time}\n`;
      resp += `   ⚔️ ${b.opponentTeam} vs ${b.team.toUpperCase()} (${b.contact})\n\n`;

      keyboard.push([
        { text: `${b.status === 'confirmed' ? '❌ Отклонить' : '✅ Принять'} #${b.id}`, callback_data: `${b.status === 'confirmed' ? 'decline' : 'confirm'}:${b.id}` },
        { text: `🗑️ Удалить`, callback_data: `delete:${b.id}` }
      ]);
    });

    keyboard.push([{ text: '🔙 Назад в меню', callback_data: 'menu:main' }]);

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Render Date Picker
  async renderDatePicker(chatId, messageId = null, team = 'main') {
    const text = `🔒 *Закрытие дат для пракков:*\n\n` +
      `Нажмите на нужную дату, чтобы *закрыть* 🔴 (или *открыть* 🟢) её в календаре сайта для состава Rekinder Main.\n\n` +
      `🟢 = день открыт для записи\n🔴 = день закрыт (занято)`;

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: this.getDatePickerKeyboard(team) }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: this.getDatePickerKeyboard(team) }
      });
    }
  }

  // Render Blocked Days List
  async renderBlockedDays(chatId, messageId = null) {
    if (blockedDates.length === 0) {
      const emptyText = '🟢 *Нет закрытых дат.* Все дни открыты для бронирования пракков.';
      const keyboard = [
        [{ text: '🔒 Закрыть день', callback_data: 'menu:block' }],
        [{ text: '🔙 Назад в меню', callback_data: 'menu:main' }]
      ];
      if (messageId) {
        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: emptyText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: emptyText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      return;
    }

    let resp = `🔒 *Список закрытых дней (${blockedDates.length}):*\n\n`;
    const keyboard = [];

    blockedDates.forEach((b, idx) => {
      const tName = 'Rekinder Main';
      resp += `${idx + 1}. 📅 *${b.date}*\n`;
      keyboard.push([
        { text: `🔓 Открыть ${b.date}`, callback_data: `unblock:${b.date}:${b.team || 'main'}` }
      ]);
    });

    keyboard.push([
      { text: '➕ Закрыть еще день', callback_data: 'menu:block' },
      { text: '🔙 Назад в меню', callback_data: 'menu:main' }
    ]);

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Render Matches
  async renderMatches(chatId, messageId = null) {
    const winCount = matches.filter(m => m.status === 'WIN').length;
    const total = matches.length;
    const winrate = total > 0 ? Math.round((winCount / total) * 100) : 0;

    let resp = `⚔️ *Матчи команды Rekinder eSports*\n\n`;
    resp += `📊 *Статистика:* ${winCount}W / ${total - winCount}L (${winrate}% WR)\n\n`;
    resp += `*Последние игры:*\n`;

    if (matches.length === 0) {
      resp += `_Матчи еще не добавлены в базу._\n`;
    } else {
      matches.slice(0, 6).forEach((m, idx) => {
        const icon = m.status === 'WIN' ? '🟢 WIN' : '🔴 LOSS';
        resp += `${idx + 1}. *vs ${m.opponent}* — \`${m.score}\` (${icon})\n`;
      });
    }

    const keyboard = [
      [
        { text: '➕ Добавить победу (WIN)', callback_data: 'match:pick_opp:WIN' },
        { text: '➕ Добавить поражение (LOSS)', callback_data: 'match:pick_opp:LOSS' }
      ],
      [
        { text: '🗑️ Удалить последний матч', callback_data: 'match:delete_last' }
      ],
      [
        { text: '🔙 Назад в меню', callback_data: 'menu:main' }
      ]
    ];

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Render Players / Rosters
  async renderPlayers(chatId, messageId = null) {
    const mainPlayers = players.filter(p => p.team === 'main' || !p.team);

    let resp = `👥 *Состав Rekinder eSports*\n\n`;
    resp += `🛡️ *Main Roster (${mainPlayers.length} игроков):*\n`;
    if (mainPlayers.length === 0) {
      resp += `_Игроки не добавлены_\n`;
    } else {
      mainPlayers.forEach(p => {
        resp += `• ${p.cap ? '👑 ' : ''}*${p.nick}* — ${p.role}\n`;
      });
    }

    resp += `\nВыберите действие для управления игроками:`;

    const keyboard = [
      [
        { text: '🛡️ Управление игроками Main Roster', callback_data: 'players:list:main' }
      ],
      [
        { text: '🔄 Сбросить состав на 5 UNKNOWN', callback_data: 'players:reset_defaults' }
      ],
      [
        { text: '🔙 Назад в главное меню', callback_data: 'menu:main' }
      ]
    ];

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Render Status
  async renderStatus(chatId, messageId = null) {
    const totalBookings = bookings.length;
    const confCount = bookings.filter(b => b.status === 'confirmed').length;
    const pendCount = bookings.filter(b => b.status === 'pending').length;
    const declCount = bookings.filter(b => b.status === 'declined').length;
    const winCount = matches.filter(m => m.status === 'WIN').length;
    const totalMatches = matches.length;
    const winrate = totalMatches > 0 ? Math.round((winCount / totalMatches) * 100) : 0;

    let resp = `📊 *Статус системы Rekinder eSports*\n\n`;
    resp += `🟢 *Сервер:* Онлайн (Node.js Express / Порт 3000)\n`;
    resp += `🤖 *Telegram Bot:* Активен\n`;
    resp += `👤 *Активных чатов менеджеров:* ${managerChatIds.size}\n\n`;
    resp += `📋 *Заявки на пракки:*\n`;
    resp += `• Всего: *${totalBookings}*\n`;
    resp += `• ✅ Подтверждено: *${confCount}*\n`;
    resp += `• ⏳ В ожидании: *${pendCount}*\n`;
    resp += `• ❌ Отклонено: *${declCount}*\n\n`;
    resp += `🔒 *Закрытых дат:* *${blockedDates.length}*\n`;
    resp += `👥 *Игроков в составе:* *${mainPlayers.length}*\n`;
    resp += `⚔️ *Матчи:* *${totalMatches}* игр (Винрейт: *${winrate}%*)\n`;

    const keyboard = [
      [
        { text: '💾 Скачать базу данных', callback_data: 'menu:get_db' },
        { text: '🔄 Обновить', callback_data: 'menu:status' }
      ],
      [
        { text: '🔙 Главное меню', callback_data: 'menu:main' }
      ]
    ];

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Render Export Database Menu
  async renderGetDb(chatId, messageId = null) {
    let resp = `💾 *Экспорт базы данных Rekinder eSports*\n\n`;
    resp += `Выберите какую таблицу вы хотите выгрузить прямо в чат:\n`;
    resp += `• 📋 *Пракки* (${bookings.length} записей)\n`;
    resp += `• 🔒 *Закрытые дни* (${blockedDates.length} записей)\n`;
    resp += `• 👥 *Игроки* (${players.length} записей)\n`;
    resp += `• ⚔️ *Матчи* (${matches.length} записей)\n`;
    resp += `• 📦 *Полный дамп всей базы*`;

    const keyboard = [
      [
        { text: '📋 Пракки (JSON)', callback_data: 'db:export:bookings' },
        { text: '🔒 Закрытые дни (JSON)', callback_data: 'db:export:blocked' }
      ],
      [
        { text: '👥 Игроки (JSON)', callback_data: 'db:export:players' },
        { text: '⚔️ Матчи (JSON)', callback_data: 'db:export:matches' }
      ],
      [
        { text: '📦 Полный дамп (Все таблицы)', callback_data: 'db:export:all' }
      ],
      [
        { text: '🔙 Назад в главное меню', callback_data: 'menu:main' }
      ]
    ];

    if (messageId) {
      await this.sendApiRequest('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await this.sendApiRequest('sendMessage', {
        chat_id: chatId,
        text: resp,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  }

  // Generate date buttons for the next 14 days
  getDatePickerKeyboard(team = 'main', page = 0) {
    const keyboard = [];
    const today = new Date();

    const daysToShow = 14;
    const dateButtons = [];

    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      
      const isAlreadyBlocked = blockedDates.some(b => b.date === isoDate);
      const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' });
      const label = `${isAlreadyBlocked ? '🔴' : '🟢'} ${isoDate.slice(5)} (${dayName})`;

      dateButtons.push({
        text: label,
        callback_data: isAlreadyBlocked ? `unblock:${isoDate}:main` : `doblock:${isoDate}:main`
      });
    }

    // Group into 2 columns
    for (let i = 0; i < dateButtons.length; i += 2) {
      if (dateButtons[i + 1]) {
        keyboard.push([dateButtons[i], dateButtons[i + 1]]);
      } else {
        keyboard.push([dateButtons[i]]);
      }
    }

    keyboard.push([
      { text: '🔙 Назад в меню', callback_data: 'menu:main' }
    ]);

    return keyboard;
  }

  // Handle updates / webhook / polling
  async handleUpdate(update) {
    if (!update) return;

    // Handle Callback Query (Buttons clicked in Telegram)
    if (update.callback_query) {
      const cb = update.callback_query;
      const senderId = String(cb.from?.id || cb.message?.chat?.id || '');

      // Security check: Only whitelisted admins can interact
      if (!isUserAllowedAdmin(senderId)) {
        console.warn(`[TelegramBot] Unauthorized callback_query attempt from ID ${senderId} (@${cb.from?.username || 'unknown'})`);
        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '⛔ Доступ запрещен. Бот только для администраторов Rekinder eSports.',
          show_alert: true
        });
        return;
      }

      const data = cb.data || '';
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const fromUser = cb.from?.username ? `@${cb.from.username}` : (cb.from?.first_name || 'Менеджер');

      // Main Menu navigation
      if (data === 'menu:main') {
        await this.renderMainMenu(chatId, messageId, fromUser, false);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Show Pending Bookings
      if (data === 'menu:pending') {
        await this.renderPendingBookings(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Show All Bookings
      if (data === 'menu:bookings') {
        await this.renderAllBookings(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Team selection in Date Picker
      if (data.startsWith('pickteam:')) {
        const team = 'main';
        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🔒 *Закрытие дат для пракков:*\n\nНажмите на нужную дату, чтобы *закрыть* 🔴 (или *открыть* 🟢) её в календаре для состава Rekinder Main:`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: this.getDatePickerKeyboard(team)
          }
        });
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Menu for blocking dates
      if (data.startsWith('menu:block_select_team:') || data === 'menu:block') {
        const team = data.split(':')[2] || 'all';
        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🔒 *Закрытие дат для пракков:*\n\nНажмите на нужную дату, чтобы *закрыть* 🔴 (или *открыть* 🟢) её в календаре сайта.\n\n🟢 = день открыт для записи\n🔴 = день закрыт (занято)`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: this.getDatePickerKeyboard(team)
          }
        });
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Execute blocking via button click
      if (data.startsWith('doblock:')) {
        const [_, blockDate, blockTeam] = data.split(':');
        const team = blockTeam || 'all';

        const existingIdx = blockedDates.findIndex(b => b.date === blockDate && (b.team === team || b.team === 'all' || team === 'all'));
        const newBlock = {
          date: blockDate,
          team: team,
          reason: 'Команда занята',
          blockedBy: fromUser,
          blockedAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
          blockedDates[existingIdx] = newBlock;
        } else {
          blockedDates.push(newBlock);
        }
        saveBlockedDates();

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `🔒 Дата ${blockDate} закрыта!`,
          show_alert: false
        });

        // Update picker keyboard
        await this.sendApiRequest('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: this.getDatePickerKeyboard(team)
          }
        });
        return;
      }

      // Execute unblocking via button click
      if (data.startsWith('unblock:')) {
        const [_, blockDate, blockTeam] = data.split(':');
        const team = blockTeam || 'all';
        
        blockedDates = blockedDates.filter(b => !(b.date === blockDate && (team === 'all' || b.team === team || b.team === 'all')));
        saveBlockedDates();

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `🟢 Дата ${blockDate} открыта!`,
          show_alert: false
        });

        // If in date picker, refresh picker
        await this.sendApiRequest('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: this.getDatePickerKeyboard(team)
          }
        }).catch(async () => {
          // If in list view, refresh blocked list
          await this.sendApiRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: `🔓 *Дата ${blockDate} успешно открыта.* (Менеджер: ${fromUser})`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 В главное меню', callback_data: 'menu:main' }]]
            }
          });
        });
        return;
      }

      // Show Blocked Dates List
      if (data === 'menu:blocked') {
        await this.renderBlockedDays(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Show Matches Menu
      if (data === 'menu:matches') {
        await this.renderMatches(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Pick Opponent for Match
      if (data.startsWith('match:pick_opp:')) {
        const resultType = data.split(':')[2]; // WIN or LOSS
        const icon = resultType === 'WIN' ? '🟢 Победа' : '🔴 Поражение';

        let resp = `⚔️ *Добавление матча: ${icon}*\n\nВыберите команду соперника:`;
        const opponents = [
          'NAVI Junior', 'Spirit Academy', 'MOUZ NXT', 'Astralis Talent',
          'BIG Academy', 'FaZe Clan Jr', 'Cloud9 Academy', 'VP.Prodigy'
        ];

        const keyboard = [];
        for (let i = 0; i < opponents.length; i += 2) {
          keyboard.push([
            { text: opponents[i], callback_data: `match:save:${resultType}:${opponents[i]}` },
            { text: opponents[i + 1], callback_data: `match:save:${resultType}:${opponents[i + 1]}` }
          ]);
        }

        keyboard.push([{ text: '🔙 К матчам', callback_data: 'menu:matches' }]);

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: resp,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Save Match
      if (data.startsWith('match:save:')) {
        const [_, __, resultType, oppName] = data.split(':');
        const score = resultType === 'WIN' ? '13:9' : '9:13';
        const newMatch = {
          opponent: oppName,
          score: score,
          status: resultType,
          opp_logo: oppName.toLowerCase().includes('navi') ? 'navi.png' :
                    oppName.toLowerCase().includes('spirit') ? 'spirit.png' :
                    oppName.toLowerCase().includes('mouz') ? 'mouz.png' :
                    oppName.toLowerCase().includes('astralis') ? 'astralis.png' :
                    oppName.toLowerCase().includes('big') ? 'big.png' : 'logo.png',
          date: new Date().toISOString().split('T')[0]
        };

        matches.unshift(newMatch);
        saveMatches();

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `✅ Матч vs ${oppName} (${resultType}) сохранен!`,
          show_alert: false
        });

        // Return to matches list
        const winCount = matches.filter(m => m.status === 'WIN').length;
        const total = matches.length;
        const winrate = total > 0 ? Math.round((winCount / total) * 100) : 0;

        let resp = `✅ *Матч успешно добавлен!*\n\n`;
        resp += `⚔️ *Rekinder vs ${oppName}* — \`${score}\` (${resultType === 'WIN' ? '🟢 WIN' : '🔴 LOSS'})\n\n`;
        resp += `📊 *Новая статистика:* ${winCount}W / ${total - winCount}L (${winrate}% WR)\n\n`;
        resp += `*Список последних игр:*\n`;

        matches.slice(0, 6).forEach((m, idx) => {
          const icon = m.status === 'WIN' ? '🟢 WIN' : '🔴 LOSS';
          resp += `${idx + 1}. *vs ${m.opponent}* — \`${m.score}\` (${icon})\n`;
        });

        const keyboard = [
          [
            { text: '➕ Добавить победу (WIN)', callback_data: 'match:pick_opp:WIN' },
            { text: '➕ Добавить поражение (LOSS)', callback_data: 'match:pick_opp:LOSS' }
          ],
          [
            { text: '🗑️ Удалить последний матч', callback_data: 'match:delete_last' }
          ],
          [
            { text: '🔙 Назад в главное меню', callback_data: 'menu:main' }
          ]
        ];

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: resp,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      // Delete Last Match
      if (data === 'match:delete_last') {
        if (matches.length === 0) {
          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Нет матчей для удаления.',
            show_alert: true
          });
          return;
        }

        const removed = matches.shift();
        saveMatches();

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `🗑️ Матч vs ${removed.opponent} удален!`,
          show_alert: false
        });

        // Re-show matches menu
        let resp = `🗑️ *Матч vs ${removed.opponent} (${removed.score}) был удален.*\n\n*Актуальные матчи:*\n`;
        matches.slice(0, 6).forEach((m, idx) => {
          const icon = m.status === 'WIN' ? '🟢 WIN' : '🔴 LOSS';
          resp += `${idx + 1}. *vs ${m.opponent}* — \`${m.score}\` (${icon})\n`;
        });

        const keyboard = [
          [
            { text: '➕ Добавить победу (WIN)', callback_data: 'match:pick_opp:WIN' },
            { text: '➕ Добавить поражение (LOSS)', callback_data: 'match:pick_opp:LOSS' }
          ],
          [
            { text: '🔙 Назад в меню', callback_data: 'menu:main' }
          ]
        ];

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: resp,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      // Show Players / Rosters Menu
      if (data === 'menu:players') {
        await this.renderPlayers(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Reset Players to Defaults
      if (data === 'players:reset_defaults') {
        players.length = 0;
        players.push(...DEFAULT_ROSTER_PLAYERS);
        savePlayers();

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: '✅ Все составы сброшены на стандартных игроков Rekinder eSports!',
          show_alert: true
        });

        await this.renderPlayers(chatId, messageId);
        return;
      }

      // List Players for Team
      if (data.startsWith('players:list:')) {
        const team = 'main';
        const teamName = 'Main Roster';
        const teamPlayers = players.filter(p => p.team === 'main' || !p.team);

        let resp = `👥 *Управление игроками: ${teamName}*\n\nНажмите на игрока для изменения его роли или капитанства:`;
        const keyboard = [];

        teamPlayers.forEach(p => {
          keyboard.push([
            { text: `${p.cap ? '👑 ' : ''}${p.nick} (${p.role})`, callback_data: `player:view:${p.nick}` }
          ]);
        });

        keyboard.push([
          { text: '➕ Добавить игрока командой', callback_data: `player:add_hint:main` }
        ]);

        keyboard.push([
          { text: '🔙 К составу', callback_data: 'menu:players' },
          { text: '🏠 Главное меню', callback_data: 'menu:main' }
        ]);

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: resp,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Hint how to add player via text command
      if (data.startsWith('player:add_hint:')) {
        const team = 'main';
        const teamName = 'Main';
        const helpText = `➕ *Как добавить или обновить игрока:*\n\n` +
          `Отправьте текстовое сообщение в чат бота в формате:\n\n` +
          `\`/addplayer НИК РОЛЬ [cap]\`\n\n` +
          `*Примеры:*\n` +
          `• \`/addplayer SIMPLE Sniper main\`\n` +
          `• \`/addplayer B1T Rifler main\`\n` +
          `• \`/addplayer M0NESY AWP main cap\` _(сразу назначить капитаном)_\n\n` +
          `*Доступные роли:* \`Sniper\`, \`In-Game Leader\`, \`OpenFragger\`, \`Entry\`, \`Lurker\`, \`Support\`, \`Rifler\``;

        const keyboard = [
          [{ text: `🔙 Назад к составу`, callback_data: `players:list:main` }]
        ];

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: helpText,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // View & Edit Single Player
      if (data.startsWith('player:view:')) {
        const nick = data.split(':')[2];
        const player = players.find(p => p.nick.toUpperCase() === nick.toUpperCase());

        if (!player) {
          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Игрок не найден.',
            show_alert: true
          });
          return;
        }

        let resp = `👤 *Карточка игрока: ${player.nick}*\n\n`;
        resp += `🛡️ *Состав:* ${player.team.toUpperCase()}\n`;
        resp += `🎯 *Роль:* ${player.role}\n`;
        resp += `👑 *Капитан:* ${player.cap ? 'Да (Капитан команды)' : 'Нет'}\n\n`;
        resp += `Выберите действие:`;

        const keyboard = [
          [
            { text: player.cap ? '❌ Снять статус капитана' : '👑 Назначить капитаном', callback_data: `player:toggle_cap:${player.nick}` }
          ],
          [
            { text: '🔄 Сменить роль', callback_data: `player:cycle_role:${player.nick}` },
            { text: '🗑️ Удалить игрока', callback_data: `player:delete:${player.nick}` }
          ],
          [
            { text: `🔙 К составу ${player.team.toUpperCase()}`, callback_data: `players:list:${player.team}` }
          ]
        ];

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: resp,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Toggle Captain
      if (data.startsWith('player:toggle_cap:')) {
        const nick = data.split(':')[2];
        const player = players.find(p => p.nick.toUpperCase() === nick.toUpperCase());

        if (player) {
          if (!player.cap) {
            // Remove cap from others in same team
            players.forEach(p => {
              if (p.team === player.team) p.cap = 0;
            });
            player.cap = 1;
          } else {
            player.cap = 0;
          }
          savePlayers();

          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: player.cap ? `👑 ${player.nick} назначен капитаном!` : `❌ Статус капитана снят с ${player.nick}`,
            show_alert: false
          });

          // Re-render player card
          let resp = `👤 *Карточка игрока: ${player.nick}*\n\n`;
          resp += `🛡️ *Состав:* ${player.team.toUpperCase()}\n`;
          resp += `🎯 *Роль:* ${player.role}\n`;
          resp += `👑 *Капитан:* ${player.cap ? 'Да (Капитан команды)' : 'Нет'}\n\n`;
          resp += `Выберите действие:`;

          const keyboard = [
            [
              { text: player.cap ? '❌ Снять статус капитана' : '👑 Назначить капитаном', callback_data: `player:toggle_cap:${player.nick}` }
            ],
            [
              { text: '🔄 Сменить роль', callback_data: `player:cycle_role:${player.nick}` },
              { text: '🗑️ Удалить игрока', callback_data: `player:delete:${player.nick}` }
            ],
            [
              { text: `🔙 К составу ${player.team.toUpperCase()}`, callback_data: `players:list:${player.team}` }
            ]
          ];

          await this.sendApiRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: resp,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          });
          return;
        }
      }

      // Cycle Role
      if (data.startsWith('player:cycle_role:')) {
        const nick = data.split(':')[2];
        const player = players.find(p => p.nick.toUpperCase() === nick.toUpperCase());

        if (player) {
          const roles = ['Sniper', 'In-Game Leader', 'OpenFragger', 'Entry', 'Lurker', 'Support', 'Rifler'];
          const curIdx = roles.indexOf(player.role);
          const nextIdx = (curIdx + 1) % roles.length;
          player.role = roles[nextIdx];
          savePlayers();

          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `🎯 Роль ${player.nick} изменена на ${player.role}!`,
            show_alert: false
          });

          // Re-render player card
          let resp = `👤 *Карточка игрока: ${player.nick}*\n\n`;
          resp += `🛡️ *Состав:* ${player.team.toUpperCase()}\n`;
          resp += `🎯 *Роль:* ${player.role}\n`;
          resp += `👑 *Капитан:* ${player.cap ? 'Да (Капитан команды)' : 'Нет'}\n\n`;
          resp += `Выберите действие:`;

          const keyboard = [
            [
              { text: player.cap ? '❌ Снять статус капитана' : '👑 Назначить капитаном', callback_data: `player:toggle_cap:${player.nick}` }
            ],
            [
              { text: '🔄 Сменить роль', callback_data: `player:cycle_role:${player.nick}` },
              { text: '🗑️ Удалить игрока', callback_data: `player:delete:${player.nick}` }
            ],
            [
              { text: `🔙 К составу ${player.team.toUpperCase()}`, callback_data: `players:list:${player.team}` }
            ]
          ];

          await this.sendApiRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: resp,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          });
          return;
        }
      }

      // Delete Player
      if (data.startsWith('player:delete:')) {
        const nick = data.split(':')[2];
        const idx = players.findIndex(p => p.nick.toUpperCase() === nick.toUpperCase());

        if (idx !== -1) {
          const removed = players.splice(idx, 1)[0];
          savePlayers();

          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `🗑️ Игрок ${removed.nick} удален!`,
            show_alert: true
          });

          // Return to team players list
          const team = 'main';
          const teamName = 'Main Roster';
          const teamPlayers = players.filter(p => p.team === 'main' || !p.team);

          let resp = `👥 *Управление игроками: ${teamName}*\n\nНажмите на игрока для изменения его роли или капитанства:`;
          const keyboard = [];

          teamPlayers.forEach(p => {
            keyboard.push([
              { text: `${p.cap ? '👑 ' : ''}${p.nick} (${p.role})`, callback_data: `player:view:${p.nick}` }
            ]);
          });

          keyboard.push([
            { text: '➕ Добавить игрока командой', callback_data: `player:add_hint:main` }
          ]);

          keyboard.push([
            { text: '🔙 К составу', callback_data: 'menu:players' },
            { text: '🏠 Главное меню', callback_data: 'menu:main' }
          ]);

          await this.sendApiRequest('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: resp,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          });
          return;
        }
      }

      // System Status Menu
      if (data === 'menu:status') {
        await this.renderStatus(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Get Database Menu
      if (data === 'menu:get_db') {
        await this.renderGetDb(chatId, messageId);
        await this.sendApiRequest('answerCallbackQuery', { callback_query_id: cb.id });
        return;
      }

      // Export Specific DB table
      if (data.startsWith('db:export:')) {
        const table = data.split(':')[2];
        let dumpData = '';
        let tableName = '';

        if (table === 'bookings') {
          tableName = '📋 Пракки (bookings.json)';
          dumpData = JSON.stringify(bookings, null, 2);
        } else if (table === 'blocked') {
          tableName = '🔒 Закрытые даты (blockedDates.json)';
          dumpData = JSON.stringify(blockedDates, null, 2);
        } else if (table === 'players') {
          tableName = '👥 Составы и игроки (players.json)';
          dumpData = JSON.stringify(players, null, 2);
        } else if (table === 'matches') {
          tableName = '⚔️ Матчи (matches.json)';
          dumpData = JSON.stringify(matches, null, 2);
        } else if (table === 'all') {
          tableName = '📦 Полный дамп базы данных';
          dumpData = JSON.stringify({
            generatedAt: new Date().toISOString(),
            bookings,
            blockedDates,
            players,
            matches
          }, null, 2);
        }

        // Truncate if too long for a single Telegram message (limit 4096 chars)
        const isTruncated = dumpData.length > 3500;
        const textPayload = isTruncated ? dumpData.slice(0, 3500) + '\n... [Обрезано из-за лимита длины]' : dumpData;

        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: `💾 *${tableName}*\n\`\`\`json\n${textPayload}\n\`\`\``,
          parse_mode: 'Markdown'
        });

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `📥 Данные отправлены в чат!`,
          show_alert: false
        });
        return;
      }

      // Delete booking callback
      if (data.startsWith('delete:')) {
        const [_, bookingId] = data.split(':');
        const deleted = deleteBookingById(bookingId);

        if (!deleted) {
          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Заявка уже была удалена или не найдена.',
            show_alert: true
          });
          return;
        }

        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `🗑️ *Пракк #${bookingId} (${deleted.opponentTeam} — ${deleted.date}) был полностью УДАЛЕН из расписания.* (Менеджер: ${fromUser})`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 В главное меню', callback_data: 'menu:main' }]]
          }
        });

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `🗑️ Пракк #${bookingId} удален!`,
          show_alert: false
        });
        return;
      }

      if (data.startsWith('confirm:') || data.startsWith('decline:')) {
        const [action, bookingId] = data.split(':');
        const booking = bookings.find(b => b.id === bookingId);

        if (!booking) {
          await this.sendApiRequest('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: '⚠️ Заявка не найдена в базе.',
            show_alert: true
          });
          return;
        }

        const isConfirm = action === 'confirm';
        booking.status = isConfirm ? 'confirmed' : 'declined';
        booking.managerDecisionBy = fromUser;
        booking.managerDecisionAt = new Date().toISOString();
        saveBookings();

        // Trigger email notification
        if (booking.email) {
          sendBookingStatusUpdateEmail(booking).catch(err => {
            console.error('Error sending bot callback status email:', err);
          });
        }

        const { text, tgLink } = this.formatBookingMessage(booking);

        const updatedKeyboard = [
          [
            { text: isConfirm ? '❌ Изменить на Отклонен' : '✅ Изменить на Принят', callback_data: `${isConfirm ? 'decline' : 'confirm'}:${booking.id}` },
            { text: '🗑️ Удалить', callback_data: `delete:${booking.id}` }
          ]
        ];
        if (tgLink) {
          updatedKeyboard.push([{ text: '💬 Написать противнику', url: tgLink }]);
        }

        // Edit Telegram message to reflect decision
        await this.sendApiRequest('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: updatedKeyboard
          }
        });

        await this.sendApiRequest('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: isConfirm ? `✅ Пракк #${booking.id} принят!` : `❌ Пракк #${booking.id} отклонен.`,
          show_alert: false
        });
      }
      return;
    }

    // Handle incoming text messages & reply keyboard buttons
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const senderId = String(msg.from?.id || msg.chat.id);
      const text = msg.text.trim();
      const lower = text.toLowerCase();
      const fromUser = msg.from?.first_name || 'Менеджер';

      // Security check: Only allowed admins can interact with the bot
      if (!isUserAllowedAdmin(senderId)) {
        console.warn(`[TelegramBot] Unauthorized message attempt from ID ${senderId} (@${msg.from?.username || 'unknown'} - ${fromUser}): "${text}"`);
        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: `⛔ *Доступ ограничен!*\n\nЭтот бот предназначен исключительно для руководства команды *Rekinder eSports*.\n\nВаш Telegram ID: \`${senderId}\`\nЕсли вы администратор, передайте этот ID руководству.`,
          parse_mode: 'Markdown',
          reply_markup: { remove_keyboard: true }
        });
        return;
      }

      // Auto-register authorized admin chat ID for notifications
      if (!managerChatIds.has(chatId)) {
        managerChatIds.add(chatId);
        saveManagerChats();
        console.log(`[TelegramBot] Registered authorized manager chat: ${chatId} (${fromUser})`);
      }

      if (lower.includes('ожидающ') || text === '⏳ Ожидающие заявки' || lower === '/pending') {
        await this.renderPendingBookings(chatId, null);
        return;
      }

      if (lower.includes('все пракки') || text === '📋 Все пракки' || lower === '/bookings' || lower === 'пракки') {
        await this.renderAllBookings(chatId, null);
        return;
      }

      if (lower.includes('закрыть день') || text === '🔒 Закрыть день' || lower === '/block') {
        await this.renderDatePicker(chatId, null, 'all');
        return;
      }

      if (lower.includes('закрытые дни') || text === '🔓 Закрытые дни' || lower === '/unblock' || lower === '/blocked') {
        await this.renderBlockedDays(chatId, null);
        return;
      }

      if (lower.includes('матчи') || text === '⚔️ Матчи и Игры' || lower === '/matches') {
        await this.renderMatches(chatId, null);
        return;
      }

      if (lower.includes('состав') || lower.includes('игрок') || text === '👥 Составы и Игроки' || lower === '/players') {
        await this.renderPlayers(chatId, null);
        return;
      }

      // /addplayer command
      if (lower.startsWith('/addplayer') || lower.startsWith('/player_add')) {
        const parts = text.split(/\s+/);
        // Format: /addplayer <nick> <role> <team> [cap]
        // or /addplayer <nick> <team>
        if (parts.length < 2) {
          const helpMsg = `ℹ️ *Формат команды добавления игрока:*\n\n` +
            `\`/addplayer НИК РОЛЬ СОСТАВ [cap]\`\n\n` +
            `*Параметры:*\n` +
            `• *НИК:* никнейм игрока (например, \`AIMIR666\`)\n` +
            `• *РОЛЬ:* \`Sniper\`, \`In-Game Leader\`, \`OpenFragger\`, \`Entry\`, \`Lurker\`, \`Support\`, \`Rifler\`\n` +
            `• *[cap]:* напишите \`cap\` или \`1\`, если он капитан\n\n` +
            `*Примеры:*\n` +
            `• \`/addplayer SIMPLE Sniper main cap\`\n` +
            `• \`/addplayer B1T Rifler\`\n` +
            `• \`/addplayer M0NESY Sniper\``;

          await this.sendApiRequest('sendMessage', {
            chat_id: chatId,
            text: helpMsg,
            parse_mode: 'Markdown'
          });
          return;
        }

        const nick = parts[1].trim();
        let role = 'Rifler';
        let team = 'main';
        let isCap = 0;

        // Parse remaining arguments intelligently
        for (let i = 2; i < parts.length; i++) {
          const arg = parts[i].trim().toLowerCase();
          if (arg === 'main' || arg === 'основа') {
            team = 'main';
          } else if (arg === 'cap' || arg === 'капитан' || arg === '1') {
            isCap = 1;
          } else if (['sniper', 'awp', 'снайпер'].includes(arg)) {
            role = 'Sniper';
          } else if (['igl', 'in-game leader', 'капитан-лидер', 'лидер'].includes(arg)) {
            role = 'In-Game Leader';
          } else if (['entry', 'openfragger', 'энтри'].includes(arg)) {
            role = 'OpenFragger';
          } else if (['lurker', 'люркер'].includes(arg)) {
            role = 'Lurker';
          } else if (['support', 'саппорт'].includes(arg)) {
            role = 'Support';
          } else if (['rifler', 'рифлер'].includes(arg)) {
            role = 'Rifler';
          } else if (i === 2) {
            // Keep verbatim role if specified as 2nd arg
            role = parts[i].trim();
          }
        }

        // Check if player exists
        const existingIdx = players.findIndex(p => p.nick.toUpperCase() === nick.toUpperCase());
        if (isCap) {
          // Remove cap from other players in this team
          players.forEach(p => {
            if (p.team === team) p.cap = 0;
          });
        }

        if (existingIdx !== -1) {
          players[existingIdx] = {
            ...players[existingIdx],
            nick: nick,
            role: role,
            team: team,
            cap: isCap
          };
        } else {
          players.push({
            nick: nick,
            role: role,
            team: team,
            cap: isCap,
            photo: 'player_default.png'
          });
        }

        savePlayers();

        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: `✅ *Игрок успешно сохранен!*\n\n` +
            `👤 *Ник:* \`${nick}\`\n` +
            `🎯 *Роль:* ${role}\n` +
            `🛡️ *Состав:* ${team.toUpperCase()}\n` +
            `👑 *Капитан:* ${isCap ? 'Да' : 'Нет'}\n\n` +
            `_Изменения сразу применены на сайте и в базе!_`,
          parse_mode: 'Markdown'
        });

        await this.renderPlayers(chatId, null);
        return;
      }

      // /delplayer command
      if (lower.startsWith('/delplayer') || lower.startsWith('/removeplayer')) {
        const parts = text.split(/\s+/);
        if (parts.length < 2) {
          await this.sendApiRequest('sendMessage', {
            chat_id: chatId,
            text: `ℹ️ Использование: \`/delplayer НИК\`\nНапример: \`/delplayer AIMIR666\``,
            parse_mode: 'Markdown'
          });
          return;
        }

        const nick = parts[1].trim();
        const idx = players.findIndex(p => p.nick.toUpperCase() === nick.toUpperCase());
        if (idx !== -1) {
          const removed = players.splice(idx, 1)[0];
          savePlayers();
          await this.sendApiRequest('sendMessage', {
            chat_id: chatId,
            text: `🗑️ Игрок *${removed.nick}* успешно удален из состава *${removed.team.toUpperCase()}*!`,
            parse_mode: 'Markdown'
          });
          await this.renderPlayers(chatId, null);
        } else {
          await this.sendApiRequest('sendMessage', {
            chat_id: chatId,
            text: `⚠️ Игрок с ником *${nick}* не найден в базе.`,
            parse_mode: 'Markdown'
          });
        }
        return;
      }

      // /addmatch command
      if (lower.startsWith('/addmatch')) {
        const parts = text.split(/\s+/);
        // /addmatch <opponent> <score> [WIN/LOSS]
        if (parts.length < 3) {
          await this.sendApiRequest('sendMessage', {
            chat_id: chatId,
            text: `ℹ️ *Формат добавления матча:*\n\n\`/addmatch Соперник Счет [WIN/LOSS]\`\n\n*Пример:*\n\`/addmatch "NAVI Junior" 13:9 WIN\``,
            parse_mode: 'Markdown'
          });
          return;
        }

        const opp = parts[1].replace(/["']/g, '');
        const score = parts[2];
        const status = (parts[3] || 'WIN').toUpperCase();
        const today = new Date().toISOString().split('T')[0];

        matches.unshift({
          opponent: opp,
          score: score,
          status: status.includes('WIN') || status.includes('ПОБЕДА') ? 'WIN' : 'LOSS',
          opp_logo: 'trophy.png',
          date: today
        });
        saveMatches();

        await this.sendApiRequest('sendMessage', {
          chat_id: chatId,
          text: `⚔️ *Матч успешно добавлен в историю!*\n\n• Противник: *${opp}*\n• Счет: *${score}* (${status})\n• Дата: ${today}`,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (lower.includes('статус') || text === '📊 Статус системы' || lower === '/status') {
        await this.renderStatus(chatId, null);
        return;
      }

      if (lower.includes('экспорт') || lower.includes('получить бд') || lower.includes('дамп') || text === '💾 Экспорт БД' || lower === '/db') {
        await this.renderGetDb(chatId, null);
        return;
      }

      // Default: show main menu with updated persistent keyboard
      await this.renderMainMenu(chatId, null, fromUser, true);
      return;
    }
  }

  // Polling loop for Telegram Updates
  startPolling() {
    if (!this.isConfigured()) {
      console.log('[TelegramBot] Bot token not provided. Telegram notifications will be logged to console.');
      return;
    }

    if (this.pollingActive) return;
    this.pollingActive = true;
    console.log('[TelegramBot] Starting long polling for Telegram updates...');

    const poll = async () => {
      if (!this.pollingActive) return;
      try {
        const updates = await this.sendApiRequest('getUpdates', {
          offset: this.lastUpdateId + 1,
          timeout: 20,
          allowed_updates: ['message', 'callback_query']
        });

        if (updates && updates.ok && Array.isArray(updates.result)) {
          for (const upd of updates.result) {
            this.lastUpdateId = upd.update_id;
            await this.handleUpdate(upd);
          }
        }
      } catch (err) {
        console.error('[TelegramBot] Polling loop error:', err.message);
      }

      if (this.pollingActive) {
        setTimeout(poll, 1500);
      }
    };

    poll();
  }

  stopPolling() {
    this.pollingActive = false;
  }
}

const telegramBot = new TelegramBotService();

// Export data and service functions
export {
  bookings,
  saveBookings,
  blockedDates,
  saveBlockedDates,
  players,
  savePlayers,
  matches,
  saveMatches,
  deleteBookingById,
  telegramBot,
  managerChatIds
};
