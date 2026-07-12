/* ============================================================
   Google Apps Script — Backend Undangan Digital
   - RSVP & ucapan tamu
   - Check-in QR saat acara
   - Pelacak buka undangan + endpoint rekap (untuk dasbor.html)
   Tempel seluruh isi file ini ke editor Apps Script, lalu DEPLOY
   ULANG (New version). Lihat CARA-RSVP-GOOGLE-SHEETS.md
   ============================================================ */

const RSVP_SHEET = 'RSVP';
const CHECKIN_SHEET = 'CheckIn';
const DIBUKA_SHEET = 'Dibuka';
const SITE = 'https://faridhenny.balanglompo.com/';  // alamat undangan

/* ============================================================
   SETUP DAFTAR TAMU TERPUSAT
   Jalankan SEKALI dari editor: pilih fungsi "setupDaftarTamu"
   di toolbar lalu klik Run. Tab "DaftarTamu" akan terbentuk
   dengan kolom Link & Kirim WA otomatis. (Tidak perlu deploy.)
   ============================================================ */
function setupDaftarTamu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Pakai locale US agar pemisah argumen rumus = koma (sesuai rumus di bawah).
  ss.setSpreadsheetLocale('en_US');
  let sh = ss.getSheetByName('DaftarTamu');
  if (!sh) sh = ss.insertSheet('DaftarTamu');
  sh.clear();

  sh.getRange('A1:G1')
    .setValues([['Nama Tamu', 'No. WA (opsional)', 'PIC / Petugas', 'Catatan', 'Link Undangan', 'Kirim WhatsApp', 'ID Check-in']])
    .setFontWeight('bold').setBackground('#f3ece2');

  setDaftarFormulas(sh);

  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(5, 340);
  sh.setColumnWidth(6, 360);
  SpreadsheetApp.getUi().alert('Tab "DaftarTamu" siap! Bagikan spreadsheet ini (akses Editor) ke pegawai.');
}

// Pasang rumus kolom E (link undangan) & F (link WA). Dipanggil saat setup dan
// setiap kali menghapus baris, agar ARRAYFORMULA (jangkar di baris 2) selalu ada.
function setDaftarFormulas(sh) {
  // Kolom E: Link undangan personal (otomatis untuk setiap nama di kolom A).
  // Bila kolom G (ID Check-in) terisi, link menyertakan &id= — dipakai QR
  // check-in agar dua tamu bernama sama tidak bentrok. Jalankan isiIdTamu
  // sekali untuk mengisi ID tamu lama.
  sh.getRange('E2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","","' + SITE + '?to="&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(A2:A,"&","%26"),",","%2C")," ","%20")&IF(G2:G="","","&id="&G2:G)))'
  );

  // Kolom F: Link kirim WhatsApp (nomor otomatis dinormalkan ke 62, pesan + link terenkode)
  var ph = 'IF(B2:B="","",IF(LEFT(B2:B&"",1)="0","62"&MID(B2:B&"",2,30),IF(LEFT(B2:B&"",2)="62",B2:B&"",IF(LEFT(B2:B&"",1)="8","62"&(B2:B&""),B2:B&""))))';
  // Kata-kata pesan WA per baris (baris kosong = jeda paragraf). Ubah di sini bila perlu,
  // lalu jalankan ulang setupDaftarTamu agar kolom F diperbarui.
  var parts = [
    '"Kepada Yth."',
    '"Bapak/Ibu/Saudara/i"',
    '"*"&A2:A&"*"',
    '"___________________"',
    '""',
    '"Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i, teman sekaligus sahabat, untuk menghadiri acara pernikahan kami."',
    '""',
    '"Berikut link undangan kami, untuk info lengkap dari acara, bisa kunjungi :"',
    '""',
    'E2:E',
    '""',
    '"Merupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir dan memberikan doa restu."',
    '""',
    '"Terima Kasih"',
    '""',
    '"Hormat kami,"',
    '"*Farid & Henny*"',
    '"__________________"',
    '""',
    '"Dibuat dengan ❤️ oleh *Undangan Balanglompo*"',
    '"undangan.balanglompo.com"'
  ];
  var msg = parts.join('&CHAR(10)&');
  var enc = function (x) {
    return 'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(' + x +
      ',"%","%25"),":","%3A"),"/","%2F"),"?","%3F"),"=","%3D"),"&","%26")," ","%20"),",","%2C"),CHAR(10),"%0A")';
  };
  sh.getRange('F2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","","https://wa.me/"&(' + ph + ')&"?text="&' + enc(msg) + '))'
  );
}

