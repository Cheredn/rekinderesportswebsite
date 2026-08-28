// Plexus Animation Background
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5 + 0.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1 - 0.5;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
        if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
    }
    draw() {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function init() {
    particlesArray = [];
    for (let i = 0; i < 80; i++) particlesArray.push(new Particle());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
        for (let j = i; j < particlesArray.length; j++) {
            const dx = particlesArray[i].x - particlesArray[j].x;
            const dy = particlesArray[i].y - particlesArray[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${1 - dist/150})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init();
});
init(); animate();

// --- СОЧНОЕ МОБИЛЬНОЕ МЕНЮ ---
const menuToggle = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');
const body = document.body;

menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    menuToggle.classList.toggle('is-active');
    
    // Блокируем скролл сайта, когда меню открыто
    if (navLinks.classList.contains('active')) {
        body.style.overflow = 'hidden';
    } else {
        body.style.overflow = 'auto';
    }
});

// Закрытие меню при клике на ссылку
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuToggle.classList.remove('is-active');
        body.style.overflow = 'auto';
    });
});

// API: Players
async function updateRoster() {
    try {
        const response = await fetch('/api/players');
        const players = await response.json();
        const mainGrid = document.getElementById('main-roster-grid');
        const juniorGrid = document.getElementById('junior-roster-grid');
        mainGrid.innerHTML = ''; juniorGrid.innerHTML = '';
        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'player-card reveal active';
            card.innerHTML = `
                <div class="player-img"><img src="${p.photo}" onerror="this.src='logo.png'"></div>
                <div class="player-info">
                    ${p.cap ? '<div class="player-tag">CAPTAIN</div>' : ''}
                    <h3>${p.nick}</h3>
                    <p>${p.role}</p>
                </div>`;
            if (p.team === 'main') mainGrid.appendChild(card);
            else juniorGrid.appendChild(card);
        });
    } catch (e) { console.log("Roster error"); }
}

// API: Matches
async function updateMatches() {
    try {
        const response = await fetch('/api/matches');
        const matches = await response.json();
        const loader = document.getElementById('matches-loader');
        loader.innerHTML = ''; 
        matches.forEach((m, index) => {
            const card = document.createElement('div');
            const accent = (index === 0) ? 'is-latest' : 'is-old';
            card.className = `match-card ${m.status.toLowerCase()} ${accent} reveal active`;
            card.innerHTML = `
                <div class="match-team"><img src="logo.png" class="match-team-logo"><div class="team-name">REKINDER</div></div>
                <div class="score">${m.score}</div>
                <div class="match-team right"><img src="/opponents/${m.opp_logo}" class="match-team-logo"><div class="opponent">${m.opponent}</div></div>
                <div class="match-status">${m.status}</div>`;
            loader.appendChild(card);
        });
    } catch (e) { console.log("Matches error"); }
}

updateRoster(); updateMatches();
setInterval(updateMatches, 15000);

function reveal() {
    let reveals = document.querySelectorAll(".reveal");
    for (let i = 0; i < reveals.length; i++) {
        let windowHeight = window.innerHeight;
        let elementTop = reveals[i].getBoundingClientRect().top;
        if (elementTop < windowHeight - 100) reveals[i].classList.add("active");
    }
}
window.addEventListener("scroll", reveal); reveal();

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#booking-modal') {
            e.preventDefault();
            openBookingModal('main');
            return;
        }
        if (document.querySelector(targetId)) {
            e.preventDefault();
            document.querySelector(targetId).scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ==========================================================================
// SCRIM & PRACC CALENDAR BOOKING SYSTEM
// ==========================================================================

const scrimModal = document.getElementById('scrim-modal');
const scrimModalClose = document.getElementById('scrim-modal-close');
const scrimModalOverlay = document.getElementById('scrim-modal-overlay');
const navBookingBtn = document.getElementById('nav-booking-btn');
const btnBookingMain = document.getElementById('btn-booking-main');
const btnBookingJunior = document.getElementById('btn-booking-junior');
const bookingContainer = document.getElementById('booking-split-container');

// State
let selectedTeam = 'main';
let currentDate = new Date();
let selectedDateStr = new Date().toISOString().split('T')[0];
let selectedTimeStr = '18:00';
let uploadedTeamLogoBase64 = '';
let allBookings = [];
let allBlockedDates = [];
let schedulePollTimer = null;

// Open / Close Modal
function openBookingModal(team = 'main') {
    selectedTeam = team;
    updateTeamSelection(team);
    if (scrimModal) {
        scrimModal.classList.add('open');
        scrimModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    renderCalendar();
    loadScheduleData();
    if (!schedulePollTimer) {
        schedulePollTimer = setInterval(loadScheduleData, 8000);
    }
}

function closeBookingModal() {
    if (scrimModal) {
        scrimModal.classList.remove('open');
        scrimModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    if (schedulePollTimer) {
        clearInterval(schedulePollTimer);
        schedulePollTimer = null;
    }
}

if (scrimModalClose) scrimModalClose.addEventListener('click', closeBookingModal);
if (scrimModalOverlay) scrimModalOverlay.addEventListener('click', closeBookingModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && scrimModal && scrimModal.classList.contains('open')) {
        closeBookingModal();
    }
});

if (navBookingBtn) {
    navBookingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openBookingModal('main');
    });
}

