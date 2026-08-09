const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const IS_MOBILE = window.innerWidth <= 768;
if (IS_MOBILE) {
    const originalShadowBlur = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
        set(val) { originalShadowBlur.set.call(this, 0); },
        get() { return originalShadowBlur.get.call(this); }
    });
}

const scoreValue = document.getElementById('score-value');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScore = document.getElementById('final-score');
const highScoreEl = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const rankDisplay = document.getElementById('rank-display');
const multiplierDisplay = document.getElementById('multiplier-display');
const dashCooldownBar = document.getElementById('dash-cooldown-bar');

let gameState = 'START';
let animationId;
let score = 0;
let highScore = localStorage.getItem('neonRunnerHighScore') || 0;
let distance = 0;
let ghostDistance = localStorage.getItem('neonRunnerGhost') || 0;
let gameSpeed = 6;
let baseSpeed = 6;
let screenShake = 0;

let multiplier = 1;
let coins = 0;
let isDashing = false;
let dashTimer = 0;
let dashCooldown = 0;
const DASH_MAX_COOLDOWN = 600; 

let globalHue = 200; 
let cameraZoom = 1;
let cameraAngle = 0;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let beatTimer = 0;
let beatInterval = 30;

function playBeat() {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playSound(type) {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    } else if (type === 'coin') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 + (multiplier*100), audioCtx.currentTime);
        osc.frequency.setValueAtTime(1200 + (multiplier*100), audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    } else if (type === 'death') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    } else if (type === 'dash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    } else if (type === 'smash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    } else if (type === 'laser') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    } else if (type === 'life') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1600, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    }
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

const player = {
    x: window.innerWidth * 0.15, y: 0, width: 40, height: 40,
    dy: 0, jumpForce: -14, maxJumps: 2, jumpCount: 0,
    shieldActive: false, shieldTimer: 0,
    lives: 3, iframes: 0
};

const boss = {
    active: false, hp: 0, maxHp: 15,
    x: 0, y: 0, width: 100, height: 100,
    floatOffset: 0, attackTimer: 0, hitTimer: 0, warningTimer: 0
};
let bossSpawnTarget = 10000;
let bossKillCount = 0;

const gravity = 0.7;
const floorHeight = 100;
let floorY = canvas.height - floorHeight;

const obstacles = [];
const collectibles = [];
const powerups = [];
const projectiles = [];
const particles = [];
const backgroundStars = [];

for(let i=0; i<80; i++) {
    backgroundStars.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1, speedMultiplier: Math.random() * 0.8 + 0.2,
        blink: Math.random() > 0.5
    });
}

class Particle {
    constructor(x, y, color, type = 'normal') {
        this.x = x; this.y = y;
        this.size = Math.random() * (type === 'smash' ? 12 : 6) + 2;
        this.speedX = (Math.random() * 12 - 6) + (type === 'trail' ? -gameSpeed/1.5 : 0);
        this.speedY = Math.random() * -12 + 2;
        this.color = color; this.alpha = 1; this.decay = Math.random() * 0.04 + 0.01;
    }
    update() {
        this.x += this.speedX; this.y += this.speedY;
        this.speedY += gravity/2; this.alpha -= this.decay;
    }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha); ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size); ctx.restore();
    }
}

function spawnParticles(x, y, color, count, type='normal') {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color, type));
}

function addScore(amount) {
    score += amount * multiplier;
    scoreValue.innerText = score;
    updateRank();
}

function updateRank() {
    let rankText = "Bronze Runner"; let rankClass = "rank-bronze";
    if (score >= 10000) { rankText = "Boss Slayer"; rankClass = "rank-neon"; }
    else if (score >= 4000) { rankText = "Neon God"; rankClass = "rank-neon"; }
    else if (score >= 2000) { rankText = "Gold Dasher"; rankClass = "rank-gold"; }
    else if (score >= 800) { rankText = "Silver Sprinter"; rankClass = "rank-silver"; }
    
    if (rankDisplay.innerText !== rankText) {
        rankDisplay.innerText = rankText; rankDisplay.className = rankClass;
        rankDisplay.style.transform = "scale(1.4)";
        setTimeout(() => rankDisplay.style.transform = "scale(1)", 200);
    }
}

function spawnBoss() {
    boss.active = true;
    boss.maxHp = 15 + (bossKillCount * 15);
    boss.hp = boss.maxHp;
    boss.x = canvas.width + 200;
    boss.y = 50;
    boss.warningTimer = 180; 
    playSound('death'); 
    screenShake = 20;
}

