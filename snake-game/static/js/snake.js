(function () {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const gameIdEl = document.getElementById("game-id");
    const newGameBtn = document.getElementById("new-game-btn");
    const saveGameBtn = document.getElementById("save-game-btn");
    const loadGameBtn = document.getElementById("load-game-btn");
    const endGameBtn = document.getElementById("end-game-btn");
    const gameStatusEl = document.getElementById("game-status");
    const skinPickerEl = document.getElementById("skin-picker");


    const gridSize = 20;
    const tileCount = canvas.width / gridSize;
    const tickMs = 110;

    let snake = [{ x: 10, y: 10 }];
    let direction = { x: 1, y: 0 };
    let pendingDirection = { x: 1, y: 0 };
    let food = randomFood();
    let score = 0;
    let gameId = null;
    let moves = 0;
    let startedAt = Date.now();
    let loopId = null;
    let isRunning = false;
    let currentSkin = "classic";
    let audioEnabled = false;

    const skinThemes = {
        classic: { label: "Classic Green", head: "#58d68d", body: "#2f9e44", eye: "#0b111d" },
        emerald: { label: "Emerald", head: "#35d8a6", body: "#1f8f73", eye: "#07241d" },
        sapphire: { label: "Sapphire", head: "#66b3ff", body: "#2d6cdf", eye: "#061229" },
        sunset: { label: "Sunset", head: "#ff9f6f", body: "#ff6b6b", eye: "#2b0f0f" },
        neon_pink: { label: "Neon Pink", head: "#ff6ad5", body: "#d633b2", eye: "#22061f" },
        arctic: { label: "Arctic", head: "#c9f5ff", body: "#88d3f1", eye: "#0a2430" },
    };

    function randomFood() {
        let next = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount),
        };

        while (snake.some((part) => part.x === next.x && part.y === next.y)) {
            next = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
            };
        }
        return next;
    }

    function drawCell(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * gridSize, y * gridSize, gridSize - 2, gridSize - 2);
    }

    function drawBoard() {
        const boardGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        boardGradient.addColorStop(0, "#09111f");
        boardGradient.addColorStop(1, "#05070f");
        ctx.fillStyle = boardGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "rgba(79, 104, 141, 0.16)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= tileCount; i++) {
            const pos = i * gridSize;
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(canvas.width, pos);
            ctx.stroke();
        }
    }

    function drawFood() {
        const centerX = food.x * gridSize + gridSize / 2;
        const centerY = food.y * gridSize + gridSize / 2;
        const radius = gridSize / 2.5;

        ctx.fillStyle = "#ff4d4f";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffb3b3";
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 3, radius / 3, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawSnake() {
        const theme = skinThemes[currentSkin] || skinThemes.classic;
        snake.forEach((part, idx) => {
            const x = part.x * gridSize + 1;
            const y = part.y * gridSize + 1;
            const size = gridSize - 2;
            const isHead = idx === 0;

            ctx.fillStyle = isHead ? theme.head : theme.body;
            ctx.beginPath();
            ctx.roundRect(x, y, size, size, 6);
            ctx.fill();

            if (isHead) {
                ctx.fillStyle = theme.eye;
                ctx.beginPath();
                ctx.arc(x + size * 0.34, y + size * 0.35, 2, 0, Math.PI * 2);
                ctx.arc(x + size * 0.66, y + size * 0.35, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    function playTone(freq, durationMs, volume) {
        if (!audioEnabled) {
            return;
        }
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.type = "triangle";
            oscillator.frequency.value = freq;
            gainNode.gain.value = volume;

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();

            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
            }, durationMs);
        } catch (_err) {
            audioEnabled = false;
        }
    }

    function setStatus(text) {
        if (gameStatusEl) {
            gameStatusEl.textContent = text;
        }
    }

    function render() {
        drawBoard();
        drawFood();
        drawSnake();
        scoreEl.textContent = String(score);
        gameIdEl.textContent = gameId ? String(gameId) : "-";
    }

    function gameOver() {
        stopLoop();
        playTone(180, 260, 0.1);
        setStatus("Game Over");
        alert("Game over! Final score: " + score);
    }

    function step() {
        direction = pendingDirection;
        const head = {
            x: snake[0].x + direction.x,
            y: snake[0].y + direction.y,
        };

        moves += 1;

        if (
            head.x < 0 ||
            head.y < 0 ||
            head.x >= tileCount ||
            head.y >= tileCount ||
            snake.some((part) => part.x === head.x && part.y === head.y)
        ) {
            gameOver();
            return;
        }

        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            score += 10;
            food = randomFood();
            playTone(540, 80, 0.05);
        } else {
            snake.pop();
        }

        render();
    }

    function startLoop() {
        if (loopId) {
            clearInterval(loopId);
        }
        loopId = setInterval(step, tickMs);
        isRunning = true;
        setStatus("Running");
    }

    function stopLoop() {
        if (loopId) {
            clearInterval(loopId);
            loopId = null;
        }
        isRunning = false;
        if (score === 0) {
            setStatus("Ready");
        }
    }

    function resetLocalState() {
        snake = [{ x: 10, y: 10 }];
        direction = { x: 1, y: 0 };
        pendingDirection = { x: 1, y: 0 };
        food = randomFood();
        score = 0;
        moves = 0;
        startedAt = Date.now();
        setStatus("Ready");
        render();
    }

    function bindControls() {
        document.addEventListener("keydown", (event) => {
            const key = event.key;
            if (key === "ArrowUp" && direction.y !== 1) pendingDirection = { x: 0, y: -1 };
            if (key === "ArrowDown" && direction.y !== -1) pendingDirection = { x: 0, y: 1 };
            if (key === "ArrowLeft" && direction.x !== 1) pendingDirection = { x: -1, y: 0 };
            if (key === "ArrowRight" && direction.x !== -1) pendingDirection = { x: 1, y: 0 };
            audioEnabled = true;
        });
    }

    async function postJson(url, data) {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return response.json();
    }

    async function newGame() {
        const result = await postJson("/game/new", {});
        if (!result.success) {
            alert(result.message || "Could not start game.");
            return;
        }
        gameId = result.game_id;
        resetLocalState();
        startLoop();
    }

    async function saveGame() {
        if (!gameId) {
            alert("Start or load a game first.");
            return;
        }
        const result = await postJson("/game/save", {
            game_id: gameId,
            current_score: score,
            snake_data: snake,
            food_data: food,
        });
        setStatus("Saved");
        alert(result.message || "Save completed.");
    }

    async function loadGame() {
        const response = await fetch("/game/load");
        const result = await response.json();
        if (!result.success) {
            alert(result.message || "No saved game found.");
            return;
        }

        const game = result.game;
        gameId = game.id;
        snake = Array.isArray(game.snake_data) && game.snake_data.length ? game.snake_data : [{ x: 10, y: 10 }];
        food = game.food_data && typeof game.food_data.x === "number" ? game.food_data : randomFood();
        score = Number(game.current_score || 0);
        direction = { x: 1, y: 0 };
        pendingDirection = { x: 1, y: 0 };
        moves = 1;
        startedAt = Date.now();
        render();
        if (!isRunning) {
            startLoop();
        }
        setStatus("Loaded");
    }

    async function submitScore() {
        if (!gameId) {
            alert("No active game to submit.");
            return;
        }
        stopLoop();

        const durationSeconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
        const result = await postJson("/game/submit-score", {
            game_id: gameId,
            score: score,
            moves: moves,
            duration_seconds: durationSeconds,
        });

        if (!result.success) {
            alert(result.message || "Score submit failed.");
            return;
        }

        setStatus("Submitted");
        alert("Score submitted successfully.");
        window.location.href = "/game/dashboard";
    }

    function normalizeSkinName(name) {
        return name.toLowerCase().replace(/\s+/g, "_");
    }

    async function loadOwnedSkins() {
        if (!skinPickerEl) {
            return;
        }
        const response = await fetch("/shop/cosmetics");
        const result = await response.json();
        if (!result.success) {
            return;
        }

        Object.entries(skinThemes).forEach(([key, value]) => {
            if (key === "classic") {
                return;
            }
            const option = document.createElement("option");
            option.value = key;
            option.textContent = `${value.label} (locked)`;
            option.disabled = true;
            skinPickerEl.appendChild(option);
        });

        result.colors.forEach((color) => {
            const skinKey = normalizeSkinName(color.name);
            if (!skinThemes[skinKey]) {
                return;
            }
            const option = Array.from(skinPickerEl.options).find((item) => item.value === skinKey);
            if (option) {
                option.textContent = `${skinThemes[skinKey].label} (owned)`;
                option.disabled = false;
            } else {
                const ownedOption = document.createElement("option");
                ownedOption.value = skinKey;
                ownedOption.textContent = `${skinThemes[skinKey].label} (owned)`;
                skinPickerEl.appendChild(ownedOption);
            }
        });

        const savedSkin = localStorage.getItem("snake_skin");
        if (savedSkin && skinThemes[savedSkin]) {
            const selected = Array.from(skinPickerEl.options).find((item) => item.value === savedSkin && !item.disabled);
            if (selected) {
                currentSkin = savedSkin;
                skinPickerEl.value = savedSkin;
            }
        }
    }

    function bindSkinPicker() {
        if (!skinPickerEl) {
            return;
        }
        skinPickerEl.addEventListener("change", () => {
            const nextSkin = skinPickerEl.value;
            const option = Array.from(skinPickerEl.options).find((item) => item.value === nextSkin);
            if (option && option.disabled) {
                return;
            }
            currentSkin = nextSkin;
            localStorage.setItem("snake_skin", nextSkin);
            render();
            playTone(420, 60, 0.04);
        });
    }

    newGameBtn.addEventListener("click", newGame);
    saveGameBtn.addEventListener("click", saveGame);
    loadGameBtn.addEventListener("click", loadGame);
    endGameBtn.addEventListener("click", submitScore);

    bindControls();
    bindSkinPicker();
    loadOwnedSkins();
    setStatus("Ready");
    render();
})();