if (btnBookingMain) {
    btnBookingMain.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openBookingModal('main');
    });
}

if (btnBookingJunior) {
    btnBookingJunior.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openBookingModal('junior');
    });
}

// Booking split button touch handling for mobile devices
if (bookingContainer) {
    bookingContainer.addEventListener('click', (e) => {
        if (e.target.closest('.booking-sub-btn')) return;
        if (window.innerWidth <= 768 || window.matchMedia('(hover: none)').matches) {
            bookingContainer.classList.toggle('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (!bookingContainer.contains(e.target)) {
            bookingContainer.classList.remove('active');
        }
    });
}

// Team Selection in Modal
function updateTeamSelection(team) {
    selectedTeam = team;
    const cardMain = document.getElementById('team-card-main');
    const cardJunior = document.getElementById('team-card-junior');
    const radioMain = document.querySelector('input[name="target_team"][value="main"]');
    const radioJunior = document.querySelector('input[name="target_team"][value="junior"]');

    if (team === 'junior') {
        if (cardMain) cardMain.classList.remove('active');
        if (cardJunior) cardJunior.classList.add('active');
        if (radioJunior) radioJunior.checked = true;
    } else {
        if (cardJunior) cardJunior.classList.remove('active');
        if (cardMain) cardMain.classList.add('active');
        if (radioMain) radioMain.checked = true;
    }
    renderCalendar();
}

document.querySelectorAll('.scrim-team-card').forEach(card => {
    card.addEventListener('click', function () {
        const team = this.getAttribute('data-team');
        updateTeamSelection(team);
    });
});

// Modal Tabs
const tabBtnForm = document.getElementById('tab-btn-form');
const tabBtnSchedule = document.getElementById('tab-btn-schedule');
const scrimTabForm = document.getElementById('scrim-tab-form');
const scrimTabSchedule = document.getElementById('scrim-tab-schedule');

if (tabBtnForm && tabBtnSchedule) {
    tabBtnForm.addEventListener('click', () => {
        tabBtnForm.classList.add('active');
        tabBtnSchedule.classList.remove('active');
        scrimTabForm.classList.add('active');
        scrimTabSchedule.classList.remove('active');
    });

    tabBtnSchedule.addEventListener('click', () => {
        tabBtnSchedule.classList.add('active');
        tabBtnForm.classList.remove('active');
        scrimTabSchedule.classList.add('active');
        scrimTabForm.classList.remove('active');
        loadScheduleData();
    });
}

// Interactive Calendar Engine
const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

let calYear = currentDate.getFullYear();
let calMonth = currentDate.getMonth();

function renderCalendar() {
    const monthTitle = document.getElementById('cal-month-title');
    const daysGrid = document.getElementById('calendar-days-grid');
    if (!monthTitle || !daysGrid) return;

    monthTitle.textContent = `${monthNames[calMonth]} ${calYear}`;
    daysGrid.innerHTML = '';

    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    // Monday as first day of week: (firstDayIndex + 6) % 7
    const adjustedFirstDay = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Fill blank cells before first day
    for (let i = 0; i < adjustedFirstDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'cal-day-cell disabled';
        daysGrid.appendChild(blank);
    }

    // Fill days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cell.className = 'cal-day-cell';
        cell.textContent = day;

        const cellDate = new Date(calYear, calMonth, day);
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Check if day is blocked by management
        const blockedInfo = allBlockedDates.find(b => b.date === dayStr && (b.team === selectedTeam || b.team === 'all'));

        if (cellDate < startOfToday) {
            cell.classList.add('disabled');
        } else if (blockedInfo) {
            cell.classList.add('blocked-day');
            cell.title = `День закрыт: ${blockedInfo.reason || 'Команда занята'}`;
            const blockTag = document.createElement('span');
            blockTag.className = 'cal-blocked-label';
            blockTag.textContent = 'ЗАНЯТО';
            cell.appendChild(blockTag);
        } else {
            if (dayStr === todayStr) {
                cell.classList.add('today');
            }
            if (dayStr === selectedDateStr) {
                cell.classList.add('selected');
            }

            // Check if there are bookings on this date
            const hasBooking = allBookings.some(b => b.date === dayStr && b.status !== 'declined');
            if (hasBooking) {
                cell.classList.add('has-booking');
            }

            cell.addEventListener('click', () => {
                selectedDateStr = dayStr;
                renderCalendar();
            });
        }

        daysGrid.appendChild(cell);
    }
}

