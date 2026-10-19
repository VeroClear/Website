<?php
// VeroClear-App: Login, Preisliste, Protokolle (PDF) und Versand per E-Mail.
// Alle Daten liegen eine Ebene über dem Web-Ordner in veroclear-app/ und sind im Browser nicht abrufbar.
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/../../veroclear-app';
const SMTP_CONFIG = __DIR__ . '/../../veroclear-mail.php';
const FIRMA_EMAIL = 'kontakt@veroclear.de';
const MAX_FEHLVERSUCHE = 5;      // pro 15 Minuten
const MAX_PDF_BYTES = 25000000;  // 25 MB

session_set_cookie_params(['lifetime' => 0, 'path' => '/app/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
session_name('vcapp');
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function antwort(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function pfad(string $name): string
{
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0700, true)) antwort(500, ['ok' => false, 'error' => 'Datenordner fehlt']);
    if (!is_dir(DATA_DIR . '/protokolle')) mkdir(DATA_DIR . '/protokolle', 0700, true);
    return DATA_DIR . '/' . $name;
}

function lesen(string $name, $standard)
{
    $p = pfad($name);
    if (!is_file($p)) return $standard;
    $d = json_decode((string) file_get_contents($p), true);
    return $d ?? $standard;
}

function schreiben(string $name, $daten): void
{
    $p = pfad($name);
    $tmp = $p . '.tmp';
    file_put_contents($tmp, json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $p);
}

function standardPreise(): array
{
    return [
        'ab' => ['keller' => 290, 'garage' => 350, 'dachboden' => 490, 'wohnung40' => 750, 'wohnung60' => 1050,
                 'wohnung80' => 1390, 'wohnung100' => 1790, 'haus' => 2290, 'buero' => 1490],
        'kalkulation' => ['proM3' => 30, 'mindestauftrag' => 290, 'etage' => 40, 'trageweg' => 50, 'kueche' => 150,
                          'reinigungProM2' => 3, 'expressProzent' => 15, 'kategorieZuschlag' => 60],
        // Netto-Preise Entsorger Deißlingen (€/t), Stand Okt. 2026; Metall = Vergütung, daher 0
        'entsorgung' => ['sperrmuell' => 295, 'altholz' => 102, 'altholzA4' => 152, 'metall' => 0, 'elektro' => 200,
                         'papier' => 0, 'sonder' => 0, 'uebernahmeschein' => 20],
        // geschätztes Gewicht lose geladen (t/m³)
        'dichte' => ['sperrmuell' => 0.18, 'altholz' => 0.25, 'altholzA4' => 0.3, 'metall' => 0.25, 'elektro' => 0.2,
                     'papier' => 0.08, 'sonder' => 0.3],
        'aktualisiert' => null,
    ];
}

function eingeloggt(): bool
{
    return !empty($_SESSION['ok']) && ($_SESSION['zeit'] ?? 0) > time() - 12 * 3600;
}

// Nur eigene Seite darf schreiben (einfacher CSRF-Schutz)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_SERVER['HTTP_X_VEROCLEAR'] ?? '') !== 'app') {
    antwort(403, ['ok' => false, 'error' => 'Ungültige Anfrage']);
}

$aktion = (string) ($_GET['a'] ?? '');
$e = $_SERVER['REQUEST_METHOD'] === 'POST'
    ? (json_decode((string) file_get_contents('php://input', false, null, 0, 40000000), true) ?? [])
    : [];

// ── Anmeldung ──
if ($aktion === 'status') {
    antwort(200, ['ok' => true, 'eingerichtet' => is_file(pfad('zugang.json')), 'angemeldet' => eingeloggt()]);
}

if ($aktion === 'einrichten') {
    if (is_file(pfad('zugang.json'))) antwort(409, ['ok' => false, 'error' => 'Bereits eingerichtet']);
    $pw = (string) ($e['passwort'] ?? '');
    if (mb_strlen($pw) < 10) antwort(422, ['ok' => false, 'error' => 'Passwort mindestens 10 Zeichen']);
    schreiben('zugang.json', ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'erstellt' => date('c')]);
    session_regenerate_id(true);
    $_SESSION['ok'] = true; $_SESSION['zeit'] = time();
    antwort(200, ['ok' => true]);
}

if ($aktion === 'login') {
    $fehl = array_values(array_filter(lesen('fehlversuche.json', []), fn($t) => $t > time() - 900));
    if (count($fehl) >= MAX_FEHLVERSUCHE) antwort(429, ['ok' => false, 'error' => 'Zu viele Versuche. Bitte 15 Minuten warten.']);
    $z = lesen('zugang.json', null);
    if (!$z || !password_verify((string) ($e['passwort'] ?? ''), (string) $z['hash'])) {
        $fehl[] = time();
        schreiben('fehlversuche.json', $fehl);
        antwort(401, ['ok' => false, 'error' => 'Passwort falsch']);
    }
    schreiben('fehlversuche.json', []);
    session_regenerate_id(true);
    $_SESSION['ok'] = true; $_SESSION['zeit'] = time();
    antwort(200, ['ok' => true]);
}

