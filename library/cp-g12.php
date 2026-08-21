<?php
   require_once __DIR__ . '/includes/reviewer-session.php';
   require_reviewer_access();
   ?>
<!DOCTYPE html>
<html lang="en">
<head>
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="shortcut icon" href="favicon.ico">
<meta charset="UTF-8">
<title>Aghimuan Library — Redirecting…</title>
</head>
<body style="background:#03030f;">
  <script>
    // Grade page is just a thin redirect into the shared topic explorer.
    window.location.replace('topics.php?subject=CP&grade=12');
  </script>
</body>
</html>
