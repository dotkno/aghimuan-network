<?php
declare(strict_types=1);
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/session.php';

$pdo = get_db();
if (current_user($pdo)) {
    header('Location: /index.html');
    exit;
}

start_secure_session();

$_SESSION['login_attempts'] = $_SESSION['login_attempts'] ?? 0;
$_SESSION['login_locked_until'] = $_SESSION['login_locked_until'] ?? 0;

$error = '';
$oldUsername = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();

    if (time() < $_SESSION['login_locked_until']) {
        $error = 'Too many failed attempts. Try again in a minute.';
    } else {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $oldUsername = $username;

        $stmt = $pdo->prepare('SELECT * FROM users WHERE username_lower = :u');
        $stmt->execute([':u' => mb_strtolower($username)]);
        $user = $stmt->fetch();

        if ($user && $user['is_banned']) {
            $error = 'This account has been suspended.';
        } elseif ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['login_attempts'] = 0;
            login_user($pdo, (int) $user['id']);
            header('Location: /index.html');
            exit;
        } else {
            $_SESSION['login_attempts']++;
            if ($_SESSION['login_attempts'] >= 5) {
                $_SESSION['login_locked_until'] = time() + 60;
                $_SESSION['login_attempts'] = 0;
            }
            $error = 'Incorrect username or password.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Log In — Aghimuan</title>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="shortcut icon" href="favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="stylesheet" href="styles.css?v=4">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    background: radial-gradient(circle at 50% 0%, #0d1b26 0%, #060b10 70%);
    font-family: 'Rajdhani', sans-serif;
    color: #F1F2F5;
    min-height: 100vh;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .auth-wrap {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
    background: rgba(15, 25, 35, 0.75);
    border: 1px solid rgba(48, 150, 199, 0.35);
    border-radius: 12px;
    box-shadow: 0 0 30px rgba(48, 150, 199, 0.08);
  }
  .auth-wrap h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 1.5rem;
    color: #55F1F8;
    text-shadow: 0 0 12px rgba(85, 241, 248, 0.4);
    margin: 0 0 1.5rem;
  }
  .auth-wrap label {
    display: block;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #8ab4c4;
    margin: 1rem 0 0.375rem;
  }
  .auth-wrap input[type="text"],
  .auth-wrap input[type="password"] {
    display: block;
    width: 100%;
    background: #0a1520;
    border: 1px solid rgba(48, 150, 199, 0.4);
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    color: #F1F2F5;
    font-family: 'Rajdhani', sans-serif;
    font-size: 0.95rem;
  }
  .auth-wrap input[type="text"]:focus,
  .auth-wrap input[type="password"]:focus {
    outline: none;
    border-color: #55F1F8;
    box-shadow: 0 0 8px rgba(85, 241, 248, 0.3);
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
  .auth-wrap a:hover { text-decoration: underline; }
  .error {
    color: #ff8b8b;
    background: rgba(217, 85, 85, 0.1);
    border: 1px solid rgba(217, 85, 85, 0.3);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
</style>
</head>
<body>
<div class="auth-wrap">
  <h1>Log in</h1>

  <?php if ($error): ?>
    <p class="error"><?= htmlspecialchars($error) ?></p>
  <?php endif; ?>

  <form method="POST" action="/login.php" novalidate>
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(csrf_token()) ?>">

    <label for="username">Username</label>
    <input type="text" id="username" name="username" value="<?= htmlspecialchars($oldUsername) ?>" required>

    <label for="password">Password</label>
    <input type="password" id="password" name="password" required>

    <button type="submit">Log in</button>
  </form>

  <p>Don't have an account? <a href="/signup.php">Sign up</a></p>
</div>
</body>
</html>