import json
from datetime import datetime

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, session, url_for

from routes.auth import login_required


game_bp = Blueprint("game", __name__)


def get_db():
    return current_app.extensions["get_db"]()


def _validate_score(score: int, moves: int, duration_seconds: int) -> bool:
    if score < 0 or score > current_app.config["MAX_SCORE_PER_SESSION"]:
        return False
    if moves <= 0 or duration_seconds <= 0:
        return False
    max_expected_score = moves * current_app.config["SCORE_INCREMENT"]
    if score > max_expected_score:
        return False
    move_rate = moves / max(duration_seconds, 1)
    if move_rate > current_app.config["MAX_ALLOWED_MOVE_RATE"]:
        return False
    return True


@game_bp.route("/dashboard")
@login_required
def dashboard():
    db = get_db()
    user_id = session["user_id"]
    today = datetime.utcnow().strftime("%Y-%m-%d")

    last_game = db.execute(
        """
        SELECT id, status, current_score, updated_at
        FROM GAMES WHERE user_id = ?
        ORDER BY updated_at DESC LIMIT 1
        """,
        (user_id,),
    ).fetchone()

    high_score_row   = db.execute("SELECT COALESCE(MAX(score), 0)         AS high_score  FROM SCORES WHERE user_id = ?", (user_id,)).fetchone()
    total_games_row  = db.execute("SELECT COUNT(*)                         AS total        FROM GAMES  WHERE user_id = ?", (user_id,)).fetchone()
    avg_score_row    = db.execute("SELECT COALESCE(ROUND(AVG(score),0),0)  AS avg_score   FROM SCORES WHERE user_id = ?", (user_id,)).fetchone()
    total_score_row  = db.execute("SELECT COALESCE(SUM(score), 0)          AS total_score FROM SCORES WHERE user_id = ?", (user_id,)).fetchone()
    shop_items_owned = db.execute("SELECT COUNT(*) AS cnt FROM INVENTORY   WHERE user_id = ?", (user_id,)).fetchone()

    recent_scores = db.execute(
        "SELECT score FROM SCORES WHERE user_id = ? ORDER BY achieved_at DESC LIMIT 7",
        (user_id,),
    ).fetchall()

    rank_row = db.execute(
        """
        SELECT COUNT(*) + 1 AS rank FROM (
            SELECT user_id, MAX(score) AS best FROM SCORES GROUP BY user_id
        ) sub
        WHERE sub.best > (SELECT COALESCE(MAX(score), 0) FROM SCORES WHERE user_id = ?)
        """,
        (user_id,),
    ).fetchone()

    leaderboard = db.execute(
        """
        SELECT u.username, MAX(s.score) AS best_score
        FROM SCORES s JOIN USERS u ON u.id = s.user_id
        GROUP BY s.user_id ORDER BY best_score DESC LIMIT 10
        """
    ).fetchall()

    # ── Daily tasks (reset each calendar day) ───────────────────────────────
    games_today = db.execute(
        "SELECT COUNT(*) AS cnt FROM GAMES WHERE user_id = ? AND DATE(started_at) = ?",
        (user_id, today),
    ).fetchone()["cnt"]

    best_score_today = db.execute(
        "SELECT COALESCE(MAX(score), 0) AS best FROM SCORES WHERE user_id = ? AND DATE(achieved_at) = ?",
        (user_id, today),
    ).fetchone()["best"]

    games_completed_today = db.execute(
        "SELECT COUNT(*) AS cnt FROM GAMES WHERE user_id = ? AND status = 'completed' AND DATE(updated_at) = ?",
        (user_id, today),
    ).fetchone()["cnt"]

    hs = high_score_row["high_score"]

    daily_tasks = [
        {
            "title": "Play a game",
            "desc": "Start and finish 1 game today",
            "icon": "fa-play",
            "color": "#16a34a",
            "progress": min(games_today, 1),
            "target": 1,
            "reward": 10,
        },
        {
            "title": "Score 50+ points",
            "desc": "Get at least 50 pts in a single game today",
            "icon": "fa-star",
            "color": "#d97706",
            "progress": 1 if best_score_today >= 50 else 0,
            "target": 1,
            "reward": 25,
        },
        {
            "title": "Play 3 games",
            "desc": "Complete 3 games today",
            "icon": "fa-gamepad",
            "color": "#2563eb",
            "progress": min(games_completed_today, 3),
            "target": 3,
            "reward": 30,
        },
        {
            "title": "Score 100+ points",
            "desc": "Get at least 100 pts in a single game today",
            "icon": "fa-bolt",
            "color": "#dc2626",
            "progress": 1 if best_score_today >= 100 else 0,
            "target": 1,
            "reward": 50,
        },
    ]

    # ── Achievements (permanent, computed from stats) ────────────────────────
    total_games_count = total_games_row["total"]
    achievements = [
        {
            "title": "First Step",
            "desc": "Play your very first game",
            "icon": "fa-flag",
            "color": "#16a34a",
            "rarity": "Common",
            "unlocked": total_games_count >= 1,
        },
        {
            "title": "Point Scorer",
            "desc": "Score 50+ points in a single game",
            "icon": "fa-star",
            "color": "#d97706",
            "rarity": "Common",
            "unlocked": hs >= 50,
        },
        {
            "title": "Sharp Player",
            "desc": "Score 100+ points in a single game",
            "icon": "fa-certificate",
            "color": "#2563eb",
            "rarity": "Uncommon",
            "unlocked": hs >= 100,
        },
        {
            "title": "Veteran",
            "desc": "Play 10 or more games",
            "icon": "fa-shield-halved",
            "color": "#7c3aed",
            "rarity": "Uncommon",
            "unlocked": total_games_count >= 10,
        },
        {
            "title": "Expert",
            "desc": "Score 200+ points in a single game",
            "icon": "fa-medal",
            "color": "#0891b2",
            "rarity": "Rare",
            "unlocked": hs >= 200,
        },
        {
            "title": "Master",
            "desc": "Score 500+ points in a single game",
            "icon": "fa-crown",
            "color": "#d97706",
            "rarity": "Epic",
            "unlocked": hs >= 500,
        },
        {
            "title": "Shopaholic",
            "desc": "Purchase an item from the shop",
            "icon": "fa-bag-shopping",
            "color": "#db2777",
            "rarity": "Common",
            "unlocked": shop_items_owned["cnt"] > 0,
        },
        {
            "title": "Legend",
            "desc": "Score 1000+ points in a single game",
            "icon": "fa-dragon",
            "color": "#dc2626",
            "rarity": "Legendary",
            "unlocked": hs >= 1000,
        },
    ]

    unlocked_count = sum(1 for a in achievements if a["unlocked"])

    return render_template(
        "game/dashboard.html",
        last_game=last_game,
        high_score=hs,
        total_games=total_games_count,
        avg_score=int(avg_score_row["avg_score"]),
        total_score=int(total_score_row["total_score"]),
        recent_scores=[r["score"] for r in recent_scores][::-1],
        rank=rank_row["rank"],
        leaderboard=leaderboard,
        daily_tasks=daily_tasks,
        achievements=achievements,
        unlocked_count=unlocked_count,
    )



