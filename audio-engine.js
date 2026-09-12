"use strict";

// -------------------------------------------------------------
// SES MOTORU VE SENTEZLEYİCİ (AUDIO ENGINE)
// Bu dosya sadece ses üretmekle sorumludur.
// -------------------------------------------------------------

window.AudioContext = window.AudioContext || window.webkitAudioContext;
window.audioCtx = null;
window.masterCompressor = null;
window.masterAnalyser = null;
window.distCurve = null;

window.initAudio = function() {
    if (!window.audioCtx) {
        window.audioCtx = new window.AudioContext({ latencyHint: 'interactive' });
        
        // Ana Sıkıştırıcı (Patlamaları Önler)
        window.masterCompressor = window.audioCtx.createDynamicsCompressor();
        window.masterCompressor.threshold.value = -3;
        window.masterCompressor.knee.value = 10;
        window.masterCompressor.ratio.value = 12;
        window.masterCompressor.attack.value = 0.003;
        window.masterCompressor.release.value = 0.05;
        
        // Görsel Analizör (VU Meter için)
        window.masterAnalyser = window.audioCtx.createAnalyser();
        window.masterAnalyser.fftSize = 512;
        
        window.masterCompressor.connect(window.masterAnalyser);
        window.masterAnalyser.connect(window.audioCtx.destination);
    }
    if (window.audioCtx.state === 'suspended') {
        window.audioCtx.resume();
    }
};

window.makeDistortionCurve = function(amount) {
    let k = typeof amount === 'number' ? amount : 50; let n_samples = 44100; let curve = new Float32Array(n_samples); let deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i ) { let x = i * 2 / n_samples - 1; curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x)); } return curve;
};

window.playString = function(frequency, delay, duration = 2.5, instType = 'acoustic', chordVol = 0.7) {
    window.initAudio();
    const sampleRate = window.audioCtx.sampleRate; 
    const length = Math.floor(sampleRate * duration); 
    const buffer = window.audioCtx.createBuffer(1, length, sampleRate); 
    const data = buffer.getChannelData(0);
    const N = Math.round(sampleRate / frequency); 
    const delayLine = new Float32Array(N); 

    for (let i = 0; i < N; i++) {
        let noise = (Math.random() * 2 - 1);
        if (instType === 'classical') { noise = noise * Math.sin(Math.PI * i / N); } 
        else if (instType === 'acoustic') { noise = noise * Math.pow(Math.sin(Math.PI * i / N), 0.5); } 
        delayLine[i] = noise;
    }

    let damping = 0.995; let stretch = 0.5; 
    if (instType === 'classical') { damping = 0.985; stretch = 0.2; } 
    if (instType === 'electric') { damping = 0.998; stretch = 0.5; } 
    
    let p = 0; let lastVal = 0;
    for (let i = 0; i < length; i++) {
        data[i] = delayLine[p]; 
        const nextP = (p + 1) % N; 
        let avg = (delayLine[p] * stretch) + (delayLine[nextP] * (1 - stretch));
        if (instType === 'classical' || instType === 'acoustic') { avg = (avg * 0.7) + (lastVal * 0.3); } 
        lastVal = avg; delayLine[p] = avg * damping; p = nextP;
    }

    const source = window.audioCtx.createBufferSource(); 
    source.buffer = buffer;
    
    const finalOut = window.audioCtx.createGain(); 
    
    // Sinyali doğrudan Pedalboard girişine yönlendir
    if (!window.pedalInput) window.initPedalboard();
    if (window.pedalInput) {
        finalOut.connect(window.pedalInput);
    } else {
        finalOut.connect(window.masterCompressor);
        if(typeof window.mixDestNode !== 'undefined' && window.mixDestNode) { finalOut.connect(window.mixDestNode); }
    }
    let targetNode = finalOut;
    
    const gainNode = window.audioCtx.createGain(); 
    const safeVol = Math.max(chordVol, 0.001);
    gainNode.gain.setValueAtTime(safeVol, window.audioCtx.currentTime + delay); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, window.audioCtx.currentTime + delay + duration);
    
    let nodesToDisconnect = [source, gainNode];

    if (instType === 'electric') {
        if(!window.distCurve) window.distCurve = window.makeDistortionCurve(800); 
        const waveShaper = window.audioCtx.createWaveShaper(); waveShaper.curve = window.distCurve; waveShaper.oversample = '4x';
        const cabFilter1 = window.audioCtx.createBiquadFilter(); cabFilter1.type = "lowpass"; cabFilter1.frequency.value = 3500; 
        const cabFilter2 = window.audioCtx.createBiquadFilter(); cabFilter2.type = "highpass"; cabFilter2.frequency.value = 120; 
        const distGain = window.audioCtx.createGain(); distGain.gain.value = 0.6; 
        source.connect(gainNode).connect(cabFilter2).connect(waveShaper).connect(cabFilter1).connect(distGain).connect(targetNode);
        nodesToDisconnect.push(cabFilter2, waveShaper, cabFilter1, distGain);
    } else if (instType === 'acoustic') {
        const bodyResonance = window.audioCtx.createBiquadFilter(); bodyResonance.type = 'peaking'; bodyResonance.frequency.value = 180; bodyResonance.Q.value = 1.5; bodyResonance.gain.value = 4;
        const stringEQ = window.audioCtx.createBiquadFilter(); stringEQ.type = 'highshelf'; stringEQ.frequency.value = 3000; stringEQ.gain.value = 2; 
        source.connect(gainNode).connect(bodyResonance).connect(stringEQ).connect(targetNode);
        nodesToDisconnect.push(bodyResonance, stringEQ);
    } else if (instType === 'classical') {
        const warmFilter = window.audioCtx.createBiquadFilter(); warmFilter.type = 'lowpass'; warmFilter.frequency.value = 1500; 
        const bodyResonance = window.audioCtx.createBiquadFilter(); bodyResonance.type = 'peaking'; bodyResonance.frequency.value = 120; bodyResonance.gain.value = 5;
        source.connect(gainNode).connect(bodyResonance).connect(warmFilter).connect(targetNode);
        nodesToDisconnect.push(warmFilter, bodyResonance);
    } else { 
        source.connect(gainNode).connect(targetNode); 
    }
    
    source.onended = () => { nodesToDisconnect.forEach(n => { try { n.disconnect(); } catch(e){} }); };
    source.start(window.audioCtx.currentTime + delay); 
    return source;
};

