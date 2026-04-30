PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS USERS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS GAMES (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    current_score INTEGER NOT NULL DEFAULT 0 CHECK (current_score >= 0),
    snake_data TEXT,
    food_data TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SCORES (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_id INTEGER,
    score INTEGER NOT NULL CHECK (score >= 0),
    achieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES GAMES(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS SHOP_ITEMS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL UNIQUE,
    description TEXT,
    price INTEGER NOT NULL CHECK (price >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS INVENTORY (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES SHOP_ITEMS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS TRANSACTIONS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    amount_spent INTEGER NOT NULL CHECK (amount_spent >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    transaction_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES SHOP_ITEMS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS GAME_ITEMS (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES GAMES(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES SHOP_ITEMS(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO SHOP_ITEMS (id, item_name, description, price, is_active) VALUES
(1, 'Speed Boost', 'Temporarily increases snake speed.', 150, 1),
(2, 'Shield', 'Protects from one collision.', 250, 1),
(3, 'Double Points', 'Doubles points for a short duration.', 300, 1);

INSERT OR IGNORE INTO SHOP_ITEMS (item_name, description, price, is_active) VALUES
('Magnet Food', 'Improves food spawn visibility for easier routing.', 180, 1),
('Neon Trail', 'Adds a glowing trail effect to your snake.', 220, 1),
('Slow Time', 'Slightly reduces snake speed for control-heavy rounds.', 260, 1),
('Lucky Apple', 'Increases chance of cleaner food spawns.', 320, 1),
('Snake Color: Emerald', 'Unlock emerald snake skin.', 120, 1),
('Snake Color: Sapphire', 'Unlock sapphire snake skin.', 120, 1),
('Snake Color: Sunset', 'Unlock sunset snake skin.', 140, 1),
('Snake Color: Neon Pink', 'Unlock neon pink snake skin.', 160, 1),
('Snake Color: Arctic', 'Unlock arctic snake skin.', 160, 1);
