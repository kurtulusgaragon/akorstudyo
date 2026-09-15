"use strict";

// -------------------------------------------------------------
// PWA KAYDI (GÜVENLİ VE SAKİN GÜNCELLEME MODU)
// -------------------------------------------------------------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => console.log('PWA Aktif.')).catch(err => console.log('PWA Hatası:', err));
    });
    document.addEventListener('visibilitychange', () => {
        const gameIframe = document.getElementById('game-iframe');
        if (document.visibilityState === 'hidden' && gameIframe) { gameIframe.src = "about:blank"; } 
        else if (document.visibilityState === 'visible') { navigator.serviceWorker.ready.then(reg => reg.update()); }
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            if(window.showToast) {
                const updateToast = window.showToast(window.appLang === 'en' ? "🚀 NEW VERSION READY! Click here to update." : "🚀 YENİ SÜRÜM HAZIR! Güncellemek İçin Buraya Tıklayın.", 0);
                if (updateToast) {
                    updateToast.style.cursor = 'pointer'; updateToast.style.border = '2px solid var(--success)'; updateToast.style.boxShadow = '0 0 20px rgba(64, 192, 87, 0.6)';
                    updateToast.addEventListener('click', () => { updateToast.innerText = window.appLang === 'en' ? "⏳ Updating..." : "⏳ Güncelleniyor..."; window.location.reload(true); }); 
                }
            }
        }
    });
}

// MASAÜSTÜ PWA 
let deferredPrompt;
const installBtn = document.getElementById('btn-install-app');
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(installBtn) installBtn.style.display = 'inline-block'; });
if(installBtn) { installBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') installBtn.style.display = 'none'; deferredPrompt = null; } }); }
window.addEventListener('appinstalled', () => { if(installBtn) installBtn.style.display = 'none'; });

// TAM EKRAN VE BAŞA DÖN
const btnFullscreen = document.getElementById('btn-fullscreen');
if(btnFullscreen) { btnFullscreen.addEventListener('click', () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => console.log(err)); btnFullscreen.innerText = "✖ Çıkış"; } else { document.exitFullscreen(); btnFullscreen.innerText = "⛶ Tam Ekran"; } }); }
document.addEventListener('fullscreenchange', () => { if(btnFullscreen) btnFullscreen.innerText = document.fullscreenElement ? "✖ Çıkış" : "⛶ Tam Ekran"; });

const btnScrollTop = document.getElementById('btn-scroll-top');
if(btnScrollTop) { let isScrolling = false; window.addEventListener('scroll', () => { if (!isScrolling) { window.requestAnimationFrame(() => { if (window.scrollY > 300) btnScrollTop.classList.add('visible'); else btnScrollTop.classList.remove('visible'); isScrolling = false; }); isScrolling = true; } }); btnScrollTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }

const shortcutsModal = document.getElementById('shortcuts-modal'); const btnShortcuts = document.getElementById('btn-shortcuts'); const btnCloseModal = document.getElementById('btn-close-modal');
if(btnShortcuts && shortcutsModal) btnShortcuts.addEventListener('click', () => shortcutsModal.classList.add('show'));
if(btnCloseModal && shortcutsModal) btnCloseModal.addEventListener('click', () => shortcutsModal.classList.remove('show'));
if(shortcutsModal) { shortcutsModal.addEventListener('click', (e) => { if(e.target === shortcutsModal) shortcutsModal.classList.remove('show'); }); }

function triggerBtnEffect(id) { const btn = document.getElementById(id); if(btn) { btn.classList.remove('flash-btn'); void btn.offsetWidth; btn.classList.add('flash-btn'); setTimeout(() => btn.classList.remove('flash-btn'), 200); } }

// -------------------------------------------------------------
// TEMEL DEĞİŞKENLER VE GLOBAL KÖPRÜ
// -------------------------------------------------------------
let currentRootIndex = 9; let currentType = "Min";
let baseRootIndex = 9; let baseType = "Min";
let transCount = 0; let progTransCount = 0; let capoFret = 0; 
let currentVariations = []; let currentVarIndex = 0;
let isLefty = false; let progression = [];
let viewingScaleMode = false; let wasFocusModeOn = false; 

// Diğer modüllerle ortak çalışacak global değişkenler
window.isMetroOn = false; 
window.bpm = 120; 
window.metroVol = 0.5; 
window.chordVol = 0.7;
window.current16thNote = 0; 
window.nextNoteTime = 0.0;
window.isPlayingProgression = false;
window.isStudioRecording = false;
window.mixDestNode = null;
window.studioAnalyser = null;
window.domCache = {};

let currentProgressionIndex = 0;
let progressionBeatCounter = 0; let trainerMeasureCount = 0;
let isSpeedTrainerOn = false; let isVisualMetroOn = false; 

window.showToast = function(message, duration = 3000) {
    const container = document.getElementById('toast-container'); if (!container) return;
    const toast = document.createElement('div'); toast.className = 'toast'; toast.innerText = message;
    if (duration === 0) { toast.style.animation = 'toastFadeIn 0.3s ease forwards'; }
    container.appendChild(toast);
    if (duration > 0) { setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration); }
    return toast;
};

function saveSession() {
    try { const sessionData = { p: progression, b: window.bpm, s: window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down' }; localStorage.setItem('gitar_session', JSON.stringify(sessionData)); } catch (error) {}
}

window.addEventListener('DOMContentLoaded', () => {
    window.domCache.bpmSlider = document.getElementById('bpm-slider'); window.domCache.bpmInput = document.getElementById('bpm-input'); window.domCache.trainerStatus = document.getElementById('trainer-status'); window.domCache.rhythmStyle = document.getElementById('rhythm-style'); window.domCache.drumStyle = document.getElementById('drum-style'); window.domCache.capoVal = document.getElementById('capo-val'); window.domCache.transVal = document.getElementById('trans-val'); window.domCache.progTransVal = document.getElementById('prog-trans-val'); window.domCache.strumVis = document.getElementById('strum-visualizer'); window.domCache.instrumentSelect = document.getElementById('instrument-select'); window.domCache.recMeter = document.getElementById('rec-meter');
    const sortableList = document.getElementById('sortable-list'); const savedOrder = localStorage.getItem('gitar_panel_order');
    if (savedOrder && sortableList) { try { JSON.parse(savedOrder).forEach(id => { const el = document.getElementById(id); if (el) sortableList.appendChild(el); }); } catch(e){} }

    const savedSession = localStorage.getItem('gitar_session');
    if (savedSession) {
        try {
            let parsed = JSON.parse(savedSession);
            if(parsed.b) { window.bpm = parsed.b; if(window.domCache.bpmSlider) window.domCache.bpmSlider.value = window.bpm; if(window.domCache.bpmInput) window.domCache.bpmInput.value = window.bpm; }
            if(parsed.s && window.domCache.rhythmStyle) window.domCache.rhythmStyle.value = parsed.s;
            if(parsed.p && Array.isArray(parsed.p)) { progression = parsed.p.map(item => ({ root: item.r !== undefined ? item.r : item.root, type: item.t !== undefined ? item.t : item.type, shape: item.shape || window.generateVariations(item.r !== undefined ? item.r : item.root, item.t !== undefined ? item.t : item.type)[0] })); }
        } catch(e){}
    }

    const urlParams = new URLSearchParams(window.location.search); const jamDataStr = urlParams.get('jam');
    if(jamDataStr) {
        try {
            let parsed = JSON.parse(atob(jamDataStr));
            if(parsed.b) { window.bpm = parsed.b; if(window.domCache.bpmSlider) window.domCache.bpmSlider.value = window.bpm; if(window.domCache.bpmInput) window.domCache.bpmInput.value = window.bpm; }
            if(parsed.s && window.domCache.rhythmStyle) window.domCache.rhythmStyle.value = parsed.s;
            if(parsed.p && Array.isArray(parsed.p)) { progression = parsed.p.map(item => ({ root: item.r, type: item.t, shape: window.generateVariations(item.r, item.t)[0] })); }
            setTimeout(() => saveSession(), 500);
        } catch(e) {}
    }
    renderProgression();

    const bgImages = { 'click': "url('./bg-click.jpg')", 'rock': "url('./bg-rock.jpg')", 'funk': "url('./bg-funk.jpg')", 'lofi': "url('./bg-lofi.jpg')", 'jazz': "url('https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=2089&auto=format&fit=crop')" };
    if(window.domCache.drumStyle) { 
        window.domCache.drumStyle.addEventListener('change', (e) => { 
            document.body.style.backgroundImage = bgImages[e.target.value] || bgImages['click']; 
            if (e.target.value !== 'click' && !window.bonhamMessageShown) {
                const title = window.appLang === 'en' ? "Drop the Mechanics, Catch the Groove" : "Mekaniği Bırak, Groove'u Yakala";
                const msg = window.appLang === 'en' ? "John Bonham or James Brown had a soul (groove) in their rhythms. Get a virtual drummer behind you and jam like you're in the studio!" : "Led Zeppelin'den John Bonham veya James Brown'ın ritimlerinde bir ruh (groove) vardı. Sadece mekanik bir tık sesine uymak yerine, arkana sanal bir baterist al ve stüdyodaymış gibi devleş!";
                showLegendMessage(title, msg);
                window.bonhamMessageShown = true;
            }
        }); 
    }

    const btnExportTab = document.getElementById('btn-export-tab');
    if(btnExportTab) {
        btnExportTab.addEventListener('click', () => {
            if (progression.length === 0) return alert(window.appLang === 'en' ? 'Add chords to the progression first!' : 'Önce akor dizisine akor eklemelisin!');
            let tabStrings = ['e|', 'B|', 'G|', 'D|', 'A|', 'E|'];
            progression.forEach(prog => {
                let shape = prog.shape || window.generateVariations(prog.root, prog.type)[0]; if(!shape) return;
                for(let i = 0; i < 6; i++) { let sd = shape[5-i]; let fret = (sd && sd.fret !== undefined && sd.fret !== 'x') ? (sd.fret === 0 ? capoFret : sd.fret + capoFret) : 'x'; let strVal = fret.toString(); tabStrings[i] += `-${strVal.length === 1 ? strVal+'-' : strVal}-|`; }
            });
            let finalTab = tabStrings.join('\n'); let tabHeader = (typeof isLefty !== 'undefined' && isLefty) ? (window.appLang === 'en' ? "*(Note: Lefty mode is active but TAB is generated in standard layout for universal readability)*\n\n" : "*(Not: Solak mod aktif ancak TAB evrensel okunabilirlik için standart düzende oluşturulmuştur)*\n\n") : "";
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(tabHeader + finalTab).then(() => { alert((window.appLang === 'en' ? "🎸 TAB Copied to Clipboard!\n\n" : "🎸 TAB Panoya Kopyalandı!\n\n") + tabHeader + finalTab); }).catch(() => alert(tabHeader + finalTab)); } else { alert(tabHeader + finalTab); }
        });
    }

    const btnShareJam = document.getElementById('btn-share-jam');
    if(btnShareJam) {
        btnShareJam.addEventListener('click', () => {
            if (progression.length === 0) return alert(window.appLang === 'en' ? 'No chord progression to share!' : 'Paylaşacak bir akor dizisi yok!');
            let jamData = { p: progression.map(p => ({r: p.root, t: p.type})), b: window.bpm, s: window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down' };
            let base64 = btoa(JSON.stringify(jamData)); let url = new URL(window.location.href); url.searchParams.set('jam', base64);
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url.href).then(() => { alert((window.appLang === 'en' ? "🔗 Jam Link Copied!\n\n" : "🔗 Jam Linki Panoya Kopyalandı!\n\n") + url.href); }).catch(() => alert(url.href)); } else { alert(url.href); }
        });
    }
});

const rootSelect = document.getElementById('root-select'); const typeSelect = document.getElementById('type-select'); const fretboardEl = document.getElementById('fretboard'); const fretNumbersEl = document.getElementById('fret-numbers'); const timelineEl = document.getElementById('prog-timeline'); const btnToggleScale = document.getElementById('btn-toggle-scale'); const scalePatternBox = document.getElementById('scale-pattern-box'); const scalePositionSelect = document.getElementById('scale-position-select'); const advScaleSelect = document.getElementById('adv-scale-select'); 

if(rootSelect) {
    window.notes.forEach((note, index) => { const option = document.createElement('option'); option.value = index; option.text = window.trNotes[note]; if(note === "A") option.selected = true; rootSelect.appendChild(option); });
}

if(scalePositionSelect) scalePositionSelect.addEventListener('change', () => { if(viewingScaleMode) drawScaleFretboard(); });
if(advScaleSelect) advScaleSelect.addEventListener('change', () => { if(viewingScaleMode) drawScaleFretboard(); });
const woodThemeSelect = document.getElementById('wood-theme-select');
if(woodThemeSelect) { woodThemeSelect.addEventListener('change', (e) => { const v = e.target.value; document.body.classList.remove('theme-maple', 'theme-ebony'); if(v === 'maple') document.body.classList.add('theme-maple'); else if(v === 'ebony') document.body.classList.add('theme-ebony'); }); }

function updateTransUI() {
    if(window.domCache.transVal) window.domCache.transVal.innerText = transCount > 0 ? `+${transCount}` : transCount;
    if(window.domCache.progTransVal) window.domCache.progTransVal.innerText = progTransCount > 0 ? `+${progTransCount}` : progTransCount;
}

function updateScaleAssistant() {
    const effectiveRootIndex = (currentRootIndex + capoFret) % 12; const rootNoteEng = window.notes[effectiveRootIndex]; const rootNameTr = window.trNotes[rootNoteEng];
    const isMin = currentType === "Min" || currentType === "Min7" || currentType === "Sus2" || currentType === "Dim" || currentType === "Min7b5" || currentType === "Min9" || currentType === "mMaj7" || currentType === "mAdd9" || currentType === "m6" || currentType.includes("m");
    let advMode = advScaleSelect ? advScaleSelect.value : 'auto'; let scaleName = "";
    
    if(advMode === 'auto') { scaleName = isMin ? (window.appLang === 'en' ? `${rootNoteEng} Minor Pentatonic` : `${rootNameTr} Minör Pentatonik`) : (window.appLang === 'en' ? `${rootNoteEng} Major Pentatonic` : `${rootNameTr} Majör Pentatonik`); } 
    else { const names = window.appLang === 'en' ? { 'maj_pent': 'Major Pentatonic', 'min_pent': 'Minor Pentatonic', 'ionian': 'Ionian (Major)', 'aeolian': 'Aeolian (Minor)', 'dorian': 'Dorian', 'phrygian': 'Phrygian', 'lydian': 'Lydian', 'mixolydian': 'Mixolydian' } : { 'maj_pent': 'Majör Pentatonik', 'min_pent': 'Minör Pentatonik', 'ionian': 'Ionian (Majör)', 'aeolian': 'Aeolian (Minör)', 'dorian': 'Dorian', 'phrygian': 'Phrygian', 'lydian': 'Lydian', 'mixolydian': 'Mixolydian' }; scaleName = `${rootNameTr} ${names[advMode]}`; }
    
    let tipHtml = "";
    if (isMin) { tipHtml += window.appLang === 'en' ? `🎸 <b>Solo Tip:</b> Pause on the <b>${rootNoteEng}</b> (Root) note to add a sad and deep vibe.` : `🎸 <b>Solo İpucu:</b> Hüzünlü ve derin bir hava katmak için <b>${rootNameTr}</b> (Kök) notasında uzun durun.`; } else { tipHtml += window.appLang === 'en' ? `🎸 <b>Solo Tip:</b> Emphasize the Major 3rd of the scale for a joyful feeling.` : `🎸 <b>Solo İpucu:</b> Neşeli bir hissiyat için gamın Majör 3'lüsünü vurgulayın.`; }

    let altRootIndex = isMin ? (currentRootIndex + 3) % 12 : (currentRootIndex - 3 + 12) % 12; let altScaleType = isMin ? "Maj" : "Min"; const effectiveAltRootIndex = (altRootIndex + capoFret) % 12; let altScaleName = `${window.trNotes[window.notes[effectiveAltRootIndex]]} ${altScaleType === "Maj" ? (window.appLang === 'en' ? "Major" : "Majör") : (window.appLang === 'en' ? "Minor" : "Minör")}`;

    if(advMode === 'auto') { tipHtml += `<br><br>👉 <b>${window.appLang === 'en' ? "Alternative Relative Scale:" : "Alternatif İlgili Gam:"}</b> <a href="#" id="alt-scale-link" style="color:var(--primary); text-decoration:underline; font-weight:bold;">${window.appLang === 'en' ? "Switch to " + altScaleName + " Scale" : altScaleName + " Gamına Geç"}</a>`; }
    tipHtml += `<br><br>🔥 <b>${window.appLang === 'en' ? "Solo Techniques:" : "Solo Teknikleri:"}</b><br><div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:8px;"><span class="btn" style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="playTechnique('hammeron')">🔨 Hammer-On</span><span class="btn" style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="playTechnique('pulloff')">⤵ Pull-Off</span><span class="btn" style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="playTechnique('slide')">↗ Slide</span><span class="btn" style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="playTechnique('bend')">⤴ Bend</span><span class="btn" style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="playTechnique('vibrato')">〰 Vibrato</span></div>`;

    if(document.getElementById('scale-text')) document.getElementById('scale-text').innerHTML = window.appLang === 'en' ? `💡 Recommended Solo Scale: <b>${scaleName}</b>` : `💡 Tavsiye Edilen Solo Gamı: <b>${scaleName}</b>`;
    if(document.getElementById('scale-details-text')) document.getElementById('scale-details-text').innerHTML = tipHtml;
    const altLink = document.getElementById('alt-scale-link');
    if(altLink) { altLink.addEventListener('click', (e) => { e.preventDefault(); currentRootIndex = altRootIndex; currentType = altScaleType; transCount = 0; updateTransUI(); updateUI(true); viewingScaleMode = true; drawScaleFretboard(); }); }
}

window.playTechnique = (tech) => {
    if(window.domCache.instrumentSelect && window.domCache.instrumentSelect.value !== 'electric') { window.domCache.instrumentSelect.value = 'electric'; }
    if(!viewingScaleMode && btnToggleScale) { btnToggleScale.click(); }
    const fretboardPanel = document.getElementById('fretboard-panel'); if(fretboardPanel) { fretboardPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    
    setTimeout(() => {
        const dots = document.querySelectorAll('.dot:not(.scale-root)'); if(dots.length < 2) return;
        let d1 = dots[Math.floor(dots.length / 2)]; let d2 = dots[Math.floor(dots.length / 2) + 1] || dots[dots.length-1]; 
        let s1 = parseInt(d1.getAttribute('data-string') || 0); let fr1 = parseInt(d1.getAttribute('data-fret') || 0);
        let s2 = parseInt(d2.getAttribute('data-string') || 0); let fr2 = parseInt(d2.getAttribute('data-fret') || 0);
        let freq1 = window.baseFrequencies[s1] * Math.pow(2, fr1 / 12); let freq2 = window.baseFrequencies[s1] * Math.pow(2, (fr1 + 2) / 12); if(s1 === s2) freq2 = window.baseFrequencies[s2] * Math.pow(2, fr2 / 12);

        dots.forEach(d => { d.classList.remove('playing', 'anim-bend', 'anim-vibrato', 'anim-pinch'); d.style.transition = ''; });

        if(tech === 'hammeron') { window.playString(freq1, 0, 1.0); d1.classList.add('playing'); setTimeout(() => d1.classList.remove('playing'), 200); setTimeout(() => { window.playString(freq2, 0, 1.0); d2.classList.add('playing'); setTimeout(() => d2.classList.remove('playing'), 400); }, 200); } 
        else if (tech === 'pulloff') { window.playString(freq2, 0, 1.0); d2.classList.add('playing'); setTimeout(() => d2.classList.remove('playing'), 200); setTimeout(() => { window.playString(freq1, 0, 1.0); d1.classList.add('playing'); setTimeout(() => d1.classList.remove('playing'), 400); }, 200); } 
        else if (tech === 'slide') { let src = window.playString(freq1, 0, 1.5); if(src && window.audioCtx) { src.playbackRate.setValueAtTime(1.0, window.audioCtx.currentTime + 0.1); src.playbackRate.exponentialRampToValueAtTime(freq2/freq1, window.audioCtx.currentTime + 0.3); } d1.classList.add('playing'); d1.style.transition = 'left 0.2s ease'; let originalLeft = d1.style.left; setTimeout(() => { d1.style.left = d2.style.left; }, 100); setTimeout(() => { d1.classList.remove('playing'); d1.style.left = originalLeft; }, 500); } 
        else if (tech === 'bend') { let src = window.playString(freq1, 0, 1.5); if(src && window.audioCtx) { src.playbackRate.setValueAtTime(1.0, window.audioCtx.currentTime); src.playbackRate.linearRampToValueAtTime(Math.pow(2, 2/12), window.audioCtx.currentTime + 0.4); src.playbackRate.setValueAtTime(Math.pow(2, 2/12), window.audioCtx.currentTime + 0.6); src.playbackRate.linearRampToValueAtTime(1.0, window.audioCtx.currentTime + 0.8); } d1.classList.add('anim-bend', 'playing'); setTimeout(() => { d1.classList.remove('anim-bend', 'playing'); }, 800); } 
        else if (tech === 'vibrato') { let src = window.playString(freq1, 0, 2.0); if(src && window.audioCtx) { for(let i=0; i<5; i++) { src.playbackRate.linearRampToValueAtTime(1.03, window.audioCtx.currentTime + 0.1 + (i*0.2)); src.playbackRate.linearRampToValueAtTime(0.97, window.audioCtx.currentTime + 0.2 + (i*0.2)); } src.playbackRate.linearRampToValueAtTime(1.0, window.audioCtx.currentTime + 1.2); } d1.classList.add('anim-vibrato', 'playing'); setTimeout(() => { d1.classList.remove('anim-vibrato', 'playing'); }, 1200); } 
        setTimeout(() => { const assistantPanel = document.getElementById('scale-assistant'); if(assistantPanel) { assistantPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 1500); 
    }, 500); 
};

function drawScaleFretboard() {
    if(!fretboardEl || !fretNumbersEl) return;
    fretboardEl.innerHTML = ''; fretNumbersEl.innerHTML = '';
    if(isLefty) { fretboardEl.classList.add('lefty'); fretNumbersEl.classList.add('lefty'); } else { fretboardEl.classList.remove('lefty'); fretNumbersEl.classList.remove('lefty'); }

    const scalePos = scalePositionSelect ? scalePositionSelect.value : 'pos1'; const rootFretE = (currentRootIndex - 4 + 12) % 12;
    let minFretLimit = 0; let maxFretLimit = 15; let fretDrawLimit = 15;

    if (scalePos === 'pos1') { minFretLimit = rootFretE === 0 && currentRootIndex !== 4 ? 12 : rootFretE; minFretLimit += capoFret; maxFretLimit = minFretLimit + 4; fretDrawLimit = 5; fretboardEl.classList.add('barre-mode'); } else { fretboardEl.classList.remove('barre-mode'); }

    let startFret = scalePos === 'pos1' ? minFretLimit : capoFret; let endFret = scalePos === 'pos1' ? maxFretLimit : Math.min(15 + capoFret, 22);
    for (let i = 1; i <= fretDrawLimit; i++) { const fretLine = document.createElement('div'); fretLine.className = 'fret-line'; fretLine.style.left = `${(i / fretDrawLimit) * 100}%`; fretboardEl.appendChild(fretLine); }

    const inlayPositions = scalePos === 'pos1' ? [] : [3, 5, 7, 9, 12, 15, 17, 19, 21];
    inlayPositions.forEach(f => { if (f >= startFret && f <= endFret) { const visFret = f - startFret + 0.5; const inlay = document.createElement('div'); inlay.className = 'fret-inlay'; inlay.style.left = `${(visFret / fretDrawLimit) * 100}%`; inlay.style.top = '50%'; fretboardEl.appendChild(inlay); } });

    for (let i = 0; i < 6; i++) { const stringLine = document.createElement('div'); stringLine.className = 'string-line'; stringLine.style.top = `${(i / 5) * 100}%`; stringLine.setAttribute('data-string', 5-i); fretboardEl.appendChild(stringLine); const tuningLbl = document.createElement('div'); tuningLbl.className = 'string-tuning-label'; tuningLbl.style.top = `${(i / 5) * 100}%`; tuningLbl.innerText = window.stringTuningNames[i]; fretboardEl.appendChild(tuningLbl); }
    for (let i = 1; i <= fretDrawLimit; i++) { const numDiv = document.createElement('div'); numDiv.className = 'fret-number'; numDiv.innerText = scalePos === 'pos1' ? (startFret + i - 1) : i; fretNumbersEl.appendChild(numDiv); }
    if (scalePos === 'all' && capoFret > 0) { const fretWidth = 100 / fretDrawLimit; let rawX = (capoFret * fretWidth) - (fretWidth / 2); let xPos = isLefty ? 100 - rawX : rawX; const capoDiv = document.createElement('div'); capoDiv.className = 'capo-line'; capoDiv.style.left = `${xPos}%`; capoDiv.style.top = '-10px'; capoDiv.style.height = 'calc(100% + 20px)'; fretboardEl.appendChild(capoDiv); }

    const isMin = currentType === "Min" || currentType === "Min7" || currentType === "Sus2" || currentType === "Dim" || currentType === "Min7b5" || currentType === "Min9" || currentType === "mMaj7" || currentType === "mAdd9" || currentType === "m6" || currentType.includes("m");
    const effectiveRootIndex = (currentRootIndex + capoFret) % 12; let advMode = advScaleSelect ? advScaleSelect.value : 'auto';
    let scaleIntervals = isMin ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]; 
    if(advMode === 'maj_pent') scaleIntervals = [0, 2, 4, 7, 9]; else if(advMode === 'min_pent') scaleIntervals = [0, 3, 5, 7, 10]; else if(advMode === 'ionian') scaleIntervals = [0, 2, 4, 5, 7, 9, 11]; else if(advMode === 'aeolian') scaleIntervals = [0, 2, 3, 5, 7, 8, 10]; else if(advMode === 'dorian') scaleIntervals = [0, 2, 3, 5, 7, 9, 10]; else if(advMode === 'phrygian') scaleIntervals = [0, 1, 3, 5, 7, 8, 10]; else if(advMode === 'lydian') scaleIntervals = [0, 2, 4, 6, 7, 9, 11]; else if(advMode === 'mixolydian') scaleIntervals = [0, 2, 4, 5, 7, 9, 10];
    const tuningIndices = [4, 11, 7, 2, 9, 4];

    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
        const openNote = tuningIndices[stringIdx]; const yPos = (stringIdx / 5) * 100;
        for (let physicalFret = startFret; physicalFret <= endFret; physicalFret++) {
            const noteIdx = (openNote + physicalFret) % 12; const intervalFromRoot = (noteIdx - effectiveRootIndex + 12) % 12;
            if (scaleIntervals.includes(intervalFromRoot)) {
                if (scalePos === 'pos1' && stringIdx === 0 && intervalFromRoot !== 0 && physicalFret === startFret) continue;
                const dot = document.createElement('div'); dot.className = 'dot'; dot.setAttribute('data-string', 5 - stringIdx); dot.setAttribute('data-fret', physicalFret);
                if (intervalFromRoot === 0) dot.classList.add('scale-root');
                const fretWidth = 100 / fretDrawLimit; let visualFret = scalePos === 'pos1' ? (physicalFret - startFret + 1) : physicalFret;
                let rawX = (visualFret * fretWidth) - (fretWidth / 2); if(visualFret === 0) rawX = 2; let xPos = isLefty ? 100 - rawX : rawX;
                dot.style.top = `${yPos}%`; dot.style.left = `${xPos}%`; let label = ""; if(intervalFromRoot===0) label="Kök"; else if(intervalFromRoot===1) label="b2"; else if(intervalFromRoot===2) label="2"; else if(intervalFromRoot===3) label="m3"; else if(intervalFromRoot===4) label="3"; else if(intervalFromRoot===5) label="4"; else if(intervalFromRoot===6) label="b5"; else if(intervalFromRoot===7) label="5"; else if(intervalFromRoot===8) label="b6"; else if(intervalFromRoot===9) label="6"; else if(intervalFromRoot===10) label="m7"; else if(intervalFromRoot===11) label="maj7"; dot.innerText = label; dot.style.fontSize = "9px"; fretboardEl.appendChild(dot);
            }
        }
    }

    const typeLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7", "Sus4": "sus4", "Sus2": "sus2", "Dim": "dim", "Aug": "aug", "Min7b5":"m7b5", "Maj9":"maj9", "Min9":"m9", "5":"5", "mMaj7":"m(maj7)", "Add9":"add9", "mAdd9":"m(add9)", "6":"6", "m6":"m6", "7b9":"7b9", "7#9":"7#9" };
    let finalScaleTitle = advMode === 'auto' ? (isMin ? (window.appLang === 'en' ? `${window.notes[effectiveRootIndex]} Minor Pentatonic` : `${window.trNotes[window.notes[effectiveRootIndex]]} Minör Pentatonik`) : (window.appLang === 'en' ? `${window.notes[effectiveRootIndex]} Major Pentatonic` : `${window.trNotes[window.notes[effectiveRootIndex]]} Majör Pentatonik`)) : `${window.trNotes[window.notes[effectiveRootIndex]]} ${advScaleSelect.options[advScaleSelect.selectedIndex].text}`;
    let typeStr = typeLabels[currentType] !== undefined ? typeLabels[currentType] : currentType;
    
    const titleEl = document.getElementById('chord-title');
    const shapeName = `${window.notes[currentRootIndex]}${typeStr}`;
    const soundName = `${window.notes[effectiveRootIndex]}${typeStr}`;

    if(titleEl) {
        if (window.isCapoAction && capoFret > 0) {
            titleEl.innerHTML = `<span class="magic-transform-text glow-effect" style="color:var(--warning);">${shapeName} + ${capoFret} Perde = ${soundName}</span>`;
            const msg = window.appLang === 'en' ? 
                `🎓 Theory Tip: Placing a capo on fret ${capoFret} transposes the ${shapeName} shape up by ${capoFret} half-steps, giving you the ${soundName} sound!` : 
                `🎓 Teori İpucu: Kapoyu ${capoFret}. perdeye takmak, bastığınız ${shapeName} şeklini ${capoFret} yarım ses tizleştirerek size ${soundName} sesini verir!`;
            if (window.showToast) { const tToast = window.showToast(msg, 7000); if(tToast){ tToast.style.border='2px solid #fcc419'; tToast.style.boxShadow='0 0 25px rgba(252,196,25,0.5)'; tToast.style.color='#fcc419'; tToast.style.fontWeight='bold'; tToast.style.fontSize='14px'; } }
        } else {
            titleEl.innerText = capoFret > 0 ? `${soundName} (Kapo ${capoFret})` : soundName;
        }
    }
    if(document.getElementById('chord-known-name')) document.getElementById('chord-known-name').innerText = capoFret > 0 ? `${window.appLang === 'en' ? 'Sound' : 'Ses'}: ${finalScaleTitle} | ${window.appLang === 'en' ? 'Shape' : 'Form'}: ${window.notes[currentRootIndex]}` : `${window.appLang === 'en' ? 'Sound' : 'Ses'}: ${finalScaleTitle}`;
    if(document.getElementById('variation-text')) document.getElementById('variation-text').innerText = scalePos === 'pos1' ? (window.appLang === 'en' ? `Pattern: 1st Position (Recommended)` : `Kalıp: 1. Pozisyon (Önerilen Yol)`) : (window.appLang === 'en' ? `Pattern: Full Fretboard Spread` : `Kalıp: Tüm Klavye Yayılımı`);
    if(document.getElementById('var-group')) document.getElementById('var-group').style.display = 'none';
    if(btnToggleScale) { btnToggleScale.innerText = window.appLang === 'en' ? "🎵 Show Scale on Fretboard" : "🎵 Bu Gamı Klavyede Göster"; btnToggleScale.style.background = "var(--success)"; }
}

function updateUI(fromDropdown = false, resetVar = true) {
    if(fromDropdown) { baseRootIndex = currentRootIndex; baseType = currentType; }
    if(resetVar) { currentVariations = window.generateVariations(currentRootIndex, currentType); currentVarIndex = 0; }
    if(typeSelect && document.querySelector(`#type-select option[value="${currentType}"]`)) typeSelect.value = currentType;
    if(rootSelect) rootSelect.value = currentRootIndex; 
    if (viewingScaleMode) drawScaleFretboard(); else drawFretboard();
    updateScaleAssistant();
    window.isCapoAction = false; 
}

function drawFretboard() {
    if(!fretboardEl || !fretNumbersEl) return;
    fretboardEl.innerHTML = ''; fretNumbersEl.innerHTML = '';
    const shape = currentVariations[currentVarIndex] || currentVariations[0]; if(!shape) return;

    if(isLefty) { fretboardEl.classList.add('lefty'); fretNumbersEl.classList.add('lefty'); } else { fretboardEl.classList.remove('lefty'); fretNumbersEl.classList.remove('lefty'); }
    for (let i = 1; i <= 5; i++) { const fretLine = document.createElement('div'); fretLine.className = 'fret-line'; fretLine.style.left = `${(i / 5) * 100}%`; fretboardEl.appendChild(fretLine); }

    let mappedShapeTemp = shape.map(s => s.fret === 'x' ? null : (s.fret === 0 ? capoFret : s.fret + capoFret));
    let minF = 99; mappedShapeTemp.forEach(f => { if(f !== null && !isNaN(f) && f > 0 && f < minF) minF = f; });
    if(minF === 99) minF = capoFret > 0 ? capoFret : 1; let fOff = minF > 1 ? minF - 1 : 0; if(capoFret > 0 && minF - capoFret <= 2) fOff = capoFret > 0 ? capoFret - 1 : 0;

    [3, 5, 7, 9, 12].forEach(realFret => { let relF = realFret - fOff; if(relF >= 1 && relF <= 5) { const inlay = document.createElement('div'); inlay.className = 'fret-inlay'; inlay.style.left = `${((relF - 0.5) / 5) * 100}%`; inlay.style.top = '50%'; fretboardEl.appendChild(inlay); } });

    for (let i = 0; i < 6; i++) { const stringLine = document.createElement('div'); stringLine.className = 'string-line'; stringLine.style.top = `${(i / 5) * 100}%`; stringLine.setAttribute('data-string', 5-i); fretboardEl.appendChild(stringLine); const tuningLbl = document.createElement('div'); tuningLbl.className = 'string-tuning-label'; tuningLbl.style.top = `${(i / 5) * 100}%`; tuningLbl.innerText = window.stringTuningNames[i]; fretboardEl.appendChild(tuningLbl); }

    let mappedShape = shape.map(s => { if(s.fret === 'x') return { fret: 'x', finger: null, isOpen: false }; if(s.fret === 0) return { fret: capoFret, finger: null, isOpen: true }; return { fret: s.fret + capoFret, finger: s.finger, isOpen: false }; });
    let minFret = 99; mappedShape.forEach(s => { if (s.fret !== 'x' && !s.isOpen && s.fret < minFret) minFret = s.fret; }); if (minFret === 99) minFret = capoFret > 0 ? capoFret : 1;
    let fretOffset = 0; if (minFret > 1) { fretOffset = minFret - 1; if(capoFret > 0 && minFret - capoFret <= 2) fretOffset = capoFret > 0 ? capoFret - 1 : 0; }
    for (let i = 1; i <= 5; i++) { const numDiv = document.createElement('div'); numDiv.className = 'fret-number'; numDiv.innerText = fretOffset + i; fretNumbersEl.appendChild(numDiv); }

    if (capoFret > 0 && capoFret >= fretOffset && capoFret <= fretOffset + 5) { const relCapo = capoFret - fretOffset; const fretWidth = 100 / 5; let rawX = (relCapo * fretWidth) - (fretWidth / 2); let xPos = isLefty ? 100 - rawX : rawX; const capoDiv = document.createElement('div'); capoDiv.className = 'capo-line'; capoDiv.style.left = `${xPos}%`; capoDiv.style.top = '-10px'; capoDiv.style.height = 'calc(100% + 20px)'; fretboardEl.appendChild(capoDiv); }

    let barreFret = null; let barreStrings = [];
    for (let i = 0; i < 6; i++) { const sd = shape[5 - i]; if (sd.fret !== 'x' && sd.fret !== 0 && sd.finger === 1) { barreFret = sd.fret + capoFret; barreStrings.push(i); } }
    if (barreStrings.length > 1) { const minStringIdx = Math.min(...barreStrings); const maxStringIdx = Math.max(...barreStrings); const relativeFret = barreFret - fretOffset; const fretWidth = 100 / 5; let rawX = (relativeFret * fretWidth) - (fretWidth / 2); let xPos = isLefty ? 100 - rawX : rawX; const topY = (minStringIdx / 5) * 100; const bottomY = (maxStringIdx / 5) * 100; const barreDiv = document.createElement('div'); barreDiv.className = 'barre-line'; barreDiv.style.left = `${xPos}%`; barreDiv.style.top = `calc(${topY}% - 14px)`; barreDiv.style.height = `calc(${bottomY - topY}% + 28px)`; fretboardEl.appendChild(barreDiv); }

    const effectiveRootIndex = (currentRootIndex + capoFret) % 12; 
    const anatomyTuning = [4, 11, 7, 2, 9, 4]; // e B G D A E
    
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
        const mData = mappedShape[5 - stringIdx]; const yPos = (stringIdx / 5) * 100;
        
        let intLabel = "";
        let hasNote = false;
        
        if (mData.fret !== 'x') {
            hasNote = true;
            const noteIdx = (anatomyTuning[stringIdx] + mData.fret) % 12;
            const interval = (noteIdx - effectiveRootIndex + 12) % 12;
            
            if (interval === 0) { intLabel = "Kök"; }
            else if (interval === 3 || interval === 4) { intLabel = interval === 3 ? "m3" : "Maj3"; }
            else if (interval === 6 || interval === 7) { intLabel = interval === 6 ? "b5" : "5'li"; }
            else if (interval === 10 || interval === 11) { intLabel = interval === 10 ? "m7" : "Maj7"; }
            else if (interval === 2 || interval === 1) { intLabel = interval === 2 ? "9'lu" : "b9"; }
            else { intLabel = interval.toString(); }
        }

        if (mData.fret === 'x' || mData.isOpen) { 
            const status = document.createElement('div'); status.className = 'string-status'; status.setAttribute('data-string', 5 - stringIdx); status.style.top = `${yPos}%`; status.innerText = mData.fret === 'x' ? 'X' : '0'; 
            if(mData.isOpen && capoFret > 0 && capoFret >= fretOffset && capoFret <= fretOffset + 5) status.innerText = ''; 
            
            if (hasNote && mData.isOpen && status.innerText !== '' && window.isAnatomyOn) {
                const lbl = document.createElement('div'); lbl.className = 'anatomy-label'; lbl.innerText = intLabel; status.appendChild(lbl);
            }
            fretboardEl.appendChild(status); 
        } 
        else { 
            const relativeFret = mData.fret - fretOffset; const fretWidth = 100 / 5; let rawX = (relativeFret * fretWidth) - (fretWidth / 2); let xPos = isLefty ? 100 - rawX : rawX; 
            const dot = document.createElement('div'); dot.className = 'dot'; dot.setAttribute('data-string', 5 - stringIdx); dot.style.top = `${yPos}%`; dot.style.left = `${xPos}%`;
            
            let fingerText = '';
            if (barreStrings.length > 1 && mData.finger === 1 && mData.fret === barreFret) { fingerText = stringIdx === Math.max(...barreStrings) ? '1' : ''; } else { fingerText = mData.finger || ''; }
            
            dot.innerHTML = `<span class="dot-inner-text">${fingerText}</span>`;
            
            if (window.isAnatomyOn) {
                const lbl = document.createElement('div'); lbl.className = 'anatomy-label'; lbl.innerText = intLabel; dot.appendChild(lbl);
            }
            fretboardEl.appendChild(dot); 
        }
    }

    const typeLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7", "Sus4": "sus4", "Sus2": "sus2", "Dim": "dim", "Aug": "aug", "Min7b5":"m7b5", "Maj9":"maj9", "Min9":"m9", "5":"5", "mMaj7":"m(maj7)", "Add9":"add9", "mAdd9":"m(add9)", "6":"6", "m6":"m6", "7b9":"7b9", "7#9":"7#9" };
    let typeStr = typeLabels[currentType] !== undefined ? typeLabels[currentType] : currentType;
    
    const titleEl = document.getElementById('chord-title');
    const shapeName = `${window.notes[currentRootIndex]}${typeStr}`;
    const soundName = `${window.notes[effectiveRootIndex]}${typeStr}`;

    if(titleEl) {
        if (window.isCapoAction && capoFret > 0) {
            titleEl.innerHTML = `<span class="magic-transform-text glow-effect" style="color:var(--warning);">${shapeName} + ${capoFret} Perde = ${soundName}</span>`;
            const msg = window.appLang === 'en' ? 
                `🎓 Theory Tip: Placing a capo on fret ${capoFret} transposes the ${shapeName} shape up by ${capoFret} half-steps, giving you the ${soundName} chord!` : 
                `🎓 Teori İpucu: Kapoyu ${capoFret}. perdeye takmak, bastığınız ${shapeName} şeklini ${capoFret} yarım ses tizleştirerek size ${soundName} akorunu verir!`;
            if (window.showToast) { const tToast = window.showToast(msg, 7000); if(tToast){ tToast.style.border='2px solid #fcc419'; tToast.style.boxShadow='0 0 25px rgba(252,196,25,0.5)'; tToast.style.color='#fcc419'; tToast.style.fontWeight='bold'; tToast.style.fontSize='14px'; } }
        } else {
            titleEl.innerText = capoFret > 0 ? `${soundName} (Kapo ${capoFret})` : soundName;
        }
    }
    
    let tSound = window.appLang === 'en' ? 'Sound' : 'Ses';
    let tShape = window.appLang === 'en' ? 'Shape' : 'Form';
    let tMaj = window.appLang === 'en' ? 'Major' : 'Majör';
    let tMin = window.appLang === 'en' ? 'Minor' : 'Minör';
    let displayTypeStr = typeStr === '' ? tMaj : (typeStr === 'm' ? tMin : typeStr);
    let noteNameTr = window.trNotes[window.notes[effectiveRootIndex]];
    let noteNameEn = window.notes[effectiveRootIndex];
    let noteName = window.appLang === 'en' ? noteNameEn : noteNameTr;

    if(document.getElementById('chord-known-name')) document.getElementById('chord-known-name').innerText = capoFret > 0 ? `${tSound}: ${noteName} ${displayTypeStr} | ${tShape}: ${window.notes[currentRootIndex]}` : `${tSound}: ${noteName} ${displayTypeStr}`;
    if(document.getElementById('variation-text')) document.getElementById('variation-text').innerText = window.appLang === 'en' ? `Variation: ${currentVarIndex + 1} / ${currentVariations.length}` : `Varyasyon: ${currentVarIndex + 1} / ${currentVariations.length}`;
    if(document.getElementById('var-group')) document.getElementById('var-group').style.display = 'flex';
    if(btnToggleScale) { btnToggleScale.innerText = window.appLang === 'en' ? "🎵 Show Scale on Fretboard" : "🎵 Bu Gamı Klavyede Göster"; btnToggleScale.style.background = "var(--primary)"; }
}

