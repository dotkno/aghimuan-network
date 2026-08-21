<?php
/**
 * verify-reviewer.php
 *
 * Receives the Firebase ID token from reviewer-login.html, verifies its
 * signature and claims server-side (never trust a token the browser
 * just hands you), and if it's a verified @pcu.edu.ph account, sets the
 * reviewer session.
 *
 * Requires: composer require firebase/php-jwt
 */

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/includes/reviewer-session.php';

use Firebase\JWT\JWT;
use Firebase\JWT\JWK;

header('Content-Type: application/json');

// TODO: fill in your actual Firebase project ID (from Firebase console).
const FIREBASE_PROJECT_ID = 'aghimuan-network';

$input   = json_decode(file_get_contents('php://input'), true);
$idToken = $input['idToken'] ?? '';

if (!$idToken) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing token']);
    exit;
}

try {
    // Google's public keys for Firebase Auth ID tokens.
    $jwksJson = file_get_contents(
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    );
    $jwks = json_decode($jwksJson, true);
    $keys = JWK::parseKeySet($jwks);

    $decoded = JWT::decode($idToken, $keys);

    $expectedIssuer = 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID;
    if ($decoded->iss !== $expectedIssuer || $decoded->aud !== FIREBASE_PROJECT_ID) {
        throw new Exception('token not issued for this project');
    }
    if (empty($decoded->email) || empty($decoded->email_verified)) {
        throw new Exception('email not verified');
    }

    $email = strtolower($decoded->email);
    if (!str_ends_with($email, '@pcu.edu.ph')) {
        throw new Exception('not a pcu.edu.ph account');
    }

    // Passed every check — establish the reviewer session.
    $_SESSION['reviewer_email']       = $email;
    $_SESSION['reviewer_verified_at'] = time();

    echo json_encode(['ok' => true]);
} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'verification failed']);
}