if ($aktion === 'logout') {
    $_SESSION = [];
    session_destroy();
    antwort(200, ['ok' => true]);
}

if (!eingeloggt()) antwort(401, ['ok' => false, 'error' => 'Bitte anmelden']);
$_SESSION['zeit'] = time();

// ── Preisliste ──
if ($aktion === 'preise') {
    antwort(200, ['ok' => true, 'preise' => array_replace_recursive(standardPreise(), lesen('preise.json', []))]);
}

if ($aktion === 'preise_speichern') {
    $neu = standardPreise();
    foreach (['ab', 'kalkulation', 'entsorgung', 'dichte'] as $gruppe) {
        foreach ($neu[$gruppe] as $k => $_) {
            $v = $e[$gruppe][$k] ?? null;
            if (!is_numeric($v) || $v < 0 || $v > 100000) antwort(422, ['ok' => false, 'error' => "Ungültiger Wert: $k"]);
            $neu[$gruppe][$k] = round((float) $v, 2);
        }
    }
    $neu['aktualisiert'] = date('c');
    schreiben('preise.json', $neu);
    antwort(200, ['ok' => true, 'preise' => $neu]);
}

// ── Protokolle ──
if ($aktion === 'liste') {
    antwort(200, ['ok' => true, 'protokolle' => array_slice(array_reverse(lesen('index.json', [])), 0, 200)]);
}

if ($aktion === 'nummer') {
    $art = ($e['art'] ?? '') === 'uebergabe' ? 'Ü' : 'A';
    $z = lesen('zaehler.json', []);
    $key = $art . date('Y');
    $z[$key] = ($z[$key] ?? 0) + 1;
    schreiben('zaehler.json', $z);
    antwort(200, ['ok' => true, 'nummer' => sprintf('%s-%s-%04d', $art, date('Y'), $z[$key])]);
}

if ($aktion === 'speichern') {
    $nr = (string) ($e['nummer'] ?? '');
    if (!preg_match('/^[AÜ]-\d{4}-\d{4}$/u', $nr)) antwort(422, ['ok' => false, 'error' => 'Ungültige Nummer']);
    $pdf = base64_decode((string) preg_replace('#^data:application/pdf;[^,]*,#', '', (string) ($e['pdf'] ?? '')), true);
    if ($pdf === false || strncmp($pdf, '%PDF', 4) !== 0 || strlen($pdf) > MAX_PDF_BYTES) antwort(422, ['ok' => false, 'error' => 'PDF ungültig']);
    $datei = str_replace('Ü', 'U', $nr) . '.pdf';
    file_put_contents(pfad('protokolle/' . $datei), $pdf, LOCK_EX);

    $eintrag = [
        'nummer' => $nr,
        'art' => str_starts_with($nr, 'Ü') ? 'Übergabe' : 'Angebot',
        'datum' => date('c'),
        'kunde' => mb_substr((string) ($e['kunde'] ?? ''), 0, 120),
        'email' => filter_var($e['email'] ?? '', FILTER_VALIDATE_EMAIL) ?: '',
        'telefon' => mb_substr((string) ($e['telefon'] ?? ''), 0, 40),
        'objekt' => mb_substr((string) ($e['objekt'] ?? ''), 0, 200),
        'betrag' => is_numeric($e['betrag'] ?? null) ? (float) $e['betrag'] : null,
        'daten' => $e['daten'] ?? null,
        'datei' => $datei,
        'gesendet' => [],
    ];

    $versand = [];
    $empf = [FIRMA_EMAIL];
    if (!empty($e['anKunde']) && $eintrag['email']) $empf[] = $eintrag['email'];
    foreach ($empf as $an) {
        try {
            mailMitPdf($an, $eintrag, $pdf);
            $versand[] = $an;
        } catch (Throwable $t) {
            error_log('veroclear-app: ' . $t->getMessage());
        }
    }
    $eintrag['gesendet'] = $versand;
    $idx = lesen('index.json', []);
    $idx = array_values(array_filter($idx, fn($x) => $x['nummer'] !== $nr));
    $idx[] = $eintrag;
    schreiben('index.json', $idx);
    antwort(200, ['ok' => true, 'gesendet' => $versand]);
}

