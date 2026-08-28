import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory data store for players
let players = [
  { nick: 'AWESOME', role: 'Sniper', photo: 'awesome.png', team: 'main', cap: 0 },
  { nick: 'LASQUA', role: 'OpenFragger', photo: 'lasqua.png', team: 'main', cap: 0 },
  { nick: 'SHNYROQ', role: 'In-Game Leader', photo: 'shnyroq.png', team: 'main', cap: 1 },
  { nick: 'TAKUYA', role: 'Lurker', photo: 'takuya.png', team: 'main', cap: 0 },
  { nick: 'AIMIR666', role: 'Support', photo: 'aimir666.png', team: 'main', cap: 0 },
  // Junior Roster
  { nick: 'MOTT1VV', role: 'Rifler', photo: 'mott1vv.png', team: 'junior', cap: 0 },
  { nick: 'SAL1CH', role: 'Sniper', photo: 'sal1ch.png', team: 'junior', cap: 0 },
  { nick: 'ST0RMIE', role: 'Entry', photo: 'st0rmie.png', team: 'junior', cap: 0 },
  { nick: 'UNKNOWN', role: 'Support', photo: 'logo.png', team: 'junior', cap: 0 },
  { nick: 'UNKNOWN', role: 'Lurker', photo: 'logo.png', team: 'junior', cap: 0 },
];

// In-memory data store for matches
let matches = [
  { opponent: 'NAVI Junior', score: '13:9', status: 'WIN', opp_logo: 'navi.png' },
  { opponent: 'Spirit Academy', score: '13:11', status: 'WIN', opp_logo: 'spirit.png' },
  { opponent: 'MOUZ NXT', score: '9:13', status: 'LOSS', opp_logo: 'mouz.png' },
  { opponent: 'Astralis Talent', score: '13:7', status: 'WIN', opp_logo: 'astralis.png' },
  { opponent: 'BIG Academy', score: '16:14', status: 'WIN', opp_logo: 'big.png' },
];

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
  };
  matches.unshift(newMatch);
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
  res.json(updatedPlayer);
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
});
