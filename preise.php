<?php
// Öffentliche Ab-Preise für die Website (gepflegt in der VeroClear-App unter /app).
// Liefert nur die Ab-Preise und den Kategorie-Zuschlag – keine internen Kalkulationswerte.
declare(strict_types=1);
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$ab = ['keller' => 350, 'garage' => 450, 'dachboden' => 550, 'wohnung40' => 990, 'wohnung60' => 1490,
       'wohnung80' => 1890, 'wohnung100' => 2390, 'haus' => 2990, 'buero' => 1690, 'sperrmuellM3' => 95, 'sperrmuellMin' => 149];
$kategorieZuschlag = 60;

$datei = __DIR__ . '/../veroclear-app/preise.json';
if (is_file($datei)) {
    $d = json_decode((string) file_get_contents($datei), true);
    foreach ($ab as $k => $v) {
        if (isset($d['ab'][$k]) && is_numeric($d['ab'][$k])) $ab[$k] = (float) $d['ab'][$k];
    }
    if (isset($d['kalkulation']['kategorieZuschlag']) && is_numeric($d['kalkulation']['kategorieZuschlag'])) {
        $kategorieZuschlag = (float) $d['kalkulation']['kategorieZuschlag'];
    }
}

echo 'window.VC_PRICES=' . json_encode(['ab' => $ab, 'kategorieZuschlag' => $kategorieZuschlag]) . ";\n";
