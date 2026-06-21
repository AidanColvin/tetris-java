"use strict";

// ============================================================================
// Client-side Tetris engine — a faithful JavaScript port of the Java engine in
// src/main/java/com/tetris/game/. Same SRS rotation + wall kicks, 7-bag,
// guideline scoring, gravity curve, hold and hard drop.
// ============================================================================

const WIDTH = 10;
const HEIGHT = 20;
const CELL = 30; // logical board cell size (board is 300x600 logical)

// Muted, matte palette for the seven tetrominoes — desaturated and flat
// (no gloss) for a calm, refined look rather than a glossy "candy" one.
const COLORS = {
    1: "#6c9bab", // I - dusty teal
    2: "#c9a96a", // O - sand
    3: "#9685b3", // T - muted purple
    4: "#7fa37a", // S - sage
    5: "#bd7a6e", // Z - clay
    6: "#6f88ad", // J - slate blue
    7: "#c08f63"  // L - caramel
};

const SHAPES = {
    1: [[[1,0],[1,1],[1,2],[1,3]], [[0,2],[1,2],[2,2],[3,2]], [[2,0],[2,1],[2,2],[2,3]], [[0,1],[1,1],[2,1],[3,1]]],
    2: [[[0,0],[0,1],[1,0],[1,1]]],
    3: [[[0,1],[1,0],[1,1],[1,2]], [[0,1],[1,1],[1,2],[2,1]], [[1,0],[1,1],[1,2],[2,1]], [[0,1],[1,0],[1,1],[2,1]]],
    4: [[[0,1],[0,2],[1,0],[1,1]], [[0,1],[1,1],[1,2],[2,2]], [[1,1],[1,2],[2,0],[2,1]], [[0,0],[1,0],[1,1],[2,1]]],
    5: [[[0,0],[0,1],[1,1],[1,2]], [[0,2],[1,1],[1,2],[2,1]], [[1,0],[1,1],[2,1],[2,2]], [[0,1],[1,0],[1,1],[2,0]]],
    6: [[[0,0],[1,0],[1,1],[1,2]], [[0,1],[0,2],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,0],[2,1]]],
    7: [[[0,2],[1,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[1,2],[2,0]], [[0,0],[0,1],[1,1],[2,1]]]
};

const JLSTZ_KICKS = {
    1:  [[0,0],[0,-1],[-1,-1],[2,0],[2,-1]], 4:  [[0,0],[0,1],[1,1],[-2,0],[-2,1]],
    6:  [[0,0],[0,1],[1,1],[-2,0],[-2,1]],   9:  [[0,0],[0,-1],[-1,-1],[2,0],[2,-1]],
    11: [[0,0],[0,1],[-1,1],[2,0],[2,1]],    14: [[0,0],[0,-1],[1,-1],[-2,0],[-2,-1]],
    12: [[0,0],[0,-1],[1,-1],[-2,0],[-2,-1]],3:  [[0,0],[0,1],[-1,1],[2,0],[2,1]]
};
const I_KICKS = {
    1:  [[0,0],[0,-2],[0,1],[1,-2],[-2,1]],  4:  [[0,0],[0,2],[0,-1],[-1,2],[2,-1]],
    6:  [[0,0],[0,-1],[0,2],[-2,-1],[1,2]],  9:  [[0,0],[0,1],[0,-2],[2,1],[-1,-2]],
    11: [[0,0],[0,2],[0,-1],[-1,2],[2,-1]],  14: [[0,0],[0,-2],[0,1],[1,-2],[-2,1]],
    12: [[0,0],[0,1],[0,-2],[2,1],[-1,-2]],  3:  [[0,0],[0,-1],[0,2],[-2,-1],[1,2]]
};

class TetrisGame {
    constructor() { this.reset(); }