window.playKick = function(time, vol = 0.5) {
    const osc = window.audioCtx.createOscillator(); const gain = window.audioCtx.createGain();
    osc.connect(gain); gain.connect(window.masterCompressor);
    osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
    gain.gain.setValueAtTime(vol, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.start(time); osc.stop(time + 0.5);
};

window.playSnare = function(time, vol = 0.5) {
    const bufferSize = window.audioCtx.sampleRate * 0.2; const buffer = window.audioCtx.createBuffer(1, bufferSize, window.audioCtx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = window.audioCtx.createBufferSource(); noise.buffer = buffer; const noiseFilter = window.audioCtx.createBiquadFilter(); noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
    const noiseGain = window.audioCtx.createGain(); noiseGain.gain.setValueAtTime(vol * 0.8, time); noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noise.connect(noiseFilter).connect(noiseGain).connect(window.masterCompressor); noise.start(time);
    
    const osc = window.audioCtx.createOscillator(); osc.type = 'triangle';
    const oscGain = window.audioCtx.createGain(); oscGain.gain.setValueAtTime(vol * 0.5, time); oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.frequency.setValueAtTime(250, time); osc.connect(oscGain).connect(window.masterCompressor);
    osc.start(time); osc.stop(time + 0.2);
};

window.playHiHat = function(time, vol = 0.5) {
    const bufferSize = window.audioCtx.sampleRate * 0.05; const buffer = window.audioCtx.createBuffer(1, bufferSize, window.audioCtx.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = window.audioCtx.createBufferSource(); noise.buffer = buffer; const noiseFilter = window.audioCtx.createBiquadFilter(); noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 7000;
    const noiseGain = window.audioCtx.createGain(); noiseGain.gain.setValueAtTime(vol * 0.5, time); noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noise.connect(noiseFilter).connect(noiseGain).connect(window.masterCompressor); noise.start(time);
};

// Orjinal Metronom Ses Sentezleyicisi (Geri Geldi)
window.playClick = function(time, stepNum, vol = 0.5) {
    const osc = window.audioCtx.createOscillator(); 
    const gainNode = window.audioCtx.createGain();
    // Ölçü başı 1000Hz (TİK), diğer vuruşlar 700Hz (tak)
    osc.frequency.value = (stepNum === 0) ? 1000 : 700;
    gainNode.gain.setValueAtTime(vol, time); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(gainNode); 
    gainNode.connect(window.masterCompressor); 
    osc.start(time); 
    osc.stop(time + 0.1);
};

window.audioBufferToWav = function(buffer) {
    let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44, bufferWav = new ArrayBuffer(length), view = new DataView(bufferWav), channels = [], i, sample, offset = 0, pos = 0;
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; } function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for(i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while(pos < length) { for(i = 0; i < numOfChan; i++) { sample = Math.max(-1, Math.min(1, channels[i][offset])); sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; view.setInt16(pos, sample, true); pos += 2; } offset++; }
    return new Blob([bufferWav], {type: "audio/wav"});
};

window.autoCorrelate = function(buf, sampleRate) {
    let SIZE = buf.length; let rms = 0; for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]; rms = Math.sqrt(rms / SIZE); if (rms < 0.01) return -1; 
    let r1 = 0, r2 = SIZE - 1, thres = 0.2; for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; } for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    buf = buf.subarray(r1, r2); SIZE = buf.length; let c = new Float32Array(SIZE); for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];
    let d = 0; while (c[d] > c[d + 1]) d++; let maxval = -1, maxpos = -1; for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
    let T0 = maxpos; let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]; let a = (x1 + x3 - 2 * x2) / 2; let b = (x3 - x1) / 2; if (a) T0 = T0 - b / (2 * a); return sampleRate / T0;
};

