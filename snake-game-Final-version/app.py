import os
import sqlite3

import click
from flask import Flask, g

from config import Config
from integrity_check import run_integrity_check
from routes.auth import auth_bp
from routes.game import game_bp
from routes.shop import shop_bp


def create_app() -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)

    os.makedirs(app.instance_path, exist_ok=True)

    if not run_integrity_check(strict=app.config["ENFORCE_INTEGRITY_CHECK"]):
        raise RuntimeError("Integrity check failed. Application startup aborted.")

    register_database(app)
    register_blueprints(app)
    register_cli_commands(app)

    if not os.path.exists(app.config["DATABASE"]):
        with app.app_context():
            app.extensions["init_db"]()

    # Run safe schema migrations on every startup
    with app.app_context():
        _migrate_db(app)

    @app.route("/")
    def index():
        return (
            "<h2>Online Games – Backend Running</h2>"
            "<p>Visit <a href='/auth/login'>/auth/login</a> to start.</p>"
        )

    return app


def _migrate_db(app: Flask) -> None:
    """Safely add new columns and data without breaking existing data."""
    db = app.extensions["get_db"]()

    # Add game_type to SCORES if missing
    cols = [r[1] for r in db.execute("PRAGMA table_info(SCORES)").fetchall()]
    if "game_type" not in cols:
        db.execute("ALTER TABLE SCORES ADD COLUMN game_type TEXT NOT NULL DEFAULT 'snake'")

    # Add game_type to GAMES if missing
    cols = [r[1] for r in db.execute("PRAGMA table_info(GAMES)").fetchall()]
    if "game_type" not in cols:
        db.execute("ALTER TABLE GAMES ADD COLUMN game_type TEXT NOT NULL DEFAULT 'snake'")

    # Add game_type to SHOP_ITEMS if missing
    cols = [r[1] for r in db.execute("PRAGMA table_info(SHOP_ITEMS)").fetchall()]
    if "game_type" not in cols:
        db.execute("ALTER TABLE SHOP_ITEMS ADD COLUMN game_type TEXT NOT NULL DEFAULT 'snake'")

    # Update existing snake items to have correct game_type
    db.execute("UPDATE SHOP_ITEMS SET game_type = 'snake' WHERE game_type = '' OR game_type IS NULL")

    # ── Tetris shop items ────────────────────────────────────────────────────
    tetris_items = [
        ("Ghost Piece Boost", "See exactly where your piece will land for 60s.", 150, "tetris"),
        ("Slow Fall",         "Reduce piece fall speed for 30 seconds.",           180, "tetris"),
        ("Row Bomb",          "Instantly clear the bottom 2 rows.",                250, "tetris"),
        ("Score Multiplier",  "Double your points for 60 seconds.",                300, "tetris"),
    ]
    for name, desc, price, gt in tetris_items:
        db.execute(
            "INSERT OR IGNORE INTO SHOP_ITEMS (item_name, description, price, is_active, game_type) VALUES (?,?,?,1,?)",
            (name, desc, price, gt),
        )

    # ── Hangman shop items ───────────────────────────────────────────────────
    hangman_items = [
        ("Extra Life",    "Get 1 additional wrong-guess before game over.",  100, "hangman"),
        ("Hint Letter",   "Reveal one random unrevealed letter.",             150, "hangman"),
        ("Skip Word",     "Skip the current word with no score penalty.",     200, "hangman"),
        ("Double Points", "Earn 2× points for the current word.",             300, "hangman"),
    ]
    for name, desc, price, gt in hangman_items:
        db.execute(
            "INSERT OR IGNORE INTO SHOP_ITEMS (item_name, description, price, is_active, game_type) VALUES (?,?,?,1,?)",
            (name, desc, price, gt),
        )

    db.commit()


def register_database(app: Flask) -> None:
    def get_db() -> sqlite3.Connection:
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"])
            g.db.row_factory = sqlite3.Row
        return g.db

    def close_db(_error=None) -> None:
        db = g.pop("db", None)
        if db is not None:
            db.close()

    def init_db() -> None:
        db = get_db()
        with app.open_resource("schema.sql") as schema_file:
            db.executescript(schema_file.read().decode("utf-8"))
        db.commit()

    app.teardown_appcontext(close_db)
    app.extensions["get_db"] = get_db
    app.extensions["init_db"] = init_db


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(game_bp, url_prefix="/game")
    app.register_blueprint(shop_bp, url_prefix="/shop")


def register_cli_commands(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db_command() -> None:
        app.extensions["init_db"]()
        click.echo("Database initialized.")


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