    reset() {
        this.grid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(0));
        this.bag = [];
        this.queue = [];
        this.hold = 0;
        this.holdUsed = false;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.running = false;
        this.gameOver = false;
        this.dropAccMs = 0;
        this.current = 0;
        this.rot = 0;
        this.row = 0;
        this.col = 0;
        this.fillQueue();
    }

    start() { this.reset(); this.running = true; this.spawn(); }
    isRunning() { return this.running && !this.gameOver; }

    fillQueue() {
        while (this.queue.length < 5) {
            if (this.bag.length === 0) {
                this.bag = [1, 2, 3, 4, 5, 6, 7];
                for (let i = this.bag.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
                }
            }
            this.queue.push(this.bag.shift());
        }
    }

    spawn() {
        this.fillQueue();
        this.current = this.queue.shift();
        this.fillQueue();
        this.rot = 0;
        this.col = this.current === 2 ? 4 : 3;
        this.row = 0;
        this.holdUsed = false;
        this.dropAccMs = 0;
        if (this.collides(this.current, this.rot, this.row, this.col)) {
            this.gameOver = true;
            this.running = false;
        }
    }

    cells(type, rotation) {
        const states = SHAPES[type];
        return states[((rotation % states.length) + states.length) % states.length];
    }

    collides(type, rotation, r, c) {
        for (const [br, bc] of this.cells(type, rotation)) {
            const x = c + bc, y = r + br;
            if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return true;
            if (this.grid[y][x] !== 0) return true;
        }
        return false;
    }

    canAct() { return this.running && !this.gameOver && this.current !== 0; }

    moveLeft() { if (this.canAct() && !this.collides(this.current, this.rot, this.row, this.col - 1)) this.col--; }
    moveRight() { if (this.canAct() && !this.collides(this.current, this.rot, this.row, this.col + 1)) this.col++; }

    softDrop() {
        if (!this.canAct()) return;
        if (!this.collides(this.current, this.rot, this.row + 1, this.col)) {
            this.row++; this.score += 1; this.dropAccMs = 0;
        } else { this.lockPiece(); }
    }

    hardDrop() {
        if (!this.canAct()) return;
        let dropped = 0;
        while (!this.collides(this.current, this.rot, this.row + 1, this.col)) { this.row++; dropped++; }
        this.score += dropped * 2;
        this.lockPiece();
    }

    rotate(clockwise) {
        if (!this.canAct() || this.current === 2) return;
        const from = this.rot;
        const to = (this.rot + (clockwise ? 1 : 3)) % 4;
        const table = this.current === 1 ? I_KICKS : JLSTZ_KICKS;
        const kicks = table[from * 4 + to] || [[0, 0]];
        for (const [dRow, dCol] of kicks) {
            const nr = this.row + dRow, nc = this.col + dCol;
            if (!this.collides(this.current, to, nr, nc)) { this.rot = to; this.row = nr; this.col = nc; return; }
        }
    }

    holdPiece() {
        if (!this.canAct() || this.holdUsed) return;
        const swap = this.hold;
        this.hold = this.current;
        if (swap === 0) { this.spawn(); }
        else {
            this.current = swap; this.rot = 0; this.col = this.current === 2 ? 4 : 3; this.row = 0;
            if (this.collides(this.current, this.rot, this.row, this.col)) { this.gameOver = true; this.running = false; }
        }
        this.holdUsed = true;
    }

    tick(elapsedMs) {
        if (!this.isRunning()) return;
        this.dropAccMs += elapsedMs;
        const interval = this.gravityIntervalMs();
        while (this.dropAccMs >= interval && this.isRunning()) {
            this.dropAccMs -= interval;
            if (!this.collides(this.current, this.rot, this.row + 1, this.col)) this.row++;
            else this.lockPiece();
        }
    }

    gravityIntervalMs() {
        const seconds = Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1);
        return Math.max(20, seconds * 1000);
    }

    lockPiece() {
        for (const [br, bc] of this.cells(this.current, this.rot)) {
            const y = this.row + br, x = this.col + bc;
            if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) this.grid[y][x] = this.current;
        }
        this.applyScore(this.clearLines());
        this.spawn();
    }

    clearLines() {
        let cleared = 0;
        for (let r = HEIGHT - 1; r >= 0; r--) {
            if (this.grid[r].every(v => v !== 0)) {
                cleared++;
                for (let rr = r; rr > 0; rr--) this.grid[rr] = this.grid[rr - 1].slice();
                this.grid[0] = new Array(WIDTH).fill(0);
                r++;
            }
        }
        return cleared;
    }

    applyScore(cleared) {
        const points = { 1: 100, 2: 300, 3: 500, 4: 800 }[cleared] || 0;
        this.score += points * this.level;
        if (cleared > 0) { this.lines += cleared; this.level = Math.floor(this.lines / 10) + 1; }
    }

    ghostCells() {
        if (!this.canAct()) return [];
        let gr = this.row;
        while (!this.collides(this.current, this.rot, gr + 1, this.col)) gr++;
        return this.cells(this.current, this.rot).map(([br, bc]) => [gr + br, this.col + bc]);
    }

    activeCells() {
        if (this.current === 0) return [];
        return this.cells(this.current, this.rot).map(([br, bc]) => [this.row + br, this.col + bc]);
    }

    snapshot() {
        return {
            grid: this.grid, active: this.activeCells(), activeColor: this.current,
            ghost: this.ghostCells(), next: this.queue.slice(0, 3), hold: this.hold,
            score: this.score, lines: this.lines, level: this.level,
            running: this.running, gameOver: this.gameOver
        };
    }
}

