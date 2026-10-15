<?php
// Nimmt Anfragen aus dem Formular auf der Website entgegen und schickt sie per E-Mail.
declare(strict_types=1);

const EMPFAENGER = 'kontakt@veroclear.de';
const ABSENDER = 'kontakt@veroclear.de';

header('Content-Type: application/json; charset=utf-8');

function antwort(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Einzeiliger Text: Steuerzeichen und Zeilenumbrüche raus, Länge begrenzen.
function zeile(array $p, string $k, int $max): string
{
    $v = $p[$k] ?? '';
    if (!is_scalar($v)) return '';
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

function liste(array $p, string $k): string
{
    $v = $p[$k] ?? [];
    if (!is_array($v)) return '';
    $v = array_map(fn($x) => zeile(['x' => $x], 'x', 60), array_slice($v, 0, 20));
    return implode(', ', array_filter($v, fn($x) => $x !== ''));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    antwort(405, ['ok' => false, 'error' => 'Nur POST erlaubt']);
}

$p = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($p)) {
    antwort(400, ['ok' => false, 'error' => 'Ungültige Anfrage']);
}

$name = zeile($p, 'name', 100);
$telefon = zeile($p, 'phone', 40);
if (mb_strlen($name) < 2 || strlen(preg_replace('/\D/', '', $telefon) ?? '') < 6) {
    antwort(422, ['ok' => false, 'error' => 'Name und Telefon sind Pflichtfelder']);
}

$email = zeile($p, 'email', 120);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';

$objekte = ['wohnung' => 'Wohnung', 'haus' => 'Haus', 'keller' => 'Keller / Dachboden', 'buero' => 'Büro / Gewerbe'];
$typ = zeile($p, 'object_type', 40);
$objekt = $objekte[$typ] ?? ($typ ?: '–');

$notizen = is_scalar($p['notes'] ?? null) ? (string) $p['notes'] : '';
$notizen = mb_substr(trim(preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $notizen) ?? ''), 0, 2000);

$schaetzung = is_numeric($p['estimate'] ?? null)
    ? '~' . number_format((float) $p['estimate'], 0, ',', '.') . ' €'
    : '–';

$zeit = new DateTime('now', new DateTimeZone('Europe/Berlin'));

$text = "Neue Anfrage über die Website\n\n"
    . "KONTAKT\n"
    . "Name:          $name\n"
    . "Telefon:       $telefon\n"
    . 'E-Mail:        ' . ($email ?: '–') . "\n"
    . 'PLZ:           ' . (zeile($p, 'plz', 10) ?: '–') . "\n\n"
    . "AUFTRAG\n"
    . "Objekt:        $objekt\n"
    . 'Vorhanden:     ' . (liste($p, 'categories') ?: '–') . "\n"
    . 'Optionen:      ' . (liste($p, 'options') ?: '–') . "\n"
    . 'Besichtigung:  ' . (zeile($p, 'visit_type', 30) ?: '–') . "\n"
    . "Schätzung:     $schaetzung\n\n"
    . "ANMERKUNGEN\n"
    . ($notizen ?: '–') . "\n\n"
    . 'Eingegangen am ' . $zeit->format('d.m.Y \u\m H:i') . " Uhr\n";

$betreff = '=?UTF-8?B?' . base64_encode("Neue Anfrage: $objekt – $name") . '?=';

$header = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: =?UTF-8?B?' . base64_encode('VeroClear Website') . '?= <' . ABSENDER . '>',
];
if ($email !== '') $header[] = "Reply-To: $email";

if (!mail(EMPFAENGER, $betreff, $text, implode("\r\n", $header), '-f' . ABSENDER)) {
    antwort(500, ['ok' => false, 'error' => 'Senden fehlgeschlagen. Bitte rufen Sie uns an: +49 179 11 33 427']);
}

antwort(200, ['ok' => true]);