if(btnToggleScale) { btnToggleScale.addEventListener('click', () => { viewingScaleMode = !viewingScaleMode; if(viewingScaleMode) { drawScaleFretboard(); const title = window.appLang === 'en' ? "Think Outside the Boxes" : "Kutuların Dışına Çık"; const msg = window.appLang === 'en' ? "If Jimi Hendrix or Albert King were here, they'd say: 'Step outside the boxes in this visual guide, bend the strings, and just play with your feel!'" : "Eğer Jimi Hendrix veya Albert King burada olsaydı: 'Bu görsel kılavuzdaki kutuların dışına çıkın, telleri bükün (bending) ve sadece hissinizle çalın!' derdi."; showLegendMessage(title, msg); } else { drawFretboard(); } const fretboardPanel = document.getElementById('fretboard-panel'); if(fretboardPanel && viewingScaleMode) { setTimeout(() => { fretboardPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); } }); }

const btnCapoUp = document.getElementById('btn-capo-up'); const btnCapoDown = document.getElementById('btn-capo-down');
if(btnCapoUp) { btnCapoUp.addEventListener('click', () => { if(capoFret < 12) { capoFret++; if(window.domCache.capoVal) window.domCache.capoVal.innerText = capoFret; window.isCapoAction = true; updateUI(false, false); } }); }
if(btnCapoDown) { btnCapoDown.addEventListener('click', () => { if(capoFret > 0) { capoFret--; if(window.domCache.capoVal) window.domCache.capoVal.innerText = capoFret; window.isCapoAction = true; updateUI(false, false); } }); }

function playShape(shape, style) {
    if(!shape) return; let hits = [0]; let beatDur = 1.0;
    if(style === 'down') { hits = [0]; beatDur = 0.1; } else if(style === 'vals') { hits = [0.0, 0.5, 1.0]; beatDur = 1.5; } else if(style === 'mediterranean') { hits = [0.0, 0.25, 0.5, 0.65, 0.8]; beatDur = 1.5; } else if(style === 'poprock') { hits = [0.0, 0.3, 0.5, 0.75]; beatDur = 1.5; } else if(style === 'bossanova') { hits = [0.0, 0.5, 0.75, 1.25, 1.5]; beatDur = 1.5; } else if(style === 'country') { hits = [0.0, 0.5, 1.0, 1.5]; beatDur = 1.5; } else if(style === 'arpeggio') { hits = [0.0, 0.2, 0.4, 0.6, 0.8]; beatDur = 2.0; } else if(style === 'funk') { hits = [0.0, 0.15, 0.4, 0.55, 0.8]; beatDur = 1.0; } else if(style === 'reggae') { hits = [0.5, 1.0, 1.5]; beatDur = 1.5; } else if(style === 'shuffle') { hits = [0.0, 0.33, 0.66, 1.0]; beatDur = 1.5; } else if(style === 'flamenco') { hits = [0.0, 0.15, 0.3, 0.5, 0.7, 0.9]; beatDur = 1.5; }

    const strumVis = window.domCache.strumVis;
    hits.forEach((offsetRatio, idx) => {
        let hitDelay = offsetRatio * beatDur; let stringOrder = (style === 'poprock' && idx % 2 === 1) ? [5,4,3,2,1,0] : [0,1,2,3,4,5]; let dur = 2.0;
        if(style === 'arpeggio') stringOrder = [idx % 6]; else if(style === 'funk') { stringOrder = [2,3,4]; dur = 0.4; } else if(style === 'bossanova') { stringOrder = (idx === 0 || idx === 3) ? [5, 4] : [3, 2, 1]; dur = 0.5; } else if(style === 'country') { stringOrder = (idx % 2 === 0) ? [5, 4] : [3, 2, 1, 0]; } else if(style === 'reggae') { stringOrder = [2,3,4]; dur = 0.3; }

        setTimeout(() => {
            if(strumVis) { let isDown = stringOrder[0] === 5 || stringOrder[0] === 4; let arrow = isDown ? '⬇️' : '⬆️'; if (style === 'arpeggio') arrow = '〰️'; else if (style === 'funk') arrow = '💥'; else if (style === 'bossanova' || style === 'country' || style === 'reggae') arrow = '🤌'; strumVis.innerText = arrow; strumVis.style.transform = "scale(1.3)"; setTimeout(() => { strumVis.innerText = ''; strumVis.style.transform = "scale(1)"; }, (dur * 1000 > 300 ? 300 : dur*1000)); }
            stringOrder.forEach(i => { const sData = shape[i]; if (sData && sData.fret !== 'x') { const visuals = fretboardEl.querySelectorAll(`[data-string="${i}"]`); visuals.forEach(el => { if(el.classList.contains('string-line')) { el.classList.add('vibrating'); setTimeout(() => el.classList.remove('vibrating'), (dur * 1000 > 1000 ? 1000 : dur * 1000)); } else { el.classList.add('playing'); setTimeout(() => el.classList.remove('playing'), 150); } }); } });
        }, hitDelay * 1000);

        stringOrder.forEach(i => { const sData = shape[i]; if (sData && sData.fret !== 'x') { let actualFret = sData.fret === 0 ? capoFret : sData.fret + capoFret; const freq = window.baseFrequencies[i] * Math.pow(2, actualFret / 12); window.playString(freq, hitDelay, dur, window.domCache.instrumentSelect ? window.domCache.instrumentSelect.value : 'acoustic', window.chordVol); } });
    });
}
/* BÖLÜM 1 SONU - BURAYA KADAR KOPYALA VE YAPIŞTIR */
const drumPatterns = { rock: { k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] }, funk: { k: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0], s: [0,0,0,0, 1,0,0,1, 0,1,0,0, 1,0,0,0], h: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1] }, lofi: { k: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], h: [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1] }, jazz: { k: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], s: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1], h: [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0] } };
const metroWorkerCode = `let timerID = null; self.onmessage = function(e) { if (e.data === 'start') { if (timerID) clearInterval(timerID); timerID = setInterval(() => postMessage('tick'), 25); } else if (e.data === 'stop') { if (timerID) clearInterval(timerID); timerID = null; } };`;
const metroWorkerBlob = new Blob([metroWorkerCode], { type: 'application/javascript' }); const metroWorker = new Worker(URL.createObjectURL(metroWorkerBlob)); metroWorker.onmessage = function(e) { if (e.data === 'tick') scheduler(); };
const speedTrainerToggle = document.getElementById('speed-trainer-toggle'); if(speedTrainerToggle) speedTrainerToggle.addEventListener('change', e => isSpeedTrainerOn = e.target.checked);
const visToggle = document.getElementById('visual-metro-toggle'); if(visToggle) { if(localStorage.getItem('gitar_vis_metro') === 'true') { visToggle.checked = true; isVisualMetroOn = true; } visToggle.addEventListener('change', e => { isVisualMetroOn = e.target.checked; localStorage.setItem('gitar_vis_metro', isVisualMetroOn); }); }

function scheduleDrumNote(stepNum, time) {
    const style = window.domCache.drumStyle ? window.domCache.drumStyle.value : 'click';
    if (isVisualMetroOn && window.audioCtx) {
        const appCont = document.querySelector('.app-container');
        if (appCont) {
            const delayMs = Math.max(0, (time - window.audioCtx.currentTime) * 1000);
            setTimeout(() => { requestAnimationFrame(() => { if (window.bpm > 140) { if (stepNum === 0) { appCont.classList.remove('flash-measure', 'flash-beat'); void appCont.offsetWidth; appCont.classList.add('flash-measure'); } } else { if (stepNum === 0 || stepNum % 4 === 0) { appCont.classList.remove('flash-measure', 'flash-beat'); void appCont.offsetWidth; if (stepNum === 0) appCont.classList.add('flash-measure'); else appCont.classList.add('flash-beat'); } } }); }, delayMs);
        }
    }
    if(style === 'click') { if(stepNum % 4 === 0) { window.playClick(time, stepNum, window.metroVol); } }
    else { const pat = drumPatterns[style]; if(!pat) return; if(pat.k && pat.k[stepNum]) window.playKick(time, window.metroVol); if(pat.s && pat.s[stepNum]) window.playSnare(time, window.metroVol); if(pat.h && pat.h[stepNum]) window.playHiHat(time, window.metroVol); }
}

function processProgressionStep(time) {
    if (!window.isPlayingProgression || progression.length === 0) return;
    const style = window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down'; const loopToggle = document.getElementById('loop-toggle'); const isLoop = loopToggle ? loopToggle.checked : false; let beatsPerMeasure = (style === 'vals') ? 3 : 4; let stepsPerMeasure = beatsPerMeasure * 4;

    if (progressionBeatCounter % stepsPerMeasure === 0) {
        if (currentProgressionIndex >= progression.length) { if (isLoop) { currentProgressionIndex = 0; } else { const playProgBtn = document.getElementById('btn-play-prog'); if(playProgBtn) playProgBtn.click(); return; } }
        document.querySelectorAll('.prog-card').forEach(c => c.classList.remove('active')); if(document.getElementById(`prog-card-${currentProgressionIndex}`)) document.getElementById(`prog-card-${currentProgressionIndex}`).classList.add('active');
        viewingScaleMode = false; currentRootIndex = progression[currentProgressionIndex].root; currentType = progression[currentProgressionIndex].type;
        if (progression[currentProgressionIndex].shape) { currentVariations = [progression[currentProgressionIndex].shape]; } else { currentVariations = window.generateVariations(currentRootIndex, currentType); }
        currentVarIndex = 0; updateUI(false, false); playShape(currentVariations[0], style); currentProgressionIndex++;
    }
    progressionBeatCounter++;
}

function scheduler() {
    if (window.audioCtx && window.nextNoteTime < window.audioCtx.currentTime - 0.2) { window.nextNoteTime = window.audioCtx.currentTime + 0.05; }
    while (window.audioCtx && window.nextNoteTime < window.audioCtx.currentTime + 0.1) {
        window.initAudio();
        if (window.current16thNote === 0) {
            if (isSpeedTrainerOn && window.isMetroOn) { trainerMeasureCount++; if (trainerMeasureCount >= 4) { trainerMeasureCount = 0; window.bpm = Math.min(240, parseInt(window.bpm) + 5); if(window.domCache.bpmSlider) window.domCache.bpmSlider.value = window.bpm; if(window.domCache.bpmInput) window.domCache.bpmInput.value = window.bpm; saveSession(); } if(window.domCache.trainerStatus) window.domCache.trainerStatus.innerText = `${trainerMeasureCount}/4`; } 
            else if (!isSpeedTrainerOn) { trainerMeasureCount = 0; if(window.domCache.trainerStatus) window.domCache.trainerStatus.innerText = `0/4`; }
        }
        if (window.isMetroOn) scheduleDrumNote(window.current16thNote, window.nextNoteTime);
        if (window.isPlayingProgression) processProgressionStep(window.nextNoteTime);
        window.nextNoteTime += (60.0 / window.bpm) / 4; window.current16thNote++; if (window.current16thNote === 16) window.current16thNote = 0;
    }
}

const btnMetro = document.getElementById('btn-metro'); const activeMetroIndicator = document.getElementById('active-metro-indicator');
if(btnMetro) {
    btnMetro.addEventListener('click', (e) => {
        window.initAudio(); window.isMetroOn = !window.isMetroOn;
        if (window.isMetroOn) { 
            e.target.innerText = window.appLang === 'en' ? "OFF" : "KAPAT"; e.target.classList.add('active'); window.current16thNote = 0; trainerMeasureCount = 0; window.nextNoteTime = window.audioCtx.currentTime + 0.05; metroWorker.postMessage('start'); if(activeMetroIndicator) activeMetroIndicator.style.display = 'flex'; 
        } else { 
            e.target.innerText = window.appLang === 'en' ? "ON" : "AÇ"; e.target.classList.remove('active'); if (!window.isPlayingProgression) metroWorker.postMessage('stop'); const appCont = document.querySelector('.app-container'); if (appCont) appCont.classList.remove('flash-measure', 'flash-beat'); if(activeMetroIndicator) activeMetroIndicator.style.display = 'none'; 
        }
    });
}

if(activeMetroIndicator) { activeMetroIndicator.addEventListener('click', () => { const toolsPanel = document.getElementById('tools-panel-wrapper'); if(toolsPanel) { toolsPanel.classList.remove('collapsed'); toolsPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); toolsPanel.classList.add('tour-highlight'); setTimeout(() => toolsPanel.classList.remove('tour-highlight'), 2000); } }); }

let tapTimes = [];
function handleTapTempo() {
    const now = performance.now(); if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) { tapTimes = []; } tapTimes.push(now); if (tapTimes.length > 4) tapTimes.shift();
    if (tapTimes.length >= 2) { let sum = 0; for(let i = 1; i < tapTimes.length; i++) { sum += (tapTimes[i] - tapTimes[i-1]); } let avgMs = sum / (tapTimes.length - 1); let newBpm = Math.round(60000 / avgMs); if (newBpm >= 40 && newBpm <= 240) { window.bpm = newBpm; if(window.domCache.bpmSlider) window.domCache.bpmSlider.value = window.bpm; if(window.domCache.bpmInput) window.domCache.bpmInput.value = window.bpm; saveSession(); } } triggerBtnEffect('btn-tap-tempo');
}

const btnTapTempo = document.getElementById('btn-tap-tempo'); if(btnTapTempo) btnTapTempo.addEventListener('click', handleTapTempo);
const realBpmSlider = document.getElementById('bpm-slider'); const realBpmInput = document.getElementById('bpm-input');
if(realBpmSlider) { realBpmSlider.addEventListener('input', (e) => { window.bpm = parseInt(e.target.value); if(realBpmInput) realBpmInput.value = window.bpm; saveSession(); }); }
if(realBpmInput) { realBpmInput.addEventListener('change', (e) => { window.bpm = parseInt(e.target.value); if(realBpmSlider) realBpmSlider.value = window.bpm; saveSession(); }); }
if(window.domCache.bpmInput) { window.domCache.bpmInput.addEventListener('change', (e) => { window.bpm = e.target.value; if(window.domCache.bpmSlider) window.domCache.bpmSlider.value = window.bpm; saveSession(); }); }
if(window.domCache.rhythmStyle) { window.domCache.rhythmStyle.addEventListener('change', () => { saveSession(); }); }
const volSlider = document.getElementById('vol-slider'); if(volSlider) volSlider.addEventListener('input', (e) => { window.metroVol = parseFloat(e.target.value); });
const themeToggle = document.getElementById('theme-toggle'); if(themeToggle) { if(localStorage.getItem('gitar_theme') === 'light') { themeToggle.checked = true; document.body.classList.remove('dark-mode'); } themeToggle.addEventListener('change', (e) => { if(e.target.checked) { document.body.classList.remove('dark-mode'); localStorage.setItem('gitar_theme', 'light'); } else { document.body.classList.add('dark-mode'); localStorage.setItem('gitar_theme', 'dark'); } }); }
const leftyToggle = document.getElementById('lefty-toggle'); if(leftyToggle) { if(localStorage.getItem('gitar_lefty') === 'true') { leftyToggle.checked = true; isLefty = true; } leftyToggle.addEventListener('change', e => { isLefty = e.target.checked; localStorage.setItem('gitar_lefty', isLefty); updateUI(); if (typeof renderProgression === 'function') renderProgression(); if(isLefty) { const title = window.appLang === 'en' ? "Welcome to the Lefty Club" : "Solaklar Kulübüne Hoş Geldin"; const msg = window.appLang === 'en' ? "Don't forget that legends like Jimi Hendrix, Paul McCartney, and Kurt Cobain were left-handed. You make the rules!" : "Gitar dünyasında Jimi Hendrix, Paul McCartney ve Kurt Cobain gibi efsanelerin solak olduğunu unutma. Kuralları sen yazacaksın!"; showLegendMessage(title, msg); } }); }
function triggerVanHalenTip() {
    if (!window.vanHalenMessageShown) {
        const title = window.appLang === 'en' ? "Solve the Fretboard Geometry" : "Klavyenin Geometrisini Çöz";
        const msg = window.appLang === 'en' ? "Eddie Van Halen was a genius who solved the visual geometry of the fretboard. Don't waste time with static images; learn by seeing notes on this interactive fretboard!" : "Eddie Van Halen notaları tek tek ezberlemek yerine klavyenin görsel geometrisini çözen bir dahiydi. Statik resimlerle vakit kaybetme; değişen ve ışıklanan bu interaktif klavyede notaları görerek öğren!";
        showLegendMessage(title, msg);
        window.vanHalenMessageShown = true;
    }
}
if(rootSelect) rootSelect.addEventListener('change', e => { currentRootIndex = parseInt(e.target.value); updateUI(true); triggerVanHalenTip(); });
if(typeSelect) typeSelect.addEventListener('change', e => { currentType = e.target.value; updateUI(true); triggerVanHalenTip(); });
const btnUp = document.getElementById('btn-up'); if(btnUp) btnUp.addEventListener('click', () => { transCount++; updateTransUI(); currentRootIndex = (currentRootIndex + 1) % 12; updateUI(false, true); });
const btnDown = document.getElementById('btn-down'); if(btnDown) btnDown.addEventListener('click', () => { transCount--; updateTransUI(); currentRootIndex = (currentRootIndex - 1 + 12) % 12; updateUI(false, true); });
const btnTransReset = document.getElementById('btn-trans-reset'); if(btnTransReset) btnTransReset.addEventListener('click', () => { transCount = 0; capoFret = 0; if(window.domCache.capoVal) window.domCache.capoVal.innerText = capoFret; updateTransUI(); currentRootIndex = baseRootIndex; currentType = baseType; updateUI(false, true); });
const btnVar = document.getElementById('btn-var'); if(btnVar) { btnVar.addEventListener('click', () => { if(viewingScaleMode) return; currentVarIndex = (currentVarIndex + 1) % currentVariations.length; drawFretboard(); }); }
const btnPlay = document.getElementById('btn-play'); if(btnPlay) { btnPlay.addEventListener('click', () => { playShape(currentVariations[currentVarIndex], window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down'); }); }
const chordVolSlider = document.getElementById('chord-vol-slider'); if(chordVolSlider) chordVolSlider.addEventListener('input', (e) => { window.chordVol = parseFloat(e.target.value); });

const sortableList = document.getElementById('sortable-list'); let draggedItem = null; let isDragging = false; let isDraggingAction = false; let dragRAF = null; 
function savePanelOrder() { if(!sortableList) return; const order = Array.from(sortableList.children).map(el => el.id).filter(id => id); localStorage.setItem('gitar_panel_order', JSON.stringify(order)); }

if(sortableList) {
    document.querySelectorAll('.drag-handle').forEach(handle => {
        const panel = handle.closest('.panel-wrapper');
        handle.addEventListener('click', (e) => { if(!isDraggingAction) panel.classList.toggle('collapsed'); });
        handle.addEventListener('mousedown', () => panel.setAttribute('draggable', 'true')); handle.addEventListener('mouseup', () => panel.removeAttribute('draggable'));
        panel.addEventListener('dragstart', (e) => { isDraggingAction = true; draggedItem = panel; setTimeout(() => panel.classList.add('dragging'), 0); e.dataTransfer.effectAllowed = "move"; });
        panel.addEventListener('dragend', () => { setTimeout(() => { isDraggingAction = false; }, 50); draggedItem = null; panel.classList.remove('dragging'); panel.removeAttribute('draggable'); savePanelOrder(); });
        handle.addEventListener('touchstart', (e) => { if (window.innerWidth <= 768) return; isDragging = true; isDraggingAction = false; draggedItem = panel; setTimeout(() => panel.classList.add('dragging'), 0); }, {passive: true});
        handle.addEventListener('touchmove', (e) => { if (window.innerWidth <= 768) return; if(!isDragging || !draggedItem) return; isDraggingAction = true; e.preventDefault(); if(dragRAF) return; dragRAF = requestAnimationFrame(() => { const afterElement = getDragAfterElement(sortableList, e.touches[0].clientY); if (afterElement == null) sortableList.appendChild(draggedItem); else sortableList.insertBefore(draggedItem, afterElement); dragRAF = null; }); }, {passive: false});
        handle.addEventListener('touchend', () => { if (window.innerWidth <= 768) return; isDragging = false; setTimeout(() => { isDraggingAction = false; }, 50); if(draggedItem) draggedItem.classList.remove('dragging'); draggedItem = null; savePanelOrder(); });
    });
    sortableList.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(sortableList, e.clientY); if (draggedItem) { if (afterElement == null) sortableList.appendChild(draggedItem); else sortableList.insertBefore(draggedItem, afterElement); } });
}
function getDragAfterElement(container, y) { const draggableElements = [...container.querySelectorAll('.panel-wrapper:not(.dragging)')]; return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest; }, { offset: Number.NEGATIVE_INFINITY }).element; }

