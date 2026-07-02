/* ============================================================
   LIVE EDIT — "Visual Builder" untuk demo katalog
   ------------------------------------------------------------
   Alat marketing: pengunjung katalog bisa coba-coba mengubah
   warna, font, ukuran teks, dan latar undangan secara langsung
   (preview saja, tidak disimpan / tidak memengaruhi undangan asli).

   Cara pakai: sisipkan satu baris sebelum </body> di halaman demo:
       <script src="../live-edit.js"></script>

   File ini mandiri (tanpa dependensi) dan menyuntikkan UI + style
   sendiri. JANGAN sisipkan ke undangan klien asli — khusus demo.
   ============================================================ */
(function () {
  "use strict";
  if (window.__liveEditLoaded) return;
  window.__liveEditLoaded = true;

  var ROOT = document.documentElement;
  var APP  = document.querySelector(".app") || document.body;
  var loadedFonts = {};

  /* ---- daftar font Google (dipakai semua kontrol tipografi) ----
     [namaFont, jenisGenericFallback] */
  var ALL_FONTS = [
    ["Carattere","cursive"], ["Great Vibes","cursive"], ["Sacramento","cursive"],
    ["Allura","cursive"], ["Parisienne","cursive"], ["Dancing Script","cursive"],
    ["Pinyon Script","cursive"],
    ["Cormorant SC","serif"], ["Cinzel","serif"], ["Marcellus","serif"],
    ["Playfair Display","serif"], ["Cormorant Garamond","serif"],
    ["Cormorant Upright","serif"], ["Lora","serif"], ["EB Garamond","serif"],
    ["Spectral","serif"], ["Sura","serif"],
    ["Montserrat","sans-serif"], ["Jost","sans-serif"], ["Poppins","sans-serif"],
    ["Lato","sans-serif"], ["Raleway","sans-serif"]
  ];
  function genericFor(name){
    for (var i=0;i<ALL_FONTS.length;i++) if (ALL_FONTS[i][0]===name) return ALL_FONTS[i][1];
    return "serif";
  }

  /* ---- TIPOGRAFI: kontrol per-elemen (label, selektor, deskripsi) ---- */
  var TYPO_ITEMS = [
    ["Judul Utama",   ".names, .sec-title",          "Nama mempelai & judul section"],
    ["Nama Panggilan","#couple .name",               "Nama panggilan mempelai"],
    ["Nama Lengkap",  ".full",                       "Nama lengkap mempelai"],
    ["Teks Body",     ".couple-intro, .ayat, .sub",  "Paragraf & teks isi"]
  ];

  /* ---- WARNA: peran bernama ramah (var, label, deskripsi) ---- */
  var COLORS = [
    ["--bg",       "Warna Background 1", "Latar utama undangan"],
    ["--bg-deep",  "Warna Background 2", "Latar sekunder / kartu"],
    ["--ink",      "Warna Font",         "Warna teks utama"],
    ["--gold",     "Warna Aksen",        "Ornamen & garis emas"],
    ["--green",    "Warna Tombol",       "Tombol, link & ikon"],
    ["--deep",     "Warna Bagian Gelap", "Latar bagian gelap"]
  ];

  /* ============================================================
     1. STYLE
     ============================================================ */
  var css = document.createElement("style");
  css.textContent = [
    ".le-fab{position:fixed;left:16px;bottom:16px;z-index:99998;display:inline-flex;align-items:center;gap:8px;",
    "  padding:11px 18px;border:none;border-radius:999px;cursor:pointer;font:600 13px/1 system-ui,sans-serif;",
    "  letter-spacing:.3px;color:#fff;background:#1d1d24;box-shadow:0 8px 26px rgba(0,0,0,.28);transition:.2s}",
    ".le-fab:hover{transform:translateY(-2px)}",
    ".le-fab .dot{width:8px;height:8px;border-radius:50%;background:#e0b15f;box-shadow:0 0 8px #e0b15f}",
    ".le-panel{position:fixed;left:16px;bottom:16px;z-index:99999;width:310px;max-width:calc(100vw - 32px);",
    "  max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:16px;color:#23232b;",
    "  box-shadow:0 18px 50px rgba(0,0,0,.3);font:400 13px/1.5 system-ui,sans-serif;transform:translateY(8px);",
    "  opacity:0;pointer-events:none;transition:.2s}",
    ".le-panel.open{transform:none;opacity:1;pointer-events:auto}",
    ".le-head{padding:16px 18px 12px;position:sticky;top:0;background:#fff;border-bottom:1px solid #eee;z-index:2}",
    ".le-eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9a9aa5;font-weight:600}",
    ".le-title{font-size:17px;font-weight:700;margin-top:3px}",
    ".le-sub{font-size:11px;color:#9a9aa5;margin-top:2px}",
    ".le-x{position:absolute;top:14px;right:14px;width:26px;height:26px;border:none;border-radius:8px;",
    "  background:#f1f1f4;cursor:pointer;font-size:15px;color:#666;line-height:1}",
    ".le-tabs{display:flex;gap:6px;margin-top:12px}",
    ".le-tab{flex:1;padding:8px;border:none;border-radius:9px;background:#f1f1f4;color:#555;font:600 12px system-ui;",
    "  cursor:pointer;transition:.15s}",
    ".le-tab.active{background:#1d1d24;color:#fff}",
    ".le-body{padding:14px 18px 4px}",
    ".le-pane{display:none}.le-pane.active{display:block}",
    /* baris kontrol */
    ".le-item{padding:13px 0;border-bottom:1px solid #f0f0f3}",
    ".le-item:last-child{border-bottom:none}",
    ".le-itop{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}",
    ".le-iname{font-size:13px;font-weight:600}",
    ".le-idesc{font-size:10.5px;color:#a2a2ad;margin-top:1px}",
    ".le-def{flex:none;font:600 10px system-ui;color:#8a8a95;background:#f1f1f4;border:none;border-radius:6px;",
    "  padding:4px 8px;cursor:pointer;letter-spacing:.3px}",
    ".le-def:hover{background:#e6e6ec;color:#444}",
    ".le-ctrl{display:flex;align-items:center;gap:9px;margin-top:9px}",
    ".le-select{flex:1;min-width:0;border:1px solid #e4e4ea;border-radius:8px;padding:7px 8px;font:500 12px system-ui;",
    "  background:#fafafa;color:#333;cursor:pointer}",
    ".le-range{flex:1;accent-color:#1d1d24}",
    ".le-szv{flex:none;width:42px;text-align:right;font:600 11px monospace;color:#777}",
    ".le-row{display:flex;align-items:center;gap:9px;margin-top:9px}",
    ".le-row input[type=color]{width:34px;height:30px;padding:0;border:1px solid #ddd;border-radius:8px;background:none;cursor:pointer;flex:none}",
    ".le-hex{flex:1;min-width:0;border:1px solid #e4e4ea;border-radius:8px;padding:7px 9px;font:500 12px monospace;color:#444}",
    /* preset */
    ".le-presets{padding:13px 0 4px}",
    ".le-plabel{font-size:11px;font-weight:600;color:#777;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}",
    ".le-swatches{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
    ".le-sw{height:32px;border-radius:9px;border:2px solid transparent;cursor:pointer}",
    ".le-sw.active{border-color:#1d1d24}",
    /* latar */
    ".le-foot{display:flex;gap:8px;padding:12px 18px}",
    ".le-foot button{flex:1;padding:10px;border-radius:10px;border:none;cursor:pointer;font:600 12px system-ui;background:#1d1d24;color:#fff}",
    ".le-note{font-size:10.5px;color:#aaa;text-align:center;padding:0 18px 14px}"
  ].join("");
  document.head.appendChild(css);

  /* ============================================================
     2. MARKUP
     ============================================================ */
  var fab = document.createElement("button");
  fab.className = "le-fab";
  fab.innerHTML = '<span class="dot"></span> Ubah Tampilan';
  document.body.appendChild(fab);

  var panel = document.createElement("div");
  panel.className = "le-panel";
  panel.innerHTML =
    '<div class="le-head">' +
      '<button class="le-x" aria-label="Tutup">&times;</button>' +
      '<div class="le-eyebrow">Mode Preview</div>' +
      '<div class="le-title">Visual Builder</div>' +
      '<div class="le-sub">Simulasi warna &amp; font sesuai selera Anda</div>' +
      '<div class="le-tabs">' +
        '<button class="le-tab active" data-pane="warna">Warna</button>' +
        '<button class="le-tab" data-pane="font">Tipografi</button>' +
        '<button class="le-tab" data-pane="latar">Latar</button>' +
      '</div>' +
    '</div>' +
    '<div class="le-body">' +
      '<div class="le-pane active" data-pane="warna" id="le-warna"></div>' +
      '<div class="le-pane" data-pane="font" id="le-font"></div>' +
      '<div class="le-pane" data-pane="latar" id="le-latar"></div>' +
    '</div>' +
    '<div class="le-foot"><button class="le-reset">Reset Semua</button></div>' +
    '<div class="le-note">Hanya pratinjau — tidak mengubah undangan asli.</div>';
  document.body.appendChild(panel);

  fab.addEventListener("click", function(){ panel.classList.add("open"); fab.style.display="none"; });
  panel.querySelector(".le-x").addEventListener("click", function(){ panel.classList.remove("open"); fab.style.display=""; });
  panel.querySelectorAll(".le-tab").forEach(function(t){
    t.addEventListener("click", function(){
      panel.querySelectorAll(".le-tab").forEach(function(x){x.classList.remove("active");});
      panel.querySelectorAll(".le-pane").forEach(function(x){x.classList.remove("active");});
      t.classList.add("active");
      panel.querySelector('.le-pane[data-pane="'+t.dataset.pane+'"]').classList.add("active");
    });
  });

  /* ============================================================
     3. HELPER
     ============================================================ */
  function cssVar(name){ return getComputedStyle(ROOT).getPropertyValue(name).trim(); }
  function toHex(c){
    if(!c) return "#000000";
    if(c[0]==="#"){ return c.length===4 ? "#"+c[1]+c[1]+c[2]+c[2]+c[3]+c[3] : c.slice(0,7); }
    var m=c.match(/\d+/g); if(!m) return "#000000";
    return "#"+m.slice(0,3).map(function(n){return ("0"+parseInt(n,10).toString(16)).slice(-2);}).join("");
  }
  function loadFont(name){
    if(loadedFonts[name]) return; loadedFonts[name]=true;
    var l=document.createElement("link"); l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(name).replace(/%20/g,"+")+":wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }
  function fontOptions(selected){
    return ALL_FONTS.map(function(f){
      return '<option value="'+f[0]+'"'+(f[0]===selected?" selected":"")+'>'+f[0]+'</option>';
    }).join("");
  }

  /* ============================================================
     4. PANE WARNA — preset + peran warna bernama
     ============================================================ */
  var paneWarna = document.getElementById("le-warna");

  var PRESETS = [
    ["Rose",    {"--bg":"#f7efec","--bg-deep":"#efe1dc","--ink":"#4a3b3b","--gold":"#bd9968","--green":"#b07f86","--deep":"#6e4046"}],
    ["Navy",    {"--bg":"#f3f4f7","--bg-deep":"#e4e7ee","--ink":"#2e3447","--gold":"#b99a5b","--green":"#5b6788","--deep":"#2c3553"}],
    ["Sage",    {"--bg":"#f1f4ef","--bg-deep":"#e4ebe0","--ink":"#3a4438","--gold":"#a98c52","--green":"#7c8f6b","--deep":"#3e4b38"}],
    ["Mocha",   {"--bg":"#f4efe9","--bg-deep":"#e9e0d4","--ink":"#43382e","--gold":"#b08653","--green":"#8a6f55","--deep":"#4a3829"}],
    ["Emerald", {"--bg":"#eef4f1","--bg-deep":"#dde9e2","--ink":"#23463a","--gold":"#a8894f","--green":"#3f7a63","--deep":"#1f4035"}],
    ["Lavender",{"--bg":"#f4f1f7","--bg-deep":"#e8e2ef","--ink":"#3e3548","--gold":"#a98ec4","--green":"#8b7aa8","--deep":"#3c2f54"}],
    ["Ocean",   {"--bg":"#eef3f6","--bg-deep":"#dde9ee","--ink":"#243a45","--gold":"#5b94a8","--green":"#3f7e8f","--deep":"#1f3b46"}],
    ["Sunset",  {"--bg":"#f8efe8","--bg-deep":"#f0ddcf","--ink":"#4a342e","--gold":"#d18b4e","--green":"#c4694e","--deep":"#6e3a2e"}]
  ];
  var presetWrap = document.createElement("div");
  presetWrap.className = "le-presets";
  presetWrap.innerHTML = '<div class="le-plabel">Palet Siap Pakai</div>';
  var sw = document.createElement("div"); sw.className="le-swatches";
  PRESETS.forEach(function(p){
    var b=document.createElement("button"); b.className="le-sw"; b.title=p[0];
    b.style.background="linear-gradient(135deg,"+p[1]["--green"]+" 0 50%,"+p[1]["--gold"]+" 50% 100%)";
    b.addEventListener("click", function(){
      Object.keys(p[1]).forEach(function(k){ ROOT.style.setProperty(k,p[1][k]); });
      syncColorInputs();
      sw.querySelectorAll(".le-sw").forEach(function(x){x.classList.remove("active");});
      b.classList.add("active");
    });
    sw.appendChild(b);
  });
  presetWrap.appendChild(sw); paneWarna.appendChild(presetWrap);

  var colorInputs = {};
  COLORS.forEach(function(c){
    var name=c[0], label=c[1], desc=c[2];
    var it=document.createElement("div"); it.className="le-item";
    it.innerHTML =
      '<div class="le-itop"><div><div class="le-iname">'+label+'</div><div class="le-idesc">'+desc+'</div></div>' +
      '<button class="le-def">Default</button></div>' +
      '<div class="le-row"><input type="color"><input type="text" class="le-hex" spellcheck="false"></div>';
    var color=it.querySelector('input[type=color]'), hex=it.querySelector('.le-hex'), def=it.querySelector('.le-def');
    function apply(v){ ROOT.style.setProperty(name,v); }
    color.addEventListener("input", function(){ hex.value=color.value; apply(color.value); });
    hex.addEventListener("change", function(){
      var v=hex.value.trim(); if(v[0]!=="#") v="#"+v; color.value=toHex(v); apply(v);
    });
    def.addEventListener("click", function(){
      ROOT.style.removeProperty(name);
      var h=toHex(cssVar(name)); color.value=h; hex.value=h;
    });
    colorInputs[name]={color:color,hex:hex};
    paneWarna.appendChild(it);
  });
  function syncColorInputs(){
    COLORS.forEach(function(c){
      var h=toHex(cssVar(c[0]));
      colorInputs[c[0]].color.value=h; colorInputs[c[0]].hex.value=h;
    });
  }

  /* ============================================================
     5. PANE TIPOGRAFI — kontrol per-elemen
     ============================================================ */
  var paneFont = document.getElementById("le-font");

  TYPO_ITEMS.forEach(function(item){
    var label=item[0], sel=item[1], desc=item[2];
    var els = APP.querySelectorAll(sel);
    if(!els.length) return;                                  // lewati kalau tema ini tak punya elemennya

    // tangkap ukuran & font asli tiap elemen
    var bases=[];
    els.forEach(function(el){ bases.push({el:el, size:parseFloat(getComputedStyle(el).fontSize)}); });
    var curFam = getComputedStyle(els[0]).fontFamily.replace(/['"]/g,"").split(",")[0].trim();

    var it=document.createElement("div"); it.className="le-item";
    it.innerHTML =
      '<div class="le-itop"><div><div class="le-iname">'+label+'</div><div class="le-idesc">'+desc+'</div></div>' +
      '<button class="le-def">Default</button></div>' +
      '<div class="le-ctrl"><select class="le-select">'+fontOptions(curFam)+'</select></div>' +
      '<div class="le-ctrl"><input type="range" class="le-range" min="70" max="150" step="5" value="100">' +
      '<span class="le-szv">100%</span></div>';

    var selEl=it.querySelector("select"), range=it.querySelector("input"), szv=it.querySelector(".le-szv"), def=it.querySelector(".le-def");

    selEl.addEventListener("change", function(){
      var fam=selEl.value; loadFont(fam);
      var ff="'"+fam+"', "+genericFor(fam);
      bases.forEach(function(b){ b.el.style.fontFamily=ff; });
    });
    range.addEventListener("input", function(){
      var scale=parseInt(range.value,10)/100; szv.textContent=range.value+"%";
      bases.forEach(function(b){ b.el.style.fontSize=(b.size*scale).toFixed(2)+"px"; });
    });
    def.addEventListener("click", function(){
      bases.forEach(function(b){ b.el.style.fontFamily=""; b.el.style.fontSize=""; });
      selEl.value=curFam; range.value=100; szv.textContent="100%";
    });

    paneFont.appendChild(it);
  });

  /* ============================================================
     6. PANE LATAR
     ============================================================ */
  var paneLatar = document.getElementById("le-latar");
  var bgBase = APP.style.background;
  var BGS = [
    ["Asli (default)", ""],
    ["Polos",          "solid"],
    ["Gradien Lembut", "radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--gold) 18%, var(--bg)) 0%, var(--bg) 55%)"],
    ["Tekstur Kain",   "url('texture.svg')"],
    ["Motif Bunga",    "url('bloom.svg')"],
    ["Tenun",          "url('tenun.svg')"]
  ];
  var bgIt=document.createElement("div"); bgIt.className="le-item";
  bgIt.innerHTML='<div class="le-iname">Gaya Latar</div><div class="le-idesc">Latar belakang halaman undangan</div>' +
    '<div class="le-ctrl"><select class="le-select">' +
    BGS.map(function(b,i){return '<option value="'+i+'">'+b[0]+'</option>';}).join("") + '</select></div>';
  var bgSel=bgIt.querySelector("select");
  bgSel.addEventListener("change", function(){
    var v=BGS[parseInt(bgSel.value,10)][1];
    if(v===""){ APP.style.background=bgBase; APP.style.backgroundSize=""; }
    else if(v==="solid"){ APP.style.background="var(--bg)"; }
    else if(v.indexOf("url(")===0){ APP.style.background=v+" repeat, var(--bg)"; APP.style.backgroundSize="300px auto"; }
    else { APP.style.background=v; }
  });
  paneLatar.appendChild(bgIt);
  var bgNote=document.createElement("div"); bgNote.className="le-idesc"; bgNote.style.padding="10px 0 4px";
  bgNote.textContent="Foto cover & galeri tetap bisa diganti sesuai permintaan saat pemesanan.";
  paneLatar.appendChild(bgNote);

  /* ============================================================
     7. RESET SEMUA
     ============================================================ */
  panel.querySelector(".le-reset").addEventListener("click", function(){
    COLORS.forEach(function(c){ ROOT.style.removeProperty(c[0]); });
    syncColorInputs();
    sw.querySelectorAll(".le-sw").forEach(function(x){x.classList.remove("active");});
    paneFont.querySelectorAll(".le-item .le-def").forEach(function(b){ b.click(); });
    APP.style.background=bgBase; APP.style.backgroundSize=""; bgSel.value="0";
  });

  syncColorInputs();
})();
