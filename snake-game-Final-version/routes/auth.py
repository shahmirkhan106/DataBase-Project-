from functools import wraps

from flask import Blueprint, current_app, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


auth_bp = Blueprint("auth", __name__)


def get_db():
    return current_app.extensions["get_db"]()


def login_required(view_func):
    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            flash("Please login first.", "warning")
            return redirect(url_for("auth.login"))
        return view_func(*args, **kwargs)

    return wrapped_view


def admin_required(view_func):
    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        if session.get("role") != "admin":
            flash("Admin access required.", "danger")
            return redirect(url_for("game.lobby"))

        return view_func(*args, **kwargs)

    return wrapped_view


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not username or not email or not password:
            flash("All fields are required.", "danger")
            return render_template("auth/register.html")

        if len(password) < current_app.config["PASSWORD_MIN_LENGTH"]:
            flash("Password is too short.", "danger")
            return render_template("auth/register.html")

        db = get_db()
        existing_user = db.execute(
            "SELECT id FROM USERS WHERE username = ? OR email = ?",
            (username, email),
        ).fetchone()

        if existing_user:
            flash("Username or email already exists.", "danger")
            return render_template("auth/register.html")

        db.execute(
            """
            INSERT INTO USERS (username, email, password_hash, role)
            VALUES (?, ?, ?, 'player')
            """,
            (username, email, generate_password_hash(password)),
        )
        db.commit()

        flash("Registration successful. Please login.", "success")
        return redirect(url_for("auth.login"))

    return render_template("auth/register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        db = get_db()
        user = db.execute(
            "SELECT id, username, password_hash, role FROM USERS WHERE username = ?",
            (username,),
        ).fetchone()

        if user is None or not check_password_hash(user["password_hash"], password):
            flash("Invalid username or password.", "danger")
            return render_template("auth/login.html")

        session.clear()
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["role"] = user["role"]

        flash("Logged in successfully.", "success")
        return redirect(url_for("game.lobby"))


    return render_template("auth/login.html")


@auth_bp.route("/logout")
@login_required
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("auth.login"))


@auth_bp.route("/admin")
@login_required
@admin_required
def admin_dashboard():
    db = get_db()
    users = db.execute(
        "SELECT id, username, email, role, created_at FROM USERS ORDER BY created_at DESC"
    ).fetchall()

    top_scores = db.execute(
        """
        SELECT u.username, MAX(s.score) AS best_score
        FROM SCORES s
        JOIN USERS u ON u.id = s.user_id
        GROUP BY s.user_id
        ORDER BY best_score DESC
        LIMIT 10
        """
    ).fetchall()

    return render_template("admin/dashboard.html", users=users, top_scores=top_scores)