@game_bp.route("/lobby")
@login_required
def lobby():
    db = get_db()
    user_id = session["user_id"]
    
    # Get high scores for each game
    scores_rows = db.execute(
        "SELECT game_type, MAX(score) as best FROM SCORES WHERE user_id = ? GROUP BY game_type", 
        (user_id,)
    ).fetchall()
    scores = {"snake": 0, "tetris": 0, "hangman": 0}
    for r in scores_rows:
        scores[r["game_type"]] = r["best"]
        
    # Get global ranks for each game
    ranks = {"snake": "-", "tetris": "-", "hangman": "-"}
    for gt in ["snake", "tetris", "hangman"]:
        rank_row = db.execute(
            """
            SELECT COUNT(*) + 1 AS rank FROM (
                SELECT user_id, MAX(score) AS best FROM SCORES WHERE game_type = ? GROUP BY user_id
            ) sub
            WHERE sub.best > (SELECT COALESCE(MAX(score), 0) FROM SCORES WHERE user_id = ? AND game_type = ?)
            """,
            (gt, user_id, gt),
        ).fetchone()
        
        # Only show rank if they have played
        if scores[gt] > 0:
            ranks[gt] = rank_row["rank"]

    overall_top5 = db.execute(
        """
        SELECT u.username, SUM(sub.best) AS total_score
        FROM (
            SELECT user_id, MAX(score) AS best FROM SCORES GROUP BY user_id, game_type
        ) sub
        JOIN USERS u ON u.id = sub.user_id
        GROUP BY sub.user_id
        ORDER BY total_score DESC
        LIMIT 5
        """
    ).fetchall()

    return render_template("game/lobby.html", scores=scores, ranks=ranks, overall_top5=overall_top5)


@game_bp.route("/play")
@login_required
def play():
    return render_template("game/play.html")


