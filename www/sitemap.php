<?php
/**
 * www/sitemap.php — dynamic sitemap.xml generator.
 *
 * Served publicly at /sitemap.xml via the nginx rewrite
 * (location = /sitemap.xml { rewrite ^ /sitemap.php last; }).
 * Referenced from www/robots.txt and Google Search Console.
 *
 * Static pages get lastmod from filemtime(). Approved creations are
 * appended from the `creations` table (status='approved'). If the DB
 * read fails for any reason, the static list is still emitted so the
 * sitemap is never broken XML.
 *
 * Spec: https://www.sitemaps.org/protocol.html — only <loc> is
 * required; changefreq/priority are hints. All URLs same host.
 */

declare(strict_types=1);

header('Content-Type: application/xml; charset=utf-8');

$esc = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

// [path, priority, changefreq] — public 200-OK pages only. Gated pages
// (library-home.php, library/*, creations/submit.html) 302 when logged
// out, so they are deliberately excluded.
$static = [
    ['/', 1.0, 'weekly', 'index.html'],
    ['/about.html', 0.8, 'monthly', 'about.html'],
    ['/faq.html', 0.8, 'monthly', 'faq.html'],
    ['/reviewers.php', 0.8, 'monthly', 'reviewers.php'],
    ['/creations/index.html', 0.8, 'weekly', 'creations/index.html'],
    ['/resources/index.html', 0.8, 'weekly', 'resources/index.html'],
    ['/games/index.html', 0.8, 'monthly', 'games/index.html'],
    ['/games/game1.html', 0.6, 'monthly', 'games/game1.html'],
    ['/games/game2.html', 0.6, 'monthly', 'games/game2.html'],
    ['/games/game3.html', 0.6, 'monthly', 'games/game3.html'],
    ['/games/game4.html', 0.6, 'monthly', 'games/game4.html'],
    ['/games/aghiclaw.html', 0.6, 'monthly', 'games/aghiclaw.html'],
    ['/games/aghi-sudoku.html', 0.6, 'monthly', 'games/aghi-sudoku.html'],
    ['/games/aghi-aim.html', 0.6, 'monthly', 'games/aghi-aim.html'],
    ['/games/aghi-duo-escape.html', 0.6, 'monthly', 'games/aghi-duo-escape.html'],
    ['/signup.php', 0.5, 'monthly', 'signup.php'],
    ['/login.php', 0.5, 'monthly', 'login.php'],
];

$urls = [];
foreach ($static as [$path, $prio, $freq, $file]) {
    $full = __DIR__ . '/' . $file;
    $lastmod = is_file($full) ? date('Y-m-d', filemtime($full)) : date('Y-m-d');
    $urls[] = [
        'loc' => 'https://aghimuan.online' . $path,
        'lastmod' => $lastmod,
        'changefreq' => $freq,
        'priority' => number_format($prio, 1),
    ];
}

// Approved creations — public deep links (creation.html 200-OK for all).
try {
    require_once __DIR__ . '/includes/db.php';
    $pdo = get_db();
    $stmt = $pdo->query(
        "SELECT id, created_at FROM creations WHERE status = 'approved' ORDER BY id ASC"
    );
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int) ($row['id'] ?? 0);
        if ($id <= 0) continue;
        $ts = strtotime((string) ($row['created_at'] ?? ''));
        $urls[] = [
            'loc' => 'https://aghimuan.online/creations/creation.html?id=' . $id,
            'lastmod' => $ts !== false ? date('Y-m-d', $ts) : date('Y-m-d'),
            'changefreq' => 'monthly',
            'priority' => '0.5',
        ];
    }
} catch (Throwable $e) {
    // Static list above still emitted — sitemap stays valid.
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo "  <url>\n";
    echo '    <loc>' . $esc($u['loc']) . "</loc>\n";
    echo '    <lastmod>' . $esc($u['lastmod']) . "</lastmod>\n";
    echo '    <changefreq>' . $esc($u['changefreq']) . "</changefreq>\n";
    echo '    <priority>' . $esc($u['priority']) . "</priority>\n";
    echo "  </url>\n";
}
echo '</urlset>' . "\n";