function renderProgression() {
    if(!timelineEl) return;
    if (progression.length === 0) { const emptyText = window.appLang === 'en' ? "No chords added yet. (You can play live with 1, 2, 3... keys)" : "Henüz akor eklenmedi. (1, 2, 3... tuşlarıyla canlı çalabilirsin)"; timelineEl.innerHTML = `<div class="empty-text">${emptyText}</div>`; window.currentProgTitle = window.appLang === 'en' ? "Custom Chord Progression" : "Özel Akor Dizisi"; renderAiSuggestions(); return; }
    if (!window.currentProgTitle) { window.currentProgTitle = window.appLang === 'en' ? "🎸 Custom Chord Combination" : "🎸 Özel Akor Kombinasyonu"; }
    
    timelineEl.innerHTML = ''; const titleHeader = document.createElement('div'); titleHeader.style.cssText = "font-size: 14px; font-weight: bold; color: var(--primary); margin-bottom: 8px; width: 100%; display: flex; align-items: center; gap: 6px;"; titleHeader.innerHTML = `✨ ${window.currentProgTitle}`; timelineEl.appendChild(titleHeader);
    timelineEl.style.display = 'flex'; timelineEl.style.flexWrap = 'wrap'; timelineEl.style.gap = '15px'; timelineEl.style.padding = '10px 5px'; timelineEl.style.whiteSpace = 'nowrap';
    const typeLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7", "Sus4": "sus4", "Sus2": "sus2", "Dim": "dim", "Aug": "aug", "Min7b5":"m7b5", "Maj9":"maj9", "Min9":"m9", "5":"5", "mMaj7":"m(maj7)", "Add9":"add9", "mAdd9":"m(add9)", "6":"6", "m6":"m6", "7b9":"7b9", "7#9":"7#9" };

    progression.forEach((chordObj, idx) => {
        const chordName = window.notes[chordObj.root] + (typeLabels[chordObj.type] !== undefined ? typeLabels[chordObj.type] : chordObj.type);
        const shape = chordObj.shape || window.generateVariations(chordObj.root, chordObj.type)[0]; if (!shape) return;

        const card = document.createElement('div'); card.className = 'mini-chord-card prog-card'; card.id = `prog-card-${idx}`; card.style.cursor = 'pointer';
        card.innerHTML = `<div class="mini-chord-title">[${idx+1}] ${chordName}</div><div class="mini-fretboard" id="mini-board-${idx}"></div><div class="mini-fret-numbers" id="mini-nums-${idx}"></div>`;
        card.onclick = () => { if(window.isPlayingProgression) return; viewingScaleMode = false; currentRootIndex = chordObj.root; currentType = chordObj.type; if(chordObj.shape) { currentVariations = [chordObj.shape]; } else { currentVariations = window.generateVariations(chordObj.root, chordObj.type); } currentVarIndex = 0; updateUI(false, false); playShape(currentVariations[0], window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down'); };

        const delBtn = document.createElement('div'); delBtn.className = 'del-btn'; delBtn.innerText = 'X'; delBtn.style.position = 'absolute'; delBtn.style.top = '5px'; delBtn.style.right = '8px'; delBtn.style.cursor = 'pointer';
        delBtn.onclick = (e) => { e.stopPropagation(); progression.splice(idx, 1); renderProgression(); saveSession(); };
        card.style.position = 'relative'; card.appendChild(delBtn); timelineEl.appendChild(card);

        const boardEl = document.getElementById(`mini-board-${idx}`); const numsEl = document.getElementById(`mini-nums-${idx}`); if (!boardEl || !numsEl) return;
        if (typeof isLefty !== 'undefined' && isLefty) { boardEl.classList.add('lefty'); numsEl.classList.add('lefty'); } else { boardEl.classList.remove('lefty'); numsEl.classList.remove('lefty'); }

        let mappedShape = shape.map(s => { if (s.fret === 'x') return { fret: 'x', finger: null, isOpen: false }; if (s.fret === 0) return { fret: 0, finger: null, isOpen: true }; return { fret: s.fret, finger: s.finger, isOpen: false }; });
        let minFret = 99; mappedShape.forEach(s => { if (s.fret !== 'x' && !s.isOpen && s.fret < minFret) minFret = s.fret; }); if (minFret === 99) minFret = 1; let fretOffset = minFret > 1 ? minFret - 1 : 0;

        for (let i = 1; i <= 4; i++) { const fLine = document.createElement('div'); fLine.className = 'mini-fret-line'; fLine.style.left = `${(i / 4) * 100}%`; boardEl.appendChild(fLine); }
        for (let i = 0; i < 6; i++) { const sLine = document.createElement('div'); sLine.className = 'mini-string-line'; sLine.style.top = `${(i / 5) * 100}%`; boardEl.appendChild(sLine); }
        for (let i = 1; i <= 4; i++) { const numDiv = document.createElement('div'); numDiv.className = 'mini-fret-num'; numDiv.innerText = fretOffset + i; numsEl.appendChild(numDiv); }
        for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
            const mData = mappedShape[5 - stringIdx]; const yPos = (stringIdx / 5) * 100;
            if (mData.fret === 'x' || mData.isOpen) { 
                const status = document.createElement('div'); status.className = (typeof isLefty !== 'undefined' && isLefty) ? 'mini-string-status lefty' : 'mini-string-status'; status.style.top = `${yPos}%`; status.innerText = mData.fret === 'x' ? 'x' : '0'; boardEl.appendChild(status);
            } else { 
                let relFret = mData.fret - fretOffset; 
                if (relFret >= 1 && relFret <= 4) { const fretWidth = 100 / 4; let rawX = (relFret * fretWidth) - (fretWidth / 2); let xPos = (typeof isLefty !== 'undefined' && isLefty) ? 100 - rawX : rawX; const dot = document.createElement('div'); dot.className = 'mini-dot'; dot.style.top = `${yPos}%`; dot.style.left = `${xPos}%`; dot.innerText = mData.finger || '•'; boardEl.appendChild(dot); } 
            }
        }
    });
    renderAiSuggestions();
}

const btnAddProg = document.getElementById('btn-add-prog'); if(btnAddProg) btnAddProg.addEventListener('click', () => { progression.push({ root: currentRootIndex, type: currentType, shape: currentVariations[currentVarIndex] }); window.currentProgTitle = window.appLang === 'en' ? "🎸 Custom Chord Combination" : "🎸 Özel Akor Kombinasyonu"; renderProgression(); saveSession(); if (!window.bowieMessageShown) { const title = window.appLang === 'en' ? "Avant-Garde Transitions" : "Avangart Geçişler"; const msg = window.appLang === 'en' ? "Legends like David Bowie and Radiohead hated ordinary progressions. Discover those surprise transitions that add mystery to your music." : "David Bowie ve Radiohead gibi efsaneler sıradan yürüyüşlerden nefret ederdi. Akor pusulamızla müziğine derinlik ve gizem katacak o ters köşe (sürpriz) geçişleri keşfet."; showLegendMessage(title, msg); window.bowieMessageShown = true; } });
const btnInspire = document.getElementById('btn-inspire'); if(btnInspire) { btnInspire.addEventListener('click', () => { const templates = [[0, 5, 7, 5], [0, 9, 5, 7], [0, 7, 9, 5], [0, 3, 5, 7], [0, 2, 7, 5], [0, 4, 9, 7], [0, 5, 2, 7], [0, 7, 10, 5], [9, 5, 2, 7], [0, 4, 5, 7], [2, 7, 9, 4], [0, 5, 9, 2]]; let temp = templates[Math.floor(Math.random() * templates.length)]; progression = temp.map(offset => { let r = (currentRootIndex + offset) % 12; let t = (offset === 9 || offset === 3 || offset === 2) ? "Min" : "Maj"; return { root: r, type: t, shape: window.generateVariations(r, t)[0] }; }); window.currentProgTitle = window.appLang === 'en' ? "🎲 Inspire Me (Random Combo)" : "🎲 İlham Ver (Rastgele Kombinasyon)"; renderProgression(); saveSession(); }); }
const presetSelect = document.getElementById('preset-select'); if(presetSelect) { presetSelect.addEventListener('change', (e) => { const val = e.target.value; let pList = []; let presetTitle = window.appLang === 'en' ? "Custom Chord Progression" : "Özel Akor Dizisi"; if(val === 'pop') { pList = [{r: 9, t: "Min"}, {r: 5, t: "Maj"}, {r: 0, t: "Maj"}, {r: 7, t: "Maj"}]; presetTitle = window.appLang === 'en' ? "🎵 Pop Hit Pattern" : "🎵 Pop Hit Kalıbı"; } else if(val === 'pop2') { pList = [{r: 0, t: "Maj"}, {r: 7, t: "Maj"}, {r: 9, t: "Min"}, {r: 5, t: "Maj"}]; presetTitle = window.appLang === 'en' ? "🎵 Modern Pop Pattern" : "🎵 Modern Pop Kalıbı"; } else if(val === 'blues') { pList = [{r: 9, t: "Dom7"}, {r: 2, t: "Dom7"}, {r: 4, t: "Dom7"}]; presetTitle = "🎸 12-Bar Blues"; } else if(val === 'jazz') { pList = [{r: 2, t: "Min7"}, {r: 7, t: "Dom7"}, {r: 0, t: "Maj7"}]; presetTitle = window.appLang === 'en' ? "🎷 Jazz Standard (ii-V-I)" : "🎷 Jazz Standardı (ii-V-I)"; } else if(val === 'rnbsoul') { pList = [{r: 5, t: "Maj7"}, {r: 4, t: "Dom7"}, {r: 9, t: "Min7"}, {r: 0, t: "Maj7"}]; presetTitle = window.appLang === 'en' ? "🎹 R&B / Soul Flow" : "🎹 R&B / Soul Akış"; } else if(val === 'rock') { pList = [{r: 4, t: "Maj"}, {r: 2, t: "Maj"}, {r: 9, t: "Maj"}, {r: 4, t: "Maj"}]; presetTitle = window.appLang === 'en' ? "🎸 Classic Rock Riff" : "🎸 Klasik Rock Riff"; } else if(val === 'anatolian') { pList = [{r: 2, t: "Min"}, {r: 0, t: "Maj"}, {r: 10, t: "Maj"}, {r: 9, t: "Min"}]; presetTitle = window.appLang === 'en' ? "🎶 Anatolian Rock Vibe" : "🎶 Anadolu Rock Esintisi"; } else if(val === 'flamenco') { pList = [{r: 9, t: "Min"}, {r: 7, t: "Maj"}, {r: 5, t: "Maj"}, {r: 4, t: "Maj"}]; presetTitle = "🔥 Flamenko / Endülüs"; } else if(val === 'spanish') { pList = [{r: 4, t: "Min"}, {r: 2, t: "Maj"}, {r: 0, t: "Maj"}, {r: 11, t: "Dom7"}]; presetTitle = window.appLang === 'en' ? "💃 Spanish Touch" : "💃 İspanyol Dokunuşu"; } else if(val === 'fifties') { pList = [{r: 0, t: "Maj"}, {r: 9, t: "Min"}, {r: 5, t: "Maj"}, {r: 7, t: "Maj"}]; presetTitle = "📻 50's Rock'n Roll"; } else if(val === 'creep') { pList = [{r: 7, t: "Maj"}, {r: 11, t: "Maj"}, {r: 0, t: "Maj"}, {r: 0, t: "Min"}]; presetTitle = window.appLang === 'en' ? "🎸 Alternative Rock Pattern" : "🎸 Alternatif Rock Kalıbı"; } if(pList.length > 0) { progression = pList.map(item => ({ root: item.r, type: item.t, shape: window.generateVariations(item.r, item.t)[0] })); window.currentProgTitle = presetTitle; renderProgression(); saveSession(); } e.target.value = ""; }); }
const btnProgUp = document.getElementById('btn-prog-up'); if(btnProgUp) { btnProgUp.addEventListener('click', () => { if(progression.length===0) return; progTransCount++; updateTransUI(); progression.forEach(c => { c.root = (c.root+1)%12; c.shape = window.generateVariations(c.root, c.type)[0]; }); renderProgression(); saveSession(); }); }
const btnProgDown = document.getElementById('btn-prog-down'); if(btnProgDown) { btnProgDown.addEventListener('click', () => { if(progression.length===0) return; progTransCount--; updateTransUI(); progression.forEach(c => { c.root = (c.root-1+12)%12; c.shape = window.generateVariations(c.root, c.type)[0]; }); renderProgression(); saveSession(); }); }

window.addEventListener('keydown', (e) => {
    if (document.querySelector('.modal-overlay.show')) { if (e.key === 'Escape') { if(shortcutsModal) shortcutsModal.classList.remove('show'); } return; }
    if ((e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range' && e.target.type !== 'button') || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') { if (document.body.classList.contains('focus-mode')) { const btnFocus = document.getElementById('btn-focus-mode'); if(btnFocus) btnFocus.click(); } return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { const undoBtn = document.getElementById('btn-undo-delete'); if (undoBtn && undoBtn.style.display !== 'none') { e.preventDefault(); triggerBtnEffect('btn-undo-delete'); undoBtn.click(); } return; }
    
    if(e.code === 'Space') { 
        e.preventDefault(); 
        const anyTrackPlaying = tracks.some(t => !t.audio.paused);
        if (anyTrackPlaying) { window.stopSelectedTracks(); } else { window.playSelectedTracks(); }
    }
    else if(e.key === 's' || e.key === 'S') { e.preventDefault(); triggerBtnEffect('btn-play-prog'); if(document.getElementById('btn-play-prog')) document.getElementById('btn-play-prog').click(); }
    else if(e.key === '+' || e.key === '=') { e.preventDefault(); triggerBtnEffect('btn-capo-up'); if(document.getElementById('btn-capo-up')) document.getElementById('btn-capo-up').click(); }
    else if(e.key === '-' || e.key === '_') { e.preventDefault(); triggerBtnEffect('btn-capo-down'); if(document.getElementById('btn-capo-down')) document.getElementById('btn-capo-down').click(); }
    else if(e.key === 'p' || e.key === 'P' || e.key === 'Enter') { e.preventDefault(); triggerBtnEffect('btn-play'); if(document.getElementById('btn-play')) document.getElementById('btn-play').click(); }
    else if(e.key === 'v' || e.key === 'V') { e.preventDefault(); triggerBtnEffect('btn-var'); if(document.getElementById('btn-var')) document.getElementById('btn-var').click(); }
    else if(e.key === 'a' || e.key === 'A') { e.preventDefault(); triggerBtnEffect('btn-add-prog'); if(document.getElementById('btn-add-prog')) document.getElementById('btn-add-prog').click(); }
    else if(e.key === 'r' || e.key === 'R') { e.preventDefault(); triggerBtnEffect('btn-trans-reset'); if(document.getElementById('btn-trans-reset')) document.getElementById('btn-trans-reset').click(); }
    else if(e.key === 'c' || e.key === 'C') { e.preventDefault(); triggerBtnEffect('btn-clear-prog'); if(document.getElementById('btn-clear-prog')) document.getElementById('btn-clear-prog').click(); }
    else if(e.key === 'i' || e.key === 'I') { e.preventDefault(); triggerBtnEffect('btn-inspire'); if(document.getElementById('btn-inspire')) document.getElementById('btn-inspire').click(); }
    else if(e.key === 'm' || e.key === 'M') { e.preventDefault(); triggerBtnEffect('btn-metro'); if(document.getElementById('btn-metro')) document.getElementById('btn-metro').click(); }
    else if(e.key === 'f' || e.key === 'F') { e.preventDefault(); triggerBtnEffect('btn-focus-mode'); if(document.getElementById('btn-focus-mode')) document.getElementById('btn-focus-mode').click(); }
    else if(e.key === 'k' || e.key === 'K') { e.preventDefault(); triggerBtnEffect('btn-rec-track'); if(document.getElementById('btn-rec-track')) document.getElementById('btn-rec-track').click(); }
    else if(e.key === 'd' || e.key === 'D') { e.preventDefault(); triggerBtnEffect('btn-import-track'); if(document.getElementById('btn-import-track')) document.getElementById('btn-import-track').click(); }
    else if(e.key === 't' || e.key === 'T') { e.preventDefault(); if(document.getElementById('btn-tap-tempo')) handleTapTempo(); }
    else if(e.key >= '1' && e.key <= '9') {
        let index = parseInt(e.key) - 1;
        if(progression[index]) {
            let chord = progression[index]; viewingScaleMode = false; currentRootIndex = chord.root; currentType = chord.type;
            if(chord.shape) currentVariations = [chord.shape]; else currentVariations = window.generateVariations(chord.root, chord.type);
            currentVarIndex = 0; updateUI(false, false); playShape(currentVariations[0], window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down');
            document.querySelectorAll('.prog-card').forEach(c => c.classList.remove('active')); const card = document.getElementById(`prog-card-${index}`); if(card) { card.classList.add('active'); setTimeout(() => card.classList.remove('active'), 200); }
        }
    }
});

const btnPlayProg = document.getElementById('btn-play-prog');
if(btnPlayProg) {
    btnPlayProg.addEventListener('click', () => {
        const btn = document.getElementById('btn-play-prog');
        if(window.isPlayingProgression) { window.isPlayingProgression = false; btn.classList.remove('btn-stop'); btn.innerHTML = (window.appLang === 'en' ? '▶ Play Sequence <kbd class="kbd-badge" style="pointer-events:none;">S</kbd>' : '▶ Diziyi Çal <kbd class="kbd-badge" style="pointer-events:none;">S</kbd>'); document.querySelectorAll('.prog-card').forEach(c => c.classList.remove('active')); if (!window.isMetroOn) metroWorker.postMessage('stop'); return; }
        if(progression.length === 0) return;
        window.isPlayingProgression = true; btn.classList.add('btn-stop'); btn.innerText = window.appLang === 'en' ? "⏹ Stop" : "⏹ Durdur"; window.current16thNote = 0; currentProgressionIndex = 0; progressionBeatCounter = 0; window.initAudio(); window.nextNoteTime = window.audioCtx.currentTime + 0.05; metroWorker.postMessage('start');
    });
}

let tunerAnalyser, tunerReqId, globalMicStream; let isMicOn = false; 
const tunerNoteEl = document.getElementById('tuner-note'); const tunerNeedleEl = document.getElementById('tuner-needle'); const tunerInstEl = document.getElementById('tuner-instruction');
let tunerBuffer = null; 

function updatePitch() {
    if(!isMicOn || !tunerAnalyser || !window.audioCtx) return; 
    if(!tunerBuffer || tunerBuffer.length !== tunerAnalyser.fftSize) tunerBuffer = new Float32Array(tunerAnalyser.fftSize);
    tunerAnalyser.getFloatTimeDomainData(tunerBuffer);
    let freq = window.autoCorrelate(tunerBuffer, window.audioCtx.sampleRate);
    if (freq !== -1 && freq > 50 && freq < 2000) {
        let noteNum = 12 * (Math.log(freq / 440) / Math.log(2)) + 69; let roundedNote = Math.round(noteNum);
        let closestFreq = 440 * Math.pow(2, (roundedNote - 69) / 12); let currentDetune = Math.floor(1200 * Math.log2(freq / closestFreq)); 
        if (typeof window.lastDetune === 'undefined') window.lastDetune = currentDetune; window.lastDetune = (window.lastDetune * 0.6) + (currentDetune * 0.4);
        let displayDetune = Math.round(window.lastDetune); let rot = (displayDetune / 50) * 45; rot = Math.max(-45, Math.min(45, rot)); 
        if(tunerNeedleEl) tunerNeedleEl.style.transform = `translateX(-50%) rotate(${rot}deg)`; 
        if(tunerNoteEl) tunerNoteEl.innerText = window.notes[roundedNote % 12];
        if(Math.abs(displayDetune) <= 3) { if(tunerNeedleEl) tunerNeedleEl.classList.add('in-tune'); if(tunerInstEl) { tunerInstEl.innerText = window.appLang === 'en' ? "In Tune! 🎯" : "Tam Kararında! 🎯"; tunerInstEl.style.color = "var(--success)"; } } 
        else { if(tunerNeedleEl) tunerNeedleEl.classList.remove('in-tune'); if(tunerInstEl) { tunerInstEl.style.color = "var(--danger)"; if(displayDetune < 0) tunerInstEl.innerText = window.appLang === 'en' ? "Tighten (▶)" : "Sık (▶)"; else tunerInstEl.innerText = window.appLang === 'en' ? "(◀) Loosen" : "(◀) Gevşet"; } }
    }
    tunerReqId = requestAnimationFrame(updatePitch);
}

const btnMic = document.getElementById('btn-mic');
if(btnMic) {
    btnMic.addEventListener('click', async () => {
        const hasConsent = await window.ensureMicConsent(); if (!hasConsent) return; 
        if (window.isStudioRecording) { showToast(window.appLang === 'en' ? "⚠️ Tuner cannot be opened during recording!" : "⚠️ Kayıt sırasında akort cihazı açılamaz!"); return; }
        try {
            window.initAudio(); 
            if(isMicOn) { isMicOn = false; if(tunerReqId) cancelAnimationFrame(tunerReqId); document.getElementById('btn-mic').innerText = window.appLang === 'en' ? "🎙️ Tune" : "🎙️ Akort Et"; if(tunerNoteEl) tunerNoteEl.innerText = "--"; if(tunerInstEl) { tunerInstEl.innerText = window.appLang === 'en' ? "Paused" : "Mikrofon duraklatıldı"; tunerInstEl.style.color = "var(--text-muted)"; } return; }
            if(!globalMicStream) globalMicStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
            if(!tunerAnalyser) { tunerAnalyser = window.audioCtx.createAnalyser(); tunerAnalyser.fftSize = 4096; let micSource = window.audioCtx.createMediaStreamSource(globalMicStream); micSource.connect(tunerAnalyser); }
            isMicOn = true; document.getElementById('btn-mic').innerText = window.appLang === 'en' ? "🛑 Pause" : "🛑 Duraklat"; if(tunerInstEl) { tunerInstEl.innerText = window.appLang === 'en' ? "Listening..." : "Dinleniyor..."; tunerInstEl.style.color = "var(--text)"; }
            updatePitch();
        } catch (err) { showToast(window.appLang === 'en' ? "⚠️ Microphone access denied." : "⚠️ Mikrofon erişimi reddedildi."); console.error(err); }
    });
}

let tracks = []; let masterRecorder = null; let recChunks = []; let micMixSource = null; let actionHistory = []; let db;
const requestDB = indexedDB.open("StudioDB", 1);
requestDB.onupgradeneeded = (e) => { db = e.target.result; if (!db.objectStoreNames.contains("tracks")) db.createObjectStore("tracks", { keyPath: "id", autoIncrement: true }); };
requestDB.onsuccess = (e) => { db = e.target.result; loadTracksFromDB(); };

let masterReverbNode = null; let recordingDestNode = null; let micInputNode = null; let recordingCompressor = null; let recordingBoost = null; let hasImportedTrack = false; 

let isMonitoringOn = false; let monitorGainNode = null;
window.toggleLiveMonitor = async (isChecked) => {
    isMonitoringOn = isChecked;
    if (isChecked) {
        const hasConsent = await window.ensureMicConsent();
        if (!hasConsent) { document.getElementById('monitor-toggle').checked = false; isMonitoringOn = false; return; }
        window.initAudio(); initStudioEffects();
        if (!globalMicStream) { globalMicStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, latency: 0 } }); }
        if (!micInputNode) { micInputNode = window.audioCtx.createMediaStreamSource(globalMicStream); }
        if (!monitorGainNode) { monitorGainNode = window.audioCtx.createGain(); monitorGainNode.gain.value = 1.0; monitorGainNode.connect(window.audioCtx.destination); }
        try { micInputNode.connect(monitorGainNode); } catch(e){}
        if (window.showToast) showToast(window.appLang === 'en' ? "🎧 Live Monitor ON (Zero Latency). Use HEADPHONES to avoid feedback!" : "🎧 Canlı Monitör AÇIK (Sıfır Gecikme). Uğultu yapmaması için KULAKLIK kullanın!", 4000);
    } else {
        if (micInputNode && monitorGainNode) { try { micInputNode.disconnect(monitorGainNode); } catch(e){} }
        if (window.showToast) showToast(window.appLang === 'en' ? "🎧 Live Monitor OFF." : "🎧 Canlı Monitör KAPALI.");
    }
};

function initStudioEffects() {
    if (!masterReverbNode) {
        window.initAudio(); 
        masterReverbNode = window.audioCtx.createConvolver();
        window.mixDestNode = window.audioCtx.createGain(); 
        recordingDestNode = window.audioCtx.createMediaStreamDestination();
        recordingCompressor = window.audioCtx.createDynamicsCompressor(); 
        recordingCompressor.threshold.value = -3; recordingCompressor.knee.value = 10; recordingCompressor.ratio.value = 12; recordingCompressor.attack.value = 0.003; recordingCompressor.release.value = 0.1;
        recordingBoost = window.audioCtx.createGain(); recordingBoost.gain.value = 4.5; 
        recordingBoost.connect(recordingCompressor); recordingCompressor.connect(recordingDestNode);
        let length = window.audioCtx.sampleRate * 2.5; let impulse = window.audioCtx.createBuffer(2, length, window.audioCtx.sampleRate);
        for (let i = 0; i < 2; i++) { let channel = impulse.getChannelData(i); for (let j = 0; j < length; j++) channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4); }
        masterReverbNode.buffer = impulse; 
        masterReverbNode.connect(window.masterCompressor); masterReverbNode.connect(window.mixDestNode); 
    }
}

async function saveTrackToDB(name, blob, callback) {
    if (navigator.storage && navigator.storage.estimate) { try { const estimate = await navigator.storage.estimate(); const usageMB = estimate.usage / (1024 * 1024); if (usageMB > 150) { showToast(window.appLang === 'en' ? "⚠️ Storage almost full! Recording failed. Please delete unnecessary tracks." : "⚠️ Cihaz hafızası dolmak üzere! Kayıt yapılamadı. Lütfen gereksiz kanalları silin."); if (callback) callback(null); return; } } catch(e) {} }
    const tx = db.transaction("tracks", "readwrite"); const store = tx.objectStore("tracks");
    const req = store.add({ name: name, blob: blob }); req.onsuccess = (e) => { if (callback) callback(e.target.result); };
}