const calPrevBtn = document.getElementById('cal-prev-month');
const calNextBtn = document.getElementById('cal-next-month');

if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) {
            calMonth = 11;
            calYear--;
        }
        renderCalendar();
    });
}

if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) {
            calMonth = 0;
            calYear++;
        }
        renderCalendar();
    });
}

// Time Slots Picker
const timeSlotButtons = document.querySelectorAll('.time-slot-btn');
const customTimeInput = document.getElementById('scrim-custom-time');

timeSlotButtons.forEach(btn => {
    btn.addEventListener('click', function () {
        timeSlotButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const val = this.getAttribute('data-time');
        if (val === 'custom') {
            if (customTimeInput) {
                customTimeInput.classList.remove('hidden');
                customTimeInput.focus();
                selectedTimeStr = customTimeInput.value || '19:00';
            }
        } else {
            if (customTimeInput) customTimeInput.classList.add('hidden');
            selectedTimeStr = val;
        }
    });
});

if (customTimeInput) {
    customTimeInput.addEventListener('input', (e) => {
        selectedTimeStr = e.target.value || '19:00';
    });
}

// CS2 Map Chips Toggle (Fixed & Reliable)
function getSelectedMaps() {
    const maps = [];
    document.querySelectorAll('.map-chip.selected').forEach(chip => {
        const map = chip.getAttribute('data-map');
        if (map) maps.push(map);
    });
    return maps;
}

function updateMapsCounter() {
    const counterEl = document.getElementById('maps-selected-counter');
    const selected = getSelectedMaps();
    if (!counterEl) return;
    const count = selected.length;
    let label = `${count} карт выбрано`;
    if (count === 1) label = '1 карта выбрана';
    else if (count >= 2 && count <= 4) label = `${count} карты выбрано`;
    counterEl.textContent = label;
}

document.querySelectorAll('.map-chip').forEach(chip => {
    chip.addEventListener('click', function (e) {
        e.preventDefault();
        this.classList.toggle('selected');
        updateMapsCounter();
    });
});

// Team Photo / Logo Upload Handling
const teamLogoZone = document.getElementById('team-logo-zone');
const teamLogoInput = document.getElementById('scrim-team-logo-input');
const logoPlaceholder = document.getElementById('logo-placeholder');
const logoPreviewBox = document.getElementById('logo-preview-box');
const logoPreviewImg = document.getElementById('logo-preview-img');
const logoFileName = document.getElementById('logo-file-name');
const btnRemoveLogo = document.getElementById('btn-remove-logo');

function processImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите файл изображения (PNG, JPG, WEBP).');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Optional scale down if massive
            const maxDim = 800;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            uploadedTeamLogoBase64 = canvas.toDataURL('image/png', 0.9);

            if (logoPreviewImg) logoPreviewImg.src = uploadedTeamLogoBase64;
            if (logoFileName) logoFileName.textContent = file.name;
            if (logoPlaceholder) logoPlaceholder.classList.add('hidden');
            if (logoPreviewBox) logoPreviewBox.classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

