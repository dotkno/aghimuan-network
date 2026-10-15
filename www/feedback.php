<?php
// feedback.php — temporary feedback form. Session + CSRF bootstrapped here,
// BEFORE any output (same rule as index.html: csrf_token() first).
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/feedback-lib.php';

$pdo = get_db();
$user = current_user($pdo);
$st = feedback_status($pdo);
$csrf = $user ? csrf_token() : '';
$own = $user ? feedback_get_own($pdo, (int) $user['id']) : null;
$ownAnswers = ($own && is_array($own['answers'])) ? $own['answers'] : [];

$e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');

$prefillEmail = $user ? (string) ($user['email'] ?? '') : '';
$prefillName = $user ? (string) ($user['username'] ?? '') : '';
if ($own) {
    // Editing: show what was actually submitted (editable snapshot),
    // not the live session values.
    $row = $pdo->prepare('SELECT email, username FROM feedback_responses WHERE user_id = :u');
    $row->execute([':u' => (int) $user['id']]);
    if ($prev = $row->fetch()) {
        $prefillEmail = (string) ($prev['email'] ?? '');
        $prefillName = (string) ($prev['username'] ?? '');
    }
}
$prefillGrade = $own ? ($own['grade'] ?? '') : ($user['grade'] ?? '');
$prefillStrand = $own ? ($own['strand'] ?? '') : ($user['strand'] ?? '');

