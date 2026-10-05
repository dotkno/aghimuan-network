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
$_SESSION['login_attempts'] ??= 0;
$_SESSION['login_locked_until'] ??= 0;
$error = '';
$oldUsername = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $oldUsername = trim((string)($_POST['username'] ?? ''));
    if (time() < (int)$_SESSION['login_locked_until']) {
        $error = 'Too many failed attempts. Try again in a minute.';
    } else {
        $s = $pdo->prepare('SELECT * FROM users WHERE username_lower=:u');
        $s->execute([':u' => mb_strtolower($oldUsername)]);
        $u = $s->fetch();
        if ($u && $u['is_banned']) {
            $error = 'This account has been suspended.';
        } elseif ($u && $u['password_hash'] === '') {
            $error = 'This account uses Google sign-in.';
        } elseif ($u && password_verify((string)($_POST['password'] ?? ''), $u['password_hash'])) {
            $_SESSION['login_attempts'] = 0;
            login_user($pdo, (int)$u['id']);
            header('Location: /index.html');
            exit;
        } else {
            if (++$_SESSION['login_attempts'] >= 5) {
                $_SESSION['login_locked_until'] = time() + 60;
                $_SESSION['login_attempts'] = 0;
            }
            $error = 'Incorrect username or password.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Log in — Aghimuan Network</title>
  <meta name="description" content="Log in to Aghimuan Network with Google or your password to reach projects, reviewers, and the PCU-D ICT community.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Aghimuan">
  <meta property="og:title" content="Log in — Aghimuan Network">
  <meta property="og:description" content="Log in to Aghimuan Network with Google or your password to reach projects, reviewers, and the PCU-D ICT community.">
  <meta property="og:url" content="https://aghimuan.online/login.php">
  <meta property="og:image" content="https://aghimuan.online/og-banner.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Log in — Aghimuan Network">
  <meta name="twitter:description" content="Log in to Aghimuan Network with Google or your password to reach projects, reviewers, and the PCU-D ICT community.">
  <meta name="twitter:image" content="https://aghimuan.online/og-banner.png">
  <link rel="canonical" href="https://aghimuan.online/login.php">
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
        radial-gradient(circle at 15% 20%, rgba(48, 150, 199, 0.15) 0%, transparent 45%),
        radial-gradient(circle at 85% 80%, rgba(3, 3, 126, 0.25) 0%, transparent 50%);
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
      max-width: 420px;
      padding: 40px 36px;
      border-radius: 18px;
      background: var(--glass-card);
      backdrop-filter: blur(20px) saturate(140%);
      border: 1px solid var(--glass-border);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    }

    .auth-card h1 {
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

    .divider {
      display: flex;
      align-items: center;
      gap: 14px;
      color: var(--steel);
      font-size: 11px;
      font-family: var(--font-mono);
      letter-spacing: 0.05em;
      margin: 24px 0;
      text-transform: uppercase;
    }

    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--glass-border);
    }

    .field-group {
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--silver);
      margin-bottom: 8px;
    }

    input {
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

    input:focus {
      border-color: var(--cyan);
      box-shadow: 0 0 12px rgba(85, 241, 248, 0.25);
    }

    .btn-submit {
      width: 100%;
      height: 48px;
      margin-top: 10px;
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

    .error {
      padding: 12px 14px;
      border-radius: 8px;
      background: rgba(220, 38, 38, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      font-size: 13px;
      margin-bottom: 20px;
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
    <span class="mobile-tag">PCU-D ICT</span>
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
          <span>MEMBER PORTAL</span>
        </div>
        <div class="hero-heading">Welcome back to the <span class="accent">network</span>.</div>
        <p class="hero-subtext">Access your account to engage with projects, reviewers, and ICT community activities at PCU-D.</p>

        <div class="tech-card-grid">
          <div class="tech-card">
            <div class="tech-card-code">01 // TRACK</div>
            <div class="tech-card-label">Robotics</div>
          </div>
          <div class="tech-card">
            <div class="tech-card-code">02 // TRACK</div>
            <div class="tech-card-label">Programming</div>
          </div>
          <div class="tech-card">
            <div class="tech-card-code">03 // TRACK</div>
            <div class="tech-card-label">Systems</div>
          </div>
        </div>
      </div>

      <div class="brand-footer">
        © AGHIMUAN NETWORK - CONNECT INNOVATE EXPLORE
        <span class="brand-sub">© 2025–2026 <a href="https://renyuzaki.me" target="_blank" rel="noopener">renyuzaki</a> · All rights reserved.</span>
      </div>
    </section>

    <section class="form-pane">
      <div class="auth-card">
        <h1>Log in</h1>
        <p>Continue with Google or enter your credentials.</p>

        <?php if ($error): ?>
          <div class="error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <button type="button" class="btn-google" id="google">
          <span class="g-icon">G</span>
          <span>Continue with Google</span>
        </button>

        <div class="js-error error" id="googleError" style="display:none; margin-top:16px;"></div>

        <div class="divider">or login with password</div>

        <form method="post">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">

          <div class="field-group">
            <label>Username</label>
            <input type="text" name="username" value="<?= htmlspecialchars($oldUsername) ?>" required autocomplete="username">
          </div>

          <div class="field-group">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="current-password">
          </div>

          <button type="submit" class="btn-submit">Sign In</button>
        </form>

        <p class="foot-note">
          New here? <a href="/signup.php">Create an account</a>
        </p>
      </div>
    </section>
  </main>

  <script type="module">
    const e = document.querySelector('#googleError'),
          b = document.querySelector('#google'),
          csrf = <?= json_encode(csrf_token()) ?>;

    b.onclick = async () => {
      b.disabled = true;
      e.style.display = 'none';
      try {
        const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
        ]);
        const a = getApps().length ? getApps()[0] : initializeApp((window.AGHI_CONFIG && window.AGHI_CONFIG.firebase) || <?php echo json_encode(aghi_firebase_config(), JSON_UNESCAPED_SLASHES); ?>);
        const r = await signInWithPopup(getAuth(a), new GoogleAuthProvider());
        const x = await fetch('/api/auth-google.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: await r.user.getIdToken(), csrf_token: csrf })
        });
        const d = await x.json();
        if (d.ok && d.status === 'logged_in') location = '/index.html';
        else if (d.ok) location = '/signup.php';
        else throw Error(d.error || 'Google sign-in failed.');
      } catch (x) {
        e.textContent = x.message || 'Google sign-in failed.';
        e.style.display = 'block';
      } finally {
        b.disabled = false;
      }
    };
  </script>
</body>
</html>