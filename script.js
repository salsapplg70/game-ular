const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==========================================
// KONFIGURASI DILESTARKAN DARI PYGAME
// ==========================================
let WIDTH = 800;
let HEIGHT = 600;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 480;
const CONTROL_HEIGHT = 150;
const GRID_SIZE = 20;

// Warna Tema
const BACKGROUND = "#F8F6F0";
const GRID_COLOR = "#EBE6DE";
const TEXT_MAIN = "#414B56";
const TEXT_MUTED = "#969Btext";
const CONTROL_BG = "#EEEAE2";
const BUTTON_BG = "#FFFFFF";
const BUTTON_HOVER = "#F0EBF5";

const SNAKE_PALETTE = [
    "#FF69B4", "#FF82C3", "#FF9BD2", "#F050A0", "#FFB4DC"
];

const FOOD_COLORS = [
    "#F4ACB7", "#B1D4E0", "#FCE2AB", "#D8BFD8", "#C1E1C1"
];

let gameState = "LOADING"; // LOADING, MENU, PLAYING, PAUSED, GAMEOVER
let score = 0;
let speed = 3;
let frameCounter = 0;
let lastRenderTime = 0;

let snakeBody = [];
let direction = { x: GRID_SIZE, y: 0 };
let nextDirection = { x: GRID_SIZE, y: 0 };
let foods = [];

// ==========================================
// UTILS & CARD HELPER
// ==========================================
function getAestheticGradient(index) {
    return SNAKE_PALETTE[index % SNAKE_PALETTE.length];
}

function drawAestheticCard(x, y, w, h, bgColor, borderColor = null, radius = 22, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = bgColor;
    ctx.fill();
    if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore();
}

function drawCenteredText(text, font, color, y) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, WIDTH / 2, y);
    ctx.restore();
}

// ==========================================
// SISTEM PARTIKEL (CONFETTI)
// ==========================================
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3.0;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 3 + Math.random() * 2,
                color: color,
                life: 1.0
            });
        }
    }

    updateAndDraw() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            p.radius *= 0.94;

            if (p.life <= 0 || p.radius <= 0.5) {
                this.particles.splice(i, 1);
            } else {
                ctx.save();
                ctx.globalAlpha = p.life * 0.86;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }
}
const particleSystem = new ParticleSystem();

// ==========================================
// JOYSTICK DRAGGABLE
// ==========================================
class MovableJoystick {
    constructor(x, y, radius = 55, knobRadius = 22) {
        this.centerX = x;
        this.centerY = y;
        this.radius = radius;
        this.knobRadius = knobRadius;
        this.knobX = x;
        this.knobY = y;
        this.isDraggingKnob = false;
        this.isDraggingBase = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
    }

    draw() {
        // Base
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#E1DCD2";
        ctx.fill();
        ctx.strokeStyle = "#CDC6B9";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Knob
        ctx.beginPath();
        ctx.arc(this.knobX, this.knobY, this.knobRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#B4BEB4";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    handleStart(mx, my) {
        const dist = Math.hypot(mx - this.centerX, my - this.centerY);
        if (dist <= this.radius) {
            this.isDraggingKnob = true;
            return this._updateKnob(mx, my);
        } else if (dist <= this.radius + 20) {
            this.isDraggingBase = true;
            this.dragOffsetX = this.centerX - mx;
            this.dragOffsetY = this.centerY - my;
        }
        return null;
    }

    handleMove(mx, my) {
        if (this.isDraggingKnob) {
            return this._updateKnob(mx, my);
        } else if (this.isDraggingBase) {
            this.centerX = mx + this.dragOffsetX;
            this.centerY = my + this.dragOffsetY;
            this.knobX = this.centerX;
            this.knobY = this.centerY;
        }
        return null;
    }

    handleEnd() {
        this.isDraggingKnob = false;
        this.isDraggingBase = false;
        this.knobX = this.centerX;
        this.knobY = this.centerY;
    }

    _updateKnob(mx, my) {
        const dx = mx - this.centerX;
        const dy = my - this.centerY;
        const dist = Math.hypot(dx, dy);
        const maxDist = this.radius - this.knobRadius;

        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            this.knobX = this.centerX + Math.cos(angle) * maxDist;
            this.knobY = this.centerY + Math.sin(angle) * maxDist;
        } else {
            this.knobX = mx;
            this.knobY = my;
        }

        if (dist > 15) {
            if (Math.abs(dx) > Math.abs(dy)) {
                return dx < 0 ? { x: -GRID_SIZE, y: 0 } : { x: GRID_SIZE, y: 0 };
            } else {
                return dy < 0 ? { x: 0, y: -GRID_SIZE } : { x: 0, y: GRID_SIZE };
            }
        }
        return null;
    }
}
let joystick = new MovableJoystick(WIDTH / 2, HEIGHT - CONTROL_HEIGHT / 2);