// ============================================================================
// Rendering (HiDPI, gem-style cells)
// ============================================================================

const boardCanvas = document.getElementById("board");
const holdCanvas = document.getElementById("hold");
const nextCanvas = document.getElementById("next");

const BOARD_W = WIDTH * CELL, BOARD_H = HEIGHT * CELL;
const HOLD_W = 64, HOLD_H = 52;
const NEXT_W = 168, NEXT_H = 52;

function setupCanvas(canvas, logicalW, logicalH) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

let bctx = setupCanvas(boardCanvas, BOARD_W, BOARD_H);
let hctx = setupCanvas(holdCanvas, HOLD_W, HOLD_H);
let nctx = setupCanvas(nextCanvas, NEXT_W, NEXT_H);

function readVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
let GRID_COLOR = readVar("--grid") || "rgba(0,0,0,0.05)";
const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
darkMq.addEventListener("change", () => { GRID_COLOR = readVar("--grid"); });

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const leaderboardEl = document.getElementById("leaderboard");

const MINI_SHAPES = {
    1: [[0,0],[0,1],[0,2],[0,3]], 2: [[0,0],[0,1],[1,0],[1,1]],
    3: [[0,1],[1,0],[1,1],[1,2]], 4: [[0,1],[0,2],[1,0],[1,1]],
    5: [[0,0],[0,1],[1,1],[1,2]], 6: [[0,0],[1,0],[1,1],[1,2]],
    7: [[0,2],[1,0],[1,1],[1,2]]
};

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCell(ctx, x, y, size, colorIndex, ghost) {
    const base = COLORS[colorIndex] || "#8e8e93";
    const pad = Math.max(1, size * 0.07);
    const x0 = x + pad, y0 = y + pad, s = size - 2 * pad;
    const r = Math.max(2, s * 0.18);
    if (ghost) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = base;
        roundRect(ctx, x0, y0, s, s, r); ctx.fill();
        ctx.restore();
        return;
    }
    ctx.fillStyle = base; // flat, matte fill — no gloss or gradient
    roundRect(ctx, x0, y0, s, s, r); ctx.fill();
}

function drawPieceCentered(ctx, colorIndex, sx, sy, sw, sh, cell) {
    if (!colorIndex) return;
    const cells = MINI_SHAPES[colorIndex];
    const cols = cells.map(c => c[1]), rows = cells.map(c => c[0]);
    const minC = Math.min(...cols), minR = Math.min(...rows);
    const w = (Math.max(...cols) - minC + 1) * cell;
    const h = (Math.max(...rows) - minR + 1) * cell;
    const ox = sx + (sw - w) / 2 - minC * cell;
    const oy = sy + (sh - h) / 2 - minR * cell;
    cells.forEach(([r, c]) => drawCell(ctx, ox + c * cell, oy + r * cell, cell, colorIndex, false));
}