if (teamLogoZone && teamLogoInput) {
    teamLogoZone.addEventListener('click', (e) => {
        if (e.target.closest('#btn-remove-logo')) return;
        teamLogoInput.click();
    });

    teamLogoInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        processImageFile(file);
    });

    teamLogoZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        teamLogoZone.classList.add('dragover');
    });

    teamLogoZone.addEventListener('dragleave', () => {
        teamLogoZone.classList.remove('dragover');
    });

    teamLogoZone.addEventListener('drop', (e) => {
        e.preventDefault();
        teamLogoZone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        processImageFile(file);
    });
}

if (btnRemoveLogo) {
    btnRemoveLogo.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadedTeamLogoBase64 = '';
        if (teamLogoInput) teamLogoInput.value = '';
        if (logoPreviewImg) logoPreviewImg.src = '';
        if (logoPreviewBox) logoPreviewBox.classList.add('hidden');
        if (logoPlaceholder) logoPlaceholder.classList.remove('hidden');
    });
}

// Booking Form Submit
const scrimForm = document.getElementById('scrim-booking-form');
const btnSubmitBooking = document.getElementById('btn-submit-booking');
const scrimSuccessView = document.getElementById('scrim-success-view');
const bookingSummaryCard = document.getElementById('booking-summary-card');

if (scrimForm) {
    scrimForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const opponentTeam = document.getElementById('scrim-opponent-team')?.value?.trim();
        const contact = document.getElementById('scrim-contact')?.value?.trim();
        const email = document.getElementById('scrim-email')?.value?.trim() || '';
        const format = document.getElementById('scrim-format')?.value || 'BO3';
        const teamLink = document.getElementById('scrim-team-link')?.value?.trim() || '';
        const comment = document.getElementById('scrim-comment')?.value?.trim() || '';

        const payload = {
            team: selectedTeam,
            opponentTeam,
            contact,
            email,
            date: selectedDateStr,
            time: selectedTimeStr,
            format,
            teamLink,
            comment,
            teamLogo: uploadedTeamLogoBase64 || ''
        };

        if (btnSubmitBooking) {
            btnSubmitBooking.disabled = true;
            btnSubmitBooking.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Отправка в Telegram...</span>';
        }

        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                const b = data.booking;
                const teamTitle = b.team === 'junior' ? 'Rekinder eSports Junior' : 'Rekinder eSports (Main)';

                if (bookingSummaryCard) {
                    const oppLogoHtml = b.teamLogo ? `<img src="${b.teamLogo}" alt="${b.opponentTeam}" style="width:28px;height:28px;border-radius:2px;object-fit:cover;margin-right:6px;vertical-align:middle;">` : '';
                    
                    bookingSummaryCard.innerHTML = `
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Код бронирования:</span>
                            <span class="booking-summary-value"><span class="booking-code-badge">#${b.id}</span></span>
                        </div>
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Состав Rekinder:</span>
                            <span class="booking-summary-value">${teamTitle}</span>
                        </div>
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Противник:</span>
                            <span class="booking-summary-value">${oppLogoHtml}${b.opponentTeam}</span>
                        </div>
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Дата и Время:</span>
                            <span class="booking-summary-value">${b.date} в ${b.time} (МСК)</span>
                        </div>
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Формат:</span>
                            <span class="booking-summary-value">${b.format || 'BO3'}</span>
                        </div>
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Контакт:</span>
                            <span class="booking-summary-value">${b.contact}</span>
                        </div>
                        ${b.email ? `
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Email:</span>
                            <span class="booking-summary-value">${b.email}</span>
                        </div>` : ''}
                        <div class="booking-summary-row">
                            <span class="booking-summary-label">Статус:</span>
                            <span class="booking-summary-value"><span class="status-badge pending">В ожидании подтверждения</span></span>
                        </div>
                    `;
                }

                if (scrimForm) scrimForm.classList.add('hidden');
                if (scrimSuccessView) scrimSuccessView.classList.remove('hidden');

                // Reload bookings
                loadScheduleData();
            } else {
                alert(data.error || 'Ошибка при отправке заявки');
            }
        } catch (err) {
            console.error('Booking error:', err);
            alert('Произошла сетевая ошибка при связи с сервером.');
        } finally {
            if (btnSubmitBooking) {
                btnSubmitBooking.disabled = false;
                btnSubmitBooking.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Отправить заявку на пракк</span>';
            }
        }
    });
}

