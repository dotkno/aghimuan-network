<?php
/**
 * intervention-lib.php — shared logic for the Intervention Program.
 *
 * The intervention page lives inside the library (reviewer-session gated),
 * so this lib deliberately does NOT touch the main site's session system.
 * Call sites require db.php themselves (same convention as creations-lib.php
 * and resources-lib.php):
 *   require_once __DIR__ . '/../includes/db.php';
 *   require_once __DIR__ . '/includes/reviewer-session.php';
 *   require_once __DIR__ . '/../includes/intervention-lib.php';
 *
 * Contents: taxonomy constants, page-status helpers, per-test attempt
 * counting, submission-profile validation, server-side scoring, a
 * reviewer-session CSRF pair (the reviewer session has no token helper of
 * its own), an admin textarea question parser, and dependency-free .xlsx
 * (ZipArchive + inline strings) / .csv export builders.
 */

declare(strict_types=1);

const INTERVENTION_SUBJECTS = ['CP', 'CSS', 'ET'];
const INTERVENTION_GRADES = ['G11', 'G12', 'JHS'];

// Free-text aliases students may type for grade level -> canonical value.
const INTERVENTION_GRADE_ALIASES = [
    'grade 11' => 'G11',
    'grade11'  => 'G11',
    '11'       => 'G11',
    'grade 12' => 'G12',
    'grade12'  => 'G12',
    '12'       => 'G12',
];

const INTERVENTION_MAX_NAME_LENGTH = 80;
const INTERVENTION_MAX_SECTION_LENGTH = 20;
// Starts alnum, then alnum/space/dot/dash (covers "STEM-A", "12 St. Mary").
const INTERVENTION_SECTION_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9 .\-]*$/u';

// Timed attempts (v2): per-question server-side budgets. Written items get
// longer (owner-confirmed 100s). The total grace absorbs the untimed profile
// step, rendering, and network jitter on top of the summed budgets.
const INTERVENTION_MCQ_SECONDS = 30;
const INTERVENTION_WRITTEN_SECONDS = 100;
const INTERVENTION_TOTAL_GRACE_SECONDS = 180;
const INTERVENTION_TAB_GRACE_SECONDS = 3; // hidden shorter than this: no violation

// Export column headers — exact order, shared by xlsx + csv builders.
// The trailing "Written Responses" column concatenates free-text answers
// as "Q10: <text> | Q20: <text>" (empty when a test has no written items).
const INTERVENTION_EXPORT_HEADERS = [
    'Submitted At (Asia/Manila)', 'Email', 'Full Name', 'Grade Level',
    'Section', 'Assessment Title', 'Correct', 'Total', 'Score %', 'Passed',
    'Written Responses', 'Focus Violations',
];