function deleteTrackFromDB(id) { if (!id) return; const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").delete(id); }

window.syncTrackToDB = (idx) => {
    const t = tracks[idx]; if (!t || !db) return; clearTimeout(t.dbSyncTimer);
    t.dbSyncTimer = setTimeout(() => { try { const tx = db.transaction("tracks", "readwrite"); const settings = { vol: t.audio.volume, pan: t.pan || 0, reverb: t.reverb || 0, latency: t.latency || 0, isMuted: t.isMuted || false, solo: t.solo || false, loop: t.audio.loop || false, eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0 }; tx.objectStore("tracks").put({ id: t.id, name: t.name, blob: t.blob, settings: settings }); } catch(e) {} }, 300);
};

function loadTracksFromDB() {
    const tx = db.transaction("tracks", "readonly"); const store = tx.objectStore("tracks"); const req = store.getAll();
    req.onsuccess = (e) => {
        const savedTracks = e.target.result;
        savedTracks.forEach(item => {
            const url = URL.createObjectURL(item.blob); let a = new Audio(url);
            const t = { id: item.id, name: item.name, blob: item.blob, audio: a, selected: false };
            if (item.settings) { a.volume = item.settings.vol !== undefined ? item.settings.vol : 1.0; a.loop = item.settings.loop || false; t.pan = item.settings.pan || 0; t.reverb = item.settings.reverb || 0; t.latency = item.settings.latency || 0; t.isMuted = item.settings.isMuted || false; t.solo = item.settings.solo || false; t.eqLow = item.settings.eqLow || 0; t.eqMid = item.settings.eqMid || 0; t.eqHigh = item.settings.eqHigh || 0; }
            tracks.push(t); setupTrackRouting(tracks.length - 1);
        });
        if(typeof window.applyMuteSoloState === 'function') window.applyMuteSoloState();
        renderStudioTracks();
    };
}

function setupTrackRouting(trackIndex) {
    initStudioEffects(); const track = tracks[trackIndex]; if (track.routed) return; track.routed = true; 
    const source = window.audioCtx.createMediaElementSource(track.audio);
    const eqLow = window.audioCtx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 250;
    const eqMid = window.audioCtx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 1.0;
    const eqHigh = window.audioCtx.createBiquadFilter(); eqHigh.type = "highshelf"; eqHigh.frequency.value = 4000;
    track.eqLow = track.eqLow || 0; eqLow.gain.value = track.eqLow; track.eqMid = track.eqMid || 0; eqMid.gain.value = track.eqMid; track.eqHigh = track.eqHigh || 0; eqHigh.gain.value = track.eqHigh; track.eqNodes = { low: eqLow, mid: eqMid, high: eqHigh };
    const panNode = window.audioCtx.createStereoPanner(); const dryGain = window.audioCtx.createGain(); const wetGain = window.audioCtx.createGain();
    track.pan = track.pan || 0; track.reverb = track.reverb || 0; panNode.pan.value = track.pan; dryGain.gain.value = 1; wetGain.gain.value = track.reverb;
    source.connect(eqLow).connect(eqMid).connect(eqHigh).connect(panNode);
    panNode.connect(dryGain).connect(window.masterCompressor); dryGain.connect(window.mixDestNode); panNode.connect(wetGain).connect(masterReverbNode);
    track.panNode = panNode; track.wetGain = wetGain;
}

function animateDAWPlayheads() {
    tracks.forEach((track, trackIndex) => {
        if (!track || !track.audio || track.audio.paused) return; 
        const slider = document.getElementById(`progress-${trackIndex}`); const timeLabel = document.getElementById(`time-${trackIndex}`);
        if(slider && track.audio.duration) {
            if (slider.getAttribute('data-dragging') !== 'true') { slider.value = (track.audio.currentTime / track.audio.duration) * 100; }
            let mins = Math.floor(track.audio.currentTime / 60); let secs = Math.floor(track.audio.currentTime % 60); let ms = Math.floor((track.audio.currentTime % 1) * 1000);
            timeLabel.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`;
        }
    });
    const meterEl = document.getElementById('rec-meter');
    if (meterEl && typeof window.audioCtx !== 'undefined') {
        let analyserToUse = null;
        if (window.isStudioRecording && window.studioAnalyser) { analyserToUse = window.studioAnalyser; } else if (window.masterAnalyser) { analyserToUse = window.masterAnalyser; }
        if (analyserToUse) {
            let buffer = new Float32Array(analyserToUse.fftSize); analyserToUse.getFloatTimeDomainData(buffer); let sum = 0; for(let i=0; i<buffer.length; i++) sum += buffer[i]*buffer[i]; 
            let rms = Math.sqrt(sum / buffer.length); let meterValue = Math.min(rms * 400, 100); meterEl.style.width = meterValue + "%";
            if (meterValue > 85) meterEl.style.boxShadow = "0 0 15px rgba(250, 82, 82, 0.8)"; else if (meterValue > 0) meterEl.style.boxShadow = "0 0 10px rgba(64, 192, 87, 0.5)"; else meterEl.style.boxShadow = "none";
        }
    }
    requestAnimationFrame(animateDAWPlayheads);
}
requestAnimationFrame(animateDAWPlayheads);

window.dawZoomLevel = window.dawZoomLevel || 1.0;
window.changeDawZoom = (dir) => {
    let scrollRatio = 0; const firstInner = document.querySelector('.track-progress-container');
    if (firstInner && firstInner.parentElement) { const scrollBox = firstInner.parentElement; const centerPixel = scrollBox.scrollLeft + (scrollBox.clientWidth / 2); scrollRatio = centerPixel / scrollBox.scrollWidth; }
    if(dir === 'in' && window.dawZoomLevel < 6.0) window.dawZoomLevel += 0.5; if(dir === 'out' && window.dawZoomLevel > 1.0) window.dawZoomLevel -= 0.5;
    tracks.forEach(t => t.peaks = null); renderStudioTracks(); 
    setTimeout(() => { document.querySelectorAll('.track-progress-container').forEach(inner => { const scrollBox = inner.parentElement; if (scrollBox) { const targetScroll = (scrollRatio * scrollBox.scrollWidth) - (scrollBox.clientWidth / 2); scrollBox.scrollLeft = targetScroll; } }); }, 50);
};

window.drawTrackWaveform = async (idx, canvasId, color) => {
    const canvas = document.getElementById(canvasId); if (!canvas) return;
    if (canvas.offsetWidth === 0) { const observer = new ResizeObserver((entries, obs) => { if (canvas.offsetWidth > 0) { obs.disconnect(); window.drawTrackWaveform(idx, canvasId, color); } }); observer.observe(canvas); return; }
    const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1; canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr; ctx.scale(dpr, dpr); const width = canvas.offsetWidth; const height = canvas.offsetHeight;
    try {
        const track = tracks[idx]; if (!track || !track.blob) return;
        if (!track.audioBufferCache) { const arrayBuffer = await track.blob.arrayBuffer(); const tempCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100); track.audioBufferCache = await tempCtx.decodeAudioData(arrayBuffer); }
        if (!track.peaks) {
            const channelData = track.audioBufferCache.getChannelData(0); const step = Math.ceil(channelData.length / width); const peaks = [];
            for (let i = 0; i < width; i++) { let min = 1.0; let max = -1.0; for (let j = 0; j < step; j++) { const dataIdx = (i * step) + j; if(dataIdx < channelData.length) { const datum = channelData[dataIdx]; if (datum < min) min = datum; if (datum > max) max = datum; } } peaks.push(Math.max(Math.abs(min), Math.abs(max))); }
            track.peaks = peaks; track.audioBufferCache = null;
        }
        ctx.clearRect(0, 0, width, height); ctx.fillStyle = color || '#228be6';
        track.peaks.forEach((peak, i) => { const h = Math.max(1, peak * height); const y = (height - h) / 2; ctx.fillRect(i, y, 1, h); });
    } catch (e) { console.warn("Waveform çizilemedi:", e); }
};

window.deleteSingleTrack = (idx) => {
    if(confirm(window.appLang === 'en' ? "Are you sure you want to delete this track?" : "Bu kanalı silmek istediğinize emin misiniz?")) { let t = tracks[idx]; t.audio.pause(); deleteTrackFromDB(t.id); actionHistory.push({ type: 'DELETE', tracks: [t] }); if(actionHistory.length > 3) actionHistory.shift(); const undoBtn = document.getElementById('btn-undo-delete'); if (undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Delete)" : "↩️ Geri Al (Sil)"; undoBtn.style.display = 'inline-block'; } tracks.splice(idx, 1); renderStudioTracks(); }
};

window.toggleProMode = (isChecked) => { window.isProMode = isChecked; renderStudioTracks(); };

function renderStudioTracks() {
    if (typeof window.isProMode === 'undefined') { window.isProMode = false; }
    if (!document.getElementById('track-pulse-style')) { const style = document.createElement('style'); style.id = 'track-pulse-style'; style.innerHTML = `@keyframes softPulse { 0% { box-shadow: 0 0 0px transparent; } 50% { box-shadow: inset 0 0 20px var(--glow-color); } 100% { box-shadow: 0 0 0px transparent; } } .track-playing-pulse { animation: softPulse 2s infinite ease-in-out; }`; document.head.appendChild(style); }
    const container = document.getElementById('track-list'); const batchMenu = document.getElementById('batch-actions'); 
    if(!container || !batchMenu) return; container.innerHTML = '';
    
    if(tracks.length === 0) { 
        const emptyMsg = window.appLang === 'en' ? "No recorded tracks. Start a new recording." : "Kayıtlı kanal yok. Yeni bir kayıt başlatın.";
        container.innerHTML = `<div class="empty-text" style="text-align:left;">${emptyMsg}</div>`; 
        batchMenu.style.display = 'none'; return; 
    }
    batchMenu.style.display = window.isProMode ? 'flex' : 'none'; let allSelected = true;

    const tSimple = window.appLang === 'en' ? 'Simple View Active' : 'Basit Görünüm Aktif';
    const modePanel = document.createElement('div'); modePanel.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 6px; border: 1px dashed var(--border);";
    let zoomHtml = window.isProMode ? `<div style="display:flex; align-items:center; gap:8px;"><span style="font-size:11px; color:var(--text-muted); font-weight:bold;">🔍 Waveform Zoom:</span><button class="btn" style="padding:4px 8px; font-size:11px;" onclick="changeDawZoom('out')">➖</button><span style="font-size:12px; font-weight:bold; color:var(--primary); min-width:30px; text-align:center;">${window.dawZoomLevel}x</span><button class="btn" style="padding:4px 8px; font-size:11px;" onclick="changeDawZoom('in')">➕</button></div>` : `<div><span style="font-size:11px; color:var(--text-muted); font-weight:bold;">${tSimple}</span></div>`;
    modePanel.innerHTML = `${zoomHtml}<label class="switch-container" style="font-size:12px; font-weight:bold; color:var(--primary); cursor:pointer;"><input type="checkbox" onchange="toggleProMode(this.checked)" ${window.isProMode ? 'checked' : ''}><div class="switch" style="width:32px;height:18px;"></div> 🚀 Pro Mod</label>`; container.appendChild(modePanel);

    tracks.forEach((track, index) => {
        if(!track.selected) allSelected = false;
        const el = document.createElement('div'); el.className = 'track-item';
        track.audio.onplay = () => el.classList.add('track-playing-pulse'); track.audio.onpause = () => el.classList.remove('track-playing-pulse'); 
        track.audio.onended = () => { const btns = el.querySelectorAll('.btn-primary'); if(btns[0]) btns[0].innerText = "▶"; el.classList.remove('track-playing-pulse'); track.audio.currentTime = 0; const slider = document.getElementById(`progress-${index}`); const timeLabel = document.getElementById(`time-${index}`); if(slider) slider.value = 0; if(timeLabel) timeLabel.innerText = "0:00.000"; };

        const colors = ["#4dabf7", "#ff8787", "#69db7c", "#ffd43b", "#da77f2", "#ffa94d"]; const trackColor = colors[index % colors.length];
        const checkHtml = window.isProMode ? `<input type="checkbox" style="display:inline-block;" ${track.selected ? 'checked' : ''} onchange="toggleSelectTrack(${index}, this.checked)">` : ``;
        const btnStyle = "padding:4px 10px; font-size:11px; font-weight:bold; background:var(--surface); border:1px solid var(--border); color:var(--text); transition:0.2s;";
        
        const tVol = window.appLang === 'en' ? 'Volume' : 'Ses Seviyesi';
        const tMute = window.appLang === 'en' ? 'Mute' : 'Sustur';
        const tSolo = window.appLang === 'en' ? 'Solo' : 'Sadece Bunu Çal';
        const tSettings = window.appLang === 'en' ? '⚙️ Settings ▼' : '⚙️ Ayarlar ▼';
        const tDel = window.appLang === 'en' ? 'Delete Track' : 'Kanalı Sil';
        const tTrim = window.appLang === 'en' ? '✂️ Trim' : '✂️ Kırp';
        const tNorm = window.appLang === 'en' ? '🪄 Normalize' : '🪄 Gürleştir';
        const tGate = window.appLang === 'en' ? '🔇 Noise Gate' : '🔇 Dip Ses';
        const tSplit = window.appLang === 'en' ? '🔪 Split' : '🔪 Böl';
        const tClone = window.appLang === 'en' ? '👯 Clone' : '👯 Klonla';
        const tReset = window.appLang === 'en' ? '🔄 Reset' : '🔄 Sıfırla';
        const tLow = window.appLang === 'en' ? 'Low' : 'Bas';
        const tMid = window.appLang === 'en' ? 'Mid' : 'Mid';
        const tHigh = window.appLang === 'en' ? 'High' : 'Tiz';
        const tPan = window.appLang === 'en' ? 'Pan' : 'Pan';
        const tRev = window.appLang === 'en' ? 'Reverb' : 'Yankı';
        const tLat = window.appLang === 'en' ? 'Latency' : 'Gecikme';
        const tLoop = window.appLang === 'en' ? 'Loop' : 'Döngü';
        const tTrimTip = window.appLang === 'en' ? '✂️ Trim Tool: Seek to a position and click Set Position.' : '✂️ Kırpma Aracı: Sesi dilediğin yere sardır, Konumu Al butonlarına bas.';
        const tStart = window.appLang === 'en' ? 'Start:' : 'Başlangıç:';
        const tEnd = window.appLang === 'en' ? 'End:' : 'Bitiş:';
        const tSet = window.appLang === 'en' ? '📍 Set' : '📍 Konumu Al';
        const tKeep = window.appLang === 'en' ? 'Keep Selected Range' : 'Seçilen Aralığı Sakla';
        const tDelete = window.appLang === 'en' ? 'Delete Selected Range' : 'Seçilen Aralığı Sil';
        const tApply = window.appLang === 'en' ? '✂️ Apply' : '✂️ Uygula';
        const tClose = window.appLang === 'en' ? 'Close' : 'Kapat';

        const advancedBtnsHtml = window.isProMode ? `
            <button class="btn" style="${btnStyle} background:${track.isMuted ? 'var(--danger)' : 'var(--surface)'}; color:${track.isMuted ? 'white' : 'var(--text)'};" onclick="toggleTrackMute(${index})" title="${tMute}">M</button>
            <button class="btn" style="${btnStyle} background:${track.solo ? 'var(--success)' : 'var(--surface)'}; color:${track.solo ? 'white' : 'var(--text)'};" onclick="toggleTrackSolo(${index})" title="${tSolo}">S</button>
            <div style="display:flex; align-items:center; gap:4px; margin:0 5px;"><input type="range" class="track-slider" style="width:50px; margin:0;" min="0" max="1" step="0.01" value="${track.audio.volume}" oninput="changeTrackVol(${index}, this.value)" title="${tVol}"><span id="vol-val-${index}" style="font-size:10px; font-weight:bold; color:var(--text-muted); min-width:20px; text-align:right;">${Math.round(track.audio.volume * 100)}</span></div>
            <button class="btn" style="padding:4px 8px; font-size:12px; background:var(--surface); border:1px solid var(--border); color:var(--text); cursor:pointer; border-radius:4px;" onclick="toggleTrackSettings(${index})" title="Ayarlar">${tSettings}</button>
        ` : `
            <button class="btn" style="${btnStyle} background:${track.isMuted ? 'var(--danger)' : 'var(--surface)'}; color:${track.isMuted ? 'white' : 'var(--text)'};" onclick="toggleTrackMute(${index})" title="${tMute}">M</button>
            <button class="btn" style="${btnStyle} background:${track.solo ? 'var(--success)' : 'var(--surface)'}; color:${track.solo ? 'white' : 'var(--text)'};" onclick="toggleTrackSolo(${index})" title="${tSolo}">S</button>
            <div style="display:flex; align-items:center; gap:4px; margin:0 5px;"><input type="range" class="track-slider" style="width:50px; margin:0;" min="0" max="1" step="0.01" value="${track.audio.volume}" oninput="changeTrackVol(${index}, this.value)" title="${tVol}"><span id="vol-val-${index}" style="font-size:10px; font-weight:bold; color:var(--text-muted); min-width:20px; text-align:right;">${Math.round(track.audio.volume * 100)}</span></div>
            <button class="btn" style="${btnStyle} color:var(--danger);" onclick="deleteSingleTrack(${index})" title="${tDel}">🗑️</button>
        `;

        const advSettingsHtml = window.isProMode ? `
            <div class="track-advanced-settings" id="track-settings-${index}" style="display:none; width:100%; margin-top:10px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:8px; flex-direction:column; gap:15px;">
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:10px;">
                    <button class="btn" style="padding:4px 10px; font-size:11px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="showTrimBox(${index})">${tTrim}</button>
                    <button class="btn" style="padding:4px 10px; font-size:11px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="normalizeTrack(${index})">${tNorm}</button>
                    <button class="btn" style="padding:4px 10px; font-size:11px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="noiseGateTrack(${index})">${tGate}</button>
                    <button class="btn" style="padding:4px 10px; font-size:11px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="splitTrack(${index})">${tSplit}</button>
                    <button class="btn" style="padding:4px 10px; font-size:11px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="cloneTrack(${index})">${tClone}</button>
                    <button class="btn" style="padding:4px 10px; font-size:11px; background:rgba(250,82,82,0.1); color:var(--danger); border:1px solid rgba(250,82,82,0.3); margin-left:auto;" onclick="resetTrackSettings(${index})">${tReset}</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:15px; align-items:center;">
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center; font-size:10px; font-weight:bold; color:var(--text-muted); min-width:45px;"><div style="display:flex; gap:3px;">${tLow} <span id="eqLow-val-${index}" style="color:var(--primary);">${track.eqLow || 0}</span></div> <input type="range" class="track-slider" min="-12" max="12" step="1" value="${track.eqLow || 0}" oninput="changeTrackEQ(${index}, 'low', this.value)" style="width:60px;"></div>
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center; font-size:10px; font-weight:bold; color:var(--text-muted); min-width:45px;"><div style="display:flex; gap:3px;">${tMid} <span id="eqMid-val-${index}" style="color:var(--primary);">${track.eqMid || 0}</span></div> <input type="range" class="track-slider" min="-12" max="12" step="1" value="${track.eqMid || 0}" oninput="changeTrackEQ(${index}, 'mid', this.value)" style="width:60px;"></div>
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center; font-size:10px; font-weight:bold; color:var(--text-muted); min-width:45px;"><div style="display:flex; gap:3px;">${tHigh} <span id="eqHigh-val-${index}" style="color:var(--primary);">${track.eqHigh || 0}</span></div> <input type="range" class="track-slider" min="-12" max="12" step="1" value="${track.eqHigh || 0}" oninput="changeTrackEQ(${index}, 'high', this.value)" style="width:60px;"></div>
                    <div style="width: 1px; height: 30px; background: var(--border); opacity: 0.3; margin: 0 5px;"></div>
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center; font-size:10px; font-weight:bold; color:var(--text-muted); min-width:45px;"><div style="display:flex; gap:3px;">${tPan} <span id="pan-val-${index}" style="color:var(--primary);">${track.pan || 0}</span></div> <input type="range" class="track-slider" min="-1" max="1" step="0.1" value="${track.pan || 0}" oninput="changeTrackPan(${index}, this.value)" style="width:60px;"></div>
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center; font-size:10px; font-weight:bold; color:var(--text-muted); min-width:45px;"><div style="display:flex; gap:3px;">${tRev} <span id="rev-val-${index}" style="color:var(--primary);">${Math.round((track.reverb || 0)*100)}</span></div> <input type="range" class="track-slider" min="0" max="1" step="0.05" value="${track.reverb || 0}" oninput="changeTrackReverb(${index}, this.value)" style="width:60px;"></div>
                    <div style="width: 1px; height: 30px; background: var(--border); opacity: 0.3; margin: 0 5px;"></div>
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center; font-size:10px; font-weight:bold; color:var(--text-muted);">${tLat} <input type="number" style="width:50px; font-size:10px; padding:2px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); color:var(--text); border-radius:4px; text-align:center;" value="${track.latency || 0}" oninput="changeTrackLatency(${index}, this.value)"></div>
                    <label class="switch-container" style="font-size:11px; margin-left:auto;"><input type="checkbox" onchange="toggleTrackLoop(${index}, this.checked)" ${track.audio.loop ? 'checked' : ''}><div class="switch" style="width:28px;height:16px;"></div> ${tLoop}</label>
                </div>
            </div>
            <div class="trim-controls" id="trim-box-${index}" style="display:none; width:100%; margin-top:10px; background:rgba(34, 139, 230, 0.08); border:1px dashed var(--primary); padding:12px; border-radius:8px; font-size:11px; align-items:center; flex-wrap:wrap; gap:10px;">
                <span style="font-weight:bold; color:var(--primary); width:100%; font-size:12px;">${tTrimTip}</span>
                <div style="display:flex; align-items:center; gap:4px;">${tStart} <input type="number" id="trim-start-${index}" step="0.001" min="0" value="0" style="width:70px; font-size:12px; padding:4px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:4px;"> <button class="btn" style="padding:4px 8px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="document.getElementById('trim-start-${index}').value = tracks[${index}].audio.currentTime.toFixed(3)">${tSet}</button></div>
                <div style="display:flex; align-items:center; gap:4px; margin-left: 10px;">${tEnd} <input type="number" id="trim-end-${index}" step="0.001" min="0" value="10" style="width:70px; font-size:12px; padding:4px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:4px;"> <button class="btn" style="padding:4px 8px; background:var(--surface); color:var(--text); border:1px solid var(--border);" onclick="document.getElementById('trim-end-${index}').value = tracks[${index}].audio.currentTime.toFixed(3)">${tSet}</button></div>
                <div style="display:flex; justify-content:flex-end; align-items:center; flex:1; gap:10px;">
                    <select id="trim-mode-${index}" style="font-size:12px; padding:4px; border-radius:4px; border: 1px solid var(--border); background: var(--surface); color: var(--text);"> <option value="keep" selected>${tKeep}</option> <option value="delete">${tDelete}</option> </select>
                    <button class="btn btn-add" id="trim-apply-btn-${index}" style="padding:4px 15px; background:var(--success); color:white; border:none; font-weight:bold;" onclick="executeTrim(${index})">${tApply}</button> 
                    <button class="btn" style="padding:4px 10px; background:rgba(250,82,82,0.1); color:var(--danger); border:1px solid rgba(250,82,82,0.3);" onclick="showTrimBox(${index})">${tClose}</button>
                </div>
            </div>
        ` : '';

        const isCollapsed = track.isCollapsed || false;
        const displayStyle = isCollapsed ? 'none' : 'flex';
        const collapseIcon = isCollapsed ? '▶' : '▼';

        const upStyle = index === 0 ? "opacity:0.3; cursor:not-allowed;" : "cursor:pointer;";
        const downStyle = index === tracks.length - 1 ? "opacity:0.3; cursor:not-allowed;" : "cursor:pointer;";
        const tUp = window.appLang === 'en' ? 'Move Up' : 'Yukarı Taşı';
        const tDown = window.appLang === 'en' ? 'Move Down' : 'Aşağı Taşı';

        el.innerHTML = `
            <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div class="track-info" style="display:flex; align-items:center; gap:5px;">
                    <div style="display:flex; flex-direction:column; gap:2px; margin-right:5px;">
                        <button class="btn" onclick="moveTrackUp(${index})" ${index === 0 ? 'disabled' : ''} title="${tUp}" style="padding:0px 5px; font-size:9px; background:var(--surface); border:1px solid var(--border); color:var(--text); line-height:1; min-height:14px; ${upStyle}">▲</button>
                        <button class="btn" onclick="moveTrackDown(${index})" ${index === tracks.length - 1 ? 'disabled' : ''} title="${tDown}" style="padding:0px 5px; font-size:9px; background:var(--surface); border:1px solid var(--border); color:var(--text); line-height:1; min-height:14px; ${downStyle}">▼</button>
                    </div>
                    <button class="btn" onclick="toggleTrackCollapse(${index})" style="padding:2px 8px; font-size:12px; background:rgba(0,0,0,0.1); border:1px solid var(--border); color:var(--text); cursor:pointer; border-radius:4px;" id="collapse-btn-${index}">${collapseIcon}</button>
                    ${checkHtml}
                </div>
                <div class="track-actions">${advancedBtnsHtml}<button class="btn btn-primary" style="padding:4px 12px; font-size:12px; min-width: 45px;" onclick="toggleTrackPlay(${index}, this)">${track.audio.paused ? '▶' : '⏸'}</button></div>
            </div>
            <div id="track-body-${index}" style="display: ${displayStyle}; flex-direction: column; width: 100%;">
                ${advSettingsHtml}
                <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px; width: 100%;">
                    <span class="track-time-label" id="time-${index}" style="min-width:55px; font-variant-numeric: tabular-nums; z-index: 2;">0:00.000</span>
                    <div style="flex: 1; overflow-x: auto; background: rgba(0,0,0,0.15); border: 1px solid var(--border); border-radius: 4px; padding-bottom: 2px;">
                        <div class="track-progress-container" style="position: relative; height: 40px; width: ${window.isProMode ? (window.dawZoomLevel * 100) : 100}%; min-width: 100%; display: flex; align-items: center;">
                            <canvas id="waveform-${index}" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; opacity: 0.8; border-radius: 4px;"></canvas>
                            <input type="range" class="track-progress-bar" id="progress-${index}" min="0" max="100" value="0" step="0.01" oninput="seekTrack(${index}, this.value)" onmousedown="this.setAttribute('data-dragging', 'true')" onmouseup="this.setAttribute('data-dragging', 'false')" onmouseleave="this.setAttribute('data-dragging', 'false')" ontouchstart="this.setAttribute('data-dragging', 'true')" ontouchend="this.setAttribute('data-dragging', 'false')" style="position: relative; z-index: 2; width: 100%; height: 100%; margin: 0; background: transparent; cursor: pointer; opacity: 0.4;">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const nameInput = document.createElement('input'); nameInput.type = "text"; nameInput.className = "text-input"; nameInput.setAttribute("autocomplete", "nope"); nameInput.style.cssText = "width:140px; font-size:12px; padding:4px;"; nameInput.value = track.name; nameInput.onchange = (e) => updateTrackName(index, e.target.value); 
        el.querySelector('.track-info').appendChild(nameInput); 
        el.id = `track-card-${index}`; 
        el.style.borderLeft = `5px solid ${trackColor}`; 
        el.style.backgroundColor = `${trackColor}10`; 
        el.style.setProperty('--glow-color', trackColor); 
        
        if (!track.audio.paused) el.classList.add('track-playing-pulse'); container.appendChild(el);
        setTimeout(() => { if (window.drawTrackWaveform) window.drawTrackWaveform(index, `waveform-${index}`, trackColor); }, 200);
    });
    if (window.isProMode) { const selectAllCheckbox = document.getElementById('select-all-tracks'); if(selectAllCheckbox) selectAllCheckbox.checked = allSelected && tracks.length > 0; }
}

window.moveTrackUp = (idx) => {
    if (idx <= 0) return;
    const temp = tracks[idx];
    tracks[idx] = tracks[idx - 1];
    tracks[idx - 1] = temp;
    renderStudioTracks();
};

window.moveTrackDown = (idx) => {
    if (idx >= tracks.length - 1) return;
    const temp = tracks[idx];
    tracks[idx] = tracks[idx + 1];
    tracks[idx + 1] = temp;
    renderStudioTracks();
};

window.toggleTrackCollapse = (idx) => { const body = document.getElementById(`track-body-${idx}`); const btn = document.getElementById(`collapse-btn-${idx}`); const track = tracks[idx]; if (body.style.display === 'none') { body.style.display = 'flex'; btn.innerText = '▼'; track.isCollapsed = false; const colors = ["#4dabf7", "#ff8787", "#69db7c", "#ffd43b", "#da77f2", "#ffa94d"]; if (window.drawTrackWaveform) window.drawTrackWaveform(idx, `waveform-${idx}`, colors[idx % colors.length]); } else { body.style.display = 'none'; btn.innerText = '▶'; track.isCollapsed = true; } };
window.toggleTrackSettings = (idx) => { const body = document.getElementById(`track-body-${idx}`); const box = document.getElementById(`track-settings-${idx}`); if (body && body.style.display === 'none') { window.toggleTrackCollapse(idx); if (box) box.style.display = 'flex'; } else if (box) { box.style.display = box.style.display === 'none' ? 'flex' : 'none'; } };
window.showTrimBox = (idx) => { const box = document.getElementById(`trim-box-${idx}`); if(box) { box.style.display = box.style.display === 'none' ? 'flex' : 'none'; if(box.style.display === 'flex') { const audio = tracks[idx].audio; document.getElementById(`trim-end-${idx}`).valueAsNumber = audio.duration ? parseFloat(audio.duration.toFixed(3)) : 0; } } };
window.executeTrim = async (idx) => {
    window.initAudio(); const btn = document.getElementById(`trim-apply-btn-${idx}`); if(btn) { btn.innerText = "⏳..."; btn.disabled = true; }
    try {
        const track = tracks[idx]; let rawStart = document.getElementById(`trim-start-${idx}`).value; let rawEnd = document.getElementById(`trim-end-${idx}`).value;
        let startTime = parseFloat(String(rawStart).replace(',', '.')) || 0; let endTime = parseFloat(String(rawEnd).replace(',', '.')) || 0;
        const arrayBuffer = await track.blob.arrayBuffer(); const audioBuffer = await new Promise((resolve, reject) => { window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject); });
        startTime = Math.max(0, Math.min(startTime, audioBuffer.duration)); endTime = Math.max(0, Math.min(endTime, audioBuffer.duration));
        if(startTime >= endTime || (endTime - startTime) < 0.01) { showToast(window.appLang === 'en' ? "⚠️ Invalid trim range!" : "⚠️ Geçersiz kırpma aralığı!"); if(btn) { btn.innerText = window.appLang === 'en' ? "✂️ Apply" : "✂️ Uygula"; btn.disabled = false; } return; }
        const trimMode = document.getElementById(`trim-mode-${idx}`) ? document.getElementById(`trim-mode-${idx}`).value : 'keep'; let offlineCtx;

        if (trimMode === 'keep') {
            const durationSafe = Math.max(0.01, endTime - startTime); const length = Math.floor(durationSafe * audioBuffer.sampleRate);
            offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, Math.max(1, length), audioBuffer.sampleRate);
            const source = offlineCtx.createBufferSource(); source.buffer = audioBuffer; const fadeGain = offlineCtx.createGain(); const fadeTime = Math.min(0.05, durationSafe / 2);
            fadeGain.gain.setValueAtTime(0, 0); fadeGain.gain.linearRampToValueAtTime(1, fadeTime); fadeGain.gain.setValueAtTime(1, durationSafe - fadeTime); fadeGain.gain.linearRampToValueAtTime(0, durationSafe);
            source.connect(fadeGain); fadeGain.connect(offlineCtx.destination); source.start(0, startTime, durationSafe);
        } else {
            const part1Len = startTime; const part2Len = audioBuffer.duration - endTime; const totalLen = Math.max(0.01, part1Len + part2Len); 
            if(totalLen <= 0.01) { showToast(window.appLang === 'en' ? "⚠️ No audio left!" : "⚠️ Geriye ses kalmıyor!"); if(btn) { btn.innerText = window.appLang === 'en' ? "✂️ Apply" : "✂️ Uygula"; btn.disabled = false; } return; }
            const lengthBytes = Math.floor(totalLen * audioBuffer.sampleRate); offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, Math.max(1, lengthBytes), audioBuffer.sampleRate);
            if (part1Len > 0.001) { const src1 = offlineCtx.createBufferSource(); src1.buffer = audioBuffer; const fade1 = offlineCtx.createGain(); fade1.gain.setValueAtTime(1, Math.max(0, part1Len - 0.05)); fade1.gain.linearRampToValueAtTime(0, part1Len); src1.connect(fade1); fade1.connect(offlineCtx.destination); src1.start(0, 0, part1Len); }
            if (part2Len > 0.001) { const src2 = offlineCtx.createBufferSource(); src2.buffer = audioBuffer; const fade2 = offlineCtx.createGain(); fade2.gain.setValueAtTime(0, 0); fade2.gain.linearRampToValueAtTime(1, Math.min(0.05, part2Len)); src2.connect(fade2); fade2.connect(offlineCtx.destination); src2.start(part1Len, endTime, part2Len); }
        }
        const renderedBuffer = await offlineCtx.startRendering(); const wavBlob = window.audioBufferToWav(renderedBuffer);
        actionHistory.push({ type: 'TRIM', trackId: track.id, oldBlob: track.blob }); if(actionHistory.length > 3) actionHistory.shift();
        const undoBtn = document.getElementById('btn-undo-delete'); if(undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Trim)" : "↩️ Geri Al (Kırp)"; undoBtn.style.display = 'inline-block'; }
        track.blob = wavBlob; track.audioBufferCache = null; track.peaks = null; track.audio.pause(); URL.revokeObjectURL(track.audio.src); const url = URL.createObjectURL(wavBlob); track.audio = new Audio(url); track.routed = false;
        const tx = db.transaction("tracks", "readwrite"); const store = tx.objectStore("tracks"); store.put({ id: track.id, name: track.name, blob: wavBlob });
        setupTrackRouting(idx); renderStudioTracks();
    } catch(e) { console.error(e); showToast(window.appLang === 'en' ? "⚠️ Trim error." : "⚠️ Kırpma sırasında hata."); } finally { if(btn) { btn.innerText = window.appLang === 'en' ? "✂️ Apply" : "✂️ Uygula"; btn.disabled = false; } }
};

window.normalizeTrack = async (idx) => {
    window.initAudio(); const track = tracks[idx]; const btn = document.querySelector(`#track-settings-${idx} button[onclick="normalizeTrack(${idx})"]`); if(btn) { btn.innerText = "⏳..."; btn.disabled = true; }
    try {
        const arrayBuffer = await track.blob.arrayBuffer(); const buffer = await new Promise((resolve, reject) => { window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject); });
        let isSilent = true; const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i+=100) { if (Math.abs(data[i]) > 0.001) { isSilent = false; break; } }
        if (isSilent) { showToast(window.appLang === 'en' ? "⚠️ This track is completely silent." : "⚠️ Bu kanal tamamen sessiz, yükseltilecek ses bulunamadı."); if(btn) { btn.innerText = window.appLang === 'en' ? "🪄 Normalize" : "🪄 Gürleştir"; btn.disabled = false; } return; }
        const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate); const source = offlineCtx.createBufferSource(); source.buffer = buffer;
        const makeUpGain = offlineCtx.createGain(); makeUpGain.gain.value = 3.0; 
        const limiter = offlineCtx.createDynamicsCompressor(); limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
        source.connect(makeUpGain); makeUpGain.connect(limiter); limiter.connect(offlineCtx.destination); source.start();
        const renderedBuffer = await offlineCtx.startRendering(); const wavBlob = window.audioBufferToWav(renderedBuffer);
        actionHistory.push({ type: 'NORMALIZE', trackId: track.id, oldBlob: track.blob }); if(actionHistory.length > 3) actionHistory.shift();
        const undoBtn = document.getElementById('btn-undo-delete'); if(undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Normalize)" : "↩️ Geri Al (Gürleştir)"; undoBtn.style.display = 'inline-block'; }
        track.blob = wavBlob; track.peaks = null; track.audio.pause(); URL.revokeObjectURL(track.audio.src); track.audio = new Audio(URL.createObjectURL(wavBlob)); track.routed = false;
        const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").put({ id: track.id, name: track.name, blob: wavBlob });
        setupTrackRouting(idx); renderStudioTracks(); showToast(window.appLang === 'en' ? "🪄 Audio normalized to studio standards!" : "🪄 Ses başarıyla stüdyo standartlarında güçlendirildi!");
    } catch(e) { console.error(e); showToast(window.appLang === 'en' ? "⚠️ Error during normalization." : "⚠️ Sesi yükseltirken hata oluştu."); } finally { if(btn) { btn.innerText = window.appLang === 'en' ? "🪄 Normalize" : "🪄 Sesi Gürleştir"; btn.disabled = false; } }
};

window.noiseGateTrack = async (idx) => {
    window.initAudio(); const track = tracks[idx]; const btn = document.querySelector(`#track-settings-${idx} button[onclick="noiseGateTrack(${idx})"]`); if(btn) { btn.innerText = "⏳..."; btn.disabled = true; }
    try {
        const arrayBuffer = await track.blob.arrayBuffer(); const buffer = await new Promise((resolve, reject) => window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject));
        const newBuffer = window.audioCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate); const threshold = 0.02; 
        for (let c = 0; c < buffer.numberOfChannels; c++) { const input = buffer.getChannelData(c); const output = newBuffer.getChannelData(c); let envelope = 0; for (let i = 0; i < buffer.length; i++) { if (Math.abs(input[i]) > threshold) { envelope = 1.0; } else { envelope *= 0.9995; } output[i] = input[i] * envelope; } }
        const wavBlob = window.audioBufferToWav(newBuffer);
        actionHistory.push({ type: 'NOISEGATE', trackId: track.id, oldBlob: track.blob }); if(actionHistory.length > 3) actionHistory.shift();
        const undoBtn = document.getElementById('btn-undo-delete'); if(undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Gate)" : "↩️ Geri Al (Temizleme)"; undoBtn.style.display = 'inline-block'; }
        track.blob = wavBlob; track.peaks = null; track.audio.pause(); URL.revokeObjectURL(track.audio.src); track.audio = new Audio(URL.createObjectURL(wavBlob)); track.routed = false;
        const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").put({ id: track.id, name: track.name, blob: wavBlob });
        setupTrackRouting(idx); renderStudioTracks(); showToast(window.appLang === 'en' ? "🔇 Background noise successfully cleared!" : "🔇 Arka plan dip gürültüleri başarıyla temizlendi!");
    } catch(e) { console.error(e); showToast(window.appLang === 'en' ? "⚠️ Error during noise gating." : "⚠️ Temizleme sırasında hata oluştu."); } finally { if(btn) { btn.innerText = window.appLang === 'en' ? "🔇 Noise Gate" : "🔇 Dip Sesi Temizle"; btn.disabled = false; } }
};

