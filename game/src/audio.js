// audio.js — every sound is synthesized with WebAudio: engine hum, sirens, gunshots,
// crashes, pickups, UI clicks, and a moody bassline loop. No audio files. M toggles mute.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenTimer = 0;
    this.station = 0;
    // Car radio: three stations, each its own loop.
    // SOL 87.9 — moody A-minor bass; NIGHT JAZZ 101 — laid-back swing;
    // STREET ROCK 96 — driving power chords.
    this.stations = [
      { name: 'SOL 87.9', wave: 'triangle', step: 0.24, vol: 0.09,
        line: [55, 0, 55, 65.41, 0, 55, 49, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41, 55] },
      { name: 'NIGHT JAZZ 101', wave: 'sine', step: 0.30, vol: 0.08,
        line: [110, 130.81, 0, 98, 0, 110, 123.47, 0, 98, 0, 87.31, 0, 110, 0, 130.81, 146.83] },
      { name: 'STREET ROCK 96', wave: 'sawtooth', step: 0.16, vol: 0.05,
        line: [82.41, 82.41, 0, 98, 110, 0, 82.41, 98, 110, 0, 123.47, 110, 98, 0, 82.41, 0] },
    ];
  }
  setStation(i) {
    this.station = ((i % this.stations.length) + this.stations.length) % this.stations.length;
    this.musicStep = 0;
    return this.stations[this.station].name;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  shot() { this.noise(0.12, 0.3, 2400); this.tone(180, 0.08, 'square', 0.12, 60); }
  shotFar() { this.noise(0.1, 0.1, 1600); }
  crash(v) { this.noise(0.25, Math.min(0.4, 0.1 + v * 0.001), 700); this.tone(70, 0.2, 'sawtooth', 0.15, 40); }
  thud() { this.tone(90, 0.16, 'sine', 0.3, 45); }
  explosion() { this.noise(0.7, 0.5, 500); this.tone(55, 0.6, 'sawtooth', 0.3, 28); }
  pickup() { this.tone(880, 0.09, 'sine', 0.18); setTimeout(() => this.tone(1320, 0.12, 'sine', 0.18), 70); }
  click() { this.tone(660, 0.05, 'square', 0.08); }
  // footstep: a quiet low tick, called once per half walk cycle on foot
  step() { this.noise(0.05, 0.05, 500); }
  missionStart() { this.tone(440, 0.12, 'triangle', 0.2); setTimeout(() => this.tone(660, 0.16, 'triangle', 0.2), 110); }
  missionComplete() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 110));
  }
  horn() { this.tone(370, 0.18, 'sawtooth', 0.12); this.tone(466, 0.18, 'sawtooth', 0.1); }
  busted() { this.tone(392, 0.3, 'sawtooth', 0.2, 196); setTimeout(() => this.tone(311, 0.5, 'sawtooth', 0.2, 155), 260); }
  // two-tone police siren, called every frame while police are near
  siren(dt, on) {
    if (!this.ctx || this.muted) return;
    this.sirenTimer -= dt;
    if (!on) return;
    if (this.sirenTimer <= 0) {
      this.sirenTimer = 0.42;
      this.sirenHigh = !this.sirenHigh;
      this.tone(this.sirenHigh ? 780 : 590, 0.4, 'triangle', 0.045);
    }
  }
  // engine hum follows the player's car speed
  engine(speed01) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
  }
  // ambient world sound, called every frame: ocean surf near the beach,
  // crickets after dark. Subtle — it sells the 3D world as a place.
  ambience(dt, dark, nearWater, nearCoaster) {
    if (!this.ctx || this.muted) return;
    this.ambTimer = (this.ambTimer || 0) - dt;
    if (this.ambTimer > 0) return;
    if (nearCoaster) {
      // rollercoaster whoosh: a soft filtered wind rush every ~4s
      this.ambTimer = 4;
      this.noise(0.9, 0.04, 900);
    } else if (nearWater) {
      // a slow wave wash every ~3.5s
      this.ambTimer = 3.5;
      this.noise(1.1, 0.05, 420);
    } else if (dark > 0.4) {
      // a cricket chirp every ~1.8s at night
      this.ambTimer = 1.8;
      this.tone(4200, 0.05, 'sine', 0.015);
      setTimeout(() => this.tone(4400, 0.04, 'sine', 0.012), 90);
    } else {
      this.ambTimer = 2.5; // day: quiet city air
    }
  }
  // radio music loop, stepped by the game clock; station set by setStation()
  music(dt, playing) {
    if (!this.ctx || this.muted || !playing) return;
    const st = this.stations[this.station];
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = st.step;
    const n = st.line[this.musicStep % st.line.length];
    this.musicStep++;
    if (n > 0) this.tone(n, st.step * 0.9, st.wave, st.vol);
    if (this.musicStep % 4 === 2) this.noise(0.03, 0.03, 6000);
    if (this.musicStep % 16 === 0) this.tone(n * 2, 0.5, 'sine', 0.04);
  }
}