// Success Screen Actions
const btnSuccessNew = document.getElementById('btn-success-new');
const btnSuccessClose = document.getElementById('btn-success-close');

if (btnSuccessNew) {
    btnSuccessNew.addEventListener('click', () => {
        if (scrimSuccessView) scrimSuccessView.classList.add('hidden');
        if (scrimForm) {
            scrimForm.classList.remove('hidden');
            scrimForm.reset();
            // Reset logo
            uploadedTeamLogoBase64 = '';
            if (logoPreviewBox) logoPreviewBox.classList.add('hidden');
            if (logoPlaceholder) logoPlaceholder.classList.remove('hidden');
        }
        renderCalendar();
    });
}

if (btnSuccessClose) {
    btnSuccessClose.addEventListener('click', closeBookingModal);
}

// Schedule & Status Loading
let currentFilterTeam = 'all';
let currentSearchQuery = '';

async function loadScheduleData() {
    try {
        const [bookingsRes, blockedRes] = await Promise.all([
            fetch('/api/bookings'),
            fetch('/api/blocked-dates')
        ]);
        if (bookingsRes.ok) {
            allBookings = await bookingsRes.json();
        }
        if (blockedRes.ok) {
            allBlockedDates = await blockedRes.json();
        }
        renderCalendar();
        renderScheduleList();
    } catch (err) {
        console.error('Error fetching schedule:', err);
    }
}

function renderScheduleList() {
    const listContainer = document.getElementById('schedule-list');
    if (!listContainer) return;

    let filtered = [...allBookings];

    if (currentFilterTeam !== 'all') {
        filtered = filtered.filter(b => b.team === currentFilterTeam);
    }

    if (currentSearchQuery) {
        const q = currentSearchQuery.toLowerCase();
        filtered = filtered.filter(b =>
            (b.id && b.id.toLowerCase().includes(q)) ||
            (b.opponentTeam && b.opponentTeam.toLowerCase().includes(q)) ||
            (b.contact && b.contact.toLowerCase().includes(q))
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="schedule-loader" style="color: #6b7280;">Заявок на пракки не найдено.</div>';
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(b => {
        const item = document.createElement('div');
        item.className = 'schedule-item';

        const teamName = b.team === 'junior' ? 'Rekinder Junior' : 'Rekinder eSports';
        const statusClass = b.status === 'confirmed' ? 'confirmed' : (b.status === 'declined' ? 'declined' : 'pending');
        const statusText = b.status === 'confirmed' ? 'Подтвержден' : (b.status === 'declined' ? 'Отклонен' : 'В ожидании');

        const oppLogoHtml = b.teamLogo
            ? `<img src="${b.teamLogo}" alt="${b.opponentTeam}" class="schedule-opp-logo">`
            : '';

        item.innerHTML = `
            <div class="schedule-item-main">
                <div class="schedule-teams-wrapper">
                    ${oppLogoHtml}
                    <div class="schedule-teams">
                        <span>${teamName}</span> vs ${b.opponentTeam}
                        <small style="color:#6b7280; font-family: monospace; font-size: 0.8rem; margin-left: 8px;">#${b.id}</small>
                    </div>
                </div>
                <div class="schedule-meta">
                    <span><i class="fa-regular fa-calendar"></i> ${b.date}</span>
                    <span><i class="fa-regular fa-clock"></i> ${b.time} МСК</span>
                    <span><i class="fa-solid fa-gamepad"></i> ${b.format || 'BO3'}</span>
                </div>
            </div>
            <div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Schedule Search & Filters
const searchInput = document.getElementById('schedule-search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.trim();
        renderScheduleList();
    });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilterTeam = this.getAttribute('data-filter-team') || 'all';
        renderScheduleList();
    });
});

