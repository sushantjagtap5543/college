/**
 * GeoSurePath — Notification Tone Engine
 * Generates 20 distinct tones using Web Audio API (no external files needed).
 * Tones are persisted via localStorage key: geosurepath_alert_tone
 */

const AudioContext = window.AudioContext || window.webkitAudioContext;

// 20 distinct tone definitions: [frequency pattern, waveType, label]
export const TONES = [
    { id: 1, label: 'Alert Classic', notes: [880, 1100], wave: 'sine', dur: 0.18 },
    { id: 2, label: 'Ping', notes: [1400], wave: 'sine', dur: 0.25 },
    { id: 3, label: 'Double Beep', notes: [800, 800], wave: 'square', dur: 0.12 },
    { id: 4, label: 'Rising Tone', notes: [440, 660, 880], wave: 'sine', dur: 0.14 },
    { id: 5, label: 'Falling Tone', notes: [880, 660, 440], wave: 'sine', dur: 0.14 },
    { id: 6, label: 'Chime', notes: [523, 659, 784], wave: 'triangle', dur: 0.2 },
    { id: 7, label: 'Warning Bell', notes: [700, 900, 700], wave: 'sine', dur: 0.15 },
    { id: 8, label: 'SOS Urgent', notes: [1200, 600, 1200], wave: 'square', dur: 0.1 },
    { id: 9, label: 'Soft Pulse', notes: [550], wave: 'sine', dur: 0.35 },
    { id: 10, label: 'Notification Pop', notes: [1000, 1200], wave: 'sine', dur: 0.12 },
    { id: 11, label: 'Doorbell', notes: [880, 784], wave: 'triangle', dur: 0.25 },
    { id: 12, label: 'Radar Blip', notes: [1000], wave: 'sawtooth', dur: 0.1 },
    { id: 13, label: 'Triple Blip', notes: [800, 800, 800], wave: 'square', dur: 0.08 },
    { id: 14, label: 'Ascending Scale', notes: [262, 330, 392, 523], wave: 'sine', dur: 0.12 },
    { id: 15, label: 'Deep Alert', notes: [300, 400], wave: 'sawtooth', dur: 0.2 },
    { id: 16, label: 'High Tone', notes: [1760], wave: 'sine', dur: 0.2 },
    { id: 17, label: 'Office Ding', notes: [783, 698], wave: 'triangle', dur: 0.22 },
    { id: 18, label: 'Alarm Burst', notes: [950, 950, 950, 950], wave: 'square', dur: 0.07 },
    { id: 19, label: 'Soft Chime', notes: [440, 550, 660, 770], wave: 'triangle', dur: 0.18 },
    { id: 20, label: 'Power Alert', notes: [660, 880, 1100, 880], wave: 'sawtooth', dur: 0.13 },
];

let _ctx = null;
function getCtx() {
    if (!_ctx || _ctx.state === 'closed') {
        try { _ctx = new AudioContext(); } catch (e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
}

/**
 * Play a single sequence of notes.
 */
function playSequence(tone, gainVal = 0.4) {
    const ctx = getCtx();
    if (!ctx) return;
    let t = ctx.currentTime + 0.02;
    tone.notes.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tone.wave;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(gainVal, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + tone.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + tone.dur + 0.01);
        t += tone.dur + 0.04;
    });
}

/**
 * Get the saved tone preference.
 */
export function getSavedToneId() {
    const saved = parseInt(localStorage.getItem('geosurepath_alert_tone') || '1', 10);
    return TONES.find(t => t.id === saved) ? saved : 1;
}

export function setSavedToneId(id) {
    localStorage.setItem('geosurepath_alert_tone', String(id));
}

function getTone(id) {
    return TONES.find(t => t.id === id) || TONES[0];
}

/**
 * Play normal notification — rings ONCE
 */
export function playNormalAlert(toneId) {
    const tone = getTone(toneId || getSavedToneId());
    playSequence(tone, 0.35);
}

/**
 * Play serious alert — rings TWICE with a short gap
 */
export function playSeriousAlert(toneId) {
    const tone = getTone(toneId || getSavedToneId());
    playSequence(tone, 0.55);
    const delay = tone.notes.length * (tone.dur + 0.04) * 1000 + 300;
    setTimeout(() => playSequence(tone, 0.55), delay);
}

/**
 * Preview a tone in Settings
 */
export function previewTone(toneId) {
    playNormalAlert(toneId);
}