// ==========================================
// MAKANAN & ULAIR
// ==========================================
function buatMakanan() {
    let x, y;
    while (true) {
        x = Math.floor(Math.random() * (WIDTH / GRID_SIZE)) * GRID_SIZE;
        y = Math.floor(Math.random() * ((HEIGHT - CONTROL_HEIGHT - 60) / GRID_SIZE)) * GRID_SIZE + 60;

        const inSnake = snakeBody.some(segment => segment.x === x && segment.y === y);
        const inFood = foods.some(food => food.x === x && food.y === y);

        if (!inSnake && !inFood) break;
    }

    const bentukList = ["lingkaran", "bintang", "donat", "hati", "permata"];
    return {
        x: x, y: y,
        bentuk: bentukList[Math.floor(Math.random() * bentukList.length)],
        warna: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
        pulse: Math.random() * Math.PI * 2
    };
}

function gambarMakanan(food) {
    const cx = food.x + GRID_SIZE / 2;
    const cy = food.y + GRID_SIZE / 2;

    food.pulse += 0.08;
    const pulseSize = Math.sin(food.pulse) * 1.5;

    // Glow Effect
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = food.warna + "28"; // Alpha Hex
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = food.warna;
    ctx.strokeStyle = food.warna;

    if (food.bentuk === "lingkaran") {
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5 + pulseSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (food.bentuk === "donat") {
        ctx.beginPath();
        ctx.arc(cx, cy, 7.5 + pulseSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BACKGROUND;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
    } else if (food.bentuk === "bintang") {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const sudut = -Math.PI / 2 + i * Math.PI / 5;
            const radius = (i % 2 === 0 ? 8 : 3.5) + pulseSize / 2;
            const px = cx + Math.cos(sudut) * radius;
            const py = cy + Math.sin(sudut) * radius;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    } else if (food.bentuk === "hati") {
        ctx.beginPath();
        ctx.arc(cx - 3.5, cy - 2.5, 4, 0, Math.PI * 2);
        ctx.arc(cx + 3.5, cy - 2.5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(food.x + 3, food.y + 5);
        ctx.lineTo(food.x + 17, food.y + 5);
        ctx.lineTo(cx, food.y + 16);
        ctx.closePath();
        ctx.fill();
    } else if (food.bentuk === "permata") {
        ctx.beginPath();
        ctx.moveTo(cx, food.y + 2);
        ctx.lineTo(food.x + 17, cy);
        ctx.lineTo(cx, food.y + 18);
        ctx.lineTo(food.x + 3, cy);
        ctx.closePath();
        ctx.fill();
    }
}

function gambarUlar() {
    snakeBody.forEach((seg, i) => {
        const warna = getAestheticGradient(i);
        ctx.fillStyle = warna;

        ctx.beginPath();
        ctx.roundRect(seg.x + 1, seg.y + 1, GRID_SIZE - 2, GRID_SIZE - 2, 8);
        ctx.fill();

        // Mata Kepala Ular
        if (i === 0) {
            const cx = seg.x + GRID_SIZE / 2;
            const cy = seg.y + GRID_SIZE / 2;
            const dirX = direction.x > 0 ? 1 : (direction.x < 0 ? -1 : 0);
            const dirY = direction.y > 0 ? 1 : (direction.y < 0 ? -1 : 0);

            let eye1, eye2;
            if (dirX !== 0) {
                eye1 = { x: cx + dirX * 3, y: cy - 4 };
                eye2 = { x: cx + dirX * 3, y: cy + 4 };
            } else {
                eye1 = { x: cx - 4, y: cy + dirY * 3 };
                eye2 = { x: cx + 4, y: cy + dirY * 3 };
            }

            [eye1, eye2].forEach(eye => {
                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.arc(eye.x, eye.y, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = TEXT_MAIN;
                ctx.beginPath();
                ctx.arc(eye.x + dirX, eye.y + dirY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    });
}

function gambarBackground() {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let y = 0; y < HEIGHT - CONTROL_HEIGHT; y += GRID_SIZE) {
        for (let x = 0; x < WIDTH; x += GRID_SIZE) {
            ctx.strokeRect(x, y, GRID_SIZE, GRID_SIZE);
        }
    }
}

// ==========================================
// TAMPILAN SCREEN (LOADING, MENU, GAME OVER)
// ==========================================
let loadProgress = 0;
function renderLoadingScreen() {
    gambarBackground();
    const judulY = HEIGHT / 3;

    drawCenteredText("SNAKE GAME", "bold 70px sans-serif", "#B2CEBA", judulY);
    drawCenteredText("S N A K E   G A M E", "28px sans-serif", "#969BA5", judulY + 50);

    const barW = Math.min(360, WIDTH - 100);
    const barH = 18;
    const barX = WIDTH / 2 - barW / 2;
    const barY = HEIGHT / 2 + 80;

    drawAestheticCard(barX, barY, barW, barH, CONTROL_BG, "#D7D2C8", 10);

    const fillW = Math.floor((loadProgress / 100) * (barW - 6));
    if (fillW > 0) {
        drawAestheticCard(barX + 3, barY + 3, fillW, barH - 6, "#B2CEBA", null, 8);
    }

    drawCenteredText(`Memuat keindahan... ${Math.floor(loadProgress)}%`, "16px sans-serif", "#969BA5", barY + 40);

    loadProgress += 1.5;
    if (loadProgress >= 100) {
        gameState = "MENU";
    }
}

let startBtnRect = { x: 0, y: 0, w: 0, h: 0 };
let mousePos = { x: 0, y: 0 };

function renderMenu() {
    gambarBackground();

    const bannerW = Math.min(480, WIDTH - 40);
    const bannerH = 160;
    const bannerX = WIDTH / 2 - bannerW / 2;
    const bannerY = 75;

    drawAestheticCard(bannerX, bannerY, bannerW, bannerH, BUTTON_BG, "#E1DCD2", 25);
    drawCenteredText("SNAKE GAME", "bold 70px sans-serif", "#B2CEBA", bannerY + 60);
    drawCenteredText("S N A K E   G A M E", "28px sans-serif", "#969BA5", bannerY + 115);

    const btnW = Math.min(280, WIDTH - 60);
    const btnH = 60;
    startBtnRect = { x: WIDTH / 2 - btnW / 2, y: bannerY + bannerH + 55, w: btnW, h: btnH };

    const isHover = mousePos.x >= startBtnRect.x && mousePos.x <= startBtnRect.x + startBtnRect.w &&
                    mousePos.y >= startBtnRect.y && mousePos.y <= startBtnRect.y + startBtnRect.h;

    drawAestheticCard(
        startBtnRect.x, startBtnRect.y, startBtnRect.w, startBtnRect.h,
        isHover ? BUTTON_HOVER : BUTTON_BG,
        isHover ? "#B2CEBA" : "#DC8CCD",
        18
    );

    drawCenteredText("MULAI MAIN", "24px sans-serif", TEXT_MAIN, startBtnRect.y + startBtnRect.h / 2);

    const infoX = WIDTH / 2 - 170;
    const infoY = startBtnRect.y + startBtnRect.h + 45;
    drawAestheticCard(infoX, infoY, 340, 36, CONTROL_BG, null, 12);
    drawCenteredText("Gunakan Layar Sentuh / Joystick / Keyboard", "14px sans-serif", "#969BA5", infoY + 18);
}

let btnRestartRect = { x: 0, y: 0, w: 0, h: 0 };
let btnMenuRect = { x: 0, y: 0, w: 0, h: 0 };

function renderGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(248, 246, 240, 0.85)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();

    const modalW = Math.min(420, WIDTH - 40);
    const modalH = 340;
    const modalX = WIDTH / 2 - modalW / 2;
    const modalY = HEIGHT / 2 - modalH / 2 - 10;

    drawAestheticCard(modalX, modalY, modalW, modalH, BUTTON_BG, "#E1DCD2", 25);
    drawCenteredText("GAME OVER", "bold 42px sans-serif", "#F4ACB7", modalY + 45);

    const scoreBoxX = WIDTH / 2 - 120;
    const scoreBoxY = modalY + 95;
    drawAestheticCard(scoreBoxX, scoreBoxY, 240, 60, CONTROL_BG, null, 15);

    drawCenteredText("SKOR KAMU", "14px sans-serif", "#969BA5", scoreBoxY + 18);
    drawCenteredText(score.toString(), "bold 32px sans-serif", TEXT_MAIN, scoreBoxY + 42);

    const btnW = 160;
    const btnH = 48;
    const yBtn = modalY + modalH - 75;

    btnRestartRect = { x: WIDTH / 2 - btnW - 10, y: yBtn, w: btnW, h: btnH };
    btnMenuRect = { x: WIDTH / 2 + 10, y: yBtn, w: btnW, h: btnH };

    const hoverR = mousePos.x >= btnRestartRect.x && mousePos.x <= btnRestartRect.x + btnRestartRect.w &&
                   mousePos.y >= btnRestartRect.y && mousePos.y <= btnRestartRect.y + btnRestartRect.h;
    const hoverM = mousePos.x >= btnMenuRect.x && mousePos.x <= btnMenuRect.x + btnMenuRect.w &&
                   mousePos.y >= btnMenuRect.y && mousePos.y <= btnMenuRect.y + btnMenuRect.h;

    drawAestheticCard(btnRestartRect.x, btnRestartRect.y, btnW, btnH, hoverR ? BUTTON_HOVER : CONTROL_BG, hoverR ? "#B2CEBA" : null, 12);
    drawAestheticCard(btnMenuRect.x, btnMenuRect.y, btnW, btnH, hoverM ? BUTTON_HOVER : CONTROL_BG, hoverM ? "#F4ACB7" : null, 12);

    drawCenteredText("MAIN LAGI", "20px sans-serif", TEXT_MAIN, btnRestartRect.y + btnH / 2);
    drawCenteredText("MENU", "20px sans-serif", TEXT_MAIN, btnMenuRect.y + btnH / 2);
}

function renderPause() {
    ctx.save();
    ctx.fillStyle = "rgba(248, 246, 240, 0.82)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();

    drawCenteredText("PAUSED", "bold 50px sans-serif", "#B2CEBA", HEIGHT / 2 - 20);
    drawCenteredText("Tekan P untuk melanjutkan", "22px sans-serif", TEXT_MAIN, HEIGHT / 2 + 40);
}

// ==========================================
// RESET & LOGIKA UTAMA
// ==========================================
function initGame() {
    const startX = Math.floor(WIDTH / 2 / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(HEIGHT / 2 / GRID_SIZE) * GRID_SIZE;

    snakeBody = [
        { x: startX, y: startY },
        { x: startX - GRID_SIZE, y: startY },
        { x: startX - GRID_SIZE * 2, y: startY }
    ];

    direction = { x: GRID_SIZE, y: 0 };
    nextDirection = { x: GRID_SIZE, y: 0 };
    score = 0;
    speed = 3;
    foods = [];
    for (let i = 0; i < 5; i++) {
        foods.push(buatMakanan());
    }
}

function updateGame() {
    direction = { ...nextDirection };
    const headX = snakeBody[0].x + direction.x;
    const headY = snakeBody[0].y + direction.y;
    const newHead = { x: headX, y: headY };

    snakeBody.unshift(newHead);

    let makan = false;
    for (let i = foods.length - 1; i >= 0; i--) {
        let food = foods[i];
        if (headX === food.x && headY === food.y) {
            makan = true;
            score += 1;
            particleSystem.emit(food.x + GRID_SIZE / 2, food.y + GRID_SIZE / 2, food.warna);
            foods.splice(i, 1);
            foods.push(buatMakanan());
            if (score % 8 === 0) speed += 0.5;
            break;
        }
    }

    if (!makan) {
        snakeBody.pop();
    }

    // Cek Tabrakan Dinding & Badan
    if (
        headX < 0 || headX >= WIDTH ||
        headY < 0 || headY >= HEIGHT - CONTROL_HEIGHT ||
        snakeBody.slice(1).some(seg => seg.x === headX && seg.y === headY)
    ) {
        gameState = "GAMEOVER";
    }
}

// ==========================================
// GAME LOOP
// ==========================================
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    const secondsPassed = (currentTime - lastRenderTime) / 1000;

    if (gameState === "LOADING") {
        renderLoadingScreen();
        return;
    }

    if (gameState === "MENU") {
        renderMenu();
        return;
    }

    // Render Play State / HUD / Joystick
    if (gameState === "PLAYING" || gameState === "PAUSED" || gameState === "GAMEOVER") {
        if (gameState === "PLAYING" && secondsPassed >= 1 / speed) {
            updateGame();
            lastRenderTime = currentTime;
        }

        frameCounter++;
        gambarBackground();

        foods.forEach(food => gambarMakanan(food));
        gambarUlar();
        particleSystem.updateAndDraw();

        // Control Panel HUD
        ctx.fillStyle = CONTROL_BG;
        ctx.fillRect(0, HEIGHT - CONTROL_HEIGHT, WIDTH, CONTROL_HEIGHT);

        ctx.strokeStyle = "#E1DCD2";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, HEIGHT - CONTROL_HEIGHT);
        ctx.lineTo(WIDTH, HEIGHT - CONTROL_HEIGHT);
        ctx.stroke();

        joystick.draw();

        // Score Box
        drawAestheticCard(15, 15, 150, 42, BUTTON_BG, "#E1DCD2", 12);
        ctx.font = "20px sans-serif";
        ctx.fillStyle = TEXT_MAIN;
        ctx.textAlign = "left";
        ctx.fillText(`SKOR: ${score}`, 26, 42);

        // Speed Box
        drawAestheticCard(WIDTH - 155, 15, 140, 42, BUTTON_BG, "#E1DCD2", 12);
        ctx.font = "16px sans-serif";
        ctx.fillStyle = TEXT_MAIN;
        ctx.fillText(`SPEED: ${speed.toFixed(1)}`, WIDTH - 138, 41);

        if (gameState === "PAUSED") renderPause();
        if (gameState === "GAMEOVER") renderGameOver();
    }
}

// ==========================================
// RESIZE & EVENT HANDLERS
// ==========================================
function handleResize() {
    WIDTH = Math.max(MIN_WIDTH, window.innerWidth);
    HEIGHT = Math.max(MIN_HEIGHT, window.innerHeight);

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    joystick.centerX = WIDTH / 2;
    joystick.centerY = HEIGHT - CONTROL_HEIGHT / 2;
    joystick.knobX = joystick.centerX;
    joystick.knobY = joystick.centerY;
}

window.addEventListener("resize", handleResize);

function processInput(x, y) {
    if (gameState === "MENU") {
        if (x >= startBtnRect.x && x <= startBtnRect.x + startBtnRect.w &&
            y >= startBtnRect.y && y <= startBtnRect.y + startBtnRect.h) {
            initGame();
            gameState = "PLAYING";
        }
    } else if (gameState === "GAMEOVER") {
        if (x >= btnRestartRect.x && x <= btnRestartRect.x + btnRestartRect.w &&
            y >= btnRestartRect.y && y <= btnRestartRect.y + btnRestartRect.h) {
            initGame();
            gameState = "PLAYING";
        } else if (x >= btnMenuRect.x && x <= btnMenuRect.x + btnMenuRect.w &&
                   y >= btnMenuRect.y && y <= btnMenuRect.y + btnMenuRect.h) {
            gameState = "MENU";
        }
    }
}

// Mouse Events
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;

    if (gameState === "PLAYING") {
        const dir = joystick.handleMove(mousePos.x, mousePos.y);
        if (dir && (dir.x !== -direction.x || dir.y !== -direction.y)) {
            nextDirection = dir;
        }
    }
});

window.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    processInput(x, y);

    if (gameState === "PLAYING") {
        const dir = joystick.handleStart(x, y);
        if (dir && (dir.x !== -direction.x || dir.y !== -direction.y)) {
            nextDirection = dir;
        }
    }
});

window.addEventListener("mouseup", () => joystick.handleEnd());

// Touch Events
window.addEventListener("touchstart", (e) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    processInput(x, y);

    if (gameState === "PLAYING") {
        const dir = joystick.handleStart(x, y);
        if (dir && (dir.x !== -direction.x || dir.y !== -direction.y)) {
            nextDirection = dir;
        }
    }
});

