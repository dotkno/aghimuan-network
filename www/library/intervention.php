<?php
/**
 * library/intervention.php: Intervention Program test runner.
 *
 * Lives INSIDE the library: reviewer-session gated (verified @pcu.edu.ph,
 * no Aghimuan account needed). When admins disable the program this page
 * shows a paused notice; questions never reach the DOM while disabled.
 * Results show SCORE ONLY. Per-question review is intentionally absent so
 * answer keys cannot leak to later takers.
 */

require_once __DIR__ . '/includes/reviewer-session.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/intervention-lib.php';

require_reviewer_access();

$pdo = get_db();
$status = intervention_status($pdo);
$csrf = intervention_csrf_token();
$email = (string) reviewer_session_email();
$expiresAt = reviewer_session_expires_at();
$minsLeft = $expiresAt !== null ? (int) floor(max(0, $expiresAt - time()) / 60) : null;

$slug = trim((string) ($_GET['test'] ?? ''));
$taking = null;
$takeError = null;
$stage = null;        // null | 'profile' | 'question' | 'finish'
$stageIndex = 0;      // answered count == index into shuffled order
$stageQuestion = null;
$stageRemaining = 0;
$stageBudget = 0;
if ($slug !== '' && $status['enabled']) {
    $taking = intervention_get_test($pdo, $slug);
    if ($taking === null) {
        $takeError = 'That assessment does not exist or is no longer available.';
    } else {
        $used = intervention_attempts_used($pdo, $taking['id'], $email);
        $taking['attempts_used'] = $used;
        $taking['attempts_left'] = $taking['max_attempts'] > 0
            ? max(0, $taking['max_attempts'] - $used) : null;
        if ($taking['attempts_left'] === 0) {
            $takeError = 'You have used all attempts for this assessment.';
        } else {
            $attempt = intervention_attempt_get($taking['id']);
            $profile = is_array($attempt) ? ($attempt['profile'] ?? null) : null;
            if (!is_array($profile)) {
                $stage = 'profile';
            } else {
                $order = $attempt['order'] ?? [];
                $answered = is_array($attempt['answers'] ?? null) ? count($attempt['answers']) : 0;
                if ($answered >= count($order) || empty($order)) {
                    $stage = 'finish';
                } else {
                    // Forward-only: any ?q= that disagrees lands back here.
                    $want = isset($_GET['q']) ? (int) $_GET['q'] : $answered;
                    if ($want !== $answered) {
                        header('Location: intervention.php?test=' . urlencode($slug) . '&q=' . $answered);
                        exit;
                    }
                    $stage = 'question';
                    $stageIndex = $answered;
                    $pos = (int) $order[$answered];
                    foreach (intervention_get_questions($pdo, $taking['id'], false) as $q) {
                        if ((int) $q['position'] === $pos) {
                            $stageQuestion = $q;
                            break;
                        }
                    }
                    if ($stageQuestion === null) {
                        $takeError = 'That question is no longer available.';
                    } else {
                        $stageBudget = intervention_question_budget($stageQuestion);
                        $qStart = $attempt['q_started'][$answered] ?? null;
                        if ($qStart === null) {
                            // Defensive only: clocks are normally armed by the
                            // answer/profile POSTs, never by renders.
                            $qStart = time();
                        }
                        $stageRemaining = max(0, $stageBudget - (time() - (int) $qStart));
                    }
                }
            }
        }
    }
} elseif ($slug !== '' && !$status['enabled']) {
    $takeError = null; // paused branch below handles it
}

$tests = $status['enabled'] ? intervention_list($pdo, true, $email) : [];
// Heads-up shown while live (list + profile step). Admins override it with
// the notice field; the fallback tells uninstructed students to stay out.
$headsUp = $status['notice'] !== ''
    ? $status['notice']
    : 'Heads up: do not answer any test unless your teacher told you to.';
