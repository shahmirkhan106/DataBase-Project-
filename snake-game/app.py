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

    @app.route("/")
    def index():
        return (
            "<h2>Snake Game Backend Running</h2>"
            "<p>Visit /auth/login to start.</p>"
        )

    return app


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