function resetGame() {
    resizeCanvas();
    floorY = canvas.height - floorHeight;
    player.y = floorY - player.height;
    player.dy = 0; player.jumpCount = 0; player.shieldActive = false; player.shieldTimer = 0;
    player.lives = 3; player.iframes = 0;
    obstacles.length = 0; collectibles.length = 0; powerups.length = 0; projectiles.length = 0; particles.length = 0;
    score = 0; coins = 0; multiplier = 1; distance = 0; dashCooldown = 0; isDashing = false;
    globalHue = 200; cameraZoom = 1;
    boss.active = false; bossSpawnTarget = 10000; bossKillCount = 0;
    
    scoreValue.innerText = score; multiplierDisplay.innerText = "x1";
    updateRank();
    
    gameSpeed = window.innerWidth < 768 ? 6 : 8; 
    baseSpeed = gameSpeed;
    screenShake = 0;
}

let obstacleTimer = 0;
let nextSpawn = 80;

function spawnEntities() {
    let roll = Math.random();
    
    if (roll > 0.4) {
        if (boss.active) return; // Pure 1v1 duel during Boss phase
        let isTurret = distance > 2000 && Math.random() > 0.7;
        if (isTurret) {
            obstacles.push({
                type: 'turret', x: canvas.width + 50, y: floorY - 60, width: 40, height: 60,
                color: '#ef4444', laserFired: false, passed: false
            });
        } else {
            let size = Math.random() * 20 + 30; 
            let isFlying = Math.random() > 0.6;
            obstacles.push({
                type: 'sawblade', x: canvas.width + 50, y: isFlying ? floorY - size - 90 - (Math.random()*40) : floorY - size,
                radius: size, rotation: 0, rotSpeed: (Math.random() * 0.1) + 0.1, passed: false
            });
        }
    } else if (roll > 0.1) {
        let pattern = Math.floor(Math.random() * 3);
        let startY = floorY - 50 - (Math.random() * 100);
        for(let i=0; i < (pattern === 0 ? 1 : 3); i++) {
            let coinColor = '#fbbf24'; let coinValue = 5;
            if (distance > 3000 && Math.random() > 0.7) { coinColor = '#a855f7'; coinValue = 15; }
            if (distance > 8000 && Math.random() > 0.85) { coinColor = '#ef4444'; coinValue = 50; }
            collectibles.push({
                x: canvas.width + 50 + (i * 45), y: startY + (pattern === 2 ? (i*25) : 0),
                width: 20, height: 20, color: coinColor, value: coinValue,
                collected: false, floatOffset: Math.random() * Math.PI * 2
            });
        }
    } else {
        let typeRoll = Math.random();
        let powerupType = 'shield';
        let pColor = '#06b6d4'; // Cyan
        if (typeRoll > 0.8) { powerupType = 'life'; pColor = '#f43f5e'; } // Rare Pink Heart
        else if (typeRoll > 0.4) { powerupType = 'dash_refresh'; pColor = '#10b981'; } // Green
        
        powerups.push({
            type: powerupType, x: canvas.width + 50, y: floorY - 100 - (Math.random() * 50),
            width: 30, height: 30, color: pColor, collected: false, floatOffset: Math.random() * Math.PI * 2
        });
    }
}

function jump() {
    if (gameState !== 'PLAYING') return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    if (player.jumpCount < player.maxJumps) {
        player.dy = player.jumpForce;
        player.jumpCount++;
        playSound('jump');
        cameraAngle = -0.02;
        if (player.jumpCount > 1) spawnParticles(player.x + player.width/2, player.y + player.height, '#ffffff', 15, 'trail');
        else spawnParticles(player.x + player.width/2, player.y + player.height, `hsl(${globalHue}, 100%, 60%)`, 8);
    }
}

function dash() {
    if (gameState !== 'PLAYING') return;
    if (dashCooldown <= 0 && !isDashing) {
        isDashing = true; dashTimer = 25; dashCooldown = DASH_MAX_COOLDOWN;
        gameSpeed = baseSpeed * 3; player.dy = 0; playSound('dash'); cameraZoom = 1.05; 
        dashCooldownBar.classList.add('cooldown'); dashCooldownBar.style.width = '0%';
    }
}

function takeDamage() {
    if (player.shieldActive) {
        breakShield();
        return false; // Survived via shield
    }
    if (player.iframes > 0) return false; // Survived via invincibility
    
    player.lives--;
    playSound('hit');
    screenShake = 25;
    spawnParticles(player.x + player.width/2, player.y + player.height/2, '#f43f5e', 30, 'smash');
    
    if (player.lives <= 0) {
        gameOver();
        return true; // Died
    }
    
    player.iframes = 60; // 1 second invulnerability
    return false; // Survived by losing a life
}