$e = fn($s) => htmlspecialchars((string) ($s ?? ''), ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Aghimuan Library: Intervention Program</title>
<meta name="description" content="Intervention assessments for PCU-D ICT students. PCU Gmail sign-in required.">
<meta name="csrf-token" content="<?php echo $e($csrf); ?>">
<link rel="canonical" href="https://aghimuan.online/library/intervention.php">
<link rel="describedby" href="https://aghimuan.online/llms.txt">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/library-core.css">
<style>
  :root { --bg:#080b14; --pink:#3096C7; --cyan:#55F1F8; }
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; min-height:100%; width:100%; overscroll-behavior:none; }
  html { background:#03030f; }
  html, body { overflow-x:clip; }
  body { font-family:'Rajdhani',sans-serif; background:radial-gradient(ellipse at 50% 20%, #0a1029 0%, var(--bg) 80%); color:#fff; min-height:100vh; }
  .font-display { font-family:'Orbitron',sans-serif; letter-spacing:0.05em; }
  .neon-pink { color:var(--pink); text-shadow:0 0 8px var(--pink),0 0 16px rgba(48,150,199,0.6); }
  .neon-cyan { color:var(--cyan); text-shadow:0 0 8px var(--cyan),0 0 16px rgba(85,241,248,0.6); }
  .bg-grid {
    background-image:
      linear-gradient(rgba(48,150,199,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(85,241,248,0.05) 1px, transparent 1px);
    background-size:32px 32px;
  }
  .btn-neon { transition:all .2s cubic-bezier(0.16, 1, 0.3, 1); user-select:none; cursor:pointer; }
  .btn-neon:hover { transform:translateY(-2px); filter:brightness(1.25); }
  .btn-neon:active { transform:translateY(1px) scale(.98); }
  .window-card {
    background:rgba(10, 15, 30, 0.75);
    backdrop-filter:blur(12px);
    -webkit-backdrop-filter:blur(12px);
    border:1px solid rgba(85, 241, 248, 0.2);
    box-shadow:0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }
  .field-input {
    width:100%; background:rgba(0,0,0,.45); border:1px solid rgba(85,241,248,.25);
    border-radius:8px; color:#fff; padding:.6rem .8rem; font-family:inherit; font-size:.95rem;
  }
  .field-input:focus { outline:none; border-color:var(--cyan); box-shadow:0 0 0 1px var(--cyan); }
  .choice-row { display:flex; align-items:flex-start; gap:.6rem; padding:.55rem .7rem; border:1px solid rgba(255,255,255,.1); border-radius:8px; cursor:pointer; }
  .choice-row:hover { border-color:rgba(85,241,248,.5); background:rgba(85,241,248,.05); }
  .choice-row input { margin-top:.25rem; accent-color:#55F1F8; }
  @keyframes fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation:fade-up .5s cubic-bezier(.16, 1, .3, 1) both; }
  /* Test content cannot be selected (casual copy-paste off; form fields stay usable). */
  .nocopy { user-select:none; -webkit-user-select:none; -ms-user-select:none; }
  .nocopy input, .nocopy textarea, .nocopy select { user-select:text; -webkit-user-select:text; -ms-user-select:text; }
  /* Rules card: loud on purpose. Students must see this before starting. */
  .rules-card { border:1px solid rgba(255,92,106,.6); background:rgba(255,92,106,.08); border-radius:12px; padding:1rem 1.1rem; }
  .rules-card h2 { margin:0; font-family:'Orbitron',sans-serif; font-size:.95rem; letter-spacing:.18em; color:#ff8b95; }
  .rules-card ul { margin:.6rem 0 0; padding-left:1.15rem; }
  .rules-card li { margin:.32rem 0; line-height:1.45; color:rgba(255,255,255,.88); }
  .rules-card li strong { color:#fff; }
  @media (prefers-reduced-motion: reduce) { .fade-up { animation:none !important; } }
</style>
</head>
<body class="bg-grid relative min-h-screen flex flex-col">

<div style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,transparent 42%,rgba(2,4,10,.85) 100%);z-index:1"></div>

<div class="relative z-[2] flex-1 flex flex-col">
<header class="sticky top-0 z-30 px-4 md:px-8 py-3 flex items-center justify-between bg-black/70 backdrop-blur-md border-b border-[#3096C7]/30">
  <div class="flex items-center gap-3 min-w-0">
    <a href="/library-home.php" class="btn-neon w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/50 border border-[#3096C7]/40 flex items-center justify-center text-[#3096C7] text-sm flex-shrink-0" title="Back to Library" aria-label="Back to Library">&#8592;</a>
    <span class="text-lg md:text-2xl font-display font-black neon-pink truncate">INTERVENTION</span>
    <span class="text-lg md:text-2xl font-display font-black text-white/80 truncate hidden sm:inline">PROGRAM</span>
  </div>
  <div class="flex items-center gap-3">
    <?php echo reviewer_account_inline(true); ?>
    <div class="text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-white/40 font-display hidden sm:inline">PCU-D &middot; ICT</div>
  </div>
</header>

<main class="px-3 sm:px-6 md:px-8 pt-6 md:pt-10 pb-12 max-w-4xl mx-auto w-full">
<?php if ($minsLeft !== null && $minsLeft < 30): ?>
  <div class="window-card rounded-xl p-4 mb-4 text-sm text-yellow-200/90">Your library sign-in expires in about <?php echo (int) $minsLeft; ?> minute(s). If it lapses mid-test, sign in again. Your filled answers stay on this page and you can resubmit.</div>
<?php endif; ?>

<?php if (!$status['enabled']): ?>
  <div class="window-card rounded-xl p-8 md:p-10 text-center fade-up">
    <div class="font-display font-black text-xl md:text-2xl neon-cyan tracking-widest">PROGRAM PAUSED</div>
    <p class="mt-3 text-white/70 leading-relaxed"><?php echo $status['notice'] !== '' ? $e($status['notice']) : 'The Intervention Program is currently unavailable. Please check back later or ask your teacher for the schedule.'; ?></p>
    <a href="/library-home.php" class="btn-neon inline-block mt-6 px-6 py-2.5 rounded-full border border-[#55F1F8]/50 text-[#55F1F8] font-display text-xs tracking-[0.2em]">BACK TO LIBRARY</a>
  </div>

<?php elseif ($taking !== null && $takeError === null): ?>
  <div id="take-root" class="window-card rounded-xl p-5 md:p-8 fade-up">
    <div class="text-[10px] font-display tracking-[0.25em] text-[#55F1F8]/80 uppercase"><?php echo $e($taking['subject']); ?> &middot; <?php echo $e($taking['grade_label']); ?> &middot; Part <?php echo (int) $taking['part']; ?></div>
    <h1 class="font-display font-black text-xl md:text-2xl mt-1"><?php echo $e($taking['title']); ?></h1>
    <p class="text-white/60 text-sm mt-1"><?php echo (int) $taking['total_questions']; ?> items<?php echo $taking['mcq_count'] < $taking['total_questions'] ? ' (' . (int) $taking['mcq_count'] . ' auto-scored, rest teacher-graded)' : ''; ?> &middot; passing score <?php echo (int) $taking['passing_score']; ?><?php echo $taking['attempts_left'] !== null ? ' &middot; ' . (int) $taking['attempts_left'] . ' attempt(s) left' : ' &middot; unlimited attempts'; ?></p>
    <div class="rounded-lg p-3 text-sm mt-3" style="border:1px solid rgba(255,206,107,.5); background:rgba(255,206,107,.07); color:#ffe1a1;"><?php echo $e($headsUp); ?></div>

    <div id="take-alert" class="hidden mt-4 rounded-lg p-3 text-sm"></div>

    <?php if ($stage === 'profile'): ?>
    <div class="rules-card nocopy mt-3" aria-label="Test rules. Cheating is not allowed.">
      <h2>READ THIS FIRST. NO CHEATING.</h2>
      <ul>
        <li><strong>30 seconds</strong> per question. <strong>100 seconds</strong> per written answer. Run out of time and it moves on. Blank counts as wrong.</li>
        <li><strong>One question per page. No back button.</strong> Your answer locks the moment you move on.</li>
        <li><strong>Stay on this tab.</strong> Leave it for more than <strong>3 seconds</strong> and you lose <strong>1 point</strong>. Every single time. Each one shows on your screen and on your teacher's report.</li>
        <li><strong>Your question order is shuffled.</strong> It is not the same as your classmate's. Copying answers from each other will not match.</li>
        <li><strong>Copying is turned off</strong> on this page. Text cannot be selected or copied.</li>
        <li>At the end you see <strong>only your score</strong>. You never see the answer key.</li>
      </ul>
    </div>
    <form id="profile-form" class="mt-5" novalidate>
      <fieldset class="rounded-xl border border-white/10 p-4">
        <legend class="px-2 text-[11px] font-display tracking-[0.25em] text-white/50 uppercase">Student details (not timed)</legend>
        <label class="block text-sm text-white/60">PCU Gmail (from your sign-in)
          <input class="field-input mt-1" type="email" value="<?php echo $e($email); ?>" disabled>
        </label>
        <div class="grid sm:grid-cols-3 gap-3 mt-3">
          <label class="block text-sm text-white/60 sm:col-span-1">Full name
            <input id="p-name" class="field-input mt-1" type="text" maxlength="80" placeholder="Juan Dela Cruz" required autocomplete="name">
          </label>
          <label class="block text-sm text-white/60">Grade level
            <select id="p-grade" class="field-input mt-1" required>
              <option value="">Select…</option>
              <option value="G11">G11</option>
              <option value="G12">G12</option>
              <option value="JHS">JHS</option>
            </select>
          </label>
          <label class="block text-sm text-white/60">Section
            <input id="p-section" class="field-input mt-1" type="text" maxlength="20" placeholder="e.g. STEM-A" required>
          </label>
        </div>
      </fieldset>
      <div class="mt-6 flex items-center gap-3 flex-wrap">
        <button id="profile-btn" type="submit" class="btn-neon px-8 py-3 rounded-full bg-[#3096C7]/20 border border-[#55F1F8]/60 text-[#55F1F8] font-display text-xs tracking-[0.25em]">START TEST</button>
        <a href="intervention.php" class="text-white/50 text-sm hover:text-white/80">Cancel</a>
      </div>
      <p class="mt-3 text-xs text-white/40">Filling this in is not timed. Your timer starts on question 1.</p>
    </form>
    <noscript><p class="mt-4 text-yellow-200/90 text-sm">Taking a test needs JavaScript. Enable it and reload.</p></noscript>
    <?php endif; ?>

    <?php if ($stage === 'question' && $stageQuestion !== null): ?>
    <?php
      $q = $stageQuestion;
      $isWritten = empty($q['choices']);
      $qTotal = count($attempt['order'] ?? []);
    ?>
    <div class="mt-4 flex items-center gap-3 flex-wrap text-sm">
      <span class="font-display text-xs tracking-[0.2em] text-white/60">QUESTION <?php echo $stageIndex + 1; ?> OF <?php echo max(1, $qTotal); ?></span>
      <span class="flex-1 min-w-[80px] h-1.5 rounded bg-white/10 overflow-hidden"><span id="q-progress" class="block h-full" style="width: <?php echo $qTotal > 0 ? round(($stageIndex / $qTotal) * 100) : 0; ?>%; background: #55F1F8;"></span></span>
      <span id="q-timer" class="font-display font-bold text-lg neon-cyan" data-remaining="<?php echo (int) $stageRemaining; ?>">--:--</span>
      <span id="q-viol" class="font-display text-[11px] tracking-[0.15em] text-white/60" title="Each tab-switch over 3 seconds deducts 1 point">FOCUS: <span id="q-viol-n"><?php echo (int) ($attempt['violations'] ?? 0); ?></span></span>
    </div>
    <p class="mt-2 text-xs" style="color:#ff8b95;">Tab out for over 3 seconds and you lose 1 point. Copying is off. No going back.</p>
    <div class="rounded-xl border border-white/10 p-4 mt-3 nocopy" data-q="<?php echo (int) $q['position']; ?>"<?php echo $isWritten ? ' data-written="1"' : ''; ?>>
      <div class="font-semibold leading-snug text-lg"><?php echo nl2br($e($q['prompt'])); ?></div>
      <?php if ($isWritten): ?>
        <textarea id="q-area" class="field-input mt-3" rows="4" maxlength="2000" placeholder="Write your answer here (graded by your teacher). 100 seconds."></textarea>
      <?php else: ?>
      <div class="grid gap-2 mt-3" id="q-choices">
      <?php foreach (['A', 'B', 'C', 'D'] as $i => $letter): ?>
        <?php if (!isset($q['choices'][$i])) continue; ?>
        <label class="choice-row text-[0.95rem] text-white/85">
          <input type="radio" name="qa" value="<?php echo $letter; ?>">
          <span><strong class="text-[#55F1F8]"><?php echo $letter; ?>.</strong> <?php echo nl2br($e($q['choices'][$i])); ?></span>
        </label>
      <?php endforeach; ?>
      </div>
      <?php endif; ?>
    </div>
    <div class="mt-5 flex items-center gap-3 flex-wrap">
      <button id="next-btn" type="button" class="btn-neon px-8 py-3 rounded-full bg-[#3096C7]/20 border border-[#55F1F8]/60 text-[#55F1F8] font-display text-xs tracking-[0.25em]"><?php echo ($stageIndex + 1 >= max(1, $qTotal)) ? 'FINISH' : 'NEXT'; ?></button>
      <button id="restart-btn" type="button" class="text-white/50 text-sm hover:text-white/80">Restart test</button>
    </div>
    <p class="mt-3 text-xs text-white/40">No going back. Your answer locks when you move on. Unanswered questions count as wrong.</p>
    <?php endif; ?>

    <?php if ($stage === 'finish'): ?>
    <div class="rounded-xl border border-[#55F1F8]/40 p-6 mt-5 text-center">
      <div class="font-display font-black text-lg neon-cyan tracking-widest">ALL ANSWERED</div>
      <p class="mt-2 text-white/70 text-sm">Your answers are saved. Complete now to get your score. Only the score is shown, never the answer key.</p>
      <button id="finish-btn" type="button" class="btn-neon mt-4 px-8 py-3 rounded-full bg-[#3096C7]/20 border border-[#55F1F8]/60 text-[#55F1F8] font-display text-xs tracking-[0.25em]">COMPLETE &amp; SCORE</button>
    </div>
    <?php endif; ?>

    <div id="result-card" class="hidden mt-6 rounded-xl border border-[#55F1F8]/40 p-6 text-center nocopy"></div>
  </div>

  <script>
  (function () {
    var TEST_ID = <?php echo (int) $taking['id']; ?>;
    var SLUG = <?php echo json_encode($slug); ?>;
    var STAGE = <?php echo json_encode($stage); ?>;
    var CSRF = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    var GRACE_MS = <?php echo (int) INTERVENTION_TAB_GRACE_SECONDS; ?> * 1000;
    // Copy/cut/drag off inside the test area (stops casual copying; typing
    // in text fields still works). Right-click off except on form fields.
    // Note: this never stops screenshots, DevTools, or a second device.
    (function lockCopy() {
      var root = document.getElementById('take-root');
      if (!root) return;
      function isField(t) {
        return t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT');
      }
      root.addEventListener('copy', function (ev) { if (!isField(ev.target)) ev.preventDefault(); });
      root.addEventListener('cut', function (ev) { if (!isField(ev.target)) ev.preventDefault(); });
      root.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
      root.addEventListener('contextmenu', function (ev) { if (!isField(ev.target)) ev.preventDefault(); });
    })();
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function alert(msg) {
      var el = document.getElementById('take-alert');
      el.classList.remove('hidden');
      el.style.border = '1px solid rgba(255,92,106,.5)';
      el.style.color = '#ff8b95';
      el.textContent = msg;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function postJSON(data, ms) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, ms || 20000);
      return fetch('intervention-api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl.signal,
        credentials: 'same-origin'
      }).then(function (r) {
        clearTimeout(t);
        return r.json().then(function (j) { return { status: r.status, body: j }; });
      }, function (err) {
        clearTimeout(t);
        throw err;
      });
    }
    function showResult(d) {
      var card = document.getElementById('result-card');
      card.classList.remove('hidden');
      var viol = d.violations > 0
        ? 'Focus: ' + d.violations + ' violation(s) (\u2212' + d.violations + ')'
        : 'Focus: clean sheet';
      card.innerHTML = '<div class="font-display text-xs tracking-[0.3em] text-white/50">YOUR SCORE</div>'
        + '<div class="font-display font-black text-5xl mt-2 ' + (d.passed ? 'neon-cyan' : 'neon-pink') + '">'
        + d.correct + '<span class="text-2xl text-white/50">/' + d.total + '</span></div>'
          + '<div class="mt-1 text-white/70">' + d.score_pct + '%: ' + (d.passed ? 'PASSED' : 'NOT PASSED') + '</div>'
        + '<div class="mt-1 text-xs text-white/40">' + esc(viol) + '</div>'
        + '<div class="mt-1 text-xs text-white/40">Recorded under ' + esc(d.email) + ' · ' + esc(d.submitted_at) + ' (Manila)</div>'
        + '<a href="intervention.php" class="btn-neon inline-block mt-5 px-6 py-2.5 rounded-full border border-[#55F1F8]/50 text-[#55F1F8] font-display text-xs tracking-[0.2em]">BACK TO TESTS</a>';
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function doFinish(btn, label) {
      btn.disabled = true;
      postJSON({ action: 'finish', csrf_token: CSRF, test_id: TEST_ID }).then(function (res) {
        if (!res.body || !res.body.ok) {
          var err = (res.body && res.body.error) || 'Could not complete. Try again.';
          if (err === 'time_expired') {
            alert('Time ran out. No score was recorded. You may start over; this attempt was not counted.');
          } else if (err === 'attempts_exhausted') {
            alert('No attempts left for this assessment.');
          } else {
            alert(err);
          }
          btn.disabled = false;
          if (label) btn.textContent = label;
          return;
        }
        document.querySelectorAll('#profile-form, #next-btn, #restart-btn, #finish-btn').forEach(function (el) {
          if (el) el.style.display = 'none';
        });
        showResult(res.body);
      }).catch(function () {
        alert('Network problem. Press the button again to complete.');
        btn.disabled = false;
        if (label) btn.textContent = label;
      });
    }

    // ---- profile stage (untimed) ----
    var pform = document.getElementById('profile-form');
    if (pform) {
      pform.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (pform.reportValidity && !pform.reportValidity()) return;
        var btn = document.getElementById('profile-btn');
        btn.disabled = true;
        btn.textContent = 'STARTING…';
        postJSON({
          action: 'profile', csrf_token: CSRF, test_id: TEST_ID,
          full_name: document.getElementById('p-name').value,
          grade_level: document.getElementById('p-grade').value,
          section: document.getElementById('p-section').value
        }).then(function (res) {
          if (res.status === 401) {
            alert('Your library sign-in expired. Sign in again, then start the test.');
            btn.disabled = false;
            btn.textContent = 'START TEST';
            return;
          }
          if (!res.body || !res.body.ok) {
            alert((res.body && res.body.error) || 'Could not start. Try again.');
            btn.disabled = false;
            btn.textContent = 'START TEST';
            return;
          }
          location.href = 'intervention.php?test=' + encodeURIComponent(SLUG) + '&q=0';
        }).catch(function () {
          alert('Network problem. Nothing was started yet. Try again.');
          btn.disabled = false;
          btn.textContent = 'START TEST';
        });
      });
      return;
    }

    // ---- question stage ----
    var timerEl = document.getElementById('q-timer');
    if (timerEl) {
      var POS = <?php echo $stageQuestion !== null ? (int) $stageQuestion['position'] : 0; ?>;
      var IS_WRITTEN = <?php echo ($stageQuestion !== null && empty($stageQuestion['choices'])) ? 'true' : 'false'; ?>;
      var remaining = parseInt(timerEl.getAttribute('data-remaining'), 10) || 0;
      var violations = parseInt((document.getElementById('q-viol-n') || { textContent: '0' }).textContent, 10) || 0;
      var violEl = document.getElementById('q-viol-n');
      var locked = false;

      function fmt(s) {
        s = Math.max(0, s);
        var m = Math.floor(s / 60), ss = s % 60;
        return m + ':' + (ss < 10 ? '0' : '') + ss;
      }
      function paint() {
        timerEl.textContent = fmt(remaining);
        timerEl.classList.toggle('neon-pink', remaining <= 10);
        timerEl.classList.toggle('neon-cyan', remaining > 10);
      }
      paint();
      var tick = setInterval(function () {
        if (locked) return;
        if (remaining > 0) {
          remaining--;
          paint();
          if (remaining === 0) submitAnswer(true);
        }
      }, 1000);

      // Tab-switch tracking: hidden SHORTER than the grace window never
      // counts (notification shade, accidental taps). Longer counts once
      // per excursion, immediately. Not on return.
      var hiddenAt = 0;
      function bumpViol() {
        violations++;
        if (violEl) violEl.textContent = String(violations);
      }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          hiddenAt = Date.now();
        } else if (hiddenAt) {
          if (Date.now() - hiddenAt >= GRACE_MS) bumpViol();
          hiddenAt = 0;
        }
      });
      setInterval(function () {
        if (!locked && document.hidden && hiddenAt && Date.now() - hiddenAt >= GRACE_MS) {
          bumpViol();
          hiddenAt = 0;
        }
      }, 1000);

      function collect() {
        if (IS_WRITTEN) {
          var area = document.getElementById('q-area');
          return area ? area.value : '';
        }
        var picked = document.querySelector('input[name="qa"]:checked');
        return picked ? picked.value : '';
      }
      function submitAnswer(isTimeout) {
        if (locked) return;
        if (!isTimeout) {
          if (IS_WRITTEN) {
            var area = document.getElementById('q-area');
            if (!area.value.trim()) {
              area.focus();
              alert('Write your answer first. Or wait for the timer and it will move on.');
              return;
            }
          } else if (!document.querySelector('input[name="qa"]:checked')) {
            alert('Pick an answer first. Or wait for the timer and it moves on blank.');
            return;
          }
        }
        locked = true;
        var btn = document.getElementById('next-btn');
        btn.disabled = true;
        btn.textContent = 'LOCKING…';
        var val = collect();
        postJSON({
          action: 'answer', csrf_token: CSRF, test_id: TEST_ID,
          position: POS, answer: val, violations: violations
        }).then(function (res) {
          if (res.status === 401) {
            alert('Your library sign-in expired. Sign in again. Your answers are saved on the server. You will resume right here.');
            locked = false;
            btn.disabled = false;
            btn.textContent = 'NEXT';
            return;
          }
          if (!res.body || !res.body.ok) {
            if (res.status === 409) {
              location.reload();
              return;
            }
            alert((res.body && res.body.error) || 'Could not lock your answer. Try again.');
            locked = false;
            btn.disabled = false;
            btn.textContent = 'NEXT';
            return;
          }
          if (res.body.done) {
            doFinish(btn, 'FINISH');
          } else {
            location.href = 'intervention.php?test=' + encodeURIComponent(SLUG) + '&q=' + res.body.next;
          }
        }).catch(function () {
          alert('Network problem. Your answer may not be locked yet. Press NEXT again.');
          locked = false;
          btn.disabled = false;
          btn.textContent = 'NEXT';
        });
      }
      document.getElementById('next-btn').addEventListener('click', function () { submitAnswer(false); });
      // At-zero auto-submit is armed by the ticker above; a zero remaining
      // on load (e.g. refresh after expiry) fires within a second.
      var restart = document.getElementById('restart-btn');
      if (restart) {
        restart.addEventListener('click', function () {
          if (!confirm('Restart this test from the first question? Locked answers are discarded; nothing is recorded.')) return;
          postJSON({ action: 'restart', csrf_token: CSRF, test_id: TEST_ID }).then(function () {
            location.href = 'intervention.php?test=' + encodeURIComponent(SLUG);
          }).catch(function () {
            alert('Network problem. Try again.');
          });
        });
      }
      return;
    }

    // ---- finish stage ----
    var fbtn = document.getElementById('finish-btn');
    if (fbtn) {
      fbtn.addEventListener('click', function () { doFinish(fbtn, 'COMPLETE & SCORE'); });
    }
  })();
  </script>