/** Page on/off state + admin-set notice. Ships disabled (see db.php seed). */
function intervention_status(PDO $pdo): array {
    $rows = $pdo->query('SELECT key, value FROM intervention_settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    if (!is_array($rows)) $rows = [];
    return [
        'enabled' => (($rows['page_enabled'] ?? '0') === '1'),
        'notice'  => (string) ($rows['page_notice'] ?? ''),
    ];
}

/** Persists the admin toggle. Returns nothing — throws PDOException on failure. */
function intervention_save_status(PDO $pdo, bool $enabled, string $notice): void {
    $stmt = $pdo->prepare(
        "UPDATE intervention_settings SET value = :v, updated_at = datetime('now') WHERE key = :k"
    );
    $stmt->execute([':v' => $enabled ? '1' : '0', ':k' => 'page_enabled']);
    $stmt->execute([':v' => mb_substr($notice, 0, 500), ':k' => 'page_notice']);
}

/**
 * Active (or all) tests with question counts. When $email is given, each row
 * also carries attempts_left (null = unlimited).
 */
function intervention_list(PDO $pdo, bool $activeOnly = true, ?string $email = null): array {
    $sql = 'SELECT t.*, (SELECT COUNT(*) FROM intervention_questions q WHERE q.test_id = t.id) AS qcount
            FROM intervention_tests t';
    if ($activeOnly) $sql .= ' WHERE t.is_active = 1';
    $sql .= ' ORDER BY t.subject, t.grade_label, t.part';
    $rows = $pdo->query($sql)->fetchAll();
    $mcqCounts = [];
    foreach ($pdo->query("SELECT test_id, COUNT(*) AS n FROM intervention_questions WHERE choices != '[]' GROUP BY test_id")->fetchAll() as $r) {
        $mcqCounts[(int) $r['test_id']] = (int) $r['n'];
    }
    foreach ($rows as &$t) {
        $t['id'] = (int) $t['id'];
        $t['part'] = (int) $t['part'];
        $t['passing_score'] = (int) $t['passing_score'];
        $t['max_attempts'] = (int) $t['max_attempts'];
        $t['total_questions'] = (int) ($t['qcount'] ?? 0);
        $t['mcq_count'] = $mcqCounts[$t['id']] ?? 0;
        $t['attempts_left'] = null;
        if ($email !== null && $email !== '' && $t['max_attempts'] > 0) {
            $used = intervention_attempts_used($pdo, $t['id'], $email);
            $t['attempts_left'] = max(0, $t['max_attempts'] - $used);
        }
    }
    unset($t);
    return $rows;
}

/** Single test by slug (only active unless $includeInactive). Null when missing. */
function intervention_get_test(PDO $pdo, string $slug, bool $includeInactive = false): ?array {
    $sql = 'SELECT t.*, (SELECT COUNT(*) FROM intervention_questions q WHERE q.test_id = t.id) AS qcount
            FROM intervention_tests t WHERE t.slug = :slug';
    if (!$includeInactive) $sql .= ' AND t.is_active = 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':slug' => $slug]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $row['id'] = (int) $row['id'];
    $row['part'] = (int) $row['part'];
    $row['passing_score'] = (int) $row['passing_score'];
    $row['max_attempts'] = (int) $row['max_attempts'];
    $row['total_questions'] = (int) ($row['qcount'] ?? 0);
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM intervention_questions WHERE test_id = :id AND choices != '[]'");
    $stmt->execute([':id' => $row['id']]);
    $row['mcq_count'] = (int) $stmt->fetchColumn();
    return $row;
}

/**
 * Ordered questions for a test. $withKeys=false STRIPS the answer key —
 * that is the only shape ever sent to browsers.
 */
function intervention_get_questions(PDO $pdo, int $testId, bool $withKeys = false): array {
    $stmt = $pdo->prepare(
        'SELECT position, prompt, choices' . ($withKeys ? ', correct' : '') . '
         FROM intervention_questions WHERE test_id = :id ORDER BY position ASC'
    );
    $stmt->execute([':id' => $testId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $choices = json_decode($r['choices'] ?? '[]', true);
        if (!is_array($choices)) $choices = [];
        $row = [
            'position' => (int) $r['position'],
            'prompt'   => (string) $r['prompt'],
            'choices'  => array_values($choices),
        ];
        if ($withKeys) $row['correct'] = strtoupper(trim((string) ($r['correct'] ?? '')));
        $out[] = $row;
    }
    return $out;
}

/** How many submissions this email already has for a test. */
function intervention_attempts_used(PDO $pdo, int $testId, string $email): int {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM intervention_results WHERE test_id = :t AND email = :e'
    );
    $stmt->execute([':t' => $testId, ':e' => mb_strtolower(trim($email))]);
    return (int) $stmt->fetchColumn();
}

/**
 * Validates the per-submission profile form. Returns [normalizedName,
 * normalizedGrade, normalizedSection] or ['error' => message].
 */
function intervention_validate_profile(string $name, string $grade, string $section): array {
    $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
    if (mb_strlen($name) < 2 || mb_strlen($name) > INTERVENTION_MAX_NAME_LENGTH) {
        return ['error' => 'Full name must be 2–' . INTERVENTION_MAX_NAME_LENGTH . ' characters.'];
    }
    $gradeKey = mb_strtolower(trim($grade));
    if (isset(INTERVENTION_GRADE_ALIASES[$gradeKey])) {
        $gradeKey = INTERVENTION_GRADE_ALIASES[$gradeKey];
    } else {
        $gradeKey = strtoupper(trim($grade));
    }
    if (!in_array($gradeKey, INTERVENTION_GRADES, true)) {
        return ['error' => 'Grade level must be one of: ' . implode(', ', INTERVENTION_GRADES) . '.'];
    }
    $section = trim($section);
    if ($section === '' || mb_strlen($section) > INTERVENTION_MAX_SECTION_LENGTH
        || !preg_match(INTERVENTION_SECTION_PATTERN, $section)) {
        return ['error' => 'Section is required (letters, numbers, spaces, dots and dashes, max '
            . INTERVENTION_MAX_SECTION_LENGTH . ' characters).'];
    }
    return [$name, $gradeKey, $section];
}

/**
 * Server-side scoring. $answers maps position => letter (any case);
 * $key maps position => correct letter. NEVER trusts a client score.
 * Returns [correct, total, pct (0-100 rounded to 1dp), passed (0/1)].
 */
function intervention_grade_score(array $answers, array $key, int $passingScore): array {
    $correct = 0;
    $total = count($key);
    foreach ($key as $pos => $letter) {
        $given = strtoupper(trim((string) ($answers[$pos] ?? '')));
        if ($given !== '' && $given === strtoupper(trim((string) $letter))) {
            $correct++;
        }
    }
    $pct = $total > 0 ? round($correct / $total * 100, 1) : 0.0;
    return [$correct, $total, $pct, ($correct >= $passingScore) ? 1 : 0];
}

// ---------------------------------------------------------------------
// Timed attempts (v2). State lives in the reviewer SESSION (no schema, dies
// with the 8h login — a stale attempt simply can't finish). Shape:
//   ['profile' => null|{full_name,grade_level,section}, 'order' => [pos...],
//    'answers' => [pos => ['a' => answer, 'late' => 0|1]], 'violations' => int,
//    'started_at' => int|null (set when the profile is submitted — Q1's clock
//    starts there, never while the student is still typing their name),
//    'q_started' => [index => timestamp] (set server-side when each question
//    is ADVANCED to, never on render — page refreshes can't rewind clocks)]
// ---------------------------------------------------------------------

function intervention_attempt_key(int $testId): string {
    return 'attempt_' . $testId;
}

function intervention_attempt_get(int $testId): ?array {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $a = $_SESSION['intervention_attempt'][intervention_attempt_key($testId)] ?? null;
    return is_array($a) ? $a : null;
}

function intervention_attempt_save(int $testId, array $attempt): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (!isset($_SESSION['intervention_attempt']) || !is_array($_SESSION['intervention_attempt'])) {
        $_SESSION['intervention_attempt'] = [];
    }
    $_SESSION['intervention_attempt'][intervention_attempt_key($testId)] = $attempt;
}

