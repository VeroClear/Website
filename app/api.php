<?php
// VeroClear-App: Login, Preisliste, Protokolle (PDF) und Versand per E-Mail.
// Alle Daten liegen eine Ebene über dem Web-Ordner in veroclear-app/ und sind im Browser nicht abrufbar.
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/../../veroclear-app';
const SMTP_CONFIG = __DIR__ . '/../../veroclear-mail.php';
const FIRMA_EMAIL = 'kontakt@veroclear.de';
const MAX_FEHLVERSUCHE = 5;      // pro 15 Minuten
const MAX_PDF_BYTES = 25000000;  // 25 MB
const LEXWARE_URL = 'https://api.lexware.io';
const LEXWARE_EINNAHMEN = '8f8664a1-fd86-11e1-a21f-0800200c9a66';  // Buchungskategorie „Einnahmen“

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
        'ab' => ['keller' => 290, 'garage' => 360, 'dachboden' => 450, 'wohnung40' => 720, 'wohnung60' => 1080,
                 'wohnung80' => 1440, 'wohnung100' => 1800, 'haus' => 2430, 'buero' => 1500,
                 'sperrmuellM3' => 95, 'sperrmuellMin' => 149],
        'kalkulation' => ['proM3' => 30, 'mindestauftrag' => 0,
                          // Flächenpreise je Füllgrad (Marktmitte), Vergleich zur Kostenrechnung
                          'm2Wenig' => 18, 'm2Normal' => 24, 'm2Stark' => 33, 'm2Messie' => 46, 'm2Buero' => 15,
                          'etageProzent' => 7, 'trageweg' => 50, 'halteverbot' => 120, 'kueche' => 250,
                          'kuehlgeraet' => 30, 'sonderPosition' => 150, 'bigBag' => 150, 'stundensatz' => 50,
                          'spritpreis' => 2.25, 'verbrauch' => 10, 'reinigungProM2' => 3, 'expressProzent' => 15],
        // Netto-Preise Entsorger Deißlingen (€/t), Stand Okt. 2026; Metall = Vergütung, daher 0
        'entsorgung' => ['sperrmuell' => 295, 'altholz' => 102, 'altholzA4' => 152, 'metall' => 0, 'elektro' => 200,
                         'papier' => 0, 'uebernahmeschein' => 20],
        // geschätztes Gewicht lose geladen (t/m³)
        'dichte' => ['sperrmuell' => 0.18, 'altholz' => 0.25, 'altholzA4' => 0.3, 'metall' => 0.25, 'elektro' => 0.2,
                     'papier' => 0.08],
        'firma' => ['steuernummer' => '', 'kontoinhaber' => 'Luca De Caro', 'iban' => '', 'bic' => '', 'bank' => '', 'zahlungsziel' => '14', 'ustModus' => 'regel'],
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
    foreach ($neu['firma'] as $k => $_) {
        $v = preg_replace('/[\x00-\x1F\x7F]/u', '', (string) ($e['firma'][$k] ?? ''));
        $neu['firma'][$k] = mb_substr(trim($v), 0, 80);
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
    $art = ['uebergabe' => 'Ü', 'rechnung' => 'R'][$e['art'] ?? ''] ?? 'A';
    $z = lesen('zaehler.json', []);
    $key = $art . date('Y');
    $z[$key] = ($z[$key] ?? 0) + 1;
    schreiben('zaehler.json', $z);
    antwort(200, ['ok' => true, 'nummer' => sprintf('%s-%s-%04d', $art, date('Y'), $z[$key])]);
}