function render(state) {
    bctx.clearRect(0, 0, BOARD_W, BOARD_H);
    bctx.strokeStyle = GRID_COLOR;
    bctx.lineWidth = 1;
    for (let c = 1; c < WIDTH; c++) { bctx.beginPath(); bctx.moveTo(c * CELL + 0.5, 0); bctx.lineTo(c * CELL + 0.5, BOARD_H); bctx.stroke(); }
    for (let r = 1; r < HEIGHT; r++) { bctx.beginPath(); bctx.moveTo(0, r * CELL + 0.5); bctx.lineTo(BOARD_W, r * CELL + 0.5); bctx.stroke(); }

    for (let r = 0; r < state.grid.length; r++)
        for (let c = 0; c < state.grid[r].length; c++)
            if (state.grid[r][c] !== 0) drawCell(bctx, c * CELL, r * CELL, CELL, state.grid[r][c], false);

    state.ghost.forEach(([r, c]) => drawCell(bctx, c * CELL, r * CELL, CELL, state.activeColor, true));
    state.active.forEach(([r, c]) => { if (r >= 0) drawCell(bctx, c * CELL, r * CELL, CELL, state.activeColor, false); });

    hctx.clearRect(0, 0, HOLD_W, HOLD_H);
    drawPieceCentered(hctx, state.hold || 0, 0, 0, HOLD_W, HOLD_H, 11);

    nctx.clearRect(0, 0, NEXT_W, NEXT_H);
    const slot = NEXT_W / 3;
    (state.next || []).slice(0, 3).forEach((color, i) => drawPieceCentered(nctx, color, i * slot, 0, slot, NEXT_H, 10));

    scoreEl.textContent = state.score;
    linesEl.textContent = state.lines;
    levelEl.textContent = state.level;
}

// ============================================================================
// Game loop
// ============================================================================

const game = new TetrisGame();
const playfield = document.querySelector(".playfield");
let lastTime = 0;
let wasRunning = false;
let prevLines = 0;
let submitting = false;

function loop(now) {
    if (!lastTime) lastTime = now;
    const dt = now - lastTime;
    lastTime = now;
    game.tick(dt);
    const state = game.snapshot();
    render(state);

    if (state.lines > prevLines) {
        playfield.classList.remove("flash");
        void playfield.offsetWidth; // restart animation
        playfield.classList.add("flash");
    }
    prevLines = state.lines;

    if (state.running && !state.gameOver) { overlay.classList.add("hidden"); wasRunning = true; }
    else if (state.gameOver && wasRunning) { wasRunning = false; showGameOver(state); }

    requestAnimationFrame(loop);
}

function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.text) node.textContent = opts.text;
    if (opts.class) node.className = opts.class;
    return node;
}

function startNew() {
    game.start();
    prevLines = 0;
    overlay.classList.add("hidden");
    wasRunning = true;
}

function showGameOver(state) {
    overlay.classList.remove("hidden");
    const card = overlay.querySelector(".overlay-card");
    card.innerHTML = "";

    const input = el("input", { class: "name-input" });
    input.type = "text";
    input.maxLength = 16;
    input.placeholder = "Your name";
    input.value = localStorage.getItem("tetris-name") || "";

    const submit = el("button", { class: "btn-primary", text: "Submit Score" });
    submit.addEventListener("click", () => {
        if (submitting) return;
        submitting = true;
        submit.disabled = true;
        const name = (input.value || "Anonymous").trim();
        localStorage.setItem("tetris-name", name);
        submitScore(name, state).finally(() => { submitting = false; startNew(); });
    });

    const again = el("button", { class: "btn-primary btn-secondary", text: "Play Again" });
    again.addEventListener("click", startNew);

    card.append(
        el("h2", { text: "Game Over" }),
        el("p", { text: `Score ${state.score} · Level ${state.level} · ${state.lines} lines` }),
        input, submit, again
    );
    input.focus();
}

// ============================================================================
// Leaderboard (Vercel serverless function, with localStorage fallback)
// ============================================================================

function localScores() {
    try { return JSON.parse(localStorage.getItem("tetris-scores") || "[]"); } catch (e) { return []; }
}
function saveLocal(entry) {
    const list = localScores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem("tetris-scores", JSON.stringify(list.slice(0, 20)));
    return list;
}
async function loadLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("bad status");
        renderLeaderboard(await res.json());
    } catch (e) { renderLeaderboard(localScores()); }
}
async function submitScore(name, state) {
    const entry = { name, score: state.score, lines: state.lines, level: state.level };
    saveLocal(entry);
    try {
        const res = await fetch("/api/leaderboard", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
        });
        if (!res.ok) throw new Error("bad status");
        renderLeaderboard(await res.json());
    } catch (e) { renderLeaderboard(localScores()); }
}
function renderLeaderboard(entries) {
    leaderboardEl.innerHTML = "";
    if (!entries || entries.length === 0) { leaderboardEl.append(el("li", { class: "empty", text: "No scores yet" })); return; }
    entries.slice(0, 8).forEach((e) => {
        const li = document.createElement("li");
        li.append(el("span", { class: "name", text: e.name }), el("span", { class: "pts", text: e.score }));
        leaderboardEl.append(li);
    });
}