function handleTap(x, y, isJump) {
    if (gameState !== 'PLAYING') return;
    
    if (boss.active && boss.hp > 0 && boss.warningTimer <= 0) {
        if (x > boss.x - 40 && x < boss.x + boss.width + 40 &&
            y > boss.y - 40 && y < boss.y + boss.height + 40) {
            
            boss.hp--; boss.hitTimer = 5;
            spawnParticles(x, y, '#ffffff', 5); playSound('hit');
            
            if (boss.hp <= 0) {
                boss.active = false; bossSpawnTarget += 10000; bossKillCount++;
                addScore(5000); screenShake = 50; playSound('death'); 
                spawnParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#a855f7', 80, 'smash');
            }
            return;
        }
    }
    
    if (isJump) jump();
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') jump();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dash();
});

let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
    if (e.target.tagName !== 'BUTTON') { 
        e.preventDefault(); 
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
        for(let i=0; i<e.touches.length; i++) {
            handleTap(e.touches[i].clientX, e.touches[i].clientY, true);
        }
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (e.target.tagName !== 'BUTTON') { 
        let touchEndX = e.changedTouches[0].clientX;
        let touchEndY = e.changedTouches[0].clientY;
        let dx = touchEndX - touchStartX;
        let dy = touchEndY - touchStartY;
        
        // Swipe Right to Dash
        if (dx > 40 && Math.abs(dx) > Math.abs(dy)) {
            dash();
        }
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'BUTTON') {
        handleTap(e.clientX, e.clientY, true);
    }
});

function breakShield() {
    player.shieldActive = false; player.shieldTimer = 0; playSound('smash'); screenShake = 15;
    spawnParticles(player.x + player.width/2, player.y + player.height/2, '#06b6d4', 40, 'smash');
}

