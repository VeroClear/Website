<?php
// Nimmt Anfragen aus dem Formular auf der Website entgegen und schickt sie per E-Mail.
declare(strict_types=1);

const EMPFAENGER = 'kontakt@veroclear.de';
const ABSENDER = 'kontakt@veroclear.de';

// SMTP-Zugang (Server, Port, Postfach, Passwort). Liegt eine Ebene über dem
// Web-Ordner, damit er weder im Browser abrufbar noch im Git-Repository ist.
// Fehlt die Datei, wird über die PHP-Funktion mail() verschickt.
const SMTP_CONFIG = __DIR__ . '/../veroclear-mail.php';

header('Content-Type: application/json; charset=utf-8');

function antwort(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Verschickt eine E-Mail per SMTP mit Anmeldung (Port 465: SSL, sonst STARTTLS).
function smtpSenden(array $cfg, string $an, string $betreff, string $text, array $header): void
{
    $host = (string) $cfg['host'];
    $port = (int) ($cfg['port'] ?? 465);
    $s = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . "$host:$port", $nr, $fehler, 15);
    if (!$s) throw new RuntimeException("Keine Verbindung zu $host:$port ($fehler)");
    stream_set_timeout($s, 15);

    $befehl = function (?string $zeile, array $ok) use ($s): void {
        if ($zeile !== null) fwrite($s, $zeile . "\r\n");
        $antwort = '';
        while (($l = fgets($s, 1024)) !== false) {
            $antwort .= $l;
            if (!isset($l[3]) || $l[3] !== '-') break;
        }
        if (!in_array((int) substr($antwort, 0, 3), $ok, true)) {
            throw new RuntimeException('SMTP-Fehler: ' . trim($antwort ?: 'keine Antwort'));
        }
    };

    try {
        $ich = gethostname() ?: 'localhost';
        $befehl(null, [220]);
        $befehl("EHLO $ich", [250]);
        if ($port !== 465) {
            $befehl('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS fehlgeschlagen');
            }
            $befehl("EHLO $ich", [250]);
        }
        $befehl('AUTH LOGIN', [334]);
        $befehl(base64_encode((string) $cfg['user']), [334]);
        $befehl(base64_encode((string) $cfg['pass']), [235]);
        $befehl('MAIL FROM:<' . $cfg['user'] . '>', [250]);
        $befehl("RCPT TO:<$an>", [250, 251]);
        $befehl('DATA', [354]);

        $domain = substr((string) strrchr((string) $cfg['user'], '@'), 1) ?: 'localhost';
        $kopf = array_merge([
            "To: <$an>",
            "Subject: $betreff",
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . "@$domain>",
        ], $header);
        $nachricht = implode("\r\n", $kopf) . "\r\n\r\n" . $text;
        $nachricht = preg_replace('/\r?\n/', "\r\n", $nachricht);
        $nachricht = preg_replace('/^\./m', '..', $nachricht);
        $befehl($nachricht . "\r\n.", [250]);
        fwrite($s, "QUIT\r\n");
    } finally {
        fclose($s);
    }
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

$objekte = ['wohnung' => 'Wohnung', 'haus' => 'Haus', 'keller' => 'Keller / Dachboden', 'buero' => 'Büro / Gewerbe', 'sonstiges' => 'Sonstiges'];
$typ = zeile($p, 'object_type', 40);
$objekt = $objekte[$typ] ?? ($typ ?: '–');

$notizen = is_scalar($p['notes'] ?? null) ? (string) $p['notes'] : '';
$notizen = mb_substr(trim(preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $notizen) ?? ''), 0, 2000);
// Mailserver lehnen Zeilen über 998 Zeichen ab, daher lange Zeilen umbrechen.
$notizen = wordwrap($notizen, 76, "\n");

$flaeche = zeile($p, 'flaeche', 10);

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
    . 'Fläche:        ' . ($flaeche !== '' ? "ca. $flaeche m²" : '–') . "\n"
    . 'Besichtigung:  ' . (zeile($p, 'visit_type', 30) ?: '–') . "\n"
    . "\n"
    . "ANMERKUNGEN\n"
    . ($notizen ?: '–') . "\n\n"
    . 'Eingegangen am ' . $zeit->format('d.m.Y \u\m H:i') . " Uhr\n";

$betreff = '=?UTF-8?B?' . base64_encode("Neue Anfrage: $objekt – $name") . '?=';

$smtp = is_file(SMTP_CONFIG) ? include SMTP_CONFIG : null;
$absender = is_array($smtp) ? (string) $smtp['user'] : ABSENDER;

$header = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: =?UTF-8?B?' . base64_encode('VeroClear') . "?= <$absender>",
];
if ($email !== '') $header[] = "Reply-To: $email";

if (is_array($smtp)) {
    try {
        smtpSenden($smtp, EMPFAENGER, $betreff, $text, $header);
        $gesendet = true;
    } catch (Throwable $e) {
        error_log('anfrage.php: ' . $e->getMessage());
        $gesendet = false;
    }
} else {
    $gesendet = mail(EMPFAENGER, $betreff, $text, implode("\r\n", $header), '-f' . ABSENDER);
}

if (!$gesendet) {
    antwort(500, ['ok' => false, 'error' => 'Senden fehlgeschlagen. Bitte rufen Sie uns an: +49 179 11 33 427']);
}

antwort(200, ['ok' => true]);