/* ============================================================
   ID UNIK TAMU — untuk QR check-in anti bentrok nama sama.
   Jalankan SEKALI dari editor: pilih "isiIdTamu" lalu Run.
   Mengisi kolom G (ID Check-in) untuk semua tamu yang belum punya,
   lalu memperbarui rumus Link agar menyertakan &id=. Tamu baru dari
   kelola-tamu.html otomatis diberi ID. QR pada link lama (tanpa id)
   tetap berfungsi dengan pencocokan nama seperti sebelumnya.
   ============================================================ */
function isiIdTamu() {
  const sh = getDaftarSheet();
  if (!sh) { SpreadsheetApp.getUi().alert('Tab DaftarTamu belum ada.'); return; }
  sh.getRange('G1').setValue('ID Check-in').setFontWeight('bold').setBackground('#f3ece2');
  const last = sh.getLastRow();
  let made = 0;
  if (last >= 2) {
    const names = sh.getRange(2, 1, last - 1, 1).getValues();
    const ids = sh.getRange(2, 7, last - 1, 1).getValues();
    const seen = {};
    ids.forEach(function (r) { const v = String(r[0]).trim(); if (v) seen[v] = true; });
    for (let i = 0; i < names.length; i++) {
      if (String(names[i][0]).trim() === '' || String(ids[i][0]).trim() !== '') continue;
      const id = buatIdTamu(seen);
      ids[i][0] = id; seen[id] = true; made++;
    }
    sh.getRange(2, 7, last - 1, 1).setValues(ids);
  }
  setDaftarFormulas(sh);
  // header kolom ID di tab CheckIn (bila tab sudah ada)
  const cs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CHECKIN_SHEET);
  if (cs && String(cs.getRange('C1').getValue()) === '') cs.getRange('C1').setValue('ID');
  SpreadsheetApp.getUi().alert('Selesai: ' + made + ' tamu diberi ID baru. Kolom Link kini menyertakan &id=.');
}

// ID pendek acak: 6 karakter huruf kecil + angka (tanpa karakter yang mirip: l/1, o/0)
function buatIdTamu(seen) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  while (true) {
    let id = '';
    for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    if (!seen[id]) return id;
  }
}

// Cari nama tamu berdasarkan ID (kolom G DaftarTamu); '' bila tak ketemu
function cariTamuById(id) {
  const sh = getDaftarSheet();
  if (!sh || sh.getLastRow() < 2) return '';
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][6]).trim() === id) return String(rows[i][0]).trim();
  }
  return '';
}

/* ============================================================
   RAPIKAN DAFTAR TAMU — jalankan SEKALI dari editor bila daftar
   ada "gap" (nama berpencar dengan banyak baris kosong).
   Menarik semua nama agar berurutan rapat dari baris 2, lalu
   mengosongkan sisa baris di bawahnya. Tidak perlu Deploy.
   (JANGAN jalankan setupDaftarTamu untuk ini — itu mengosongkan
   seluruh tab.)
   ============================================================ */
