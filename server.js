import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
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
} from './botService.js';
import { sendBookingReceivedEmail, sendBookingStatusUpdateEmail, sentEmailsHistory } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.get('/api/players', (req, res) => {
  res.json(players);
});

app.get('/api/matches', (req, res) => {
  res.json(matches.slice(0, 5));
});

app.post('/api/matches', (req, res) => {
  const { opponent, score, status, opp_logo } = req.body || {};
  if (!opponent || !score) {
    return res.status(400).json({ error: 'Missing required match data' });
  }
  const newMatch = {
    opponent,
    score,
    status: (status || 'WIN').toUpperCase(),
    opp_logo: opp_logo || 'logo.png',
    date: new Date().toISOString().split('T')[0]
  };
  matches.unshift(newMatch);
  saveMatches();
  res.status(201).json(newMatch);
});

app.post('/api/players', (req, res) => {
  const { nick, role, team, cap, photo } = req.body || {};
  if (!nick) {
    return res.status(400).json({ error: 'Missing player nickname' });
  }
  const updatedPlayer = {
    nick: nick.toUpperCase(),
    role: role || 'Player',
    team: team || 'main',
    cap: cap ? 1 : 0,
    photo: photo || 'logo.png',
  };
  const existingIdx = players.findIndex(p => p.nick.toUpperCase() === nick.toUpperCase());
  if (existingIdx !== -1) {
    players[existingIdx] = updatedPlayer;
  } else {
    players.push(updatedPlayer);
  }
  savePlayers();
  res.json(updatedPlayer);
});

// Booking API Routes
app.get('/api/bookings', (req, res) => {
  const { team, status, date } = req.query;
  let result = [...bookings];
  if (team) {
    result = result.filter(b => b.team === team);
  }
  if (status) {
    result = result.filter(b => b.status === status);
  }
  if (date) {
    result = result.filter(b => b.date === date);
  }
  // Return sorted with latest first
  result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json(result);
});

app.get('/api/bookings/bot-status', (req, res) => {
  res.json({
    isConfigured: telegramBot.isConfigured(),
    managerChatsCount: managerChatIds.size,
    polling: telegramBot.pollingActive
  });
});

// Blocked Dates API Routes
app.get('/api/blocked-dates', (req, res) => {
  const { team } = req.query;
  let result = [...blockedDates];
  if (team) {
    result = result.filter(b => b.team === team || b.team === 'all');
  }
  res.json(result);
});

app.post('/api/blocked-dates', (req, res) => {
  const { date, team, reason, blockedBy } = req.body || {};
  if (!date) {
    return res.status(400).json({ error: 'Укажите дату для блокировки' });
  }

  const existingIdx = blockedDates.findIndex(b => b.date === date && (b.team === team || b.team === 'all' || team === 'all'));
  const newBlock = {
    date,
    team: team || 'all',
    reason: reason || 'Команда занята',
    blockedBy: blockedBy || 'Менеджер',
    blockedAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    blockedDates[existingIdx] = newBlock;
  } else {
    blockedDates.push(newBlock);
  }
  saveBlockedDates();

  res.status(201).json({ success: true, blockedDate: newBlock });
});

app.delete('/api/blocked-dates/:date', (req, res) => {
  const { date } = req.params;
  const { team } = req.query;

  const prevLen = blockedDates.length;
  const filtered = blockedDates.filter(b => !(b.date === date && (!team || team === 'all' || b.team === team || b.team === 'all')));
  blockedDates.length = 0;
  blockedDates.push(...filtered);
  saveBlockedDates();

  res.json({ success: true, unblocked: prevLen > blockedDates.length });
});

