<?php
declare(strict_types=1);
/**
 * library/intervention-api.php
 *
 * JSON API for the Intervention Program (reviewer-session gated).
 *
 * GET  ?action=status            -> { ok, enabled } (reviewer session required)
 * GET  ?action=list              -> active tests (403 when program disabled)
 * GET  ?action=get&test=SLUG     -> questions WITHOUT the answer key
 *
 * Timed attempts (v2, one question per page, forward-only):
 * POST {action:'profile', csrf_token, test_id, full_name, grade_level,
 *       section}                 -> validates identity, shuffles order, starts clocks
 * POST {action:'answer', csrf_token, test_id, position, answer, violations}
 *                                -> server-timestamps one answer (overtime MCQ
 *                                   counts wrong); { ok, done, next }
 * POST {action:'finish', csrf_token, test_id}
 *                                -> total-time check, server scoring, -1 per
 *                                   tab-switch (floor 0), one appended row,
 *                                   score-only reply (never item-level review)
 * POST {action:'restart', csrf_token, test_id}
 *                                -> drops the in-progress attempt (no row)
 */

require_once __DIR__ . '/includes/reviewer-session.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/intervention-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function json_error(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

// has_reviewer_access (401 JSON) — never require_reviewer_access() here,
// its 302 redirect would break fetch() JSON parsing.
if (!has_reviewer_access()) {
    json_error(401, 'reviewer_login_required');
}
$email = mb_strtolower(trim((string) reviewer_session_email()));

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $action = (string) ($_GET['action'] ?? 'status');
    $status = intervention_status($pdo);

    if ($action === 'status') {
        echo json_encode(['ok' => true, 'enabled' => $status['enabled']]);
        exit;
    }
    if (!$status['enabled']) {
        json_error(403, 'program_disabled');
    }
    if ($action === 'list') {
        echo json_encode(['ok' => true, 'tests' => intervention_list($pdo, true, $email)]);
        exit;
    }
    if ($action === 'get') {
        $test = intervention_get_test($pdo, trim((string) ($_GET['test'] ?? '')));
        if ($test === null) {
            json_error(404, 'Assessment not found.');
        }
        echo json_encode([
            'ok' => true,
            'test' => [
                'id' => $test['id'],
                'slug' => $test['slug'],
                'title' => $test['title'],
                'subject' => $test['subject'],
                'grade_label' => $test['grade_label'],
                'part' => $test['part'],
                'total_questions' => $test['total_questions'],
                'mcq_count' => $test['mcq_count'],
                'passing_score' => $test['passing_score'],
                'max_attempts' => $test['max_attempts'],
                'attempts_left' => $test['max_attempts'] > 0
                    ? max(0, $test['max_attempts'] - intervention_attempts_used($pdo, $test['id'], $email))
                    : null,
            ],
            // WITHOUT 'correct' — the key never leaves the server.
            'questions' => intervention_get_questions($pdo, $test['id'], false),
        ]);
        exit;
    }
    json_error(400, 'Unknown action.');
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        json_error(400, 'Invalid JSON body.');
    }
    $action = (string) ($body['action'] ?? '');
    if (!in_array($action, ['profile', 'answer', 'finish', 'restart'], true)) {
        json_error(400, 'Unknown action.');
    }
    if (!intervention_verify_csrf((string) ($body['csrf_token'] ?? ''))) {
        json_error(403, 'Invalid or expired form submission. Reload the page and try again.');
    }

    $status = intervention_status($pdo);
    if (!$status['enabled'] && $action !== 'restart') {
        json_error(403, 'program_disabled');
    }

    $testId = (int) ($body['test_id'] ?? 0);
    if ($testId <= 0) {
        json_error(400, 'Missing assessment.');
    }
    $stmt = $pdo->prepare('SELECT * FROM intervention_tests WHERE id = :id AND is_active = 1');
    $stmt->execute([':id' => $testId]);
    $test = $stmt->fetch();
    if (!$test) {
        json_error(404, 'Assessment not found.');
    }

    // ---- restart: drop the in-progress attempt, record nothing ----
    if ($action === 'restart') {
        intervention_attempt_clear($testId);
        echo json_encode(['ok' => true]);
        exit;
    }

    $keyRows = intervention_get_questions($pdo, $testId, true);
    if (empty($keyRows)) {
        json_error(409, 'This assessment has no questions yet.');
    }
    // MCQ positions score; written positions (no choices) are required
    // free text, stored for teacher grading, never auto-scored.
    $key = [];
    $choiceCounts = [];
    $writtenPositions = [];
    $budgets = [];
    foreach ($keyRows as $q) {
        $pos = (int) $q['position'];
        $budgets[$pos] = intervention_question_budget($q);
        if (!empty($q['choices'])) {
            $key[$pos] = $q['correct'];
            $choiceCounts[$pos] = count($q['choices']);
        } else {
            $writtenPositions[$pos] = true;
        }
    }

    // ---- profile: validate identity, shuffle order, start the clocks ----
    if ($action === 'profile') {
        $profile = intervention_validate_profile(
            (string) ($body['full_name'] ?? ''),
            (string) ($body['grade_level'] ?? ''),
            (string) ($body['section'] ?? '')
        );
        if (isset($profile['error'])) {
            json_error(422, $profile['error']);
        }
        $maxAttempts = (int) $test['max_attempts'];
        if ($maxAttempts > 0 && intervention_attempts_used($pdo, $testId, $email) >= $maxAttempts) {
            json_error(429, 'attempts_exhausted');
        }
        $attempt = intervention_attempt_get($testId);
        if ($attempt === null || empty($attempt['order'])) {
            // Fresh attempt: shuffled presentation order, clocks start when
            // the profile lands (never while the name is still being typed).
            $order = array_keys($key + $writtenPositions);
            shuffle($order);
            $attempt = [
                'profile' => null, 'order' => array_values($order),
                'answers' => [], 'violations' => 0,
                'started_at' => null, 'q_started' => [],
            ];
        }
        // Re-posting the profile mid-attempt only updates identity — answers,
        // order, and clocks are never reset by it.
        $attempt['profile'] = [
            'full_name' => $profile[0],
            'grade_level' => $profile[1],
            'section' => $profile[2],
        ];
        if ($attempt['started_at'] === null) {
            $attempt['started_at'] = time();
            $firstPos = $attempt['order'][0];
            $attempt['q_started'] = [0 => time()];
        }
        intervention_attempt_save($testId, $attempt);
        echo json_encode(['ok' => true, 'next' => count($attempt['answers'])]);
        exit;
    }

    // answer + finish both need a live attempt with identity.
    $attempt = intervention_attempt_get($testId);
    if ($attempt === null || !is_array($attempt['profile'] ?? null) || $attempt['started_at'] === null) {
        json_error(409, 'no_attempt');
    }

    // ---- answer: timestamp one answer against the server clock ----
    if ($action === 'answer') {
        $pos = (int) ($body['position'] ?? 0);
        $answered = count($attempt['answers']);
        $expected = $attempt['order'][$answered] ?? null;
        if ($expected === null || $pos !== (int) $expected) {
            json_error(409, 'out_of_sequence');
        }
        $qStart = $attempt['q_started'][$answered] ?? null;
        if ($qStart === null) {
            json_error(409, 'no_attempt');
        }
        $late = (time() - (int) $qStart) > $budgets[$pos];
        $given = $body['answer'] ?? null;
        if (isset($key[$pos])) {
            $letter = strtoupper(trim((string) $given));
            $maxLetter = chr(ord('A') + $choiceCounts[$pos] - 1);
            $valid = strlen($letter) === 1 && $letter >= 'A' && $letter <= $maxLetter;
            if (!$valid && !$late) {
                json_error(422, 'Invalid answers submitted.');
            }
            // Overtime MCQ counts wrong even when the letter is right —
            // the stored letter is kept for audit, scoring skips it.
            $attempt['answers'][$pos] = ['a' => $valid ? $letter : '', 'late' => $late ? 1 : 0];
        } elseif (isset($writtenPositions[$pos])) {
            $text = trim((string) $given);
            if (($text === '' || mb_strlen($text) > 2000) && !$late) {
                json_error(422, 'Written answers are required (max 2000 characters).');
            }
            // Overtime written text is still saved for the teacher.
            $attempt['answers'][$pos] = ['a' => mb_substr($text, 0, 2000), 'late' => $late ? 1 : 0];
        } else {
            json_error(422, 'Invalid answers submitted.');
        }
        // Violations are cumulative and monotonic — the server keeps the max
        // so refreshes and replays can never undercount them.
        $attempt['violations'] = max((int) ($attempt['violations'] ?? 0), (int) ($body['violations'] ?? 0));
        // Arm the next question's clock NOW (server time), not on next render —
        // reloading the page can never rewind it.
        $next = count($attempt['answers']);
        if ($next < count($attempt['order'])) {
            $attempt['q_started'][$next] = time();
        }
        intervention_attempt_save($testId, $attempt);
        echo json_encode(['ok' => true, 'done' => $next >= count($attempt['order']), 'next' => $next]);
        exit;
    }

    // ---- finish: total-time check, scoring, violations, one appended row ----
    $totalItems = count($attempt['order']);
    if (count($attempt['answers']) !== $totalItems) {
        json_error(422, 'Please answer all ' . $totalItems . ' items.');
    }
    if ((time() - (int) $attempt['started_at']) > intervention_total_budget($pdo, $testId)) {
        intervention_attempt_clear($testId);
        json_error(403, 'time_expired');
    }
    $maxAttempts = (int) $test['max_attempts'];
    if ($maxAttempts > 0 && intervention_attempts_used($pdo, $testId, $email) >= $maxAttempts) {
        json_error(429, 'attempts_exhausted');
    }

    $answers = [];
    foreach ($attempt['answers'] as $pos => $entry) {
        // Late MCQ answers are excluded here (counted wrong); written text
        // always flows through for teacher grading.
        if (isset($key[(int) $pos]) && !empty($entry['late'])) {
            continue;
        }
        $answers[(int) $pos] = $entry['a'];
    }
    [$correct, $total, $pct, $passed] = intervention_grade_score($answers, $key, (int) $test['passing_score']);

    // Tab-switch penalty: -1 per confirmed violation, floor at zero, then
    // the pass mark is re-checked against the deducted score.
    $violations = max(0, (int) ($attempt['violations'] ?? 0));
    $correct = max(0, $correct - $violations);
    $pct = $total > 0 ? round($correct / $total * 100, 1) : 0.0;
    $passed = ($correct >= (int) $test['passing_score']) ? 1 : 0;

    $flat = [];
    foreach ($attempt['answers'] as $pos => $entry) {
        $flat[(int) $pos] = $entry['a'];
    }
    $prof = $attempt['profile'];
    $stmt = $pdo->prepare(
        'INSERT INTO intervention_results
            (test_id, user_id, email, full_name, grade_level, section,
             test_title, correct, total, score_pct, passed, violations, answers_json, submitted_at)
         VALUES (:test_id, NULL, :email, :full_name, :grade_level, :section,
             :test_title, :correct, :total, :pct, :passed, :violations, :answers, datetime(\'now\'))'
    );
    $stmt->execute([
        ':test_id' => $testId,
        ':email' => $email,
        ':full_name' => $prof['full_name'],
        ':grade_level' => $prof['grade_level'],
        ':section' => $prof['section'],
        ':test_title' => (string) $test['title'],
        ':correct' => $correct,
        ':total' => $total,
        ':pct' => $pct,
        ':passed' => $passed,
        ':violations' => $violations,
        ':answers' => json_encode($flat),
    ]);
    intervention_attempt_clear($testId);

    $row = $pdo->query('SELECT submitted_at FROM intervention_results WHERE id = ' . (int) $pdo->lastInsertId())->fetch();
    echo json_encode([
        'ok' => true,
        'correct' => $correct,
        'total' => $total,
        'score_pct' => $pct,
        'passed' => $passed === 1,
        'violations' => $violations,
        'email' => $email,
        'submitted_at' => $row['submitted_at'] ?? '',
    ]);
    exit;
}

json_error(405, 'Method not allowed.');
