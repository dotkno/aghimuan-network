<?php
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/session.php';
logout_user(get_db());
header('Location: /login.php');
exit;
