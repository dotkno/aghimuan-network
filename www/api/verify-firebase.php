<?php
/**
 * api/verify-firebase.php
 *
 * Receives the Firebase ID token from the Creations Hub verification flow,
 * verifies its signature and claims server-side, and if it's a verified
 * @pcu.edu.ph account, updates the user's record with Firebase credentials
 * and marks them as verified for Creations Hub submissions.
 *
 * Reuses the same Firebase project and verification logic as the Library
 * (library/verify-reviewer.php).
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/session.php';

// Reuse the Firebase JWT library from the library/vendor directory
require __DIR__ . '/../library/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\JWK;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Firebase project ID - must match the one in library/verify-reviewer.php
const FIREBASE_PROJECT_ID = 'aghimuan-network';

$pdo = get_db();
$me = current_user($pdo);

if (!$me) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'login_required']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$idToken = $input['idToken'] ?? '';

if (!$idToken) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_token']);
    exit;
}

try {
    // Google's public keys for Firebase Auth ID tokens
    $jwksJson = file_get_contents(
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    );
    $jwks = json_decode($jwksJson, true);
    $keys = JWK::parseKeySet($jwks);

    $decoded = JWT::decode($idToken, $keys);

    $expectedIssuer = 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID;
    if ($decoded->iss !== $expectedIssuer || $decoded->aud !== FIREBASE_PROJECT_ID) {
        throw new Exception('token_not_issued_for_this_project');
    }
    if (empty($decoded->email) || empty($decoded->email_verified)) {
        throw new Exception('email_not_verified');
    }

    $email = strtolower($decoded->email);
    if (!str_ends_with($email, '@pcu.edu.ph')) {
        throw new Exception('not_pcu_domain');
    }

    $firebaseUid = $decoded->sub ?? '';
    if (!$firebaseUid) {
        throw new Exception('missing_firebase_uid');
    }

    // Check if this Firebase UID is already linked to another account
    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE firebase_uid = ? AND id != ?');
    $checkStmt->execute([$firebaseUid, $me['id']]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'firebase_uid_already_linked']);
        exit;
    }

    // Update the user's record with Firebase credentials and verification status
    $updateStmt = $pdo->prepare(
        'UPDATE users SET 
            email = :email,
            firebase_uid = :firebase_uid,
            is_verified = 1,
            verified_at = datetime(\'now\'),
            updated_at = datetime(\'now\')
         WHERE id = :id'
    );
    $updateStmt->execute([
        ':email' => $email,
        ':firebase_uid' => $firebaseUid,
        ':id' => $me['id'],
    ]);

    if ($updateStmt->rowCount() === 0) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'verification_failed']);
        exit;
    }

    // Fetch the updated user record
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$me['id']]);
    $updatedUser = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'email' => $email,
        'is_verified' => (bool)($updatedUser['is_verified'] ?? false),
        'verified_at' => $updatedUser['verified_at'],
    ]);
} catch (Exception $e) {
    error_log('Firebase verification error: ' . $e->getMessage());
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'verification_failed']);
}
