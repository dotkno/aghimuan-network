# Aghimuan Network

This is the website of **Aghimuan**, the ICT student org at PCU Dasmarinas.
You can visit it at [aghimuan.online](https://aghimuan.online).

What members can do here:

- Sign up with Google or a password, then set up a profile
- Read announcements and events posted by officers
- Comment, react, add friends, block or report users, and send DMs
- Submit projects to the Creations Hub (officers approve them first)
- Open reviewers in the Library (needs a verified PCU email)
- Play the mini games in the Games section

## How it is built

Plain PHP, a SQLite database file, and plain HTML/CSS/JS. No build tools, no
frameworks. You edit a file and refresh the page. That is the whole workflow.

| Part | What we use | What that means |
|---|---|---|
| Language | PHP 8+ | Runs as is, nothing to compile |
| Database | SQLite, one file (`data/aghimuan.db`) | No database server to maintain. The file updates its own tables when the site runs |
| Pages and design | Plain HTML, CSS, and JS | No build step before uploading |
| Login | Firebase for Google sign-in, plus normal passwords | Google checks who you are, the site handles the rest |
| Server | Pterodactyl container running nginx and PHP | The `www/` folder is what visitors see. The `data/` folder stays hidden from the web |
| HTTPS | Free certificates that renew on their own | Keeps logins secure |

## Folders

```
www/                  the actual website, what visitors see
  index.html          home page and member dashboard
  signup.php          registration, Google sign-in plus profile setup
  login.php           password login plus Google sign-in
  logout.php          ends the session
  admin.php           admin panel, has its own separate login
  api/                handles app actions: comments, DMs, friends, reactions, uploads
  includes/db.php     the one place the database gets opened, also updates tables
  includes/session.php logins, security tokens, session checks
  library/            reviewer pages, locked to PCU emails
  games/              mini games
  creations/          project showcase pages
  uploads/            member uploads like avatars (not saved in git)
data/                 stays off the public web
  library-content/    reviewer lessons (not saved in git, PCU only)
modules/              background services: web server, certificates, schedules
nginx/ php/           server settings
start-modules.sh      starts everything on the server
```

## Rules when working on this

- Actions like posting or sending messages need you to be logged in, plus a
  security token that the page gives you. No token, no action.
- That token has to be created before the page sends any HTML. Order matters,
  or logins break.
- The main site and the Library reviewers each have their own login.
  Never mix their checks.
- Answers from the server are always in the same shape: success
  (`{ ok: true, ... }`) or an error code (`{ ok: false, error }`).

## Please note

The Library reviewer lessons (`data/library-content/`) are missing from this
repo on purpose and only exist on the live server. They are only for verified
PCU emails. The code that runs them, like the gate and the quiz pages, is
still here. Just not the lesson files themselves.

If you clone this repo, expect that gap. That is normal.

## License

MIT. See `LICENSE`.