// ============================================================================
// Input — keyboard, on-screen buttons (with auto-repeat), and board gestures
// ============================================================================

const act = (fn) => { fn(); render(game.snapshot()); };

const KEYMAP = {
    ArrowLeft: () => game.moveLeft(), ArrowRight: () => game.moveRight(),
    ArrowDown: () => game.softDrop(), ArrowUp: () => game.rotate(true),
    KeyX: () => game.rotate(true), KeyZ: () => game.rotate(false),
    Space: () => game.hardDrop(), KeyC: () => game.holdPiece()
};
window.addEventListener("keydown", (e) => {
    const fn = KEYMAP[e.code];
    if (!fn) return;
    e.preventDefault();
    if (e.code === "Space" && e.repeat) return;
    act(fn);
});

function bindButton(id, fn, repeat) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let delay = null, interval = null;
    const stop = () => { clearTimeout(delay); clearInterval(interval); delay = interval = null; btn.classList.remove("pressed"); };
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.classList.add("pressed");
        act(fn);
        if (repeat) { delay = setTimeout(() => { interval = setInterval(() => act(fn), 60); }, 170); }
    });
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("pointerleave", stop);
}
bindButton("btn-left", () => game.moveLeft(), true);
bindButton("btn-right", () => game.moveRight(), true);
bindButton("btn-down", () => game.softDrop(), true);
bindButton("btn-rotate", () => game.rotate(true), false);
bindButton("btn-drop", () => game.hardDrop(), false);
bindButton("btn-hold", () => game.holdPiece(), false);

// Board gestures: swipe to move, swipe down to drop, tap to rotate.
let gStart = null, gLastX = 0, gLastY = 0, gMoved = false;
function gestureStep() { return Math.max(20, Math.round(boardCanvas.clientWidth / 10 * 0.85)); }
boardCanvas.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    gStart = { x: t.clientX, y: t.clientY, time: performance.now() };
    gLastX = t.clientX; gLastY = t.clientY; gMoved = false;
    e.preventDefault();
}, { passive: false });
boardCanvas.addEventListener("touchmove", (e) => {
    if (!gStart) return;
    const t = e.touches[0];
    const step = gestureStep();
    let dx = t.clientX - gLastX;
    while (Math.abs(dx) >= step) {
        if (dx > 0) { game.moveRight(); dx -= step; gLastX += step; }
        else { game.moveLeft(); dx += step; gLastX -= step; }
        gMoved = true;
    }
    let dy = t.clientY - gLastY;
    while (dy >= step) { game.softDrop(); dy -= step; gLastY += step; gMoved = true; }
    render(game.snapshot());
    e.preventDefault();
}, { passive: false });
boardCanvas.addEventListener("touchend", (e) => {
    if (!gStart) return;
    const dt = performance.now() - gStart.time;
    const last = e.changedTouches[0];
    const totalDx = last.clientX - gStart.x, totalDy = last.clientY - gStart.y;
    if (!gMoved && dt < 250 && Math.abs(totalDx) < 12 && Math.abs(totalDy) < 12) { act(() => game.rotate(true)); }
    else if (totalDy > 70 && Math.abs(totalDx) < 50 && dt < 320) { act(() => game.hardDrop()); }
    gStart = null;
    e.preventDefault();
}, { passive: false });

// ============================================================================
// Boot
// ============================================================================

if (navigator.maxTouchPoints > 0 || "ontouchstart" in window) {
    document.documentElement.classList.add("touch-device");
}
document.getElementById("start-btn").addEventListener("click", startNew);

loadLeaderboard();
render(game.snapshot());
requestAnimationFrame(loop);