app.post('/api/bookings', async (req, res) => {
  try {
    const {
      team,
      opponentTeam,
      contact,
      email,
      date,
      time,
      format,
      teamLink,
      comment,
      teamLogo
    } = req.body || {};

    if (!opponentTeam || !contact || !date || !time) {
      return res.status(400).json({ error: 'Пожалуйста, заполните обязательные поля (Команда, Контакт, Дата и Время)' });
    }

    const targetTeam = team === 'junior' ? 'junior' : 'main';

    // Check if the requested date is blocked by management
    const isBlocked = blockedDates.some(b => b.date === date && (b.team === targetTeam || b.team === 'all'));
    if (isBlocked) {
      const blockInfo = blockedDates.find(b => b.date === date && (b.team === targetTeam || b.team === 'all'));
      const reasonText = blockInfo?.reason ? ` (${blockInfo.reason})` : '';
      return res.status(400).json({
        error: `Дата ${date} закрыта менеджментом для бронирования пракков${reasonText}. Пожалуйста, выберите другую дату.`
      });
    }

    // Generate unique pracc ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newBooking = {
      id: `PRAC-${randomSuffix}`,
      team: targetTeam,
      opponentTeam: opponentTeam.trim(),
      contact: contact.trim(),
      email: email ? email.trim() : '',
      date,
      time,
      format: format || 'BO3',
      teamLink: teamLink ? teamLink.trim() : '',
      comment: comment ? comment.trim() : '',
      teamLogo: teamLogo || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    bookings.unshift(newBooking);
    saveBookings();

    // Trigger Telegram notification asynchronously (does not block client response)
    telegramBot.notifyNewBooking(newBooking).catch(botErr => {
      console.error('Error notifying telegram bot:', botErr);
    });

    // Trigger Email notification (if email is provided)
    if (newBooking.email) {
      sendBookingReceivedEmail(newBooking).catch(err => {
        console.error('Error sending creation email:', err);
      });
    }

    res.status(201).json({
      success: true,
      booking: newBooking,
      message: `Заявка #${newBooking.id} успешно создана и отправлена руководству в Telegram!`
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при создании заявки' });
  }
});

app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteBookingById(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Заявка на пракк не найдена' });
  }
  res.json({ success: true, deletedBooking: deleted });
});

app.patch('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, managerDecisionBy } = req.body || {};
  
  const booking = bookings.find(b => b.id.toUpperCase() === id.toUpperCase());
  if (!booking) {
    return res.status(404).json({ error: 'Заявка не найдена' });
  }

  if (status) {
    booking.status = status;
    booking.managerDecisionBy = managerDecisionBy || 'Web Manager';
    booking.managerDecisionAt = new Date().toISOString();
    saveBookings();

    // Trigger status update email (confirmed / declined)
    if (booking.email) {
      sendBookingStatusUpdateEmail(booking).catch(err => {
        console.error('Error sending status email:', err);
      });
    }
  }

  res.json({ success: true, booking });
});

// Email Inspection API (for previewing emails live without hosting/PC download)
app.get('/api/emails/recent', (req, res) => {
  res.json({
    success: true,
    count: sentEmailsHistory.length,
    emails: sentEmailsHistory.map(e => ({
      id: e.id,
      bookingId: e.bookingId,
      to: e.to,
      subject: e.subject,
      type: e.type,
      sentAt: e.sentAt,
      isTest: e.isTest,
      previewUrl: e.previewUrl
    }))
  });
});

app.get('/api/emails/preview/:id', (req, res) => {
  const email = sentEmailsHistory.find(e => e.id === req.params.id);
  if (!email) {
    return res.status(404).send('<h2>Email не найден</h2>');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(email.html);
});

// Telegram Webhook endpoint (if webhook is used instead of polling)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    await telegramBot.handleUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ ok: false });
  }
});

// Opponents static directory with fallback
const opponentsDir = path.join(__dirname, 'opponents');
if (!fs.existsSync(opponentsDir)) {
  fs.mkdirSync(opponentsDir, { recursive: true });
}

app.get('/opponents/:file', (req, res) => {
  const filePath = path.join(opponentsDir, req.params.file);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // Fallback to team logo if opponent logo does not exist
  return res.sendFile(path.join(__dirname, 'logo.png'));
});

// Static assets from root directory
app.use(express.static(__dirname));

// Fallback to index.html for root / unknown paths
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rekinder eSports server listening on http://0.0.0.0:${PORT}`);
  // Start Telegram bot polling if configured
  telegramBot.startPolling();
});
