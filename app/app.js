/* VeroClear-App: Preisliste, Besichtigung/Angebot, Übergabeprotokoll, Archiv. Keine Abhängigkeiten außer jsPDF. */
(function () {
  'use strict';
  const $main = document.getElementById('main');
  const FIRMA = { name: 'VeroClear', inhaber: 'Luca De Caro', strasse: 'Friedrichstraße 10', ort: '78652 Deißlingen',
    tel: '+49 179 11 33 427', mail: 'kontakt@veroclear.de', web: 'veroclear.de' };
  const FRAKTIONEN = [['sperrmuell', 'Sperrmüll / Möbel / Matratzen'], ['altholz', 'Altholz A1–A3 (Möbelholz)'], ['altholzA4', 'Altholz A4 (Fenster, Zäune, Außenholz)'],
    ['metall', 'Metall / Schrott'], ['elektro', 'Elektrogeräte'], ['papier', 'Papier / Kartons']];
  const MIT_SCHEIN = ['altholzA4', 'elektro'];  // Entsorger verlangt je Anlieferung einen Übernahmeschein
  const AB_FELDER = [['keller', 'Keller bis 10 m²'], ['garage', 'Garage bis 20 m²'], ['dachboden', 'Dachboden bis 25 m²'],
    ['wohnung40', 'Wohnung bis 40 m²'], ['wohnung60', 'Wohnung bis 60 m²'], ['wohnung80', 'Wohnung bis 80 m²'],
    ['wohnung100', 'Wohnung bis 100 m²'], ['haus', 'Haus ab 100 m²'], ['buero', 'Büro / Gewerbe'],
    ['sperrmuellM3', 'Sperrmüllabholung: € pro m³ (inkl. Entsorgung)'], ['sperrmuellMin', 'Sperrmüllabholung: Mindestpreis (€)']];
  const KALK_FELDER = [['proM3', 'Arbeit & Transport pro m³ (€, ohne Entsorgung)'], ['mindestauftrag', 'Mindestauftrag (€, 0 = aus)'],
    ['m2Wenig', 'Flächenpreis wenig Inventar (€/m²)'], ['m2Normal', 'Flächenpreis normal möbliert (€/m²)'],
    ['m2Stark', 'Flächenpreis stark gefüllt (€/m²)'], ['m2Messie', 'Flächenpreis Messie (€/m²)'], ['m2Buero', 'Flächenpreis Büro / Laden (€/m²)'],
    ['etageProzent', 'Etage ohne Aufzug: Zuschlag je Geschoss (%)'], ['trageweg', 'Zuschlag Trageweg > 20 m (€)'],
    ['halteverbot', 'Halteverbotszone beantragen (€)'], ['kueche', 'Küchendemontage (€)'],
    ['kuehlgeraet', 'Kühl-/Klimagerät je Stück (€)'], ['sonderPosition', 'Schadstoffe je Position (€)'],
    ['bigBag', 'Big Bag 1 m³ inkl. Entsorgung (€)'], ['stundensatz', 'Stundensatz je Arbeitskraft (€)'],
    ['spritpreis', 'Dieselpreis aktuell (€ je Liter)'], ['verbrauch', 'Verbrauch Transporter (Liter je 100 km)'],
    ['reinigungProM2', 'Grundreinigung pro m² (€)'], ['expressProzent', 'Express-Zuschlag (%)']];
  const FUELLGRAD = { wenig: ['wenig Inventar', 0.15, 'm2Wenig'], normal: ['normal möbliert', 0.3, 'm2Normal'],
    stark: ['stark gefüllt', 0.5, 'm2Stark'], messie: ['Messie-Wohnung', 0.8, 'm2Messie'] };  // Label, m³ je m², Flächenpreis
  const FIRMA_FELDER = [['steuernummer', 'Steuernummer'], ['kontoinhaber', 'Kontoinhaber'], ['iban', 'IBAN'], ['bic', 'BIC'],
    ['bank', 'Bank'], ['zahlungsziel', 'Zahlungsziel (Tage)']];
  const EINHEITEN = ['pauschal', 'Stk.', 'Std.', 'm³', 'kg', 'km', 'm²'];
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    angebot: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 11h6M9 15h4"/>'),
    rechnung: svg('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/>'),
    uebergabe: svg('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'),
    archiv: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    preise: svg('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
    pfeil: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    muell: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6"/>'),
  };
  const TABS = [['home', 'Start'], ['besichtigung', 'Angebot', 'angebot'], ['rechnung', 'Rechnung'], ['uebergabe', 'Übergabe'], ['archiv', 'Archiv']];
  let PREISE = null;
  let logoData = null;

  // ── Hilfen ──
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const heute = () => new Date().toLocaleDateString('de-DE');
  // Regelbesteuerung: Preise netto + 19 % USt, Vorsteuer auf Entsorgung wird erstattet
  const mitUstStandard = () => ((PREISE && PREISE.firma) || {}).ustModus !== 'klein';
  const plusTage = t => { const d = new Date(); d.setDate(d.getDate() + t); return d.toLocaleDateString('de-DE'); };

  async function api(a, body) {
    const opt = { credentials: 'same-origin', headers: { 'X-VeroClear': 'app' } };
    if (body !== undefined) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let r, j = null;
    try { r = await fetch('api.php?a=' + a, opt); j = await r.json(); } catch (e) { /* Netzwerk */ }
    if (!r || !j) throw new Error('Keine Verbindung zum Server.');
    if (r.status === 401 && a !== 'login') { start(); throw new Error(j.error || 'Bitte anmelden'); }
    if (!j.ok) throw new Error(j.error || 'Fehler');
    return j;
  }

  function seite(html) { $main.oninput = null; $main.onchange = null; $main.innerHTML = html; window.scrollTo(0, 0); }
  const zurueck = '<button class="back" data-go="home">← Übersicht</button>';
  const $tabs = document.getElementById('tabs');
  $tabs.innerHTML = TABS.map(([k, l, i]) => `<button class="tab" data-go="${k}">${ICON[i || k]}<span>${l}</span></button>`).join('');
  const aktiv = k => $tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('an', t.dataset.go === k));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (!g) return;
    e.preventDefault(); aktiv(g.dataset.go);
    ({ home, preise: preisSeite, besichtigung, uebergabe, rechnung, archiv })[g.dataset.go]();
  });
  // Archiv-Eintrag als Listenzeile
  const eintrag = p => `<a class="eintrag" href="api.php?a=pdf&nr=${encodeURIComponent(p.nummer)}" target="_blank" rel="noopener">
      <span class="chip ${p.art === 'Übergabe' ? 'U' : p.art[0]}">${p.art === 'Übergabe' ? 'Ü' : p.art[0]}</span>
      <span class="mitte"><span class="titel" style="display:block">${esc(p.kunde || '–')}</span><span class="meta" style="display:block">${esc(p.nummer)} · ${new Date(p.datum).toLocaleDateString('de-DE')}${p.objekt ? ' · ' + esc(p.objekt) : ''}</span></span>
      ${p.betrag != null ? `<span class="betrag">${eur(p.betrag)}</span>` : ''}</a>`;

  // ── Start / Login ──
  async function start() {
    document.getElementById('logout').hidden = true; $tabs.hidden = true;
    let s;
    try { s = await api('status'); } catch (e) { seite(`<p class="err">${esc(e.message)}</p>`); return; }
    if (s.angemeldet) return home();
    const neu = !s.eingerichtet;
    seite(`<h1>${neu ? 'App einrichten' : 'Anmelden'}</h1><div class="card">
      ${neu ? '<p>Lege jetzt dein Passwort für die App fest (mindestens 10 Zeichen). Es wird nur verschlüsselt auf deinem Server gespeichert.</p>' : ''}
      <label>Passwort<input type="password" id="pw" autocomplete="${neu ? 'new-password' : 'current-password'}"></label>
      ${neu ? '<label style="margin-top:10px">Passwort wiederholen<input type="password" id="pw2" autocomplete="new-password"></label>' : ''}
      <div id="msg"></div><p></p><button class="btn" id="go">${neu ? 'Passwort festlegen' : 'Anmelden'}</button></div>`);
    const go = async () => {
      const pw = document.getElementById('pw').value;
      const msg = document.getElementById('msg');
      if (neu && pw !== document.getElementById('pw2').value) { msg.innerHTML = '<p class="err">Passwörter stimmen nicht überein.</p>'; return; }
      try { await api(neu ? 'einrichten' : 'login', { passwort: pw }); home(); } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
    document.getElementById('go').onclick = go;
    document.getElementById('pw').onkeydown = e => { if (e.key === 'Enter' && !neu) go(); };
  }
  document.getElementById('logout').onclick = async () => { try { await api('logout', {}); } catch (e) { /* egal */ } start(); };

  async function home() {
    document.getElementById('logout').hidden = false; $tabs.hidden = false; aktiv('home');
    let liste = [];
    try { [PREISE, liste] = await Promise.all([api('preise').then(r => r.preise), api('liste').then(r => r.protokolle).catch(() => [])]); }
    catch (e) { seite(`<p class="err">${esc(e.message)}</p>`); return; }
    const jetzt = new Date(), monat = liste.filter(p => { const d = new Date(p.datum); return d.getMonth() === jetzt.getMonth() && d.getFullYear() === jetzt.getFullYear(); });
    const anz = art => monat.filter(p => p.art === art).length;
    const umsatz = monat.filter(p => p.art === 'Rechnung').reduce((t, p) => t + (p.betrag || 0), 0);
    const kachel = (go, titel, text, ico = go) => `<button class="tile" data-go="${go}"><span class="ico">${ICON[ico]}</span><span>${titel}<small>${text}</small></span></button>`;
    seite(`<div class="hello"><h1>Hallo Luca</h1><span class="datum">${jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <div class="tiles">
        <button class="tile gross" data-go="besichtigung"><span class="ico">${ICON.angebot}</span><span>Neue Besichtigung<small>Vor Ort aufnehmen und Festpreis-Angebot senden</small></span><span class="pfeil">${ICON.pfeil}</span></button>
        ${kachel('rechnung', 'Rechnung', 'Aus Angebot oder neu')}
        ${kachel('uebergabe', 'Übergabe', 'Protokoll mit Unterschrift')}
        <button class="tile zeile" data-go="preise"><span class="ico">${ICON.preise}</span><span>Preise & Firma<small>Preise, Entsorgung, Bankdaten, Umsatzsteuer</small></span><span class="pfeil">${ICON.pfeil}</span></button></div>
      <div class="abschnitt"><h2>Dieser Monat</h2></div>
      <div class="stats"><div class="stat"><b>${anz('Angebot')}</b><span>Angebote</span></div><div class="stat"><b>${anz('Rechnung')}</b><span>Rechnungen</span></div><div class="stat"><b>${Math.round(umsatz).toLocaleString('de-DE')} €</b><span>Umsatz</span></div></div>
      <div class="abschnitt"><h2>Zuletzt</h2>${liste.length ? '<button data-go="archiv">Alle ansehen</button>' : ''}</div>
      <div class="card list" style="padding:0">${liste.length ? liste.slice(0, 5).map(eintrag).join('') : '<p class="leer">Noch nichts erstellt. Starte mit einer Besichtigung.</p>'}</div>`);
  }

  // ── Preisliste ──
  function preisSeite() {
    const feld = (g, [k, l]) => `<label>${l}<input type="text" inputmode="decimal" step="0.01" min="0" data-g="${g}" data-k="${k}" value="${PREISE[g][k]}"></label>`;
    seite(`${zurueck}<h1>Preise & Firma</h1><p class="sub">Preise, Entsorgungskosten, Bankdaten und Umsatzsteuer.</p>
      <div class="card"><h2>Richtpreise (nur für dich, z. B. für Telefonauskünfte)</h2><div class="grid">${AB_FELDER.map(f => feld('ab', f)).join('')}</div></div>
      <div class="card"><h2>Entsorgungskosten (Preise deines Entsorgers, netto)</h2>
        <div class="rows">${FRAKTIONEN.map(([k, l]) => `<div class="row" style="grid-template-columns:1fr 1fr"><label>${l}: € pro Tonne<input type="text" inputmode="decimal" step="0.01" min="0" data-g="entsorgung" data-k="${k}" value="${PREISE.entsorgung[k]}"></label><label>Gewicht: Tonnen pro m³<input type="text" inputmode="decimal" step="0.01" min="0" data-g="dichte" data-k="${k}" value="${PREISE.dichte[k]}"></label></div>`).join('')}</div>
        <div class="grid"><label>Übernahmeschein je Anlieferung (€)<input type="text" inputmode="decimal" step="0.01" min="0" data-g="entsorgung" data-k="uebernahmeschein" value="${PREISE.entsorgung.uebernahmeschein}"></label></div>
        <p class="note">Netto-Preise wie auf der Liste des Entsorgers eintragen. ${mitUstStandard() ? 'Die App rechnet netto, weil du die Umsatzsteuer des Entsorgers als Vorsteuer zurückbekommst.' : 'Die App rechnet 19 % MwSt drauf, weil du sie als Kleinunternehmer nicht zurückbekommst.'} Metall bringt dir Geld (Vergütung) und wird daher mit 0 € angesetzt.</p></div>
      <div class="card"><h2>Kalkulation (nur für dich, für Angebote)</h2><div class="grid">${KALK_FELDER.map(f => feld('kalkulation', f)).join('')}</div>
      <p class="note">Auf der Website stehen keine Preise – Kunden bekommen ihren Festpreis nach der Besichtigung.</p><p class="note">Zuletzt gespeichert: ${PREISE.aktualisiert ? new Date(PREISE.aktualisiert).toLocaleString('de-DE') : 'noch nie (Standardwerte)'}</p></div>
      <div class="card"><h2>Firmen- und Bankdaten (für Rechnungen)</h2><div class="grid">${FIRMA_FELDER.map(([k, l]) => `<label>${l}<input data-f="${k}" value="${esc((PREISE.firma || {})[k] ?? '')}"></label>`).join('')}
        <label class="breit">Umsatzsteuer auf Rechnungen<select data-f="ustModus"><option value="regel"${(PREISE.firma || {}).ustModus !== 'klein' ? ' selected' : ''}>zzgl. 19 % Umsatzsteuer (Standard)</option><option value="klein"${(PREISE.firma || {}).ustModus === 'klein' ? ' selected' : ''}>Kleinunternehmer (§ 19 UStG) – keine Umsatzsteuer</option></select></label></div>
        <p class="note">Die Steuernummer bekommst du vom Finanzamt nach der Anmeldung. Ohne Steuernummer ist eine Rechnung nicht vollständig.</p>
        <p class="note">Mit 19 % Umsatzsteuer kreuzt du im Fragebogen zur steuerlichen Erfassung „Verzicht auf die Kleinunternehmerregelung“ an. Dann bekommst du auch die Umsatzsteuer auf Entsorgung, Transporter und Material vom Finanzamt zurück (Vorsteuer).</p></div>
      <div id="msg"></div><button class="btn" id="save">Speichern</button>`);
    document.getElementById('save').onclick = async () => {
      const neu = { ab: {}, kalkulation: {}, entsorgung: {}, dichte: {}, firma: {} };
      document.querySelectorAll('[data-g]').forEach(i => { neu[i.dataset.g][i.dataset.k] = num(i.value); });
      document.querySelectorAll('[data-f]').forEach(i => { neu.firma[i.dataset.f] = i.value.trim(); });
      const msg = document.getElementById('msg');
      try { PREISE = (await api('preise_speichern', neu)).preise; msg.innerHTML = '<p class="ok">Gespeichert.</p>'; }
      catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
  }

  // ── Fotos & Unterschrift ──
  function fotoFeld(id, liste) {
    const box = document.getElementById(id);
    box.innerHTML = `<label class="btn sec small" style="display:inline-flex;width:auto">+ Foto hinzufügen<input type="file" accept="image/*" capture="environment" multiple hidden></label><div class="fotos"></div><p class="note">Max. 12 Fotos, werden verkleinert ins PDF übernommen.</p>`;
    const grid = box.querySelector('.fotos');
    const zeichnen = () => { grid.innerHTML = liste.map((f, i) => `<div><img src="${f}"><button data-i="${i}">×</button></div>`).join(''); };
    grid.onclick = e => { const b = e.target.closest('button[data-i]'); if (b) { liste.splice(+b.dataset.i, 1); zeichnen(); } };
    box.querySelector('input').onchange = async e => {
      for (const file of [...e.target.files]) { if (liste.length >= 12) break; try { liste.push(await verkleinern(file)); } catch (x) { /* ignorieren */ } }
      e.target.value = ''; zeichnen();
    };
    zeichnen();
  }
  function verkleinern(file) {
    return new Promise((res, rej) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const s = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.65)); };
      img.onerror = rej; img.src = url;
    });
  }
  function unterschrift(id) {
    const c = document.getElementById(id); const ctx = c.getContext('2d'); let leer = true, ziehen = false;
    const groesse = () => { const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; ctx.scale(2, 2); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0A1D19'; leer = true; };
    groesse();
    const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.onpointerdown = e => { ziehen = true; leer = false; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
    c.onpointermove = e => { if (ziehen) { ctx.lineTo(...pos(e)); ctx.stroke(); } };
    c.onpointerup = () => { ziehen = false; };
    return { leer: () => leer, bild: () => { if (leer) return null; const w = document.createElement('canvas'); w.width = c.width / 2; w.height = c.height / 2; const g = w.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w.width, w.height); g.drawImage(c, 0, 0, w.width, w.height); return w.toDataURL('image/jpeg', 0.85); }, loeschen: () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); groesse(); } };
  }

  // Entsorgungskosten: m³ × t/m³ × €/t netto (+ Übernahmescheine); als Kleinunternehmer × 1,19, weil keine Vorsteuer
  function entsorgungskosten(mengen) {
    const E = PREISE.entsorgung, D = PREISE.dichte, MWST = mitUstStandard() ? 1 : 1.19;
    let summe = 0; const details = [];
    mengen.forEach(([k, m3]) => {
      if (m3 <= 0) return;
      const t = m3 * D[k], kosten = t * E[k] * MWST;
      summe += kosten; details.push(`${FRAKTIONEN.find(f => f[0] === k)[1].split(' (')[0]}: ca. ${t.toLocaleString('de-DE', { maximumFractionDigits: 2 })} t = ${eur(kosten)}`);
      if (MIT_SCHEIN.includes(k) && E.uebernahmeschein > 0) { summe += E.uebernahmeschein * MWST; details.push(`Übernahmeschein ${eur(E.uebernahmeschein * MWST)}`); }
    });
    return { summe, details };
  }

  // ── Besichtigung / Angebot ──
  function besichtigung() {
    const fotos = [];
    const K = PREISE.kalkulation;
    seite(`<h1>Besichtigung</h1><p class="sub">Aufnahme vor Ort – daraus entsteht das Festpreis-Angebot.</p>
      <div class="card"><h2>Kunde</h2><div class="grid">
        <label>Name *<input id="kname" autocomplete="off"></label><label>Telefon<input id="ktel" type="tel"></label>
        <label>E-Mail<input id="kmail" type="email"></label><label class="breit">Anschrift Kunde<textarea id="kadr" rows="2" placeholder="Straße Hausnummer, PLZ Ort"></textarea></label></div></div>
      <div class="card"><h2>Objekt</h2><div class="grid">
        <label class="breit">Adresse des Objekts *<textarea id="oadr" rows="2" placeholder="Straße Hausnummer, PLZ Ort, ggf. Etage / Hinterhaus"></textarea></label>
        <label>Objektart<select id="oart"><option>Wohnung</option><option>Haus</option><option>Keller / Dachboden</option><option>Garage</option><option>Büro / Gewerbe</option><option>Sperrmüllabholung</option></select></label>
        <label>Fläche (m²)<input id="ofl" type="text" inputmode="decimal"></label>
        <label>Wie voll ist es?<select id="ofg">${Object.entries(FUELLGRAD).map(([k, [l]]) => `<option value="${k}"${k === 'normal' ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Etage (0 = EG)<input id="oet" type="number" inputmode="numeric" value="0"></label>
        <label>Entfernung ab Deißlingen (km, einfache Strecke)<input id="okm" type="text" inputmode="decimal"></label>
        <label>Fahrten hin und zurück<input id="ofa" type="text" inputmode="numeric" value="1"></label></div>
        <label class="chk"><input type="checkbox" id="oauf"> Aufzug vorhanden</label>
        <label class="chk"><input type="checkbox" id="otrag"> Trageweg über 20 m</label>
        <label class="chk"><input type="checkbox" id="ohalt"> Halteverbotszone nötig (${eur(K.halteverbot)})</label></div>
      <div class="card"><h2>Räumgut</h2>
        <label style="max-width:260px">Eingabe in<select id="einheit"><option value="kg" selected>Kilogramm (kg) – wie beim Entsorger</option><option value="m3">Kubikmeter (m³)</option></select></label>
        <div class="grid" style="margin-top:10px">${FRAKTIONEN.map(([k, l]) => `<label>${l} <span class="einh">kg</span><input type="text" inputmode="decimal" min="0" data-m3="${k}"></label>`).join('')}</div>
        <p class="note">Richtwerte: Sofa 40–60 kg · Kleiderschrank 60–100 kg · Bett mit Matratze 50–80 kg · Matratze 15–25 kg · Tisch 20–40 kg · Stuhl 5–8 kg · Waschmaschine 70 kg · Kühlschrank 40–60 kg · Fernseher 10–20 kg · voller Umzugskarton 15–20 kg · Teppich 10–30 kg. Nach jeder Fuhre kannst du mit dem Wiegeschein von Schuler vergleichen.</p>
        <p class="note"><b>Leer lassen</b> = die App schätzt die Menge aus Fläche und „Wie voll ist es?“. Sobald du hier Werte einträgst, wird damit gerechnet. Die App vergleicht immer mit dem Flächenpreis (€/m²) und nimmt den höheren Wert.</p><p class="note">Arbeit & Transport: ${eur(K.proM3)}/m³. Entsorgung wird je Abfallart nach den Preisen deines Entsorgers berechnet (Preise & Firma).</p><div id="entsinfo" class="note"></div></div>
      <div class="card"><h2>Zusatzleistungen</h2>
        <label class="chk"><input type="checkbox" id="zk"> Küchendemontage (${eur(K.kueche)})</label>
        <div class="grid"><label>Kühl-/Klimageräte (Stück, je ${eur(K.kuehlgeraet)})<input id="zkg" type="text" inputmode="numeric"></label>
        <label>Schadstoffe: Farben, Lacke, Altöl, Batterien, Leuchtstoffröhren (Positionen, je ${eur(K.sonderPosition)})<input id="zsp" type="text" inputmode="numeric"></label>
        <label>Big Bags 1 m³ inkl. Entsorgung (Stück, je ${eur(K.bigBag)})<input id="zbb" type="text" inputmode="numeric"></label>
        <label>Zusatzarbeit nach Aufwand: Stunden<input id="zst" type="text" inputmode="decimal"></label>
        <label>Zusatzarbeit: Arbeitskräfte<input id="zak" type="text" inputmode="numeric" value="2"></label></div>
        <p class="note">Zusatzarbeit z. B. für verklebte Teppiche, Bodenbeläge, Tapeten, Garten, Hof oder Lager: ${eur(K.stundensatz)} je Stunde und Arbeitskraft. Asbest nur über eine Fachfirma.</p>
        <label class="chk"><input type="checkbox" id="ze"> Express innerhalb 48 h (+${K.expressProzent} %)</label>
        <label>Grundreinigung (m², ${eur(K.reinigungProM2)}/m²)<input id="zr" type="text" inputmode="decimal" min="0"></label>
        <p class="note">Besenreine Übergabe ist immer inklusive.</p></div>
      <div class="card"><h2>Wertanrechnung</h2><div class="rows" id="wert"></div><button class="btn sec small" id="wadd">+ Gegenstand</button></div>
      <div class="card"><h2>Fotos</h2><div id="fotos"></div></div>
      <div class="card"><h2>Notizen für das Angebot</h2><textarea id="notiz" placeholder="z. B. Zugang über Hof, Termin nach Absprache"></textarea></div>
      <div class="card"><h2>Kalkulation</h2><table class="calc" id="calc"></table>
        <label style="margin-top:12px">Festpreis ${mitUstStandard() ? 'netto ' : ''}(anpassbar)<input id="fp" type="text" inputmode="decimal"></label><p class="note" id="fpust"></p>
        <label>Angebot gültig bis<input id="gueltig" value="${plusTage(14)}"></label></div>
      <div class="card"><h2>Auftrag vor Ort erteilt? (optional)</h2>
        <label class="chk"><input type="checkbox" id="auftrag"> Kunde erteilt den Auftrag zum Festpreis</label>
        <div id="sigbox" hidden><canvas class="sig" id="sig"></canvas><button class="btn sec small" id="sigclr" style="margin-top:8px">Unterschrift löschen</button></div></div>
      <div class="card"><label class="chk"><input type="checkbox" id="ankunde" checked> PDF per E-Mail an den Kunden senden (Kopie geht immer an dich)</label>
        <div id="msg"></div></div>
      <div class="sum"><div><div class="note" style="color:#9fb5ad">Festpreis${mitUstStandard() ? ' inkl. USt' : ''}</div><div class="preis" id="sumpreis">–</div></div><button class="btn" id="senden">PDF erstellen</button></div>`);
    fotoFeld('fotos', fotos);
    const sig = unterschrift('sig');
    document.getElementById('auftrag').onchange = e => { document.getElementById('sigbox').hidden = !e.target.checked; if (e.target.checked) sig.loeschen(); };
    document.getElementById('sigclr').onclick = () => sig.loeschen();
    const wertBox = document.getElementById('wert');
    const wertZeile = () => { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = '<label>Gegenstand<input class="wb"></label><label>Betrag €<input class="wv" type="text" inputmode="decimal" min="0"></label><button class="x">×</button>'; d.querySelector('.x').onclick = () => { d.remove(); rechnen(); }; wertBox.append(d); };
    document.getElementById('wadd').onclick = () => wertZeile();
    let fpManuell = false;
    document.getElementById('fp').oninput = () => { fpManuell = true; zeigeSumme(); };

    function posten() {
      const D = PREISE.dichte, inKg = document.getElementById('einheit').value === 'kg';
      // intern wird in m³ gerechnet: kg ÷ 1000 = t, t ÷ (t je m³) = m³
      let mengen = FRAKTIONEN.map(([k]) => { const v = num(document.querySelector(`[data-m3="${k}"]`).value); return [k, inKg ? (D[k] > 0 ? v / 1000 / D[k] : 0) : v]; });
      let m3 = mengen.reduce((s, [, v]) => s + v, 0);
      let geschaetzt = false;
      const fl = num(document.getElementById('ofl').value);
      if (m3 === 0 && fl > 0) {  // keine m³ erfasst → aus Fläche × Füllgrad schätzen, typische Aufteilung
        m3 = Math.round(fl * (FUELLGRAD[document.getElementById('ofg').value] || FUELLGRAD.normal)[1] * 2) / 2;
        const anteil = { sperrmuell: 0.6, altholz: 0.2, metall: 0.05, elektro: 0.05, papier: 0.1 };
        mengen = FRAKTIONEN.map(([k]) => [k, m3 * (anteil[k] || 0)]);
        geschaetzt = true;
      }
      const et = Math.max(0, Math.floor(num(document.getElementById('oet').value)));
      const p = [];
      let lohn = 0;  // Arbeits- und Fahrtkosten für § 35a EStG (ohne Entsorgung und Material)
      const ent = entsorgungskosten(mengen);
      const kgGesamt = mengen.reduce((s, [k, v]) => s + v * D[k] * 1000, 0);
      const kosten = m3 * K.proM3 + ent.summe;
      const buero = document.getElementById('oart').value === 'Büro / Gewerbe';
      const fg = FUELLGRAD[document.getElementById('ofg').value] || FUELLGRAD.normal;
      const flaechenpreis = fl > 0 ? fl * (buero ? K.m2Buero : K[fg[2]]) : 0;
      const basis = Math.max(kosten, flaechenpreis);
      if (basis > 0) {
        p.push([`Räumung, Abtransport und fachgerechte Entsorgung (ca. ${Math.round(kgGesamt / 10) * 10 >= 1000 ? (Math.round(kgGesamt / 100) / 10).toLocaleString('de-DE') + ' t' : Math.round(kgGesamt).toLocaleString('de-DE') + ' kg'}${fl > 0 ? ', ' + fl.toLocaleString('de-DE') + ' m²' : ''})`, basis]);
        lohn += basis - ent.summe;
      }
      if (geschaetzt) ent.details.unshift(`Menge geschätzt aus ${fl.toLocaleString('de-DE')} m² × ${fg[0]}`);
      const info = [`Gesamtgewicht ca. ${Math.round(kgGesamt).toLocaleString('de-DE')} kg (≈ ${(Math.round(m3 * 10) / 10).toLocaleString('de-DE')} m³)`, `Kosten: Arbeit ${eur(m3 * K.proM3)} + Entsorgung ${eur(ent.summe)} = ${eur(kosten)}`];
      if (flaechenpreis > 0) info.push(`Flächenpreis ${buero ? 'Büro' : fg[0]}: ${eur(flaechenpreis)}`, `verwendet: ${flaechenpreis > kosten ? 'Flächenpreis' : 'Kosten'}`);
      document.getElementById('entsinfo').innerHTML = 'Nur für dich: ' + info.concat(ent.details).map(esc).join(' · ');
      const plus = (text, betrag, istLohn) => { if (betrag > 0) { p.push([text, betrag]); if (istLohn) lohn += betrag; } };
      if (!document.getElementById('oauf').checked && et >= 1) plus(`Etagenzuschlag ohne Aufzug (${et}. OG, je Geschoss ${K.etageProzent} %)`, basis * et * K.etageProzent / 100, true);
      if (document.getElementById('otrag').checked) plus('Zuschlag Trageweg über 20 m', K.trageweg, true);
      if (document.getElementById('ohalt').checked) plus('Halteverbotszone (Genehmigung und Beschilderung)', K.halteverbot, false);
      if (document.getElementById('zk').checked) plus('Küchendemontage', K.kueche, true);
      const kg = Math.floor(num(document.getElementById('zkg').value)); plus(`Kühl- und Klimageräte, fachgerechte Entsorgung (${kg} Stück)`, kg * K.kuehlgeraet, false);
      const sp = Math.floor(num(document.getElementById('zsp').value)); plus(`Schadstoffentsorgung (${sp} Position${sp === 1 ? '' : 'en'})`, sp * K.sonderPosition, false);
      const bb = Math.floor(num(document.getElementById('zbb').value)); plus(`Big Bag 1 m³ inkl. Entsorgung (${bb} Stück)`, bb * K.bigBag, false);
      const st = num(document.getElementById('zst').value), ak = Math.max(1, Math.floor(num(document.getElementById('zak').value)));
      plus(`Zusatzarbeiten nach Aufwand (${st.toLocaleString('de-DE')} Std. × ${ak} Arbeitskräfte)`, st * ak * K.stundensatz, true);
      const km = num(document.getElementById('okm').value), fa = Math.max(1, Math.floor(num(document.getElementById('ofa').value)));
      const proKm = K.verbrauch / 100 * K.spritpreis;  // Spritkosten je gefahrenem km
      plus(`Fahrtkosten (${km.toLocaleString('de-DE')} km × 2 × ${fa} Fahrt${fa === 1 ? '' : 'en'})`, km * 2 * fa * proKm, true);
      const rm = num(document.getElementById('zr').value); plus(`Grundreinigung (${rm.toLocaleString('de-DE')} m²)`, rm * K.reinigungProM2, true);
      let zwischen = p.reduce((s, x) => s + x[1], 0);
      const klein = document.getElementById('oart').value === 'Sperrmüllabholung';
      const minPreis = klein ? PREISE.ab.sperrmuellMin : K.mindestauftrag;
      // Mindestpreis erst, wenn etwas eingetragen ist; 0 in der Preisliste = aus
      if (zwischen > 0 && zwischen < minPreis) { p.push([klein ? 'Aufrundung auf Mindestpreis Sperrmüllabholung' : 'Aufrundung auf Mindestauftrag', minPreis - zwischen]); zwischen = minPreis; }
      if (document.getElementById('ze').checked) { const ex = zwischen * K.expressProzent / 100; p.push([`Express-Zuschlag (${K.expressProzent} %)`, ex]); lohn += ex; }
      const wert = [...wertBox.querySelectorAll('.row')].map(r => [r.querySelector('.wb').value.trim(), num(r.querySelector('.wv').value)]).filter(([b, v]) => b || v);
      wert.forEach(([b, v]) => p.push([`Wertanrechnung: ${b || 'Gegenstand'}`, -v]));
      const summe = Math.max(0, p.reduce((s, x) => s + x[1], 0));
      return { m3, mengen, posten: p, summe, wert, lohn: Math.min(lohn, summe) };  // alles netto bei Regelbesteuerung
    }
    function zeigeSumme() {
      const fp = num(document.getElementById('fp').value), u = ustBetrag(fp);
      document.getElementById('sumpreis').textContent = eur(fp + u);
      document.getElementById('fpust').textContent = mitUstStandard() ? `zzgl. 19 % USt ${eur(u)} = Festpreis brutto ${eur(fp + u)}` : '';
    }
    function rechnen() {
      const r = posten();
      document.getElementById('calc').innerHTML = r.posten.map(([b, v]) => `<tr><td>${esc(b)}</td><td>${eur(v)}</td></tr>`).join('') + `<tr><td><b>Berechnet${mitUstStandard() ? ' (netto)' : ''}</b></td><td><b>${eur(r.summe)}</b></td></tr>`;
      if (!fpManuell) document.getElementById('fp').value = Math.ceil(r.summe / 10) * 10;
      zeigeSumme();
    }
    $main.oninput = e => { if (e.target.id !== 'fp') rechnen(); };
    // Einheit wechseln: vorhandene Werte umrechnen (kg ↔ m³)
    document.getElementById('einheit').addEventListener('change', e => {
      const zuKg = e.target.value === 'kg', D = PREISE.dichte;
      document.querySelectorAll('[data-m3]').forEach(i => { const k = i.dataset.m3, v = num(i.value); if (v) i.value = zuKg ? Math.round(v * D[k] * 1000) : Math.round(v / 1000 / D[k] * 10) / 10; });
      document.querySelectorAll('.einh').forEach(x => { x.textContent = zuKg ? 'kg' : 'm³'; });
    });
    $main.onchange = e => { if (e.target.id === 'oart' || e.target.id === 'ofg' || e.target.id === 'einheit' || e.target.type === 'checkbox' && e.target.id !== 'ankunde' && e.target.id !== 'auftrag') rechnen(); };
    rechnen();

    document.getElementById('senden').onclick = async () => {
      const msg = document.getElementById('msg');
      const v = id => document.getElementById(id).value.trim().replace(/\s*\n+\s*/g, ', ');
      if (!v('kname') || !v('oadr')) { msg.innerHTML = '<p class="err">Bitte Name und Objektadresse ausfüllen.</p>'; document.getElementById('kname').scrollIntoView({ block: 'center' }); return; }
      if (document.getElementById('auftrag').checked && sig.leer()) { msg.innerHTML = '<p class="err">Bitte Unterschrift des Kunden einholen oder Häkchen bei „Auftrag erteilt“ entfernen.</p>'; return; }
      const btn = document.getElementById('senden'); btn.disabled = true; btn.textContent = 'Wird erstellt …';
      try {
        const r = posten(); const fp = num(v('fp')); const mitUst = mitUstStandard(), ust = ustBetrag(fp), brutto = Math.round((fp + ust) * 100) / 100;
        const { nummer } = await api('nummer', { art: 'angebot' });
        const d = { lohn: r.lohn, nummer, mitUst, ust, brutto, datum: heute(), kunde: { name: v('kname'), tel: v('ktel'), mail: v('kmail'), adr: v('kadr') },
          objekt: { adr: v('oadr'), art: v('oart'), flaeche: v('ofl'), etage: v('oet'), aufzug: document.getElementById('oauf').checked },
          m3: Object.fromEntries(r.mengen.map(([k, v]) => [k, Math.round(v * 100) / 100])),
          posten: r.posten, berechnet: r.summe, festpreis: fp, gueltig: v('gueltig'), notiz: v('notiz'),
          auftrag: document.getElementById('auftrag').checked, unterschrift: sig.bild() };
        const pdf = await angebotPdf(d, fotos);
        const res = await api('speichern', { nummer, pdf, kunde: d.kunde.name, email: d.kunde.mail, telefon: d.kunde.tel, objekt: d.objekt.adr,
          betrag: brutto, anKunde: document.getElementById('ankunde').checked, daten: { kunde: d.kunde, objekt: d.objekt, festpreis: fp, netto: mitUst, auftrag: d.auftrag, posten: r.posten, berechnet: r.summe, lohn: r.lohn } });
        fertig(nummer, res.gesendet, pdf);
      } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; btn.disabled = false; btn.textContent = 'PDF erstellen'; }
    };
  }

  function fertig(nummer, gesendet, pdf) {
    seite(`<div class="card" style="text-align:center;padding:28px 20px">
      <div style="width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center">${ICON.uebergabe}</div>
      <h1 style="margin:0 0 6px">Fertig</h1><p style="margin:0 0 16px"><b>${esc(nummer)}</b> wurde gespeichert.</p>
      ${gesendet && gesendet.length ? `<p class="ok">Gesendet an: ${gesendet.map(esc).join(', ')}</p>` : '<p class="err">E-Mail-Versand fehlgeschlagen – das PDF ist trotzdem im Archiv.</p>'}
      <div style="display:grid;gap:10px;margin-top:18px"><a class="btn sec" href="${pdf}" download="${esc(nummer.replace('Ü', 'U'))}.pdf">PDF ansehen / speichern</a><button class="btn" data-go="home">Zur Übersicht</button></div></div>`);
  }

  // ── Übergabe ──
  async function uebergabe() {
    const fotos = [];
    let angebote = [];
    try { angebote = (await api('liste')).protokolle.filter(p => p.art === 'Angebot'); } catch (e) { /* ohne Vorlage */ }
    seite(`<h1>Übergabe</h1><p class="sub">Protokoll mit Unterschrift des Kunden.</p>
      <div class="card"><label>Aus Angebot übernehmen<select id="vorlage"><option value="">– neu –</option>${angebote.map((a, i) => `<option value="${i}">${esc(a.nummer)} · ${esc(a.kunde)} · ${esc(a.objekt)}</option>`).join('')}</select></label></div>
      <div class="card"><h2>Kunde & Objekt</h2><div class="grid">
        <label>Name *<input id="kname"></label><label>E-Mail<input id="kmail" type="email"></label>
        <label>Telefon<input id="ktel" type="tel"></label><label class="breit">Adresse des Objekts *<textarea id="oadr" rows="2" placeholder="Straße Hausnummer, PLZ Ort, ggf. Etage / Hinterhaus"></textarea></label>
        <label>Bezug (Angebots-Nr.)<input id="bezug"></label><label>Datum / Uhrzeit<input id="zeit" value="${new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}"></label></div></div>
      <div class="card"><h2>Zustand bei Übergabe</h2>
        <label class="chk"><input type="checkbox" id="c1" checked> Alle vereinbarten Räume vollständig geräumt</label>
        <label class="chk"><input type="checkbox" id="c2" checked> Besenrein übergeben</label>
        <label class="chk"><input type="checkbox" id="c3" checked> Keine Schäden festgestellt</label>
        <label>Schäden / Abweichungen<textarea id="schaden" placeholder="falls vorhanden"></textarea></label></div>
      <div class="card"><h2>Schlüssel & Zählerstände</h2><div class="grid">
        <label>Schlüssel zurückgegeben (Anzahl)<input id="schl" type="number" inputmode="numeric" min="0"></label>
        <label>Strom<input id="zs"></label><label>Wasser<input id="zw"></label><label>Gas / Heizung<input id="zg"></label></div></div>
      <div class="card"><h2>Fotos</h2><div id="fotos"></div></div>
      <div class="card"><h2>Bemerkungen</h2><textarea id="notiz"></textarea></div>
      <div class="card"><h2>Unterschrift Kunde *</h2><canvas class="sig" id="sigk"></canvas><button class="btn sec small" id="clk" style="margin-top:8px">Löschen</button></div>
      <div class="card"><h2>Unterschrift VeroClear</h2><canvas class="sig" id="sigv"></canvas><button class="btn sec small" id="clv" style="margin-top:8px">Löschen</button></div>
      <div class="card"><label class="chk"><input type="checkbox" id="ankunde" checked> PDF per E-Mail an den Kunden senden (Kopie geht immer an dich)</label><div id="msg"></div>
      <button class="btn" id="senden">Protokoll erstellen</button></div>`);
    fotoFeld('fotos', fotos);
    const sk = unterschrift('sigk'), sv = unterschrift('sigv');
    document.getElementById('clk').onclick = () => sk.loeschen(); document.getElementById('clv').onclick = () => sv.loeschen();
    document.getElementById('vorlage').onchange = e => {
      const a = angebote[+e.target.value]; if (!a) return;
      const set = (id, val) => { document.getElementById(id).value = val || ''; };
      set('kname', a.kunde); set('kmail', a.email); set('ktel', a.telefon); set('oadr', a.objekt); set('bezug', a.nummer);
    };
    document.getElementById('senden').onclick = async () => {
      const msg = document.getElementById('msg'); const v = id => document.getElementById(id).value.trim().replace(/\s*\n+\s*/g, ', '); const c = id => document.getElementById(id).checked;
      if (!v('kname') || !v('oadr')) { msg.innerHTML = '<p class="err">Bitte Name und Objektadresse ausfüllen.</p>'; return; }
      if (sk.leer()) { msg.innerHTML = '<p class="err">Bitte Unterschrift des Kunden einholen.</p>'; return; }
      const btn = document.getElementById('senden'); btn.disabled = true; btn.textContent = 'Wird erstellt …';
      try {
        const { nummer } = await api('nummer', { art: 'uebergabe' });
        const d = { nummer, kunde: { name: v('kname'), mail: v('kmail'), tel: v('ktel') }, objekt: v('oadr'), bezug: v('bezug'), zeit: v('zeit'),
          check: [['Alle vereinbarten Räume vollständig geräumt', c('c1')], ['Besenrein übergeben', c('c2')], ['Keine Schäden festgestellt', c('c3')]],
          schaden: v('schaden'), schluessel: v('schl'), zaehler: [['Strom', v('zs')], ['Wasser', v('zw')], ['Gas / Heizung', v('zg')]],
          notiz: v('notiz'), sigK: sk.bild(), sigV: sv.bild() };
        const pdf = await uebergabePdf(d, fotos);
        const res = await api('speichern', { nummer, pdf, kunde: d.kunde.name, email: d.kunde.mail, telefon: d.kunde.tel, objekt: d.objekt, betrag: null,
          anKunde: c('ankunde'), daten: { bezug: d.bezug, zeit: d.zeit } });
        fertig(nummer, res.gesendet, pdf);
      } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; btn.disabled = false; btn.textContent = 'Protokoll erstellen'; }
    };
  }

  const ustBetrag = netto => mitUstStandard() ? Math.round(netto * 19) / 100 : 0;

  // ── Rechnung ──
  // Positionen sind netto; bei Kleinunternehmer ist netto = Endbetrag
  const rechnungsSummen = (pos, mitUst) => {
    const netto = Math.round(pos.reduce((t, p) => t + p.menge * p.preis, 0) * 100) / 100;
    const ust = mitUst ? Math.round(netto * 19) / 100 : 0;
    return { netto, ust, brutto: Math.round((netto + ust) * 100) / 100 };
  };
  async function rechnung() {
    let angebote = [];
    try { angebote = (await api('liste')).protokolle.filter(p => p.art === 'Angebot'); } catch (e) { /* ohne Vorlage */ }
    const F = PREISE.firma || {}, ziel = Math.max(0, Math.floor(num(F.zahlungsziel || 14)));
    seite(`<h1>Rechnung</h1><p class="sub">Netto eingeben – Umsatzsteuer und Summe rechnet die App.</p>
      ${!F.steuernummer || !F.iban ? '<div class="card"><p class="err">Steuernummer oder IBAN fehlt noch – bitte unter „Preise & Firma“ eintragen.</p></div>' : ''}
      <div class="card"><label>Aus Angebot übernehmen<select id="vorlage"><option value="">– neu –</option>${angebote.map((a, i) => `<option value="${i}">${esc(a.nummer)} · ${esc(a.kunde)} · ${a.betrag != null ? eur(a.betrag) : ''}</option>`).join('')}</select></label>
        <label style="margin-top:10px">Umsatzsteuer<select id="ust"><option value="regel"${F.ustModus !== 'klein' ? ' selected' : ''}>zzgl. 19 % Umsatzsteuer</option><option value="klein"${F.ustModus === 'klein' ? ' selected' : ''}>Kleinunternehmer (§ 19 UStG) – keine Umsatzsteuer</option></select></label></div>
      <div class="card"><h2>Rechnungsempfänger</h2><div class="grid">
        <label>Name / Firma *<input id="kname"></label><label>E-Mail<input id="kmail" type="email"></label>
        <label class="breit">Anschrift *<textarea id="kadr" rows="2" placeholder="Straße Hausnummer, PLZ Ort"></textarea></label></div></div>
      <div class="card"><h2>Angaben</h2><div class="grid">
        <label>Rechnungsdatum<input id="rdat" value="${heute()}"></label>
        <label>Leistungsdatum *<input id="ldat" placeholder="z. B. ${heute()}"></label>
        <label class="breit">Ort der Leistung<input id="lort"></label>
        <label>Bezug (Angebots-Nr.)<input id="bezug"></label>
        <label>Zahlungsziel (Tage)<input id="ziel" type="text" inputmode="numeric" value="${ziel}"></label></div></div>
      <div class="card"><h2>Positionen</h2><p class="note" id="posinfo"></p><div id="pos"></div><button class="btn sec small" id="padd">+ Position</button>
        <table class="calc" id="summen" style="margin-top:14px"></table>
        <label style="margin-top:12px">Davon Arbeits- und Fahrtkosten (§ 35a EStG, € inkl. USt)<input id="lohn" type="text" inputmode="decimal"></label>
        <p class="note">Der Kunde kann 20 % der Arbeits- und Fahrtkosten von der Steuer abziehen, wenn er überweist (nicht bar). Entsorgung zählt nicht dazu.</p></div>
      <div class="card"><label class="chk"><input type="checkbox" id="ankunde" checked> PDF per E-Mail an den Kunden senden (Kopie geht immer an dich)</label><div id="msg"></div></div>
      <div class="sum"><div><div class="note" style="color:#9fb5ad">Rechnungsbetrag</div><div class="preis" id="sumpreis">–</div></div><button class="btn" id="senden">Rechnung erstellen</button></div>`);
    const posBox = document.getElementById('pos');
    const mitUst = () => document.getElementById('ust').value === 'regel';
    const zeile = (b = '', m = 1, ep = '', einh = 'pauschal') => {
      const d = document.createElement('div'); d.className = 'row'; d.style.gridTemplateColumns = '1fr 64px 92px 96px 40px';
      d.innerHTML = `<label>Beschreibung<input class="pb" value="${esc(b)}"></label><label>Menge<input class="pm" type="text" inputmode="decimal" value="${String(m).replace('.', ',')}"></label>
        <label>Einheit<select class="pu">${EINHEITEN.map(u => `<option${u === einh ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
        <label>Einzelpreis €<input class="pe" type="text" inputmode="decimal" value="${ep === '' ? '' : String(Math.round(ep * 100) / 100).replace('.', ',')}"></label><button class="x">×</button>`;
      d.querySelector('.x').onclick = () => { d.remove(); summe(); }; posBox.append(d);
    };
    const positionen = () => [...posBox.querySelectorAll('.row')].map(r => ({ text: r.querySelector('.pb').value.trim(), menge: num(r.querySelector('.pm').value),
      einheit: r.querySelector('.pu').value, preis: num(r.querySelector('.pe').value) })).filter(p => p.text || p.preis);
    const summe = () => {
      const s = rechnungsSummen(positionen(), mitUst());
      document.getElementById('summen').innerHTML = mitUst()
        ? `<tr><td>Zwischensumme netto</td><td>${eur(s.netto)}</td></tr><tr><td>zzgl. 19 % Umsatzsteuer</td><td>${eur(s.ust)}</td></tr><tr><td><b>Gesamtbetrag</b></td><td><b>${eur(s.brutto)}</b></td></tr>`
        : `<tr><td><b>Gesamtbetrag</b> (keine USt nach § 19 UStG)</td><td><b>${eur(s.brutto)}</b></td></tr>`;
      document.getElementById('posinfo').textContent = mitUst() ? 'Einzelpreise netto eingeben – die App rechnet 19 % Umsatzsteuer drauf.' : 'Einzelpreise sind Endpreise (keine Umsatzsteuer).';
      document.getElementById('sumpreis').textContent = eur(s.brutto); return s;
    };
    zeile();
    document.getElementById('padd').onclick = () => { zeile(); summe(); };
    $main.oninput = () => summe(); $main.onchange = () => summe();
    const setv = (id, v) => { document.getElementById(id).value = v || ''; };
    document.getElementById('vorlage').onchange = e => {
      const a = angebote[e.target.value]; if (!a) return; const d = a.daten || {};
      setv('kname', a.kunde); setv('kmail', a.email); setv('kadr', (d.kunde && d.kunde.adr) || ''); setv('lort', a.objekt); setv('bezug', a.nummer);
      // Neue Angebote sind netto; alte (§ 19) sind Endpreise und werden mit USt auf netto zurückgerechnet
      const f = d.netto ? (mitUst() ? 1 : 1.19) : (mitUst() ? 1 / 1.19 : 1);
      posBox.innerHTML = '';
      const posten = (d.posten || []).filter(([, v]) => v);
      if (posten.length) {
        posten.forEach(([b, v]) => zeile(b, 1, v * f));
        const diff = (d.festpreis ?? a.betrag) - posten.reduce((t, [, v]) => t + v, 0);
        if (Math.abs(diff) >= 0.01) zeile(diff < 0 ? 'Nachlass' : 'Rundung', 1, diff * f);
      } else zeile(`Räumung, Abtransport und fachgerechte Entsorgung laut Angebot ${a.nummer}`, 1, (a.betrag || 0) * f);
      const lohnBrutto = d.lohn ? Math.min(d.lohn, d.festpreis ?? a.betrag) * (d.netto ? 1.19 : 1) : 0;  // § 35a zählt inkl. USt
      setv('lohn', lohnBrutto ? String(Math.round(lohnBrutto * 100) / 100).replace('.', ',') : '');
      summe();
    };
    summe();
    document.getElementById('senden').onclick = async () => {
      const msg = document.getElementById('msg'); const v = id => document.getElementById(id).value.trim().replace(/\s*\n+\s*/g, ', ');
      const pos = positionen();
      if (!v('kname') || !v('kadr') || !v('ldat') || !pos.length) { msg.innerHTML = '<p class="err">Bitte Name, Anschrift, Leistungsdatum und mindestens eine Position ausfüllen.</p>'; return; }
      const btn = document.getElementById('senden'); btn.disabled = true; btn.textContent = 'Wird erstellt …';
      try {
        const s = summe(); const tage = Math.max(0, Math.floor(num(v('ziel'))));
        const { nummer } = await api('nummer', { art: 'rechnung' });
        const d = { nummer, rdat: v('rdat'), ldat: v('ldat'), lort: v('lort'), bezug: v('bezug'), kunde: { name: v('kname'), mail: v('kmail'), adr: v('kadr') },
          pos, ...s, mitUst: mitUst(), lohn: Math.min(num(v('lohn')), s.brutto), faellig: plusTage(tage), tage };
        const pdf = await rechnungPdf(d);
        const res = await api('speichern', { nummer, pdf, kunde: d.kunde.name, email: d.kunde.mail, telefon: '', objekt: d.lort || d.kunde.adr, betrag: s.brutto,
          anKunde: document.getElementById('ankunde').checked, daten: { bezug: d.bezug, faellig: d.faellig, ldat: d.ldat, netto: s.netto, ust: s.ust } });
        fertig(nummer, res.gesendet, pdf);
      } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; btn.disabled = false; btn.textContent = 'Rechnung erstellen'; }
    };
  }

  // ── Archiv ──
  async function archiv() {
    seite(`<h1>Archiv</h1><input id="suche" type="search" placeholder="Kunde, Nummer oder Adresse suchen" style="margin:0 0 12px">
      <div class="filter">${[['', 'Alle'], ['Angebot', 'Angebote'], ['Rechnung', 'Rechnungen'], ['Übergabe', 'Übergaben']].map(([k, l], i) => `<button data-art="${k}"${i ? '' : ' class="an"'}>${l}</button>`).join('')}</div>
      <div class="card list" id="liste" style="padding:0"><p class="leer">Lädt …</p></div>
      <div class="card" id="leeren" hidden><h2>Archiv leeren</h2>
        <p class="note" style="margin-top:0">Löscht alle Angebote, Rechnungen und Übergaben samt PDFs – z. B. nach dem Testen. Gesendete E-Mails bleiben in den Postfächern.</p>
        <label class="chk"><input type="checkbox" id="reset" checked> Nummern wieder bei 0001 starten</label>
        <p class="note">Nur zurücksetzen, wenn noch keine echte Rechnung rausgegangen ist – Rechnungsnummern dürfen nicht doppelt vorkommen.</p>
        <button class="btn sec" id="alleweg" style="color:var(--danger);border-color:var(--danger);margin-top:6px">${ICON.muell} Alle Einträge löschen</button></div>`);
    let l = [], art = '';
    const zeigen = () => {
      const q = document.getElementById('suche').value.trim().toLowerCase();
      const t = l.filter(p => (!art || p.art === art) && (!q || [p.kunde, p.nummer, p.objekt, p.email].join(' ').toLowerCase().includes(q)));
      document.getElementById('liste').innerHTML = t.length ? t.map(p => `<div class="zeile">${eintrag(p)}<button class="del" data-nr="${esc(p.nummer)}" aria-label="${esc(p.nummer)} löschen">${ICON.muell}</button></div>`).join('') : `<p class="leer">${l.length ? 'Nichts gefunden.' : 'Noch keine Angebote, Rechnungen oder Protokolle.'}</p>`;
      document.getElementById('leeren').hidden = !l.length;
    };
    document.getElementById('liste').onclick = async e => {
      const b = e.target.closest('.del'); if (!b) return;
      if (!confirm(`${b.dataset.nr} endgültig löschen? Das PDF ist danach weg.`)) return;
      try { await api('loeschen', { nummer: b.dataset.nr }); l = l.filter(p => p.nummer !== b.dataset.nr); zeigen(); }
      catch (x) { alert(x.message); }
    };
    document.getElementById('alleweg').onclick = async () => {
      const reset = document.getElementById('reset').checked;
      if (!confirm(`Alle ${l.length} Einträge mit PDFs endgültig löschen?${reset ? ' Die Nummern starten danach wieder bei 0001.' : ''}`)) return;
      try { await api('alles_loeschen', { bestaetigung: 'LÖSCHEN', nummernZuruecksetzen: reset }); l = []; zeigen(); }
      catch (x) { alert(x.message); }
    };
    document.querySelector('.filter').onclick = e => { const b = e.target.closest('button'); if (!b) return; art = b.dataset.art; document.querySelectorAll('.filter button').forEach(x => x.classList.toggle('an', x === b)); zeigen(); };
    $main.oninput = zeigen;
    try { l = (await api('liste')).protokolle; zeigen(); } catch (e) { document.getElementById('liste').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // ── PDF ──
  async function logo() {
    if (logoData) return logoData;
    try { logoData = await new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0); res(c.toDataURL('image/png')); }; i.onerror = rej; i.src = '../assets/logo-symbol.png'; }); } catch (e) { logoData = null; }
    return logoData;
  }
  function neuesPdf(titel, nummer) {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const P = { doc, y: 0, x: 18, w: 174 };
    P.kopf = () => {
      doc.setFillColor(10, 29, 25); doc.rect(0, 0, 210, 30, 'F');
      if (logoData) doc.addImage(logoData, 'PNG', 18, 7, 17, 16, 'logo', 'FAST');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('VeroClear', 39, 15);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text('Entrümpelung & Haushaltsauflösung zum Festpreis', 39, 21);
      doc.text([`${FIRMA.strasse} · ${FIRMA.ort}`, `${FIRMA.tel} · ${FIRMA.mail} · ${FIRMA.web}`], 192, 13, { align: 'right' });
      doc.setTextColor(10, 29, 25); P.y = 42;
    };
    P.platz = h => { if (P.y + h > 278) { doc.addPage(); P.kopf(); } };
    P.titel = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(titel, P.x, P.y); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`Nr. ${nummer} · ${heute()}`, 192, P.y, { align: 'right' }); P.y += 9; };
    P.abschnitt = (t, minH = 14) => { P.platz(minH); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(14, 138, 104); doc.text(t.toUpperCase(), P.x, P.y); doc.setTextColor(10, 29, 25); doc.setDrawColor(221, 229, 225); doc.line(P.x, P.y + 1.5, P.x + P.w, P.y + 1.5); P.y += 7; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); };
    P.text = (t, opt = {}) => { const z = doc.splitTextToSize(String(t), opt.w || P.w); P.platz(z.length * 5 + 2); doc.setFont('helvetica', opt.bold ? 'bold' : 'normal'); doc.text(z, P.x, P.y); P.y += z.length * 5; doc.setFont('helvetica', 'normal'); };
    P.paare = paare => { paare.filter(([, v]) => v !== undefined && v !== null && String(v) !== '').forEach(([k, v]) => { const z = doc.splitTextToSize(String(v), 118); P.platz(z.length * 5 + 1); doc.setTextColor(91, 107, 102); doc.text(k, P.x, P.y); doc.setTextColor(10, 29, 25); doc.text(z, P.x + 52, P.y); P.y += z.length * 5 + 1; }); P.y += 2; };
    P.fotos = async liste => {
      if (!liste.length) return; P.abschnitt('Fotos', 85); const bw = 84, gap = 6;
      for (let i = 0; i < liste.length; i++) {
        const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = liste[i]; });
        const s = Math.min(bw / img.width, 70 / img.height); const col = i % 2;
        if (col === 0) P.platz(74);
        doc.addImage(liste[i], 'JPEG', P.x + col * (bw + gap), P.y, img.width * s, img.height * s);
        if (col === 1 || i === liste.length - 1) P.y += 74;
      }
    };
    P.unterschrift = (bild, wer) => { P.platz(36); if (bild) { const ip = doc.getImageProperties(bild); const sc = Math.min(80 / ip.width, 24 / ip.height); doc.addImage(bild, 'JPEG', P.x, P.y + 24 - ip.height * sc, ip.width * sc, ip.height * sc); } doc.line(P.x, P.y + 26, P.x + 80, P.y + 26); doc.setFontSize(9); doc.setTextColor(91, 107, 102); doc.text(wer, P.x, P.y + 31); doc.setTextColor(10, 29, 25); doc.setFontSize(10); P.y += 38; };
    P.fuss = () => { const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(91, 107, 102);
      doc.text(`VeroClear · Inhaber: ${FIRMA.inhaber} · ${FIRMA.strasse} · ${FIRMA.ort} · ${FIRMA.tel}`, 105, 286, { align: 'center' });
      const stnr = ((PREISE && PREISE.firma) || {}).steuernummer;
      doc.text(`${stnr ? 'Steuernummer ' + stnr + ' · ' : ''}${mitUstStandard() ? '' : 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. · '}Seite ${i} von ${n}`, 105, 290, { align: 'center' }); } };
    return P;
  }

  // Rechnung im Canva-Design: weiß, Logo oben links, grüne Tabellenkopfzeile, Fußzeile in drei Spalten
  let logoGross = null;
  async function logoVoll() {
    if (logoGross) return logoGross;
    try { logoGross = await new Promise((res, rej) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0); res(c.toDataURL('image/png')); }; i.onerror = rej; i.src = '../assets/logo-full.png'; }); } catch (e) { logoGross = null; }
    return logoGross;
  }
  async function rechnungPdf(d) {
    const logoBild = await logoVoll();
    const F = PREISE.firma || {};
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const GRUEN = [11, 58, 40], TEXT = [51, 51, 51], GRAU = [120, 130, 126], L = 14, R = 196;
    const farbe = c => doc.setTextColor(...c);
    const spalten = { pos: L + 4, text: L + 16, menge: 124, einheit: 140, preis: 166, gesamt: R - 4 };
    let y;
    const fuss = () => {
      doc.setDrawColor(200, 210, 205); doc.setLineWidth(0.3); doc.line(L, 262, R, 262);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); farbe(GRUEN);
      doc.text('Bank / IBAN / BIC', L, 268); doc.text('Steuernummer', 80, 268); doc.text('Kontakt', 146, 268);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); farbe(TEXT);
      doc.text([F.kontoinhaber || FIRMA.inhaber, F.bank || '', F.iban ? 'IBAN ' + F.iban : 'IBAN ________________', F.bic ? 'BIC ' + F.bic : ''].filter(Boolean), L, 273);
      doc.text([F.steuernummer || '________________', `${FIRMA.name} · Inh. ${FIRMA.inhaber}`], 80, 273);
      doc.text([FIRMA.tel, FIRMA.mail, FIRMA.web], 146, 273);
    };
    const kopf = erste => {
      if (logoBild) doc.addImage(logoBild, 'PNG', L, 10, erste ? 52 : 34, erste ? 36.5 : 24, 'logoVoll', 'FAST');
      doc.setFontSize(9); farbe([0, 0, 0]); doc.setFont('helvetica', 'bold'); doc.text(FIRMA.name, 150, 15);
      doc.setFont('helvetica', 'normal');
      doc.text([`Inhaber ${FIRMA.inhaber}`, FIRMA.strasse, FIRMA.ort, `Tel. ${FIRMA.tel}`, FIRMA.mail, FIRMA.web], 150, 20.5, { lineHeightFactor: 1.45 });
      fuss();
    };
    const tabellenKopf = () => {
      doc.setFillColor(...GRUEN); doc.rect(L, y, R - L, 10, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text('Pos.', spalten.pos, y + 6.4); doc.text('Beschreibung', spalten.text, y + 6.4);
      doc.text('Menge', spalten.menge, y + 6.4, { align: 'right' }); doc.text('Einheit', spalten.einheit, y + 6.4, { align: 'center' });
      doc.text('Einzelpreis', spalten.preis, y + 6.4, { align: 'right' }); doc.text('Gesamt', spalten.gesamt, y + 6.4, { align: 'right' });
      y += 10; doc.setFont('helvetica', 'normal'); farbe(TEXT);
    };
    const neueSeite = () => { doc.addPage(); kopf(false); y = 44; tabellenKopf(); };

    kopf(true);
    // Empfänger und Rechnungsdaten
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); farbe(GRAU); doc.text(`${FIRMA.name} · ${FIRMA.strasse} · ${FIRMA.ort}`, L, 55);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); farbe(GRUEN); doc.text('Rechnung an', L, 61);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); farbe([0, 0, 0]);
    doc.text([d.kunde.name, ...doc.splitTextToSize(d.kunde.adr.replace(/,\s*/g, '\n'), 80)], L, 67.5, { lineHeightFactor: 1.4 });
    const info = [['Rechnungsnummer:', d.nummer], ['Rechnungsdatum:', d.rdat], ['Leistungsdatum:', d.ldat], ['Leistungsort:', d.lort], ['Angebotsnummer:', d.bezug]].filter(([, w]) => w);
    doc.setFontSize(10);
    let iy = 61;
    info.forEach(([k, w]) => { const z = doc.splitTextToSize(String(w), 46).slice(0, 3); doc.setFont('helvetica', 'bold'); doc.text(k, 112, iy); doc.setFont('helvetica', 'normal'); doc.text(z, 150, iy, { lineHeightFactor: 1.3 }); iy += 6.3 + (z.length - 1) * 4.6; });
    const hy = Math.max(105, iy + 10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); farbe(GRUEN); doc.text('Rechnung', L, hy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); farbe(TEXT); doc.text('Für unsere Leistungen berechnen wir Ihnen wie folgt:', L, hy + 7);
    y = hy + 12; tabellenKopf();
    // Positionen, abwechselnd hinterlegt
    doc.setFontSize(9.5);
    d.pos.forEach((p, i) => {
      const z = doc.splitTextToSize(p.text || '–', 92); const h = Math.max(10, z.length * 4.4 + 5.6);
      if (y + h > 226) neueSeite();
      if (i % 2) { doc.setFillColor(245, 247, 246); doc.rect(L, y, R - L, h, 'F'); }
      doc.setDrawColor(228, 233, 231); doc.setLineWidth(0.2); doc.line(L, y + h, R, y + h);
      const ty = y + 6.3; farbe(TEXT);
      doc.text(`${i + 1}.`, spalten.pos, ty); doc.text(z, spalten.text, ty, { lineHeightFactor: 1.3 });
      doc.text(p.menge.toLocaleString('de-DE'), spalten.menge, ty, { align: 'right' }); doc.text(p.einheit, spalten.einheit, ty, { align: 'center' });
      doc.text(eur(p.preis), spalten.preis, ty, { align: 'right' }); doc.text(eur(p.menge * p.preis), spalten.gesamt, ty, { align: 'right' });
      y += h;
    });
    // Summen
    if (y + 34 > 226) neueSeite();
    y += 9; doc.setFontSize(10);
    if (d.mitUst) {
      [['Zwischensumme netto', d.netto], ['zzgl. 19 % Umsatzsteuer', d.ust]].forEach(([k, w]) => { farbe(TEXT); doc.text(k, 120, y); doc.text(eur(w), spalten.gesamt, y, { align: 'right' }); y += 6; });
      doc.setDrawColor(...GRUEN); doc.setLineWidth(0.4); doc.line(120, y - 2.5, R, y - 2.5); y += 4;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); farbe(GRUEN);
    doc.text('Gesamtbetrag', 120, y); doc.text(eur(d.brutto), spalten.gesamt, y, { align: 'right' }); y += 12;
    // Hinweise
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); farbe(TEXT);
    const hinweis = t => { const z = doc.splitTextToSize(t, R - L); if (y + z.length * 4.6 > 256) { doc.addPage(); kopf(false); y = 44; } doc.text(z, L, y, { lineHeightFactor: 1.35 }); y += z.length * 4.6 + 2.2; };
    if (!d.mitUst) hinweis('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).');
    if (d.lohn > 0) hinweis(`Enthaltene Arbeits- und Fahrtkosten nach § 35a EStG (haushaltsnahe Dienstleistung${d.mitUst ? ', inkl. Umsatzsteuer' : ''}): ${eur(d.lohn)}. Die Steuerermäßigung setzt eine Zahlung per Überweisung voraus.`);
    hinweis(d.tage ? `Zahlbar innerhalb von ${d.tage} Tagen ohne Abzug bis zum ${d.faellig}. Bitte geben Sie die Rechnungsnummer ${d.nummer} als Verwendungszweck an.` : `Zahlbar sofort ohne Abzug. Bitte geben Sie die Rechnungsnummer ${d.nummer} als Verwendungszweck an.`);
    y += 1; doc.setFont('helvetica', 'bold'); hinweis('Vielen Dank für Ihren Auftrag!');
    // Seitenzahlen bei mehreren Seiten
    const n = doc.getNumberOfPages();
    if (n > 1) for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); farbe(GRAU); doc.text(`Seite ${i} von ${n}`, R, 290, { align: 'right' }); }
    return doc.output('datauristring');
  }

  async function angebotPdf(d, fotos) {
    await logo();
    const P = neuesPdf('Festpreis-Angebot', d.nummer); const doc = P.doc; P.kopf(); P.titel();
    P.abschnitt('Kunde'); P.paare([['Name', d.kunde.name], ['Anschrift', d.kunde.adr], ['Telefon', d.kunde.tel], ['E-Mail', d.kunde.mail]]);
    P.abschnitt('Objekt'); P.paare([['Adresse', d.objekt.adr], ['Objektart', d.objekt.art], ['Fläche', d.objekt.flaeche ? d.objekt.flaeche + ' m²' : ''],
      ['Etage', d.objekt.etage !== '' ? (d.objekt.etage === '0' ? 'Erdgeschoss' : d.objekt.etage + '. OG') + (d.objekt.aufzug ? ' (mit Aufzug)' : ' (ohne Aufzug)') : ''], ['Besichtigt am', d.datum]]);
    P.abschnitt('Leistungen');
    P.text('Komplette Räumung der besichtigten Räume, Abtransport, Trennung nach Wertstoffen und fachgerechte Entsorgung mit Entsorgungsnachweis. Besenreine Übergabe inklusive.');
    P.y += 3;
    d.posten.forEach(([b, v]) => { const z = doc.splitTextToSize(b, 130); P.platz(z.length * 5 + 2); doc.text(z, P.x, P.y); doc.text(eur(v), 192, P.y, { align: 'right' }); P.y += z.length * 5 + 1.5; });
    if (Math.abs(d.festpreis - d.berechnet) >= 0.01) { P.platz(7); doc.text(d.festpreis < d.berechnet ? 'Nachlass' : 'Rundung', P.x, P.y); doc.text(eur(d.festpreis - d.berechnet), 192, P.y, { align: 'right' }); P.y += 6.5; }
    P.platz(d.mitUst ? 28 : 14); doc.setDrawColor(10, 29, 25); doc.line(P.x, P.y, 192, P.y); P.y += 7;
    if (d.mitUst) {
      [['Summe netto', d.festpreis], ['zzgl. 19 % Umsatzsteuer', d.ust]].forEach(([k, w]) => { doc.text(k, P.x, P.y); doc.text(eur(w), 192, P.y, { align: 'right' }); P.y += 6; });
      P.y += 1;
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(d.mitUst ? 'Festpreis inkl. USt' : 'Festpreis', P.x, P.y); doc.text(eur(d.mitUst ? d.brutto : d.festpreis), 192, P.y, { align: 'right' }); P.y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(d.mitUst ? 'Alle Einzelpreise netto zzgl. 19 % Umsatzsteuer.' : 'Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', P.x, P.y); P.y += 8; doc.setFontSize(10);
    P.text(`Das Angebot ist gültig bis ${d.gueltig}. Der Festpreis gilt für den besichtigten Umfang; zusätzliche Gegenstände oder Räume werden vorher mit Ihnen abgestimmt. Asbesthaltige Materialien sind ausgenommen und müssen von einer Fachfirma entsorgt werden.`);
    if (d.lohn > 0) { P.y += 2; P.text(`Steuertipp: Im Festpreis sind Arbeits- und Fahrtkosten${d.mitUst ? ' (inkl. Umsatzsteuer)' : ''} von ca. ${eur(Math.min(d.lohn, d.festpreis) * (d.mitUst ? 1.19 : 1))} enthalten. Davon können Sie 20 % als haushaltsnahe Dienstleistung nach § 35a EStG von Ihrer Steuer abziehen (höchstens 4.000 € im Jahr). Entsorgungskosten zählen nicht dazu.`); }
    if (d.notiz) { P.y += 3; P.abschnitt('Hinweise'); P.text(d.notiz); }
    await P.fotos(fotos);
    P.y += 4; P.abschnitt(d.auftrag ? 'Auftragserteilung' : 'Auftrag erteilen');
    P.text(d.auftrag ? `Der Kunde hat den Auftrag am ${d.datum} zum oben genannten Festpreis erteilt.` : 'Mit Ihrer Unterschrift erteilen Sie uns den Auftrag zum oben genannten Festpreis. Gerne auch formlos per E-Mail oder Telefon.');
    P.y += 4; P.unterschrift(d.unterschrift, `Ort, Datum, Unterschrift ${d.kunde.name}`);
    P.fuss();
    return doc.output('datauristring');
  }

  async function uebergabePdf(d, fotos) {
    await logo();
    const P = neuesPdf('Übergabeprotokoll', d.nummer); const doc = P.doc; P.kopf(); P.titel();
    P.abschnitt('Auftrag'); P.paare([['Kunde', d.kunde.name], ['Telefon', d.kunde.tel], ['E-Mail', d.kunde.mail], ['Objekt', d.objekt], ['Bezug', d.bezug], ['Übergabe am', d.zeit]]);
    P.abschnitt('Zustand bei Übergabe');
    d.check.forEach(([t, ok]) => { P.platz(6); doc.text(`${ok ? '[x]' : '[  ]'}  ${t}`, P.x, P.y); P.y += 6; });
    if (d.schaden) { P.y += 2; P.text('Schäden / Abweichungen: ' + d.schaden); }
    if (d.schluessel || d.zaehler.some(([, v]) => v)) { P.y += 3; P.abschnitt('Schlüssel & Zählerstände'); P.paare([['Schlüssel zurück', d.schluessel ? d.schluessel + ' Stück' : ''], ...d.zaehler]); }
    if (d.notiz) { P.abschnitt('Bemerkungen'); P.text(d.notiz); P.y += 3; }
    await P.fotos(fotos);
    P.y += 4; P.abschnitt('Bestätigung');
    P.text('Die Räume wurden wie oben beschrieben übergeben. Mit der Unterschrift bestätigt der Kunde die ordnungsgemäße Durchführung des Auftrags.');
    P.y += 4; P.unterschrift(d.sigK, `Unterschrift Kunde (${d.kunde.name})`);
    P.unterschrift(d.sigV, `Unterschrift VeroClear (${FIRMA.inhaber})`);
    P.fuss();
    return doc.output('datauristring');
  }

  start();
})();