function update() {
    if (gameState === 'GAME_OVER') return;

    if (gameState === 'START') {
        let attractSpeed = 3; distance += attractSpeed; globalHue = (200 + (distance * 0.01)) % 360;
        backgroundStars.forEach(star => {
            star.x -= attractSpeed * star.speedMultiplier;
            if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
        });
        player.y = floorY - player.height + Math.sin(Date.now() / 300) * 5;
        return; 
    }

    distance += gameSpeed;
    if (player.iframes > 0) player.iframes--;
    
    if (distance > bossSpawnTarget && !boss.active) spawnBoss();

    if (boss.active) {
        if (boss.warningTimer > 0) boss.warningTimer--;
        boss.y = 50 + Math.sin(boss.floatOffset) * 20;
        boss.floatOffset += 0.05;
        let targetX = canvas.width - 200;
        boss.x += (targetX - boss.x) * 0.05;
        if (boss.hitTimer > 0) boss.hitTimer--;
        
        if (boss.warningTimer <= 0) {
            boss.attackTimer++;
            let attackDelay = Math.max(15, 60 - (bossKillCount * 10)); // Gets faster every encounter
            if (boss.attackTimer > (Math.random() * attackDelay + attackDelay)) {
                boss.attackTimer = 0; playSound('laser');
                let dx = (player.x + player.width/2) - (boss.x + boss.width/2);
                let dy = (player.y + player.height/2) - (boss.y + boss.height/2);
                let mag = Math.sqrt(dx*dx + dy*dy);
                let speed = 12 + (baseSpeed * 0.5);
                projectiles.push({
                    x: boss.x + boss.width/2, y: boss.y + boss.height/2,
                    width: 20, height: 20, color: '#a855f7',
                    vx: (dx/mag) * speed, vy: (dy/mag) * speed
                });
            }
        }
    }

    let startSpeed = window.innerWidth < 768 ? 6.5 : 8.5;
    baseSpeed = startSpeed + (distance * 0.00005);
    if (baseSpeed > 18) baseSpeed = 18; 
    if (!isDashing) gameSpeed = baseSpeed;

    globalHue = (200 + (distance * 0.01)) % 360; 

    beatTimer++;
    beatInterval = Math.max(15, 40 - (gameSpeed)); 
    if (beatTimer > beatInterval) { playBeat(); beatTimer = 0; cameraZoom = isDashing ? 1.05 : 1.02; }

    if (cameraZoom > 1) cameraZoom -= 0.01;
    if (cameraAngle < 0) cameraAngle += 0.002;

    if (player.shieldActive) {
        player.shieldTimer--;
        if (player.shieldTimer <= 0) {
            player.shieldActive = false; spawnParticles(player.x, player.y, '#06b6d4', 10);
        }
    }

    if (isDashing) {
        dashTimer--; spawnParticles(player.x, player.y + Math.random()*player.height, '#10b981', 3, 'trail');
        globalHue = (globalHue + 50) % 360; 
        if (dashTimer <= 0) { isDashing = false; gameSpeed = baseSpeed; }
    }

    if (dashCooldown > 0) {
        dashCooldown--;
        dashCooldownBar.style.width = ((DASH_MAX_COOLDOWN - dashCooldown) / DASH_MAX_COOLDOWN * 100) + '%';
        if (dashCooldown === 0) {
            dashCooldownBar.classList.remove('cooldown');
            dashCooldownBar.style.boxShadow = '0 0 25px #10b981';
            setTimeout(() => dashCooldownBar.style.boxShadow = '0 0 15px #10b981', 300);
        }
    }

    if (!isDashing) {
        player.y += player.dy;
        if (player.y + player.height < floorY) { player.dy += gravity; } 
        else {
            player.dy = 0; player.y = floorY - player.height; player.jumpCount = 0;
            if (multiplier > 1) {
                multiplier = 1; multiplierDisplay.innerText = `x${multiplier}`; multiplierDisplay.style.color = '#fbbf24';
            }
        }
    }

    obstacleTimer++;
    if (obstacleTimer > nextSpawn) {
        spawnEntities(); obstacleTimer = 0;
        nextSpawn = Math.max(40, Math.random() * 50 + 60 - (gameSpeed * 1.5));
    }

    backgroundStars.forEach(star => {
        star.x -= gameSpeed * star.speedMultiplier;
        if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
    });

    for (let i = 0; i < powerups.length; i++) {
        let p = powerups[i]; p.x -= gameSpeed; p.floatOffset += 0.1;
        if (player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y < p.y + p.height && player.y + player.height > p.y) {
            playSound(p.type === 'life' ? 'life' : 'powerup'); 
            spawnParticles(p.x + p.width/2, p.y + p.height/2, p.color, 30); 
            
            if (p.type === 'shield') { player.shieldActive = true; player.shieldTimer = 300; addScore(100); } 
            else if (p.type === 'dash_refresh') { dashCooldown = 0; addScore(100); }
            else if (p.type === 'life') {
                if (player.lives < 3) { player.lives++; }
                else { addScore(500); }
            }
            powerups.splice(i, 1); i--; continue;
        }
        if (p.x + p.width < 0) { powerups.splice(i, 1); i--; }
    }

    for (let i = 0; i < collectibles.length; i++) {
        let c = collectibles[i]; c.x -= gameSpeed; c.floatOffset += 0.15;
        if (!c.collected && player.x < c.x + c.width && player.x + player.width > c.x &&
            player.y < c.y + c.height && player.y + player.height > c.y) {
            c.collected = true; coins++;
            if (player.y + player.height < floorY) {
                multiplier++; multiplierDisplay.innerText = `x${multiplier}`;
                if (multiplier >= 10) multiplierDisplay.style.color = '#a855f7';
                else if (multiplier >= 5) multiplierDisplay.style.color = '#ef4444';
                multiplierDisplay.classList.add('pop'); setTimeout(() => multiplierDisplay.classList.remove('pop'), 100);
            }
            addScore(c.value); playSound('coin'); spawnParticles(c.x + c.width/2, c.y + c.height/2, c.color, 20);
        }
        if (c.x + c.width < 0 || c.collected) { collectibles.splice(i, 1); i--; }
    }

    for (let i = 0; i < projectiles.length; i++) {
        let proj = projectiles[i];
        proj.x += proj.vx || -(gameSpeed * 2.5); proj.y += proj.vy || 0;
        
        if (player.x + 10 < proj.x + proj.width && player.x + player.width - 10 > proj.x &&
            player.y + 10 < proj.y + proj.height && player.y + player.height - 10 > proj.y) {
            if (isDashing) {
                playSound('smash'); spawnParticles(proj.x, proj.y, proj.color, 20, 'smash');
                projectiles.splice(i, 1); i--; addScore(50); continue;
            } else {
                if (takeDamage()) return; // Player died
                // If survived (shield or iframes), destroy projectile
                projectiles.splice(i, 1); i--; continue;
            }
        }
        if (proj.x + proj.width < 0 || proj.y > canvas.height || proj.x > canvas.width + 100) { projectiles.splice(i, 1); i--; }
    }

    for (let i = 0; i < obstacles.length; i++) {
        let o = obstacles[i]; o.x -= gameSpeed;
        if (o.type === 'turret') {
            if (!o.laserFired && o.x < canvas.width - 150) {
                o.laserFired = true; playSound('laser');
                projectiles.push({ x: o.x, y: o.y + 10, width: 60, height: 10, color: '#ef4444' });
            }
            if (player.x + 5 < o.x + o.width && player.x + player.width - 5 > o.x &&
                player.y + 5 < o.y + o.height && player.y + player.height - 5 > o.y) {
                if (isDashing) {
                    playSound('smash'); screenShake = 15; spawnParticles(o.x, o.y, '#ef4444', 40, 'smash');
                    obstacles.splice(i, 1); i--; addScore(50); continue;
                } else {
                    if (takeDamage()) return; 
                    obstacles.splice(i, 1); i--; continue; 
                }
            }
            if (!o.passed && o.x + o.width < player.x) { o.passed = true; addScore(15); }
        } else {
            o.rotation += o.rotSpeed;
            let dx = (player.x + player.width/2) - o.x; let dy = (player.y + player.height/2) - o.y;
            let distanceToCenter = Math.sqrt(dx * dx + dy * dy);
            if (distanceToCenter < o.radius + (player.width/2) - 8) {
                if (isDashing) {
                    playSound('smash'); screenShake = 15; spawnParticles(o.x, o.y, '#ef4444', 40, 'smash');
                    obstacles.splice(i, 1); i--; addScore(25); continue;
                } else {
                    if (takeDamage()) return;
                    obstacles.splice(i, 1); i--; continue;
                }
            }
            if (!o.passed && o.x + o.radius < player.x) { o.passed = true; addScore(10); }
        }
        if (o.type === 'turret') { if (o.x + o.width < 0) { obstacles.splice(i, 1); i--; } } 
        else { if (o.x + o.radius < 0) { obstacles.splice(i, 1); i--; } }
    }
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update(); if (particles[i].alpha <= 0) { particles.splice(i, 1); i--; }
    }
}

