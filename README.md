# VeroClear Website

Website von VeroClear – Haushaltsauflösung, Entrümpelung und Entsorgung.

## Inhalt

- `index.html` – öffentliche Website (Leistungen, Vorher/Nachher, Angebots-Assistent)
- `admin.html` – Verwaltung (Anfragen, Termine, Aufträge, Leistungen, Fotos)
- `assets/` – Logos und Bilder

Beide HTML-Dateien sind eigenständig und laufen ohne Build-Schritt. Einfach den
gesamten Ordner auf den Webspace (z. B. Hostinger, `public_html`) hochladen.

## Anfragen per E-Mail

Jede Anfrage aus dem Formular wird über `anfrage.php` per E-Mail an
`kontakt@veroclear.de` geschickt. Die Adresse steht oben in `anfrage.php`
(`EMPFAENGER`). Antwortet man auf die E-Mail, geht die Antwort direkt an die
E-Mail-Adresse des Kunden, falls er eine angegeben hat.

Versendet wird per SMTP über das eigene Postfach. Die Zugangsdaten liegen in
`veroclear-mail.php` **eine Ebene über dem Web-Ordner** (neben `public_html`),
damit sie weder im Browser abrufbar noch in diesem Repository sind:

```php
<?php
return [
    'host' => 'smtp.hostinger.com',
    'port' => 465,
    'user' => 'kontakt@veroclear.de',
    'pass' => '…',
];
```

Fehlt die Datei, wird die PHP-Funktion `mail()` des Webservers benutzt. Diese
E-Mails werden aber oft nicht zugestellt oder landen im Spam. Fehler beim
SMTP-Versand stehen im PHP-Fehlerprotokoll des Servers.

## Datenbank

Ohne Konfiguration laufen Website und Verwaltung im Demo-Modus (Daten im
`localStorage` des Browsers). Für den Live-Betrieb wird Supabase genutzt; die
Zugangsdaten (`supabaseUrl`, `supabaseAnonKey`) werden in `window.VEROCLEAR_CONFIG`
eingetragen. Echte Schlüssel bitte nicht in dieses Repository committen.