@game_bp.route("/tetris")
@login_required
def tetris():
    return render_template("game/tetris.html")


@game_bp.route("/hangman")
@login_required
def hangman():
    return render_template("game/hangman.html")


@game_bp.route("/new", methods=["POST"])
@login_required
def new_game():
    db = get_db()
    user_id = session["user_id"]
    now = datetime.utcnow().isoformat()

    payload = request.get_json(silent=True) or {}
    game_type = payload.get("game_type", "snake")

    db.execute(
        """
        INSERT INTO GAMES (user_id, status, current_score, snake_data, food_data, started_at, updated_at, game_type)
        VALUES (?, 'in_progress', 0, ?, ?, ?, ?, ?)
        """,
        (user_id, json.dumps([]), json.dumps({}), now, now, game_type),
    )
    db.commit()

    game_id = db.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return jsonify({"success": True, "game_id": game_id})


@game_bp.route("/load", methods=["GET"])
@login_required
def load_game():
    db = get_db()
    user_id = session["user_id"]

    game = db.execute(
        """
        SELECT id, status, current_score, snake_data, food_data, started_at, updated_at
        FROM GAMES
        WHERE user_id = ? AND status = 'in_progress'
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()

    if not game:
        return jsonify({"success": False, "message": "No saved game found."}), 404

    return jsonify({
        "success": True,
        "game": {
            "id": game["id"],
            "status": game["status"],
            "current_score": game["current_score"],
            "snake_data": json.loads(game["snake_data"] or "[]"),
            "food_data": json.loads(game["food_data"] or "{}"),
            "started_at": game["started_at"],
            "updated_at": game["updated_at"],
        },
    })


@game_bp.route("/save", methods=["POST"])
@login_required
def save_game():
    payload = request.get_json(silent=True) or {}
    game_id = payload.get("game_id")
    current_score = int(payload.get("current_score", 0))
    snake_data = payload.get("snake_data", [])
    food_data = payload.get("food_data", {})

    if not game_id:
        return jsonify({"success": False, "message": "game_id is required."}), 400

    db = get_db()
    user_id = session["user_id"]
    game = db.execute(
        "SELECT id FROM GAMES WHERE id = ? AND user_id = ?",
        (game_id, user_id),
    ).fetchone()

    if not game:
        return jsonify({"success": False, "message": "Game not found."}), 404

    db.execute(
        """
        UPDATE GAMES
        SET current_score = ?, snake_data = ?, food_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
        """,
        (current_score, json.dumps(snake_data), json.dumps(food_data), game_id, user_id),
    )
    db.commit()

    return jsonify({"success": True, "message": "Game saved."})


@game_bp.route("/submit-score", methods=["POST"])
@login_required
def submit_score():
    payload = request.get_json(silent=True) or {}
    game_id = payload.get("game_id")
    score = int(payload.get("score", 0))
    moves = int(payload.get("moves", 0))
    duration_seconds = int(payload.get("duration_seconds", 0))

    game_type = payload.get("game_type", "snake")

    if not game_id:
        return jsonify({"success": False, "message": "game_id is required."}), 400

    if not _validate_score(score, moves, duration_seconds):
        return jsonify({"success": False, "message": "Score validation failed."}), 400

    db = get_db()
    user_id = session["user_id"]

    game = db.execute(
        "SELECT id FROM GAMES WHERE id = ? AND user_id = ?",
        (game_id, user_id),
    ).fetchone()
    if not game:
        return jsonify({"success": False, "message": "Invalid game."}), 404

    db.execute(
        "UPDATE GAMES SET status = 'completed', current_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (score, game_id),
    )
    db.execute(
        "INSERT INTO SCORES (user_id, game_id, score, game_type) VALUES (?, ?, ?, ?)",
        (user_id, game_id, score, game_type),
    )
    db.commit()

    return jsonify({"success": True, "message": "Score submitted successfully."})


@game_bp.route("/leaderboard")
def leaderboard():
    game_type = request.args.get("g", "snake")
    if game_type not in ["snake", "tetris", "hangman"]:
        game_type = "snake"
        
    db = get_db()
    rows = db.execute(
        """
        SELECT u.username, MAX(s.score) AS best_score
        FROM SCORES s
        JOIN USERS u ON u.id = s.user_id
        WHERE s.game_type = ?
        GROUP BY s.user_id
        ORDER BY best_score DESC
        LIMIT 50
        """,
        (game_type,)
    ).fetchall()
    return render_template("game/leaderboard.html", leaderboard=rows, current_game=game_type)


@game_bp.route("/leaderboard/overall")
def leaderboard_overall():
    db = get_db()
    
    # Calculate sum of max scores per user across all games
    rows = db.execute(
        """
        SELECT u.username, SUM(sub.best) AS total_score, 
               MAX(CASE WHEN sub.game_type = 'snake' THEN sub.best ELSE 0 END) as snake_score,
               MAX(CASE WHEN sub.game_type = 'tetris' THEN sub.best ELSE 0 END) as tetris_score,
               MAX(CASE WHEN sub.game_type = 'hangman' THEN sub.best ELSE 0 END) as hangman_score
        FROM (
            SELECT user_id, game_type, MAX(score) AS best FROM SCORES GROUP BY user_id, game_type
        ) sub
        JOIN USERS u ON u.id = sub.user_id
        GROUP BY sub.user_id
        ORDER BY total_score DESC
        LIMIT 50
        """
    ).fetchall()
    return render_template("game/leaderboard_overall.html", leaderboard=rows)


# ── New: list all users for multiplayer opponent picker ──────────────────────
@game_bp.route("/users", methods=["GET"])
@login_required
def list_users():
    db = get_db()
    user_id = session["user_id"]
    rows = db.execute(
        "SELECT id, username FROM USERS WHERE id != ? ORDER BY username ASC",
        (user_id,),
    ).fetchall()
    return jsonify({"success": True, "users": [{"id": r["id"], "username": r["username"]} for r in rows]})


# ── New: report a player ─────────────────────────────────────────────────────
@game_bp.route("/report", methods=["POST"])
@login_required
def report_player():
    payload = request.get_json(silent=True) or {}
    reported_username = payload.get("reported_username", "").strip()
    reason = payload.get("reason", "").strip()
    match_id = payload.get("match_id")

    if not reported_username or not reason:
        return jsonify({"success": False, "message": "Username and reason are required."}), 400

    db = get_db()
    reporter_id = session["user_id"]

    reported_user = db.execute(
        "SELECT id FROM USERS WHERE username = ?", (reported_username,)
    ).fetchone()

    reported_id = reported_user["id"] if reported_user else None

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS PLAYER_REPORTS (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id INTEGER NOT NULL,
            reported_id INTEGER,
            reported_username TEXT NOT NULL,
            reason TEXT NOT NULL,
            match_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.execute(
        """
        INSERT INTO PLAYER_REPORTS (reporter_id, reported_id, reported_username, reason, match_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        (reporter_id, reported_id, reported_username, reason, match_id),
    )
    db.commit()

    return jsonify({"success": True, "message": "Report submitted. Thank you."})


# ── New: duel (DB-based match) ────────────────────────────────────────────────
@game_bp.route("/duel/start", methods=["POST"])
@login_required
def duel_start():
    payload = request.get_json(silent=True) or {}
    opponent_id = payload.get("opponent_id")
    if not opponent_id:
        return jsonify({"success": False, "message": "opponent_id required."}), 400

    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS DUELS (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER NOT NULL,
            player2_id INTEGER NOT NULL,
            player1_score INTEGER DEFAULT 0,
            player2_score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    db.execute(
        "INSERT INTO DUELS (player1_id, player2_id) VALUES (?, ?)",
        (session["user_id"], opponent_id),
    )
    db.commit()
    match_id = db.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    return jsonify({"success": True, "match_id": match_id})


# ── New: duel chat ────────────────────────────────────────────────────────────
@game_bp.route("/duel/chat/<int:match_id>", methods=["GET", "POST"])
@login_required
def duel_chat(match_id):
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS DUEL_CHAT (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        message = payload.get("message", "").strip()
        if not message:
            return jsonify({"success": False, "message": "Empty message."}), 400
        db.execute(
            "INSERT INTO DUEL_CHAT (match_id, user_id, message) VALUES (?, ?, ?)",
            (match_id, session["user_id"], message),
        )
        db.commit()
        return jsonify({"success": True})

    # GET – fetch messages
    since_id = int(request.args.get("since", 0))
    rows = db.execute(
        """
        SELECT dc.id, u.username, dc.message
        FROM DUEL_CHAT dc
        JOIN USERS u ON u.id = dc.user_id
        WHERE dc.match_id = ? AND dc.id > ?
        ORDER BY dc.id ASC
        LIMIT 50
        """,
        (match_id, since_id),
    ).fetchall()

    return jsonify({
        "success": True,
        "messages": [{"id": r["id"], "username": r["username"], "message": r["message"]} for r in rows],
    })
