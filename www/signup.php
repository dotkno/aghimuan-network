<?php
declare(strict_types=1);
require_once __DIR__.'/includes/db.php';
require_once __DIR__.'/includes/session.php';

$pdo = get_db();
if (current_user($pdo)) {
    header('Location: /index.html');
    exit;
}
start_secure_session();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign up — Aghimuan Network</title>
  <meta name="description" content="Create your Aghimuan Network account with Google and join the PCU-D ICT student community.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Aghimuan">
  <meta property="og:title" content="Sign up — Aghimuan Network">
  <meta property="og:description" content="Create your Aghimuan Network account with Google and join the PCU-D ICT student community.">
  <meta property="og:url" content="https://aghimuan.online/signup.php">
  <meta property="og:image" content="https://aghimuan.online/og-banner.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Sign up — Aghimuan Network">
  <meta name="twitter:description" content="Create your Aghimuan Network account with Google and join the PCU-D ICT student community.">
  <meta name="twitter:image" content="https://aghimuan.online/og-banner.png">
  <link rel="canonical" href="https://aghimuan.online/signup.php">
  <link rel="describedby" href="https://aghimuan.online/llms.txt">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="shortcut icon" href="favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --navy: #03037E;
      --royal: #2B438E;
      --tech: #3096C7;
      --cyan: #55F1F8;
      --silver: #AEB7C0;
      --steel: #767CA1;
      --white: #F1F2F5;
      --charcoal: #15161C;
      --bg-dark: #050811;
      --glass-bg: rgba(255, 255, 255, 0.03);
      --glass-card: rgba(14, 20, 32, 0.68);
      --glass-border: rgba(255, 255, 255, 0.09);
      --glass-border-glow: rgba(85, 241, 248, 0.35);
      --font-display: 'Space Grotesk', sans-serif;
      --font-body: 'Inter', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(circle at 85% 20%, rgba(48, 150, 199, 0.15) 0%, transparent 45%),
        radial-gradient(circle at 15% 80%, rgba(3, 3, 126, 0.25) 0%, transparent 50%);
      color: var(--white);
      font-family: var(--font-body);
      overflow-x: hidden;
    }

    .desktop-layout {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      min-height: 100vh;
      width: 100%;
    }

    .brand-pane {
      position: relative;
      padding: clamp(36px, 5vw, 72px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-right: 1px solid var(--glass-border);
      overflow: hidden;
      background: linear-gradient(135deg, rgba(3, 3, 126, 0.18) 0%, rgba(5, 8, 17, 0.85) 100%);
    }

    .cyber-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(85, 241, 248, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(85, 241, 248, 0.04) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .brand-header {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--white);
    }

    .brand-logo-img {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      filter: drop-shadow(0 2px 10px rgba(85, 241, 248, 0.25));
    }

    .brand-title-group strong {
      font-family: var(--font-display);
      font-size: 15px;
      letter-spacing: 0.08em;
      display: block;
      color: var(--white);
    }

    .brand-title-group small {
      font-size: 11px;
      color: var(--steel);
      letter-spacing: 0.02em;
    }

    .brand-hero {
      position: relative;
      z-index: 2;
      margin: auto 0;
      max-width: 520px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 20px;
      background: rgba(85, 241, 248, 0.06);
      border: 1px solid rgba(85, 241, 248, 0.2);
      color: var(--cyan);
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      margin-bottom: 24px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cyan);
      box-shadow: 0 0 8px var(--cyan);
    }

    .hero-heading {
      font-family: var(--font-display);
      font-size: clamp(32px, 3.8vw, 48px);
      line-height: 1.1;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 16px;
    }

    .hero-heading .accent {
      color: var(--cyan);
      text-shadow: 0 0 20px rgba(85, 241, 248, 0.3);
    }

    .hero-subtext {
      color: var(--silver);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .tech-card-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .tech-card {
      padding: 16px 14px;
      border-radius: 12px;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      transition: border-color 0.2s ease;
    }

    .tech-card:hover {
      border-color: var(--glass-border-glow);
    }

    .tech-card-code {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--cyan);
      margin-bottom: 6px;
    }

    .tech-card-label {
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 600;
      color: var(--white);
    }

    .brand-footer {
      position: relative;
      z-index: 2;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--steel);
      letter-spacing: 0.05em;
    }
    .brand-footer .brand-sub {
      display: block;
      margin-top: 4px;
      opacity: 0.75;
    }
    .brand-footer a {
      color: inherit;
    }

    .form-pane {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 36px clamp(20px, 4vw, 48px);
      position: relative;
    }

    .auth-card {
      width: 100%;
      max-width: 440px;
      padding: 40px 36px;
      border-radius: 18px;
      background: var(--glass-card);
      backdrop-filter: blur(20px) saturate(140%);
      border: 1px solid var(--glass-border);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    }

    .auth-card h1, .auth-card .auth-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 700;
      color: var(--white);
      margin-bottom: 8px;
    }

    .auth-card p {
      color: var(--silver);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 28px;
    }

    .btn-google {
      width: 100%;
      height: 48px;
      border-radius: 10px;
      border: 1px solid var(--glass-border);
      background: rgba(255, 255, 255, 0.06);
      color: var(--white);
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-google:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .g-icon {
      font-weight: 700;
      color: #4285F4;
      font-size: 18px;
    }

    .field-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--silver);
      margin-bottom: 6px;
    }

    input, select {
      width: 100%;
      height: 46px;
      border-radius: 9px;
      border: 1px solid var(--glass-border);
      background: rgba(5, 9, 18, 0.6);
      padding: 0 14px;
      font-family: var(--font-body);
      font-size: 14px;
      color: var(--white);
      outline: none;
      transition: all 0.2s ease;
    }

    select option {
      background: #0d1527;
      color: var(--white);
    }

    input:focus, select:focus {
      border-color: var(--cyan);
      box-shadow: 0 0 12px rgba(85, 241, 248, 0.25);
    }

    .btn-submit {
      width: 100%;
      height: 48px;
      margin-top: 12px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, var(--tech) 0%, var(--royal) 100%);
      color: var(--white);
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(48, 150, 199, 0.3);
      transition: all 0.2s ease;
    }

    .btn-submit:hover {
      opacity: 0.92;
      box-shadow: 0 6px 20px rgba(85, 241, 248, 0.4);
    }

    .setup, .error {
      display: none;
    }

    .error {
      padding: 12px 14px;
      border-radius: 8px;
      background: rgba(220, 38, 38, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      font-size: 13px;
      margin-top: 16px;
    }

    .foot-note {
      margin-top: 24px;
      text-align: center;
      font-size: 13px;
      color: var(--silver);
    }

    .foot-note a {
      color: var(--cyan);
      text-decoration: none;
      font-weight: 600;
    }

    .foot-note a:hover {
      text-decoration: underline;
    }

    .mobile-header {
      display: none;
    }

    @media (max-width: 820px) {
      .desktop-layout {
        display: block;
        min-height: 100vh;
      }

      .brand-pane {
        display: none;
      }

      .mobile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--glass-border);
        background: rgba(6, 9, 19, 0.8);
        backdrop-filter: blur(12px);
      }

      .mobile-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--white);
      }

      .mobile-brand img {
        width: 32px;
        height: 32px;
      }

      .mobile-brand span {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.05em;
      }

      .mobile-tag {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--cyan);
        padding: 4px 8px;
        border-radius: 6px;
        background: rgba(85, 241, 248, 0.08);
        border: 1px solid rgba(85, 241, 248, 0.2);
      }

      .form-pane {
        padding: 32px 18px 48px;
        min-height: calc(100vh - 73px);
      }

      .auth-card {
        padding: 28px 22px;
        border-radius: 16px;
      }

      .auth-card h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>

  <header class="mobile-header">
    <a href="/index.html" class="mobile-brand">
      <img src="CLUB LOGO.png" alt="Aghimuan Logo">
      <span>AGHIMUAN.ONLINE</span>
    </a>
    <span class="mobile-tag">JOIN NETWORK</span>
  </header>

  <main class="desktop-layout">
    <section class="brand-pane">
      <div class="cyber-grid"></div>

      <a href="/index.html" class="brand-header">
        <img class="brand-logo-img" src="CLUB LOGO.png" alt="Aghimuan Logo">
        <div class="brand-title-group">
          <strong>AGHIMUAN.ONLINE</strong>
          <small>Philippine Christian University — Dasmariñas</small>
        </div>
      </a>

      <div class="brand-hero">
        <div class="status-pill">
          <span class="status-dot"></span>
          <span>ONBOARDING</span>
        </div>
        <div class="hero-heading">Build with your <span class="accent">community</span>.</div>
        <p class="hero-subtext">Join PCU-Dasmariñas' official ICT student organization. Connect with fellow robotics, programming, and system servicing enthusiasts.</p>

        <div class="tech-card-grid">
          <div class="tech-card">
            <div class="tech-card-code">01 // COMMUNITY</div>
            <div class="tech-card-label">Collaborate</div>
          </div>
          <div class="tech-card">
            <div class="tech-card-code">02 // ACADEMIC</div>
            <div class="tech-card-label">Reviewers</div>
          </div>
          <div class="tech-card">
            <div class="tech-card-code">03 // PROJECTS</div>
            <div class="tech-card-label">Creations</div>
          </div>
        </div>
      </div>

      <div class="brand-footer">
        © AGHIMUAN NETWORK · CONNECT INNOVATE EXPLORE
        <span class="brand-sub">© 2025–2026 <a href="https://renyuzaki.me" target="_blank" rel="noopener">renyuzaki</a> · All rights reserved.</span>
      </div>
    </section>

    <section class="form-pane">
      <div class="auth-card">
        
        <div id="start">
          <h1>Create account</h1>
          <p>Start with the Google account you want to use on Aghimuan.</p>

          <button type="button" class="btn-google" id="google">
            <span class="g-icon">G</span>
            <span>Continue with Google</span>
          </button>

          <div class="error" id="ge"></div>

          <p class="foot-note">
            Already a member? <a href="/login.php">Log in</a>
          </p>
        </div>

        <div class="setup" id="setup">
          <div class="auth-title">Profile details</div>
          <p id="email" style="font-family:var(--font-mono); font-size:12px; color:var(--cyan); margin-bottom:20px; word-break:break-all;"></p>

          <form id="finish">
            <div class="field-group">
              <label>Username</label>
              <input id="username" required maxlength="20" pattern="[A-Za-z0-9_]{3,20}">
            </div>

            <div class="field-group">
              <label>Grade Level</label>
              <select id="grade">
                <option value="">Prefer not to say</option>
                <option>G12</option>
                <option>G11</option>
                <option>JHS</option>
              </select>
            </div>

            <div class="field-group">
              <label>Strand / Track</label>
              <select id="strand">
                <option value="">Prefer not to say</option>
                <option>STEM</option>
                <option>ABM/BE</option>
                <option>HUMSS/ASSH</option>
                <option>HE/HT</option>
                <option>ICT/ICT Professionals</option>
                <option>SPORTS</option>
              </select>
            </div>

            <div class="field-group">
              <label>Club / Affiliation</label>
              <select id="club">
                <option value="">No club selected</option>
                <option>Dagitab</option>
                <option>EBDA</option>
                <option>Hiraya</option>
                <option>Lyrico</option>
                <option>Marahuyo</option>
                <option>Padayon</option>
                <option>Pahina</option>
                <option>Paraluman</option>
                <option>PFG</option>
                <option>Sibol</option>
                <option>RISE</option>
                <option>Dalumat</option>
                <option>Numero</option>
                <option>Kalakbay</option>
                <option>Le Verrier</option>
                <option>Nexus</option>
                <option>Aghimuan</option>
                <option>Skill Speak</option>
              </select>
            </div>

            <button type="submit" class="btn-submit">Finish Setup</button>
            <div class="error" id="fe"></div>
          </form>
        </div>

      </div>
    </section>
  </main>

  <script type="module">
    const c = <?= json_encode(csrf_token()) ?>,
          q = s => document.querySelector(s);

    q('#google').onclick = async () => {
      try {
        const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
        ]);
        const a = getApps().length ? getApps()[0] : initializeApp((window.AGHI_CONFIG && window.AGHI_CONFIG.firebase) || <?php echo json_encode(aghi_firebase_config(), JSON_UNESCAPED_SLASHES); ?>);
        const r = await signInWithPopup(getAuth(a), new GoogleAuthProvider());
        const d = await (await fetch('/api/auth-google.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: await r.user.getIdToken(), csrf_token: c })
        })).json();

        if (d.status === 'logged_in') location = '/index.html';
        else if (d.ok) {
          q('#start').style.display = 'none';
          q('#setup').style.display = 'block';
          q('#username').value = d.suggestedUsername;
          q('#email').textContent = d.email;
        } else throw Error(d.error);
      } catch (x) {
        q('#ge').textContent = x.message;
        q('#ge').style.display = 'block';
      }
    };

    q('#finish').onsubmit = async e => {
      e.preventDefault();
      const d = await (await fetch('/api/finish-signup.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csrf_token: c,
          username: q('#username').value,
          grade: q('#grade').value,
          strand: q('#strand').value,
          club: q('#club').value
        })
      })).json();

      if (d.ok) location = '/index.html';
      else {
        q('#fe').textContent = d.error;
        q('#fe').style.display = 'block';
      }
    };
  </script>
</body>
</html>