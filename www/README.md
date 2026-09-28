# Aghimuan Website — Admin Notes

This file is for whoever maintains the site. It isn't linked from any page —
visitors won't stumble onto it by browsing normally.

**Heads up:** this still sits inside the public `www` folder, so if someone
knows (or guesses) the exact URL — `yoursite.com/README.md` — and your host
doesn't block `.md` files, they could open it directly and read it. It's
"hidden" in the sense of "not linked anywhere," not in the sense of
"password protected." If that matters to you, ask your host how to block
`.md` files from being served, or keep this file off the server entirely and
just reference your own local copy instead.

---

## Directory structure

```
/home/container/www/
├── index.html
├── about.html          ← Vision / Mission / Membership + officer roster
├── faq.html
├── reviewers.html
├── 404.html             ← themed error page (needs server config, see below)
├── styles.css
├── favicon-32.png / favicon-16.png / favicon.ico / apple-touch-icon.png / logo.png
├── og-banner.png        ← social preview image (Open Graph / Twitter cards)
├── officerpics/         ← officer & adviser photos go here
└── games/
    ├── index.html
    ├── game1.html       ← wrapper page, iframes in aghiclaw.html
    ├── game2.html
    └── aghiclaw.html    ← the claw machine game itself
```

---

## Editing the FAQ

Open `faq.html`, find the `FAQ_DATA` array near the bottom (inside the
`<script>` tag). Each entry is:

```js
{ q: "Question text", a: "Answer text" }
```

Add, remove, or edit entries directly — the page rebuilds the accordion from
this array automatically. No other file needs to change.

---

## Editing the Reviewers library

Open `reviewers.html`, find the `REVIEWER_DATA` array. Each entry is:

```js
{
  category: "Programming",   // shows as both the filter button and the card tag
  title: "Reviewer title",
  description: "One or two sentences on what it covers.",
  href: "#"                  // link to the actual file/download
}
```

The filter buttons at the top of the page are generated automatically from
whatever categories appear in this array — so introducing a new category
name (e.g. "Web Development") just works, no extra code needed.

**Keep every entry ICT-related** (Programming, System Servicing, Robotics,
Networking, or similar) — that's the one hard rule for this page.

`href` currently points to `#` placeholders. Point these at real files once
you have them — either upload the files into `www` somewhere (e.g. a
`files/` folder) and link relatively, or link out to Google Drive / another
host.

---

## Editing the officer & adviser roster

Open `about.html`, find the `OFFICER_DATA` array. Each entry is:

```js
{
  id: "pres",                 // must match a filename in officerpics/, e.g. pres.jpg
  name: "Full Name",
  position: "President",
  tier: "holo",                // "holo" | "rare" | "common" — controls the card frame, see below
  meta: [
    { label: "Strand", value: "..." },
    { label: "Section", value: "..." }
  ]
}
```

- `tier` is purely visual, based on how the club's rank structure was set up:
  - `holo` — Adviser, President (glowing shimmer frame)
  - `rare` — Vice President, Secretary, Treasurer, Auditor, PIO/PRO (glowing frame, no shimmer)
  - `common` — Sgt. at Arms, Media Team (standard frame)
- `meta` accepts 1–2 stat rows. The Adviser entry uses a single `Role` row
  instead of Strand/Section since they're faculty, not a student — follow
  that pattern for any non-student entry.
- The roster's order in the array is its display order in the carousel.
- Names currently say `"TBA"` as placeholders — replace with real names
  whenever you have them. Nothing else needs to change.

### Adding officer photos

Drop a photo into `officerpics/` named exactly `<id>.jpg` — e.g. `pres.jpg`,
`vp.jpg`, `sgt1.jpg`. Portrait orientation works best (cards are ~5:7).
There's a quick filename cheat-sheet already sitting in that folder
(`officerpics/NAMING.txt`).

If a photo is missing, the card just shows the person's initials instead —
nothing breaks, so you can fill photos in gradually.

---

## Favicon / logo files

`favicon-32.png`, `favicon-16.png`, `favicon.ico`, and `apple-touch-icon.png`
are all generated from `logo.png` (your club logo, which is transparent).
If you ever swap the logo:

1. Replace `logo.png` with the new full-resolution version.
2. Re-generate `favicon-32.png`, `favicon-16.png`, `favicon.ico`, and
   `apple-touch-icon.png` from it — don't just rename the new logo directly
   into those filenames. Ask for help regenerating them if needed.
3. Note: `apple-touch-icon.png` is the one exception that is **not**
   transparent — iOS fills transparent pixels with black on home-screen
   icons, so that file has the logo composited onto an opaque navy
   background instead. Any regeneration should keep doing that for that
   one file specifically.

---

## Social preview (Open Graph) tags

Every page has `og:` and `twitter:` meta tags in its `<head>` — these
control what shows up when someone shares a link to the site on Facebook,
Messenger, Discord, etc. `og:image` on every page points at
`og-banner.png` (1200×630, the standard recommended size), cropped and
resized from the original club banner artwork to fit that shape.

**To swap in a different banner later:** save the new image (ideally close
to a 1200×630 / ~1.9:1 landscape shape already, so nothing important gets
cropped) as `og-banner.png` in the root of `www`, replacing the old one.
The filename is the same across every page's `og:image`/`twitter:image`
tags, so as long as the new file keeps that same name, nothing else needs
to change. If the new artwork is a very different shape (e.g. more square
or portrait), ask for help re-cropping it to fit 1200×630 before dropping
it in, or the preview may look oddly zoomed/cut off on some platforms.

---

## Facebook link in the footer

Every page's footer links to the club Facebook page. The visible link text
just says "Facebook" (with a small icon) rather than the full URL, since
the actual page URL is long — the link still points to the real address
underneath, it's just not spelled out on screen.

---

## The 404 page

`404.html` is a themed "page not found" page matching the rest of the
site. **A static file alone doesn't automatically become your error
page** — most web servers need to be told to serve it when a route
doesn't match anything. If 404s currently show your host's default error
page instead of this one, check your Pterodactyl egg's web server config
(commonly an `error_page 404 /404.html;` line for nginx, or an equivalent
setting for whatever's serving these files) — ask your host or hosting
panel's support if you're not sure where that's configured.

---

## The claw machine game

`games/aghiclaw.html` is a fully standalone build (its own CSS/JS via CDN
scripts) — it isn't meant to be edited to match the rest of the site.
`games/game1.html` just wraps it in an `<iframe>` so it can sit inside the
site's nav/footer without style conflicts. If the claw game ever gets
updated, just replace `games/aghiclaw.html` with the new version — nothing
else needs to change, as long as the filename stays the same.
