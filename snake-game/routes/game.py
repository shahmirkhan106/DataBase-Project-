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

    last_game = db.execute(
        """
        SELECT id, status, current_score, updated_at
        FROM GAMES
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()

    high_score_row = db.execute(
        "SELECT COALESCE(MAX(score), 0) AS high_score FROM SCORES WHERE user_id = ?",
        (user_id,),
    ).fetchone()

    leaderboard = db.execute(
        """
        SELECT u.username, MAX(s.score) AS best_score
        FROM SCORES s
        JOIN USERS u ON u.id = s.user_id
        GROUP BY s.user_id
        ORDER BY best_score DESC
        LIMIT 10
        """
    ).fetchall()

    return render_template(
        "game/dashboard.html",
        last_game=last_game,
        high_score=high_score_row["high_score"],
        leaderboard=leaderboard,
    )


@game_bp.route("/play")
@login_required
def play():
    return render_template("game/play.html")


@game_bp.route("/new", methods=["POST"])
@login_required
def new_game():
    db = get_db()
    user_id = session["user_id"]
    now = datetime.utcnow().isoformat()

    db.execute(
        """
        INSERT INTO GAMES (user_id, status, current_score, snake_data, food_data, started_at, updated_at)
        VALUES (?, 'in_progress', 0, ?, ?, ?, ?)
        """,
        (user_id, json.dumps([]), json.dumps({}), now, now),
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

    return jsonify(
        {
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
        }
    )


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
        "INSERT INTO SCORES (user_id, game_id, score) VALUES (?, ?, ?)",
        (user_id, game_id, score),
    )
    db.commit()

    return jsonify({"success": True, "message": "Score submitted successfully."})


@game_bp.route("/leaderboard")
def leaderboard():
    db = get_db()
    rows = db.execute(
        """
        SELECT u.username, MAX(s.score) AS best_score
        FROM SCORES s
        JOIN USERS u ON u.id = s.user_id
        GROUP BY s.user_id
        ORDER BY best_score DESC
        LIMIT 10
        """
    ).fetchall()

    return render_template("game/leaderboard.html", leaderboard=rows)