window.addEventListener("touchmove", (e) => {
    if (gameState === "PLAYING") {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const dir = joystick.handleMove(touch.clientX - rect.left, touch.clientY - rect.top);
        if (dir && (dir.x !== -direction.x || dir.y !== -direction.y)) {
            nextDirection = dir;
        }
    }
});

window.addEventListener("touchend", () => joystick.handleEnd());

// Keyboard Input
window.addEventListener("keydown", (e) => {
    if (gameState === "MENU" && (e.key === "Enter" || e.key === " ")) {
        initGame();
        gameState = "PLAYING";
    } else if (gameState === "GAMEOVER") {
        if (e.key.toLowerCase() === "r") {
            initGame();
            gameState = "PLAYING";
        } else if (e.key === "Escape") {
            gameState = "MENU";
        }
    } else if (gameState === "PLAYING" || gameState === "PAUSED") {
        if (e.key.toLowerCase() === "p") {
            gameState = gameState === "PLAYING" ? "PAUSED" : "PLAYING";
        } else if (e.key === "Escape") {
            gameState = "MENU";
        }

        if (gameState === "PLAYING") {
            let dir = null;
            if (["ArrowUp", "w", "W"].includes(e.key)) dir = { x: 0, y: -GRID_SIZE };
            else if (["ArrowDown", "s", "S"].includes(e.key)) dir = { x: 0, y: GRID_SIZE };
            else if (["ArrowLeft", "a", "A"].includes(e.key)) dir = { x: -GRID_SIZE, y: 0 };
            else if (["ArrowRight", "d", "D"].includes(e.key)) dir = { x: GRID_SIZE, y: 0 };

            if (dir && (dir.x !== -direction.x || dir.y !== -direction.y)) {
                nextDirection = dir;
            }
        }
    }
});

// START GAME
handleResize();
requestAnimationFrame(gameLoop);