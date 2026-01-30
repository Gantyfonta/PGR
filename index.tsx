
// --- Game Constants ---
const GRAVITY = 0.65;
const JUMP_FORCE = -12.5;
const BASE_ROTATION_SPEED = 2.2;
const MIN_RANDOM_SPEED = 2.2;
const MAX_SPEED_CAP = 9.0;
const COLLISION_ANGLE_CENTER = 180;
const COLLISION_ANGLE_WINDOW = 16; 
const MIN_JUMP_HEIGHT = 48;

// --- State Management ---
let gameState = 'START'; 
let score = 0;
let highScore = parseInt(localStorage.getItem('pig-rhythm-highscore') || '0');
let handAngle = 0;
let pigY = 0;
let pigVel = 0;
let currentSpeed = BASE_ROTATION_SPEED;
let animationId: number | null = null;
let el: any = {}; // Late-initialized DOM elements

// --- Audio Service ---
class AudioService {
    private ctx: AudioContext | null = null;
    
    private getCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    playJump() {
        try {
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
    }

    playScore() {
        try {
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
    }

    playGameOver() {
        try {
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.5);
        } catch (e) {}
    }
}
const audio = new AudioService();

// --- Commentary Logic ---
const QUOTES_LOW = ["Ouch! Watch the clock!", "Rhythm is hard!", "Bacon time?", "Wake up, piggy!", "A bit late!"];
const QUOTES_MID = ["Nice hops!", "Piggy's got moves!", "Steady rhythm!", "Feeling the beat!", "Great timing!"];
const QUOTES_HIGH = ["LEGENDARY PIG!", "Rhythm Master!", "Unstoppable!", "DJ Piggy in the house!", "Master of Time!"];

function getCommentary(s: number) {
    if (s === 0) return "Jump over the hand to start!";
    if (s < 5) return QUOTES_LOW[Math.floor(Math.random() * QUOTES_LOW.length)];
    if (s < 15) return QUOTES_MID[Math.floor(Math.random() * QUOTES_MID.length)];
    return QUOTES_HIGH[Math.floor(Math.random() * QUOTES_HIGH.length)];
}

// --- Game Functions ---
function update() {
    if (gameState !== 'PLAYING') return;

    // 1. Clock Physics
    const prevAngle = handAngle;
    handAngle = (handAngle + currentSpeed) % 360;
    el.hand.style.transform = `rotate(${handAngle}deg)`;

    // Visual Beat Feedback
    if (handAngle < 15 || handAngle > 345) el.beatGlow.style.opacity = '0.3';
    else el.beatGlow.style.opacity = '0';

    // 2. Pig Physics
    pigY += pigVel;
    pigVel += GRAVITY;
    if (pigY > 0) {
        pigY = 0;
        pigVel = 0;
    }

    // 3. Render Pig & Shadow
    const renderY = -pigY;
    el.pigWrapper.style.transform = `translateX(-50%) translateY(${pigY}px)`;
    
    const stretch = renderY > 0 ? 1.15 : 1.0;
    const squash = renderY === 0 ? 0.9 : 1.0;
    el.pigBody.style.transform = `scaleX(${1 / stretch * squash}) scaleY(${stretch})`;
    
    const shadowScale = Math.max(0.4, 1 - (renderY / 180));
    const shadowOpacity = Math.max(0.1, 0.3 - (renderY / 200));
    el.pigShadow.style.transform = `scale(${shadowScale})`;
    el.pigShadow.style.opacity = shadowOpacity.toString();

    // 4. Hitbox Collision
    const dangerZoneStart = COLLISION_ANGLE_CENTER - COLLISION_ANGLE_WINDOW;
    const dangerZoneEnd = COLLISION_ANGLE_CENTER + COLLISION_ANGLE_WINDOW;
    
    const isCurrentlyInDanger = handAngle >= dangerZoneStart && handAngle <= dangerZoneEnd;
    const crossedDanger = prevAngle < dangerZoneStart && handAngle > dangerZoneStart;

    if ((isCurrentlyInDanger || crossedDanger) && (renderY < MIN_JUMP_HEIGHT)) {
        endGame();
        return;
    }

    // 5. Scoring
    if (prevAngle < 180 && handAngle >= 180) {
        audio.playScore();
        score++;
        el.currentScore.innerText = score.toString();
        
        // Popup FX
        const pop = document.createElement('div');
        pop.className = 'absolute text-5xl font-game text-pink-500 score-pop';
        pop.innerText = '+1';
        el.popupLayer.appendChild(pop);
        setTimeout(() => pop.remove(), 600);

        // Speed Progression
        const diff = Math.min(MAX_SPEED_CAP, BASE_ROTATION_SPEED + (score * 0.38));
        currentSpeed = MIN_RANDOM_SPEED + Math.random() * (diff - MIN_RANDOM_SPEED);
        
        el.speedLabel.classList.remove('hidden');
        if (currentSpeed > 7.5) el.speedLabel.innerText = 'TURBO!';
        else if (currentSpeed > 5.5) el.speedLabel.innerText = 'FAST';
        else if (currentSpeed < 3) el.speedLabel.innerText = 'CHILL';
        else el.speedLabel.innerText = 'STEADY';
    }

    animationId = requestAnimationFrame(update);
}

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    handAngle = 0;
    pigY = 0;
    pigVel = 0;
    currentSpeed = BASE_ROTATION_SPEED;
    