if ($aktion === 'speichern') {
    $nr = (string) ($e['nummer'] ?? '');
    if (!preg_match('/^[AÜR]-\d{4}-\d{4}$/u', $nr)) antwort(422, ['ok' => false, 'error' => 'Ungültige Nummer']);
    $pdf = base64_decode((string) preg_replace('#^data:application/pdf;[^,]*,#', '', (string) ($e['pdf'] ?? '')), true);
    if ($pdf === false || strncmp($pdf, '%PDF', 4) !== 0 || strlen($pdf) > MAX_PDF_BYTES) antwort(422, ['ok' => false, 'error' => 'PDF ungültig']);
    $datei = str_replace('Ü', 'U', $nr) . '.pdf';
    file_put_contents(pfad('protokolle/' . $datei), $pdf, LOCK_EX);

    $eintrag = [
        'nummer' => $nr,
        'art' => str_starts_with($nr, 'Ü') ? 'Übergabe' : (str_starts_with($nr, 'R') ? 'Rechnung' : 'Angebot'),
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
    // Rechnungen automatisch als Beleg nach Lexware Office
    $lex = null;
    if ($eintrag['art'] === 'Rechnung' && lexwareSchluessel()) {
        $lex = lexwareSenden($eintrag, $pdf);
        $eintrag['lexware'] = $lex;
    }
    $idx = lesen('index.json', []);
    $idx = array_values(array_filter($idx, fn($x) => $x['nummer'] !== $nr));
    $idx[] = $eintrag;
    schreiben('index.json', $idx);
    antwort(200, ['ok' => true, 'gesendet' => $versand, 'lexware' => $lex]);
}

// ── Lexware Office ──
if ($aktion === 'lexware_status') {
    $k = lesen('lexware.json', []);
    antwort(200, ['ok' => true, 'verbunden' => !empty($k['schluessel']), 'firma' => $k['firma'] ?? '']);
}

if ($aktion === 'lexware_verbinden') {
    $schluessel = trim((string) ($e['schluessel'] ?? ''));
    if (!preg_match('/^\S{20,300}$/', $schluessel)) antwort(422, ['ok' => false, 'error' => 'Der API-Schlüssel sieht nicht richtig aus.']);
    [$code, $profil] = lexware('GET', '/v1/profile', $schluessel);
    if ($code !== 200) antwort(422, ['ok' => false, 'error' => "Lexware hat den Schlüssel abgelehnt (Fehler $code)."]);
    $firma = (string) ($profil['companyName'] ?? '');
    schreiben('lexware.json', ['schluessel' => $schluessel, 'firma' => $firma, 'seit' => date('c')]);
    antwort(200, ['ok' => true, 'firma' => $firma]);
}

if ($aktion === 'lexware_trennen') {
    $p = pfad('lexware.json');
    if (is_file($p)) unlink($p);
    antwort(200, ['ok' => true]);
}

if ($aktion === 'lexware_senden') {
    $nr = (string) ($e['nummer'] ?? '');
    $idx = lesen('index.json', []);
    $i = array_search($nr, array_column($idx, 'nummer'), true);
    if ($i === false || $idx[$i]['art'] !== 'Rechnung') antwort(404, ['ok' => false, 'error' => 'Rechnung nicht gefunden']);
    if (!lexwareSchluessel()) antwort(422, ['ok' => false, 'error' => 'Lexware ist nicht verbunden.']);
    $pdf = (string) @file_get_contents(pfad('protokolle/' . $idx[$i]['datei']));
    $idx[$i]['lexware'] = lexwareSenden($idx[$i], $pdf);
    schreiben('index.json', $idx);
    antwort(200, ['ok' => true, 'lexware' => $idx[$i]['lexware']]);
}

if ($aktion === 'loeschen') {
    $nr = (string) ($e['nummer'] ?? '');
    if (!preg_match('/^[AÜR]-\d{4}-\d{4}$/u', $nr)) antwort(422, ['ok' => false, 'error' => 'Ungültige Nummer']);
    schreiben('index.json', array_values(array_filter(lesen('index.json', []), fn($x) => $x['nummer'] !== $nr)));
    $p = pfad('protokolle/' . str_replace('Ü', 'U', $nr) . '.pdf');
    if (is_file($p)) unlink($p);
    antwort(200, ['ok' => true]);
}

if ($aktion === 'alles_loeschen') {
    if (($e['bestaetigung'] ?? '') !== 'LÖSCHEN') antwort(422, ['ok' => false, 'error' => 'Nicht bestätigt']);
    foreach (glob(pfad('protokolle') . '/*.pdf') ?: [] as $f) unlink($f);
    schreiben('index.json', []);
    // Nummern nur zurücksetzen, wenn ausdrücklich gewünscht (sonst doppelte Rechnungsnummern möglich)
    if (!empty($e['nummernZuruecksetzen'])) schreiben('zaehler.json', []);
    antwort(200, ['ok' => true]);
}

if ($aktion === 'pdf') {
    $nr = (string) ($_GET['nr'] ?? '');
    if (!preg_match('/^[AÜR]-\d{4}-\d{4}$/u', $nr)) antwort(422, ['ok' => false, 'error' => 'Ungültige Nummer']);
    $p = pfad('protokolle/' . str_replace('Ü', 'U', $nr) . '.pdf');
    if (!is_file($p)) antwort(404, ['ok' => false, 'error' => 'Nicht gefunden']);
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . str_replace('Ü', 'U', $nr) . '.pdf"');
    readfile($p);
    exit;
}

antwort(404, ['ok' => false, 'error' => 'Unbekannte Aktion']);

// ── Lexware Office API ──

function lexwareSchluessel(): string
{
    return (string) (lesen('lexware.json', [])['schluessel'] ?? '');
}