function intervention_attempt_clear(int $testId): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    unset($_SESSION['intervention_attempt'][intervention_attempt_key($testId)]);
}

/** Seconds allowed for one question row (written items get longer). */
function intervention_question_budget(array $question): int {
    return empty($question['choices']) ? INTERVENTION_WRITTEN_SECONDS : INTERVENTION_MCQ_SECONDS;
}

/** Whole-attempt budget: summed per-item budgets + grace. */
function intervention_total_budget(PDO $pdo, int $testId): int {
    $total = INTERVENTION_TOTAL_GRACE_SECONDS;
    foreach (intervention_get_questions($pdo, $testId, false) as $q) {
        $total += intervention_question_budget($q);
    }
    return $total;
}

/** Export cell for violations: "0" or "2 (tab-switch × 2)" (reason included). */
function intervention_violations_export(int $violations): string {
    $violations = max(0, $violations);
    if ($violations === 0) return '0';
    return $violations . ' (tab-switch × ' . $violations . ')';
}

// ---------------------------------------------------------------------
// Reviewer-session CSRF pair. The reviewer session has no token helper of
// its own, so the intervention page mints one here. Same construction as
// both existing CSRF helpers: bin2hex(random_bytes(32)) + hash_equals.
// ---------------------------------------------------------------------