    el.currentScore.innerText = '0';
    el.menuOverlay.classList.add('hidden');
    el.hud.classList.remove('opacity-0', 'scale-50');
    el.hud.classList.add('opacity-100', 'scale-100');
    el.container.classList.replace('bg-menu', 'bg-playing');
    el.footerHint.innerText = 'Tap or Space to Jump';
    el.speedLabel.classList.add('hidden');
    el.pigBody.classList.remove('rotate-90', 'grayscale', 'opacity-50');
    
    if (animationId) cancelAnimationFrame(animationId);
    update();
}

function endGame() {
    gameState = 'GAME_OVER';
    audio.playGameOver();
    if (animationId) cancelAnimationFrame(animationId);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('pig-rhythm-highscore', highScore.toString());
        el.highScore.innerText = highScore.toString();
    }

    el.lastScore.innerText = score.toString();
    el.pigBody.classList.add('rotate-90', 'grayscale', 'opacity-50');
    el.menuOverlay.classList.remove('hidden');
    el.startContent.classList.add('hidden');
    el.gameoverContent.classList.remove('hidden');
    el.startButton.innerText = 'TRY AGAIN';
    el.footerHint.innerText = 'Jump to Restart';
    
    el.commentaryText.innerText = `"${getCommentary(score)}"`;
}

function handleJump() {
    if (gameState === 'PLAYING') {
        if (pigY >= -10) { 
            audio.playJump();
            pigVel = JUMP_FORCE;
        }
    } else {
        startGame();
    }
}

// --- Initialization Logic ---
function init() {
    // Map DOM elements after they exist
    el = {
        container: document.getElementById('game-container'),
        highScore: document.getElementById('high-score'),
        currentScore: document.getElementById('current-score'),
        lastScore: document.getElementById('last-score'),
        hand: document.getElementById('clock-hand'),
        pigWrapper: document.getElementById('pig-wrapper'),
        pigBody: document.getElementById('pig-body'),
        pigShadow: document.getElementById('pig-shadow'),
        menuOverlay: document.getElementById('menu-overlay'),
        startContent: document.getElementById('start-content'),
        gameoverContent: document.getElementById('gameover-content'),
        commentaryText: document.getElementById('commentary-text'),
        startButton: document.getElementById('start-button'),
        speedLabel: document.getElementById('speed-label'),
        hud: document.getElementById('hud'),
        footerHint: document.getElementById('footer-hint'),
        beatGlow: document.getElementById('beat-glow'),
        clockFace: document.getElementById('clock-face'),
        popupLayer: document.getElementById('score-popup-layer')
    };

    // Verify all elements found
    for (let key in el) {
        if (!el[key]) console.warn(`Element missing: ${key}`);
    }

    // Initialize Clock Markers
    for (let i = 0; i < 12; i++) {
        const marker = document.createElement('div');
        marker.className = 'absolute w-2 h-6 bg-slate-200 rounded-full';
        marker.style.transform = `rotate(${i * 30}deg) translateY(-150px)`;
        marker.style.transformOrigin = 'center center';
        el.clockFace.appendChild(marker);
    }
    el.highScore.innerText = highScore.toString();

    // Setup Global Listeners
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            handleJump();
        }
    });

    el.container.addEventListener('pointerdown', (e) => {
        if (e.target instanceof HTMLButtonElement) return;
        handleJump();
    });

    el.startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
    });
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