function draw() {
    if (screenShake > 0) screenShake *= 0.9;
    if (screenShake < 0.5) screenShake = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.rotate(cameraAngle);
    if (screenShake > 0) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    ctx.translate(-canvas.width/2, -canvas.height/2);

    ctx.fillStyle = '#ffffff';
    backgroundStars.forEach(star => {
        ctx.globalAlpha = star.blink && Math.random() > 0.9 ? 0.2 : star.speedMultiplier;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1;

    let primaryColor = `hsl(${globalHue}, 100%, 60%)`;
    ctx.strokeStyle = `hsla(${globalHue}, 100%, 60%, 0.2)`; ctx.lineWidth = 1;
    let gridOffset = (distance * 0.6) % 50;
    
    ctx.beginPath();
    for(let i = 0; i < canvas.width + 50; i+=50) { ctx.moveTo(i - gridOffset, 0); ctx.lineTo(i - gridOffset, canvas.height); }
    for(let i = 0; i < canvas.height; i+=50) { ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); }
    ctx.stroke();

    ctx.fillStyle = '#050510'; ctx.fillRect(0, floorY, canvas.width, floorHeight);
    ctx.shadowBlur = 30; ctx.shadowColor = primaryColor; ctx.fillStyle = primaryColor;
    ctx.fillRect(0, floorY, canvas.width, 4); ctx.shadowBlur = 0;

    if (ghostDistance > 0 && gameState === 'PLAYING') {
        let distDiff = ghostDistance - distance;
        if (distDiff > -canvas.width && distDiff < canvas.width) {
            let lineX = player.x + distDiff;
            ctx.shadowBlur = 40; ctx.shadowColor = '#10b981'; ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
            ctx.fillRect(lineX, 0, 8, canvas.height);
            ctx.fillStyle = '#10b981'; ctx.font = '900 24px Outfit';
            ctx.fillText("GHOST RECORD", lineX + 15, canvas.height / 2); ctx.shadowBlur = 0;
        }
    }

    if (boss.active) {
        if (boss.warningTimer > 0) {
            ctx.fillStyle = '#ef4444'; ctx.font = '900 60px Outfit'; ctx.textAlign = 'center';
            let alpha = Math.sin(boss.warningTimer * 0.5) > 0 ? 1 : 0.2;
            ctx.globalAlpha = alpha;
            ctx.fillText("WARNING: BOSS APPROACHING", canvas.width/2, canvas.height/3);
            ctx.globalAlpha = 1; ctx.textAlign = 'left';
        } else {
            ctx.fillStyle = boss.hitTimer > 0 ? '#ffffff' : '#a855f7';
            ctx.shadowBlur = 40; ctx.shadowColor = '#a855f7';
            ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
            ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.arc(boss.x + boss.width/2, boss.y + boss.height/2, 20 + Math.sin(Date.now()/100)*5, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(boss.x, boss.y - 30, boss.width, 10);
            ctx.fillStyle = '#ef4444'; ctx.fillRect(boss.x, boss.y - 30, boss.width * (boss.hp / boss.maxHp), 10);
            ctx.fillStyle = '#ffffff'; ctx.font = '800 16px Outfit'; ctx.textAlign = 'center';
            ctx.fillText(`${boss.hp} HP`, boss.x + boss.width/2, boss.y - 40); ctx.textAlign = 'left';
        }
    }

    // Player blinking for iframes
    if (player.iframes > 0) {
        ctx.globalAlpha = Math.sin(Date.now() / 40) > 0 ? 1 : 0.3;
    }

    ctx.fillStyle = primaryColor;
    ctx.shadowBlur = isDashing ? 50 : (player.shieldActive ? 30 : 25);
    ctx.shadowColor = isDashing ? '#10b981' : (player.shieldActive ? '#06b6d4' : primaryColor);
    
    let pulse = Math.sin(Date.now() / 150) * 3;
    if (isDashing) { ctx.fillStyle = '#10b981'; ctx.fillRect(player.x, player.y, player.width + 30, player.height); } 
    else { ctx.fillRect(player.x - pulse/2, player.y - pulse/2, player.width + pulse, player.height + pulse); }
    
    if (player.shieldActive) {
        ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 4; ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width, 0, Math.PI*2); ctx.stroke();
    }
    
    if (player.jumpCount < player.maxJumps && !isDashing) {
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff';
        ctx.beginPath(); ctx.arc(player.x + player.width/2, player.y - 12, 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1; // reset alpha

    powerups.forEach(p => {
        ctx.fillStyle = p.color; ctx.shadowBlur = 20; ctx.shadowColor = p.color;
        let floatY = p.y + Math.sin(p.floatOffset) * 8;
        
        if (p.type === 'life') {
            // Draw a cute heart polygon for life
            ctx.beginPath();
            ctx.moveTo(p.x + p.width/2, floatY + p.height/4);
            ctx.bezierCurveTo(p.x + p.width/2, floatY, p.x, floatY, p.x, floatY + p.height/2);
            ctx.bezierCurveTo(p.x, floatY + p.height*0.8, p.x + p.width/2, floatY + p.height, p.x + p.width/2, floatY + p.height);
            ctx.bezierCurveTo(p.x + p.width/2, floatY + p.height, p.x + p.width, floatY + p.height*0.8, p.x + p.width, floatY + p.height/2);
            ctx.bezierCurveTo(p.x + p.width, floatY, p.x + p.width/2, floatY, p.x + p.width/2, floatY + p.height/4);
            ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(p.x + p.width/2, floatY + p.height/2, p.width/2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '900 16px Outfit'; ctx.textAlign = 'center';
            ctx.fillText(p.type === 'shield' ? 'S' : 'D', p.x + p.width/2, floatY + p.height/2 + 6); ctx.textAlign = 'left';
        }
    });

    collectibles.forEach(c => {
        ctx.fillStyle = c.color; ctx.shadowBlur = 20; ctx.shadowColor = c.color;
        let floatY = c.y + Math.sin(c.floatOffset) * 8;
        ctx.beginPath(); ctx.moveTo(c.x + c.width/2, floatY - 5); ctx.lineTo(c.x + c.width + 5, floatY + c.height/2);
        ctx.lineTo(c.x + c.width/2, floatY + c.height + 5); ctx.lineTo(c.x - 5, floatY + c.height/2); ctx.fill();
    });

    projectiles.forEach(proj => {
        ctx.fillStyle = proj.color; ctx.shadowBlur = 30; ctx.shadowColor = proj.color;
        if (proj.vx) {
            ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.width/2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(proj.x, proj.y, proj.width/4, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
            ctx.fillStyle = '#fff'; ctx.fillRect(proj.x + 10, proj.y + 2, proj.width - 20, proj.height - 4);
        }
    });

    obstacles.forEach(o => {
        if (o.type === 'turret') {
            ctx.fillStyle = '#111'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
            ctx.shadowBlur = 20; ctx.shadowColor = '#ef4444';
            ctx.fillRect(o.x, o.y, o.width, o.height); ctx.strokeRect(o.x, o.y, o.width, o.height);
            ctx.fillStyle = o.laserFired ? '#550000' : '#ef4444'; ctx.fillRect(o.x - 5, o.y + 10, 15, 10);
        } else {
            ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rotation);
            ctx.shadowBlur = 30; ctx.shadowColor = '#ef4444';
            ctx.fillStyle = '#111'; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, o.radius - 4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ef4444';
            for(let i=0; i<8; i++) {
                ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(o.radius - 8, -5);
                ctx.lineTo(o.radius + 6, 0); ctx.lineTo(o.radius - 8, 5); ctx.fill();
            }
            ctx.restore();
        }
    });
    
    ctx.shadowBlur = 0;
    particles.forEach(p => p.draw());
    
    // Draw Lives UI (Top Left)
    if (gameState === 'PLAYING') {
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i < player.lives ? '#f43f5e' : 'rgba(255,255,255,0.2)';
            ctx.shadowBlur = i < player.lives ? 15 : 0;
            ctx.shadowColor = '#f43f5e';
            ctx.fillRect(30 + (i * 35), 30, 20, 20);
        }
        ctx.shadowBlur = 0;
    }

    ctx.restore(); 
}

function gameLoop() {
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

resetGame();
gameLoop();

function startGame() {
    resetGame();
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function gameOver() {
    gameState = 'GAME_OVER';
    playSound('death');
    screenShake = 40; 
    
    spawnParticles(player.x + player.width/2, player.y + player.height/2, `hsl(${globalHue}, 100%, 60%)`, 60);
    
    if (score > highScore) { highScore = score; localStorage.setItem('neonRunnerHighScore', highScore); }
    if (distance > ghostDistance) { ghostDistance = distance; localStorage.setItem('neonRunnerGhost', ghostDistance); }
    
    finalScore.innerText = score; highScoreEl.innerText = highScore;
    
    setTimeout(() => { gameOverScreen.classList.add('active'); }, 1000);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// --- Webcam AI Controllers ---
const webcamMode = document.getElementById('webcam-mode');
const camStatus = document.getElementById('cam-status');
const videoElement = document.getElementById('webcam-video');
const pipCanvas = document.getElementById('pip-canvas');
const pipCtx = pipCanvas.getContext('2d');
const camSensitivity = document.getElementById('cam-sensitivity');
const sensitivityContainer = document.getElementById('sensitivity-container');

let faceMesh = null;
let handsModel = null;
let holisticModel = null;
let camera = null;
let currentMode = 'off';

function drawPip(results, isHands) {
    if (!results.image) return;
    pipCanvas.width = results.image.width;
    pipCanvas.height = results.image.height;
    pipCtx.save();
    pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
    pipCtx.drawImage(results.image, 0, 0, pipCanvas.width, pipCanvas.height);
    
    // Draw Hands from Holistic (or normal Hands)
    if (results.leftHandLandmarks) {
        drawConnectors(pipCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {color: '#10b981', lineWidth: 3});
        drawLandmarks(pipCtx, results.leftHandLandmarks, {color: '#a855f7', lineWidth: 1, radius: 3});
    }
    if (results.rightHandLandmarks) {
        drawConnectors(pipCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {color: '#10b981', lineWidth: 3});
        drawLandmarks(pipCtx, results.rightHandLandmarks, {color: '#a855f7', lineWidth: 1, radius: 3});
    }
    
    // Draw Face from Holistic
    if (results.faceLandmarks) {
        drawLandmarks(pipCtx, results.faceLandmarks, {color: '#38bdf8', lineWidth: 0, radius: 1});
    }
    
    // Fallback for single face mode
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            drawLandmarks(pipCtx, landmarks, {color: '#38bdf8', lineWidth: 0, radius: 1});
        }
    }
    pipCtx.restore();
}

// Face Tracking Logic
let isBlinking = false;
let lastBlinkTime = 0;

function calculateEAR(eye) {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
}

function onFaceResults(results) {
    if (currentMode !== 'face' && currentMode !== 'full') return;
    drawPip(results, false);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const leftEye = [landmarks[33], landmarks[160], landmarks[158], landmarks[133], landmarks[153], landmarks[144]];
        const rightEye = [landmarks[362], landmarks[385], landmarks[387], landmarks[263], landmarks[373], landmarks[380]];
        const ear = (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2;
        
        const sens = parseInt(camSensitivity.value);
        const threshold = 0.15 + (sens * 0.013);
        
        if (ear < threshold) { 
            if (!isBlinking) {
                isBlinking = true;
                let now = Date.now();
                if (now - lastBlinkTime > 200) { 
                    lastBlinkTime = now;
                    if (currentMode === 'face' && gameState === 'PLAYING') handleTap(0, 0, true);
                }
            }
        } else {
            isBlinking = false;
        }
        
        checkUltimateDash();
    }
}

// Hand Tracking Logic
let leftFistClosed = false;
let rightFistClosed = false;
let lastLeftFistTime = 0;
let lastRightFistTime = 0;

function getHandOpenness(landmarks) {
    const wrist = landmarks[0];
    const middleKnuckle = landmarks[9];
    const baseDist = Math.hypot(middleKnuckle.x - wrist.x, middleKnuckle.y - wrist.y);
    if (baseDist === 0) return 1;
    
    const tips = [8, 12, 16, 20];
    let totalDist = 0;
    for (let tip of tips) {
        totalDist += Math.hypot(landmarks[tip].x - wrist.x, landmarks[tip].y - wrist.y);
    }
    return (totalDist / tips.length) / baseDist; 
}

function onHandResults(results) {
    if (currentMode !== 'hands') return;
    drawPip(results, true);
    
    let leftSeen = false;
    let rightSeen = false;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const now = Date.now();
        const sens = parseInt(camSensitivity.value);
        const fistThreshold = 1.0 + (sens * 0.08); 
        
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const wrist = landmarks[0];
            const openness = getHandOpenness(landmarks);
            const isFist = openness < fistThreshold;
            const isPhysicalLeftHand = wrist.x > 0.5;
            
            if (isPhysicalLeftHand) {
                leftSeen = true;
                if (isFist) { 
                    if (!leftFistClosed) {
                        leftFistClosed = true;
                        if (now - lastLeftFistTime > 200) { 
                            lastLeftFistTime = now;
                            if (gameState === 'PLAYING') handleTap(0, 0, true);
                        }
                    }
                } else {
                    leftFistClosed = false;
                }
            } else {
                rightSeen = true;
                if (isFist) { 
                    if (!rightFistClosed) {
                        rightFistClosed = true;
                        if (now - lastRightFistTime > 200) { 
                            lastRightFistTime = now;
                            if (gameState === 'PLAYING' && boss.active) {
                                boss.hp--;
                                try { hitSound.currentTime = 0; hitSound.play(); } catch(e){}
                                for(let p=0; p<15; p++) {
                                    particles.push(new Particle(boss.x, boss.y, boss.color));
                                }
                                if (boss.hp <= 0) {
                                    boss.active = false;
                                    score += 500;
                                    bossKillCount++;
                                    for(let p=0; p<50; p++) {
                                        particles.push(new Particle(boss.x, boss.y, boss.color));
                                    }
                                }
                            }
                        }
                    }
                } else {
                    rightFistClosed = false;
                }
            }
        }
    }
    if (!leftSeen) leftFistClosed = false;
    if (!rightSeen) rightFistClosed = false;
    
    checkUltimateDash();
}

function checkUltimateDash() {
    if (currentMode === 'hands') {
        // No blink required anymore, just both fists!
        if (leftFistClosed && rightFistClosed) {
            if (gameState === 'PLAYING' && !isDashing && dashCooldown === 0) {
                dash();
            }
        }
    }
}

async function startWebcam(mode) {
    if (camera) stopWebcam();
    currentMode = mode;
    camStatus.style.display = 'block';
    camStatus.innerText = "Downloading AI Model... (Takes a moment)";
    camStatus.style.color = "#a855f7";
    sensitivityContainer.style.display = 'flex';
    pipCanvas.style.display = 'block';
    
    try {
        if (mode === 'face' && !faceMesh) {
            faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
            faceMesh.setOptions({maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5});
            faceMesh.onResults(onFaceResults);
        }
        if (mode === 'hands' && !handsModel) {
            handsModel = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
            handsModel.setOptions({maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5});
            handsModel.onResults(onHandResults);
        }
        
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (currentMode === 'face') await faceMesh.send({image: videoElement});
                if (currentMode === 'hands') await handsModel.send({image: videoElement});
            },
            width: 320, height: 240
        });
        
        await camera.start();
        camStatus.innerText = mode === 'face' ? "Camera Active! Blink to Jump." : "Camera Active! Left = Jump, Right = Combat, Both = Dash!";
        camStatus.style.color = "#10b981";
    } catch (err) {
        camStatus.innerText = "Camera Error: " + err.message;
        camStatus.style.color = "#ef4444";
        webcamMode.value = 'off';
    }
}

function stopWebcam() {
    if (camera) { camera.stop(); camera = null; }
    currentMode = 'off';
    camStatus.style.display = 'none';
    sensitivityContainer.style.display = 'none';
    pipCanvas.style.display = 'none';
}

webcamMode.addEventListener('change', (e) => {
    if (e.target.value === 'off') {
        stopWebcam();
    } else {
        startWebcam(e.target.value);
    }
});
