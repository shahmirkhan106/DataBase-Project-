import os


BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = ENV == "development"

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-change-this-secret-key")
    DATABASE = os.path.join(BASE_DIR, "instance", "snake_game.db")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = ENV == "production"

    # Game settings
    MAX_SCORE_PER_SESSION = 5000
    SCORE_INCREMENT = 10
    MAX_ALLOWED_MOVE_RATE = 50

    # Security settings
    PASSWORD_MIN_LENGTH = 6
    ALLOWED_ROLES = {"player", "admin"}
    ENFORCE_INTEGRITY_CHECK = ENV == "production"
