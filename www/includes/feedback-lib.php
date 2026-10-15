<?php
/**
 * feedback-lib.php — shared logic for the temporary Feedback form.
 *
 * The form lives at www/feedback.php behind the MAIN site session
 * (includes/session.php) — NOT the library reviewer session, NOT Atlas.
 * Call sites require db.php themselves (same convention as
 * creations-lib.php and resources-lib.php):
 *   require_once __DIR__ . '/../includes/db.php';
 *   require_once __DIR__ . '/../includes/session.php';
 *   require_once __DIR__ . '/../includes/feedback-lib.php';
 *
 * PRIVACY: responses are visible ONLY to logged-in admins inside admin.php.
 * There is no public listing — api/feedback.php returns at most the
 * caller's OWN row. Never log response bodies; never put response text
 * into error messages.
 *
 * One row per user: feedback_responses.user_id is UNIQUE, submissions
 * upsert. email/username are snapshots of what the user submitted —
 * prefill is editable AND blankable, a blank stays blank.
 *
 * Question keys are stable (q1..q24). Wording changes = code edit; stored
 * answers_json keys never change, so old rows keep their meaning.
 */

declare(strict_types=1);

const FEEDBACK_MAX_TEXT_LENGTH = 2000;
const FEEDBACK_MAX_EMAIL_LENGTH = 254;
const FEEDBACK_MAX_USERNAME_LENGTH = 20;
const FEEDBACK_MAX_GRADE_LENGTH = 40;
const FEEDBACK_MAX_STRAND_LENGTH = 40;
const FEEDBACK_MAX_NOTICE_LENGTH = 500;
const FEEDBACK_MAX_CLOSED_LENGTH = 200;

const FEEDBACK_RATING_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];
const FEEDBACK_REQUIRED_TEXT_KEYS = ['q11', 'q13', 'q15'];
const FEEDBACK_TEXT_KEYS = ['q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18'];

const FEEDBACK_VISIT_OPTIONS = ['daily', 'few-times-a-week', 'weekly', 'rarely'];
const FEEDBACK_DEVICE_OPTIONS = ['phone', 'desktop', 'both'];
const FEEDBACK_REVIEWER_OPTIONS = ['et', 'css', 'cp', 'mil', 'vgd', 'none'];
const FEEDBACK_FOLLOWUP_OPTIONS = ['yes', 'no'];

// The locked 24. type is rating|text|choice|meta. meta rows (q21/q22)
// document the grade/strand identity columns — they are submitted as
// top-level fields, NOT inside answers_json (validate() strips them if
// a client sends them there anyway).
const FEEDBACK_QUESTIONS = [
    ['key' => 'q1',  'type' => 'rating', 'label' => 'Overall experience on aghimuan.online', 'required' => true],
    ['key' => 'q2',  'type' => 'rating', 'label' => 'Ease of finding your way around (navigation)', 'required' => true],
    ['key' => 'q3',  'type' => 'rating', 'label' => 'Loading speed / performance', 'required' => true],
    ['key' => 'q4',  'type' => 'rating', 'label' => 'Announcements clarity & usefulness', 'required' => true],
    ['key' => 'q5',  'type' => 'rating', 'label' => 'Events section usefulness', 'required' => true],
    ['key' => 'q6',  'type' => 'rating', 'label' => 'Resource Hub usefulness', 'required' => true],
    ['key' => 'q7',  'type' => 'rating', 'label' => 'Creations Hub inspiration & browsing', 'required' => true],
    ['key' => 'q8',  'type' => 'rating', 'label' => 'Interactive reviewers overall helpfulness', 'required' => true],
    ['key' => 'q9',  'type' => 'rating', 'label' => 'Reviewer explanations readability (do they make sense?)', 'required' => true],
    ['key' => 'q10', 'type' => 'rating', 'label' => 'Likelihood to recommend the site to a classmate', 'required' => true],
    ['key' => 'q11', 'type' => 'text', 'label' => 'What did you enjoy MOST?', 'required' => true],
    ['key' => 'q12', 'type' => 'text', 'label' => 'What confused or frustrated you?', 'required' => false],
    ['key' => 'q13', 'type' => 'text', 'label' => 'What should we IMPROVE?', 'required' => true],
    ['key' => 'q14', 'type' => 'text', 'label' => 'What should we REMOVE (pages, sections, clutter)?', 'required' => false],
    ['key' => 'q15', 'type' => 'text', 'label' => 'Which reviewer subject helped you most, and WHY?', 'required' => true],
    ['key' => 'q16', 'type' => 'text', 'label' => 'Which reviewer topic was confusing or wrong, and what should change?', 'required' => false],
    ['key' => 'q17', 'type' => 'text', 'label' => 'What reviewer subject/topic is MISSING that we should add?', 'required' => false],
    ['key' => 'q18', 'type' => 'text', 'label' => 'Any other thoughts — open floor', 'required' => false],
    ['key' => 'q19', 'type' => 'choice', 'label' => 'How often do you visit?', 'required' => true, 'options' => FEEDBACK_VISIT_OPTIONS],
    ['key' => 'q20', 'type' => 'choice', 'label' => 'How do you usually access the site?', 'required' => true, 'options' => FEEDBACK_DEVICE_OPTIONS],
    ['key' => 'q21', 'type' => 'meta', 'label' => 'Grade', 'required' => false, 'column' => 'grade'],
    ['key' => 'q22', 'type' => 'meta', 'label' => 'Strand', 'required' => false, 'column' => 'strand'],
    ['key' => 'q23', 'type' => 'choice', 'label' => 'Which reviewer did you use MOST?', 'required' => true, 'options' => FEEDBACK_REVIEWER_OPTIONS],
    ['key' => 'q24', 'type' => 'choice', 'label' => 'May we follow up over email about your answers?', 'required' => true, 'options' => FEEDBACK_FOLLOWUP_OPTIONS],
];

