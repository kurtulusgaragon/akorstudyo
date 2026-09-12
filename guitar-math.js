"use strict";

// -------------------------------------------------------------
// GİTAR MATEMATİĞİ VE MÜZİK TEORİSİ
// Notalar, frekanslar ve akor varyasyonu hesaplamaları burada yapılır.
// -------------------------------------------------------------

window.notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
window.trNotes = { "C":"Do(C)", "C#":"Do#(C#)", "D":"Re(D)", "D#":"Re#(D#)", "E":"Mi(E)", "F":"Fa(F)", "F#":"Fa#(F#)", "G":"Sol(G)", "G#":"Sol#(G#)", "A":"La(A)", "A#":"La#(A#)", "B":"Si(B)" };
window.baseFrequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
window.stringTuningNames = ['e', 'B', 'G', 'D', 'A', 'E'];

window.openChords = {
    "A_Min": [{fret:'x'},{fret:0},{fret:2,finger:2},{fret:2,finger:3},{fret:1,finger:1},{fret:0}],
    "A_Maj": [{fret:'x'},{fret:0},{fret:2,finger:1},{fret:2,finger:2},{fret:2,finger:3},{fret:0}],
    "A_Dom7": [{fret:'x'},{fret:0},{fret:2,finger:2},{fret:0},{fret:2,finger:3},{fret:0}],
    "A_Sus2": [{fret:'x'},{fret:0},{fret:2,finger:2},{fret:2,finger:3},{fret:0},{fret:0}],
    "A_Sus4": [{fret:'x'},{fret:0},{fret:2,finger:2},{fret:2,finger:3},{fret:3,finger:4},{fret:0}],
    "A_Maj9": [{fret:'x'},{fret:0},{fret:2,finger:2},{fret:1,finger:1},{fret:0},{fret:0}],
    "C_Maj": [{fret:'x'},{fret:3,finger:3},{fret:2,finger:2},{fret:0},{fret:1,finger:1},{fret:0}],
    "C_Maj9": [{fret:'x'},{fret:3,finger:2},{fret:2,finger:1},{fret:4,finger:4},{fret:3,finger:3},{fret:'x'}],
    "D_Min": [{fret:'x'},{fret:'x'},{fret:0},{fret:2,finger:2},{fret:3,finger:3},{fret:1,finger:1}],
    "D_Maj": [{fret:'x'},{fret:'x'},{fret:0},{fret:2,finger:1},{fret:3,finger:3},{fret:2,finger:2}],
    "D_Sus2": [{fret:'x'},{fret:'x'},{fret:0},{fret:2,finger:1},{fret:3,finger:3},{fret:0}],
    "D_Sus4": [{fret:'x'},{fret:'x'},{fret:0},{fret:2,finger:1},{fret:3,finger:2},{fret:3,finger:3}],
    "E_Min": [{fret:0},{fret:2,finger:2},{fret:2,finger:3},{fret:0},{fret:0},{fret:0}],
    "E_Maj": [{fret:0},{fret:2,finger:2},{fret:2,finger:3},{fret:1,finger:1},{fret:0},{fret:0}],
    "E_Sus4": [{fret:0},{fret:2,finger:2},{fret:2,finger:3},{fret:2,finger:4},{fret:0},{fret:0}],
    "G_Maj": [{fret:3,finger:2},{fret:2,finger:1},{fret:0},{fret:0},{fret:0},{fret:3,finger:3}]
};

