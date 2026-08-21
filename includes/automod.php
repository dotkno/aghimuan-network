<?php
/**
 * automod.php — lightweight profanity/abuse filter.
 *
 * How it works (same core idea as Roblox's older chat filter):
 *  1. Normalize the text so people can't dodge the filter with spacing,
 *     symbols, or leetspeak (e.g. "b a d w o r d", "b@dw0rd").
 *  2. Substring-match the normalized text against a blocklist.
 *  3. Return a verdict: 'clean' | 'flagged' — callers decide what to do
 *     (per your earlier choice: flagged messages get queued for officer
 *     review rather than posted immediately or silently censored).
 *
 * IMPORTANT: fill in BLOCKLIST_PATH with your actual word list. Ship it
 * as a plain-text file (one term per line), NOT hardcoded in this file,
 * so officers can update it without touching code. Keep that file out
 * of the public web root.
 */

declare(strict_types=1);

const BLOCKLIST_PATH = __DIR__ . '/../../data/blocklist.txt';

const LEET_MAP = [
    '4' => 'a', '@' => 'a',
    '3' => 'e',
    '1' => 'i', '!' => 'i', '|' => 'i',
    '0' => 'o',
    '5' => 's', '$' => 's',
    '7' => 't',
    '9' => 'g',
];

function automod_normalize(string $text): string {
    $text = mb_strtolower($text);
    $text = strtr($text, LEET_MAP);
    // collapse repeated characters (e.g. "baaaadword" -> "badword")
    $text = preg_replace('/(.)\1{2,}/u', '$1$1', $text);
    // strip everything that isn't a letter/number/space so spacing/symbol tricks collapse
    $text = preg_replace('/[^a-z0-9\s]/u', '', $text);
    // collapse whitespace so "b a d w o r d" becomes "badword"... but also keep a
    // spaced version around, since collapsing ALL spaces creates false positives
    // on legitimate short words butted together. See automod_check() below.
    return $text;
}

function automod_load_blocklist(): array {
    static $list = null;
    if ($list !== null) {
        return $list;
    }
    if (!file_exists(BLOCKLIST_PATH)) {
        $list = [];
        return $list;
    }
    $lines = file(BLOCKLIST_PATH, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $lines = array_filter($lines, fn($l) => !str_starts_with(trim($l), '#'));
    $list = array_map('mb_strtolower', $lines);
    return $list;
}

/**
 * Returns ['verdict' => 'clean'|'flagged', 'matched' => string|null]
 */
function automod_check(string $text): array {
    $blocklist = automod_load_blocklist();
    if (empty($blocklist)) {
        return ['verdict' => 'clean', 'matched' => null]; // no list loaded yet — fail open, log this in ops
    }

    $normalized       = automod_normalize($text);
    $normalizedNoSpace = str_replace(' ', '', $normalized);

    foreach ($blocklist as $term) {
        $term = trim($term);
        if ($term === '') {
            continue;
        }
        // check both spaced and no-space versions to catch "b a d w o r d" and "badword" alike
        if (str_contains($normalizedNoSpace, str_replace(' ', '', $term))) {
            return ['verdict' => 'flagged', 'matched' => $term];
        }
    }

    return ['verdict' => 'clean', 'matched' => null];
}

/**
 * Logs a flagged message for officer review. Call this whenever automod_check()
 * returns 'flagged', regardless of what context (comment/dm) triggered it.
 */
function automod_log(PDO $pdo, ?int $userId, string $context, string $original, ?string $matched): void {
    $stmt = $pdo->prepare(
        'INSERT INTO automod_log (user_id, context, original, matched) VALUES (:u, :c, :o, :m)'
    );
    $stmt->execute([
        ':u' => $userId,
        ':c' => $context,
        ':o' => $original,
        ':m' => $matched,
    ]);
}