<?php elseif ($takeError !== null): ?>
  <div class="window-card rounded-xl p-8 text-center fade-up">
    <div class="font-display font-black text-lg neon-pink tracking-widest">UNAVAILABLE</div>
    <p class="mt-3 text-white/70"><?php echo $e($takeError); ?></p>
    <a href="intervention.php" class="btn-neon inline-block mt-6 px-6 py-2.5 rounded-full border border-[#55F1F8]/50 text-[#55F1F8] font-display text-xs tracking-[0.2em]">BACK TO TESTS</a>
  </div>

<?php else: ?>
  <div class="window-card rounded-xl overflow-hidden fade-up">
    <div class="bg-black/60 px-4 py-3 border-b border-white/10 flex items-center justify-between">
      <div class="font-display text-sm tracking-[0.2em] text-white/70">INTERVENTION ASSESSMENTS</div>
      <div class="text-[10px] text-[#55F1F8] tracking-widest uppercase">SIGNED IN AS <?php echo $e($email); ?></div>
    </div>
    <div class="p-4 sm:p-6 md:p-8 flex flex-col gap-4">
      <div class="rounded-lg p-3 text-sm" style="border:1px solid rgba(255,206,107,.5); background:rgba(255,206,107,.07); color:#ffe1a1;"><?php echo $e($headsUp); ?></div>
      <p class="text-white/60 text-sm leading-relaxed">Choose an assessment below. Your score is recorded automatically under your PCU Gmail with your name, grade level, and section. Only your score is shown after submitting.</p>
      <?php if (empty($tests)): ?>
        <p class="text-white/60">No assessments are posted right now. Check back later.</p>
      <?php else: ?>
        <?php foreach ($tests as $t): ?>
        <div class="rounded-xl border border-white/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-[10px] font-display tracking-[0.25em] uppercase" style="color:#55F1F8;"><?php echo $e($t['subject']); ?> &middot; <?php echo $e($t['grade_label']); ?> &middot; Part <?php echo (int) $t['part']; ?></div>
            <div class="font-display font-bold text-lg mt-0.5"><?php echo $e($t['title']); ?></div>
            <div class="text-white/55 text-sm mt-0.5"><?php echo (int) $t['total_questions']; ?> items<?php echo $t['mcq_count'] < $t['total_questions'] ? ' (' . (int) $t['mcq_count'] . ' auto-scored)' : ''; ?> &middot; passing <?php echo (int) $t['passing_score']; ?><?php echo $t['attempts_left'] !== null ? ' &middot; ' . (int) $t['attempts_left'] . ' of ' . (int) $t['max_attempts'] . ' attempt(s) left' : ' &middot; unlimited attempts'; ?></div>
          </div>
          <?php if ($t['attempts_left'] === 0): ?>
            <span class="text-white/40 font-display text-xs tracking-[0.2em]">LIMIT REACHED</span>
          <?php else: ?>
            <a href="intervention.php?test=<?php echo $e($t['slug']); ?>" class="btn-neon px-6 py-2.5 rounded-full bg-[#3096C7]/20 border border-[#55F1F8]/60 text-[#55F1F8] font-display text-xs tracking-[0.25em] text-center">TAKE TEST</a>
          <?php endif; ?>
        </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>
<?php endif; ?>
</main>
</div>
</body>
</html>