// -------------------------------------------------------------
// YENİ: SANAL PEDALBOARD (EFEKT ZİNCİRİ) MİMARİSİ
// -------------------------------------------------------------
window.initPedalboard = function() {
    if (!window.audioCtx) window.initAudio();
    if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
    if (window.pedalInput) return; // Zaten kuruluysa atla
    
    // Giriş ve Çıkış Jakları
    window.pedalInput = window.audioCtx.createGain();
    window.pedalOutput = window.audioCtx.createGain();
    
    // --- 1. OVERDRIVE PEDALI ---
    window.odNode = window.audioCtx.createWaveShaper();
    if(!window.distCurve) window.distCurve = window.makeDistortionCurve(400);
    window.odNode.curve = window.distCurve;
    window.odNode.oversample = '4x';
    window.odWetGain = window.audioCtx.createGain(); window.odWetGain.gain.value = 0; // Kapalı
    window.odDryGain = window.audioCtx.createGain(); window.odDryGain.gain.value = 1; // Açık
    
    window.pedalInput.connect(window.odNode);
    window.pedalInput.connect(window.odDryGain);
    window.odNode.connect(window.odWetGain);
    
    const odSum = window.audioCtx.createGain();
    window.odDryGain.connect(odSum);
    window.odWetGain.connect(odSum);
    
    // --- 2. CHORUS PEDALI ---
    window.chorusDelay = window.audioCtx.createDelay();
    window.chorusDelay.delayTime.value = 0.03; // 30ms
    window.chorusLFO = window.audioCtx.createOscillator();
    window.chorusLFO.type = 'sine';
    window.chorusLFO.frequency.value = 1.5; // Dalgalanma hızı
    window.chorusDepth = window.audioCtx.createGain();
    window.chorusDepth.gain.value = 0.002;
    window.chorusLFO.connect(window.chorusDepth);
    window.chorusDepth.connect(window.chorusDelay.delayTime);
    window.chorusLFO.start();
    
    window.chorusWetGain = window.audioCtx.createGain(); window.chorusWetGain.gain.value = 0;
    window.chorusDryGain = window.audioCtx.createGain(); window.chorusDryGain.gain.value = 1;
    
    odSum.connect(window.chorusDelay);
    odSum.connect(window.chorusDryGain);
    window.chorusDelay.connect(window.chorusWetGain);
    
    const chorusSum = window.audioCtx.createGain();
    window.chorusDryGain.connect(chorusSum);
    window.chorusWetGain.connect(chorusSum);
    
    // --- 3. DELAY PEDALI ---
    window.delayNode = window.audioCtx.createDelay(2.0);
    window.delayNode.delayTime.value = 0.4; // 400ms tekrar hızı
    window.delayFeedback = window.audioCtx.createGain();
    window.delayFeedback.gain.value = 0.4; // Tekrar sönümlenme
    window.delayNode.connect(window.delayFeedback);
    window.delayFeedback.connect(window.delayNode);
    
    window.delayWetGain = window.audioCtx.createGain(); window.delayWetGain.gain.value = 0;
    window.delayDryGain = window.audioCtx.createGain(); window.delayDryGain.gain.value = 1;
    
    chorusSum.connect(window.delayNode);
    chorusSum.connect(window.delayDryGain);
    window.delayNode.connect(window.delayWetGain);
    
    const delaySum = window.audioCtx.createGain();
    window.delayDryGain.connect(delaySum);
    window.delayWetGain.connect(delaySum);
    
    // --- ÇIKIŞ YÖNLENDİRMESİ ---
    delaySum.connect(window.pedalOutput);
    window.pedalOutput.connect(window.masterCompressor); // Genel çıkışa ver
    if (typeof window.mixDestNode !== 'undefined' && window.mixDestNode) {
        window.pedalOutput.connect(window.mixDestNode); // DAW Stüdyosuna ver
    }
};

window.updatePedals = function() {
    if (!window.audioCtx) window.initAudio();
    if (!window.pedalInput) window.initPedalboard();
    
    const odOn = document.getElementById('pedal-overdrive')?.checked;
    const chOn = document.getElementById('pedal-chorus')?.checked;
    const dlOn = document.getElementById('pedal-delay')?.checked;
    
    const t = window.audioCtx.currentTime;
    
    // Patlama (Pop/Click) seslerini önlemek için geçişleri 0.05 saniyeye (50ms) yaydık
    window.odWetGain.gain.setTargetAtTime(odOn ? 0.6 : 0, t, 0.05);
    window.odDryGain.gain.setTargetAtTime(odOn ? 0 : 1, t, 0.05);
    
    window.chorusWetGain.gain.setTargetAtTime(chOn ? 0.7 : 0, t, 0.05);
    window.chorusDryGain.gain.setTargetAtTime(chOn ? 0.7 : 1, t, 0.05);
    
    window.delayWetGain.gain.setTargetAtTime(dlOn ? 0.5 : 0, t, 0.05);
    window.delayDryGain.gain.setTargetAtTime(1, t, 0.05); // Delay daima kuru sese eklenir
};