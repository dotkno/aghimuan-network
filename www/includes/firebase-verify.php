<?php
/**
 * includes/firebase-verify.php
 *
 * Shared server-side Firebase ID-token verifier for the main site's Google
 * auth flows (api/auth-google.php). Verifies the JWT signature against
 * Google's public JWKS and checks issuer/audience for our project — the
 * exact same checks api/verify-firebase.php and library/verify-reviewer.php
 * perform inline; this is that logic extracted so the Google
 * signup/login path doesn't duplicate it a third time.
 *
 * Domain policy (e.g. @pcu.edu.ph) is intentionally NOT checked here —
 * each caller decides which domains it accepts.
 */

declare(strict_types=1);

// Must match the project used by reviewers.php / verify-firebase.php.
const FIREBASE_PROJECT_ID = 'aghimuan-network';

// Reuse the Firebase JWT library from the library/vendor directory (same
// vendored copy the other two verifiers use).
require_once __DIR__ . '/../library/vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\JWK;

/**
 * Verifies a Firebase ID token.
 *
 * @return array{email:string, email_verified:bool, firebase_uid:string} on success
 * @throws Exception on any verification failure
 */
function verify_firebase_id_token(string $idToken): array {
    if ($idToken === '') {
        throw new Exception('missing_token');
    }

    // Google's public keys for Firebase Auth ID tokens
    $jwksJson = file_get_contents(
        'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
    );
    if ($jwksJson === false) {
        throw new Exception('jwks_unreachable');
    }
    $jwks = json_decode($jwksJson, true);
    if (!is_array($jwks)) {
        throw new Exception('jwks_invalid');
    }
    $keys = JWK::parseKeySet($jwks);

    $decoded = JWT::decode($idToken, $keys);

    $expectedIssuer = 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID;
    if ($decoded->iss !== $expectedIssuer || $decoded->aud !== FIREBASE_PROJECT_ID) {
        throw new Exception('token_not_issued_for_this_project');
    }
    if (empty($decoded->email)) {
        throw new Exception('missing_email');
    }

    $firebaseUid = $decoded->sub ?? '';
    if (!$firebaseUid) {
        throw new Exception('missing_firebase_uid');
    }

    return [
        'email' => strtolower($decoded->email),
        'email_verified' => !empty($decoded->email_verified),
        'firebase_uid' => (string) $firebaseUid,
    ];
}
