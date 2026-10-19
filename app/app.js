/* VeroClear-App: Preisliste, Besichtigung/Angebot, Übergabeprotokoll, Archiv. Keine Abhängigkeiten außer jsPDF. */
(function () {
  'use strict';
  const $main = document.getElementById('main');
  const FIRMA = { name: 'VeroClear', inhaber: 'Luca De Caro', strasse: 'Friedrichstraße 10', ort: '78652 Deißlingen',
    tel: '+49 179 11 33 427', mail: 'kontakt@veroclear.de', web: 'veroclear.de' };
  const FRAKTIONEN = [['sperrmuell', 'Sperrmüll / Möbel / Matratzen'], ['altholz', 'Altholz A1–A3 (Möbelholz)'], ['altholzA4', 'Altholz A4 (Fenster, Zäune, Außenholz)'],
    ['metall', 'Metall / Schrott'], ['elektro', 'Elektrogeräte'], ['papier', 'Papier / Kartons'], ['sonder', 'Sondermüll (Farben, Öle …)']];
  const MIT_SCHEIN = ['altholzA4', 'elektro'];  // Entsorger verlangt je Anlieferung einen Übernahmeschein
  const AB_FELDER = [['keller', 'Keller bis 10 m²'], ['garage', 'Garage bis 20 m²'], ['dachboden', 'Dachboden bis 25 m²'],
    ['wohnung40', 'Wohnung bis 40 m²'], ['wohnung60', 'Wohnung bis 60 m²'], ['wohnung80', 'Wohnung bis 80 m²'],
    ['wohnung100', 'Wohnung bis 100 m²'], ['haus', 'Haus ab 100 m²'], ['buero', 'Büro / Gewerbe'],
    ['sperrmuellM3', 'Sperrmüllabholung: € pro m³ (inkl. Entsorgung)'], ['sperrmuellMin', 'Sperrmüllabholung: Mindestpreis (€)']];
  const KALK_FELDER = [['proM3', 'Arbeit & Transport pro m³ (€, ohne Entsorgung)'], ['mindestauftrag', 'Mindestauftrag (€)'],
    ['etage', 'Zuschlag je Etage ohne Aufzug ab 2. OG (€)'], ['trageweg', 'Zuschlag Trageweg > 20 m (€)'],
    ['kueche', 'Küchendemontage (€)'], ['reinigungProM2', 'Grundreinigung pro m² (€)'],
    ['expressProzent', 'Express-Zuschlag (%)'], ['kategorieZuschlag', 'Website-Schätzung: Zuschlag je Kategorie (€)']];
  let PREISE = null;
  let logoData = null;

  // ── Hilfen ──
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const heute = () => new Date().toLocaleDateString('de-DE');
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
  $main.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); ({ home, preise: preisSeite, besichtigung, uebergabe, archiv })[g.dataset.go](); } });

  // ── Start / Login ──
  async function start() {
    document.getElementById('logout').hidden = true;
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
    document.getElementById('logout').hidden = false;
    try { PREISE = (await api('preise')).preise; } catch (e) { seite(`<p class="err">${esc(e.message)}</p>`); return; }
    seite(`<h1>Hallo Luca 👋</h1><div class="tiles">
      <button class="tile" data-go="besichtigung">📝 Besichtigung<small>Aufnahme vor Ort → Festpreis-Angebot als PDF</small></button>
      <button class="tile" data-go="uebergabe">✅ Übergabe<small>Übergabeprotokoll mit Unterschrift</small></button>
      <button class="tile" data-go="preise">💶 Preisliste<small>Preise für App und Website pflegen</small></button>
      <button class="tile" data-go="archiv">📁 Archiv<small>Alle Angebote und Protokolle</small></button></div>`);
  }

  // ── Preisliste ──
  function preisSeite() {
    const feld = (g, [k, l]) => `<label>${l}<input type="number" inputmode="decimal" step="0.01" min="0" data-g="${g}" data-k="${k}" value="${PREISE[g][k]}"></label>`;
    seite(`${zurueck}<h1>Preisliste</h1>
      <div class="card"><h2>Ab-Preise (erscheinen auf der Website)</h2><div class="grid">${AB_FELDER.map(f => feld('ab', f)).join('')}</div></div>
      <div class="card"><h2>Entsorgungskosten (Preise deines Entsorgers, netto)</h2>
        <div class="rows">${FRAKTIONEN.map(([k, l]) => `<div class="row" style="grid-template-columns:1fr 1fr"><label>${l}: € pro Tonne<input type="number" inputmode="decimal" step="0.01" min="0" data-g="entsorgung" data-k="${k}" value="${PREISE.entsorgung[k]}"></label><label>Gewicht: Tonnen pro m³<input type="number" inputmode="decimal" step="0.01" min="0" data-g="dichte" data-k="${k}" value="${PREISE.dichte[k]}"></label></div>`).join('')}</div>
        <div class="grid"><label>Übernahmeschein je Anlieferung (€)<input type="number" inputmode="decimal" step="0.01" min="0" data-g="entsorgung" data-k="uebernahmeschein" value="${PREISE.entsorgung.uebernahmeschein}"></label></div>
        <p class="note">Netto-Preise wie auf der Liste des Entsorgers eintragen – die App rechnet 19 % MwSt drauf, weil du sie als Kleinunternehmer nicht zurückbekommst. Metall bringt dir Geld (Vergütung) und wird daher mit 0 € angesetzt.</p></div>
      <div class="card"><h2>Kalkulation (nur für dich, für Angebote)</h2><div class="grid">${KALK_FELDER.map(f => feld('kalkulation', f)).join('')}</div>
      <p class="note">Zuletzt gespeichert: ${PREISE.aktualisiert ? new Date(PREISE.aktualisiert).toLocaleString('de-DE') : 'noch nie (Standardwerte)'}</p></div>
      <div id="msg"></div><button class="btn" id="save">Speichern</button>`);
    document.getElementById('save').onclick = async () => {
      const neu = { ab: {}, kalkulation: {}, entsorgung: {}, dichte: {} };
      document.querySelectorAll('[data-g]').forEach(i => { neu[i.dataset.g][i.dataset.k] = num(i.value); });
      const msg = document.getElementById('msg');
      try { PREISE = (await api('preise_speichern', neu)).preise; msg.innerHTML = '<p class="ok">Gespeichert. Die Website zeigt die neuen Ab-Preise ab sofort.</p>'; }
      catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
  }

  // ── Fotos & Unterschrift ──
  function fotoFeld(id, liste) {
    const box = document.getElementById(id);
    box.innerHTML = `<label class="btn sec small" style="display:inline-flex;width:auto">📷 Foto hinzufügen<input type="file" accept="image/*" capture="environment" multiple hidden></label><div class="fotos"></div><p class="note">Max. 12 Fotos, werden verkleinert ins PDF übernommen.</p>`;
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

  // Entsorgungskosten brutto: m³ × t/m³ × €/t netto × 1,19 (+ Übernahmescheine)
  function entsorgungskosten(mengen) {
    const E = PREISE.entsorgung, D = PREISE.dichte, MWST = 1.19;
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
    seite(`${zurueck}<h1>Besichtigung</h1>
      <div class="card"><h2>Kunde</h2><div class="grid">
        <label>Name *<input id="kname" autocomplete="off"></label><label>Telefon<input id="ktel" type="tel"></label>
        <label>E-Mail<input id="kmail" type="email"></label><label>Anschrift Kunde<input id="kadr"></label></div></div>
      <div class="card"><h2>Objekt</h2><div class="grid">
        <label>Adresse des Objekts *<input id="oadr"></label>
        <label>Objektart<select id="oart"><option>Wohnung</option><option>Haus</option><option>Keller / Dachboden</option><option>Garage</option><option>Büro / Gewerbe</option><option>Sperrmüllabholung</option></select></label>
        <label>Fläche (m²)<input id="ofl" type="number" inputmode="decimal"></label>
        <label>Etage (0 = EG)<input id="oet" type="number" inputmode="numeric" value="0"></label></div>
        <label class="chk"><input type="checkbox" id="oauf"> Aufzug vorhanden</label>
        <label class="chk"><input type="checkbox" id="otrag"> Trageweg über 20 m</label></div>
      <div class="card"><h2>Räumgut (geschätzt in m³)</h2><div class="grid">${FRAKTIONEN.map(([k, l]) => `<label>${l}<input type="number" inputmode="decimal" step="0.5" min="0" data-m3="${k}"></label>`).join('')}</div>
        <p class="note">Arbeit & Transport: ${eur(K.proM3)}/m³. Entsorgung wird je Abfallart nach den Preisen deines Entsorgers berechnet (Preisliste).</p><div id="entsinfo" class="note"></div></div>
      <div class="card"><h2>Zusatzleistungen</h2>
        <label class="chk"><input type="checkbox" id="zk"> Küchendemontage (${eur(K.kueche)})</label>
        <label class="chk"><input type="checkbox" id="ze"> Express innerhalb 48 h (+${K.expressProzent} %)</label>
        <label>Grundreinigung (m², ${eur(K.reinigungProM2)}/m²)<input id="zr" type="number" inputmode="decimal" min="0"></label>
        <p class="note">Besenreine Übergabe ist immer inklusive.</p></div>
      <div class="card"><h2>Wertanrechnung</h2><div class="rows" id="wert"></div><button class="btn sec small" id="wadd">+ Gegenstand</button></div>
      <div class="card"><h2>Fotos</h2><div id="fotos"></div></div>
      <div class="card"><h2>Notizen für das Angebot</h2><textarea id="notiz" placeholder="z. B. Zugang über Hof, Termin nach Absprache"></textarea></div>
      <div class="card"><h2>Kalkulation</h2><table class="calc" id="calc"></table>
        <label style="margin-top:12px">Festpreis (anpassbar)<input id="fp" type="number" inputmode="decimal"></label>
        <label>Angebot gültig bis<input id="gueltig" value="${plusTage(14)}"></label></div>
      <div class="card"><h2>Auftrag vor Ort erteilt? (optional)</h2>
        <label class="chk"><input type="checkbox" id="auftrag"> Kunde erteilt den Auftrag zum Festpreis</label>
        <div id="sigbox" hidden><canvas class="sig" id="sig"></canvas><button class="btn sec small" id="sigclr" style="margin-top:8px">Unterschrift löschen</button></div></div>
      <div class="card"><label class="chk"><input type="checkbox" id="ankunde" checked> PDF per E-Mail an den Kunden senden (Kopie geht immer an dich)</label>
        <div id="msg"></div></div>
      <div class="sum"><div><div class="note" style="color:#9fb5ad">Festpreis</div><div class="preis" id="sumpreis">–</div></div><button class="btn" id="senden">PDF erstellen</button></div>`);
    fotoFeld('fotos', fotos);
    const sig = unterschrift('sig');
    document.getElementById('auftrag').onchange = e => { document.getElementById('sigbox').hidden = !e.target.checked; if (e.target.checked) sig.loeschen(); };
    document.getElementById('sigclr').onclick = () => sig.loeschen();
    const wertBox = document.getElementById('wert');
    const wertZeile = () => { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = '<label>Gegenstand<input class="wb"></label><label>Betrag €<input class="wv" type="number" inputmode="decimal" min="0"></label><button class="x">×</button>'; d.querySelector('.x').onclick = () => { d.remove(); rechnen(); }; wertBox.append(d); };
    document.getElementById('wadd').onclick = () => wertZeile();
    let fpManuell = false;
    document.getElementById('fp').oninput = () => { fpManuell = true; zeigeSumme(); };

    function posten() {
      const m3 = FRAKTIONEN.reduce((s, [k]) => s + num(document.querySelector(`[data-m3="${k}"]`).value), 0);
      const et = Math.max(0, Math.floor(num(document.getElementById('oet').value)));
      const p = [];
      p.push([`Räumung und Abtransport (ca. ${m3.toLocaleString('de-DE')} m³)`, m3 * K.proM3]);
      const ent = entsorgungskosten(FRAKTIONEN.map(([k]) => [k, num(document.querySelector(`[data-m3="${k}"]`).value)]));
      if (ent.summe > 0) p.push(['Fachgerechte Entsorgung inkl. Entsorgungsgebühren', ent.summe]);
      document.getElementById('entsinfo').innerHTML = ent.details.length ? 'Entsorgung (nur für dich): ' + ent.details.map(esc).join(' · ') : '';
      if (!document.getElementById('oauf').checked && et >= 2) p.push([`Etagenzuschlag ohne Aufzug (${et}. OG)`, (et - 1) * K.etage]);
      if (document.getElementById('otrag').checked) p.push(['Zuschlag Trageweg über 20 m', K.trageweg]);
      if (document.getElementById('zk').checked) p.push(['Küchendemontage', K.kueche]);
      const rm = num(document.getElementById('zr').value); if (rm > 0) p.push([`Grundreinigung (${rm.toLocaleString('de-DE')} m²)`, rm * K.reinigungProM2]);
      let zwischen = p.reduce((s, x) => s + x[1], 0);
      const klein = document.getElementById('oart').value === 'Sperrmüllabholung';
      const minPreis = klein ? PREISE.ab.sperrmuellMin : K.mindestauftrag;
      if (zwischen < minPreis) { p.push([klein ? 'Aufrundung auf Mindestpreis Sperrmüllabholung' : 'Aufrundung auf Mindestauftrag', minPreis - zwischen]); zwischen = minPreis; }
      if (document.getElementById('ze').checked) p.push([`Express-Zuschlag (${K.expressProzent} %)`, zwischen * K.expressProzent / 100]);
      const wert = [...wertBox.querySelectorAll('.row')].map(r => [r.querySelector('.wb').value.trim(), num(r.querySelector('.wv').value)]).filter(([b, v]) => b || v);
      wert.forEach(([b, v]) => p.push([`Wertanrechnung: ${b || 'Gegenstand'}`, -v]));
      const summe = Math.max(0, p.reduce((s, x) => s + x[1], 0));
      return { m3, posten: p, summe, wert };
    }
    function zeigeSumme() { const fp = num(document.getElementById('fp').value); document.getElementById('sumpreis').textContent = eur(fp); }
    function rechnen() {
      const r = posten();
      document.getElementById('calc').innerHTML = r.posten.map(([b, v]) => `<tr><td>${esc(b)}</td><td>${eur(v)}</td></tr>`).join('') + `<tr><td><b>Berechnet</b></td><td><b>${eur(r.summe)}</b></td></tr>`;
      if (!fpManuell) document.getElementById('fp').value = Math.ceil(r.summe / 10) * 10;
      zeigeSumme();
    }
    $main.oninput = e => { if (e.target.id !== 'fp') rechnen(); };
    $main.onchange = e => { if (e.target.id === 'oart' || e.target.type === 'checkbox' && e.target.id !== 'ankunde' && e.target.id !== 'auftrag') rechnen(); };
    rechnen();

    document.getElementById('senden').onclick = async () => {
      const msg = document.getElementById('msg');
      const v = id => document.getElementById(id).value.trim();
      if (!v('kname') || !v('oadr')) { msg.innerHTML = '<p class="err">Bitte Name und Objektadresse ausfüllen.</p>'; document.getElementById('kname').scrollIntoView({ block: 'center' }); return; }
      if (document.getElementById('auftrag').checked && sig.leer()) { msg.innerHTML = '<p class="err">Bitte Unterschrift des Kunden einholen oder Häkchen bei „Auftrag erteilt“ entfernen.</p>'; return; }
      const btn = document.getElementById('senden'); btn.disabled = true; btn.textContent = 'Wird erstellt …';
      try {
        const r = posten(); const fp = num(v('fp'));
        const { nummer } = await api('nummer', { art: 'angebot' });
        const d = { nummer, datum: heute(), kunde: { name: v('kname'), tel: v('ktel'), mail: v('kmail'), adr: v('kadr') },
          objekt: { adr: v('oadr'), art: v('oart'), flaeche: v('ofl'), etage: v('oet'), aufzug: document.getElementById('oauf').checked },
          m3: Object.fromEntries(FRAKTIONEN.map(([k]) => [k, num(document.querySelector(`[data-m3="${k}"]`).value)])),
          posten: r.posten, berechnet: r.summe, festpreis: fp, gueltig: v('gueltig'), notiz: v('notiz'),
          auftrag: document.getElementById('auftrag').checked, unterschrift: sig.bild() };
        const pdf = await angebotPdf(d, fotos);
        const res = await api('speichern', { nummer, pdf, kunde: d.kunde.name, email: d.kunde.mail, telefon: d.kunde.tel, objekt: d.objekt.adr,
          betrag: fp, anKunde: document.getElementById('ankunde').checked, daten: { kunde: d.kunde, objekt: d.objekt, festpreis: fp, auftrag: d.auftrag } });
        fertig(nummer, res.gesendet, pdf);
      } catch (e) { msg.innerHTML = `<p class="err">${esc(e.message)}</p>`; btn.disabled = false; btn.textContent = 'PDF erstellen'; }
    };
  }

  function fertig(nummer, gesendet, pdf) {
    seite(`${zurueck}<h1>Fertig ✅</h1><div class="card"><p><b>${esc(nummer)}</b> wurde gespeichert.</p>
      <p>${gesendet && gesendet.length ? 'Per E-Mail gesendet an: ' + gesendet.map(esc).join(', ') : '<span class="err">E-Mail-Versand fehlgeschlagen – das PDF ist trotzdem im Archiv.</span>'}</p>
      <a class="btn sec" href="${pdf}" download="${esc(nummer.replace('Ü', 'U'))}.pdf">PDF ansehen / speichern</a><p></p><button class="btn" data-go="home">Zur Übersicht</button></div>`);
  }

  // ── Übergabe ──
  async function uebergabe() {
    const fotos = [];
    let angebote = [];
    try { angebote = (await api('liste')).protokolle.filter(p => p.art === 'Angebot'); } catch (e) { /* ohne Vorlage */ }
    seite(`${zurueck}<h1>Übergabeprotokoll</h1>
      <div class="card"><label>Aus Angebot übernehmen<select id="vorlage"><option value="">– neu –</option>${angebote.map((a, i) => `<option value="${i}">${esc(a.nummer)} · ${esc(a.kunde)} · ${esc(a.objekt)}</option>`).join('')}</select></label></div>
      <div class="card"><h2>Kunde & Objekt</h2><div class="grid">
        <label>Name *<input id="kname"></label><label>E-Mail<input id="kmail" type="email"></label>
        <label>Telefon<input id="ktel" type="tel"></label><label>Adresse des Objekts *<input id="oadr"></label>
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
      const msg = document.getElementById('msg'); const v = id => document.getElementById(id).value.trim(); const c = id => document.getElementById(id).checked;
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

  // ── Archiv ──
  async function archiv() {
    seite(`${zurueck}<h1>Archiv</h1><div class="card list" id="liste"><p class="note">Lädt …</p></div>`);
    try {
      const l = (await api('liste')).protokolle;
      document.getElementById('liste').innerHTML = l.length ? l.map(p => `<a href="api.php?a=pdf&nr=${encodeURIComponent(p.nummer)}" target="_blank" rel="noopener">
        <b>${esc(p.nummer)}</b> · ${esc(p.art)} · ${esc(p.kunde)}${p.betrag != null ? ' · ' + eur(p.betrag) : ''}
        <span>${new Date(p.datum).toLocaleString('de-DE')} · ${esc(p.objekt)}${p.gesendet && p.gesendet.length ? ' · gesendet' : ''}</span></a>`).join('') : '<p class="note">Noch keine Protokolle.</p>';
    } catch (e) { document.getElementById('liste').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
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
      doc.text(`Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. · Seite ${i} von ${n}`, 105, 290, { align: 'center' }); } };
    return P;
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
    P.platz(14); doc.setDrawColor(10, 29, 25); doc.line(P.x, P.y, 192, P.y); P.y += 7; doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Festpreis', P.x, P.y); doc.text(eur(d.festpreis), 192, P.y, { align: 'right' }); P.y += 5; doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', P.x, P.y); P.y += 8; doc.setFontSize(10);
    P.text(`Das Angebot ist gültig bis ${d.gueltig}. Der Festpreis gilt für den besichtigten Umfang; zusätzliche Gegenstände oder Räume werden vorher mit Ihnen abgestimmt.`);
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
