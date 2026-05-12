(function () {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const scoreEl       = document.getElementById("score");
    const gameIdEl      = document.getElementById("game-id");
    const gameStatusEl  = document.getElementById("game-status");
    const newGameBtn    = document.getElementById("new-game-btn");
    const saveGameBtn   = document.getElementById("save-game-btn");
    const loadGameBtn   = document.getElementById("load-game-btn");
    const endGameBtn    = document.getElementById("end-game-btn");
    const skinPickerEl  = document.getElementById("skin-picker");
    const mpToggleEl    = document.getElementById("multiplayer-toggle");
    const opponentPicker= document.getElementById("opponent-picker");
    const startDuelBtn  = document.getElementById("start-duel-btn");
    const chatLogEl     = document.getElementById("chat-log");
    const chatInputEl   = document.getElementById("chat-input");
    const chatSendBtn   = document.getElementById("chat-send-btn");
    const reportBtn     = document.getElementById("report-player-btn");
    const powerupsListEl= document.getElementById("powerups-list");

    // ── Constants ──────────────────────────────────────
    const GRID = 20;
    const TILES = canvas.width / GRID;
    const BASE_TICK_MS = 110;

    // ── State ───────────────────────────────────────────
    let gameId      = null;
    let moves       = 0;
    let startedAt   = Date.now();
    let loopId      = null;
    let rafId       = null;
    let isRunning   = false;
    let audioEnabled= false;
    let currentSkin = localStorage.getItem("snake_skin") || "classic";
    let multiplayerLocal = false;  // local 2-player (WASD + Arrows)
    let duelMatchId = null;        // DB-based duel
    let lastChatId  = 0;

    // Power-up state
    let availablePowerups = [];
    let speedBoostUntil   = 0;
    let shieldActive      = false;
    let doublePointsUntil = 0;
    let lastFrameTime     = 0;
    let accumulator       = 0;

    // ── Skin Themes ─────────────────────────────────────
    const SKINS = {
        classic:   { label: "Classic Green", head: "#16a34a", body: "#4ade80", eye: "#052e16" },
        emerald:   { label: "Emerald",        head: "#059669", body: "#34d399", eye: "#022c22" },
        sapphire:  { label: "Sapphire",       head: "#2563eb", body: "#60a5fa", eye: "#1e1b4b" },
        sunset:    { label: "Sunset",         head: "#ea580c", body: "#fb923c", eye: "#431407" },
        neon_pink: { label: "Neon Pink",      head: "#db2777", body: "#f472b6", eye: "#500724" },
        arctic:    { label: "Arctic",         head: "#0891b2", body: "#67e8f9", eye: "#083344" },
    };

    // ── Players ─────────────────────────────────────────
    let players = [];
    let food    = null;

    function createPlayers() {
        const skin = SKINS[currentSkin] || SKINS.classic;
        const p1 = {
            id: "P1", label: "You",
            snake: [{ x: 5, y: 10 }],
            dir: { x: 1, y: 0 }, pending: { x: 1, y: 0 },
            queue: [],
            score: 0, alive: true,
            head: skin.head, body: skin.body, eye: skin.eye,
            controls: { up:"ArrowUp", down:"ArrowDown", left:"ArrowLeft", right:"ArrowRight" },
        };
        const p2 = {
            id: "P2", label: "P2",
            snake: [{ x: TILES - 6, y: 10 }],
            dir: { x: -1, y: 0 }, pending: { x: -1, y: 0 },
            queue: [],
            score: 0, alive: true,
            head: "#db2777", body: "#f472b6", eye: "#500724",
            controls: { up:"w", down:"s", left:"a", right:"d" },
        };
        players = multiplayerLocal ? [p1, p2] : [p1];
        food = randomFood();
    }

    // ── Utilities ────────────────────────────────────────
    function randomFood() {
        let pos;
        do {
            pos = { x: Math.floor(Math.random() * TILES), y: Math.floor(Math.random() * TILES) };
        } while (players.some(p => p.snake.some(s => s.x === pos.x && s.y === pos.y)));
        return pos;
    }

    function totalScore() {
        return players.reduce((sum, p) => sum + p.score, 0);
    }

    function setStatus(t) { if (gameStatusEl) gameStatusEl.textContent = t; }

    function playTone(freq, dur, vol) {
        if (!audioEnabled) return;
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ac.createOscillator(), g = ac.createGain();
            osc.type = "triangle"; osc.frequency.value = freq;
            g.gain.value = vol;
            osc.connect(g); g.connect(ac.destination);
            osc.start();
            setTimeout(() => { osc.stop(); ac.close(); }, dur);
        } catch (_) { audioEnabled = false; }
    }

    // ── Drawing ──────────────────────────────────────────
    function drawBoard() {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        for (let i = 0; i <= TILES; i++) {
            const p = i * GRID;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
        }
    }

    function drawFood() {
        const cx = food.x * GRID + GRID / 2;
        const cy = food.y * GRID + GRID / 2;
        ctx.fillStyle = "#dc2626";
        ctx.beginPath(); ctx.arc(cx, cy, GRID / 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fca5a5";
        ctx.beginPath(); ctx.arc(cx - 2, cy - 2, GRID / 6, 0, Math.PI * 2); ctx.fill();
    }

    function drawPlayer(p) {
        p.snake.forEach((seg, i) => {
            const x = seg.x * GRID + 1, y = seg.y * GRID + 1, sz = GRID - 2;
            ctx.fillStyle = i === 0 ? p.head : p.body;
            ctx.beginPath();
            ctx.roundRect(x, y, sz, sz, 5);
            ctx.fill();
            if (i === 0) {
                // Shield indicator
                if (p.id === "P1" && shieldActive) {
                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(x + sz / 2, y + sz / 2, sz / 2 + 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
                // Eyes
                ctx.fillStyle = p.eye;
                ctx.beginPath();
                ctx.arc(x + sz * 0.34, y + sz * 0.35, 2, 0, Math.PI * 2);
                ctx.arc(x + sz * 0.66, y + sz * 0.35, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function render() {
        drawBoard();
        drawFood();
        players.filter(p => p.alive).forEach(drawPlayer);
        if (scoreEl) scoreEl.textContent = String(totalScore());
        if (gameIdEl) gameIdEl.textContent = gameId ? String(gameId) : "—";
    }

    // ── Game Logic ───────────────────────────────────────
    function stepPlayer(p) {
        if (!p.alive) return;
        if (!p.queue) p.queue = [];

        if (p.queue.length > 0) {
            p.dir = p.queue.shift();
            p.pending = p.dir;
        } else {
            p.dir = p.pending;
        }

        const head = { x: p.snake[0].x + p.dir.x, y: p.snake[0].y + p.dir.y };
        const hitWall = head.x < 0 || head.y < 0 || head.x >= TILES || head.y >= TILES;
        const hitSelf = p.snake.some(s => s.x === head.x && s.y === head.y);
        const hitOther = players.some(op => op.id !== p.id && op.snake.some(s => s.x === head.x && s.y === head.y));

        if (hitWall || hitSelf || hitOther) {
            if (p.id === "P1" && shieldActive) {
                shieldActive = false;
                playTone(220, 200, 0.1);
                p.snake = p.snake.slice(0, Math.max(1, Math.floor(p.snake.length / 2)));
                p.dir = { x: -p.dir.x, y: -p.dir.y };
                p.pending = p.dir;
                return;
            }
            p.alive = false;
            return;
        }

        p.snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            const pts = (p.id === "P1" && Date.now() < doublePointsUntil) ? 20 : 10;
            p.score += pts;
            food = randomFood();
            playTone(540, 80, 0.05);
        } else {
            p.snake.pop();
        }
        moves++;
    }

    function step() {
        players.forEach(stepPlayer);
        const alive = players.filter(p => p.alive);
        if (!alive.length) {
            stopLoop();
            playTone(180, 300, 0.1);
            setStatus("Game Over");
            setTimeout(() => alert(`Game over! Final score: ${totalScore()}`), 50);
            return;
        }
        if (Date.now() > speedBoostUntil && speedBoostUntil > 0) speedBoostUntil = 0;
        render();
    }

    // ── RAF-based Game Loop (no scroll jank) ────────────
    function gameLoop(timestamp) {
        if (!isRunning) return;
        if (!lastFrameTime) lastFrameTime = timestamp;
        const dt = Math.min(timestamp - lastFrameTime, 200);
        lastFrameTime = timestamp;
        accumulator += dt;

        const tickMs = speedBoostUntil > Date.now() ? BASE_TICK_MS * 0.6 : BASE_TICK_MS;
        while (accumulator >= tickMs) {
            step();
            accumulator -= tickMs;
            if (!isRunning) return;
        }
        rafId = requestAnimationFrame(gameLoop);
    }

    function startLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        isRunning = true;
        lastFrameTime = 0;
        accumulator = 0;
        rafId = requestAnimationFrame(gameLoop);
        document.body.classList.add("play-locked");   // lock scroll only while playing
        setStatus("Running");
    }

    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        isRunning = false;
        document.body.classList.remove("play-locked"); // restore scroll when not playing
    }

    function resetLocalState() {
        createPlayers();
        moves = 0;
        startedAt = Date.now();
        shieldActive = false;
        speedBoostUntil = 0;
        doublePointsUntil = 0;
        setStatus("Ready");
        render();
    }

    // ── Controls – Arrow keys prevented from scrolling ──
    function keyToDir(key, controls) {
        if (key === controls.up)    return { x: 0,  y: -1 };
        if (key === controls.down)  return { x: 0,  y:  1 };
        if (key === controls.left)  return { x: -1, y:  0 };
        if (key === controls.right) return { x:  1, y:  0 };
        return null;
    }

    function bindControls() {
        document.addEventListener("keydown", (e) => {
            const arrowKeys = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
            if (arrowKeys.includes(e.key)) {
                e.preventDefault(); // ← fixes the scrolling bug
            }

            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

            // Power-up hotkeys during game
            if (isRunning && ["1","2","3"].includes(key)) {
                usePowerup(parseInt(key) - 1);
                return;
            }

            players.forEach(p => {
                if (!p.queue) p.queue = [];
                const next = keyToDir(key, p.controls);
                if (!next) return;

                const last = p.queue.length ? p.queue[p.queue.length - 1] : p.pending;
                if (next.x === -last.x && next.y === -last.y) return; // no reversing
                if (p.queue.length < 3) {
                    p.queue.push(next);
                    if (p.queue.length === 1) p.pending = next;
                }
            });

            audioEnabled = true;
        });
    }

    // ── API Helpers ─────────────────────────────────────
    async function postJson(url, data) {
        const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return r.json();
    }

    // ── Game Actions ─────────────────────────────────────
    async function newGame() {
        const res = await postJson("/game/new", {});
        if (!res.success) { alert(res.message || "Could not start game."); return; }
        gameId = res.game_id;
        resetLocalState();
        startLoop();
    }

    async function saveGame() {
        if (!gameId) { alert("Start a game first."); return; }
        const res = await postJson("/game/save", {
            game_id: gameId, current_score: totalScore(),
            snake_data: players[0].snake, food_data: food,
        });
        setStatus("Saved");
        alert(res.message || "Saved.");
    }

    async function loadGame() {
        const r = await fetch("/game/load");
        const res = await r.json();
        if (!res.success) { alert(res.message || "No saved game."); return; }
        const g = res.game;
        gameId = g.id;
        resetLocalState();
        players[0].snake = Array.isArray(g.snake_data) && g.snake_data.length ? g.snake_data : [{ x: 10, y: 10 }];
        food = g.food_data && typeof g.food_data.x === "number" ? g.food_data : randomFood();
        players[0].score = Number(g.current_score || 0);
        render();
        startLoop();
        setStatus("Loaded");
    }

    async function submitScore() {
        stopLoop();
        if (!gameId) { alert("No active game."); return; }
        const dur = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
        const res = await postJson("/game/submit-score", {
            game_id: gameId, score: totalScore(), moves, duration_seconds: dur,
        });
        if (!res.success) { alert(res.message || "Submit failed."); return; }
        setStatus("Submitted");
        alert("Score submitted!");
        window.location.href = "/game/dashboard";
    }

    // ── Skins ────────────────────────────────────────────
    function normalizeSkin(name) { return name.toLowerCase().replace(/\s+/g, "_"); }

    async function loadOwnedSkins() {
        if (!skinPickerEl) return;
        // Add locked options first
        Object.entries(SKINS).forEach(([key, val]) => {
            if (key === "classic") return;
            const opt = document.createElement("option");
            opt.value = key; opt.textContent = `${val.label} (locked)`; opt.disabled = true;
            skinPickerEl.appendChild(opt);
        });
        try {
            const res = await (await fetch("/shop/cosmetics")).json();
            if (!res.success) return;
            res.colors.forEach(c => {
                const k = normalizeSkin(c.name);
                const opt = Array.from(skinPickerEl.options).find(o => o.value === k);
                if (opt) { opt.textContent = `${SKINS[k]?.label || c.name} (owned)`; opt.disabled = false; }
            });
        } catch (_) {}
        // Restore saved skin
        const saved = localStorage.getItem("snake_skin");
        if (saved && SKINS[saved]) {
            const opt = Array.from(skinPickerEl.options).find(o => o.value === saved && !o.disabled);
            if (opt) { currentSkin = saved; skinPickerEl.value = saved; }
        }
    }

    function bindSkinPicker() {
        if (!skinPickerEl) return;
        skinPickerEl.addEventListener("change", () => {
            const opt = Array.from(skinPickerEl.options).find(o => o.value === skinPickerEl.value);
            if (opt && opt.disabled) return;
            currentSkin = skinPickerEl.value;
            localStorage.setItem("snake_skin", currentSkin);
            const skin = SKINS[currentSkin] || SKINS.classic;
            if (players[0]) { players[0].head = skin.head; players[0].body = skin.body; players[0].eye = skin.eye; }
            render(); playTone(420, 60, 0.04);
        });
    }

    // ── Multiplayer (Local 2-Player) ─────────────────────
    function bindMultiplayerToggle() {
        if (!mpToggleEl) return;
        mpToggleEl.addEventListener("change", () => {
            multiplayerLocal = mpToggleEl.checked;
            if (reportBtn) reportBtn.style.display = multiplayerLocal ? "inline-flex" : "none";
            resetLocalState();
            setStatus(multiplayerLocal ? "2-Player Ready" : "Ready");
        });
    }

    // ── DB Duel (play against a registered user) ─────────
    async function loadOpponents() {
        if (!opponentPicker) return;
        try {
            const res = await (await fetch("/game/users")).json();
            if (!res.success) return;
            res.users.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.id; opt.textContent = u.username;
                opponentPicker.appendChild(opt);
            });
        } catch (_) {}
    }

    async function startDuel() {
        if (!opponentPicker || !opponentPicker.value) { alert("Select an opponent first."); return; }
        try {
            const res = await postJson("/game/duel/start", { opponent_id: Number(opponentPicker.value) });
            if (!res.success) { alert(res.message || "Could not start duel."); return; }
            duelMatchId = res.match_id;
            addChatMsg("System", `Duel started! Match #${duelMatchId}`, "sys");
            if (reportBtn) reportBtn.style.display = "inline-flex";
            multiplayerLocal = true;
            if (mpToggleEl) mpToggleEl.checked = true;
            resetLocalState();
            startLoop();
        } catch (_) { alert("Duel feature needs backend support."); }
    }

    // ── Chat ─────────────────────────────────────────────
    function addChatMsg(author, text, cls = "other") {
        if (!chatLogEl) return;
        const div = document.createElement("div");
        div.className = "chat-msg";
        div.innerHTML = `<span class="chat-author ${cls}">[${author}]</span> ${escapeHtml(text)}`;
        chatLogEl.appendChild(div);
        chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    async function sendChat() {
        if (!chatInputEl) return;
        const msg = chatInputEl.value.trim();
        if (!msg) return;
        chatInputEl.value = "";
        addChatMsg("You", msg, "me");
        if (duelMatchId) {
            try {
                await postJson(`/game/duel/chat/${duelMatchId}`, { message: msg });
            } catch (_) {}
        }
    }

    function bindChat() {
        if (chatSendBtn) chatSendBtn.addEventListener("click", sendChat);
        if (chatInputEl) {
            chatInputEl.addEventListener("keydown", e => {
                if (e.key === "Enter") { e.preventDefault(); sendChat(); }
            });
        }
    }

    // Poll chat if in a DB duel
    setInterval(async () => {
        if (!duelMatchId || !chatLogEl) return;
        try {
            const res = await (await fetch(`/game/duel/chat/${duelMatchId}?since=${lastChatId}`)).json();
            if (!res.success || !res.messages) return;
            res.messages.forEach(m => {
                if (m.id > lastChatId) {
                    addChatMsg(m.username, m.message, "other");
                    lastChatId = m.id;
                }
            });
        } catch (_) {}
    }, 2000);

    // ── Player Reporting ─────────────────────────────────
    function bindReport() {
        if (!reportBtn) return;
        reportBtn.addEventListener("click", async () => {
            const reason = prompt("Reason for reporting this player (e.g. toxic chat, cheating):");
            if (!reason) return;
            const opponentName = opponentPicker?.selectedOptions?.[0]?.textContent || "unknown";
            try {
                const res = await postJson("/game/report", {
                    reported_username: opponentName,
                    reason,
                    match_id: duelMatchId,
                });
                alert(res.message || "Report submitted. Thank you.");
            } catch (_) {
                alert("Could not submit report.");
            }
        });
    }

    // ── Power-ups ─────────────────────────────────────────
    async function loadPowerups() {
        if (!powerupsListEl) return;
        try {
            const res = await (await fetch("/shop/powerups")).json();
            if (!res.success) { powerupsListEl.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);">No power-ups owned.</p>'; return; }
            availablePowerups = res.powerups;
            renderPowerupsUI();
        } catch (_) {
            powerupsListEl.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);">Could not load power-ups.</p>';
        }
    }

    function renderPowerupsUI() {
        if (!powerupsListEl) return;
        powerupsListEl.innerHTML = "";
        if (!availablePowerups.length) {
            powerupsListEl.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);">No power-ups owned. <a href="/shop/">Buy some!</a></p>';
            return;
        }
        availablePowerups.slice(0, 3).forEach((pu, i) => {
            const icon = pu.name.includes("Shield") ? "fa-shield-halved" :
                         pu.name.includes("Speed")  ? "fa-bolt" :
                         pu.name.includes("Double") ? "fa-star" : "fa-magic";
            const div = document.createElement("div");
            div.className = "powerup-item";
            div.innerHTML = `
                <span class="powerup-hotkey">${i + 1}</span>
                <i class="fa-solid ${icon}" style="color:var(--accent-amber); width:16px; text-align:center;"></i>
                <span style="font-size:0.82rem; font-weight:500; flex:1;">${pu.name}</span>
                <span class="powerup-qty" id="pu-qty-${pu.id}">×${pu.quantity}</span>
            `;
            powerupsListEl.appendChild(div);
        });
    }

    async function usePowerup(index) {
        if (index >= availablePowerups.length) return;
        const pu = availablePowerups[index];
        if (pu.quantity <= 0) return;

        const name = pu.name.toLowerCase();

        if (name.includes("speed")) {
            speedBoostUntil = Date.now() + 5000;
            addChatMsg("System", "⚡ Speed Boost active for 5s!", "sys");
        } else if (name.includes("shield")) {
            shieldActive = true;
            addChatMsg("System", "🛡 Shield active – survives 1 crash!", "sys");
        } else if (name.includes("double")) {
            doublePointsUntil = Date.now() + 8000;
            addChatMsg("System", "⭐ Double Points active for 8s!", "sys");
        } else if (name.includes("magnet")) {
            // Auto-collect food if within 8 tiles
            const head = players[0]?.snake[0];
            if (head && Math.abs(head.x - food.x) <= 8 && Math.abs(head.y - food.y) <= 8) {
                players[0].score += 10; food = randomFood(); playTone(540, 80, 0.05);
            } else {
                addChatMsg("System", "🧲 Magnet: food too far away.", "sys");
                return;
            }
        }

        pu.quantity--;
        const el = document.getElementById(`pu-qty-${pu.id}`);
        if (el) el.textContent = `×${pu.quantity}`;
        playTone(600, 100, 0.08);

        try {
            await postJson("/shop/consume", { item_id: pu.id });
        } catch (_) {}
    }

    // ── Init ─────────────────────────────────────────────
    newGameBtn?.addEventListener("click", newGame);
    saveGameBtn?.addEventListener("click", saveGame);
    loadGameBtn?.addEventListener("click", loadGame);
    endGameBtn?.addEventListener("click", submitScore);
    startDuelBtn?.addEventListener("click", startDuel);

    bindControls();
    bindSkinPicker();
    bindMultiplayerToggle();
    bindChat();
    bindReport();
    loadOwnedSkins();
    loadOpponents();
    loadPowerups();

    resetLocalState();
    setStatus("Ready");
})();
