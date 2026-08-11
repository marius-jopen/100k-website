<?php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('ok' => false, 'message' => 'Method not allowed'));
    exit;
}

$input = $_POST;
if (empty($input)) {
    $decoded = json_decode(file_get_contents('php://input'), true);
    $input = is_array($decoded) ? $decoded : array();
}

$email = filter_var(trim((string) ($input['email'] ?? '')), FILTER_VALIDATE_EMAIL);
$name = trim(strip_tags((string) ($input['name'] ?? '')));
$budget = trim(strip_tags((string) ($input['budget'] ?? '')));
$message = trim((string) ($input['message'] ?? ''));

if (!$email || $name === '' || $message === '' || $budget === 'none' || $budget === 'Please select') {
    http_response_code(422);
    echo json_encode(array('ok' => false, 'message' => 'Please complete all fields.'));
    exit;
}

$apiKey = getenv('SENDGRID_API_KEY');
$fromEmail = getenv('SENDGRID_FROM_EMAIL');
$contactConfig = array();
$contactConfigPath = __DIR__ . '/contact-config.json';
if (is_file($contactConfigPath)) {
    $decodedConfig = json_decode(file_get_contents($contactConfigPath), true);
    $contactConfig = is_array($decodedConfig) ? $decodedConfig : array();
}
$toEmail = getenv('SENDGRID_TO_EMAIL') ?: ($contactConfig['recipient'] ?? 'contact@100k.studio');

if (!$apiKey || !$fromEmail) {
    error_log('100k contact form: SendGrid environment is incomplete.');
    http_response_code(503);
    echo json_encode(array('ok' => false, 'message' => 'Mail service is not configured.'));
    exit;
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateLimitFile = sys_get_temp_dir() . '/100k-contact-' . hash('sha256', $ip);
$lastRequest = is_file($rateLimitFile) ? (int) file_get_contents($rateLimitFile) : 0;
if ($lastRequest > time() - 15) {
    http_response_code(429);
    echo json_encode(array('ok' => false, 'message' => 'Please wait before sending another message.'));
    exit;
}
file_put_contents($rateLimitFile, (string) time(), LOCK_EX);

$text = "Name: {$name}\nEmail: {$email}\nBudget: {$budget}\n\nMessage:\n{$message}";
$payload = array(
    'personalizations' => array(array('to' => array(array('email' => $toEmail)))),
    'from' => array('email' => $fromEmail, 'name' => '100k Studio Website'),
    'reply_to' => array('email' => $email, 'name' => $name),
    'subject' => '100k Studio Website Request',
    'content' => array(array('type' => 'text/plain', 'value' => $text)),
);

$request = curl_init('https://api.sendgrid.com/v3/mail/send');
curl_setopt_array($request, array(
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => array(
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ),
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 15,
));
$response = curl_exec($request);
$status = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
$error = curl_error($request);
curl_close($request);

if ($status !== 202) {
    error_log('100k contact form: SendGrid rejected the request. ' . $status . ' ' . $error . ' ' . $response);
    http_response_code(502);
    echo json_encode(array('ok' => false, 'message' => 'Message could not be sent.'));
    exit;
}

echo json_encode(array('ok' => true));