function rapikanDaftarTamu() {
  const sh = getDaftarSheet();
  if (!sh) { SpreadsheetApp.getUi().alert('Tab DaftarTamu belum ada.'); return; }
  const maxRow = sh.getMaxRows();
  // Ambil kolom A-D + G, buang baris tanpa nama (urutan dipertahankan).
  // Kolom G (ID Check-in) WAJIB ikut dibawa agar ID tetap menempel pada
  // tamunya — kalau tidak, link yang sudah terkirim menunjuk tamu yang salah.
  const rows = sh.getRange(2, 1, maxRow - 1, 7).getValues()
    .filter(function (r) { return String(r[0]).trim() !== ''; });
  const abcd = rows.map(function (r) { return r.slice(0, 4); });
  const gid  = rows.map(function (r) { return [r[6]]; });
  // Tulis rapat dari baris 2 dulu (aman: data sudah tersalin ke memori).
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 4).setValues(abcd);
    sh.getRange(2, 7, rows.length, 1).setValues(gid);
  }
  // Kosongkan sisa baris di bawahnya (bekas gap / salinan lama).
  const firstEmpty = 2 + rows.length;
  if (firstEmpty <= maxRow) {
    sh.getRange(firstEmpty, 1, maxRow - firstEmpty + 1, 4).clearContent();
    sh.getRange(firstEmpty, 7, maxRow - firstEmpty + 1, 1).clearContent();
  }
  setDaftarFormulas(sh);
  SpreadsheetApp.getUi().alert('Rapikan selesai: ' + rows.length + ' tamu kini berurutan dari baris 2 (ID ikut terbawa).');
}

/* ============================================================
   TRIGGER OTOMATIS: tamu yang diketik manual langsung di Sheet
   otomatis diberi ID Check-in (kolom G) begitu namanya ditulis —
   tanpa perlu menjalankan isiIdTamu berulang. Aktif otomatis
   setelah file ini disimpan (tidak perlu deploy, tidak perlu Run).
   ============================================================ */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== 'DaftarTamu') return;
    if (e.range.getColumn() > 4) return;            // hanya edit data tamu (A-D)
    const top = Math.max(e.range.getRow(), 2);
    const bottom = e.range.getLastRow();
    if (bottom < top) return;
    const n = bottom - top + 1;
    const names = sh.getRange(top, 1, n, 1).getValues();
    const gcol  = sh.getRange(top, 7, n, 1).getValues();
    // kumpulan ID terpakai (untuk menjaga keunikan)
    const lastRow = sh.getLastRow();
    const seen = {};
    if (lastRow >= 2) {
      sh.getRange(2, 7, lastRow - 1, 1).getValues()
        .forEach(function (r) { const v = String(r[0]).trim(); if (v) seen[v] = true; });
    }
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (String(names[i][0]).trim() !== '' && String(gcol[i][0]).trim() === '') {
        const id = buatIdTamu(seen);
        gcol[i][0] = id; seen[id] = true; changed = true;
      }
    }
    if (changed) sh.getRange(top, 7, n, 1).setValues(gcol);
  } catch (_) {}   // trigger tidak boleh melempar error ke pengguna Sheet
}