function intervention_csrf_token(): string {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['intervention_csrf'])) {
        $_SESSION['intervention_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['intervention_csrf'];
}

function intervention_verify_csrf(string $sent): bool {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    return !empty($_SESSION['intervention_csrf']) && hash_equals($_SESSION['intervention_csrf'], $sent);
}

// ---------------------------------------------------------------------
// Admin textarea question parser. One item per line:
//   prompt || choice A || choice B || choice C || [choice D] || LETTER
//   prompt || written                      (unscored free-text response)
// Choices may be 3 or 4 (ET P2 Q21 ships with 3 in the source material);
// LETTER must sit inside the given choices. Written items are required,
// stored, teacher-graded, and never auto-scored.
// Returns ['questions' => [...]] or ['error' => message with line number].
// ---------------------------------------------------------------------

function intervention_parse_questions_text(string $text): array {
    $lines = preg_split('/\r\n|\r|\n/', $text);
    if (!is_array($lines)) return ['error' => 'Could not read the question list.'];
    $out = [];
    $lineno = 0;
    foreach ($lines as $raw) {
        $lineno++;
        $line = trim((string) $raw);
        if ($line === '') continue;
        $parts = array_map('trim', explode('||', $line));
        if (count($parts) === 2 && mb_strtolower($parts[1]) === 'written') {
            if ($parts[0] === '') {
                return ['error' => 'Line ' . $lineno . ': a written prompt is required.'];
            }
            $out[] = ['prompt' => $parts[0], 'choices' => [], 'correct' => ''];
            continue;
        }
        if (count($parts) < 5 || count($parts) > 6 || $parts[0] === '') {
            return ['error' => 'Line ' . $lineno . ': expected "question || A || B || C || [D] || LETTER" or "question || written".'];
        }
        $letter = strtoupper(array_pop($parts));
        $prompt = array_shift($parts);
        $choices = array_values($parts);
        foreach ($choices as $c) {
            if ($c === '') {
                return ['error' => 'Line ' . $lineno . ': every listed choice needs text.'];
            }
        }
        $maxLetter = chr(ord('A') + count($choices) - 1);
        if (strlen($letter) !== 1 || $letter < 'A' || $letter > $maxLetter) {
            return ['error' => 'Line ' . $lineno . ': answer key must be A–' . $maxLetter . ' for ' . count($choices) . ' choices.'];
        }
        $out[] = ['prompt' => $prompt, 'choices' => $choices, 'correct' => $letter];
    }
    if (empty($out)) {
        return ['error' => 'No questions found. Paste at least one line.'];
    }
    return ['questions' => $out];
}

/** Serializes stored questions back to the admin textarea format (round-trip). */
function intervention_questions_to_text(PDO $pdo, int $testId): string {
    $rows = intervention_get_questions($pdo, $testId, true);
    $lines = [];
    foreach ($rows as $q) {
        if (empty($q['choices'])) {
            $lines[] = str_replace(["\r", "\n"], ' ', $q['prompt']) . ' || written';
            continue;
        }
        $cells = [str_replace(["\r", "\n"], ' ', $q['prompt'])];
        foreach ($q['choices'] as $c) {
            $cells[] = str_replace(["\r", "\n"], ' ', (string) $c);
        }
        $cells[] = $q['correct'];
        $lines[] = implode(' || ', $cells);
    }
    return implode("\n", $lines);
}

/**
 * Written answers for one result row, formatted for export as
 * "Q10: <text> | Q20: <text>". With a live test_id the split is exact
 * (positions with choices are MCQ); for orphaned rows (test deleted) any
 * non-single-letter value counts as written (MCQ answers are always one
 * A–D character, written responses are sentences).
 */
function intervention_written_export(PDO $pdo, ?int $testId, ?string $answersJson): string {
    $decoded = json_decode($answersJson ?? '', true);
    if (!is_array($decoded) || empty($decoded)) return '';
    $mcqPositions = [];
    if ($testId !== null && $testId > 0) {
        foreach (intervention_get_questions($pdo, $testId, true) as $q) {
            if (!empty($q['choices'])) $mcqPositions[(int) $q['position']] = true;
        }
    }
    $parts = [];
    foreach ($decoded as $pos => $val) {
        $text = trim((string) $val);
        if ($text === '') continue;
        $isMcq = $testId !== null && $testId > 0
            ? isset($mcqPositions[(int) $pos])
            : (strlen($text) === 1 && in_array(strtoupper($text), ['A', 'B', 'C', 'D'], true));
        if (!$isMcq) {
            $parts[] = 'Q' . ((int) $pos) . ': ' . mb_substr($text, 0, 500);
        }
    }
    return implode(' | ', $parts);
}

// ---------------------------------------------------------------------
// Export builders. One worksheet per test (+ an "All Results" sheet when
// exporting everything). Dependency-free: ZipArchive + inline strings, so
// no sharedStrings table is needed.
// ---------------------------------------------------------------------

/** Manila-timestamped download filename, e.g. intervention-results-20261014-2030.xlsx */
function intervention_export_filename(string $ext): string {
    $now = new DateTime('now', new DateTimeZone('Asia/Manila'));
    return 'intervention-results-' . $now->format('Ymd-Hi') . '.' . $ext;
}

/** All result rows for export, oldest first (append order). */
function intervention_fetch_results(PDO $pdo, ?int $testId = null): array {
    if ($testId !== null && $testId > 0) {
        $stmt = $pdo->prepare(
            'SELECT * FROM intervention_results WHERE test_id = :t ORDER BY submitted_at ASC, id ASC'
        );
        $stmt->execute([':t' => $testId]);
    } else {
        $stmt = $pdo->query('SELECT * FROM intervention_results ORDER BY submitted_at ASC, id ASC');
    }
    return $stmt->fetchAll();
}

/**
 * OOXML-safe sheet name: illegal chars replaced, capped at 31 chars,
 * deduplicated against $used.
 */
function intervention_sheet_name(string $title, array &$used): string {
    $name = trim(preg_replace('/[\[\]\:\*\?\/\\\\]/', '-', $title) ?? '');
    if ($name === '') $name = 'Results';
    $name = mb_substr($name, 0, 31);
    $base = $name;
    $i = 2;
    while (isset($used[$name])) {
        $suffix = ' (' . $i . ')';
        $name = mb_substr($base, 0, 31 - mb_strlen($suffix)) . $suffix;
        $i++;
    }
    $used[$name] = true;
    return $name;
}

function intervention_xml_esc(string $s): string {
    return htmlspecialchars($s, ENT_XML1 | ENT_COMPAT, 'UTF-8');
}

/** Builds the complete .xlsx binary. Throws RuntimeException when ZipArchive is missing. */
function intervention_build_xlsx(PDO $pdo, ?int $testId = null): string {
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('Excel export needs the PHP zip extension; use CSV instead.');
    }

    // Gather sheets: one per test (+ "All Results" when unfiltered).
    $sheets = []; // each: ['name' => sheet, 'rows' => result rows]
    $used = [];
    if ($testId !== null && $testId > 0) {
        $stmt = $pdo->prepare('SELECT title FROM intervention_tests WHERE id = :t');
        $stmt->execute([':t' => $testId]);
        $title = ($stmt->fetchColumn() ?: 'Assessment');
        $sheets[] = [
            'name' => intervention_sheet_name((string) $title, $used),
            'rows' => intervention_fetch_results($pdo, $testId),
        ];
    } else {
        $tests = $pdo->query('SELECT id, title FROM intervention_tests ORDER BY subject, grade_label, part')->fetchAll();
        foreach ($tests as $t) {
            $sheets[] = [
                'name' => intervention_sheet_name((string) $t['title'], $used),
                'rows' => intervention_fetch_results($pdo, (int) $t['id']),
            ];
        }
        // Orphaned rows (their test was deleted) still export via the snapshot title.
        $orphans = $pdo->query(
            'SELECT * FROM intervention_results WHERE test_id IS NULL ORDER BY submitted_at ASC, id ASC'
        )->fetchAll();
        if (!empty($orphans)) {
            $sheets[] = ['name' => intervention_sheet_name('Archived Assessments', $used), 'rows' => $orphans];
        }
    }

    $widths = [22, 30, 26, 12, 14, 34, 10, 10, 10, 10, 40, 18]; // per-column readable widths
    $colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

    $contentTypes = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    $workbookSheets = '';
    $workbookRels = '';
    $n = 0;
    foreach ($sheets as $s) {
        $n++;
        $contentTypes .= '<Override PartName="/xl/worksheets/sheet' . $n . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        $workbookSheets .= '<sheet name="' . intervention_xml_esc($s['name']) . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
        $workbookRels .= '<Relationship Id="rId' . $n . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $n . '.xml"/>';
    }
    $contentTypes .= '</Types>';
    $rels = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        . '</Relationships>';
    $workbook = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        . '<sheets>' . $workbookSheets . '</sheets></workbook>';
    $workbookRelsXml = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        . '<Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        . $workbookRels . '</Relationships>';
    // fonts: 0 normal, 1 bold. fills: 0 none, 1 header blue-grey. cellXfs:
    // 0 default, 1 header (bold+fill), 2 percent (built-in numFmt 10 = 0.00%).
    $styles = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        . '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        . '<fills count="2"><fill><patternFill patternType="none"/></fill>'
        . '<fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill></fills>'
        . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="3">'
        . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        . '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
        . '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        . '</cellXfs></styleSheet>';

    $sheetXml = [];
    $n = 0;
    foreach ($sheets as $s) {
        $n++;
        $xml = '<?xml version="1.0" encoding="UTF-8"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0">'
            . '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            . '</sheetView></sheetViews><cols>';
        foreach ($widths as $i => $w) {
            $c = $i + 1;
            $xml .= '<col min="' . $c . '" max="' . $c . '" width="' . $w . '" customWidth="1"/>';
        }
        $xml .= '</cols><sheetData>';
        // Header row (bold style s=1).
        $xml .= '<row r="1">';
        foreach (INTERVENTION_EXPORT_HEADERS as $i => $h) {
            $xml .= '<c r="' . $colLetters[$i] . '1" s="1" t="inlineStr"><is><t>'
                . intervention_xml_esc($h) . '</t></is></c>';
        }
        $xml .= '</row>';
        $r = 1;
        foreach ($s['rows'] as $row) {
            $r++;
            $total = max(1, (int) $row['total']);
            $frac = ((int) $row['correct']) / $total;
            $writtenCell = isset($row['test_id']) && $row['test_id'] !== null
                ? intervention_written_export($pdo, (int) $row['test_id'], $row['answers_json'] ?? null)
                : intervention_written_export($pdo, null, $row['answers_json'] ?? null);
            $cells = [
                ['t' => 's', 'v' => (string) ($row['submitted_at'] ?? '')],
                ['t' => 's', 'v' => (string) ($row['email'] ?? '')],
                ['t' => 's', 'v' => (string) ($row['full_name'] ?? '')],
                ['t' => 's', 'v' => (string) ($row['grade_level'] ?? '')],
                ['t' => 's', 'v' => (string) ($row['section'] ?? '')],
                ['t' => 's', 'v' => (string) ($row['test_title'] ?? '')],
                ['t' => 'n', 'v' => (string) (int) ($row['correct'] ?? 0)],
                ['t' => 'n', 'v' => (string) (int) ($row['total'] ?? 0)],
                ['t' => 'p', 'v' => number_format($frac, 4, '.', '')],
                ['t' => 's', 'v' => !empty($row['passed']) ? 'PASSED' : 'FAILED'],
                ['t' => 's', 'v' => $writtenCell],
                ['t' => 's', 'v' => intervention_violations_export((int) ($row['violations'] ?? 0))],
            ];
            $xml .= '<row r="' . $r . '">';
            foreach ($cells as $i => $cell) {
                $ref = $colLetters[$i] . $r;
                if ($cell['t'] === 'n') {
                    $xml .= '<c r="' . $ref . '"><v>' . $cell['v'] . '</v></c>';
                } elseif ($cell['t'] === 'p') {
                    $xml .= '<c r="' . $ref . '" s="2"><v>' . $cell['v'] . '</v></c>';
                } else {
                    $xml .= '<c r="' . $ref . '" t="inlineStr"><is><t xml:space="preserve">'
                        . intervention_xml_esc($cell['v']) . '</t></is></c>';
                }
            }
            $xml .= '</row>';
        }
        $lastRef = 'L' . max($r, 1);
        $xml .= '</sheetData><autoFilter ref="A1:' . $lastRef . '"/></worksheet>';
        $sheetXml[$n] = $xml;
    }

    $tmp = tempnam(sys_get_temp_dir(), 'aghi_xlsx');
    if ($tmp === false) {
        throw new RuntimeException('Could not create a temporary file for export.');
    }
    try {
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not build the Excel file.');
        }
        $zip->addFromString('[Content_Types].xml', $contentTypes);
        $zip->addFromString('_rels/.rels', $rels);
        $zip->addFromString('xl/workbook.xml', $workbook);
        $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRelsXml);
        $zip->addFromString('xl/styles.xml', $styles);
        foreach ($sheetXml as $i => $xml) {
            $zip->addFromString('xl/worksheets/sheet' . $i . '.xml', $xml);
        }
        $zip->close();
        $bin = file_get_contents($tmp);
        if ($bin === false) {
            throw new RuntimeException('Could not read the built Excel file.');
        }
        return $bin;
    } finally {
        @unlink($tmp);
    }
}