// Human labels for choice values (stored values stay lowercase codes).
$choiceLabels = [
    'q19' => ['daily' => 'Daily', 'few-times-a-week' => 'A few times a week', 'weekly' => 'Weekly', 'rarely' => 'Rarely'],
    'q20' => ['phone' => 'Phone', 'desktop' => 'Desktop', 'both' => 'Both'],
    'q23' => ['et' => 'ET', 'css' => 'CSS', 'cp' => 'CP', 'mil' => 'MIL', 'vgd' => 'VGD', 'none' => "I haven't used them"],
    'q24' => ['yes' => 'Yes, you may email me', 'no' => 'No'],
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<?php if ($csrf !== ''): ?><meta name="csrf-token" content="<?php echo $e($csrf); ?>"><?php endif; ?>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<title>Share feedback — Aghimuan</title>
<style>
:root { --bg:#0c0e14; --panel:#161a26; --border:#26304a; --accent:#3096C7; --accent2:#55F1F8; --text:#F1F2F5; --muted:#8891a8; --danger:#ff5c6a; --success:#4dffa0; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:radial-gradient(circle at 15% 0%, #131a2c 0%, var(--bg) 45%) fixed; color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.5; min-height:100vh; }
.wrap { max-width:720px; margin:0 auto; padding:28px 18px 80px; }
.brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--text); margin-bottom:22px; }
.brand img { width:40px; height:40px; border-radius:10px; }
.brand strong { color:var(--accent2); letter-spacing:.2px; }
.card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:clamp(18px,4vw,26px); margin-bottom:18px; }
.card h1 { font-size:1.3rem; margin-bottom:6px; }
.card h1 .tmp { font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#05060c; background:linear-gradient(135deg,var(--accent2),var(--accent)); border-radius:6px; padding:2px 8px; vertical-align:middle; margin-left:8px; }
.lede { color:var(--muted); font-size:.92rem; margin-bottom:4px; }
.notice { margin-top:12px; padding:10px 14px; border-radius:8px; background:#123321; border:1px solid #1f6b3f; color:#8affc1; font-size:.88rem; }
fieldset { border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:16px; }
legend { padding:0 10px; color:var(--accent2); font-weight:700; font-size:.95rem; }
.q { margin-bottom:18px; }
.q:last-child { margin-bottom:4px; }
.q-label { display:block; font-weight:600; font-size:.92rem; margin-bottom:8px; }
.q-label .req { color:var(--accent2); font-weight:400; font-size:.78rem; margin-left:6px; }
.stars { display:flex; gap:8px; }
.stars label { flex:1; text-align:center; padding:10px 4px; border:1px solid var(--border); border-radius:8px; cursor:pointer; font-weight:700; color:var(--muted); transition:border-color .15s, color .15s, background .15s; }
.stars input { position:absolute; opacity:0; pointer-events:none; }
.stars label:has(input:checked) { border-color:var(--accent2); color:var(--accent2); background:rgba(85,241,248,.08); }
.stars label:has(input:focus-visible) { outline:2px solid var(--accent2); outline-offset:2px; }
textarea, input[type=text], input[type=email] { width:100%; padding:11px 13px; background:#05060c; color:#fff; border:1px solid var(--border); border-radius:8px; font-size:.92rem; font-family:inherit; }
textarea:focus, input:focus { outline:none; border-color:var(--accent); }
textarea { min-height:86px; resize:vertical; }
.hint { color:var(--muted); font-size:.76rem; margin-top:5px; display:flex; justify-content:space-between; }
.picks { display:flex; gap:8px; flex-wrap:wrap; }
.picks label { padding:9px 14px; border:1px solid var(--border); border-radius:20px; cursor:pointer; font-size:.86rem; color:var(--muted); }
.picks input { position:absolute; opacity:0; pointer-events:none; }
.picks label:has(input:checked) { border-color:var(--accent2); color:var(--accent2); background:rgba(85,241,248,.08); }
.idgrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:560px){ .idgrid { grid-template-columns:1fr; } }
.flabel { display:block; color:var(--muted); font-size:.76rem; text-transform:uppercase; letter-spacing:.04em; margin-bottom:5px; }
.btn { background:linear-gradient(135deg,var(--accent),#2478a3); color:#fff; border:none; padding:13px; width:100%; border-radius:8px; font-weight:700; font-size:.95rem; cursor:pointer; }
.btn:hover { filter:brightness(1.12); }
.btn:disabled { opacity:.6; cursor:wait; }
.msg { padding:11px 14px; border-radius:8px; font-size:.88rem; border:1px solid; margin-bottom:16px; display:none; }
.msg.err { display:block; background:#3a1a1e; color:#ff9ba3; border-color:#6b2530; }
.msg.okm { display:block; background:#123321; color:#8affc1; border-color:#1f6b3f; }
.back { display:inline-block; margin-top:14px; color:var(--muted); font-size:.86rem; }
.priv { color:var(--muted); font-size:.78rem; margin-top:12px; }
</style>
</head>
<body>
<div class="wrap">
    <a class="brand" href="index.html"><img src="CLUB LOGO.png" alt="Aghimuan logo"><span><strong>AGHIMUAN.ONLINE</strong><br><small style="color:var(--muted)">Share feedback</small></span></a>

    <?php if (!$st['enabled']): ?>
        <div class="card">
            <h1>Feedback <span class="tmp">Paused</span></h1>
            <p class="lede"><?php echo $e($st['closed_message']); ?></p>
            <?php if ($st['notice'] !== ''): ?><div class="notice"><?php echo $e($st['notice']); ?></div><?php endif; ?>
            <a class="back" href="index.html">&larr; Back home</a>
        </div>
    <?php elseif (!$user): ?>
        <div class="card">
            <h1>Share feedback <span class="tmp">Temporary</span></h1>
            <p class="lede">Please log in first so we can attach your response to your account (one response per person). Your gmail and username are prefilled — grade and strand are optional.</p>
            <?php if ($st['notice'] !== ''): ?><div class="notice"><?php echo $e($st['notice']); ?></div><?php endif; ?>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <a class="btn" style="text-align:center; text-decoration:none;" href="login.php">Log in</a>
                <a class="btn" style="text-align:center; text-decoration:none; background:transparent; border:1px solid var(--border);" href="signup.php">Sign up</a>
            </div>
            <a class="back" href="index.html">&larr; Back home</a>
        </div>
    <?php else: ?>
        <div class="card">
            <h1><?php echo $own ? 'Update your feedback' : 'Share feedback'; ?> <span class="tmp">Temporary</span></h1>
            <p class="lede">Hi, <?php echo $e($user['username']); ?>! At least 20 questions about your experience — especially our interactive reviewers: what helps, what should we improve or remove. Takes ~5 minutes.</p>
            <?php if ($st['notice'] !== ''): ?><div class="notice"><?php echo $e($st['notice']); ?></div><?php endif; ?>
        </div>

        <div class="msg" id="fbMsg" role="alert"></div>

        <form id="fbForm" novalidate>
            <fieldset>
                <legend>About you (prefilled)</legend>
                <div class="idgrid">
                    <div><label class="flabel" for="fbEmail">Gmail (editable — blank stays blank)</label><input type="email" id="fbEmail" maxlength="254" value="<?php echo $e($prefillEmail); ?>" autocomplete="email"></div>
                    <div><label class="flabel" for="fbName">Username (editable)</label><input type="text" id="fbName" maxlength="20" value="<?php echo $e($prefillName); ?>" autocomplete="username"></div>
                    <div><label class="flabel" for="fbGrade">Grade (optional)</label><input type="text" id="fbGrade" maxlength="40" placeholder="e.g. G11 — or leave blank" value="<?php echo $e($prefillGrade); ?>"></div>
                    <div><label class="flabel" for="fbStrand">Strand (optional)</label><input type="text" id="fbStrand" maxlength="40" placeholder="e.g. ICT — or leave blank" value="<?php echo $e($prefillStrand); ?>"></div>
                </div>
            </fieldset>

            <fieldset>
                <legend>Your experience (rate 1–5)</legend>
                <?php foreach (FEEDBACK_QUESTIONS as $q): ?>
                    <?php if ($q['type'] !== 'rating') continue; ?>
                    <div class="q">
                        <span class="q-label"><?php echo $e($q['label']); ?><span class="req">required</span></span>
                        <div class="stars" role="radiogroup" aria-label="<?php echo $e($q['label']); ?>">
                            <?php for ($i = 1; $i <= 5; $i++): ?>
                                <label><input type="radio" name="answers[<?php echo $e($q['key']); ?>]" value="<?php echo $i; ?>"<?php echo (isset($ownAnswers[$q['key']]) && (int) $ownAnswers[$q['key']] === $i) ? ' checked' : ''; ?>><?php echo $i; ?></label>
                            <?php endfor; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </fieldset>

            <fieldset>
                <legend>Your thoughts (written)</legend>
                <?php foreach (FEEDBACK_QUESTIONS as $q): ?>
                    <?php if ($q['type'] !== 'text') continue; ?>
                    <div class="q">
                        <label class="q-label" for="ta-<?php echo $e($q['key']); ?>"><?php echo $e($q['label']); ?><?php echo !empty($q['required']) ? '<span class="req">required</span>' : '<span class="req">optional</span>'; ?></label>
                        <textarea id="ta-<?php echo $e($q['key']); ?>" name="answers[<?php echo $e($q['key']); ?>]" maxlength="<?php echo FEEDBACK_MAX_TEXT_LENGTH; ?>" data-count><?php echo $e($ownAnswers[$q['key']] ?? ''); ?></textarea>
                        <div class="hint"><span>Be honest — specifics help most.</span><span><span data-count-for="<?php echo $e($q['key']); ?>"><?php echo mb_strlen((string) ($ownAnswers[$q['key']] ?? '')); ?></span> / <?php echo FEEDBACK_MAX_TEXT_LENGTH; ?></span></div>
                    </div>
                <?php endforeach; ?>
            </fieldset>

            <fieldset>
                <legend>Reviewers + about you</legend>
                <?php foreach (FEEDBACK_QUESTIONS as $q): ?>
                    <?php if ($q['type'] !== 'choice') continue; ?>
                    <div class="q">
                        <span class="q-label"><?php echo $e($q['label']); ?><span class="req">required</span></span>
                        <div class="picks" role="radiogroup" aria-label="<?php echo $e($q['label']); ?>">
                            <?php foreach (($choiceLabels[$q['key']] ?? []) as $val => $lab): ?>
                                <label><input type="radio" name="answers[<?php echo $e($q['key']); ?>]" value="<?php echo $e($val); ?>"<?php echo (isset($ownAnswers[$q['key']]) && (string) $ownAnswers[$q['key']] === (string) $val) ? ' checked' : ''; ?>><?php echo $e($lab); ?></label>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </fieldset>

            <button type="submit" class="btn" id="fbSubmit"><?php echo $own ? 'Update feedback' : 'Send feedback'; ?></button>
            <p class="priv">One response per person — sending again updates yours. Only club admins can see responses; you can blank your gmail above and it stays blank.</p>
            <a class="back" href="index.html">&larr; Back home</a>
        </form>

        <script>
        (function () {
            var form = document.getElementById('fbForm');
            var msg = document.getElementById('fbMsg');
            var btn = document.getElementById('fbSubmit');
            var csrf = document.querySelector('meta[name="csrf-token"]');
            csrf = csrf ? csrf.getAttribute('content') : '';

            function say(kind, text) {
                msg.className = 'msg ' + kind;
                msg.textContent = text;
                msg.scrollIntoView({ block: 'nearest' });
            }

            document.querySelectorAll('textarea[data-count]').forEach(function (ta) {
                var key = ta.getAttribute('name').match(/\[(q\d+)\]/)[1];
                var out = document.querySelector('[data-count-for="' + key + '"]');
                ta.addEventListener('input', function () { if (out) out.textContent = ta.value.length; });
            });

            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var answers = {};
                form.querySelectorAll('input[type="radio"]:checked').forEach(function (r) {
                    var m = r.getAttribute('name').match(/\[(q\d+)\]/);
                    if (m) {
                        var v = r.value;
                        if (/^q([1-9]|10)$/.test(m[1])) v = parseInt(v, 10);
                        answers[m[1]] = v;
                    }
                });
                form.querySelectorAll('textarea[name]').forEach(function (ta) {
                    var m = ta.getAttribute('name').match(/\[(q\d+)\]/);
                    if (m) answers[m[1]] = ta.value;
                });

                btn.disabled = true;
                fetch('api/feedback.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        csrf_token: csrf,
                        email: document.getElementById('fbEmail').value,
                        username: document.getElementById('fbName').value,
                        grade: document.getElementById('fbGrade').value,
                        strand: document.getElementById('fbStrand').value,
                        answers: answers
                    })
                }).then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
                .then(function (res) {
                    btn.disabled = false;
                    if (res.s === 200 && res.d && res.d.ok) {
                        say('okm', 'Thanks! Your feedback was saved. You can update it anytime while the form is open.');
                        btn.textContent = 'Update feedback';
                    } else {
                        say('err', (res.d && res.d.error) ? res.d.error : 'Something went wrong. Try again.');
                    }
                }).catch(function () {
                    btn.disabled = false;
                    say('err', 'Network error. Check your connection and try again.');
                });
            });
        })();
        </script>
    <?php endif; ?>
</div>
</body>
</html>
