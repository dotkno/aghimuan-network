<?php
/**
 * admin-auth.php — Authentication functions for the admin panel
 */

declare(strict_types=1);

require_once __DIR__ . '/admin-config.php';

function ensure_admin_accounts_table(PDO $pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )");

    $count = (int) $pdo->query('SELECT COUNT(*) FROM admin_accounts')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare('INSERT INTO admin_accounts (username, password_hash, is_main) VALUES (:u, :p, 1)');
        $stmt->execute([':u' => MAIN_ADMIN_USERNAME, ':p' => password_hash(MAIN_ADMIN_USERNAME, PASSWORD_DEFAULT)]);
    }
}

function admin_csrf_token(): string {
    if (empty($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['admin_csrf'];
}

function admin_verify_csrf(): void {
    $token = $_POST['csrf_token'] ?? '';
    if (!hash_equals($_SESSION['admin_csrf'] ?? '', $token)) {
        http_response_code(403);
        die('Your session expired or this request could not be verified. Please go back, refresh the page, and try again.');
    }
}

function current_admin(): ?array {
    if (empty($_SESSION['admin_id'])) return null;
    static $cached = null;
    static $checked = false;
    if ($checked) return $cached;
    $checked = true;

    $pdo = get_db();
    $stmt = $pdo->prepare('SELECT id, username, is_main FROM admin_accounts WHERE id = :id');
    $stmt->execute([':id' => (int) $_SESSION['admin_id']]);
    $row = $stmt->fetch();

    if (!$row) {
        session_destroy();
        $cached = null;
        return null;
    }

    $cached = ['id' => (int) $row['id'], 'username' => $row['username'], 'is_main' => (bool) $row['is_main']];
    return $cached;
}

function is_logged_in(): bool {
    return current_admin() !== null;
}

function handle_admin_login(PDO $pdo): ?string {
    $_SESSION['admin_login_attempts'] = $_SESSION['admin_login_attempts'] ?? 0;
    $_SESSION['admin_login_locked_until'] = $_SESSION['admin_login_locked_until'] ?? 0;

    if (isset($_POST['action']) && $_POST['action'] === 'login') {
        if (time() < $_SESSION['admin_login_locked_until']) {
            return 'Too many failed attempts. Try again in a minute.';
        } else {
            $login_username = trim($_POST['username'] ?? '');
            $login_password = $_POST['password'] ?? '';

            $stmt = $pdo->prepare('SELECT * FROM admin_accounts WHERE username = :u');
            $stmt->execute([':u' => $login_username]);
            $acct = $stmt->fetch();

            if ($acct && password_verify($login_password, $acct['password_hash'])) {
                $_SESSION['admin_login_attempts'] = 0;
                session_regenerate_id(true);
                $_SESSION['admin_id'] = (int) $acct['id'];
                unset($_SESSION['admin_csrf']);
                return null;
            } else {
                $_SESSION['admin_login_attempts']++;
                if ($_SESSION['admin_login_attempts'] >= 5) {
                    $_SESSION['admin_login_locked_until'] = time() + 60;
                    $_SESSION['admin_login_attempts'] = 0;
                }
                return 'Invalid username or password.';
            }
        }
    }
    return null;
}

function handle_admin_logout(): void {
    if (isset($_GET['action']) && $_GET['action'] === 'logout') {
        session_destroy();
        header('Location: admin.php');
        exit;
    }
}