/** CSV fallback (Excel-compatible via BOM). Same headers, same row order. */
function intervention_build_csv(PDO $pdo, ?int $testId = null): string {
    if ($testId !== null && $testId > 0) {
        $groups = [$testId];
    } else {
        $groups = array_map(
            fn($t) => (int) $t['id'],
            $pdo->query('SELECT id FROM intervention_tests ORDER BY subject, grade_label, part')->fetchAll()
        );
        $groups[] = null; // orphans last
    }
    $fh = fopen('php://temp', 'r+');
    if ($fh === false) {
        throw new RuntimeException('Could not build the CSV export.');
    }
    fwrite($fh, "\xEF\xBB\xBF"); // BOM so Excel detects UTF-8 (ñ, accents)
    fputcsv($fh, INTERVENTION_EXPORT_HEADERS);
    foreach ($groups as $gid) {
        foreach (intervention_fetch_results($pdo, $gid) as $row) {
            $total = max(1, (int) $row['total']);
            $writtenCell = isset($row['test_id']) && $row['test_id'] !== null
                ? intervention_written_export($pdo, (int) $row['test_id'], $row['answers_json'] ?? null)
                : intervention_written_export($pdo, null, $row['answers_json'] ?? null);
            fputcsv($fh, [
                (string) ($row['submitted_at'] ?? ''),
                (string) ($row['email'] ?? ''),
                (string) ($row['full_name'] ?? ''),
                (string) ($row['grade_level'] ?? ''),
                (string) ($row['section'] ?? ''),
                (string) ($row['test_title'] ?? ''),
                (int) ($row['correct'] ?? 0),
                (int) ($row['total'] ?? 0),
                round(((int) ($row['correct'] ?? 0)) / $total * 100, 1),
                !empty($row['passed']) ? 'PASSED' : 'FAILED',
                $writtenCell,
                intervention_violations_export((int) ($row['violations'] ?? 0)),
            ]);
        }
    }
    rewind($fh);
    $out = stream_get_contents($fh);
    fclose($fh);
    return $out === false ? '' : $out;
}