// Short CSV column labels, same order as FEEDBACK_QUESTIONS.
const FEEDBACK_EXPORT_HEADERS = [
    'Submitted At (Asia/Manila)', 'Email', 'Username', 'Grade', 'Strand',
    'Q1 Overall (1-5)', 'Q2 Navigation (1-5)', 'Q3 Speed (1-5)',
    'Q4 Announcements (1-5)', 'Q5 Events (1-5)', 'Q6 Resource Hub (1-5)',
    'Q7 Creations Hub (1-5)', 'Q8 Reviewers helpful (1-5)',
    'Q9 Reviewer readability (1-5)', 'Q10 Recommend (1-5)',
    'Q11 Enjoyed most', 'Q12 Confused by', 'Q13 Improve', 'Q14 Remove',
    'Q15 Best reviewer + why', 'Q16 Confusing topic', 'Q17 Missing topic',
    'Q18 Other thoughts', 'Q19 Visit frequency', 'Q20 Device',
    'Q21 Grade', 'Q22 Strand', 'Q23 Most-used reviewer', 'Q24 Follow-up ok',
    'Updated At (Asia/Manila)',
];

/** Page on/off state + admin-set notice/closed message. Ships disabled (see db.php seed). */
function feedback_status(PDO $pdo): array {
    $rows = $pdo->query('SELECT key, value FROM feedback_settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    if (!is_array($rows)) $rows = [];
    return [
        'enabled'        => (($rows['page_enabled'] ?? '0') === '1'),
        'notice'         => (string) ($rows['page_notice'] ?? ''),
        'closed_message' => (string) ($rows['closed_message'] ?? "We're not looking for feedbacks yet. Check back soon!"),
    ];
}

/** Persists the admin toggle. Returns nothing — throws PDOException on failure. */
function feedback_save_status(PDO $pdo, bool $enabled, string $notice, string $closed): void {
    $stmt = $pdo->prepare(
        "UPDATE feedback_settings SET value = :v, updated_at = datetime('now') WHERE key = :k"
    );
    $stmt->execute([':v' => $enabled ? '1' : '0', ':k' => 'page_enabled']);
    $stmt->execute([':v' => mb_substr($notice, 0, FEEDBACK_MAX_NOTICE_LENGTH), ':k' => 'page_notice']);
    $stmt->execute([':v' => mb_substr($closed, 0, FEEDBACK_MAX_CLOSED_LENGTH), ':k' => 'closed_message']);
}

/**
 * Validates a submission. $answers maps q-key => value; $grade/$grade are
 * the optional top-level identity fields (null/'' = not given).
 * Returns ['answers'=>normalized, 'grade'=>?string, 'strand'=>?string]
 * or ['error' => message]. Over-long text is REJECTED (422 upstream),
 * never silently truncated — the user should see what didn't fit.
 */
function feedback_validate(array $answers, $grade, $strand): array {
    $out = [];

    foreach (FEEDBACK_RATING_KEYS as $key) {
        if (!array_key_exists($key, $answers) || $answers[$key] === '' || $answers[$key] === null) {
            return ['error' => 'Please rate every experience question (1–5).'];
        }
        $raw = $answers[$key];
        if (is_int($raw)) {
            $val = $raw;
        } elseif (is_string($raw) && preg_match('/^[1-5]$/', trim($raw))) {
            $val = (int) trim($raw);
        } else {
            return ['error' => 'Ratings must be whole numbers from 1 to 5.'];
        }
        if ($val < 1 || $val > 5) {
            return ['error' => 'Ratings must be whole numbers from 1 to 5.'];
        }
        $out[$key] = $val;
    }

    foreach (FEEDBACK_TEXT_KEYS as $key) {
        $text = trim((string) ($answers[$key] ?? ''));
        if (in_array($key, FEEDBACK_REQUIRED_TEXT_KEYS, true) && $text === '') {
            return ['error' => 'Please answer all required written questions.'];
        }
        if (mb_strlen($text) > FEEDBACK_MAX_TEXT_LENGTH) {
            return ['error' => 'A written answer is too long (max ' . FEEDBACK_MAX_TEXT_LENGTH . ' characters).'];
        }
        $out[$key] = $text;
    }

    $choices = [
        'q19' => FEEDBACK_VISIT_OPTIONS,
        'q20' => FEEDBACK_DEVICE_OPTIONS,
        'q23' => FEEDBACK_REVIEWER_OPTIONS,
        'q24' => FEEDBACK_FOLLOWUP_OPTIONS,
    ];
    foreach ($choices as $key => $allowed) {
        $val = mb_strtolower(trim((string) ($answers[$key] ?? '')));
        if ($val === '' || !in_array($val, $allowed, true)) {
            return ['error' => 'Please answer every multiple-choice question.'];
        }
        $out[$key] = $val;
    }

    // grade/strand live in their own columns, not in answers_json. Strip
    // them if a client sends them with the answers anyway.
    unset($out['q21'], $out['q22']);

    foreach (['grade' => $grade, 'strand' => $strand] as $field => $val) {
        $max = $field === 'grade' ? FEEDBACK_MAX_GRADE_LENGTH : FEEDBACK_MAX_STRAND_LENGTH;
        $norm = $val === null ? '' : trim((string) $val);
        if (mb_strlen($norm) > $max) {
            return ['error' => 'Grade / strand must be ' . $max . ' characters or fewer.'];
        }
        ${$field . '_norm'} = $norm === '' ? null : $norm;
    }

    return ['answers' => $out, 'grade' => $grade_norm, 'strand' => $strand_norm];
}

/** The caller's own response (or null). NEVER used for listing others' rows. */
function feedback_get_own(PDO $pdo, int $userId): ?array {
    $stmt = $pdo->prepare(
        'SELECT grade, strand, answers_json, updated_at FROM feedback_responses WHERE user_id = :u'
    );
    $stmt->execute([':u' => $userId]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $answers = json_decode($row['answers_json'] ?? '{}', true);
    if (!is_array($answers)) $answers = [];
    return [
        'answers'    => $answers,
        'grade'      => $row['grade'] ?? null,
        'strand'     => $row['strand'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

/** Admin-only listing, newest first. Callers must already hold an admin session. */
function feedback_list(PDO $pdo, int $limit = 200): array {
    $limit = max(1, min(1000, $limit));
    return $pdo->query(
        'SELECT * FROM feedback_responses ORDER BY updated_at DESC, id DESC LIMIT ' . $limit
    )->fetchAll();
}

/** Total response count (admin badge). */
function feedback_count(PDO $pdo): int {
    return (int) $pdo->query('SELECT COUNT(*) FROM feedback_responses')->fetchColumn();
}

/** Deletes one response row (admin purge path). Returns true when a row was removed. */
function feedback_delete(PDO $pdo, int $id): bool {
    $stmt = $pdo->prepare('DELETE FROM feedback_responses WHERE id = :id');
    $stmt->execute([':id' => $id]);
    return $stmt->rowCount() > 0;
}

/** Manila-timestamped download filename, e.g. feedback-responses-20261016-0930.csv */
function feedback_export_filename(): string {
    $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
    return 'feedback-responses-' . $now->format('Ymd-Hi') . '.csv';
}

/** CSV export (Excel-compatible via BOM). Same headers as FEEDBACK_EXPORT_HEADERS. */
function feedback_build_csv(PDO $pdo): string {
    $rows = $pdo->query(
        'SELECT * FROM feedback_responses ORDER BY created_at ASC, id ASC'
    )->fetchAll();
    $fh = fopen('php://temp', 'r+');
    if ($fh === false) {
        throw new RuntimeException('Could not build the CSV export.');
    }
    fwrite($fh, "\xEF\xBB\xBF"); // BOM so Excel detects UTF-8 (ñ, accents)
    fputcsv($fh, FEEDBACK_EXPORT_HEADERS);
    foreach ($rows as $row) {
        $answers = json_decode($row['answers_json'] ?? '{}', true);
        if (!is_array($answers)) $answers = [];
        $a = fn($k) => isset($answers[$k]) ? (string) $answers[$k] : '';
        fputcsv($fh, [
            (string) ($row['created_at'] ?? ''),
            (string) ($row['email'] ?? ''),
            (string) ($row['username'] ?? ''),
            (string) ($row['grade'] ?? ''),
            (string) ($row['strand'] ?? ''),
            $a('q1'), $a('q2'), $a('q3'), $a('q4'), $a('q5'),
            $a('q6'), $a('q7'), $a('q8'), $a('q9'), $a('q10'),
            $a('q11'), $a('q12'), $a('q13'), $a('q14'), $a('q15'),
            $a('q16'), $a('q17'), $a('q18'), $a('q19'), $a('q20'),
            (string) ($row['grade'] ?? ''), (string) ($row['strand'] ?? ''),
            $a('q23'), $a('q24'),
            (string) ($row['updated_at'] ?? ''),
        ]);
    }
    rewind($fh);
    $out = stream_get_contents($fh);
    fclose($fh);
    return $out === false ? '' : $out;
}