/** @return array{0:int,1:array} HTTP-Status und JSON-Antwort */
function lexware(string $methode, string $pfad, string $schluessel, $body = null, bool $datei = false): array
{
    $c = curl_init(LEXWARE_URL . $pfad);
    $kopf = ['Authorization: Bearer ' . $schluessel, 'Accept: application/json'];
    if ($body !== null && !$datei) { $kopf[] = 'Content-Type: application/json'; $body = json_encode($body, JSON_UNESCAPED_UNICODE); }
    curl_setopt_array($c, [CURLOPT_CUSTOMREQUEST => $methode, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_HTTPHEADER => $kopf]);
    if ($body !== null) curl_setopt($c, CURLOPT_POSTFIELDS, $body);
    $antwort = curl_exec($c);
    $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    return [$code, json_decode((string) $antwort, true) ?: []];
}

function lexwareDatum(?string $de): ?string
{
    return $de && preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', trim($de), $m) ? sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]) : null;
}

/** Legt die Rechnung als Einnahme-Beleg an und hängt das PDF an. Gibt 'ok' oder eine Fehlermeldung zurück. */
function lexwareSenden(array $eintrag, string $pdf): string
{
    $d = is_array($eintrag['daten'] ?? null) ? $eintrag['daten'] : [];
    $brutto = round((float) ($eintrag['betrag'] ?? 0), 2);
    $ust = round((float) ($d['ust'] ?? 0), 2);
    $netto = round($brutto - $ust, 2);
    $beleg = [
        'type' => 'salesinvoice',
        'voucherStatus' => 'open',
        'voucherNumber' => $eintrag['nummer'],
        'voucherDate' => lexwareDatum($d['rdat'] ?? null) ?? date('Y-m-d'),
        'totalGrossAmount' => $brutto,
        'totalTaxAmount' => $ust,
        'taxType' => 'net',
        'useCollectiveContact' => true,
        'contactName' => mb_substr((string) ($eintrag['kunde'] ?: 'Kunde'), 0, 100),
        'remark' => mb_substr('VeroClear-App' . ($eintrag['objekt'] ? ' · ' . $eintrag['objekt'] : ''), 0, 250),
        'voucherItems' => [['amount' => $netto, 'taxAmount' => $ust, 'taxRatePercent' => $ust > 0 ? 19 : 0, 'categoryId' => LEXWARE_EINNAHMEN]],
    ];
    if ($l = lexwareDatum($d['ldat'] ?? null)) $beleg['shippingDate'] = $l;
    if ($f = lexwareDatum($d['faellig'] ?? null)) $beleg['dueDate'] = $f;
    try {
        $k = lexwareSchluessel();
        [$code, $res] = lexware('POST', '/v1/vouchers', $k, $beleg);
        if ($code !== 200 && $code !== 201 || empty($res['id'])) {
            $grund = $res['IssueList'][0]['i18nKey'] ?? ($res['message'] ?? '');
            return "Fehler $code" . ($grund ? " ($grund)" : '');
        }
        $tmp = tempnam(sys_get_temp_dir(), 'vc');
        file_put_contents($tmp, $pdf);
        [$code2] = lexware('POST', '/v1/vouchers/' . $res['id'] . '/files', $k,
            ['file' => new CURLFile($tmp, 'application/pdf', str_replace('Ü', 'U', $eintrag['nummer']) . '.pdf')], true);
        unlink($tmp);
        return $code2 >= 200 && $code2 < 300 ? 'ok' : "Beleg angelegt, PDF fehlt (Fehler $code2)";
    } catch (Throwable $t) {
        error_log('veroclear-app lexware: ' . $t->getMessage());
        return 'Keine Verbindung zu Lexware';
    }
}