if ($aktion === 'pdf') {
    $nr = (string) ($_GET['nr'] ?? '');
    if (!preg_match('/^[AÜ]-\d{4}-\d{4}$/u', $nr)) antwort(422, ['ok' => false, 'error' => 'Ungültige Nummer']);
    $p = pfad('protokolle/' . str_replace('Ü', 'U', $nr) . '.pdf');
    if (!is_file($p)) antwort(404, ['ok' => false, 'error' => 'Nicht gefunden']);
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . str_replace('Ü', 'U', $nr) . '.pdf"');
    readfile($p);
    exit;
}

antwort(404, ['ok' => false, 'error' => 'Unbekannte Aktion']);

// ── E-Mail ──
function mailMitPdf(string $an, array $eintrag, string $pdf): void
{
    $cfg = is_file(SMTP_CONFIG) ? include SMTP_CONFIG : null;
    if (!is_array($cfg)) throw new RuntimeException('SMTP-Zugang fehlt');
    $art = $eintrag['art'];
    $betreff = $art === 'Angebot' ? "Ihr Festpreis-Angebot {$eintrag['nummer']} – VeroClear" : "Übergabeprotokoll {$eintrag['nummer']} – VeroClear";
    $text = "Guten Tag" . ($eintrag['kunde'] ? " {$eintrag['kunde']}" : '') . ",\n\n"
        . ($art === 'Angebot'
            ? "vielen Dank für die Besichtigung. Im Anhang finden Sie unser Festpreis-Angebot {$eintrag['nummer']}.\n\n"
            : "im Anhang finden Sie das Übergabeprotokoll {$eintrag['nummer']} zu Ihrem Auftrag.\n\n")
        . "Bei Fragen erreichen Sie uns unter +49 179 11 33 427 oder per Antwort auf diese E-Mail.\n\nViele Grüße\nVeroClear\nInhaber: Luca De Caro\nFriedrichstraße 10 · 78652 Deißlingen\nhttps://veroclear.de\n";
    $grenze = 'vc' . bin2hex(random_bytes(8));
    $kopf = [
        'MIME-Version: 1.0',
        'From: =?UTF-8?B?' . base64_encode('VeroClear') . '?= <' . $cfg['user'] . '>',
        "Content-Type: multipart/mixed; boundary=\"$grenze\"",
    ];
    $body = "--$grenze\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text))
        . "--$grenze\r\nContent-Type: application/pdf; name=\"" . str_replace('Ü', 'U', $eintrag['nummer']) . ".pdf\"\r\n"
        . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . str_replace('Ü', 'U', $eintrag['nummer']) . ".pdf\"\r\n\r\n"
        . chunk_split(base64_encode($pdf))
        . "--$grenze--";
    smtpSenden($cfg, $an, '=?UTF-8?B?' . base64_encode($betreff) . '?=', $body, $kopf);
}

function smtpSenden(array $cfg, string $an, string $betreff, string $body, array $header): void
{
    $host = (string) $cfg['host'];
    $port = (int) ($cfg['port'] ?? 465);
    $s = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . "$host:$port", $nr, $fehler, 20);
    if (!$s) throw new RuntimeException("Keine Verbindung zu $host:$port ($fehler)");
    stream_set_timeout($s, 30);
    $befehl = function (?string $zeile, array $ok) use ($s): void {
        if ($zeile !== null) fwrite($s, $zeile . "\r\n");
        $antwort = '';
        while (($l = fgets($s, 1024)) !== false) {
            $antwort .= $l;
            if (!isset($l[3]) || $l[3] !== '-') break;
        }
        if (!in_array((int) substr($antwort, 0, 3), $ok, true)) throw new RuntimeException('SMTP-Fehler: ' . trim($antwort ?: 'keine Antwort'));
    };
    try {
        $ich = gethostname() ?: 'localhost';
        $befehl(null, [220]);
        $befehl("EHLO $ich", [250]);
        if ($port !== 465) {
            $befehl('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('STARTTLS fehlgeschlagen');
            $befehl("EHLO $ich", [250]);
        }
        $befehl('AUTH LOGIN', [334]);
        $befehl(base64_encode((string) $cfg['user']), [334]);
        $befehl(base64_encode((string) $cfg['pass']), [235]);
        $befehl('MAIL FROM:<' . $cfg['user'] . '>', [250]);
        $befehl("RCPT TO:<$an>", [250, 251]);
        $befehl('DATA', [354]);
        $domain = substr((string) strrchr((string) $cfg['user'], '@'), 1) ?: 'localhost';
        $kopf = array_merge(["To: <$an>", "Subject: $betreff", 'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . "@$domain>"], $header);
        $nachricht = implode("\r\n", $kopf) . "\r\n\r\n" . $body;
        $nachricht = preg_replace('/\r?\n/', "\r\n", $nachricht);
        $nachricht = preg_replace('/^\./m', '..', $nachricht);
        $befehl($nachricht . "\r\n.", [250]);
        fwrite($s, "QUIT\r\n");
    } finally {
        fclose($s);
    }
}
