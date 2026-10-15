<?php
/**
 * GET  /api/feedback.php  -> form status + (when logged in) prefill + own response.
 *                            Public: guests get status/closed_message so the page
 *                            can render its closed state. NO other user's data,
 *                            ever — only the caller's own row.
 * POST /api/feedback.php  -> submit/update YOUR OWN response, auth + CSRF required.
 *                            body: JSON { email?, username?, grade?, strand?,
 *                            answers { q1..q20, q23, q24 }, csrf_token }
 *                            One row per user (upsert on user_id). Rejected with
 *                            403 while the form is paused.
 *
 * Identity fields are editable AND blankable: a key present-but-blank stores
 * blank; only a MISSING key falls back to the session value. The session
 * value is never silently re-attached over an explicit blank.
 */

declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';
require_once __DIR__ . '/../includes/feedback-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$pdo = get_db();

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

/** JSON-friendly version of require_login() -- returns a 401 instead of redirecting. */
function require_login_json(PDO $pdo): array {
    $user = current_user($pdo);
    if (!$user) {
        json_error(401, 'You must be logged in.');
    }
    return $user;
}

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: status + own prefill/response (public) ----
if ($method === 'GET') {
    $st = feedback_status($pdo);
    $viewer = current_user($pdo); // optional -- prefill + own row only when logged in

    $out = [
        'ok' => true,
        'enabled' => $st['enabled'],
        'notice' => $st['notice'],
        'closed_message' => $st['closed_message'],
        'prefill' => null,
        'response' => null,
    ];
    if ($viewer) {
        $out['prefill'] = [
            'email' => (string) ($viewer['email'] ?? ''),
            'username' => (string) ($viewer['username'] ?? ''),
            'grade' => $viewer['grade'] ?? null,
            'strand' => $viewer['strand'] ?? null,
        ];
        $out['response'] = feedback_get_own($pdo, (int) $viewer['id']);
    }
    echo json_encode($out);
    exit;
}

// ---- POST: submit / update own response ----
if ($method === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    $_POST = array_merge($_POST, $body);

    require_csrf();
    $currentUser = require_login_json($pdo);

    $st = feedback_status($pdo);
    if (!$st['enabled']) {
        json_error(403, 'Feedback is paused right now.');
    }

    $valid = feedback_validate(
        (isset($body['answers']) && is_array($body['answers'])) ? $body['answers'] : [],
        $body['grade'] ?? null,
        $body['strand'] ?? null
    );
    if (isset($valid['error'])) {
        json_error(422, $valid['error']);
    }

    // Editable + blankable identity: missing key -> session value,
    // present-but-blank -> stored blank. Never re-attach silently.
    $email = array_key_exists('email', $body)
        ? mb_substr(trim((string) $body['email']), 0, FEEDBACK_MAX_EMAIL_LENGTH)
        : (string) ($currentUser['email'] ?? '');
    $username = array_key_exists('username', $body)
        ? mb_substr(trim((string) $body['username']), 0, FEEDBACK_MAX_USERNAME_LENGTH)
        : (string) ($currentUser['username'] ?? '');

    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        json_error(422, 'That email address does not look valid (or leave it blank).');
    }

    $stmt = $pdo->prepare(
        'INSERT INTO feedback_responses (user_id, email, username, grade, strand, answers_json, created_at, updated_at)
         VALUES (:u, :e, :n, :g, :s, :a, datetime(\'now\'), datetime(\'now\'))
         ON CONFLICT(user_id) DO UPDATE SET
            email = excluded.email,
            username = excluded.username,
            grade = excluded.grade,
            strand = excluded.strand,
            answers_json = excluded.answers_json,
            updated_at = datetime(\'now\')'
    );
    $stmt->execute([
        ':u' => (int) $currentUser['id'],
        ':e' => $email,
        ':n' => $username,
        ':g' => $valid['grade'],
        ':s' => $valid['strand'],
        ':a' => json_encode($valid['answers'], JSON_UNESCAPED_UNICODE),
    ]);

    echo json_encode(['ok' => true, 'updated' => true]);
    exit;
}

json_error(405, 'Method not allowed.');
