from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, session, url_for

from routes.auth import login_required


shop_bp = Blueprint("shop", __name__)


def get_db():
    return current_app.extensions["get_db"]()


def _user_total_points(user_id: int) -> int:
    db = get_db()
    row = db.execute(
        "SELECT COALESCE(SUM(score), 0) AS total_score FROM SCORES WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return row["total_score"] if row else 0


def _user_total_spent(user_id: int) -> int:
    db = get_db()
    row = db.execute(
        "SELECT COALESCE(SUM(amount_spent), 0) AS total_spent FROM TRANSACTIONS WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return row["total_spent"] if row else 0


def _user_balance(user_id: int) -> int:
    return _user_total_points(user_id) - _user_total_spent(user_id)


@shop_bp.route("/")
@login_required
def shop_home():
    db = get_db()
    items = db.execute(
        "SELECT id, item_name, description, price FROM SHOP_ITEMS WHERE is_active = 1 ORDER BY price ASC"
    ).fetchall()
    balance = _user_balance(session["user_id"])

    return render_template("shop/index.html", items=items, balance=balance)


@shop_bp.route("/buy", methods=["POST"])
@login_required
def buy_item():
    payload = request.get_json(silent=True) or request.form
    expects_json = request.is_json
    item_id = payload.get("item_id")
    try:
        quantity = int(payload.get("quantity", 1))
    except (TypeError, ValueError):
        quantity = 0

    def _error(message: str, status_code: int = 400):
        if expects_json:
            return jsonify({"success": False, "message": message}), status_code
        flash(message, "danger")
        return redirect(url_for("shop.shop_home"))

    def _success(message: str, new_balance: int):
        if expects_json:
            return jsonify({"success": True, "message": message, "new_balance": new_balance})
        flash(message, "success")
        return redirect(url_for("shop.shop_home"))

    if not item_id:
        return _error("item_id is required.")
    if quantity <= 0:
        return _error("Quantity must be at least 1.")

    db = get_db()
    user_id = session["user_id"]

    item = db.execute(
        "SELECT id, item_name, price, is_active FROM SHOP_ITEMS WHERE id = ?",
        (item_id,),
    ).fetchone()
    if not item or item["is_active"] != 1:
        return _error("Item not found.", 404)

    total_cost = item["price"] * quantity
    current_balance = _user_balance(user_id)
    if current_balance < total_cost:
        return _error("Not enough score points.")

    existing_inventory = db.execute(
        "SELECT id, quantity FROM INVENTORY WHERE user_id = ? AND item_id = ?",
        (user_id, item["id"]),
    ).fetchone()

    if existing_inventory:
        db.execute(
            "UPDATE INVENTORY SET quantity = quantity + ? WHERE id = ?",
            (quantity, existing_inventory["id"]),
        )
    else:
        db.execute(
            "INSERT INTO INVENTORY (user_id, item_id, quantity) VALUES (?, ?, ?)",
            (user_id, item["id"], quantity),
        )

    db.execute(
        """
        INSERT INTO TRANSACTIONS (user_id, item_id, amount_spent, quantity)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, item["id"], total_cost, quantity),
    )
    db.commit()

    return _success(
        f"Purchased {quantity} x {item['item_name']}.",
        _user_balance(user_id),
    )


@shop_bp.route("/inventory")
@login_required
def inventory():
    db = get_db()
    user_id = session["user_id"]

    inventory_items = db.execute(
        """
        SELECT i.item_id, s.item_name, s.description, i.quantity, i.acquired_at
        FROM INVENTORY i
        JOIN SHOP_ITEMS s ON s.id = i.item_id
        WHERE i.user_id = ?
        ORDER BY i.acquired_at DESC
        """,
        (user_id,),
    ).fetchall()

    return render_template(
        "shop/inventory.html",
        inventory_items=inventory_items,
        balance=_user_balance(user_id),
    )


@shop_bp.route("/cosmetics", methods=["GET"])
@login_required
def cosmetics():
    db = get_db()
    rows = db.execute(
        """
        SELECT s.item_name, i.quantity
        FROM INVENTORY i
        JOIN SHOP_ITEMS s ON s.id = i.item_id
        WHERE i.user_id = ?
          AND s.item_name LIKE 'Snake Color:%'
          AND i.quantity > 0
        ORDER BY s.item_name ASC
        """,
        (session["user_id"],),
    ).fetchall()

    colors = []
    for row in rows:
        color_name = row["item_name"].split(":", 1)[1].strip()
        colors.append({"name": color_name, "quantity": row["quantity"]})

    return jsonify({"success": True, "colors": colors})
