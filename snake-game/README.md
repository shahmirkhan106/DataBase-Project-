# Snake Game (Flask + SQLite + Canvas)

Web-based Snake Game with authentication, score tracking, shop/inventory, admin dashboard, leaderboard, and file-integrity anti-cheat checks.

## Tech Stack

- Backend: `Python`, `Flask`
- Database: `SQLite`
- Frontend: `HTML`, `CSS`, `JavaScript` (Canvas rendering)

## Features

- User registration/login with hashed passwords (`werkzeug.security`)
- Start new game, save game, load saved game
- Score tracking and personal high score
- Top 10 leaderboard
- Shop purchases using score points as currency
- Inventory management
- User roles (`player`, `admin`)
- Admin dashboard for users and top scores
- Anti-cheat:
  - Server-side score validation
  - File integrity check with SHA-256 hashes

## Project Structure

```text
snake-game/
├── app.py
├── config.py
├── schema.sql
├── integrity_check.py
├── generate_hashes.py
├── file_hashes.json                # generated after setup
├── routes/
│   ├── __init__.py
│   ├── auth.py
│   ├── game.py
│   └── shop.py
├── templates/
│   ├── base.html
│   ├── auth/
│   │   ├── login.html
│   │   └── register.html
│   ├── game/
│   │   ├── dashboard.html
│   │   ├── play.html
│   │   └── leaderboard.html
│   ├── admin/
│   │   └── dashboard.html
│   └── shop/
│       ├── index.html
│       └── inventory.html
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── snake.js
└── instance/
    └── snake_game.db               # auto-created
```

## Setup (Windows / PowerShell)

1) Open terminal in project folder:

```powershell
cd C:\Users\ok\Desktop\snake-game
```

2) Create and activate virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3) Install dependencies:

```powershell
pip install flask werkzeug click
```

## First-Time Initialization

1) Generate hash manifest (required by integrity check):

```powershell
python generate_hashes.py
```

2) Initialize database manually (optional because app auto-initializes if DB is missing):

```powershell
flask --app app init-db
```

## Run the App

```powershell
flask --app app run
```

Open in browser:

- [http://127.0.0.1:5000](http://127.0.0.1:5000)
- Login page: [http://127.0.0.1:5000/auth/login](http://127.0.0.1:5000/auth/login)

## Admin Access

The registration flow creates `player` users by default.

To promote a user to admin, update DB manually:

```sql
UPDATE USERS SET role = 'admin' WHERE username = 'your_username';
```

Then access:

- [http://127.0.0.1:5000/auth/admin](http://127.0.0.1:5000/auth/admin)

## Anti-Cheat Notes

- `generate_hashes.py` creates `file_hashes.json` once after setup
- `integrity_check.py` runs on Flask startup
- If protected files are modified and hashes mismatch, startup is blocked

When you intentionally change code, regenerate hashes:

```powershell
python generate_hashes.py
```

## Common Commands

```powershell
# Activate environment
.\.venv\Scripts\Activate.ps1

# Regenerate integrity hashes after code changes
python generate_hashes.py

# Rebuild database from schema
flask --app app init-db

# Start server
flask --app app run
```
