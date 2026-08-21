Aghimuan Network
The official platform of Aghimuan — the ICT student organization ofPhilippine Christian University – Dasmariñas. A Discord-style member portalwith accounts, friend system, live notifications, a comment system withemoji reactions, an admin panel, and the Aghimuan Library interactivelearning platform for CSS students.

Live: aghimuan.online · ~149 active users · 99.9% uptime

What this repo contains
The full application source: PHP backend, JS frontend, SQLite schema, andthe Library engine. It does NOT contain:

The database file or any user data (passwords, sessions, DMs, avatars)
The Aghimuan Library module content (PCU course materials — redacted perPCU redistribution policy; only the loading engine is included)
Real credentials (includes/db.php is gitignored — see db.example.php)
Stack
Backend: PHP (session auth, CSRF tokens, SQLite via PDO)
Frontend: HTML / CSS / vanilla JS (fetch-based API)
Infra: Shared webhost (zenix.sg), Cloudflare DNS + SSL
Notable: WebSocket-style live notifications, 1,900+ emoji reaction picker
Architecture
/home/container/
├── www/ ← this repo (public-facing app)
│ ├── api/ ← JSON endpoints (comments, friends, inbox, profile…)
│ ├── includes/ ← db.php (gitignored), session, auth, automod
│ ├── library/ ← engine only; module content redacted
│ ├── games/ ← interactive CSS learning games
│ ├── admin.php ← moderator panel
│ └── schema.sql ← full DB schema (structure only)
└── data/ ← database + uploads (NOT in this repo)


---

## Setup (for reviewers / local testing)

1. Clone the repo into your PHP-capable server's web root.
2. Copy `includes/db.example.php` → `includes/db.php` and fill in your
   SQLite/MySQL credentials.
3. Import `schema.sql` and `schema-comments.sql` into your database.
4. Point your browser at `index.html`.

---

## Key subsystems

| Subsystem | What it does |
|---|---|
| Accounts | PHP session auth, bcrypt passwords, CSRF tokens, role badges |
| Social | Friend requests, live notification inbox, DMs, user profiles |
| Comments | Threaded comments + 1,900+ emoji reaction picker |
| Moderation | Admin panel, user report/block, automod |
| Library | Interactive reviewers, flashcards, a code-drill engine that
            simulates a Java compiler (content redacted, engine included) |

---

## Author

**Ahren Tangog** — President, Aghimuan (S.Y. 2026–2027) & sole developer.
[renyuzaki.me](https://renyuzaki.me) · [GitHub](https://github.com/dotkno)

---

## License

Source code is shared for portfolio review purposes. Aghimuan Library
content is © PCU-D / Aghimuan and is not included in this repository.