// ---------- POST ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const data = JSON.parse(e.postData.contents);

    // --- Check-in dari halaman scanner ---
    // QR baru berisi ID unik (kolom G DaftarTamu) -> duplikat dicek per ID,
    // dua tamu bernama sama tidak bentrok. QR/link lama tanpa ID -> per nama.
    if (data.type === 'checkin') {
      const sheet = getCheckinSheet();
      const id = String(data.id || '').trim().slice(0, 20);
      let name = String(data.name || '').trim().slice(0, 100);
      if (id) {
        const resmi = cariTamuById(id);
        if (resmi) name = resmi;   // nama resmi dari DaftarTamu (bukan dari QR)
      }
      if (!id && !name) return json({ ok: false, error: 'QR tidak dikenal' });

      const rows = sheet.getRange(2, 2, Math.max(sheet.getLastRow() - 1, 1), 2).getValues(); // B: nama, C: id
      const already = id
        ? rows.some(function (r) { return String(r[1]).trim() === id; })
        : rows.some(function (r) { return String(r[0]).trim().toLowerCase() === name.toLowerCase(); });
      if (!already) sheet.appendRow([new Date(), name || ('ID ' + id), id]);
      return json({ ok: true, name: name, already: already });
    }

    // --- Tambah tamu ke DaftarTamu (dari kelola-tamu.html) ---
    if (data.type === 'tamu') {
      const sheet = getDaftarSheet();
      if (!sheet) return json({ ok: false, error: 'Tab DaftarTamu belum ada. Jalankan setupDaftarTamu dulu.' });
      const name = String(data.name || '').trim().slice(0, 100);
      if (!name) return json({ ok: false, error: 'nama kosong' });
      const rowData = [
        name,
        String(data.phone || '').slice(0, 30),
        String(data.pic || '').slice(0, 50),
        String(data.note || '').slice(0, 200)
      ];
      // Jangan pakai appendRow: ARRAYFORMULA di kolom E/F membuat getLastRow
      // terbaca sampai ~1000, sehingga tamu baru meloncat jauh (menimbulkan gap).
      // Cari baris kosong pertama di kolom A lalu tulis di situ agar menempel rapat.
      const maxRow = sheet.getMaxRows();
      const colA = sheet.getRange(2, 1, maxRow - 1, 1).getValues();
      let target = 0;
      for (let i = 0; i < colA.length; i++) {
        if (String(colA[i][0]).trim() === '') { target = i + 2; break; }
      }
      // ID unik (kolom G) untuk QR check-in — dibuat otomatis untuk tamu baru
      const gvals = sheet.getRange(2, 7, maxRow - 1, 1).getValues();
      const seen = {};
      gvals.forEach(function (r) { const v = String(r[0]).trim(); if (v) seen[v] = true; });
      const gid = buatIdTamu(seen);
      if (target) {
        sheet.getRange(target, 1, 1, 4).setValues([rowData]);
        sheet.getRange(target, 7).setValue(gid);
      } else {
        sheet.appendRow(rowData); // semua baris terpakai → tambah baris baru di bawah
        sheet.getRange(sheet.getLastRow(), 7).setValue(gid);
      }
      return json({ ok: true });
    }

    // --- Hapus tamu dari DaftarTamu (dari kelola-tamu.html) ---
    if (data.type === 'hapus-tamu') {
      const sheet = getDaftarSheet();
      if (!sheet) return json({ ok: false, error: 'Tab DaftarTamu belum ada.' });
      const row = parseInt(data.row, 10);
      if (!row || row < 2) return json({ ok: false, error: 'baris tidak valid' });
      if (row > sheet.getLastRow()) return json({ ok: false, error: 'Data sudah berubah, muat ulang dulu.' });
      // Verifikasi nama di baris cocok agar tidak salah hapus bila urutan berubah.
      const expect = String(data.name || '').trim().toLowerCase();
      const actual = String(sheet.getRange(row, 1).getValue()).trim().toLowerCase();
      if (expect && expect !== actual) {
        return json({ ok: false, error: 'Data sudah berubah, muat ulang dulu.' });
      }
      sheet.deleteRow(row);
      // Pasang ulang rumus kolom E & F (jangkar ARRAYFORMULA di baris 2 bisa
      // ikut terhapus bila baris 2 yang dihapus).
      setDaftarFormulas(sheet);
      return json({ ok: true });
    }

    // --- RSVP & ucapan ---
    const sheet = getRsvpSheet();
    sheet.appendRow([
      new Date(),
      String(data.name || '').slice(0, 100),
      String(data.attend || '').slice(0, 30),
      String(data.msg || '').slice(0, 500),
      String(data.guests || '').slice(0, 10)
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- GET ----------
// ?type=checkin -> daftar check-in; ?type=tamu -> daftar tamu;
// ?type=open -> catat undangan dibuka; ?type=rekap -> data dasbor;
// selain itu -> daftar ucapan
function doGet(e) {
  const type = e && e.parameter ? e.parameter.type : '';
  if (type === 'checkin') {
    const sheet = getCheckinSheet();
    const rows = sheet.getDataRange().getValues();
    rows.shift();
    const list = rows.map(function (r) {
      return { t: r[0], name: r[1], id: (r[2] == null ? '' : String(r[2]).trim()) };
    }).reverse();
    return json({ count: list.length, list: list });
  }
  if (type === 'tamu') {
    const sheet = getDaftarSheet();
    if (!sheet || sheet.getLastRow() < 2) return json({ list: [] });
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    const list = [];
    rows.forEach(function (r, i) {
      if (String(r[0]).trim() === '') return;
      // row = nomor baris asli di Sheet (dipakai kelola-tamu.html untuk hapus)
      list.push({ row: i + 2, name: r[0], phone: r[1], pic: r[2], note: r[3], link: r[4], wa: r[5], id: String(r[6] || '').trim() });
    });
    return json({ list: list });
  }
  // --- Catat "undangan dibuka" (ping dari index.html saat halaman dimuat) ---
  // Sengaja lewat GET, bukan POST: backend lama membalas GET tak dikenal dengan
  // bacaan biasa (tanpa efek samping), jadi index.html aman live lebih dulu.
  if (type === 'open') {
    const name = String(e.parameter.name || '').trim().slice(0, 100);
    if (name) getDibukaSheet().appendRow([new Date(), name]);
    return json({ ok: !!name });
  }
  // --- Rekap dasbor: semua data dalam satu respons (dipakai dasbor.html) ---
  if (type === 'rekap') return json(buildRekap());
  const sheet = getRsvpSheet();
  const rows = sheet.getDataRange().getValues();
  rows.shift();
  const list = rows.map(function (r) {
    return { t: r[0], name: r[1], attend: r[2], msg: r[3], guests: r[4] };
  }).reverse();
  return json(list);
}

// Gabungan data untuk dasbor.html: daftar tamu (tanpa nomor WA — dasbor tak
// membutuhkannya), RSVP, check-in, dan agregat "dibuka" per nama.
function buildRekap() {
  const out = { ok: true, tamu: [], rsvp: [], checkin: [], dibuka: [] };

  const ds = getDaftarSheet();
  if (ds && ds.getLastRow() >= 2) {
    ds.getRange(2, 1, ds.getLastRow() - 1, 3).getValues().forEach(function (r) {
      if (String(r[0]).trim() !== '') out.tamu.push({ name: r[0], pic: r[2] });
    });
  }

  const rrows = getRsvpSheet().getDataRange().getValues();
  rrows.shift();
  out.rsvp = rrows.map(function (r) {
    return { t: r[0], name: r[1], attend: r[2], msg: r[3], guests: r[4] };
  }).reverse();

  const crows = getCheckinSheet().getDataRange().getValues();
  crows.shift();
  out.checkin = crows.map(function (r) { return { t: r[0], name: r[1] }; }).reverse();

  const orows = getDibukaSheet().getDataRange().getValues();
  orows.shift();
  const agg = {};
  orows.forEach(function (r) {
    const k = String(r[1] || '').trim().toLowerCase();
    if (!k) return;
    if (!agg[k]) { agg[k] = { name: r[1], n: 0, first: r[0], last: r[0] }; }
    agg[k].n++;
    if (r[0] < agg[k].first) agg[k].first = r[0];
    if (r[0] > agg[k].last) agg[k].last = r[0];
  });
  out.dibuka = Object.keys(agg).map(function (k) { return agg[k]; });

  return out;
}

// ---------- helpers ----------
function getRsvpSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RSVP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(RSVP_SHEET);
    sheet.appendRow(['Waktu', 'Nama', 'Kehadiran', 'Ucapan', 'Jumlah Tamu']);
  }
  return sheet;
}

function getDaftarSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DaftarTamu');
}

function getCheckinSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CHECKIN_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CHECKIN_SHEET);
    sheet.appendRow(['Waktu Datang', 'Nama Tamu', 'ID']);
  }
  return sheet;
}

function getDibukaSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DIBUKA_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(DIBUKA_SHEET);
    sheet.appendRow(['Waktu', 'Nama Tamu']);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
