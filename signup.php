<?php
declare(strict_types=1);

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/session.php';

$pdo = get_db();
if (current_user($pdo)) {
    header('Location: /index.html');
    exit;
}

// Best-effort real client IP. If this host sits behind a reverse proxy
// (Cloudflare, nginx, etc.) that isn't setting one of these headers,
// REMOTE_ADDR will just be the proxy's own IP — worth checking against
// the actual hosting setup if IP bans don't seem to be taking effect.
function get_signup_client_ip(): string {
    $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
    foreach ($keys as $key) {
        if (!empty($_SERVER[$key])) {
            $ip = trim(explode(',', $_SERVER[$key])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

$clientIp = get_signup_client_ip();

$banCheck = $pdo->prepare('SELECT 1 FROM banned_ips WHERE ip_address = :ip');
$banCheck->execute([':ip' => $clientIp]);
if ($banCheck->fetch()) {
    http_response_code(403);
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign Up — Aghimuan</title>
    <link rel="stylesheet" href="styles.css?v=4">
    <style>
      body { background: radial-gradient(circle at 50% 0%, #0d1b26 0%, #060b10 70%); font-family: 'Rajdhani', sans-serif; color: #F1F2F5; min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; padding: 1.5rem 1rem; }
      .blocked-box { max-width: 420px; text-align: center; padding: 2rem; background: rgba(15, 25, 35, 0.75); border: 1px solid rgba(217, 85, 85, 0.35); border-radius: 12px; }
      .blocked-box h1 { font-size: 1.2rem; color: #ff8b8b; margin: 0 0 0.75rem; }
      .blocked-box p { font-size: 0.9rem; color: #8ab4c4; margin: 0; }
      .blocked-box a { color: #55F1F8; }
    </style>
    </head>
    <body>
      <div class="blocked-box">
        <h1>Sign-up unavailable</h1>
        <p>New accounts can't be created from this network right now. If you think this is a mistake, please reach out to Aghimuan's officers.</p>
      </div>
    </body>
    </html>
    <?php
    exit;
}

start_secure_session();

const PRESET_AVATARS = [
    'default'      => '#5F5E5A',
    'circuit-blue' => '#185FA5',
    'circuit-cyan' => '#0F6E56',
    'node-teal'    => '#04342C',
    'spark-orange' => '#993C1D',
    'wire-purple'  => '#534AB7',
    'chip-green'   => '#3B6D11',
    'signal-pink'  => '#993556',
];

const CLUBS = [
    'Non-academic' => [
        'Dagitab', 'EBDA', 'Hiraya', 'Lyrico', 'Marahuyo',
        'Padayon', 'Pahina', 'Paraluman', 'PFG'
    ],
    'Academic' => [
        'Sibol', 'RISE', 'Dalumat', 'Numero', 'Kalakbay',
        'Le Verrier', 'Nexus', 'Aghimuan', 'Skill Speak'
    ]
];

const GRADES = ['G12', 'G11', 'JHS'];
const STRANDS = ['STEM', 'ABM/BE', 'HUMSS/ASSH', 'HE/HT', 'ICT/ICT Professionals', 'SPORTS'];

const SIGNUP_PENDING_TTL_SECONDS = 15 * 60;

$step = (int)($_POST['step'] ?? 1);
$errors = [];

$pending = $_SESSION['signup_pending'] ?? null;
if ($pending && (time() - $pending['created_at']) > SIGNUP_PENDING_TTL_SECONDS) {
    $pending = null;
    unset($_SESSION['signup_pending']);
}

$old = [
    'username' => $pending['username'] ?? '',
    'pfp_id'   => $pending['pfp_id'] ?? 'default',
    'grade'    => '',
    'strand'   => '',
    'club'     => '',
];

if ($step === 2 && !$pending && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    $step = 1;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();

    if ($step === 1) {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $confirm  = $_POST['confirm_password'] ?? '';
        $pfpId    = $_POST['pfp_id'] ?? 'default';

        $old['username'] = $username;
        $old['pfp_id']   = $pfpId;

        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
            $errors[] = 'Username must be 3-20 characters: letters, numbers, and underscores only.';
        }
        if (strlen($password) < 8) {
            $errors[] = 'Password must be at least 8 characters.';
        }
        if ($password !== $confirm) {
            $errors[] = 'Passwords do not match.';
        }
        if (!array_key_exists($pfpId, PRESET_AVATARS)) {
            $errors[] = 'Invalid avatar selection.';
        }

        if (empty($errors)) {
            $usernameLower = mb_strtolower($username);
            $check = $pdo->prepare('SELECT id FROM users WHERE username_lower = :u');
            $check->execute([':u' => $usernameLower]);
            if ($check->fetch()) {
                $errors[] = 'That username is already taken.';
            }
        }

        if (empty($errors)) {
            $_SESSION['signup_pending'] = [
                'username'      => $username,
                'username_lower'=> mb_strtolower($username),
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'pfp_id'        => $pfpId,
                'created_at'    => time(),
            ];
            $pending = $_SESSION['signup_pending'];
            $step = 2;
        }
    } elseif ($step === 2) {
        if (!$pending) {
            $errors[] = 'Your signup session expired. Please start over.';
            $step = 1;
        } else {
            $grade  = $_POST['grade'] ?? '';
            $strand = $_POST['strand'] ?? '';
            $club   = $_POST['club'] ?? '';

            $old['grade']  = $grade;
            $old['strand'] = $strand;
            $old['club']   = $club;

            if (!in_array($grade, GRADES, true)) {
                $errors[] = 'Please select a valid grade level.';
            }
            if (!in_array($strand, STRANDS, true)) {
                $errors[] = 'Please select a valid strand or course.';
            }
            $allClubs = array_merge(CLUBS['Non-academic'], CLUBS['Academic']);
            if ($club !== '' && !in_array($club, $allClubs, true)) {
                $errors[] = 'Invalid club selection.';
            }

            if (empty($errors)) {
                $check = $pdo->prepare('SELECT id FROM users WHERE username_lower = :u');
                $check->execute([':u' => $pending['username_lower']]);
                if ($check->fetch()) {
                    $errors[] = 'That username was just taken — please go back and pick another.';
                }
            }

            if (empty($errors)) {
                try {
                    $stmt = $pdo->prepare(
                        'INSERT INTO users (username, username_lower, password_hash, pfp_id, main_role, grade, strand, club, ip_address)
                         VALUES (:u, :ul, :ph, :pfp, \'MEMBER\', :g, :s, :c, :ip)'
                    );
                    $stmt->execute([
                        ':u'   => $pending['username'],
                        ':ul'  => $pending['username_lower'],
                        ':ph'  => $pending['password_hash'],
                        ':pfp' => $pending['pfp_id'],
                        ':g'   => $grade,
                        ':s'   => $strand,
                        ':c'   => $club !== '' ? $club : null,
                        ':ip'  => $clientIp,
                    ]);

                    $newUserId = (int) $pdo->lastInsertId();
                    unset($_SESSION['signup_pending']);
                    login_user($pdo, $newUserId);
                    header('Location: /index.html');
                    exit;
                } catch (PDOException $e) {
                    die("Database error during signup: " . $e->getMessage());
                }
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign Up — Aghimuan</title>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="shortcut icon" href="favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="stylesheet" href="styles.css?v=4">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    background: radial-gradient(circle at 50% 0%, #0d1b26 0%, #060b10 70%);
    font-family: 'Rajdhani', sans-serif;
    color: #F1F2F5;
    min-height: 100vh;
    margin: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1.5rem 1rem;
  }
  @media (min-height: 650px) {
    body {
      align-items: center;
    }
  }
  .auth-wrap {
    width: 100%;
    max-width: 460px;
    padding: 1.5rem;
    background: rgba(15, 25, 35, 0.75);
    border: 1px solid rgba(48, 150, 199, 0.35);
    border-radius: 12px;
    box-shadow: 0 0 30px rgba(48, 150, 199, 0.08);
  }
  @media (max-width: 480px) {
    .auth-wrap {
      padding: 1.25rem 0.875rem;
    }
  }
  .auth-wrap h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.4rem;
    color: #55F1F8;
    text-shadow: 0 0 12px rgba(85, 241, 248, 0.4);
    margin: 0 0 0.5rem;
  }
  .step-subtitle {
    font-size: 0.85rem;
    color: #8ab4c4;
    margin-bottom: 1.5rem;
  }
  .auth-wrap label {
    display: block;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #8ab4c4;
    margin: 1rem 0 0.375rem;
  }
  .auth-wrap input[type="text"],
  .auth-wrap input[type="password"],
  .auth-wrap select {
    display: block;
    width: 100%;
    max-width: 100%;
    background: #0a1520;
    border: 1px solid rgba(48, 150, 199, 0.4);
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    color: #F1F2F5;
    font-family: 'Rajdhani', sans-serif;
    font-size: 0.95rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
  .auth-wrap select option {
    background: #0a1520;
    color: #F1F2F5;
  }
  .auth-wrap button {
    margin-top: 1.5rem;
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(180deg, #3096C7, #1E5A8A);
    border: none;
    border-radius: 6px;
    color: #fff;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
    cursor: pointer;
  }
  .auth-wrap button:hover { filter: brightness(1.15); }
  .auth-wrap p { font-size: 0.875rem; color: #8ab4c4; margin-top: 1.25rem; }
  .auth-wrap a { color: #55F1F8; text-decoration: none; }
  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
    gap: 0.5rem;
    margin: 0.5rem 0;
  }
  .avatar-grid label { cursor: pointer; display: block; border: 2px solid transparent; border-radius: 8px; padding: 2px; margin: 0; }
  .avatar-grid input { display: none; }
  .avatar-grid input:checked + svg { outline: 2px solid #55F1F8; border-radius: 6px; }
  .avatar-grid svg { width: 100%; height: auto; aspect-ratio: 1; display: block; margin: 0 auto; border-radius: 4px; }
  .errors {
    color: #ff8b8b;
    background: rgba(217, 85, 85, 0.1);
    border: 1px solid rgba(217, 85, 85, 0.3);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    list-style: none;
    font-size: 0.875rem;
  }
  .role-section-title {
    font-size: 0.85rem;
    color: #55F1F8;
    margin-top: 1.2rem;
    border-bottom: 1px solid rgba(85,241,248,0.2);
    padding-bottom: 4px;
  }
  .locked-field {
    font-size: 0.95rem;
    color: #d7dee2;
    padding: 0.625rem 0.75rem;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(48, 150, 199, 0.2);
    border-radius: 6px;
  }
</style>
</head>
<body>
<div class="auth-wrap">
  <h1>Create an account</h1>
  <div class="step-subtitle">Phase <?= $step ?> of 2 — <?= $step === 1 ? 'Credentials' : 'Choose Your Member Roles' ?></div>

  <?php if (!empty($errors)): ?>
    <ul class="errors">
      <?php foreach ($errors as $e): ?>
        <li><?= htmlspecialchars($e) ?></li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>

  <form method="POST" action="/signup.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">
    <input type="hidden" name="step" value="<?= $step ?>">

    <?php if ($step === 1): ?>
      <label>Choose an avatar</label>
      <div class="avatar-grid">
        <?php foreach (PRESET_AVATARS as $id => $color): ?>
          <label>
            <input type="radio" name="pfp_id" value="<?= htmlspecialchars($id) ?>"
                   <?= $old['pfp_id'] === $id ? 'checked' : '' ?>>
            <svg viewBox="0 0 32 32"><rect width="32" height="32" fill="<?= htmlspecialchars($color) ?>"/></svg>
          </label>
        <?php endforeach; ?>
      </div>

      <label for="username">Username</label>
      <input type="text" id="username" name="username" value="<?= htmlspecialchars($old['username']) ?>" required>

      <label for="password">Password</label>
      <input type="password" id="password" name="password" required minlength="8">

      <label for="confirm_password">Confirm password</label>
      <input type="password" id="confirm_password" name="confirm_password" required minlength="8">

      <button type="submit">Next: Select Roles</button>

    <?php else: ?>
      <label>Signing up as</label>
      <div class="locked-field"><?= htmlspecialchars($pending['username'] ?? '') ?></div>

      <label for="grade">Grade Level *</label>
      <select id="grade" name="grade" required>
        <option value="" disabled <?= $old['grade'] === '' ? 'selected' : '' ?>>Select grade level...</option>
        <?php foreach (GRADES as $g): ?>
          <option value="<?= $g ?>" <?= $old['grade'] === $g ? 'selected' : '' ?>><?= $g ?></option>
        <?php endforeach; ?>
      </select>

      <label for="strand">Strand / Course *</label>
      <select id="strand" name="strand" required>
        <option value="" disabled <?= $old['strand'] === '' ? 'selected' : '' ?>>Select strand or course...</option>
        <?php foreach (STRANDS as $s): ?>
          <option value="<?= $s ?>" <?= $old['strand'] === $s ? 'selected' : '' ?>><?= $s ?></option>
        <?php endforeach; ?>
      </select>

      <div class="role-section-title">Club Affiliation (Optional - Max 1)</div>

      <label for="club">Club</label>
      <select id="club" name="club">
        <option value="" <?= $old['club'] === '' ? 'selected' : '' ?>>None</option>
        <optgroup label="Non-Academic Clubs">
          <?php foreach (CLUBS['Non-academic'] as $c): ?>
            <option value="<?= $c ?>" <?= $old['club'] === $c ? 'selected' : '' ?>><?= $c ?></option>
          <?php endforeach; ?>
        </optgroup>
        <optgroup label="Academic Clubs">
          <?php foreach (CLUBS['Academic'] as $c): ?>
            <option value="<?= $c ?>" <?= $old['club'] === $c ? 'selected' : '' ?>><?= $c ?></option>
          <?php endforeach; ?>
        </optgroup>
      </select>

      <button type="submit">Complete Sign Up</button>
    <?php endif; ?>
  </form>

  <p>Already have an account? <a href="/login.php">Log in</a></p>
</div>
</body>
</html>