// --- MP3 ENCODER KÖPRÜSÜ ---
window.audioBufferToMp3 = function(buffer) {
    if (typeof lamejs === 'undefined') return null;
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 192); // 192kbps Radyo Kalitesi
    const mp3Data = [];
    const left = buffer.getChannelData(0);
    const right = channels > 1 ? buffer.getChannelData(1) : left;
    const sampleBlockSize = 1152;
    const floatToInt = (fArray) => {
        const iArray = new Int16Array(fArray.length);
        for (let i = 0; i < fArray.length; i++) { let s = Math.max(-1, Math.min(1, fArray[i])); iArray[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
        return iArray;
    };
    const leftInt = floatToInt(left); const rightInt = floatToInt(right);
    for (let i = 0; i < leftInt.length; i += sampleBlockSize) {
        const leftChunk = leftInt.subarray(i, i + sampleBlockSize);
        const rightChunk = rightInt.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
    return new Blob(mp3Data, { type: 'audio/mpeg' });
};

// --- MASTERING VE SEÇİM EKRANI (MODAL) ---
window.masterProject = async () => {
    if (typeof window.studioDatabase !== 'undefined' && window.studioDatabase) window.studioDatabase.goOffline();
    const activeTracks = tracks.filter(t => t.selected);
    if (activeTracks.length === 0) { showToast(window.appLang === 'en' ? "⚠️ Please select at least one track to export." : "⚠️ Mastering için yanındaki kutucuktan en az bir kanal seçmelisiniz."); return; }

    const title = window.appLang === 'en' ? "💿 Export Project" : "💿 Dışa Aktarma";
    const desc = window.appLang === 'en' ? "In which format would you like to download your recording?" : "Kaydınızı hangi formatta indirmek istersiniz?";
    const btnMp3 = window.appLang === 'en' ? "📱 MP3 (WhatsApp & Social Media)" : "📱 MP3 (WhatsApp & Sosyal Medya)";
    const btnWav = window.appLang === 'en' ? "🎛️ WAV (Lossless Studio Quality)" : "🎛️ WAV (Kayıpsız Stüdyo Kalitesi)";
    const btnCancel = window.appLang === 'en' ? "Cancel" : "İptal";

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
        <div class="modal-content" style="text-align:center; max-width:350px; background:#121212; border: 1px solid var(--primary); padding:20px; border-radius:10px; box-shadow: 0 0 30px rgba(0,0,0,0.8);">
            <h3 style="margin-top:0; color:var(--primary); margin-bottom: 10px;">${title}</h3>
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">${desc}</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-export-mp3" class="btn btn-add" style="padding:12px; font-weight:bold; font-size:13px; cursor:pointer;">${btnMp3}</button>
                <button id="btn-export-wav" class="btn" style="padding:12px; background:var(--surface); border:1px solid var(--border); font-size:13px; color:white; cursor:pointer;">${btnWav}</button>
                <button id="btn-export-cancel" class="btn" style="padding:8px; margin-top:5px; background:transparent; color:var(--danger); border:none; cursor:pointer;">${btnCancel}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('btn-export-cancel').onclick = () => overlay.remove();

    const startMastering = async (selectedFormat) => {
        overlay.remove();
        const btn = document.querySelector('button[onclick="masterProject()"]'); 
        if(btn) { btn.innerText = window.appLang === 'en' ? "⏳ Encoding..." : "⏳ Mastering..."; btn.disabled = true; }
        window.initAudio();
        
        try {
            let maxDuration = 0;
            const trackBuffers = await Promise.all(activeTracks.map(async t => { const arrayBuffer = await t.blob.arrayBuffer(); const audioBuffer = await new Promise((resolve, reject) => { window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject); }); const effDuration = audioBuffer.duration + (t.latency > 0 ? (t.latency / 1000) : 0); if (effDuration > maxDuration) maxDuration = effDuration; const renderVol = t.audio.muted ? 0 : t.audio.volume; return { buffer: audioBuffer, pan: t.pan, reverb: t.reverb, vol: renderVol, isLoop: t.audio.loop || false, latency: t.latency || 0, eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0 }; }));
            if(maxDuration === 0) { if(btn) { btn.innerText = window.appLang === 'en' ? "💿 Radio Mastering" : "💿 Radyo Mastering"; btn.disabled = false; } return; }
            const renderLen = maxDuration + 3.0; const sampleRate = window.audioCtx.sampleRate; const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * renderLen), sampleRate);
            const lowShelf = offlineCtx.createBiquadFilter(); lowShelf.type = 'lowshelf'; lowShelf.frequency.value = 120; lowShelf.gain.value = 4.0;
            const highShelf = offlineCtx.createBiquadFilter(); highShelf.type = 'highshelf'; highShelf.frequency.value = 5000; highShelf.gain.value = 4.5;
            const busComp = offlineCtx.createDynamicsCompressor(); busComp.threshold.value = -18; busComp.knee.value = 8; busComp.ratio.value = 3.5; busComp.attack.value = 0.03; busComp.release.value = 0.25;
            const masterGain = offlineCtx.createGain(); masterGain.gain.value = 2.2;
            const limiter = offlineCtx.createDynamicsCompressor(); limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
            lowShelf.connect(highShelf); highShelf.connect(busComp); busComp.connect(masterGain); masterGain.connect(limiter); limiter.connect(offlineCtx.destination);
            let length = Math.ceil(offlineCtx.sampleRate * 2.5); let impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate); for (let i = 0; i < 2; i++) { let channel = impulse.getChannelData(i); for (let j = 0; j < length; j++) channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4); }
            let offlineReverb = offlineCtx.createConvolver(); offlineReverb.buffer = impulse; offlineReverb.connect(lowShelf); 
            trackBuffers.forEach(tb => {
                let source = offlineCtx.createBufferSource(); source.buffer = tb.buffer; source.loop = tb.isLoop; 
                let eqLow = offlineCtx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 250; eqLow.gain.value = tb.eqLow;
                let eqMid = offlineCtx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = tb.eqMid;
                let eqHigh = offlineCtx.createBiquadFilter(); eqHigh.type = "highshelf"; eqHigh.frequency.value = 4000; eqHigh.gain.value = tb.eqHigh;
                let trackVolumeNode = offlineCtx.createGain(); trackVolumeNode.gain.value = tb.vol; let panner = offlineCtx.createStereoPanner(); panner.pan.value = tb.pan || 0; let dryGain = offlineCtx.createGain(); dryGain.gain.value = 1; let wetGain = offlineCtx.createGain(); wetGain.gain.value = tb.reverb || 0;
                source.connect(eqLow).connect(eqMid).connect(eqHigh).connect(trackVolumeNode); trackVolumeNode.connect(panner); panner.connect(dryGain).connect(lowShelf); panner.connect(wetGain).connect(offlineReverb);
                if (tb.latency < 0) source.start(0, Math.abs(tb.latency) / 1000); else if (tb.latency > 0) source.start(tb.latency / 1000); else source.start(0);
            });
            const renderedBuffer = await offlineCtx.startRendering(); 
            if(btn) btn.innerText = window.appLang === 'en' ? "⏳ Encoding..." : "⏳ Kodlanıyor...";
            
            let finalBlob, ext, mime;
            if (selectedFormat === 'mp3' && typeof lamejs !== 'undefined') {
                finalBlob = window.audioBufferToMp3(renderedBuffer);
                ext = "mp3"; mime = "audio/mpeg";
            } else {
                if(selectedFormat === 'mp3') showToast(window.appLang === 'en' ? "⚠️ MP3 engine failed, downloading as high-quality WAV." : "⚠️ MP3 motoru yüklenemedi, yüksek kaliteli WAV olarak indiriliyor.");
                const numChan = renderedBuffer.numberOfChannels; const rate = renderedBuffer.sampleRate;
                const len = renderedBuffer.length * numChan; const ab = new ArrayBuffer(44 + len * 2); const dv = new DataView(ab);
                const ws = (off, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
                ws(0, 'RIFF'); dv.setUint32(4, 36 + len * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, numChan, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * numChan * 2, true); dv.setUint16(32, numChan * 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, len * 2, true);
                const chans = []; for (let i = 0; i < numChan; i++) chans.push(renderedBuffer.getChannelData(i));
                let off = 44; for (let i = 0; i < renderedBuffer.length; i++) { for (let c = 0; c < numChan; c++) { let s = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2; } }
                finalBlob = new Blob([dv], { type: "audio/wav" });
                ext = "wav"; mime = "audio/wav";
            }
            
            const safeFile = new File([finalBlob], `AkorStudyo_Master_${new Date().getTime()}.${ext}`, { type: mime });
            const a = document.createElement('a'); a.href = URL.createObjectURL(safeFile); a.download = safeFile.name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 1000); 
            showToast(window.appLang === 'en' ? `💿 Export complete! (${ext.toUpperCase()}) You can share it anywhere.` : `💿 Kayıt tamamlandı! (${ext.toUpperCase()}) WhatsApp'a sürükleyebilirsin.`);
        } catch (err) { console.error("Mastering Hatası:", err); showToast(window.appLang === 'en' ? "⚠️ An error occurred during export." : "⚠️ İşlem sırasında hata oluştu."); } 
        finally { if(btn) { btn.innerText = window.appLang === 'en' ? "💿 Radio Mastering" : "💿 Radyo Mastering"; btn.disabled = false; } if (typeof window.studioDatabase !== 'undefined' && window.studioDatabase && navigator.onLine) window.studioDatabase.goOnline(); }
    };

    document.getElementById('btn-export-mp3').onclick = () => startMastering('mp3');
    document.getElementById('btn-export-wav').onclick = () => startMastering('wav');
};

window.splitTrack = async (idx) => {    
    window.initAudio(); const track = tracks[idx]; const splitTime = track.audio.currentTime;
    if (splitTime < 0.2 || splitTime > track.audio.duration - 0.2) { showToast(window.appLang === 'en' ? "⚠️ Move the playhead to the middle to split." : "⚠️ Bölmek için zaman çubuğunu (okuyucuyu) ortaya getirin."); return; }
    const btn = document.querySelector(`#track-settings-${idx} button[onclick="splitTrack(${idx})"]`); if(btn) { btn.innerText = "⏳..."; btn.disabled = true; }
    try {
        const arrayBuffer = await track.blob.arrayBuffer(); const buffer = await new Promise((resolve, reject) => window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject)); const totalDur = buffer.duration;
        const ctx1 = new OfflineAudioContext(buffer.numberOfChannels, splitTime * buffer.sampleRate, buffer.sampleRate); const src1 = ctx1.createBufferSource(); src1.buffer = buffer; src1.connect(ctx1.destination); src1.start(0, 0, splitTime); const buf1 = await ctx1.startRendering(); const blob1 = window.audioBufferToWav(buf1);
        const dur2 = totalDur - splitTime; const ctx2 = new OfflineAudioContext(buffer.numberOfChannels, dur2 * buffer.sampleRate, buffer.sampleRate); const src2 = ctx2.createBufferSource(); src2.buffer = buffer; src2.connect(ctx2.destination); src2.start(0, splitTime, dur2); const buf2 = await ctx2.startRendering(); const blob2 = window.audioBufferToWav(buf2);
        const originalBlob = track.blob; const name1 = track.name + " (A)"; const name2 = track.name + " (B)";
        track.blob = blob1; track.name = name1; track.audioBufferCache = null; track.peaks = null; track.audio.pause(); URL.revokeObjectURL(track.audio.src); track.audio = new Audio(URL.createObjectURL(blob1)); track.routed = false;
        const tx1 = db.transaction("tracks", "readwrite"); tx1.objectStore("tracks").put({ id: track.id, name: name1, blob: blob1 }); setupTrackRouting(idx);
        saveTrackToDB(name2, blob2, (newId) => { const url2 = URL.createObjectURL(blob2); const a2 = new Audio(url2); const newTrack = { id: newId, name: name2, blob: blob2, audio: a2, selected: false }; tracks.splice(idx + 1, 0, newTrack); setupTrackRouting(idx + 1); actionHistory.push({ type: 'SPLIT', originalTrackId: track.id, oldBlob: originalBlob, newTrackId: newId }); if(actionHistory.length > 3) actionHistory.shift(); const undoBtn = document.getElementById('btn-undo-delete'); if(undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Split)" : "↩️ Geri Al (Bölme)"; undoBtn.style.display = 'inline-block'; } renderStudioTracks(); showToast(window.appLang === 'en' ? "✂️ Track successfully split in two!" : "✂️ Kanal başarıyla ikiye bölündü!"); });
    } catch(e) { console.error(e); showToast(window.appLang === 'en' ? "⚠️ Split failed." : "⚠️ Bölme işlemi başarısız."); } finally { if(btn) { btn.innerText = window.appLang === 'en' ? "🔪 Split" : "✂️ Buradan Böl"; btn.disabled = false; } }
};

window.cloneTrack = (idx) => {
    const t = tracks[idx]; if (!t || !t.blob) return; const btn = document.querySelector(`#track-settings-${idx} button[onclick="cloneTrack(${idx})"]`); if(btn) { btn.innerText = "⏳..."; btn.disabled = true; } const newName = t.name + (window.appLang === 'en' ? " (Copy)" : " (Kopya)");
    saveTrackToDB(newName, t.blob, (newId) => {
        const url = URL.createObjectURL(t.blob); let a = new Audio(url); a.volume = t.audio.volume; a.loop = t.audio.loop;
        const newTrack = { id: newId, name: newName, blob: t.blob, audio: a, selected: false, pan: t.pan, reverb: t.reverb, latency: t.latency, isMuted: t.isMuted, solo: t.solo, eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0 };
        const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").put({ id: newId, name: newName, blob: t.blob, settings: { vol: a.volume, pan: t.pan, reverb: t.reverb, latency: t.latency, isMuted: t.isMuted, solo: t.solo, loop: a.loop, eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0 } });        
        tracks.splice(idx + 1, 0, newTrack); setupTrackRouting(idx + 1); actionHistory.push({ type: 'CLONE', newTrackId: newId }); if(actionHistory.length > 3) actionHistory.shift(); const undoBtn = document.getElementById('btn-undo-delete'); if(undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Clone)" : "↩️ Geri Al (Klon)"; undoBtn.style.display = 'inline-block'; } renderStudioTracks(); if(typeof window.applyMuteSoloState === 'function') window.applyMuteSoloState(); if (window.showToast) showToast(window.appLang === 'en' ? "👯 Track cloned! Tip: Pan one left and one right for width." : "👯 Kanal klonlandı! Tavsiye: Genişlik için birini sağa, diğerini sola panlayın.", 4000);
    });
};

window.seekTrack = (idx, percent) => { 
    const targetTrack = tracks[idx];
    if(targetTrack && targetTrack.audio && targetTrack.audio.duration) { 
        const targetTime = (percent / 100) * targetTrack.audio.duration;
        const updateTimeUI = (i, time) => { const timeLabel = document.getElementById(`time-${i}`); if(timeLabel) { let mins = Math.floor(time / 60); let secs = Math.floor(time % 60); let ms = Math.floor((time % 1) * 1000); timeLabel.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms < 100 ? (ms < 10 ? '00' : '0') : ''}${ms}`; } };
        targetTrack.audio.currentTime = targetTime; updateTimeUI(idx, targetTime);
        if (targetTrack.selected) { tracks.forEach((t, i) => { if (i !== idx && t.selected && t.audio && t.audio.duration >= targetTime) { t.audio.currentTime = targetTime; updateTimeUI(i, targetTime); } }); }
    } 
};

window.toggleSelectAllTracks = (isChecked) => { tracks.forEach((t, i) => { t.selected = isChecked; const cb = document.querySelector(`#track-card-${i} input[type="checkbox"]`); if(cb) cb.checked = isChecked; }); }
window.applyMuteSoloState = () => {
    const isAnySolo = tracks.some(tr => tr.solo);
    tracks.forEach((t, i) => {
        t.audio.muted = isAnySolo ? !t.solo : !!t.isMuted; const card = document.getElementById(`track-card-${i}`); if (!card) return;
        const muteBtn = card.querySelector('button[title="Mute"], button[title="Sustur"]'); const soloBtn = card.querySelector('button[title="Solo"], button[title="Sadece Bunu Çal"]');
        if (muteBtn) { muteBtn.style.background = t.isMuted ? 'var(--danger)' : ''; muteBtn.style.color = t.isMuted ? 'white' : 'var(--text)'; } if (soloBtn) { soloBtn.style.background = t.solo ? 'var(--success)' : ''; soloBtn.style.color = t.solo ? 'white' : 'var(--text)'; }
    });
};

window.toggleTrackMute = (idx) => { tracks[idx].isMuted = !tracks[idx].isMuted; window.applyMuteSoloState(); window.syncTrackToDB(idx); };
window.toggleTrackSolo = (idx) => { tracks[idx].solo = !tracks[idx].solo; window.applyMuteSoloState(); window.syncTrackToDB(idx); };
window.changeTrackPan = (idx, val) => { tracks[idx].pan = parseFloat(val); if (tracks[idx].panNode) tracks[idx].panNode.pan.value = tracks[idx].pan; const lbl = document.getElementById(`pan-val-${idx}`); if(lbl) lbl.innerText = tracks[idx].pan; window.syncTrackToDB(idx); };
window.changeTrackReverb = (idx, val) => { tracks[idx].reverb = parseFloat(val); if (tracks[idx].wetGain) tracks[idx].wetGain.gain.value = tracks[idx].reverb; const lbl = document.getElementById(`rev-val-${idx}`); if(lbl) lbl.innerText = Math.round(tracks[idx].reverb * 100); window.syncTrackToDB(idx); };
window.changeTrackEQ = (idx, band, val) => { const v = parseFloat(val); if (band === 'low') { tracks[idx].eqLow = v; if (tracks[idx].eqNodes) tracks[idx].eqNodes.low.gain.value = v; const lbl = document.getElementById(`eqLow-val-${idx}`); if(lbl) lbl.innerText = v; } if (band === 'mid') { tracks[idx].eqMid = v; if (tracks[idx].eqNodes) tracks[idx].eqNodes.mid.gain.value = v; const lbl = document.getElementById(`eqMid-val-${idx}`); if(lbl) lbl.innerText = v; } if (band === 'high') { tracks[idx].eqHigh = v; if (tracks[idx].eqNodes) tracks[idx].eqNodes.high.gain.value = v; const lbl = document.getElementById(`eqHigh-val-${idx}`); if(lbl) lbl.innerText = v; } window.syncTrackToDB(idx); };
window.updateTrackName = (idx, newName) => { tracks[idx].name = newName; window.syncTrackToDB(idx); };
window.toggleSelectTrack = (idx, isChecked) => { tracks[idx].selected = isChecked; const allSelected = tracks.length > 0 && tracks.every(t => t.selected); const selectAllCheckbox = document.getElementById('select-all-tracks'); if(selectAllCheckbox) selectAllCheckbox.checked = allSelected; };
window.toggleTrackPlay = (idx, btn) => { const audio = tracks[idx].audio; const card = document.getElementById(`track-card-${idx}`); if(audio.paused) { window.initAudio(); audio.play(); btn.innerText = "⏸"; if(card) card.classList.add('track-playing-pulse'); } else { audio.pause(); btn.innerText = "▶"; if(card) card.classList.remove('track-playing-pulse'); } };
window.toggleTrackLoop = (idx, isLoop) => { tracks[idx].audio.loop = isLoop; window.syncTrackToDB(idx); };
window.changeTrackVol = (idx, vol) => { tracks[idx].audio.volume = parseFloat(vol); const lbl = document.getElementById(`vol-val-${idx}`); if(lbl) lbl.innerText = Math.round(vol * 100); window.syncTrackToDB(idx); };

window.resetTrackSettings = (idx) => {
    const t = tracks[idx]; if (!t) return;
    t.audio.volume = 1.0; t.pan = 0; if (t.panNode) t.panNode.pan.value = 0; t.reverb = 0; if (t.wetGain) t.wetGain.gain.value = 0; t.eqLow = 0; t.eqMid = 0; t.eqHigh = 0; if (t.eqNodes) { t.eqNodes.low.gain.value = 0; t.eqNodes.mid.gain.value = 0; t.eqNodes.high.gain.value = 0; } t.latency = 0; t.audio.loop = false;
    window.syncTrackToDB(idx); renderStudioTracks(); 
    setTimeout(() => { const box = document.getElementById(`track-settings-${idx}`); if(box) box.style.display = 'flex'; }, 50); if (window.showToast) showToast(window.appLang === 'en' ? "🔄 Take a deep breath... All settings reset to default!" : "🔄 Derin bir nefes al... Tüm ayarlar varsayılana sıfırlandı!", 3000);
};

window.playSelectedTracks = () => { 
    window.initAudio(); const targets = tracks.filter(t => t.selected); if (targets.length === 0) return;
    targets.forEach(t => { 
        const lat = t.latency || 0; 
        const isAtStart = t.audio.currentTime <= (lat < 0 ? Math.abs(lat)/1000 : 0) + 0.05;
        if (isAtStart) { t.audio.currentTime = lat < 0 ? Math.abs(lat) / 1000 : 0; }
    });
    setTimeout(() => {
        targets.forEach(t => { 
            const lat = t.latency || 0; 
            const isAtStart = t.audio.currentTime <= (lat < 0 ? Math.abs(lat)/1000 : 0) + 0.05;
            if (isAtStart && lat > 0) { 
                setTimeout(() => { if(!t.audio.paused) return; t.audio.play().catch(()=>{}); }, lat); 
            } else { 
                t.audio.play().catch(()=>{}); 
            } 
        });
        requestAnimationFrame(() => { targets.forEach(t => { const idx = tracks.indexOf(t); const btn = document.querySelectorAll('.track-item .btn-primary')[idx]; if(btn) btn.innerText = "⏸"; }); });
    }, 50);
};

window.changeTrackLatency = (idx, val) => { tracks[idx].latency = parseInt(val) || 0; window.syncTrackToDB(idx); };
window.stopSelectedTracks = () => { 
    const targets = tracks.some(t => t.selected) ? tracks.filter(t => t.selected) : tracks; 
    const allPaused = targets.every(t => t.audio.paused);
    targets.forEach(t => { 
        t.audio.pause(); 
        if (allPaused) {
            const lat = t.latency || 0;
            t.audio.currentTime = lat < 0 ? Math.abs(lat) / 1000 : 0;
        }
    }); 
    requestAnimationFrame(() => { 
        targets.forEach(t => { 
            const idx = tracks.indexOf(t); 
            const btn = document.querySelectorAll('.track-item .btn-primary')[idx]; 
            if(btn) btn.innerText = "▶"; 
            if (allPaused) {
                const slider = document.getElementById(`progress-${idx}`); 
                const timeLabel = document.getElementById(`time-${idx}`); 
                if(slider) slider.value = 0; 
                if(timeLabel) timeLabel.innerText = "0:00.000"; 
            }
        }); 
    });
};

window.deleteSelectedTracks = () => { 
    const anySelected = tracks.some(t => t.selected); if (!anySelected) { if (!confirm(window.appLang === 'en' ? "No tracks selected. Are you sure you want to delete ALL tracks?" : "Hiçbir kanal seçilmedi. TÜM kanalları silmek istediğinize emin misiniz?")) return; } let recentlyDeleted = [];
    tracks = tracks.filter(t => { if(anySelected ? t.selected : true) { t.audio.pause(); recentlyDeleted.push(t); deleteTrackFromDB(t.id); return false; } return true; }); 
    if(recentlyDeleted.length > 0) { actionHistory.push({ type: 'DELETE', tracks: recentlyDeleted }); if(actionHistory.length > 3) actionHistory.shift(); const undoBtn = document.getElementById('btn-undo-delete'); if (undoBtn) { undoBtn.innerText = window.appLang === 'en' ? "↩️ Undo (Delete)" : "↩️ Geri Al (Sil)"; undoBtn.style.display = 'inline-block'; } }
    renderStudioTracks(); 
};

window.undoDelete = async () => {
    if(actionHistory.length > 0) {
        let lastAction = actionHistory.pop();
        if (lastAction.type === 'DELETE') { for (let t of lastAction.tracks) { t.selected = false; await new Promise(resolve => { const tx = db.transaction("tracks", "readwrite"); const store = tx.objectStore("tracks"); const req = store.put({ id: t.id, name: t.name, blob: t.blob }); req.onsuccess = () => { tracks.push(t); resolve(); }; }); } } 
        else if (lastAction.type === 'TRIM' || lastAction.type === 'NORMALIZE' || lastAction.type === 'NOISEGATE') { let trackIndex = tracks.findIndex(t => t.id === lastAction.trackId); if (trackIndex !== -1) { let track = tracks[trackIndex]; track.blob = lastAction.oldBlob; track.audioBufferCache = null; track.peaks = null; track.audio.pause(); URL.revokeObjectURL(track.audio.src); track.audio = new Audio(URL.createObjectURL(lastAction.oldBlob)); track.routed = false; const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").put({ id: track.id, name: track.name, blob: lastAction.oldBlob }); setupTrackRouting(trackIndex); } }
        else if (lastAction.type === 'SPLIT') { const newTrackIdx = tracks.findIndex(t => t.id === lastAction.newTrackId); if (newTrackIdx !== -1) { tracks[newTrackIdx].audio.pause(); URL.revokeObjectURL(tracks[newTrackIdx].audio.src); tracks.splice(newTrackIdx, 1); deleteTrackFromDB(lastAction.newTrackId); } let origTrackIdx = tracks.findIndex(t => t.id === lastAction.originalTrackId); if (origTrackIdx !== -1) { let track = tracks[origTrackIdx]; track.blob = lastAction.oldBlob; track.name = track.name.replace(" (A)", ""); track.audioBufferCache = null; track.peaks = null; track.audio.pause(); URL.revokeObjectURL(track.audio.src); track.audio = new Audio(URL.createObjectURL(lastAction.oldBlob)); track.routed = false; const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").put({ id: track.id, name: track.name, blob: lastAction.oldBlob }); setupTrackRouting(origTrackIdx); } }
        else if (lastAction.type === 'CLONE') { const newTrackIdx = tracks.findIndex(t => t.id === lastAction.newTrackId); if (newTrackIdx !== -1) { tracks[newTrackIdx].audio.pause(); URL.revokeObjectURL(tracks[newTrackIdx].audio.src); tracks.splice(newTrackIdx, 1); deleteTrackFromDB(lastAction.newTrackId); } }
        renderStudioTracks();
        const undoBtn = document.getElementById('btn-undo-delete'); 
        if (actionHistory.length === 0) { 
            if (undoBtn) undoBtn.style.display = 'none'; 
        } else { 
            let nextAction = actionHistory[actionHistory.length - 1]; 
            let btnLabel = window.appLang === 'en' ? "↩️ Undo" : "↩️ Geri Al"; 
            if (nextAction.type === 'DELETE') btnLabel = window.appLang === 'en' ? "↩️ Undo (Delete)" : "↩️ Geri Al (Sil)"; 
            else if (nextAction.type === 'TRIM') btnLabel = window.appLang === 'en' ? "↩️ Undo (Trim)" : "↩️ Geri Al (Kırp)"; 
            else if (nextAction.type === 'NORMALIZE') btnLabel = window.appLang === 'en' ? "↩️ Undo (Normalize)" : "↩️ Geri Al (Gürleştir)"; 
            else if (nextAction.type === 'SPLIT') btnLabel = window.appLang === 'en' ? "↩️ Undo (Split)" : "↩️ Geri Al (Bölme)"; 
            else if (nextAction.type === 'CLONE') btnLabel = window.appLang === 'en' ? "↩️ Undo (Clone)" : "↩️ Geri Al (Klon)"; 
            else if (nextAction.type === 'NOISEGATE') btnLabel = window.appLang === 'en' ? "↩️ Undo (Gate)" : "↩️ Geri Al (Temizleme)"; 
            if (undoBtn) undoBtn.innerText = btnLabel; 
        }
        if (window.showToast) { 
            if (lastAction.type === 'DELETE') showToast(window.appLang === 'en' ? "↩️ Deleted tracks restored." : "↩️ Silinen kanallar geri getirildi."); 
            else if (lastAction.type === 'TRIM') showToast(window.appLang === 'en' ? "↩️ Trim undone." : "↩️ Kırpma işlemi iptal edildi."); 
            else if (lastAction.type === 'NORMALIZE') showToast(window.appLang === 'en' ? "↩️ Normalize undone, reverted to original." : "↩️ Ses gürleştirme iptal edildi, orijinal sese dönüldü."); 
            else if (lastAction.type === 'SPLIT') showToast(window.appLang === 'en' ? "↩️ Split undone, track merged back." : "↩️ Bölme iptal edildi, kanal eski haline birleşti."); 
            else if (lastAction.type === 'CLONE') showToast(window.appLang === 'en' ? "↩️ Clone undone, copied track deleted." : "↩️ Klonlama iptal edildi, kopya kanal silindi."); 
            else if (lastAction.type === 'NOISEGATE') showToast(window.appLang === 'en' ? "↩️ Noise gate undone, reverted to original." : "↩️ Gürültü temizleme iptal edildi, orijinal sese dönüldü."); 
        }
    }
};

window.mixdownProject = async () => {
    if (typeof window.studioDatabase !== 'undefined' && window.studioDatabase) window.studioDatabase.goOffline();
    window.initAudio(); const activeTracks = tracks.some(t => t.selected) ? tracks.filter(t => t.selected) : tracks;
    if (activeTracks.length === 0) { showToast(window.appLang === 'en' ? "⚠️ Please select at least one track to export." : "⚠️ Mixdown işlemi için en az bir kanal seçmelisiniz."); return; }
    const btn = document.querySelector('button[onclick="mixdownProject()"]'); if(btn) { btn.innerText = window.appLang === 'en' ? "⏳ Processing..." : "⏳ İşleniyor..."; btn.disabled = true; }
    try {
        let maxDuration = 0; const trackBuffers = await Promise.all(activeTracks.map(async t => { const arrayBuffer = await t.blob.arrayBuffer(); const audioBuffer = await new Promise((resolve, reject) => { window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject); }); const effDuration = audioBuffer.duration + (t.latency > 0 ? (t.latency / 1000) : 0); if (effDuration > maxDuration) maxDuration = effDuration; const renderVol = t.audio.muted ? 0 : t.audio.volume; return { buffer: audioBuffer, pan: t.pan, reverb: t.reverb, vol: renderVol, isLoop: t.audio.loop || false, latency: t.latency || 0, eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0 }; }));
        if(maxDuration === 0) { if(btn) { btn.innerText = "🎛️ Mixdown (MP3)"; btn.disabled = false; } return; }
        const renderLen = maxDuration + 3.0; const currentSampleRate = window.audioCtx.sampleRate; const offlineCtx = new OfflineAudioContext(2, currentSampleRate * renderLen, currentSampleRate);
        const offlineMasterCompressor = offlineCtx.createDynamicsCompressor(); offlineMasterCompressor.threshold.value = -3; offlineMasterCompressor.knee.value = 10; offlineMasterCompressor.ratio.value = 12; offlineMasterCompressor.attack.value = 0.003; offlineMasterCompressor.release.value = 0.05; offlineMasterCompressor.connect(offlineCtx.destination);
        let length = offlineCtx.sampleRate * 2.5; let impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate); for (let i = 0; i < 2; i++) { let channel = impulse.getChannelData(i); for (let j = 0; j < length; j++) channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4); }
        let offlineReverb = offlineCtx.createConvolver(); offlineReverb.buffer = impulse; offlineReverb.connect(offlineMasterCompressor);
        trackBuffers.forEach(tb => {
            let source = offlineCtx.createBufferSource(); source.buffer = tb.buffer; source.loop = tb.isLoop; 
            let eqLow = offlineCtx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 250; eqLow.gain.value = tb.eqLow;
            let eqMid = offlineCtx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = tb.eqMid;
            let eqHigh = offlineCtx.createBiquadFilter(); eqHigh.type = "highshelf"; eqHigh.frequency.value = 4000; eqHigh.gain.value = tb.eqHigh;
            let trackVolumeNode = offlineCtx.createGain(); trackVolumeNode.gain.value = tb.vol; let panner = offlineCtx.createStereoPanner(); panner.pan.value = tb.pan || 0; let dryGain = offlineCtx.createGain(); dryGain.gain.value = 1; let wetGain = offlineCtx.createGain(); wetGain.gain.value = tb.reverb || 0;
            source.connect(eqLow).connect(eqMid).connect(eqHigh).connect(trackVolumeNode); trackVolumeNode.connect(panner); panner.connect(dryGain).connect(offlineMasterCompressor); panner.connect(wetGain).connect(offlineReverb);
            if (tb.latency < 0) { source.start(0, Math.abs(tb.latency) / 1000); } else if (tb.latency > 0) { source.start(tb.latency / 1000); } else { source.start(0); }
        });
        const renderedBuffer = await offlineCtx.startRendering(); 
        if(btn) btn.innerText = window.appLang === 'en' ? "⏳ Encoding MP3..." : "⏳ MP3'e Dönüştürülüyor...";
        const mp3Blob = window.audioBufferToMp3 ? window.audioBufferToMp3(renderedBuffer) : window.audioBufferToWav(renderedBuffer);
        const a = document.createElement('a'); a.href = URL.createObjectURL(mp3Blob); a.download = `Gitar_Atolyesi_Jam_${new Date().getTime()}.mp3`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 1000); showToast(window.appLang === 'en' ? "🎛️ MP3 Mixdown successfully completed!" : "🎛️ MP3 Mixdown başarıyla tamamlandı!");
    } catch (err) { console.error("Mixdown Hatası:", err); showToast(window.appLang === 'en' ? "⚠️ An error occurred during export." : "⚠️ Sesi işlerken bir hata oluştu: " + err.message); } 
    finally { if(btn) { btn.innerText = "🎛️ Mixdown (MP3)"; btn.disabled = false; } if (typeof window.studioDatabase !== 'undefined' && window.studioDatabase && navigator.onLine) window.studioDatabase.goOnline(); }
};

window.mergeSelectedTracks = async () => {
    window.initAudio(); const activeTracks = tracks.filter(t => t.selected); if (activeTracks.length < 2) { showToast(window.appLang === 'en' ? "⚠️ You must select at least 2 tracks to merge." : "⚠️ Birleştirmek için en az 2 kanal seçmelisiniz."); return; }
    const btn = document.querySelector('button[onclick="mergeSelectedTracks()"]'); if(btn) { btn.innerText = window.appLang === 'en' ? "⏳ Processing..." : "⏳ İşleniyor..."; btn.disabled = true; }
    try {
        let maxDuration = 0; const trackBuffers = await Promise.all(activeTracks.map(async t => { const arrayBuffer = await t.blob.arrayBuffer(); const audioBuffer = await new Promise((resolve, reject) => { window.audioCtx.decodeAudioData(arrayBuffer, resolve, reject); }); if (audioBuffer.duration > maxDuration) maxDuration = audioBuffer.duration; const renderVol = t.audio.muted ? 0 : t.audio.volume; return { buffer: audioBuffer, pan: t.pan, reverb: t.reverb, vol: renderVol, isLoop: t.audio.loop || false, latency: t.latency || 0, eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0 }; }));
        const renderLen = maxDuration + 1.0; const currentSampleRate = window.audioCtx.sampleRate; const offlineCtx = new OfflineAudioContext(2, currentSampleRate * renderLen, currentSampleRate);
        const offlineMasterCompressor = offlineCtx.createDynamicsCompressor(); offlineMasterCompressor.threshold.value = -3; offlineMasterCompressor.knee.value = 10; offlineMasterCompressor.ratio.value = 12; offlineMasterCompressor.attack.value = 0.003; offlineMasterCompressor.release.value = 0.05; offlineMasterCompressor.connect(offlineCtx.destination);
        let length = offlineCtx.sampleRate * 2.5; let impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate); for (let i = 0; i < 2; i++) { let channel = impulse.getChannelData(i); for (let j = 0; j < length; j++) channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4); }
        let offlineReverb = offlineCtx.createConvolver(); offlineReverb.buffer = impulse; offlineReverb.connect(offlineMasterCompressor);
        trackBuffers.forEach(tb => {
            let source = offlineCtx.createBufferSource(); source.buffer = tb.buffer; source.loop = tb.isLoop; 
            let eqLow = offlineCtx.createBiquadFilter(); eqLow.type = "lowshelf"; eqLow.frequency.value = 250; eqLow.gain.value = tb.eqLow;
            let eqMid = offlineCtx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1000; eqMid.Q.value = 1.0; eqMid.gain.value = tb.eqMid;
            let eqHigh = offlineCtx.createBiquadFilter(); eqHigh.type = "highshelf"; eqHigh.frequency.value = 4000; eqHigh.gain.value = tb.eqHigh;
            let trackVolNode = offlineCtx.createGain(); trackVolNode.gain.value = tb.vol; let panner = offlineCtx.createStereoPanner(); panner.pan.value = tb.pan || 0; let dryGain = offlineCtx.createGain(); dryGain.gain.value = 1; let wetGain = offlineCtx.createGain(); wetGain.gain.value = tb.reverb || 0;
            source.connect(eqLow).connect(eqMid).connect(eqHigh).connect(trackVolNode); trackVolNode.connect(panner); panner.connect(dryGain).connect(offlineMasterCompressor); panner.connect(wetGain).connect(offlineReverb);
            if (tb.latency < 0) { source.start(0, Math.abs(tb.latency) / 1000); } else if (tb.latency > 0) { source.start(tb.latency / 1000); } else { source.start(0); }
        });
        const renderedBuffer = await offlineCtx.startRendering(); const wavBlob = window.audioBufferToWav(renderedBuffer);
        const now = new Date(); const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0'); const trackName = window.appLang === 'en' ? `🔗 Merged Track (${timeStr})` : `🔗 Birleşik Kanal (${timeStr})`;
        saveTrackToDB(trackName, wavBlob, (newId) => { const url = URL.createObjectURL(wavBlob); let a = new Audio(url); activeTracks.forEach(t => { t.selected = false; t.audio.muted = true; }); tracks.push({ id: newId, name: trackName, blob: wavBlob, audio: a, selected: true }); setupTrackRouting(tracks.length - 1); renderStudioTracks(); window.applyMuteSoloState(); showToast(window.appLang === 'en' ? "🔗 Tracks successfully merged!" : "🔗 Kanallar başarıyla tek bir kanalda birleştirildi!"); });
    } catch (err) { console.error("Birleştirme Hatası:", err); showToast(window.appLang === 'en' ? "⚠️ An error occurred." : "⚠️ İşlem sırasında bir hata oluştu."); } finally { if(btn) { btn.innerText = window.appLang === 'en' ? "🔗 Merge Tracks" : "🔗 Birleştir"; btn.disabled = false; } }
};
/* BÖLÜM 2 SONU - BURAYA KADAR KOPYALA VE YAPIŞTIR */
const btnImportTrack = document.getElementById('btn-import-track'); const trackFileInput = document.getElementById('track-file-input');
if(btnImportTrack && trackFileInput) { btnImportTrack.addEventListener('click', () => trackFileInput.click()); trackFileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; const trackName = file.name.replace(/\.[^/.]+$/, ""); hasImportedTrack = true; if (window.showToast) showToast(window.appLang === 'en' ? `⏳ Importing ${trackName} to studio...` : `⏳ ${trackName} stüdyoya alınıyor...`); saveTrackToDB(trackName, file, (newId) => { const url = URL.createObjectURL(file); let a = new Audio(url); tracks.push({ id: newId, name: trackName, blob: file, audio: a, selected: false }); setupTrackRouting(tracks.length - 1); renderStudioTracks(); if (window.showToast) showToast(window.appLang === 'en' ? "✅ File successfully added to studio!" : "✅ Dosya başarıyla stüdyoya eklendi!"); }); e.target.value = ''; }); }