// Akorların varyasyonlarını klavye üzerinde dinamik olarak çizen fonksiyon
window.generateVariations = function(rootIdx, type) {
    let vars = []; 
    let chordKey = `${window.notes[rootIdx]}_${type}`;
    if (window.openChords[chordKey]) vars.push(window.openChords[chordKey]);

    const eRoot = (rootIdx - 4 + 12) % 12; const aRoot = (rootIdx - 9 + 12) % 12; const dRoot = (rootIdx - 2 + 12) % 12; 
    const addShape = (shape) => { let clean = shape.map(s => (s.fret === 0) ? {fret: 0, finger: null} : s); vars.push(clean); };

    const buildE = (r) => {
        if (type === "Min") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r, finger:1}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Maj") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r+1, finger:2}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Dom7") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r+1, finger:2}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Min7") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r, finger:1}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Maj7") return [{fret:r, finger:1}, {fret:'x'}, {fret:r+1, finger:2}, {fret:r+1, finger:3}, {fret:r, finger:1}, {fret:'x'}];
        if (type === "Sus4") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r+2, finger:2}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Sus2") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+4, finger:4}, {fret:'x'}, {fret:'x'}, {fret:'x'}];
        if (type === "Dim") return [{fret:r, finger:2}, {fret:'x'}, {fret:r+2, finger:4}, {fret:r+1, finger:3}, {fret:'x'}, {fret:'x'}];
        if (type === "Min7b5") return [{fret:r, finger:2}, {fret:'x'}, {fret:r, finger:3}, {fret:r, finger:4}, {fret:r-1, finger:1}, {fret:'x'}];
        if (type === "Aug") return [{fret:r, finger:1}, {fret:'x'}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r+1, finger:2}, {fret:'x'}];
        if (type === "Maj9") { if(r-1 >= 0) return [{fret:r, finger:2}, {fret:'x'}, {fret:r+1, finger:3}, {fret:r+1, finger:4}, {fret:r-1, finger:1}, {fret:'x'}]; return null; }
        if (type === "Min9") return [{fret:r, finger:2}, {fret:'x'}, {fret:r, finger:3}, {fret:r, finger:4}, {fret:r+2, finger:4}, {fret:'x'}];
        if (type === "5") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:'x'}, {fret:'x'}, {fret:'x'}];
        if (type === "mMaj7") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r, finger:1}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Add9") return [{fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+2, finger:3}, {fret:r+1, finger:1}, {fret:r, finger:1}, {fret:r+2, finger:4}];
        if (type === "mAdd9") return [{fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+4, finger:4}, {fret:r, finger:1}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "6") return [{fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+2, finger:3}, {fret:r+1, finger:1}, {fret:r+2, finger:4}, {fret:r, finger:1}];
        if (type === "m6") return [{fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r+2, finger:4}, {fret:r, finger:1}];
        if (type === "7b9") return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r+1, finger:2}, {fret:r, finger:1}, {fret:r+1, finger:4}];
        if (type === "7#9") { if(r >= 0) return [{fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r+1, finger:2}, {fret:r+3, finger:4}, {fret:'x'}]; return null; }
        return null;
    };

    const buildA = (r) => {
        if (type === "Min") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r+1, finger:2}, {fret:r, finger:1}];
        if (type === "Maj") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r, finger:1}];
        if (type === "Dom7") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r+2, finger:4}, {fret:r, finger:1}];
        if (type === "Min7") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r, finger:1}, {fret:r+1, finger:2}, {fret:r, finger:1}];
        if (type === "Maj7") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r+2, finger:4}, {fret:r, finger:1}];
        if (type === "Sus4") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+2, finger:3}, {fret:r+3, finger:4}, {fret:r, finger:1}];
        if (type === "Sus2") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r, finger:1}, {fret:r, finger:1}];
        if (type === "Dim") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+1, finger:2}, {fret:r+2, finger:4}, {fret:r+1, finger:3}, {fret:'x'}];
        if (type === "Min7b5") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+1, finger:2}, {fret:r, finger:1}, {fret:r+1, finger:3}, {fret:'x'}];
        if (type === "Aug") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r+2, finger:4}, {fret:'x'}];
        if (type === "Maj9") { if(r-1 >= 0) return [{fret:'x'}, {fret:r, finger:2}, {fret:r-1, finger:1}, {fret:r+1, finger:4}, {fret:r, finger:3}, {fret:'x'}]; return null;}
        if (type === "Min9") { if(r-2 >= 0) return [{fret:'x'}, {fret:r, finger:3}, {fret:r-2, finger:1}, {fret:r, finger:3}, {fret:r, finger:3}, {fret:'x'}]; return null;}
        if (type === "5") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:'x'}, {fret:'x'}];
        if (type === "mMaj7") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r+1, finger:2}, {fret:r, finger:1}];
        if (type === "Add9") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+4, finger:4}, {fret:r+2, finger:3}, {fret:r, finger:1}];
        if (type === "mAdd9") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+4, finger:4}, {fret:r+1, finger:1}, {fret:r, finger:1}];
        if (type === "6") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+2, finger:3}, {fret:r+2, finger:4}, {fret:r+2, finger:4}];
        if (type === "m6") return [{fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r+2, finger:4}, {fret:r, finger:1}];
        if (type === "7b9") { if(r-1 >= 0) return [{fret:'x'}, {fret:r, finger:2}, {fret:r-1, finger:1}, {fret:r+1, finger:3}, {fret:r-1, finger:1}, {fret:'x'}]; return null; }
        if (type === "7#9") { if(r-1 >= 0) return [{fret:'x'}, {fret:r, finger:2}, {fret:r-1, finger:1}, {fret:r+1, finger:3}, {fret:r+2, finger:4}, {fret:'x'}]; return null; }
        return null;
    };

    const buildD = (r) => {
        if (type === "Min") return [{fret:'x'}, {fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+3, finger:4}, {fret:r+1, finger:2}];
        if (type === "Maj") return [{fret:'x'}, {fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:2}, {fret:r+3, finger:4}, {fret:r+2, finger:3}];
        if (type === "Dom7") return [{fret:'x'}, {fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+1, finger:2}, {fret:r+2, finger:4}];
        if (type === "5") return [{fret:'x'}, {fret:'x'}, {fret:r, finger:1}, {fret:r+2, finger:3}, {fret:r+3, finger:4}, {fret:'x'}];
        return null;
    };

    const buildC = (r) => {
        if (r < 3) return null;
        if (type === "Maj") return [{fret:'x'}, {fret:r, finger:4}, {fret:r-1, finger:3}, {fret:Math.max(r-3, 0), finger:1}, {fret:Math.max(r-2, 0), finger:2}, {fret:Math.max(r-3, 0), finger:1}];
        if (type === "Min") return [{fret:'x'}, {fret:r, finger:4}, {fret:Math.max(r-3, 0), finger:1}, {fret:Math.max(r-3, 0), finger:1}, {fret:Math.max(r-2, 0), finger:2}, {fret:Math.max(r-3, 0), finger:1}];
        return null;
    };

    const buildG = (r) => {
        if (r < 3) return null;
        if (type === "Maj") return [{fret:r, finger:4}, {fret:r-1, finger:3}, {fret:Math.max(r-3, 0), finger:1}, {fret:Math.max(r-3, 0), finger:1}, {fret:Math.max(r-3, 0), finger:1}, {fret:r, finger:4}];
        return null;
    };

    if (eRoot > 0) { let s = buildE(eRoot); if(s) addShape(s); }
    if (aRoot > 0) { let s = buildA(aRoot); if(s) addShape(s); }
    if (dRoot > 0) { let s = buildD(dRoot); if(s) addShape(s); }
    if (aRoot >= 3) { let s = buildC(aRoot); if(s) addShape(s); }
    if (eRoot >= 3) { let s = buildG(eRoot); if(s) addShape(s); }

    let eHigh = eRoot === 0 ? 12 : eRoot + 12; if (eHigh <= 15) { let s = buildE(eHigh); if(s) addShape(s); }
    let aHigh = aRoot === 0 ? 12 : aRoot + 12; if (aHigh <= 15) { let s = buildA(aHigh); if(s) addShape(s); }
    let dHigh = dRoot === 0 ? 12 : dRoot + 12; if (dHigh <= 15) { let s = buildD(dHigh); if(s) addShape(s); }

    if(aRoot === 0) { let s = buildC(12); if(s) addShape(s); }
    if(eRoot === 0) { let s = buildG(12); if(s) addShape(s); }

    let r3 = (rootIdx - 7 + 12) % 12; let r2 = (rootIdx - 11 + 12) % 12; let r1 = (rootIdx - 4 + 12) % 12; 

    if (type === "Min") {
        addShape([{fret:'x'},{fret:'x'},{fret:'x'}, {fret:r3===0?12:r3, finger:3}, {fret:(r3+11)%12===0?12:(r3+11)%12, finger:2}, {fret:(r3+9)%12===0?12:(r3+9)%12, finger:1}]);
        let f1 = r1===0?12:r1; addShape([{fret:'x'},{fret:'x'},{fret:'x'}, {fret:f1, finger:1}, {fret:f1, finger:1}, {fret:f1, finger:1}]);
        let f2 = r2===0?12:r2; addShape([{fret:'x'},{fret:'x'},{fret:'x'}, {fret:f2-1, finger:2}, {fret:f2, finger:3}, {fret:f2-2, finger:1}]);
    }
    if (type === "Maj") {
        addShape([{fret:'x'},{fret:'x'},{fret:'x'}, {fret:r3===0?12:r3, finger:2}, {fret:(r3+11)%12===0?12:(r3+11)%12, finger:1}, {fret:(r3+9)%12===0?12:(r3+9)%12, finger:1}]);
        let f1 = r1===0?12:r1; addShape([{fret:'x'},{fret:'x'},{fret:'x'}, {fret:f1+1, finger:2}, {fret:f1, finger:1}, {fret:f1, finger:1}]);
        let f2 = r2===0?12:r2; addShape([{fret:'x'},{fret:'x'},{fret:'x'}, {fret:f2-1, finger:1}, {fret:f2, finger:2}, {fret:f2-1, finger:1}]);
    }

    const uniqueVars = []; const seen = new Set();
    vars.vars = vars;
    vars.forEach(v => { 
        let isValid = true;
        v.forEach(s => { if(s.fret !== 'x' && s.fret < 0) isValid = false; });
        if (isValid) {
            let hasNode = v.some(s => s.fret !== 'x');
            const str = JSON.stringify(v); 
            if (hasNode && !seen.has(str)) { seen.add(str); uniqueVars.push(v); }
        }
    });
    
    if (uniqueVars.length === 0) {
        let safeE = eRoot === 0 ? 12 : eRoot;
        uniqueVars.push([{fret:safeE, finger:1}, {fret:'x'}, {fret:'x'}, {fret:'x'}, {fret:'x'}, {fret:'x'}]);
    }

    return uniqueVars.sort((a,b) => {
        let minA = 99; a.forEach(s => { if(s.fret !== 'x' && s.fret > 0) minA = Math.min(minA, s.fret); });
        let minB = 99; b.forEach(s => { if(s.fret !== 'x' && s.fret > 0) minB = Math.min(minB, s.fret); });
        return (minA===99?0:minA) - (minB===99?0:minB);
    });
};