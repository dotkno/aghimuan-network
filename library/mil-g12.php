<?php
   require_once __DIR__ . '/includes/reviewer-session.php';
   require_reviewer_access();
   ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Aghimuan Library — Redirecting…</title>
</head>
<body style="background:#03030f;">
  <script>
    // Grade page is just a thin redirect into the shared topic explorer.
    window.location.replace('topics.php?subject=MIL&grade=12');
  </script>
</body>
</html>