// ── E-Mail ──
function mailMitPdf(string $an, array $eintrag, string $pdf): void
{
    $cfg = is_file(SMTP_CONFIG) ? include SMTP_CONFIG : null;
    if (!is_array($cfg)) throw new RuntimeException('SMTP-Zugang fehlt');
    $art = $eintrag['art'];
    $betreff = ['Angebot' => "Ihr Festpreis-Angebot {$eintrag['nummer']} – VeroClear", 'Rechnung' => "Rechnung {$eintrag['nummer']} – VeroClear"][$art]
        ?? "Übergabeprotokoll {$eintrag['nummer']} – VeroClear";
    $anrede = "Guten Tag" . ($eintrag['kunde'] ? " {$eintrag['kunde']}" : '') . ",";
    $absaetze = [
        ['Angebot' => "vielen Dank für die Besichtigung. Im Anhang finden Sie unser Festpreis-Angebot {$eintrag['nummer']}.",
         'Rechnung' => "vielen Dank für Ihren Auftrag. Im Anhang finden Sie unsere Rechnung {$eintrag['nummer']}. Die Zahlungsdaten stehen auf der Rechnung."][$art]
            ?? "im Anhang finden Sie das Übergabeprotokoll {$eintrag['nummer']} zu Ihrem Auftrag.",
        'Bei Fragen erreichen Sie uns unter +49 179 11 33 427 oder per Antwort auf diese E-Mail.',
        'Viele Grüße',
    ];
    $text = $anrede . "\n\n" . implode("\n\n", $absaetze)
        . "\n\n--\nVeroClear\nInhaber: Luca De Caro\nEntrümpelung & Haushaltsauflösung zum Festpreis\nTel. +49 179 11 33 427 · kontakt@veroclear.de\nveroclear.de · Friedrichstraße 10 · 78652 Deißlingen\n";
    $html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0A1D19">'
        . '<p style="margin:0 0 14px">' . htmlspecialchars($anrede) . '</p>'
        . implode('', array_map(fn($a) => '<p style="margin:0 0 14px">' . htmlspecialchars($a) . '</p>', $absaetze))
        . signaturHtml() . '</div>';

    $logo = __DIR__ . '/../assets/logo-symbol.png';
    $mitLogo = is_file($logo);
    $g1 = 'vc' . bin2hex(random_bytes(8));
    $g2 = 'vr' . bin2hex(random_bytes(8));
    $g3 = 'va' . bin2hex(random_bytes(8));
    $kopf = [
        'MIME-Version: 1.0',
        'From: =?UTF-8?B?' . base64_encode('VeroClear') . '?= <' . $cfg['user'] . '>',
        "Content-Type: multipart/mixed; boundary=\"$g1\"",
    ];
    $alternativ = "Content-Type: multipart/alternative; boundary=\"$g3\"\r\n\r\n"
        . "--$g3\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text))
        . "--$g3\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode(str_replace('https://veroclear.de/assets/logo-symbol.png', $mitLogo ? 'cid:logo@veroclear.de' : 'https://veroclear.de/assets/logo-symbol.png', $html)))
        . "--$g3--\r\n";
    $inhalt = $mitLogo
        ? "Content-Type: multipart/related; boundary=\"$g2\"\r\n\r\n"
            . "--$g2\r\n" . $alternativ
            . "--$g2\r\nContent-Type: image/png; name=\"logo.png\"\r\nContent-Transfer-Encoding: base64\r\n"
            . "Content-ID: <logo@veroclear.de>\r\nContent-Disposition: inline; filename=\"logo.png\"\r\n\r\n"
            . chunk_split(base64_encode(file_get_contents($logo)))
            . "--$g2--\r\n"
        : $alternativ;
    $datei = str_replace('Ü', 'U', $eintrag['nummer']) . '.pdf';
    $body = "--$g1\r\n" . $inhalt
        . "--$g1\r\nContent-Type: application/pdf; name=\"$datei\"\r\n"
        . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$datei\"\r\n\r\n"
        . chunk_split(base64_encode($pdf))
        . "--$g1--";
    smtpSenden($cfg, $an, '=?UTF-8?B?' . base64_encode($betreff) . '?=', $body, $kopf);
}

// E-Mail-Signatur wie im Postfach (Logo, Name, Kontakt)
function signaturHtml(): string
{
    return '<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#0A1D19"><tr>'
        . '<td style="padding-right:14px;vertical-align:top"><a href="https://veroclear.de"><img src="https://veroclear.de/assets/logo-symbol.png" alt="VeroClear" width="60" height="57" style="display:block;border:0"></a></td>'
        . '<td style="border-left:2px solid #0E8A68;padding-left:14px;vertical-align:top">'
        . '<div style="font-size:15px;font-weight:bold;color:#0A1D19">VeroClear</div>'
        . '<div style="color:#0E8A68;font-weight:bold">Inhaber: Luca De Caro</div>'
        . '<div style="color:#555">Entrümpelung &amp; Haushaltsauflösung zum Festpreis</div>'
        . '<div style="margin-top:6px">Tel. <a href="tel:+491791133427" style="color:#0A1D19;text-decoration:none">+49 179 11 33 427</a> · <a href="mailto:kontakt@veroclear.de" style="color:#0A1D19;text-decoration:none">kontakt@veroclear.de</a></div>'
        . '<div><a href="https://veroclear.de" style="color:#0E8A68;font-weight:bold;text-decoration:none">veroclear.de</a> · Friedrichstraße 10 · 78652 Deißlingen</div>'
        . '</td></tr></table>';
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
