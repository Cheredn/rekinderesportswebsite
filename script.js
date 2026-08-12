// Plexus Animation
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

init();
animate();

// Mobile Menu
const menuToggle = document.getElementById('mobile-menu');
const navLinks = document.querySelector('.nav-links');
menuToggle.addEventListener('click', () => { navLinks.classList.toggle('active'); });

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
                </div>
            `;
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
                <div class="match-status">${m.status}</div>
            `;
            loader.appendChild(card);
        });
    } catch (e) { console.log("Matches error"); }
}

updateRoster();
updateMatches();

// Reveal
function reveal() {
    let reveals = document.querySelectorAll(".reveal");
    for (let i = 0; i < reveals.length; i++) {
        let windowHeight = window.innerHeight;
        let elementTop = reveals[i].getBoundingClientRect().top;
        if (elementTop < windowHeight - 100) reveals[i].classList.add("active");
    }
}
window.addEventListener("scroll", reveal);
reveal();