const studioWrapper = document.getElementById('studio-panel-wrapper');
if (studioWrapper) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { studioWrapper.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false); });
    ['dragenter', 'dragover'].forEach(eventName => { studioWrapper.addEventListener(eventName, () => { const inner = studioWrapper.querySelector('.studio-panel-inner'); if(inner && !inner.classList.contains('studio-drag-glow')) inner.classList.add('studio-drag-glow'); }, false); });
    ['dragleave', 'drop'].forEach(eventName => { studioWrapper.addEventListener(eventName, () => { const inner = studioWrapper.querySelector('.studio-panel-inner'); if(inner) inner.classList.remove('studio-drag-glow'); }, false); });
    studioWrapper.addEventListener('drop', (e) => {
        const dt = e.dataTransfer; const files = dt.files;
        if (files && files.length > 0) {
            const file = files[0]; if (!file.type.startsWith('audio/')) { if (window.showToast) showToast(window.appLang === 'en' ? "⚠️ Error: Only audio files (MP3, WAV) are supported." : "⚠️ Hata: Sadece ses dosyaları (MP3, WAV vb.) yüklenebilir."); return; }
            const trackName = file.name.replace(/\.[^/.]+$/, ""); hasImportedTrack = true; if (window.showToast) showToast(window.appLang === 'en' ? `⏳ Importing ${trackName} to studio...` : `⏳ ${trackName} stüdyoya alınıyor...`);
            saveTrackToDB(trackName, file, (newId) => { const url = URL.createObjectURL(file); let a = new Audio(url); tracks.push({ id: newId, name: trackName, blob: file, audio: a, selected: false }); setupTrackRouting(tracks.length - 1); renderStudioTracks(); if (window.showToast) showToast(window.appLang === 'en' ? "✅ File successfully added to studio!" : "✅ Dosya başarıyla stüdyoya eklendi!"); });
        }
    }, false);
}

const btnRecTrack = document.getElementById('btn-rec-track');
if(btnRecTrack) {
    btnRecTrack.addEventListener('click', async () => {
        const hasConsent = await window.ensureMicConsent(); if (!hasConsent) return; 
        if (isMicOn) { isMicOn = false; if(tunerReqId) cancelAnimationFrame(tunerReqId); const tNote = document.getElementById('tuner-note'); const tInst = document.getElementById('tuner-instruction'); document.getElementById('btn-mic').innerText = window.appLang === 'en' ? "🎙️ Tune" : "🎙️ Akort Et"; if(tNote) tNote.innerText = "--"; if(tInst) { tInst.innerText = window.appLang === 'en' ? "Paused for recording" : "Kayıt için duraklatıldı"; tInst.style.color = "var(--text-muted)"; } }
        const btn = document.getElementById('btn-rec-track');
        try {
            window.initAudio(); if(window.audioCtx.state === 'suspended') await window.audioCtx.resume();
            if (window.isStudioRecording) {
                masterRecorder.stop(); window.isStudioRecording = false; btn.innerHTML = window.appLang === 'en' ? "🔴 Record <kbd class=\"kbd-badge\">K</kbd>" : "🔴 Kaydet <kbd class=\"kbd-badge\">K</kbd>"; btn.classList.add('pulse-red');
                if(window.domCache.recMeter) window.domCache.recMeter.style.width = "0%"; document.title = window.appLang === 'en' ? "Guitar Workshop | Training & Pro Studio" : "Gitar Atölyesi | Eğitim & Pro Kayıt Stüdyosu"; 
                const studioPanel = document.querySelector('.studio-panel-inner'); if(studioPanel) studioPanel.classList.remove('studio-recording-glow');
                try { micInputNode.disconnect(); } catch(e){} try { window.mixDestNode.disconnect(); } catch(e){} 
                window.stopSelectedTracks(); if (window.isMetroOn && !window.isPlayingProgression) { document.getElementById('btn-metro').click(); } if (window.isPlayingProgression) { document.getElementById('btn-play-prog').click(); }
                if (typeof isMonitoringOn !== 'undefined' && isMonitoringOn && typeof monitorGainNode !== 'undefined') { try { micInputNode.connect(monitorGainNode); } catch(e){} }
                return;
            }
            if(!globalMicStream) { globalMicStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, latency: 0 } }); }
            if (btn.getAttribute('data-counting') === 'true') { clearInterval(window.countTimer); btn.removeAttribute('data-counting'); btn.innerHTML = window.appLang === 'en' ? "🔴 Record <kbd class=\"kbd-badge\">K</kbd>" : "🔴 Kaydet <kbd class=\"kbd-badge\">K</kbd>"; btn.classList.add('pulse-red'); if (window.showToast) showToast(window.appLang === 'en' ? "⚠️ Recording cancelled before starting." : "⚠️ Kayıt başlatılmadan iptal edildi.", 2000); return; }
            btn.setAttribute('data-counting', 'true'); let count = 4; const tickInterval = (60.0 / window.bpm) * 1000; btn.innerHTML = window.appLang === 'en' ? `⏳ Ready: ${count}` : `⏳ Hazırlan: ${count}`; btn.classList.remove('pulse-red');
            if (!window.cobainMessageShown) { 
                const title = window.appLang === 'en' ? "Pure Soul & Fast Production" : "Saf Ruh ve Hızlı Üretim";
                const msg = window.appLang === 'en' ? "Remember Kurt Cobain's spirit: Don't spend hours tweaking, record that raw and intimate feeling of your music right now!" : "Kurt Cobain'in bağımsız ruhunu hatırla: Bilgisayar başında saatlerce ince ayar yapmadan, müziğin o ham ve samimi hissini hemen şimdi kaydet!";
                showLegendMessage(title, msg); 
                window.cobainMessageShown = true; 
            }
            
            window.countTimer = setInterval(async () => {
                if (count > 0) { 
                    let stepNum = (count === 4) ? 0 : 1; 
                    window.playClick(window.audioCtx.currentTime, stepNum, window.metroVol); 
                    btn.innerHTML = window.appLang === 'en' ? `⏳ Ready: ${count}` : `⏳ Hazırlan: ${count}`; 
                    count--; 
                } 
                else {
                    clearInterval(window.countTimer); btn.removeAttribute('data-counting');
                    recChunks = []; initStudioEffects(); if(!micInputNode) micInputNode = window.audioCtx.createMediaStreamSource(globalMicStream);
                    try { micInputNode.disconnect(); } catch(e){} try { window.mixDestNode.disconnect(); } catch(e){} 
                    micInputNode.connect(recordingBoost);
                    if (typeof isMonitoringOn !== 'undefined' && isMonitoringOn && typeof monitorGainNode !== 'undefined') { try { micInputNode.connect(monitorGainNode); } catch(e){} }

                    let options = undefined; const mimeTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/webm'];
                    for (let type of mimeTypes) { if (MediaRecorder.isTypeSupported(type)) { options = { mimeType: type, audioBitsPerSecond: 128000 }; break; } }
                    masterRecorder = new MediaRecorder(recordingDestNode.stream, options); masterRecorder.ondataavailable = e => recChunks.push(e.data);
                    masterRecorder.onstop = () => {
                        const recordDuration = (Date.now() - window.recordingStartTime) / 1000;
                        if (recordDuration < 1.5) { showToast(window.appLang === 'en' ? "⚠️ Recording cancelled (too short)." : "⚠️ Kayıt süresi çok kısa olduğu için iptal edildi."); return; }
                        const blob = new Blob(recChunks, { type: options ? options.mimeType : '' }); const now = new Date(); const dateStr = now.toLocaleDateString('tr-TR'); const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0'); 
                        const trackName = window.appLang === 'en' ? `🎙️ Record (${dateStr} - ${timeStr})` : `🎙️ Kayıt (${dateStr} - ${timeStr})`;
                        saveTrackToDB(trackName, blob, (newId) => { const url = URL.createObjectURL(blob); let a = new Audio(url); tracks.push({ id: newId, name: trackName, blob: blob, audio: a, selected: true }); setupTrackRouting(tracks.length - 1); renderStudioTracks(); });
                    };
                    
                    btn.innerHTML = window.appLang === 'en' ? "⏹ Stop Rec <kbd class=\"kbd-badge\">K</kbd>" : "⏹ Kaydı Bitir <kbd class=\"kbd-badge\">K</kbd>"; btn.classList.add('pulse-red'); document.title = window.appLang === 'en' ? "🔴 Recording... | Guitar Workshop" : "🔴 Kaydediliyor... | Gitar Atölyesi";
                    window.playSelectedTracks(); setTimeout(() => { window.recordingStartTime = Date.now(); masterRecorder.start(); window.isStudioRecording = true; }, 50);
                    if (window.showToast) showToast(window.appLang === 'en' ? "🔴 RECORDING STARTED - PLAY NOW!" : "🔴 KAYIT BAŞLADI - ŞİMDİ ÇAL!", 2500);
                    const studioPanel = document.querySelector('.studio-panel-inner'); if(studioPanel) studioPanel.classList.add('studio-recording-glow');
                    if(!window.studioAnalyser) { window.studioAnalyser = window.audioCtx.createAnalyser(); window.studioAnalyser.fftSize = 512; window.audioCtx.createMediaStreamSource(globalMicStream).connect(window.studioAnalyser); }
                }
            }, tickInterval);
        } catch (err) { showToast(window.appLang === 'en' ? "⚠️ Microphone access denied or failed." : "⚠️ Mikrofon erişimi reddedildi veya sağlanamadı."); console.error(err); btn.removeAttribute('data-counting'); btn.innerHTML = window.appLang === 'en' ? "🔴 Record <kbd class=\"kbd-badge\">K</kbd>" : "🔴 Kaydet <kbd class=\"kbd-badge\">K</kbd>"; btn.classList.add('pulse-red'); }
    });
}

window.updateUI(true);

function updateNetworkStatus() { const statusEl = document.getElementById('network-status'); if (!statusEl) return; if (navigator.onLine) { statusEl.className = 'status-indicator status-online'; statusEl.innerHTML = '🟢 Online'; } else { statusEl.className = 'status-indicator status-offline'; statusEl.innerHTML = '🔴 Offline'; } }
window.addEventListener('offline', () => { 
    if (window.showToast) window.showToast(window.appLang === 'en' ? "📡 Connection lost. Working in offline mode." : "📡 İnternet koptu. Çevrimdışı modda çalışıyorsunuz."); 
    updateNetworkStatus(); 
    if (!window.keithMessageShown) {
        const title = window.appLang === 'en' ? "Inspiration Needs No Internet" : "İlhamın İnterneti Olmaz";
        const msg = window.appLang === 'en' ? "Keith Richards found the 'Satisfaction' riff half-asleep in a hotel. Even offline or on a mountain, all settings are saved; AkorStudyo keeps running. Don't miss the inspiration!" : "Keith Richards meşhur 'Satisfaction' riff'ini bir otel odasında yarı uykulu bulmuştu. İnternetin kopsa da, dağ başında olsan da tüm ayarların hafızada; AkorStudyo tam gaz çalışmaya devam ediyor. İlhamı kaçırma!";
        showLegendMessage(title, msg);
        window.keithMessageShown = true;
    }
});
window.addEventListener('online', () => { if (window.showToast) window.showToast(window.appLang === 'en' ? "🟢 Internet connection restored." : "🟢 İnternet bağlantısı tekrar sağlandı."); updateNetworkStatus(); });
updateNetworkStatus();

