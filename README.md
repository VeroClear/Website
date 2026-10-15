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
`kontakt@veroclear.de` geschickt (PHP-Funktion `mail()` des Webservers). Die
Adresse steht oben in `anfrage.php` (`EMPFAENGER`). Antwortet man auf die E-Mail,
geht die Antwort direkt an die E-Mail-Adresse des Kunden, falls er eine angegeben hat.

## Datenbank

Ohne Konfiguration laufen Website und Verwaltung im Demo-Modus (Daten im
`localStorage` des Browsers). Für den Live-Betrieb wird Supabase genutzt; die
Zugangsdaten (`supabaseUrl`, `supabaseAnonKey`) werden in `window.VEROCLEAR_CONFIG`
eingetragen. Echte Schlüssel bitte nicht in dieses Repository committen.