const btnExportImg = document.getElementById('btn-export-img');
if (btnExportImg) { btnExportImg.addEventListener('click', () => { if (progression.length === 0) return alert(window.appLang === 'en' ? 'No chord progression to download!' : 'İndirilecek akor dizisi yok!'); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); canvas.width = 800; canvas.height = 400; ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#228be6'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(window.appLang === 'en' ? 'GUITAR WORKSHOP - CHORD PROGRESSION' : 'GİTAR ATÖLYESİ - AKOR DİZİSİ', canvas.width / 2, 80); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 56px sans-serif'; const typeLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7", "Sus4": "sus4", "Sus2": "sus2", "Dim": "dim", "Aug": "aug", "Min7b5":"m7b5", "Maj9":"maj9", "Min9":"m9", "5":"5", "mMaj7":"m(maj7)", "Add9":"add9", "mAdd9":"m(add9)", "6":"6", "m6":"m6", "7b9":"7b9", "7#9":"7#9" }; let chordText = progression.map(p => window.notes[p.root] + (typeLabels[p.type] !== undefined ? typeLabels[p.type] : p.type)).join(' - '); ctx.fillText(chordText, canvas.width / 2, 220); ctx.fillStyle = '#495057'; ctx.font = '22px sans-serif'; ctx.fillText(window.appLang === 'en' ? 'Generated with www.akorstudyo.com' : 'Bu akor dizisi www.akorstudyo.com ile oluşturulmuştur.', canvas.width / 2, 350); const a = document.createElement('a'); a.download = 'akorstudyo-akor-karti.png'; a.href = canvas.toDataURL('image/png'); a.click(); if (window.showToast) window.showToast(window.appLang === 'en' ? "🖼️ Chord card downloaded!" : "🖼️ Akor kartı indirildi!"); }); }

const backingTrackSelect = document.getElementById('backing-track-select');
if (backingTrackSelect) { backingTrackSelect.addEventListener('change', async (e) => { const url = e.target.value; if (!url) return; const trackName = e.target.options[e.target.selectedIndex].text.replace(/^[^\w\s]+/, '').trim(); if (window.showToast) window.showToast(window.appLang === 'en' ? `⏳ Downloading ${trackName}...` : `⏳ ${trackName} indiriliyor...`); e.target.disabled = true; try { const response = await fetch(url); if (!response.ok) throw new Error("Dosya bulunamadı"); const blob = await response.blob(); hasImportedTrack = true; saveTrackToDB(trackName, blob, (newId) => { const blobUrl = URL.createObjectURL(blob); let a = new Audio(blobUrl); tracks.push({ id: newId, name: trackName, blob: blob, audio: a, selected: true }); setupTrackRouting(tracks.length - 1); renderStudioTracks(); if (window.showToast) window.showToast(window.appLang === 'en' ? `✅ ${trackName} added to studio!` : `✅ ${trackName} stüdyoya eklendi!`); }); } catch (err) { if (window.showToast) window.showToast(window.appLang === 'en' ? "⚠️ Backing track failed to load. MP3 might be missing." : "⚠️ Altyapı yüklenemedi. MP3 dosyaları eksik olabilir."); } finally { e.target.disabled = false; e.target.value = ""; } }); }

const btnFocusMode = document.getElementById('btn-focus-mode'); if (btnFocusMode) { btnFocusMode.addEventListener('click', () => { document.body.classList.toggle('focus-mode'); if (document.body.classList.contains('focus-mode')) { btnFocusMode.innerHTML = window.appLang === 'en' ? "👁️ Exit Focus" : "👁️ Odaktan Çık"; btnFocusMode.style.background = "var(--danger)"; if (window.showToast) showToast(window.appLang === 'en' ? "🧘 Focus Mode Active: Only open panels are visible." : "🧘 Odak Modu Aktif: Sadece açık paneller ekranda."); } else { btnFocusMode.innerHTML = window.appLang === 'en' ? "🧘 Focus" : "🧘 Odak"; btnFocusMode.style.background = "var(--primary)"; if (window.showToast) showToast(window.appLang === 'en' ? "Focus Mode Disabled." : "Odak Modu Kapatıldı."); } }); }
const btnResetLayout = document.getElementById('btn-reset-layout'); if (btnResetLayout) { btnResetLayout.addEventListener('click', () => { const userConfirmed = confirm(window.appLang === 'en' ? "Reset panel layout to default?\n\n⚠️ Your recordings and metronome/chord settings WILL NOT be deleted.\n\nConfirm?" : "Panellerin görünüm sırası ilk açılış haline döndürülecek.\n\n⚠️ Merak etmeyin: Yaptığınız stüdyo kayıtları, metronom ayarları veya akor dizileriniz KESİNLİKLE SİLİNMEYECEKTİR.\n\nOnaylıyor musunuz?"); if (userConfirmed) { localStorage.removeItem('gitar_panel_order'); const defaultOrder = ['fretboard-panel', 'controls-panel-wrapper', 'song-tutor-panel', 'scale-assistant', 'tools-panel-wrapper', 'studio-panel-wrapper']; const sortableContainer = document.getElementById('sortable-list'); if (sortableContainer) { defaultOrder.forEach(panelId => { const panelElement = document.getElementById(panelId); if (panelElement) { sortableContainer.appendChild(panelElement); } }); } if (window.showToast) showToast(window.appLang === 'en' ? "🧹 Layout reset. Your data is safe!" : "🧹 Arayüz düzeni sıfırlandı. Verileriniz güvende!"); } }); }
const btnClearMemory = document.getElementById('btn-clear-memory'); 
if (btnClearMemory) { 
    btnClearMemory.addEventListener('click', () => { 
        const isEn = window.appLang === 'en';
        const confirmMsg = isEn 
            ? "⚠️ WARNING!\n\nAll your studio recordings (WAV) and saved chord/metronome memory in the browser will be completely deleted.\n\nThis action cannot be undone. Do you confirm?" 
            : "⚠️ DİKKAT!\n\nStüdyodaki tüm kayıtlarınız (WAV) ve tarayıcıya kaydedilen akor/metronom hafızanız tamamen silinecektir.\n\nBu işlem geri alınamaz. Onaylıyor musunuz?";
        const isConfirmed = confirm(confirmMsg); 
        
        if (isConfirmed) { 
            if (typeof db !== 'undefined' && db) { const tx = db.transaction("tracks", "readwrite"); const store = tx.objectStore("tracks"); store.clear(); } 
            localStorage.removeItem('gitar_session'); localStorage.removeItem('gitar_panel_order'); localStorage.removeItem('gitar_theme'); localStorage.removeItem('gitar_lefty'); localStorage.removeItem('gitar_vis_metro'); localStorage.removeItem('gitar_cookie_consent'); 
            tracks.forEach(t => { if (t.audio) { t.audio.pause(); t.audio.src = ""; } }); 
            const alertMsg = isEn ? "🧹 Memory and all audio tracks successfully cleared. Application is restarting..." : "🧹 Hafıza ve tüm ses kayıtları başarıyla temizlendi. Uygulama yeniden başlatılıyor...";
            alert(alertMsg); window.location.reload(); 
        } 
    }); 
}

window.toggleChordProMode = (isPro) => { 
    const advWrapper = document.getElementById('advanced-controls-wrapper'); const btnAddProg = document.getElementById('btn-add-prog'); const proChords = document.querySelectorAll('.pro-chord'); const typeSelect = document.getElementById('type-select'); 
    if (isPro) { advWrapper.style.display = 'block'; if(btnAddProg) btnAddProg.style.display = 'inline-block'; proChords.forEach(opt => opt.style.display = 'block'); } else { advWrapper.style.display = 'none'; if(btnAddProg) btnAddProg.style.display = 'none'; proChords.forEach(opt => opt.style.display = 'none'); const selectedOpt = typeSelect.options[typeSelect.selectedIndex]; if (selectedOpt && selectedOpt.classList.contains('pro-chord')) { typeSelect.value = 'Min'; typeSelect.dispatchEvent(new Event('change')); } } 
};
window.toggleMetroProMode = (isPro) => { const advWrapper = document.getElementById('advanced-metro-wrapper'); if (isPro) { advWrapper.style.display = 'block'; } else { advWrapper.style.display = 'none'; const speedTrainer = document.getElementById('speed-trainer-toggle'); if (speedTrainer && speedTrainer.checked) { speedTrainer.checked = false; speedTrainer.dispatchEvent(new Event('change')); } } };
window.toggleScaleProMode = (isPro) => { const advWrapper = document.getElementById('advanced-scale-wrapper'); const advScaleSelect = document.getElementById('adv-scale-select'); const scalePosSelect = document.getElementById('scale-position-select'); const scalePatternBox = document.getElementById('scale-pattern-box'); if (isPro) { advWrapper.style.display = 'block'; if (scalePatternBox) scalePatternBox.style.display = 'flex'; } else { advWrapper.style.display = 'none'; let needsRedraw = false; if (advScaleSelect && advScaleSelect.value !== 'auto') { advScaleSelect.value = 'auto'; needsRedraw = true; } if (scalePosSelect && scalePosSelect.value !== 'pos1') { scalePosSelect.value = 'pos1'; needsRedraw = true; } if (needsRedraw && typeof viewingScaleMode !== 'undefined' && viewingScaleMode) { drawScaleFretboard(); updateScaleAssistant(); } } };

window.ensureMicConsent = function() { return new Promise((resolve) => { if (localStorage.getItem('gitar_mic_consent') === 'true') { resolve(true); return; } 
    const title = window.appLang === 'en' ? "🎙️ Microphone Permission Required" : "🎙️ Mikrofon İzni Gerekli";
    const text = window.appLang === 'en' ? "We need access to your microphone for studio recordings and the smart tuner to work.<br><br><b>🔒 Privacy and Security:</b> Your voice is never uploaded to the internet or transferred to servers. All analysis and recording processes happen purely on your device (offline)." : "Stüdyo kayıtları ve akıllı akort cihazının çalışabilmesi için mikrofonunuza erişmemiz gerekiyor.<br><br><b>🔒 Gizlilik ve Güvenlik:</b> Sesiniz asla internete yüklenmez veya sunuculara aktarılmaz. Tüm analiz ve kayıt işlemleri sadece sizin cihazınızda (çevrimdışı) gerçekleşir.";
    const btnCancel = window.appLang === 'en' ? "Cancel" : "İptal";
    const btnOk = window.appLang === 'en' ? "I Understand, Allow" : "Anladım, İzin Ver";
    
    const overlay = document.createElement('div'); overlay.className = 'modal-overlay show'; overlay.style.zIndex = "10000"; overlay.innerHTML = `<div class="modal-content" style="text-align:center; max-width:400px;"><h3 style="margin-top:0; color:var(--primary);">${title}</h3><p style="font-size:14px; line-height:1.6; color:var(--text);">${text}</p><div style="display:flex; gap:10px; justify-content:center; margin-top:20px;"><button id="btn-consent-cancel" class="btn" style="flex:1;">${btnCancel}</button><button id="btn-consent-ok" class="btn btn-add" style="flex:1;">${btnOk}</button></div></div>`; document.body.appendChild(overlay); document.getElementById('btn-consent-cancel').onclick = () => { overlay.remove(); resolve(false); }; document.getElementById('btn-consent-ok').onclick = () => { localStorage.setItem('gitar_mic_consent', 'true'); overlay.remove(); resolve(true); }; }); };

window.renderAiSuggestions = function() {
    if (!timelineEl) return; let aiContainer = document.getElementById('ai-suggestion-box');
    if (!aiContainer) { aiContainer = document.createElement('div'); aiContainer.id = 'ai-suggestion-box'; aiContainer.style.cssText = "margin-top: 15px; padding: 12px; background: rgba(32, 201, 151, 0.05); border: 1px dashed #20c997; border-radius: 8px; display: flex; flex-direction: column; gap: 10px;"; timelineEl.parentNode.insertBefore(aiContainer, timelineEl.nextSibling); }
    if (progression.length === 0) { aiContainer.style.display = 'none'; return; }
    aiContainer.style.display = 'flex'; const lastChord = progression[progression.length - 1]; let suggestions = []; const root = lastChord.root;
    
    const tComp = window.appLang === 'en' ? "🌟 Companion (IV)" : "🌟 Tamamlayıcı (IV)";
    const tRes = window.appLang === 'en' ? "🔥 Resolver (V)" : "🔥 Çözücü (V)";
    const tSad = window.appLang === 'en' ? "🌧️ Sad (vi)" : "🌧️ Hüzünlü (vi)";
    const tTrans = window.appLang === 'en' ? "🌉 Transition (ii)" : "🌉 Geçiş (ii)";
    const tRise = window.appLang === 'en' ? "☀️ Rising (VI)" : "☀️ Yükseliş (VI)";
    const tStrong = window.appLang === 'en' ? "⚡ Strong (VII)" : "⚡ Güçlü (VII)";
    const tDark = window.appLang === 'en' ? "🌌 Dark (iv)" : "🌌 Karanlık (iv)";
    const tStable = window.appLang === 'en' ? "⚓ Stable (v)" : "⚓ Kararlı (v)";

    if (lastChord.type.includes("Maj") || lastChord.type === "5") { suggestions.push({ r: (root + 5) % 12, t: "Maj", label: tComp }); suggestions.push({ r: (root + 7) % 12, t: "Maj", label: tRes }); suggestions.push({ r: (root + 9) % 12, t: "Min", label: tSad }); suggestions.push({ r: (root + 2) % 12, t: "Min", label: tTrans }); } 
    else { suggestions.push({ r: (root + 8) % 12, t: "Maj", label: tRise }); suggestions.push({ r: (root + 10) % 12, t: "Maj", label: tStrong }); suggestions.push({ r: (root + 5) % 12, t: "Min", label: tDark }); suggestions.push({ r: (root + 7) % 12, t: "Min", label: tStable }); }
    
    const typeLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7" }; const lastChordName = window.notes[lastChord.root] + (typeLabels[lastChord.type] !== undefined ? typeLabels[lastChord.type] : lastChord.type);
    aiContainer.innerHTML = `<div style="font-size: 13px; color: #20c997;">🤖 <b>${window.appLang === 'en' ? 'Chord Compass Suggestion:' : 'Akor Pusulası Önerisi:'}</b> <span>${lastChordName}</span> ${window.appLang === 'en' ? 'sounds great followed by:' : 'akorundan sonra şunlar harika gider:'}</div>`;
    const btnContainer = document.createElement('div'); btnContainer.style.cssText = "display: flex; gap: 8px; flex-wrap: wrap;";
    suggestions.forEach(sug => { const chordName = window.notes[sug.r] + (sug.t === "Min" ? "m" : ""); const btn = document.createElement('button'); btn.className = 'btn'; btn.style.cssText = "background: #2b3035; color: #20c997; border: 1px solid #20c997; font-size: 12px; padding: 6px 12px; border-radius: 6px; cursor: pointer;"; btn.innerHTML = `<b>${chordName}</b> <span style="font-size:10px; color:var(--text-muted); margin-left:4px;">${sug.label}</span>`; btn.onclick = () => { progression.push({ root: sug.r, type: sug.t, shape: window.generateVariations(sug.r, sug.t)[0] }); window.currentProgTitle = window.appLang === 'en' ? "🎸 Custom Chord Combination" : "🎸 Özel Akor Kombinasyonu"; renderProgression(); saveSession(); }; btn.onmouseover = () => btn.style.background = "#20c99733"; btn.onmouseout = () => btn.style.background = "#2b3035"; btnContainer.appendChild(btn); });
    aiContainer.appendChild(btnContainer);
};

window.isTourRunning = false; 
window.showFeature = function(targetId) {
    if (window.isTourRunning) return; window.isTourRunning = true; const targetEl = document.getElementById(targetId); const aboutSection = document.getElementById('about-section');
    if (!targetEl) { window.isTourRunning = false; return; }

    if (targetId === 'btn-inspire' || targetId === 'advanced-controls-wrapper') {
        const chordPro = document.getElementById('chord-pro-toggle');
        if (chordPro && !chordPro.checked) { chordPro.checked = true; if(typeof window.toggleChordProMode === 'function') window.toggleChordProMode(true); }
    } else if (targetId === 'drum-style') {
        const metroPro = document.getElementById('metro-pro-toggle');
        if (metroPro && !metroPro.checked) { metroPro.checked = true; if(typeof window.toggleMetroProMode === 'function') window.toggleMetroProMode(true); }
    }

    const parentPanel = targetEl.closest('.panel-wrapper'); if (parentPanel && parentPanel.classList.contains('collapsed')) parentPanel.classList.remove('collapsed');
    if (targetEl.classList.contains('panel-wrapper') && targetEl.classList.contains('collapsed')) targetEl.classList.remove('collapsed');
    const parentDetails = targetEl.closest('details'); if (parentDetails && !parentDetails.open) parentDetails.open = true;

    setTimeout(() => {
        const yOffset = targetEl.getBoundingClientRect().top + window.pageYOffset - (window.innerHeight / 2) + (targetEl.offsetHeight / 2); window.scrollTo({ top: yOffset, behavior: 'smooth' });
        targetEl.classList.add('tour-highlight'); let demoDuration = 3500; 
        if (targetId === 'btn-focus-mode') { setTimeout(() => targetEl.click(), 800); setTimeout(() => targetEl.click(), 3500); demoDuration = 4500; } 
        else if (targetId === 'network-status') { setTimeout(() => { targetEl.className = 'status-indicator status-offline'; targetEl.innerHTML = '🔴 Offline'; }, 800); setTimeout(() => { targetEl.className = 'status-indicator status-online'; targetEl.innerHTML = '🟢 Online'; }, 3500); demoDuration = 4500; }
        else if (targetId === 'drum-style') { const visualToggle = document.getElementById('visual-metro-toggle'); const playBtn = document.getElementById('btn-metro'); setTimeout(() => { targetEl.value = 'rock'; targetEl.dispatchEvent(new Event('change')); if(visualToggle && !visualToggle.checked) visualToggle.click(); if(playBtn && !playBtn.classList.contains('active')) playBtn.click(); }, 800); setTimeout(() => { if(playBtn && playBtn.classList.contains('active')) playBtn.click(); targetEl.value = 'click'; targetEl.dispatchEvent(new Event('change')); if(visualToggle && visualToggle.checked) visualToggle.click(); }, 4500); demoDuration = 5500; }
        else if (targetId === 'fretboard-panel') { const leftyToggle = document.getElementById('lefty-toggle'); setTimeout(() => { if(leftyToggle) leftyToggle.click(); }, 800); setTimeout(() => { if(leftyToggle) leftyToggle.click(); }, 3500); demoDuration = 4500; }
        else if (targetId === 'btn-inspire' || targetId === 'btn-toggle-scale') { setTimeout(() => targetEl.click(), 800); demoDuration = 4000; }
        else if (targetId === 'advanced-controls-summary') { demoDuration = 3500; }

        setTimeout(() => { 
            targetEl.classList.remove('tour-highlight'); 
            if(aboutSection) { const aboutY = aboutSection.getBoundingClientRect().top + window.pageYOffset - (window.innerHeight / 2) + (aboutSection.offsetHeight / 2); window.scrollTo({ top: aboutY, behavior: 'smooth' }); } 
            if (parentDetails && targetId === 'advanced-controls-summary') parentDetails.open = false; 
            setTimeout(() => { window.isTourRunning = false; }, 800); 
        }, demoDuration);
    }, 300); 
};

window.addEventListener('DOMContentLoaded', () => {
    const cuteBanner = document.getElementById('cute-cookie-banner'); 
    const btnCuteAccept = document.getElementById('btn-cute-accept');
    if (!localStorage.getItem('gitar_cookie_consent')) { setTimeout(() => { if(cuteBanner) cuteBanner.classList.remove('cute-banner-hidden'); }, 1500); }
    if (btnCuteAccept) { btnCuteAccept.addEventListener('click', () => { localStorage.setItem('gitar_cookie_consent', 'true'); cuteBanner.classList.add('animate-out'); setTimeout(() => { cuteBanner.style.display = 'none'; }, 500); }); }

    const btnPlayGame = document.getElementById('btn-play-game'); 
    const btnPlayPacman = document.getElementById('btn-play-pacman'); 
    const btnPlayRiverRaid = document.getElementById('btn-play-riverraid'); 
    const btnPlayTetris = document.getElementById('btn-play-tetris'); 
    const gameModal = document.getElementById('game-modal'); 
    const btnCloseGame = document.getElementById('btn-close-game'); 
    const gameIframe = document.getElementById('game-iframe');

    const openGame = (url) => {
        if (!gameModal || !gameIframe) return;
        gameIframe.onload = () => {
            try {
                const iframeDoc = gameIframe.contentDocument || gameIframe.contentWindow.document;
                if (iframeDoc) {
                    window.translateDOM(iframeDoc.body); 
                    const iframeObserver = new MutationObserver((mutations) => {
                        iframeObserver.disconnect();
                        mutations.forEach(m => {
                            if (m.type === 'childList') {
                                m.addedNodes.forEach(n => {
                                    window.translateDOM(n);
                                    if (n.nodeType === 1) n.querySelectorAll('*').forEach(child => window.translateDOM(child));
                                });
                            }
                            else if (m.type === 'characterData' && m.target) {
                                window.translateDOM(m.target);
                            }
                        });
                        iframeObserver.observe(iframeDoc.body, { childList: true, subtree: true, characterData: true });
                    });
                    iframeObserver.observe(iframeDoc.body, { childList: true, subtree: true, characterData: true });
                }
            } catch(e) { console.warn("Iframe çeviri erişimi engellendi.", e); }
        };
        gameIframe.src = url;
        gameModal.style.cssText = "z-index: 99999 !important;"; 
        gameModal.classList.add('show');
        setTimeout(() => { try { gameIframe.contentWindow.focus(); } catch(e){} }, 100);
    };

    if (btnPlayGame) btnPlayGame.addEventListener('click', (e) => { const d = e.target.closest('details'); if(d) d.removeAttribute('open'); openGame("./yilan.html"); });
    if (btnPlayPacman) btnPlayPacman.addEventListener('click', (e) => { const d = e.target.closest('details'); if(d) d.removeAttribute('open'); openGame("./pacman.html"); });
    if (btnPlayRiverRaid) btnPlayRiverRaid.addEventListener('click', (e) => { const d = e.target.closest('details'); if(d) d.removeAttribute('open'); openGame("./riverraid.html"); });
    if (btnPlayTetris) btnPlayTetris.addEventListener('click', (e) => { const d = e.target.closest('details'); if(d) d.removeAttribute('open'); openGame("./tetris.html"); });

    if (btnCloseGame && gameModal) {
        btnCloseGame.addEventListener('click', () => {
            gameModal.classList.remove('show'); 
            if(gameIframe) gameIframe.src = "about:blank";
            if (!window.wasFocusModeOn) document.body.classList.remove('focus-mode');
            const modalContent = document.querySelector('#game-modal .modal-content');
            if (modalContent) { modalContent.style.transform = ''; modalContent.style.background = '#121212'; }
            gameModal.style.background = 'rgba(0,0,0,0.6)'; 
            gameModal.style.backdropFilter = 'blur(5px)'; 
            gameModal.style.webkitBackdropFilter = 'blur(5px)';
        });
    }
});

window.addEventListener('message', (e) => {
    try {
        if (!e.data) return;
        let msg = typeof e.data === 'string' ? e.data : (e.data.type || e.data.action);
        if (!msg) return;

        if (msg === 'closeGameModal') { 
            const btnCloseGame = document.getElementById('btn-close-game');
            if(btnCloseGame) btnCloseGame.click(); 
        }
        
        if (msg === 'askChordQuestion') {
            window.wasFocusModeOn = document.body.classList.contains('focus-mode');
            document.body.classList.add('focus-mode');
            
            const modalContent = document.querySelector('#game-modal .modal-content'); 
            const gameModalElement = document.getElementById('game-modal');
            if (modalContent && gameModalElement) { 
                modalContent.style.setProperty('transform', 'translateY(160px) scale(0.85)', 'important'); 
                modalContent.style.setProperty('background', 'rgba(18, 18, 18, 0.4)', 'important'); 
                gameModalElement.style.setProperty('background', 'transparent', 'important'); 
                gameModalElement.style.setProperty('backdrop-filter', 'none', 'important'); 
                gameModalElement.style.setProperty('-webkit-backdrop-filter', 'none', 'important'); 
            }
            
            const fretboardPanel = document.getElementById('fretboard-panel'); 
            if (fretboardPanel) { fretboardPanel.classList.remove('collapsed'); fretboardPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

            const randomRoot = Math.floor(Math.random() * 12); 
            const types = ["Maj", "Min", "Dom7", "Min7", "Maj7"]; 
            const randomType = types[Math.floor(Math.random() * types.length)];
            const fakeRoot = (randomRoot + Math.floor(Math.random() * 5) + 1) % 12; 
            const fakeType = types[Math.floor(Math.random() * types.length)];
            
            const safeNotes = window.notes || ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            const tLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7" }; 
            
            const correctName = safeNotes[randomRoot] + tLabels[randomType]; 
            const fakeName = safeNotes[fakeRoot] + tLabels[fakeType];
            const isCorrectFirst = Math.random() > 0.5; 
            const options = isCorrectFirst ? [correctName, fakeName] : [fakeName, correctName]; 
            const correctIndex = isCorrectFirst ? 0 : 1;
            
            if (typeof currentRootIndex !== 'undefined') currentRootIndex = randomRoot; else window.currentRootIndex = randomRoot;
            if (typeof currentType !== 'undefined') currentType = randomType; else window.currentType = randomType;
            
            if (typeof updateUI === 'function') updateUI(false, true);
            else if (typeof window.updateUI === 'function') window.updateUI(false, true);
            
            setTimeout(() => { 
                let shapeToPlay = null;
                if (typeof currentVariations !== 'undefined' && currentVariations && currentVariations.length > 0) shapeToPlay = currentVariations[0];
                else if (typeof window.currentVariations !== 'undefined' && window.currentVariations && window.currentVariations.length > 0) shapeToPlay = window.currentVariations[0];
                if (shapeToPlay) {
                    if (typeof playShape === 'function') { playShape(shapeToPlay, 'arpeggio'); setTimeout(() => { playShape(shapeToPlay, 'down'); }, 2500); } 
                    else if (typeof window.playShape === 'function') { window.playShape(shapeToPlay, 'arpeggio'); setTimeout(() => { window.playShape(shapeToPlay, 'down'); }, 2500); }
                }
            }, 600);
            
            const iframe = document.getElementById('game-iframe');
            if (iframe && iframe.contentWindow) { iframe.contentWindow.postMessage({ type: 'chordQuestionData', options: options, correctIndex: correctIndex }, '*'); }
        }
        
        if (msg === 'exitFocusMode') {
            if (!window.wasFocusModeOn) document.body.classList.remove('focus-mode'); 
            const modalContent = document.querySelector('#game-modal .modal-content'); 
            const gameModalElement = document.getElementById('game-modal');
            if (modalContent && gameModalElement) { 
                modalContent.style.transform = ''; modalContent.style.background = '#121212'; 
                gameModalElement.style.background = 'rgba(0,0,0,0.6)'; gameModalElement.style.backdropFilter = 'blur(5px)'; gameModalElement.style.webkitBackdropFilter = 'blur(5px)'; 
            }
        }
    } catch (err) { console.error("Oyun mesajı hatası!", err); }
});

window.originalTexts = new WeakMap();

window.translateDOM = function(node) {
    if (node.nodeType === 1) {
        if (node.classList?.contains('track-time-label') || node.id?.startsWith('time-') || node.id === 'lang-select') return;
    }
    if (node.parentNode && node.parentNode.closest && node.parentNode.closest('#lang-select')) return;

    if (node.nodeType === 3) { 
        let originalText = node.nodeValue;
        let trimmedText = originalText.trim();
        if (trimmedText === "") return;

        if (!window.originalTexts.has(node)) {
            window.originalTexts.set(node, originalText);
        }

        if (window.appLang === 'en') {
            let trTextFull = window.originalTexts.get(node);
            let trTextTrimmed = trTextFull.trim();
            let newText = trTextFull;

            if (window.enDict && window.enDict[trTextTrimmed]) {
                newText = trTextFull.replace(trTextTrimmed, window.enDict[trTextTrimmed]);
            } else if (window.enDict && window.enDict[trTextFull]) {
                newText = window.enDict[trTextFull];
            } else {
                newText = newText
                    .replace(/Müzikal Yılan/g, "Musical Snake")
                    .replace(/Komboları yakala, detonelerden kaç!/g, "Catch combos, dodge off-key notes!")
                    .replace(/OYUNCU ADI/g, "PLAYER NAME")
                    .replace(/Oyuna Başla/g, "Start Game")
                    .replace(/Duraklat/g, "Pause")
                    .replace(/Çıkış/g, "Exit")
                    .replace(/Hareket/g, "Move")
                    .replace(/Oyun Bitti!/g, "Game Over!")
                    .replace(/YENİDEN BAŞLA/g, "RESTART")
                    .replace(/Tekrar Oyna/g, "Play Again")
                    .replace(/Paylaş \(JPG\)/g, "Share (JPG)")
                    .replace(/Top 10/g, "Top 10")
                    .replace(/Rütben:/g, "Rank:")
                    .replace(/Mevcut Skor:/g, "Current Score:")
                    .replace(/En Yüksek Skor:/g, "Best Score:")
                    .replace(/Genel Sıralaman:/g, "Global Rank:")
                    .replace(/Skor:/g, "Score:")
                    .replace(/Detone!/g, "Off-key!")
                    .replace(/Kombo x/g, "Combo x")
                    .replace(/Oyun Molası/g, "Game Break")
                    .replace(/İkinci Şans!/g, "Second Chance!")
                    .replace(/Minör/g, "Minor")
                    .replace(/Majör/g, "Major")
                    .replace(/Pentatonik/g, "Pentatonic")
                    .replace(/Kayıt/g, "Record")
                    .replace(/Varyasyon:/g, "Variation:")
                    .replace(/Ses:/g, "Sound:")
                    .replace(/Ses Açık/g, "Sound On")
                    .replace(/Ses Kapalı/g, "Sound Off")
                    .replace(/Form:/g, "Shape:")
                    .replace(/Kapo/g, "Capo")
                    .replace(/Gamına Geç/g, "Scale")
                    .replace(/Tavsiye Edilen Solo Gamı:/g, "Recommended Solo Scale:")
                    .replace(/Kalıp:/g, "Pattern:")
                    .replace(/1\. Pozisyon \(Önerilen Yol\)/g, "1st Position (Recommended)")
                    .replace(/Tüm Klavye Yayılımı/g, "Full Fretboard Spread")
                    .replace(/🎤 Şarkı Öğren & Akor Dizisi/g, "🎤 Learn Song & Chord Progression")
                    .replace(/Şarkı Adı/g, "Song Title")
                    .replace(/Şarkı Öğren \(Canlı Demo\):/g, "Learn Song (Live Demo):")
                    .replace(/Çevrimdışı veritabanı ile yüzlerce popüler şarkının sözlerini ve akorlarını interaktif klavyede çalarak öğrenin\./g, "Learn lyrics and chords of hundreds of popular songs on the interactive fretboard with the offline database.")
                    .replace(/KAYITTA/g, "RECORDING")
                    .replace(/Tertemiz ve güçlü bir ses elde etmek için mutlaka /g, "To get a clean and powerful sound, always use ")
                    .replace(/ ile bağlayın\./g, ".")
                    .replace(/Henüz akor eklenmedi\. \(1, 2, 3\.\.\. tuşlarıyla canlı çalabilirsin\)/g, "No chords added yet. (You can play live with 1, 2, 3... keys)");

                if (newText.includes("Adım ") && newText.includes("Sıradaki Akor")) {
                    newText = newText.replace("Adım", "Step").replace("Sıradaki Akor", "Next Chord");
                }
                if (newText.includes("Gitarında veya ekrandaki mavi noktalara")) {
                    newText = "Place your fingers on the blue dots, when ready hit the button!";
                }
                if (newText.includes("Stüdyoya dönmek için ESC tuşuna basabilirsin.")) {
                    newText = newText.replace("Stüdyoya dönmek için ESC tuşuna basabilirsin.", "Press ESC to return to studio.");
                }
                if (newText.includes("Arkada çalan ve stüdyoda görünen akor hangisi?")) {
                    newText = newText.replace("Arkada çalan ve stüdyoda görünen akor hangisi?", "Which chord is playing in the background?");
                }
                if (newText.includes("Yanlış cevaplarsan oyun biter!")) {
                    newText = newText.replace("Yanlış cevaplarsan oyun biter!", "Wrong answer means game over!");
                }
                if (newText.includes("Doğru bilirsen alan temizlenir!")) {
                    newText = newText.replace("Doğru bilirsen alan temizlenir!", "Correct answer clears the board!");
                }
            }
            node.nodeValue = newText;
        } else {
            if (window.originalTexts.has(node)) {
                node.nodeValue = window.originalTexts.get(node);
            }
        }
    } 
    else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
        if (node.hasAttribute('placeholder') && node.id !== 'player-name') {
            let origPH = node.getAttribute('data-orig-ph');
            if (!origPH) { origPH = node.getAttribute('placeholder'); node.setAttribute('data-orig-ph', origPH); }
            if (window.appLang === 'en') {
                if (origPH.trim() === "Şarkı veya sanatçı ara... (Örn: Duman)") {
                    node.setAttribute('placeholder', "Search song or artist... (e.g. Duman)");
                } else if (window.enDict && window.enDict[origPH.trim()]) {
                    node.setAttribute('placeholder', window.enDict[origPH.trim()]);
                }
            } else { node.setAttribute('placeholder', origPH); }
        }
        if (node.tagName === 'INPUT' && node.type === 'text') {
            if (node.id !== 'lang-select' && node.id !== 'player-name') {
                let origVal = node.getAttribute('data-orig-val');
                if(!origVal) { origVal = node.value; node.setAttribute('data-orig-val', origVal); }
                if(window.appLang === 'en' && origVal.includes("Kayıt (")) {
                    node.value = origVal.replace("Kayıt", "Record");
                } else { node.value = origVal; }
            }
        }
        node.childNodes.forEach(window.translateDOM);
    }
};

window.applyTranslations = function() {
    if(window.i18nObserver) window.i18nObserver.disconnect();
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (window.appLang === 'en') {
            if (key === 'header_title') el.innerHTML = "🎸 Guitar Workshop | Training & Pro Studio";
            if (key === 'midi_waiting') el.innerHTML = "🎹 Awaiting MIDI";
            if (key === 'metro_active') el.innerHTML = "🥁 Metronome Active";
            if (key === 'status_online') el.innerHTML = navigator.onLine ? "🟢 Online" : "🔴 Offline";
        } else {
            if (key === 'header_title') el.innerHTML = "🎸 Gitar Atölyesi | Eğitim & Pro Kayıt Stüdyosu";
            if (key === 'midi_waiting') el.innerHTML = "🎹 MIDI Bekleniyor";
            if (key === 'metro_active') el.innerHTML = "🥁 Metronom Aktif";
            if (key === 'status_online') el.innerHTML = navigator.onLine ? "🟢 Online" : "🔴 Offline";
        }
    });

    window.translateDOM(document.body);
    document.title = window.appLang === 'en' ? "🎸 Guitar Workshop | Training & Pro Studio" : "🎸 Gitar Atölyesi | Eğitim & Pro Kayıt Stüdyosu";
    
    if(window.i18nObserver) {
        window.i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
};

window.i18nObserver = new MutationObserver((mutations) => {
    window.i18nObserver.disconnect(); 
    mutations.forEach(m => {
        if (m.type === 'childList') {
            m.addedNodes.forEach(node => {
                window.translateDOM(node);
                if (node.nodeType === 1) node.querySelectorAll('*').forEach(child => window.translateDOM(child));
            });
        } else if (m.type === 'characterData' && m.target) {
            window.translateDOM(m.target);
        }
    });
    window.i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
});

const langSelect = document.getElementById('lang-select');
if (langSelect) {
    let savedLang = localStorage.getItem('gitar_lang');
    if (!savedLang || savedLang === 'en') { 
        savedLang = 'tr';
        localStorage.setItem('gitar_lang', 'tr');
    }
    window.appLang = savedLang;
    langSelect.value = window.appLang;
    
    langSelect.addEventListener('change', (e) => {
                window.appLang = e.target.value;
                localStorage.setItem('gitar_lang', window.appLang);
                window.applyTranslations();
                if(window.showToast) window.showToast(window.appLang === 'tr' ? "🇹🇷 Dil Türkçe oldu." : "🇬🇧 UI translated to English.", 2000);
                
                if (typeof renderStudioTracks === 'function') renderStudioTracks();
                
                const gameIframe = document.getElementById('game-iframe');
                if(gameIframe && gameIframe.contentDocument) {
                    window.translateDOM(gameIframe.contentDocument.body);
                }
                
                const legendToast = document.getElementById('legend-toast');
                if (legendToast && legendToast.classList.contains('show')) {
                    legendToast.classList.remove('show');
                }
            });
}

setTimeout(() => window.applyTranslations(), 150);


// --- ŞARKI ÖĞRENME MODÜLÜ (SÖZ & AKOR VE EFEKTLER) ---
document.addEventListener('DOMContentLoaded', () => {
    const aramaInput = document.getElementById('sarkiArama');
    const dataList = document.getElementById('sarkiDatalist');
    const pencere = document.getElementById('estetikPencere');
    const icerikAlani = document.getElementById('pencereIcerik');
    const baslikAlani = document.getElementById('pencereSarkiIsmi');

    const btnTutor = document.getElementById('btn-tutor');
    const songTutorPanel = document.getElementById('song-tutor-panel');
    if (btnTutor && songTutorPanel) {
        btnTutor.addEventListener('click', () => {
            songTutorPanel.classList.remove('collapsed');
            songTutorPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if(aramaInput) setTimeout(() => aramaInput.focus(), 300);
        });
    }

    if (!aramaInput || !dataList || !pencere) return;

    const hamListe = window.akorVeritabanim || [];
    
    // YAZILIMCI FİLTRESİ: İçinde şarkı olmayan blog/kategori yazılarını ve boşları çöpe atar
    const sarkiListesi = hamListe.filter(s => 
        s.sarki && 
        s.sarki.trim() !== "" && 
        !s.akorlarVeSozler.includes("Akor metni bulunamadı")
    );

    if (sarkiListesi.length > 0) {
        // Datalist'i tertemiz şarkılarla doldur
        sarkiListesi.forEach((sarki, index) => {
            const option = document.createElement('option');
            option.value = `${sarki.sanatci} - ${sarki.sarki}`;
            option.dataset.index = index; // Filtrelenmiş listenin indexini tut
            dataList.appendChild(option);
        });

        // Kullanıcı arama çubuğuna yazı yazıp tam bir eşleşme seçtiğinde:
        aramaInput.addEventListener('input', (e) => {
            const arananMetin = e.target.value;
            
            // Kullanıcının yazdığı metin, datalist'teki bir seçenekle tam eşleşiyor mu?
            const secilenOption = Array.from(dataList.options).find(opt => opt.value === arananMetin);
            
            if (!secilenOption) {
                // Eşleşme yoksa pencereyi gizle
                pencere.classList.remove('pencere-acik');
                const sagAlan = document.getElementById('pencere-akor-alani');
                if(sagAlan) sagAlan.style.display = 'none';
                return;
            }

            // Eşleşme bulunduysa şarkıyı yükle
            const secilenIndex = secilenOption.dataset.index;
            const sarki = sarkiListesi[secilenIndex];
            
            const akorRegex = /(^|\s)([A-G][#b]?(?:m|maj7|m7|7|sus2|sus4|dim|5)?)(?=\s|$)/gm;
            const rawMatches = sarki.akorlarVeSozler.match(akorRegex) || [];
            const tumAkorlar = rawMatches.map(a => a.trim()); 
            const benzersizAkorlar = [...new Set(tumAkorlar)]; 

            progression = []; 
            benzersizAkorlar.forEach(akorMetni => {
                let rootStr = akorMetni.match(/^[A-G][#b]?/)[0];
                let typeStr = akorMetni.substring(rootStr.length);
                
                const flatMap = {"Bb":"A#", "Eb":"D#", "Ab":"G#", "Db":"C#", "Gb":"F#"};
                if(flatMap[rootStr]) rootStr = flatMap[rootStr];
                
                let rootIdx = window.notes.indexOf(rootStr);
                if(rootIdx === -1) rootIdx = 0; 

                let type = "Maj";
                if (typeStr === "m" || typeStr === "Min") type = "Min";
                else if (typeStr === "7") type = "Dom7";
                else if (typeStr === "m7") type = "Min7";
                else if (typeStr === "maj7") type = "Maj7";
                else if (typeStr === "5") type = "5";

                progression.push({ 
                    root: rootIdx, 
                    type: type, 
                    shape: window.generateVariations(rootIdx, type)[0] 
                });
            });

            window.currentProgTitle = `🎤 ${sarki.sanatci} - ${sarki.sarki} (Akorları)`;
            if(typeof renderProgression === 'function') renderProgression();
            
            // YENİ KOD: Şarkı yüklendiğinde sağ panele akorları klonla
            const sagAlan = document.getElementById('pencere-akor-alani');
            if (sagAlan) {
                sagAlan.innerHTML = '';
                sagAlan.style.display = 'flex';
                progression.forEach((chordObj, idx) => {
                    const typeLabels = { "Maj": "", "Min": "m", "Dom7": "7", "Min7": "m7", "Maj7": "maj7" };
                    const chordName = window.notes[chordObj.root] + (typeLabels[chordObj.type] !== undefined ? typeLabels[chordObj.type] : chordObj.type);
                    const shape = chordObj.shape || window.generateVariations(chordObj.root, chordObj.type)[0]; 
                    if (!shape) return;

                    const card = document.createElement('div'); 
                    card.className = 'mini-chord-card'; 
                    card.style.background = 'rgba(0,0,0,0.2)';
                    card.innerHTML = `<div class="mini-chord-title">[${idx+1}] ${chordName}</div><div class="mini-fretboard" id="side-board-${idx}"></div><div class="mini-fret-numbers" id="side-nums-${idx}"></div>`;
                    sagAlan.appendChild(card);

                    const boardEl = document.getElementById(`side-board-${idx}`); 
                    const numsEl = document.getElementById(`side-nums-${idx}`); 
                    if (!boardEl || !numsEl) return;
                    if (typeof isLefty !== 'undefined' && isLefty) { boardEl.classList.add('lefty'); numsEl.classList.add('lefty'); }

                    let mappedShape = shape.map(s => { if (s.fret === 'x') return { fret: 'x', finger: null, isOpen: false }; if (s.fret === 0) return { fret: 0, finger: null, isOpen: true }; return { fret: s.fret, finger: s.finger, isOpen: false }; });
                    let minFret = 99; mappedShape.forEach(s => { if (s.fret !== 'x' && !s.isOpen && s.fret < minFret) minFret = s.fret; }); if (minFret === 99) minFret = 1; let fretOffset = minFret > 1 ? minFret - 1 : 0;

                    for (let i = 1; i <= 4; i++) { const fLine = document.createElement('div'); fLine.className = 'mini-fret-line'; fLine.style.left = `${(i / 4) * 100}%`; boardEl.appendChild(fLine); }
                    for (let i = 0; i < 6; i++) { const sLine = document.createElement('div'); sLine.className = 'mini-string-line'; sLine.style.top = `${(i / 5) * 100}%`; boardEl.appendChild(sLine); }
                    for (let i = 1; i <= 4; i++) { const numDiv = document.createElement('div'); numDiv.className = 'mini-fret-num'; numDiv.innerText = fretOffset + i; numsEl.appendChild(numDiv); }
                    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
                        const mData = mappedShape[5 - stringIdx]; const yPos = (stringIdx / 5) * 100;
                        if (mData.fret === 'x' || mData.isOpen) { 
                            const status = document.createElement('div'); status.className = (typeof isLefty !== 'undefined' && isLefty) ? 'mini-string-status lefty' : 'mini-string-status'; status.style.top = `${yPos}%`; status.innerText = mData.fret === 'x' ? 'x' : '0'; boardEl.appendChild(status);
                        } else { 
                            let relFret = mData.fret - fretOffset; 
                            if (relFret >= 1 && relFret <= 4) { const fretWidth = 100 / 4; let rawX = (relFret * fretWidth) - (fretWidth / 2); let xPos = (typeof isLefty !== 'undefined' && isLefty) ? 100 - rawX : rawX; const dot = document.createElement('div'); dot.className = 'mini-dot'; dot.style.top = `${yPos}%`; dot.style.left = `${xPos}%`; dot.innerText = mData.finger || '•'; boardEl.appendChild(dot); } 
                        }
                    }
                });
            }

            baslikAlani.textContent = `${sarki.sanatci} - ${sarki.sarki}`;            
// YENİ: Orjinal akoru 'data-orjinal' içine saklıyoruz ve tıklama olayını dinamik yapıyoruz
            const isiltiliMetin = sarki.akorlarVeSozler.replace(akorRegex, '$1<span class="akor-isilti" title="Sesi ve klavye pozisyonunu görmek için tıkla" onclick="window.akorTiklandi(this.innerText)" data-orjinal="$2">$2</span>');
            icerikAlani.innerHTML = isiltiliMetin;
            window.songTransCount = 0; // Yeni şarkı açıldığında transpoze sıfırlanır

            pencere.classList.remove('pencere-acik');
            setTimeout(() => {
                pencere.classList.add('pencere-acik');
                // Akorları hafızadan çekip sürüklenebilir hale getir
                initDraggableChordsForSong(sarki.sanatci + '_' + sarki.sarki);
            }, 100);
            
            // Şarkı açılınca odağı inputtan çek (telefonda klavye kendiliğinden kapansın diye)
            aramaInput.blur();
        });
    } else {
        console.warn("Geçerli şarkı bulunamadı.");
    }
});

window.isDraggingChord = false; // Sürükleme durumu bayrağı
// Sözlerin içindeki ışıltılı akora tıklanınca ana klavyede göster ve seslendir
window.akorTiklandi = function(akorMetni) {
    if (window.isDraggingChord) return; // Sürükleme yapıldıysa tıklamayı (ses çalmayı) iptal et
    let rootStr = akorMetni.match(/^[A-G][#b]?/)[0];
    let typeStr = akorMetni.substring(rootStr.length);
    const flatMap = {"Bb":"A#", "Eb":"D#", "Ab":"G#", "Db":"C#", "Gb":"F#"};
    
    let isConverted = false;
    let originalName = rootStr + typeStr;

    if(flatMap[rootStr]) {
        rootStr = flatMap[rootStr];
        isConverted = true; // Teori animasyonunu tetiklemek için bayrak
    }
    
    let rootIdx = window.notes.indexOf(rootStr);
    if(rootIdx === -1) rootIdx = 0;

    let type = "Maj";
    if (typeStr === "m" || typeStr === "Min") type = "Min";
    else if (typeStr === "7") type = "Dom7";
    else if (typeStr === "m7") type = "Min7";
    else if (typeStr === "maj7") type = "Maj7";
                else if (typeStr === "5") type = "5";

    // Ana değişkenleri güncelle
    viewingScaleMode = false;
    currentRootIndex = rootIdx;
    currentType = type;
    currentVariations = window.generateVariations(rootIdx, type);
    currentVarIndex = 0;
    
    // Klavyeyi çiz ve akoru çaldır
    updateUI(false, false);
    playShape(currentVariations[0], window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down');
    
    // Kullanıcının gözünü ana klavyeye (yukarı) kaydır
    const fretboardPanel = document.getElementById('fretboard-panel');
    if(fretboardPanel) fretboardPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // YAZILIMCI EKLENTİSİ: SİHİRLİ TEORİ DÖNÜŞÜMÜ (Enharmonik Eşdeğerlik)
    if (isConverted) {
        const titleEl = document.getElementById('chord-title');
        const finalTitle = titleEl.innerText; // updateUI tarafından atanan gerçek A# başlığı
        
        // Önce kullanıcının tıkladığı Bb metnini göster
        titleEl.innerHTML = `<span class="magic-transform-text">${originalName} (Kapo ${capoFret})</span>`;
        
        // 800ms sonra sihirli bir ışıltıyla A#'ya dönüştür ve Teori rozetini ekle
        setTimeout(() => {
            titleEl.innerHTML = `<span class="magic-transform-text glow-effect">${finalTitle}</span> <span class="theory-badge" style="font-size:11px; background:var(--primary); color:white; padding:3px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; animation: toastFadeIn 0.5s;" title="Müzik teorisinde bu iki akor klavyede birebir aynıdır.">(= ${originalName})</span>`;
            
            // Kullanıcıyı eğiten akıllı Toast bildirimi (Çift Dil Destekli)
            const msg = window.appLang === 'en' ? 
                `🎓 Theory Tip: In digital systems, ${originalName} and ${rootStr}${typeStr} are exactly the same on the fretboard (Enharmonic equivalent)!` : 
                `🎓 Teori İpucu: Dijital sistemlerde ${originalName} ile ${rootStr}${typeStr} klavyede tıpatıp aynıdır (Enharmonik eşdeğer)!`;
            
            if (window.showToast) {
                const theoryToast = window.showToast(msg, 9000); // 9 saniye ekranda kalır
                if (theoryToast) {
                    // Sadece bu mesaja özel dikkat çekici tasarım
                    theoryToast.style.border = '2px solid #fcc419'; // Altın sarısı çerçeve
                    theoryToast.style.boxShadow = '0 0 25px rgba(252, 196, 25, 0.5)'; // Işıltı efekti
                    theoryToast.style.color = '#fcc419'; // Yazı rengi
                    theoryToast.style.fontWeight = 'bold';
                    theoryToast.style.fontSize = '14px';
                }
            }
        }, 800);
    }
};
window.isAnatomyOn = false;
window.toggleAnatomyMode = function(isChecked) {
    window.isAnatomyOn = isChecked;
    updateUI(false, false);
    if (window.showToast) {
        const msg = window.appLang === 'en' ? 
            (isChecked ? "🎓 Chord formula is now visible." : "🎓 Chord formula hidden.") : 
            (isChecked ? "🎓 Akor formülü kalıcı olarak açıldı." : "🎓 Akor formülü gizlendi.");
        window.showToast(msg, 2000);
    }
};
// --- MANUEL AKOR KAYDIRMA VE HAFIZA SİSTEMİ ---
function initDraggableChordsForSong(songId) {
    const container = document.getElementById('pencereIcerik');
    if (!container) return;
    const chords = container.querySelectorAll('.akor-isilti');
    
    const safeSongId = songId.replace(/[^a-zA-Z0-9]/g, '_');
    const savedKey = `akor_pos_${safeSongId}`;
    const savedPositions = JSON.parse(localStorage.getItem(savedKey)) || {};

    chords.forEach((chord, index) => {
        const chordId = `chord_${index}`;
        
        chord.style.position = 'relative';
        chord.style.touchAction = 'pan-y';
        chord.style.cursor = 'ew-resize';

        if (savedPositions[chordId]) {
            chord.style.left = `${savedPositions[chordId]}px`;
            chord.dataset.x = savedPositions[chordId];
        } else {
            chord.dataset.x = 0;
        }

        let startX = 0;
        let currentX = parseFloat(chord.dataset.x) || 0;
        let isDragging = false;
        let moved = false;

        chord.addEventListener('pointerdown', (e) => {
            isDragging = true;
            moved = false;
            startX = e.clientX - (parseFloat(chord.dataset.x) || 0);
            chord.setPointerCapture(e.pointerId);
        });

        chord.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            currentX = e.clientX - startX;
            if (Math.abs(currentX - (parseFloat(chord.dataset.x) || 0)) > 3) {
                moved = true;
                window.isDraggingChord = true;
            }
            chord.style.left = `${currentX}px`;
        });

        chord.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            chord.releasePointerCapture(e.pointerId);
            if (moved) {
                chord.dataset.x = currentX;
                savedPositions[chordId] = currentX;
                localStorage.setItem(savedKey, JSON.stringify(savedPositions));
                setTimeout(() => window.isDraggingChord = false, 50);
            }
        });

        chord.addEventListener('pointercancel', (e) => {
            isDragging = false;
            chord.releasePointerCapture(e.pointerId);
            setTimeout(() => window.isDraggingChord = false, 50);
        });
    });

    // 0. Transpoze (Ton Kaydırma) Modülü
    let transGroup = document.getElementById('song-trans-group');
    if (!transGroup) {
        // Eksik kalan yazdırma (print) gizleme stillerini dinamik olarak ekle
        if (!document.getElementById('trans-print-style')) {
            const style = document.createElement('style');
            style.id = 'trans-print-style';
            style.innerHTML = `@media print { #song-trans-group, #btn-share-song-img, #prompter-group { display: none !important; } }`;
            document.head.appendChild(style);
        }

        transGroup = document.createElement('div');
        transGroup.id = 'song-trans-group';
        transGroup.style.cssText = "display:inline-flex; align-items:center; gap: 4px; margin-left: 15px; vertical-align: middle; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border); font-size:11px; font-weight:bold;";
        transGroup.innerHTML = `
            <span style="margin-right:4px; color:var(--text-muted);">Ton:</span>
            <button id="btn-song-trans-down" style="cursor:pointer; background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--text); font-weight:bold; font-size:14px; padding:0 8px; transition:0.2s;">-</button>
            <span id="song-transpoze-deger" style="color:var(--primary); min-width:24px; text-align:center; font-size:13px;">0</span>
            <button id="btn-song-trans-up" style="cursor:pointer; background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--text); font-weight:bold; font-size:14px; padding:0 8px; transition:0.2s;">+</button>
        `;
        const sarkiBaslik = document.getElementById('pencereSarkiIsmi');
        if (sarkiBaslik && sarkiBaslik.parentNode) {
            sarkiBaslik.parentNode.insertBefore(transGroup, sarkiBaslik.nextSibling);
        }

        // Müzik Matematiği: Akor Kaydırma Mantığı
        const flatMap = {"Bb":"A#", "Eb":"D#", "Ab":"G#", "Db":"C#", "Gb":"F#"};
        function shiftSongChords(direction) {
            window.songTransCount = (window.songTransCount || 0) + direction;
            document.getElementById('song-transpoze-deger').innerText = (window.songTransCount > 0 ? "+" : "") + window.songTransCount;
            
            const currentChords = document.querySelectorAll('#pencereIcerik .akor-isilti');
            currentChords.forEach(span => {
                const orjinal = span.getAttribute('data-orjinal');
                let rootStr = orjinal.match(/^[A-G][#b]?/)[0];
                let typeStr = orjinal.substring(rootStr.length);
                
                // Bemolleri Diyez formatına çevirerek index hatasını önle
                if(flatMap[rootStr]) rootStr = flatMap[rootStr];
                
                let rootIdx = window.notes.indexOf(rootStr);
                if(rootIdx !== -1) {
                    let yeniIdx = (rootIdx + window.songTransCount) % 12;
                    if (yeniIdx < 0) yeniIdx += 12; // Eksi değerleri başa sar
                    span.innerText = window.notes[yeniIdx] + typeStr;
                }
            });

            // YENİ: Kullanıcıya bilgi veren okunabilir süreli (2.5 sn) toast mesajı
            if (window.showToast) {
                let toastMsg = "";
                if (window.songTransCount === 0) {
                    toastMsg = window.appLang === 'en' ? "🎵 Song returned to original key." : "🎵 Şarkı orijinal tonuna geri döndü.";
                } else if (window.songTransCount > 0) {
                    toastMsg = window.appLang === 'en' ? `🎵 Key shifted up +${window.songTransCount} semitones.` : `🎵 Ton +${window.songTransCount} yarım ses tizleştirildi (İnce).`;
                } else {
                    toastMsg = window.appLang === 'en' ? `🎵 Key shifted down ${window.songTransCount} semitones.` : `🎵 Ton ${window.songTransCount} yarım ses pesleştirildi (Kalın).`;
                }
                window.showToast(toastMsg, 2500);
            }
        }

        document.getElementById('btn-song-trans-down').addEventListener('click', () => shiftSongChords(-1));
        document.getElementById('btn-song-trans-up').addEventListener('click', () => shiftSongChords(1));
    } else {
        // Yeni şarkı yüklendiğinde var olan panelin değerini sıfırla
        document.getElementById('song-transpoze-deger').innerText = "0";
    }

    // 1. Reset Butonu
    let resetBtn = document.getElementById('btn-reset-chords');
    if (!resetBtn) {
        resetBtn = document.createElement('button');
        resetBtn.id = 'btn-reset-chords';
        resetBtn.className = 'btn btn-reset';
        resetBtn.style.cssText = "padding: 4px 10px; font-size: 11px; display: inline-block; margin-left: 15px; vertical-align: middle;";
        resetBtn.innerHTML = window.appLang === 'en' ? "🔄 Reset Chords" : "🔄 Akorları Sıfırla";
        const sarkiBaslik = document.getElementById('pencereSarkiIsmi');
        if (sarkiBaslik && sarkiBaslik.parentNode) {
            sarkiBaslik.parentNode.insertBefore(resetBtn, sarkiBaslik.nextSibling);
        }
    }
    
    const newResetBtn = resetBtn.cloneNode(true);
    resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
    
    newResetBtn.addEventListener('click', () => {
        // 1. Akor Konumlarını Sıfırla
        localStorage.removeItem(savedKey);
        
        chords.forEach(chord => {
            chord.style.left = `0px`;
            chord.dataset.x = 0;
            
            // 2. Akor Metinlerini Orjinal Tonuna Döndür
            if (chord.hasAttribute('data-orjinal')) {
                chord.innerText = chord.getAttribute('data-orjinal');
            }
        });

        // 3. Transpoze Sayacını ve Arayüzünü Sıfırla
        window.songTransCount = 0;
        const transDegerEl = document.getElementById('song-transpoze-deger');
        if (transDegerEl) transDegerEl.innerText = "0";

        if(window.showToast) window.showToast(window.appLang === 'en' ? "🔄 Chords and key reset!" : "🔄 Akor konumları ve ton sıfırlandı!");
    });

    // 2. Yazdır (Print) Butonu
    let printBtn = document.getElementById('btn-print-song');
    if (!printBtn) {
        printBtn = document.createElement('button');
        printBtn.id = 'btn-print-song';
        printBtn.className = 'btn';
        printBtn.style.cssText = "padding: 4px 10px; font-size: 11px; display: inline-block; margin-left: 10px; vertical-align: middle; background: var(--primary); color: white; border: none; cursor: pointer;";
        printBtn.innerHTML = window.appLang === 'en' ? "🖨️ Print" : "🖨️ Yazdır";
        
        newResetBtn.parentNode.insertBefore(printBtn, newResetBtn.nextSibling);
        
        printBtn.addEventListener('click', () => {
            const pencere = document.getElementById('estetikPencere');
            const originalParent = pencere.parentNode;
            const originalNextSibling = pencere.nextSibling;
            
            document.body.classList.add('print-mode');
            document.body.appendChild(pencere); 
            
            window.print();
            
            document.body.classList.remove('print-mode');
            if (originalNextSibling) {
                originalParent.insertBefore(pencere, originalNextSibling);
            } else {
                originalParent.appendChild(pencere);
            }
        });
    }

    // 3. Resim Olarak Paylaş Butonu
    let shareBtn = document.getElementById('btn-share-song-img');
    if (!shareBtn) {
        shareBtn = document.createElement('button');
        shareBtn.id = 'btn-share-song-img';
        shareBtn.className = 'btn';
        shareBtn.style.cssText = "padding: 4px 10px; font-size: 11px; display: inline-block; margin-left: 10px; vertical-align: middle; background: #845ef7; color: white; border: none; cursor: pointer; border-radius: 6px;";
        shareBtn.innerHTML = window.appLang === 'en' ? "📸 Share as Image" : "📸 Resim Olarak Paylaş";
        
        printBtn.parentNode.insertBefore(shareBtn, printBtn.nextSibling);
        
        shareBtn.addEventListener('click', () => {
            const btn = shareBtn;
            const originalText = btn.innerHTML;
            btn.innerHTML = window.appLang === 'en' ? "⏳ Preparing..." : "⏳ Hazırlanıyor...";
            btn.disabled = true;

            try {
                const titleText = document.getElementById('pencereSarkiIsmi').innerText;
                const contentEl = document.getElementById('pencereIcerik');
                const contentHTML = contentEl.innerHTML;
                
                const rawText = contentEl.innerText || "";
                const lineCount = rawText.split(/\r\n|\r|\n/).length;
                const safeHeightCalc = (lineCount * 30) + 400; 
                const width = 1000;
                const height = Math.max(contentEl.scrollHeight + 350, safeHeightCalc); 

                const svgData = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                        <foreignObject width="100%" height="100%">
                            <div xmlns="http://www.w3.org/1999/xhtml" style="background: linear-gradient(135deg, #141419 0%, #0a0a0f 100%); padding: 50px; box-sizing: border-box; width: 100%; min-height: 100%; height: max-content; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                <style>
                                    .akor-isilti { color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.6); font-weight: bold; position: relative; }
                                </style>
                                <div style="font-size: 32px; font-weight: bold; color: #4dabf7; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                    ${titleText}
                                </div>
                                <div style="font-size: 15px; line-height: 1.8; color: #e0e0e0; white-space: pre; overflow: visible;">${contentHTML}</div>
                                <div style="margin-top: 50px; padding-top: 25px; border-top: 1px dashed rgba(255,255,255,0.15); text-align: center; font-size: 18px; color: #845ef7; font-weight: bold; letter-spacing: 3px;">
                                    🎸 WWW.AKORSTUDYO.COM
                                </div>
                            </div>
                        </foreignObject>
                    </svg>
                `;

                const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
                const img = new Image();
                
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.fillStyle = "#0a0a0f";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob(async function(pngBlob) {
                        const fileName = `${titleText.replace(/[^a-zA-Z0-9]/g, '_')}_AkorStudyo.png`;
                        const file = new File([pngBlob], fileName, { type: "image/png" });
                        
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            try {
                                await navigator.share({ title: titleText, text: 'AkorStudyo 🎸', files: [file] });
                            } catch (err) { console.log('Paylaşım iptal edildi.', err); }
                        } else {
                            const downloadUrl = URL.createObjectURL(pngBlob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = fileName;
                            a.click();
                            URL.revokeObjectURL(downloadUrl);
                            if(window.showToast) window.showToast(window.appLang === 'en' ? "📸 Image downloaded!" : "📸 Resim indirildi! İstediğiniz platformda paylaşabilirsiniz.");
                        }
                        
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 'image/png');
                };
                
                img.onerror = function() {
                    if(window.showToast) window.showToast(window.appLang === 'en' ? "⚠️ Image creation failed." : "⚠️ Resim oluşturulurken hata oluştu.");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                };
                
                img.src = url;
            } catch(e) {
                console.error(e);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // 4. Teleprompter (Oto-Kaydır) Modülü
    let prompterGroup = document.getElementById('prompter-group');
    if (!prompterGroup) {
        prompterGroup = document.createElement('div');
        prompterGroup.id = 'prompter-group';
        prompterGroup.style.cssText = "display:inline-flex; align-items:center; gap: 8px; margin-left: 10px; vertical-align: middle; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);";
        prompterGroup.innerHTML = `
            <button id="btn-prompter-toggle" class="btn" style="padding: 2px 8px; font-size: 11px; font-weight: bold; background: var(--surface); color: var(--text); border: 1px solid var(--border);">${window.appLang === 'en' ? "▶ Auto-Scroll" : "▶ Oto-Kaydır"}</button>
            <div style="display: flex; align-items: center; gap: 4px;" title="Kaydırma Hızı">
                <button class="btn" id="btn-prompter-slower" style="padding:0 5px; font-size:12px; background:var(--surface); border:1px solid var(--border); color:var(--text); line-height:1; min-height:16px;">-</button>
                <input type="range" id="prompter-speed" min="0.05" max="1.5" step="0.01" value="0.3" style="width: 50px; margin: 0;">
                <button class="btn" id="btn-prompter-faster" style="padding:0 5px; font-size:12px; background:var(--surface); border:1px solid var(--border); color:var(--text); line-height:1; min-height:16px;">+</button>
            </div>
        `;
        
        const shareBtnEl = document.getElementById('btn-share-song-img');
        if (shareBtnEl && shareBtnEl.parentNode) {
            shareBtnEl.parentNode.insertBefore(prompterGroup, shareBtnEl.nextSibling);
            
            const baslik = shareBtnEl.parentNode;
            baslik.style.position = 'sticky';
            baslik.style.top = '-20px';
            baslik.style.background = 'rgba(20, 20, 25, 0.98)';
            baslik.style.zIndex = '100';
            baslik.style.margin = '-20px -20px 20px -20px';
            baslik.style.padding = '20px 20px 15px 20px';
            baslik.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        }
        
        window.prompterRAF = null;
        window.isPrompterRunning = false;
        window.prompterSpeed = 0.3; 
        window.exactScrollTop = 0; // YENİ: Küsüratlı (çok yavaş) kaydırmaları hafızada tutmak için
        
        document.getElementById('btn-prompter-toggle').addEventListener('click', () => {
            const btn = document.getElementById('btn-prompter-toggle');
            const container = document.getElementById('estetikPencere');
            if (window.isPrompterRunning) {
                window.isPrompterRunning = false;
                cancelAnimationFrame(window.prompterRAF);
                btn.innerHTML = window.appLang === 'en' ? "▶ Auto-Scroll" : "▶ Oto-Kaydır";
                btn.style.color = "var(--text)";
            } else {
                window.isPrompterRunning = true;
                btn.innerHTML = window.appLang === 'en' ? "⏸ Stop" : "⏸ Durdur";
                btn.style.color = "var(--danger)";
                window.exactScrollTop = container.scrollTop; // Başlarken tam konumu kaydet
                
                const runPrompter = () => {
                    if(!window.isPrompterRunning) return;
                    if(container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
                        window.isPrompterRunning = false;
                        btn.innerHTML = window.appLang === 'en' ? "▶ Auto-Scroll" : "▶ Oto-Kaydır";
                        btn.style.color = "var(--text)";
                        return;
                    }
                    // YENİ: Tarayıcının küsüratları silip durmasını engeller
                    window.exactScrollTop += window.prompterSpeed;
                    container.scrollTop = window.exactScrollTop;
                    window.prompterRAF = requestAnimationFrame(runPrompter);
                };
                runPrompter();
            }
        });

        const updatePrompterSpeed = (val) => {
            window.prompterSpeed = parseFloat(val);
            document.getElementById('prompter-speed').value = window.prompterSpeed;
        };
        
        document.getElementById('prompter-speed').addEventListener('input', (e) => updatePrompterSpeed(e.target.value));
        document.getElementById('btn-prompter-slower').addEventListener('click', () => {
            let newVal = Math.max(0.05, window.prompterSpeed - 0.05); // Hassas eksi
            updatePrompterSpeed(newVal.toFixed(2));
        });
        document.getElementById('btn-prompter-faster').addEventListener('click', () => {
            let newVal = Math.min(1.5, window.prompterSpeed + 0.05); // Hassas artı
            updatePrompterSpeed(newVal.toFixed(2));
        });
    } else {
        // Yeni şarkı açıldığında önceden çalışan prompter'ı sıfırla
        window.isPrompterRunning = false;
        cancelAnimationFrame(window.prompterRAF);
        const btn = document.getElementById('btn-prompter-toggle');
        if(btn) {
            btn.innerHTML = window.appLang === 'en' ? "▶ Auto-Scroll" : "▶ Oto-Kaydır";
            btn.style.color = "var(--text)";
        }
    }
}

// --- RETRO MİNİ OYNATICI (BAĞLAMSAL ENJEKSİYON) ---
function initRetroPlayer() {
    const timelineEl = document.getElementById('prog-timeline');
    // Eğer akor dizisi bölümü yoksa veya oynatıcı zaten eklendiyse iptal et
    if (!timelineEl || document.getElementById('retro-player-wrap')) return;

    const tPlay = window.appLang === 'en' ? "▶ PLAY" : "▶ OYNAT";
    const tMetro = window.appLang === 'en' ? "🥁 METRONOME" : "🥁 METRONOM";
    const tReady = window.appLang === 'en' ? "AKORSTUDYO AMP v1.0 ... READY ..." : "AKORSTUDYO AMP v1.0 ... HAZIR ...";

    const playerHtml = `
    <div id="retro-player-wrap">
        <div class="retro-close" id="retro-btn-close" title="Kapat">✖</div>
        <div class="retro-screen">
            <canvas id="retro-vis"></canvas>
            <div class="retro-text" id="retro-marquee">${tReady}</div>
        </div>
        <div class="retro-controls">
            <div style="display: flex; gap: 8px;">
                <button class="retro-btn" id="retro-btn-play">${tPlay}</button>
                <button class="retro-btn" id="retro-btn-metro">${tMetro}</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: #aaa; font-size: 11px; font-weight: bold;">
                VOL <input type="range" class="retro-slider" id="retro-vol" min="0" max="1" step="0.01" value="0.7">
            </div>
        </div>
    </div>`;
    
    // Oynatıcıyı Akor Dizisi (timeline) panelinin tam altına enjekte et
    timelineEl.parentNode.insertBefore(document.createRange().createContextualFragment(playerHtml), timelineEl.nextSibling);

    const retroWrap = document.getElementById('retro-player-wrap');
    const canvas = document.getElementById('retro-vis');
    const ctx = canvas.getContext('2d');
    const marquee = document.getElementById('retro-marquee');
    
    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isPlaying = window.isMetroOn || window.isPlayingProgression;
        const barWidth = 3, gap = 1, barCount = Math.floor(canvas.width / (barWidth + gap));
        for(let i = 0; i < barCount; i++) {
            let height = isPlaying ? Math.random() * canvas.height * 0.9 : 2;
            let gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#0f0'); gradient.addColorStop(0.6, '#ff0'); gradient.addColorStop(1, '#f00');
            ctx.fillStyle = gradient;
            ctx.fillRect(i * (barWidth + gap), canvas.height - height, barWidth, height);
        }
    }
    
    setTimeout(() => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; drawVisualizer(); }, 100);

    // X butonu ile paneli gizle
    document.getElementById('retro-btn-close').addEventListener('click', () => {
        retroWrap.style.display = 'none';
    });

    document.getElementById('retro-btn-metro').addEventListener('click', () => {
        const mBtn = document.getElementById('btn-metro');
        if(mBtn) mBtn.click();
        const tOn = window.appLang === 'en' ? "🥁 METRONOME: ACTIVE (BPM: " : "🥁 METRONOM: AKTİF (BPM: ";
        const tOff = window.appLang === 'en' ? "AKORSTUDYO AMP v1.0 ... METRONOME: OFF" : "AKORSTUDYO AMP v1.0 ... METRONOM: KAPALI";
        marquee.innerText = window.isMetroOn ? tOn + window.bpm + ")" : tOff;
    });

    document.getElementById('retro-btn-play').addEventListener('click', () => {
        const pBtn = document.getElementById('btn-play-prog');
        if(pBtn) pBtn.click();
        setTimeout(() => {
            const isPlayingNow = window.isPlayingProgression;
            document.getElementById('retro-btn-play').innerText = isPlayingNow ? (window.appLang === 'en' ? "⏹ STOP" : "⏹ DURDUR") : (window.appLang === 'en' ? "▶ PLAY" : "▶ OYNAT");
            marquee.innerText = isPlayingNow ? (window.appLang === 'en' ? "▶ PLAYING: CHORD SEQUENCE" : "▶ OYNATILIYOR: AKOR DİZİSİ") : (window.appLang === 'en' ? "AKORSTUDYO AMP v1.0 ... READY" : "AKORSTUDYO AMP v1.0 ... HAZIR");
        }, 50);
    });
    
    document.getElementById('retro-vol').addEventListener('input', (e) => {
        window.chordVol = parseFloat(e.target.value);
        window.metroVol = parseFloat(e.target.value);
        marquee.innerText = (window.appLang === 'en' ? "VOLUME: %" : "SES SEVİYESİ: %") + Math.round(e.target.value * 100);
    });

    // Ana "Diziyi Çal" butonuna basıldığında Retro Oynatıcıyı otomatik göster ve senkronize et
    const mainPlayBtn = document.getElementById('btn-play-prog');
    if (mainPlayBtn) {
        mainPlayBtn.addEventListener('click', () => {
            if(retroWrap.style.display !== 'flex') {
                retroWrap.style.display = 'flex';
                canvas.width = canvas.offsetWidth; 
                canvas.height = canvas.offsetHeight;
            }
            setTimeout(() => {
                const isPlayingNow = window.isPlayingProgression;
                document.getElementById('retro-btn-play').innerText = isPlayingNow ? (window.appLang === 'en' ? "⏹ STOP" : "⏹ DURDUR") : (window.appLang === 'en' ? "▶ PLAY" : "▶ OYNAT");
                marquee.innerText = isPlayingNow ? (window.appLang === 'en' ? "▶ PLAYING: CHORD SEQUENCE" : "▶ OYNATILIYOR: AKOR DİZİSİ") : (window.appLang === 'en' ? "AKORSTUDYO AMP v1.0 ... READY" : "AKORSTUDYO AMP v1.0 ... HAZIR");
            }, 50);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initRetroPlayer, 500);
});
// --- KLAVYE TROLLEME (EASTER EGG) SİSTEMİ ---
let klavyeDokunmaSayaci = 0;

let isSahteNotaPlaying = false;
function sahteNotaCal() {
    if (isSahteNotaPlaying) return;
    isSahteNotaPlaying = true;

    // Çıplak AudioContext yerine ana ses motorunu güvenli başlatıyoruz
    if (typeof window.initAudio === 'function') window.initAudio();
    if (!window.audioCtx) { isSahteNotaPlaying = false; return; }

    const osc = window.audioCtx.createOscillator();
    const gainNode = window.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(329.63, window.audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.5, window.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, window.audioCtx.currentTime + 0.5);

    osc.connect(gainNode);
    
    // Doğrudan hedefe gitmek yerine güvenli kompresör üzerinden gönderiyoruz
    if (window.masterCompressor) {
        gainNode.connect(window.masterCompressor);
    } else {
        gainNode.connect(window.audioCtx.destination);
    }

    osc.start();
    osc.stop(window.audioCtx.currentTime + 0.5);

    setTimeout(() => { isSahteNotaPlaying = false; }, 300);
}

const klavyeKutusu = document.getElementById('fretboard'); 

if (klavyeKutusu) {
    // YENİ ÇÖZÜM: Mobilde parmak klavye üzerindeyken de sayfanın aşağı kayabilmesine izin ver
    klavyeKutusu.style.touchAction = 'pan-y';

    klavyeKutusu.addEventListener('click', () => {
        if (klavyeDokunmaSayaci >= 10) return;

        klavyeKutusu.classList.remove('titre-efekti');
        void klavyeKutusu.offsetWidth; 
        klavyeKutusu.classList.add('titre-efekti');
        
        sahteNotaCal();
        klavyeDokunmaSayaci++;

        let mesaj = "";
        let sure = 5000; // Varsayılan temel süre uzatıldı

        const isEnglish = document.documentElement.lang === 'en' || localStorage.getItem('language') === 'en' || window.currentLang === 'en';

        if (klavyeDokunmaSayaci === 1) {
            mesaj = isEnglish 
                ? "🎸 You plucked the string and it made a sound. Feel better now? Stop tapping the glass and grab your real guitar!" 
                : "🎸 Teli titrettin, ses de çıktı. İçin rahatladı mı? Şimdi o cam ekrana dokunmayı bırak da gerçek gitarını eline al!";
            sure = 7500; // Uzun metin için 7.5 saniye
        } else if (klavyeDokunmaSayaci === 3) {
            mesaj = isEnglish 
                ? "👀 Still tapping... You'll get calluses on the screen. Go feel some real string pain!" 
                : "👀 Hâlâ ekrana dokunuyorsun... Ekranda nasır tutacak parmakların, git gerçek tel acısı çek biraz!";
            sure = 6000; // 6 saniye
        } else if (klavyeDokunmaSayaci === 5) {
            mesaj = isEnglish 
                ? "📱 Okay, we get it, your touchscreen works. But this is a studio, not a mobile game. Grab the guitar!" 
                : "📱 Tamam, anladık, dokunmatik ekranın çok hassas. Ama burası bir stüdyo, mobil oyun değil. Hadi, al şu gitarı!";
            sure = 7500; // Uzun metin için 7.5 saniye
        } else if (klavyeDokunmaSayaci === 10) {
            mesaj = isEnglish 
                ? "🛑 Stubborn! No more sound for you. I'm on strike until you pick up a real guitar." 
                : "🛑 İnatçısın! Daha fazla ses yok. Gitarı alana kadar protesto ediyorum.";
            sure = 6000; // 6 saniye
        }

        if (mesaj && window.showToast) {
            window.showToast(mesaj, sure);
        }
    });
}
// GARAGON KARŞILAMA MESAJI KONTROLÜ
document.addEventListener("DOMContentLoaded", () => {
    const welcomeToast = document.getElementById("welcome-toast");
    const closeBtn = document.getElementById("welcome-toast-close");
    const langSelect = document.getElementById("lang-select");
    let autoCloseTimer;

    function showWelcomeToast() {
        if (!welcomeToast) return;
        welcomeToast.style.display = "block";
        clearTimeout(autoCloseTimer);
        setTimeout(() => {
            if (typeof updateLanguage === 'function') { updateLanguage(); }
            welcomeToast.classList.add("toast-show");
            autoCloseTimer = setTimeout(closeWelcomeToast, 15000);
        }, 500);
    }

    function closeWelcomeToast() {
        if (!welcomeToast) return;
        welcomeToast.classList.remove("toast-show");
        setTimeout(() => { welcomeToast.style.display = "none"; }, 600); 
        // YENİ: Kullanıcı mesajı kapattığında veya süre dolduğunda hafızaya yaz
        localStorage.setItem("gitar_welcome_seen", "true");
    }

    if (welcomeToast && closeBtn) {
        // YENİ: SADECE KULLANICI DAHA ÖNCE BU MESAJI GÖRMEDİYSE ÇALIŞTIR
        if (!localStorage.getItem("gitar_welcome_seen")) {
            setTimeout(showWelcomeToast, 2500);
        }

        closeBtn.addEventListener("click", () => {
            clearTimeout(autoCloseTimer);
            closeWelcomeToast();
        });

        if (langSelect) {
            langSelect.addEventListener("change", () => {
                // Sadece mesaj o an ekranda açıksa yeni dile göre çevirip göster (Gizliyse rahatsız etme)
                if(welcomeToast.classList.contains("toast-show")) {
                    welcomeToast.classList.remove("toast-show");
                    setTimeout(() => { welcomeToast.style.display = "none"; showWelcomeToast(); }, 600);
                }
            });
        }
    }
});
// --- EFSANEVİ MESAJ (TOAST) SİSTEMİ ---
function showLegendMessage(title, text) {
    let toast = document.getElementById("legend-toast");
    
    // Eğer sayfada toast elementi yoksa JS ile anında oluştur
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "legend-toast";
        document.body.appendChild(toast);
    }
    
    // İçeriği doldur (Gitar emojisi ile şık bir başlık)
    toast.innerHTML = `<h4>🎸 ${title}</h4><p style="margin:0; line-height:1.5;">${text}</p>`;
    toast.className = "show";
    
    // Eğer peş peşe mesaj gelirse eski zamanlayıcıyı sıfırla, 7 saniye ekranda tut
    clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(function(){ 
        toast.className = toast.className.replace("show", ""); 
    }, 7000);
}
// --- PROJE DIŞA/İÇE AKTARMA (.akor) SİSTEMİ ---
window.exportProject = async () => {
    if(tracks.length === 0 && progression.length === 0) {
        if (window.showToast) showToast(window.appLang === 'en' ? "⚠️ Studio is empty, nothing to save!" : "⚠️ Stüdyo boş, kaydedilecek bir şey yok!");
        return;
    }
    
    if (window.showToast) showToast(window.appLang === 'en' ? "⏳ Saving Project..." : "⏳ Proje Paketleniyor...");

    try {
        const blobToBase64 = (blob) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        const tracksData = await Promise.all(tracks.map(async (t) => {
            const b64 = await blobToBase64(t.blob);
            return {
                name: t.name,
                blob64: b64,
                settings: {
                    vol: t.audio.volume, pan: t.pan || 0, reverb: t.reverb || 0,
                    latency: t.latency || 0, isMuted: t.isMuted || false,
                    solo: t.solo || false, loop: t.audio.loop || false,
                    eqLow: t.eqLow || 0, eqMid: t.eqMid || 0, eqHigh: t.eqHigh || 0
                }
            };
        }));

        const projectData = {
            version: "1.0",
            session: { p: progression, b: window.bpm, s: window.domCache.rhythmStyle ? window.domCache.rhythmStyle.value : 'down' },
            tracks: tracksData
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,"");
        dlAnchorElem.setAttribute("download", `AkorStudyo_Proje_${dateStr}.akor`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        document.body.removeChild(dlAnchorElem);
        
        if (window.showToast) showToast(window.appLang === 'en' ? "💾 Project exported successfully!" : "💾 Proje başarıyla indirildi!");
    } catch(e) {
        console.error(e);
        if (window.showToast) showToast(window.appLang === 'en' ? "⚠️ Error exporting project." : "⚠️ Proje dışa aktarılırken bir hata oluştu.");
    }
};

window.importProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const projectData = JSON.parse(event.target.result);
            
            // 1. Akor Dizisi ve Metronomu (Session) Geri Yükle
            if(projectData.session) {
                if(projectData.session.b) { window.bpm = projectData.session.b; if(window.domCache.bpmSlider) window.domCache.bpmSlider.value = window.bpm; if(window.domCache.bpmInput) window.domCache.bpmInput.value = window.bpm; }
                if(projectData.session.s && window.domCache.rhythmStyle) window.domCache.rhythmStyle.value = projectData.session.s;
                if(projectData.session.p && Array.isArray(projectData.session.p)) { progression = projectData.session.p; if (typeof renderProgression === 'function') renderProgression(); }
                if (typeof saveSession === 'function') saveSession();
            }

            // 2. Ses Kanallarını ve Ayarları Geri Yükle
            if(projectData.tracks && projectData.tracks.length > 0) {
                if (window.showToast) showToast(window.appLang === 'en' ? "⏳ Loading audio tracks..." : "⏳ Ses kanalları stüdyoya kuruluyor...");
                
                // YENİ: CSP Güvenlik Duvarına Takılmayan Base64 -> Blob Dönüştürücü
                const b64toBlob = (dataURI) => {
                    const parts = dataURI.split(',');
                    const mime = parts[0].match(/:(.*?);/)[1];
                    const bstr = atob(parts[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    return new Blob([u8arr], { type: mime });
                };

                for(let tData of projectData.tracks) {
                    const blob = b64toBlob(tData.blob64);
                    await new Promise(resolve => {
                        if (typeof saveTrackToDB === 'function') {
                            saveTrackToDB(tData.name, blob, (newId) => {
                                const url = URL.createObjectURL(blob);
                                let a = new Audio(url);
                                if (tData.settings) {
                                    a.volume = tData.settings.vol !== undefined ? tData.settings.vol : 1.0;
                                    a.loop = tData.settings.loop || false;
                                }
                                const newT = { id: newId, name: tData.name, blob: blob, audio: a, selected: false };
                                if (tData.settings) {
                                    newT.pan = tData.settings.pan || 0; newT.reverb = tData.settings.reverb || 0;
                                    newT.latency = tData.settings.latency || 0; newT.isMuted = tData.settings.isMuted || false;
                                    newT.solo = tData.settings.solo || false; newT.eqLow = tData.settings.eqLow || 0;
                                    newT.eqMid = tData.settings.eqMid || 0; newT.eqHigh = tData.settings.eqHigh || 0;
                                }
                                tracks.push(newT);
                                if (typeof setupTrackRouting === 'function') setupTrackRouting(tracks.length - 1);
                                
                                // DB'ye ayarları da eşitle
                                if (typeof db !== 'undefined' && db) {
                                    const tx = db.transaction("tracks", "readwrite"); 
                                    tx.objectStore("tracks").put({ id: newId, name: tData.name, blob: blob, settings: tData.settings });
                                }
                                resolve();
                            });
                        } else { resolve(); }
                    });
                }
                if(typeof window.applyMuteSoloState === 'function') window.applyMuteSoloState();
                if(typeof renderStudioTracks === 'function') renderStudioTracks();
            }
            if (window.showToast) showToast(window.appLang === 'en' ? "📂 Project loaded successfully!" : "📂 Proje başarıyla yüklendi!");
        } catch(err) {
            console.error(err);
            if (window.showToast) showToast(window.appLang === 'en' ? "⚠️ Invalid or corrupted .akor file!" : "⚠️ Geçersiz veya bozuk .akor dosyası!");
        }
        e.target.value = ''; // Input'u sıfırla ki aynı dosyayı tekrar yükleyebilsin
    };
    reader.readAsText(file);
};