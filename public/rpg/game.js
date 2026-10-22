'use strict'
/* ══════════════════════════════ AUDIO ══════════════════════════════
   Every sound the game makes goes through Sound.sfx(name) or
   Sound.music(name), and every name is in one of the two tables below.
   Each entry has a synthesised placeholder so the hooks are audible now;
   set `file` to a recording's URL and that is used instead, with no other
   change. The placeholders are original - nothing here is lifted from a
   game soundtrack. */

const NOTE = (n) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n)
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * Math.pow(2, (12 * (+m[3] + 1) + semi - 69) / 12)
}
function noiseBuf(ac) {
  if (ac.__noise) return ac.__noise
  const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return (ac.__noise = b)
}
function tone(ac, out, t, { type = 'square', f, f1, dur = 0.1, vol = 0.2, attack = 0.004 }) {
  if (t < 0) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03)
}
function noise(ac, out, t, { dur = 0.1, vol = 0.2, filter = 'lowpass', f = 2000, f1, q = 1 }) {
  if (t < 0) return
  const s = ac.createBufferSource(); s.buffer = noiseBuf(ac)
  const fl = ac.createBiquadFilter(); fl.type = filter; fl.Q.value = q
  fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03)
}
const arp = (ac, o, t, notes, step, vol = 0.12) => notes.forEach((n, i) => tone(ac, o, t + i * step, { f: NOTE(n), dur: step * 1.6, vol }))
const hitSynth = (ac, o, t, k = 1) => { noise(ac, o, t, { dur: .12 * k, vol: .45 * k, f: 1800 }); tone(ac, o, t, { f: 260, f1: 70, dur: .12 * k, vol: .25 }) }

const SFX = {
  move:     { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 880, dur: .05, vol: .1 }) },
  select:   { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 660, dur: .06, vol: .12 }); tone(ac, o, t + .06, { f: 1320, dur: .09, vol: .12 }) } },
  advance:  { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 990, dur: .04, vol: .07 }) },
  ball:     { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .28, vol: .18, filter: 'bandpass', f: 600, f1: 2600, q: 2 }); tone(ac, o, t + .3, { f: 320, f1: 960, dur: .12, vol: .16 }); noise(ac, o, t + .3, { dur: .05, vol: .3, filter: 'highpass', f: 4000 }) } },
  zap:      { file: null, synth: (ac, o, t) => { for (let i = 0; i < 9; i++) tone(ac, o, t + i * .05, { type: 'sawtooth', f: 700 + Math.random() * 1600, dur: .05, vol: .09 }); noise(ac, o, t, { dur: .45, vol: .12, filter: 'highpass', f: 3000 }) } },
  whoosh:   { file: null, synth: (ac, o, t) => noise(ac, o, t, { dur: .22, vol: .25, filter: 'bandpass', f: 600, f1: 3200, q: 1.5 }) },
  clang:    { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'triangle', f: 1240, dur: .32, vol: .22 }); tone(ac, o, t, { f: 1870, dur: .14, vol: .06 }); noise(ac, o, t, { dur: .05, vol: .2, filter: 'highpass', f: 5000 }) } },
  hit:      { file: null, synth: (ac, o, t) => hitSynth(ac, o, t, 1) },
  hitSuper: { file: null, synth: (ac, o, t) => { hitSynth(ac, o, t, 1.4); tone(ac, o, t + .04, { f: 520, f1: 90, dur: .22, vol: .18 }) } },
  hitWeak:  { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .09, vol: .22, f: 800 }); tone(ac, o, t, { f: 180, f1: 80, dur: .08, vol: .1 }) } },
  coin:     { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 1976, dur: .06, vol: .1 }); tone(ac, o, t + .055, { f: 2637, dur: .2, vol: .1 }) } },
  shadow:   { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'sine', f: 240, f1: 110, dur: .5, vol: .3 }); tone(ac, o, t, { type: 'triangle', f: 360, f1: 160, dur: .5, vol: .12 }) } },
  quake:    { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .95, vol: .8, f: 170 }); tone(ac, o, t, { type: 'sine', f: 58, f1: 34, dur: .95, vol: .5 }) } },
  crunch:   { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .08, vol: .5, filter: 'bandpass', f: 900, q: 2 }); noise(ac, o, t + .1, { dur: .1, vol: .5, filter: 'bandpass', f: 700, q: 2 }) } },
  thud:     { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'sine', f: 150, f1: 50, dur: .22, vol: .5 }); noise(ac, o, t, { dur: .15, vol: .35, f: 600 }) } },
  parry:    { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'triangle', f: 1760, dur: .38, vol: .3 }); tone(ac, o, t, { type: 'triangle', f: 2637, dur: .26, vol: .16 }); noise(ac, o, t, { dur: .04, vol: .2, filter: 'highpass', f: 6000 }) } },
  dodge:    { file: null, synth: (ac, o, t) => noise(ac, o, t, { dur: .2, vol: .22, filter: 'bandpass', f: 1200, f1: 4200, q: 1.2 }) },
  jump:     { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 300, f1: 900, dur: .17, vol: .14 }) },
  pp:       { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 1046, f1: 1568, dur: .1, vol: .08 }) },
  perfect:  { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 1319, dur: .08, vol: .12 }); tone(ac, o, t + .07, { f: 1976, dur: .16, vol: .12 }) } },
  counter:  { file: null, synth: (ac, o, t) => { arp(ac, o, t, ['C6', 'E6', 'G6', 'C7'], .045, .1); hitSynth(ac, o, t + .22, 1.3) } },
  flinch:   { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 220, dur: .08, vol: .14 }); tone(ac, o, t + .09, { f: 165, dur: .14, vol: .14 }) } },
  faint:    { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 700, f1: 90, dur: .65, vol: .14 }) },
  levelup:  { file: null, synth: (ac, o, t) => arp(ac, o, t, ['C5', 'E5', 'G5', 'C6', 'E6'], .075, .11) },
  tokens:   { file: null, synth: (ac, o, t) => { for (let i = 0; i < 3; i++) { tone(ac, o, t + i * .09, { f: 1976, dur: .05, vol: .08 }); tone(ac, o, t + i * .09 + .05, { f: 2637, dur: .14, vol: .08 }) } } },
}

/* Songs: one token per step. A note starts, '.' holds it, '-' rests.
   Drums: K kick, S snare, h hat, C crash. */
const SONGS = {
  vs: { file: null, loop: false, bpm: 152, div: 4,
    lead: 'E4 G4 B4 E5 G4 B4 E5 G5 B4 E5 G5 B5 E5 G5 B5 E6 . . . . . . . -'.split(' '),
    bass: 'E2 . . . . . . . E2 . . . . . . . E3 . . . . . . . -'.split(' '),
    drums: 'S.S.S.S.SSSSSSSSC.......' },
  battle: { file: null, loop: true, bpm: 152, div: 2,
    lead: [
      'A4 . C5 E5 D5 C5 B4 C5', 'A4 . . F4 A4 C5 . A4', 'B4 . D5 G5 F5 E5 D5 B4', 'E5 . . D5 C5 B4 G#4 B4',
      'A5 . E5 C5 A4 C5 E5 A5', 'G5 F5 E5 . C5 . A4 C5', 'D5 . B4 D5 G5 . F5 E5', 'E5 D5 C5 B4 G#4 . E4 .',
    ].join(' ').split(' '),
    bass: [
      'A2 A3 A2 A3 A2 A3 A2 A3', 'F2 F3 F2 F3 F2 F3 F2 F3', 'G2 G3 G2 G3 G2 G3 G2 G3', 'E2 E3 E2 E3 E2 E3 E2 E3',
      'A2 A3 A2 A3 A2 A3 A2 A3', 'F2 F3 F2 F3 F2 F3 F2 F3', 'G2 G3 G2 G3 G2 G3 G2 G3', 'E2 E3 E2 E3 G#2 G#3 B2 B3',
    ].join(' ').split(' '),
    drums: 'KhShKKSh'.repeat(7) + 'KhShSSSS' },
  encounter: { file: null, loop: true, bpm: 152, div: 2,
    lead: [ 'E5 - - - G5 - F#5 -', 'E5 - - - B4 - - -', 'C5 - E5 - D5 - F#5 -', 'E5 . . . D#5 . . .' ].join(' ').split(' '),
    bass: [ 'E2 E2 E3 E2 E2 E3 E2 D3', 'E2 E2 E3 E2 E2 E3 G2 A2', 'C3 C3 C4 C3 D3 D3 D4 D3', 'E2 E2 E3 E2 B2 . B2 .' ].join(' ').split(' '),
    drums: 'KhhhShhh'.repeat(3) + 'KhhhSSSS' },
  win: { file: null, loop: true, bpm: 120, div: 2,
    lead: [ 'C5 . E5 G5 . E5 D5 .', 'F5 . A5 . G5 . E5 .', 'D5 . F5 A5 . G5 F5 .', 'E5 . . . G5 . . .' ].join(' ').split(' '),
    bass: [ 'C3 . G3 . C3 . G3 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . D3 .', 'C3 . G3 . C3 . . .' ].join(' ').split(' '),
    drums: 'K.h.S.h.'.repeat(4) },
  victory: { file: null, loop: false, bpm: 140, div: 2,
    lead: 'G4 C5 E5 G5 . E5 G5 . C6 . . . . . . -'.split(' '),
    bass: 'C3 . C3 . E3 . G3 . C3 . . . . . . -'.split(' '),
    drums: 'K.S.K.SSC.......' },
}

function scheduleSong(ac, out, song, t0) {
  const step = 60 / song.bpm / song.div
  const play = (track, fn) => {
    for (let i = 0; i < track.length; i++) {
      const n = track[i]
      if (n === '.' || n === '-') continue
      let len = 1
      while (track[i + len] === '.') len++
      fn(t0 + i * step, n, len * step)
    }
  }
  play(song.lead, (t, n, d) => tone(ac, out, t, { f: NOTE(n), dur: d * 0.95, vol: 0.085 }))
  play(song.bass, (t, n, d) => tone(ac, out, t, { type: 'triangle', f: NOTE(n), dur: d * 0.9, vol: 0.2 }))
  ;[...song.drums].forEach((c, i) => {
    const t = t0 + i * step
    if (c === 'K') tone(ac, out, t, { type: 'sine', f: 150, f1: 45, dur: .14, vol: .5 })
    if (c === 'S') { noise(ac, out, t, { dur: .12, vol: .22, filter: 'bandpass', f: 1800 }); tone(ac, out, t, { type: 'triangle', f: 190, dur: .06, vol: .08 }) }
    if (c === 'h') noise(ac, out, t, { dur: .035, vol: .05, filter: 'highpass', f: 7500 })
    if (c === 'C') noise(ac, out, t, { dur: .9, vol: .14, filter: 'highpass', f: 5000 })
  })
  return song.lead.length * step
}

const Sound = (() => {
  let ac = null, sfxBus, musBus, on = false, current = null, loopTimer = null, musGain = null
  const log = []
  window.__audioLog = log
  const stamp = () => performance.timeOrigin + performance.now()

  function graph(ctx) {
    const master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination)
    const s = ctx.createGain(); s.gain.value = 0.9; s.connect(master)
    const m = ctx.createGain(); m.gain.value = 0.5; m.connect(master)
    return { s, m }
  }
  function ensure() {
    if (!ac) { ac = new AudioContext(); const g = graph(ac); sfxBus = g.s; musBus = g.m; window.__busReady?.(sfxBus, musBus) }
    if (ac.state === 'suspended') ac.resume()
  }
  function startMusic(name) {
    stopNodes()
    const song = SONGS[name]; if (!song || !on) return
    ensure()
    musGain = ac.createGain(); musGain.connect(musBus)
    let next = ac.currentTime + 0.06
    const pass = () => { next += scheduleSong(ac, musGain, song, next) }
    pass()
    if (song.loop) loopTimer = setInterval(() => { if (ac.currentTime > next - 2.5) pass() }, 250)
  }
  function stopNodes() {
    if (loopTimer) { clearInterval(loopTimer); loopTimer = null }
    if (musGain) { const g = musGain; musGain = null; g.__stopped = true; try { g.gain.setTargetAtTime(0, ac.currentTime, 0.05); setTimeout(() => g.disconnect(), 400) } catch {} }
  }
  return {
    sfx(name) {
      log.push({ t: stamp(), kind: 'sfx', name })
      if (!on || !SFX[name]) return
      ensure(); SFX[name].synth(ac, sfxBus, ac.currentTime + 0.005)
    },
    cry(id, rate = 1) { log.push({ t: stamp(), kind: 'cry', id, rate }); if (!on) return; ensure(); window.__playCry?.(ac, sfxBus, id, rate) },
    music(name) { log.push({ t: stamp(), kind: 'music', name }); current = name; startMusic(name) },
    stopMusic() { log.push({ t: stamp(), kind: 'music', name: null }); current = null; stopNodes() },
    setOn(v) {
      on = v
      try { localStorage.setItem('vvm-sound', v ? '1' : '0') } catch {}
      if (v) { ensure(); if (current) startMusic(current) } else stopNodes()
    },
    get on() { return on },
  }
})()

/** Re-renders everything that played between two moments, offline, as WAV.
    Used to put sound on the recorded video; the page never needs it. */
window.__renderAudio = async (fromMs, toMs, rate = 22050) => {
  const dur = (toMs - fromMs) / 1000
  const ac = new OfflineAudioContext(1, Math.ceil(dur * rate), rate)
  const master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination)
  const s = ac.createGain(); s.gain.value = 0.9; s.connect(master)
  const m = ac.createGain(); m.gain.value = 0.5; m.connect(master)
  const log = window.__audioLog.filter((e) => e.t <= toMs)
  await window.__scheduleCries?.(ac, s, log, fromMs)
  log.forEach((e, i) => {
    const t = (e.t - fromMs) / 1000
    if (e.kind === 'sfx' && t >= 0 && SFX[e.name]) SFX[e.name].synth(ac, s, t)
    if (e.kind === 'music' && e.name) {
      const song = SONGS[e.name]
      const end = (log.slice(i + 1).find((x) => x.kind === 'music')?.t ?? toMs) - fromMs
      const g = ac.createGain(); g.connect(m)
      g.gain.setValueAtTime(1, Math.max(0, end / 1000)); g.gain.linearRampToValueAtTime(0, Math.max(0, end / 1000) + 0.08)
      let t0 = t + 0.06
      do { const len = scheduleSong(ac, g, song, t0); t0 += len } while (song.loop && t0 < end / 1000)
    }
  })
  const buf = await ac.startRendering()
  const d = buf.getChannelData(0), n = d.length
  const out = new DataView(new ArrayBuffer(44 + n * 2))
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true)
  const bytes = new Uint8Array(out.buffer); let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}


/* ══════════════════════════════ WILD MOCKUP ══════════════════════════════ */

const DATA = {"regions":["Kanto","Johto","Hoenn","Sinnoh","Unova","Kalos","Alola","Galar","Paldea"],"starters":[{"id":1,"name":"BULBASAUR","types":["grass","poison"],"base":{"hp":45,"attack":49,"defense":49,"special-attack":65,"special-defense":65,"speed":45},"capture":45,"region":0},{"id":4,"name":"CHARMANDER","types":["fire"],"base":{"hp":39,"attack":52,"defense":43,"special-attack":60,"special-defense":50,"speed":65},"capture":45,"region":0},{"id":7,"name":"SQUIRTLE","types":["water"],"base":{"hp":44,"attack":48,"defense":65,"special-attack":50,"special-defense":64,"speed":43},"capture":45,"region":0},{"id":152,"name":"CHIKORITA","types":["grass"],"base":{"hp":45,"attack":49,"defense":65,"special-attack":49,"special-defense":65,"speed":45},"capture":45,"region":1},{"id":155,"name":"CYNDAQUIL","types":["fire"],"base":{"hp":39,"attack":52,"defense":43,"special-attack":60,"special-defense":50,"speed":65},"capture":45,"region":1},{"id":158,"name":"TOTODILE","types":["water"],"base":{"hp":50,"attack":65,"defense":64,"special-attack":44,"special-defense":48,"speed":43},"capture":45,"region":1},{"id":252,"name":"TREECKO","types":["grass"],"base":{"hp":40,"attack":45,"defense":35,"special-attack":65,"special-defense":55,"speed":70},"capture":45,"region":2},{"id":255,"name":"TORCHIC","types":["fire"],"base":{"hp":45,"attack":60,"defense":40,"special-attack":70,"special-defense":50,"speed":45},"capture":45,"region":2},{"id":258,"name":"MUDKIP","types":["water"],"base":{"hp":50,"attack":70,"defense":50,"special-attack":50,"special-defense":50,"speed":40},"capture":45,"region":2},{"id":387,"name":"TURTWIG","types":["grass"],"base":{"hp":55,"attack":68,"defense":64,"special-attack":45,"special-defense":55,"speed":31},"capture":45,"region":3},{"id":390,"name":"CHIMCHAR","types":["fire"],"base":{"hp":44,"attack":58,"defense":44,"special-attack":58,"special-defense":44,"speed":61},"capture":45,"region":3},{"id":393,"name":"PIPLUP","types":["water"],"base":{"hp":53,"attack":51,"defense":53,"special-attack":61,"special-defense":56,"speed":40},"capture":45,"region":3},{"id":495,"name":"SNIVY","types":["grass"],"base":{"hp":45,"attack":45,"defense":55,"special-attack":45,"special-defense":55,"speed":63},"capture":45,"region":4},{"id":498,"name":"TEPIG","types":["fire"],"base":{"hp":65,"attack":63,"defense":45,"special-attack":45,"special-defense":45,"speed":45},"capture":45,"region":4},{"id":501,"name":"OSHAWOTT","types":["water"],"base":{"hp":55,"attack":55,"defense":45,"special-attack":63,"special-defense":45,"speed":45},"capture":45,"region":4},{"id":650,"name":"CHESPIN","types":["grass"],"base":{"hp":56,"attack":61,"defense":65,"special-attack":48,"special-defense":45,"speed":38},"capture":45,"region":5},{"id":653,"name":"FENNEKIN","types":["fire"],"base":{"hp":40,"attack":45,"defense":40,"special-attack":62,"special-defense":60,"speed":60},"capture":45,"region":5},{"id":656,"name":"FROAKIE","types":["water"],"base":{"hp":41,"attack":56,"defense":40,"special-attack":62,"special-defense":44,"speed":71},"capture":45,"region":5},{"id":722,"name":"ROWLET","types":["grass","flying"],"base":{"hp":68,"attack":55,"defense":55,"special-attack":50,"special-defense":50,"speed":42},"capture":45,"region":6},{"id":725,"name":"LITTEN","types":["fire"],"base":{"hp":45,"attack":65,"defense":40,"special-attack":60,"special-defense":40,"speed":70},"capture":45,"region":6},{"id":728,"name":"POPPLIO","types":["water"],"base":{"hp":50,"attack":54,"defense":54,"special-attack":66,"special-defense":56,"speed":40},"capture":45,"region":6},{"id":810,"name":"GROOKEY","types":["grass"],"base":{"hp":50,"attack":65,"defense":50,"special-attack":40,"special-defense":40,"speed":65},"capture":45,"region":7},{"id":813,"name":"SCORBUNNY","types":["fire"],"base":{"hp":50,"attack":71,"defense":40,"special-attack":40,"special-defense":40,"speed":69},"capture":45,"region":7},{"id":816,"name":"SOBBLE","types":["water"],"base":{"hp":50,"attack":40,"defense":40,"special-attack":70,"special-defense":40,"speed":70},"capture":45,"region":7},{"id":906,"name":"SPRIGATITO","types":["grass"],"base":{"hp":40,"attack":61,"defense":54,"special-attack":45,"special-defense":45,"speed":65},"capture":45,"region":8},{"id":909,"name":"FUECOCO","types":["fire"],"base":{"hp":67,"attack":45,"defense":59,"special-attack":63,"special-defense":40,"speed":36},"capture":45,"region":8},{"id":912,"name":"QUAXLY","types":["water"],"base":{"hp":55,"attack":65,"defense":45,"special-attack":50,"special-defense":45,"speed":50},"capture":45,"region":8}],"wild":[{"id":133,"name":"EEVEE","types":["normal"],"base":{"hp":55,"attack":55,"defense":50,"special-attack":45,"special-defense":65,"speed":55},"capture":45,"evo":"Lv 25 (stand-in): Espeon, Umbreon, Leafeon, Glaceon or Sylveon. Stones later."},{"id":447,"name":"RIOLU","types":["fighting"],"base":{"hp":40,"attack":70,"defense":40,"special-attack":35,"special-defense":40,"speed":60},"capture":75,"evo":"Lucario at Lv 25 (stand-in)"},{"id":885,"name":"DREEPY","types":["dragon","ghost"],"base":{"hp":28,"attack":60,"defense":30,"special-attack":40,"special-defense":30,"speed":82},"capture":45,"evo":"Drakloak at Lv 50"},{"id":443,"name":"GIBLE","types":["dragon","ground"],"base":{"hp":58,"attack":70,"defense":45,"special-attack":40,"special-defense":45,"speed":42},"capture":45,"evo":"Gabite at Lv 24"},{"id":172,"name":"PICHU","types":["electric"],"base":{"hp":20,"attack":40,"defense":15,"special-attack":35,"special-defense":35,"speed":60},"capture":190,"evo":"Pikachu at Lv 15 (stand-in)"},{"id":129,"name":"MAGIKARP","types":["water"],"base":{"hp":20,"attack":10,"defense":55,"special-attack":15,"special-defense":20,"speed":80},"capture":255,"evo":"Gyarados at Lv 20"},{"id":246,"name":"LARVITAR","types":["rock","ground"],"base":{"hp":50,"attack":64,"defense":50,"special-attack":45,"special-defense":50,"speed":41},"capture":45,"evo":"Pupitar at Lv 30"},{"id":194,"name":"WOOPER","types":["water","ground"],"base":{"hp":55,"attack":45,"defense":45,"special-attack":25,"special-defense":25,"speed":15},"capture":255,"evo":"Quagsire at Lv 20"},{"id":399,"name":"BIDOOF","types":["normal"],"base":{"hp":59,"attack":45,"defense":40,"special-attack":35,"special-defense":40,"speed":31},"capture":255,"evo":"Lv 15: Bibarel"},{"id":54,"name":"PSYDUCK","types":["water"],"base":{"hp":50,"attack":52,"defense":48,"special-attack":65,"special-defense":50,"speed":55},"capture":190,"evo":"Lv 33: Golduck"},{"id":16,"name":"PIDGEY","types":["normal","flying"],"base":{"hp":40,"attack":45,"defense":40,"special-attack":35,"special-defense":35,"speed":56},"capture":255,"evo":"Lv 18: Pidgeotto"},{"id":163,"name":"HOOTHOOT","types":["normal","flying"],"base":{"hp":60,"attack":30,"defense":30,"special-attack":36,"special-defense":56,"speed":50},"capture":255,"evo":"Lv 20: Noctowl"},{"id":190,"name":"AIPOM","types":["normal"],"base":{"hp":55,"attack":70,"defense":55,"special-attack":40,"special-defense":55,"speed":85},"capture":45,"evo":"Lv 32 (stand-in): Ambipom"},{"id":108,"name":"LICKITUNG","types":["normal"],"base":{"hp":90,"attack":55,"defense":75,"special-attack":60,"special-defense":75,"speed":30},"capture":45,"evo":"Lv 33 (stand-in): Lickilicky"},{"id":92,"name":"GASTLY","types":["ghost","poison"],"base":{"hp":30,"attack":35,"defense":30,"special-attack":100,"special-defense":35,"speed":80},"capture":190,"evo":"Lv 25: Haunter"},{"id":81,"name":"MAGNEMITE","types":["electric","steel"],"base":{"hp":25,"attack":35,"defense":70,"special-attack":95,"special-defense":55,"speed":45},"capture":190,"evo":"Lv 30: Magneton"},{"id":86,"name":"SEEL","types":["water"],"base":{"hp":65,"attack":45,"defense":55,"special-attack":45,"special-defense":70,"speed":45},"capture":190,"evo":"Lv 34: Dewgong"},{"id":220,"name":"SWINUB","types":["ice","ground"],"base":{"hp":50,"attack":50,"defense":40,"special-attack":30,"special-defense":30,"speed":50},"capture":225,"evo":"Lv 33: Piloswine"},{"id":116,"name":"HORSEA","types":["water"],"base":{"hp":30,"attack":40,"defense":70,"special-attack":70,"special-defense":25,"speed":60},"capture":225,"evo":"Lv 32: Seadra"}],"trainer":[{"id":1000,"name":"GHOLDENGO","types":["steel","ghost"],"base":{"hp":87,"attack":60,"defense":95,"special-attack":133,"special-defense":91,"speed":84},"capture":45},{"id":450,"name":"HIPPOWDON","types":["ground"],"base":{"hp":108,"attack":112,"defense":118,"special-attack":68,"special-defense":72,"speed":47},"capture":60},{"id":53,"name":"PERSIAN","types":["normal"],"base":{"hp":65,"attack":70,"defense":60,"special-attack":65,"special-defense":65,"speed":115},"capture":90},{"id":302,"name":"SABLEYE","types":["dark","ghost"],"base":{"hp":50,"attack":75,"defense":75,"special-attack":65,"special-defense":65,"speed":50},"capture":45},{"id":303,"name":"MAWILE","types":["steel","fairy"],"base":{"hp":50,"attack":85,"defense":85,"special-attack":55,"special-defense":55,"speed":50},"capture":45},{"id":820,"name":"GREEDENT","types":["normal"],"base":{"hp":120,"attack":95,"defense":95,"special-attack":55,"special-defense":75,"speed":20},"capture":90},{"id":143,"name":"SNORLAX","types":["normal"],"base":{"hp":160,"attack":110,"defense":65,"special-attack":65,"special-defense":110,"speed":30},"capture":25},{"id":569,"name":"GARBODOR","types":["poison"],"base":{"hp":80,"attack":95,"defense":82,"special-attack":60,"special-defense":82,"speed":75},"capture":60},{"id":399,"name":"BIDOOF","types":["normal"],"base":{"hp":59,"attack":45,"defense":40,"special-attack":35,"special-defense":40,"speed":31},"capture":255},{"id":191,"name":"SUNKERN","types":["grass"],"base":{"hp":30,"attack":30,"defense":30,"special-attack":30,"special-defense":30,"speed":30},"capture":235},{"id":54,"name":"PSYDUCK","types":["water"],"base":{"hp":50,"attack":52,"defense":48,"special-attack":65,"special-defense":50,"speed":55},"capture":190},{"id":129,"name":"MAGIKARP","types":["water"],"base":{"hp":20,"attack":10,"defense":55,"special-attack":15,"special-defense":20,"speed":80},"capture":255},{"id":137,"name":"PORYGON","types":["normal"],"base":{"hp":65,"attack":60,"defense":70,"special-attack":85,"special-defense":75,"speed":40},"capture":45},{"id":16,"name":"PIDGEY","types":["normal","flying"],"base":{"hp":40,"attack":45,"defense":40,"special-attack":35,"special-defense":35,"speed":56},"capture":255},{"id":163,"name":"HOOTHOOT","types":["normal","flying"],"base":{"hp":60,"attack":30,"defense":30,"special-attack":36,"special-defense":56,"speed":50},"capture":255},{"id":17,"name":"PIDGEOTTO","types":["normal","flying"],"base":{"hp":63,"attack":60,"defense":55,"special-attack":50,"special-defense":50,"speed":71},"capture":120},{"id":11,"name":"METAPOD","types":["bug"],"base":{"hp":50,"attack":20,"defense":55,"special-attack":25,"special-defense":25,"speed":30},"capture":120},{"id":14,"name":"KAKUNA","types":["bug","poison"],"base":{"hp":45,"attack":25,"defense":50,"special-attack":25,"special-defense":25,"speed":35},"capture":120},{"id":123,"name":"SCYTHER","types":["bug","flying"],"base":{"hp":70,"attack":110,"defense":80,"special-attack":55,"special-defense":80,"speed":105},"capture":45},{"id":35,"name":"CLEFAIRY","types":["fairy"],"base":{"hp":70,"attack":45,"defense":48,"special-attack":60,"special-defense":65,"speed":35},"capture":150},{"id":190,"name":"AIPOM","types":["normal"],"base":{"hp":55,"attack":70,"defense":55,"special-attack":40,"special-defense":55,"speed":85},"capture":45},{"id":108,"name":"LICKITUNG","types":["normal"],"base":{"hp":90,"attack":55,"defense":75,"special-attack":60,"special-defense":75,"speed":30},"capture":45},{"id":241,"name":"MILTANK","types":["normal"],"base":{"hp":95,"attack":80,"defense":105,"special-attack":40,"special-defense":70,"speed":100},"capture":45},{"id":92,"name":"GASTLY","types":["ghost","poison"],"base":{"hp":30,"attack":35,"defense":30,"special-attack":100,"special-defense":35,"speed":80},"capture":190},{"id":93,"name":"HAUNTER","types":["ghost","poison"],"base":{"hp":45,"attack":50,"defense":45,"special-attack":115,"special-defense":55,"speed":95},"capture":90},{"id":200,"name":"MISDREAVUS","types":["ghost"],"base":{"hp":60,"attack":60,"defense":60,"special-attack":85,"special-defense":85,"speed":85},"capture":45},{"id":94,"name":"GENGAR","types":["ghost","poison"],"base":{"hp":60,"attack":65,"defense":60,"special-attack":130,"special-defense":75,"speed":110},"capture":45},{"id":57,"name":"PRIMEAPE","types":["fighting"],"base":{"hp":65,"attack":105,"defense":60,"special-attack":60,"special-defense":70,"speed":95},"capture":75},{"id":67,"name":"MACHOKE","types":["fighting"],"base":{"hp":80,"attack":100,"defense":70,"special-attack":50,"special-defense":60,"speed":45},"capture":90},{"id":106,"name":"HITMONLEE","types":["fighting"],"base":{"hp":50,"attack":120,"defense":53,"special-attack":35,"special-defense":110,"speed":87},"capture":45},{"id":107,"name":"HITMONCHAN","types":["fighting"],"base":{"hp":50,"attack":105,"defense":79,"special-attack":35,"special-defense":110,"speed":76},"capture":45},{"id":62,"name":"POLIWRATH","types":["water","fighting"],"base":{"hp":90,"attack":95,"defense":95,"special-attack":70,"special-defense":90,"speed":70},"capture":45},{"id":81,"name":"MAGNEMITE","types":["electric","steel"],"base":{"hp":25,"attack":35,"defense":70,"special-attack":95,"special-defense":55,"speed":45},"capture":190},{"id":227,"name":"SKARMORY","types":["steel","flying"],"base":{"hp":65,"attack":80,"defense":140,"special-attack":40,"special-defense":70,"speed":70},"capture":25},{"id":205,"name":"FORRETRESS","types":["bug","steel"],"base":{"hp":75,"attack":90,"defense":140,"special-attack":60,"special-defense":60,"speed":40},"capture":75},{"id":208,"name":"STEELIX","types":["steel","ground"],"base":{"hp":75,"attack":85,"defense":200,"special-attack":55,"special-defense":65,"speed":30},"capture":25},{"id":86,"name":"SEEL","types":["water"],"base":{"hp":65,"attack":45,"defense":55,"special-attack":45,"special-defense":70,"speed":45},"capture":190},{"id":87,"name":"DEWGONG","types":["water","ice"],"base":{"hp":90,"attack":70,"defense":80,"special-attack":70,"special-defense":95,"speed":70},"capture":75},{"id":220,"name":"SWINUB","types":["ice","ground"],"base":{"hp":50,"attack":50,"defense":40,"special-attack":30,"special-defense":30,"speed":50},"capture":225},{"id":124,"name":"JYNX","types":["ice","psychic"],"base":{"hp":65,"attack":50,"defense":35,"special-attack":115,"special-defense":95,"speed":95},"capture":45},{"id":131,"name":"LAPRAS","types":["water","ice"],"base":{"hp":130,"attack":85,"defense":80,"special-attack":85,"special-defense":95,"speed":60},"capture":45},{"id":221,"name":"PILOSWINE","types":["ice","ground"],"base":{"hp":100,"attack":100,"defense":80,"special-attack":60,"special-defense":60,"speed":50},"capture":75},{"id":116,"name":"HORSEA","types":["water"],"base":{"hp":30,"attack":40,"defense":70,"special-attack":70,"special-defense":25,"speed":60},"capture":225},{"id":117,"name":"SEADRA","types":["water"],"base":{"hp":55,"attack":65,"defense":95,"special-attack":95,"special-defense":45,"speed":85},"capture":75},{"id":130,"name":"GYARADOS","types":["water","flying"],"base":{"hp":95,"attack":125,"defense":79,"special-attack":60,"special-defense":100,"speed":81},"capture":45},{"id":148,"name":"DRAGONAIR","types":["dragon"],"base":{"hp":61,"attack":84,"defense":65,"special-attack":70,"special-defense":70,"speed":70},"capture":45},{"id":230,"name":"KINGDRA","types":["water","dragon"],"base":{"hp":75,"attack":95,"defense":95,"special-attack":95,"special-defense":95,"speed":85},"capture":45},{"id":300,"name":"SKITTY","types":["normal"],"base":{"hp":50,"attack":45,"defense":45,"special-attack":35,"special-defense":35,"speed":50},"capture":255},{"id":113,"name":"CHANSEY","types":["normal"],"base":{"hp":250,"attack":5,"defense":5,"special-attack":35,"special-defense":105,"speed":50},"capture":30},{"id":242,"name":"BLISSEY","types":["normal"],"base":{"hp":255,"attack":10,"defense":10,"special-attack":75,"special-defense":135,"speed":55},"capture":30},{"id":504,"name":"PATRAT","types":["normal"],"base":{"hp":45,"attack":55,"defense":39,"special-attack":35,"special-defense":39,"speed":42},"capture":255},{"id":505,"name":"WATCHOG","types":["normal"],"base":{"hp":60,"attack":85,"defense":69,"special-attack":60,"special-defense":69,"speed":77},"capture":255},{"id":287,"name":"SLAKOTH","types":["normal"],"base":{"hp":60,"attack":60,"defense":60,"special-attack":35,"special-defense":35,"speed":30},"capture":255},{"id":96,"name":"DROWZEE","types":["psychic"],"base":{"hp":60,"attack":48,"defense":45,"special-attack":43,"special-defense":90,"speed":42},"capture":190},{"id":39,"name":"JIGGLYPUFF","types":["normal","fairy"],"base":{"hp":115,"attack":45,"defense":20,"special-attack":45,"special-defense":25,"speed":20},"capture":170},{"id":311,"name":"PLUSLE","types":["electric"],"base":{"hp":60,"attack":50,"defense":40,"special-attack":85,"special-defense":75,"speed":95},"capture":200},{"id":312,"name":"MINUN","types":["electric"],"base":{"hp":60,"attack":40,"defense":50,"special-attack":75,"special-defense":85,"speed":95},"capture":200},{"id":25,"name":"PIKACHU","types":["electric"],"base":{"hp":35,"attack":55,"defense":40,"special-attack":50,"special-defense":50,"speed":90},"capture":190},{"id":441,"name":"CHATOT","types":["normal","flying"],"base":{"hp":76,"attack":65,"defense":45,"special-attack":92,"special-defense":42,"speed":91},"capture":30},{"id":479,"name":"ROTOM","types":["electric","ghost"],"base":{"hp":50,"attack":50,"defense":77,"special-attack":95,"special-defense":77,"speed":91},"capture":45},{"id":819,"name":"SKWOVET","types":["normal"],"base":{"hp":70,"attack":55,"defense":55,"special-attack":35,"special-defense":35,"speed":25},"capture":255},{"id":357,"name":"TROPIUS","types":["grass","flying"],"base":{"hp":99,"attack":68,"defense":83,"special-attack":72,"special-defense":87,"speed":51},"capture":200},{"id":58,"name":"GROWLITHE","types":["fire"],"base":{"hp":55,"attack":70,"defense":45,"special-attack":70,"special-defense":50,"speed":60},"capture":190},{"id":59,"name":"ARCANINE","types":["fire"],"base":{"hp":90,"attack":110,"defense":80,"special-attack":100,"special-defense":80,"speed":95},"capture":75},{"id":79,"name":"SLOWPOKE","types":["water","psychic"],"base":{"hp":90,"attack":65,"defense":65,"special-attack":40,"special-defense":40,"speed":15},"capture":190},{"id":177,"name":"NATU","types":["psychic","flying"],"base":{"hp":40,"attack":50,"defense":45,"special-attack":70,"special-defense":45,"speed":70},"capture":190},{"id":64,"name":"KADABRA","types":["psychic"],"base":{"hp":40,"attack":35,"defense":30,"special-attack":120,"special-defense":70,"speed":105},"capture":100},{"id":509,"name":"PURRLOIN","types":["dark"],"base":{"hp":41,"attack":50,"defense":37,"special-attack":50,"special-defense":37,"speed":66},"capture":255},{"id":453,"name":"CROAGUNK","types":["poison","fighting"],"base":{"hp":48,"attack":61,"defense":40,"special-attack":61,"special-defense":40,"speed":50},"capture":140},{"id":510,"name":"LIEPARD","types":["dark"],"base":{"hp":64,"attack":88,"defense":50,"special-attack":88,"special-defense":50,"speed":106},"capture":90},{"id":132,"name":"DITTO","types":["normal"],"base":{"hp":48,"attack":48,"defense":48,"special-attack":48,"special-defense":48,"speed":48},"capture":35},{"id":235,"name":"SMEARGLE","types":["normal"],"base":{"hp":55,"attack":20,"defense":35,"special-attack":20,"special-defense":45,"speed":75},"capture":45},{"id":778,"name":"MIMIKYU","types":["ghost","fairy"],"base":{"hp":55,"attack":90,"defense":80,"special-attack":50,"special-defense":105,"speed":96},"capture":45},{"id":178,"name":"XATU","types":["psychic","flying"],"base":{"hp":65,"attack":75,"defense":70,"special-attack":95,"special-defense":70,"speed":95},"capture":75},{"id":103,"name":"EXEGGUTOR","types":["grass","psychic"],"base":{"hp":95,"attack":95,"defense":85,"special-attack":125,"special-defense":75,"speed":55},"capture":45},{"id":80,"name":"SLOWBRO","types":["water","psychic"],"base":{"hp":95,"attack":75,"defense":110,"special-attack":100,"special-defense":80,"speed":30},"capture":75},{"id":168,"name":"ARIADOS","types":["bug","poison"],"base":{"hp":70,"attack":90,"defense":70,"special-attack":60,"special-defense":70,"speed":40},"capture":90},{"id":49,"name":"VENOMOTH","types":["bug","poison"],"base":{"hp":70,"attack":65,"defense":60,"special-attack":90,"special-defense":75,"speed":90},"capture":75},{"id":89,"name":"MUK","types":["poison"],"base":{"hp":105,"attack":105,"defense":75,"special-attack":65,"special-defense":100,"speed":50},"capture":75},{"id":169,"name":"CROBAT","types":["poison","flying"],"base":{"hp":85,"attack":90,"defense":80,"special-attack":70,"special-defense":80,"speed":130},"capture":90},{"id":237,"name":"HITMONTOP","types":["fighting"],"base":{"hp":50,"attack":95,"defense":95,"special-attack":35,"special-defense":110,"speed":70},"capture":45},{"id":95,"name":"ONIX","types":["rock","ground"],"base":{"hp":35,"attack":45,"defense":160,"special-attack":30,"special-defense":45,"speed":70},"capture":45},{"id":68,"name":"MACHAMP","types":["fighting"],"base":{"hp":90,"attack":130,"defense":80,"special-attack":65,"special-defense":85,"speed":55},"capture":45},{"id":197,"name":"UMBREON","types":["dark"],"base":{"hp":95,"attack":65,"defense":110,"special-attack":60,"special-defense":130,"speed":65},"capture":45},{"id":45,"name":"VILEPLUME","types":["grass","poison"],"base":{"hp":75,"attack":80,"defense":85,"special-attack":110,"special-defense":90,"speed":50},"capture":45},{"id":198,"name":"MURKROW","types":["dark","flying"],"base":{"hp":60,"attack":85,"defense":42,"special-attack":85,"special-defense":42,"speed":91},"capture":30},{"id":229,"name":"HOUNDOOM","types":["dark","fire"],"base":{"hp":75,"attack":90,"defense":50,"special-attack":110,"special-defense":80,"speed":95},"capture":45},{"id":149,"name":"DRAGONITE","types":["dragon","flying"],"base":{"hp":91,"attack":134,"defense":95,"special-attack":100,"special-defense":100,"speed":80},"capture":45},{"id":6,"name":"CHARIZARD","types":["fire","flying"],"base":{"hp":78,"attack":84,"defense":78,"special-attack":109,"special-defense":85,"speed":100},"capture":45},{"id":142,"name":"AERODACTYL","types":["rock","flying"],"base":{"hp":80,"attack":105,"defense":65,"special-attack":60,"special-defense":75,"speed":130},"capture":45},{"id":75,"name":"GRAVELER","types":["rock","ground"],"base":{"hp":55,"attack":95,"defense":115,"special-attack":45,"special-defense":45,"speed":35},"capture":120},{"id":111,"name":"RHYHORN","types":["ground","rock"],"base":{"hp":80,"attack":85,"defense":95,"special-attack":30,"special-defense":30,"speed":25},"capture":120},{"id":139,"name":"OMASTAR","types":["rock","water"],"base":{"hp":70,"attack":60,"defense":125,"special-attack":115,"special-defense":70,"speed":55},"capture":45},{"id":141,"name":"KABUTOPS","types":["rock","water"],"base":{"hp":60,"attack":115,"defense":105,"special-attack":65,"special-defense":70,"speed":80},"capture":45},{"id":55,"name":"GOLDUCK","types":["water"],"base":{"hp":80,"attack":82,"defense":78,"special-attack":95,"special-defense":80,"speed":85},"capture":75},{"id":195,"name":"QUAGSIRE","types":["water","ground"],"base":{"hp":95,"attack":85,"defense":85,"special-attack":65,"special-defense":65,"speed":35},"capture":90},{"id":121,"name":"STARMIE","types":["water","psychic"],"base":{"hp":60,"attack":75,"defense":85,"special-attack":100,"special-defense":85,"speed":115},"capture":60},{"id":119,"name":"SEAKING","types":["water"],"base":{"hp":80,"attack":92,"defense":65,"special-attack":65,"special-defense":80,"speed":68},"capture":60},{"id":26,"name":"RAICHU","types":["electric"],"base":{"hp":60,"attack":90,"defense":55,"special-attack":90,"special-defense":80,"speed":110},"capture":75},{"id":101,"name":"ELECTRODE","types":["electric"],"base":{"hp":60,"attack":50,"defense":70,"special-attack":80,"special-defense":80,"speed":150},"capture":60},{"id":82,"name":"MAGNETON","types":["electric","steel"],"base":{"hp":50,"attack":60,"defense":95,"special-attack":120,"special-defense":70,"speed":70},"capture":60},{"id":125,"name":"ELECTABUZZ","types":["electric"],"base":{"hp":65,"attack":83,"defense":57,"special-attack":95,"special-defense":85,"speed":105},"capture":45},{"id":114,"name":"TANGELA","types":["grass"],"base":{"hp":65,"attack":55,"defense":115,"special-attack":100,"special-defense":40,"speed":60},"capture":45},{"id":189,"name":"JUMPLUFF","types":["grass","flying"],"base":{"hp":75,"attack":55,"defense":70,"special-attack":55,"special-defense":95,"speed":110},"capture":45},{"id":71,"name":"VICTREEBEL","types":["grass","poison"],"base":{"hp":80,"attack":105,"defense":65,"special-attack":100,"special-defense":70,"speed":70},"capture":45},{"id":182,"name":"BELLOSSOM","types":["grass"],"base":{"hp":75,"attack":80,"defense":95,"special-attack":90,"special-defense":100,"speed":50},"capture":45},{"id":110,"name":"WEEZING","types":["poison"],"base":{"hp":65,"attack":90,"defense":120,"special-attack":85,"special-defense":70,"speed":60},"capture":60},{"id":196,"name":"ESPEON","types":["psychic"],"base":{"hp":65,"attack":65,"defense":60,"special-attack":130,"special-defense":95,"speed":110},"capture":45},{"id":122,"name":"MR. MIME","types":["psychic","fairy"],"base":{"hp":40,"attack":45,"defense":65,"special-attack":100,"special-defense":120,"speed":90},"capture":45},{"id":65,"name":"ALAKAZAM","types":["psychic"],"base":{"hp":55,"attack":50,"defense":45,"special-attack":135,"special-defense":95,"speed":120},"capture":50},{"id":219,"name":"MAGCARGO","types":["fire","rock"],"base":{"hp":60,"attack":50,"defense":120,"special-attack":90,"special-defense":80,"speed":30},"capture":75},{"id":38,"name":"NINETALES","types":["fire"],"base":{"hp":73,"attack":76,"defense":75,"special-attack":81,"special-defense":100,"speed":100},"capture":75},{"id":126,"name":"MAGMAR","types":["fire"],"base":{"hp":65,"attack":95,"defense":57,"special-attack":100,"special-defense":85,"speed":93},"capture":45},{"id":78,"name":"RAPIDASH","types":["fire"],"base":{"hp":65,"attack":100,"defense":70,"special-attack":80,"special-defense":80,"speed":105},"capture":60},{"id":18,"name":"PIDGEOT","types":["normal","flying"],"base":{"hp":83,"attack":80,"defense":75,"special-attack":70,"special-defense":70,"speed":101},"capture":45},{"id":112,"name":"RHYDON","types":["ground","rock"],"base":{"hp":105,"attack":130,"defense":120,"special-attack":45,"special-defense":45,"speed":40},"capture":60},{"id":243,"name":"RAIKOU","types":["electric"],"base":{"hp":90,"attack":85,"defense":75,"special-attack":115,"special-defense":100,"speed":115},"capture":3},{"id":244,"name":"ENTEI","types":["fire"],"base":{"hp":115,"attack":115,"defense":85,"special-attack":90,"special-defense":75,"speed":100},"capture":3},{"id":245,"name":"SUICUNE","types":["water"],"base":{"hp":100,"attack":75,"defense":115,"special-attack":90,"special-defense":115,"speed":85},"capture":3},{"id":76,"name":"GOLEM","types":["rock","ground"],"base":{"hp":80,"attack":120,"defense":130,"special-attack":55,"special-defense":65,"speed":45},"capture":45}],"forms":[{"id":2,"name":"IVYSAUR","types":["grass","poison"],"base":{"hp":60,"attack":62,"defense":63,"special-attack":80,"special-defense":80,"speed":60},"capture":45},{"id":3,"name":"VENUSAUR","types":["grass","poison"],"base":{"hp":80,"attack":82,"defense":83,"special-attack":100,"special-defense":100,"speed":80},"capture":45},{"id":5,"name":"CHARMELEON","types":["fire"],"base":{"hp":58,"attack":64,"defense":58,"special-attack":80,"special-defense":65,"speed":80},"capture":45},{"id":8,"name":"WARTORTLE","types":["water"],"base":{"hp":59,"attack":63,"defense":80,"special-attack":65,"special-defense":80,"speed":58},"capture":45},{"id":9,"name":"BLASTOISE","types":["water"],"base":{"hp":79,"attack":83,"defense":100,"special-attack":85,"special-defense":105,"speed":78},"capture":45},{"id":153,"name":"BAYLEEF","types":["grass"],"base":{"hp":60,"attack":62,"defense":80,"special-attack":63,"special-defense":80,"speed":60},"capture":45},{"id":154,"name":"MEGANIUM","types":["grass"],"base":{"hp":80,"attack":82,"defense":100,"special-attack":83,"special-defense":100,"speed":80},"capture":45},{"id":156,"name":"QUILAVA","types":["fire"],"base":{"hp":58,"attack":64,"defense":58,"special-attack":80,"special-defense":65,"speed":80},"capture":45},{"id":157,"name":"TYPHLOSION","types":["fire"],"base":{"hp":78,"attack":84,"defense":78,"special-attack":109,"special-defense":85,"speed":100},"capture":45},{"id":159,"name":"CROCONAW","types":["water"],"base":{"hp":65,"attack":80,"defense":80,"special-attack":59,"special-defense":63,"speed":58},"capture":45},{"id":160,"name":"FERALIGATR","types":["water"],"base":{"hp":85,"attack":105,"defense":100,"special-attack":79,"special-defense":83,"speed":78},"capture":45},{"id":253,"name":"GROVYLE","types":["grass"],"base":{"hp":50,"attack":65,"defense":45,"special-attack":85,"special-defense":65,"speed":95},"capture":45},{"id":254,"name":"SCEPTILE","types":["grass"],"base":{"hp":70,"attack":85,"defense":65,"special-attack":105,"special-defense":85,"speed":120},"capture":45},{"id":256,"name":"COMBUSKEN","types":["fire","fighting"],"base":{"hp":60,"attack":85,"defense":60,"special-attack":85,"special-defense":60,"speed":55},"capture":45},{"id":257,"name":"BLAZIKEN","types":["fire","fighting"],"base":{"hp":80,"attack":120,"defense":70,"special-attack":110,"special-defense":70,"speed":80},"capture":45},{"id":259,"name":"MARSHTOMP","types":["water","ground"],"base":{"hp":70,"attack":85,"defense":70,"special-attack":60,"special-defense":70,"speed":50},"capture":45},{"id":260,"name":"SWAMPERT","types":["water","ground"],"base":{"hp":100,"attack":110,"defense":90,"special-attack":85,"special-defense":90,"speed":60},"capture":45},{"id":388,"name":"GROTLE","types":["grass"],"base":{"hp":75,"attack":89,"defense":85,"special-attack":55,"special-defense":65,"speed":36},"capture":45},{"id":389,"name":"TORTERRA","types":["grass","ground"],"base":{"hp":95,"attack":109,"defense":105,"special-attack":75,"special-defense":85,"speed":56},"capture":45},{"id":391,"name":"MONFERNO","types":["fire","fighting"],"base":{"hp":64,"attack":78,"defense":52,"special-attack":78,"special-defense":52,"speed":81},"capture":45},{"id":392,"name":"INFERNAPE","types":["fire","fighting"],"base":{"hp":76,"attack":104,"defense":71,"special-attack":104,"special-defense":71,"speed":108},"capture":45},{"id":394,"name":"PRINPLUP","types":["water"],"base":{"hp":64,"attack":66,"defense":68,"special-attack":81,"special-defense":76,"speed":50},"capture":45},{"id":395,"name":"EMPOLEON","types":["water","steel"],"base":{"hp":84,"attack":86,"defense":88,"special-attack":111,"special-defense":101,"speed":60},"capture":45},{"id":496,"name":"SERVINE","types":["grass"],"base":{"hp":60,"attack":60,"defense":75,"special-attack":60,"special-defense":75,"speed":83},"capture":45},{"id":497,"name":"SERPERIOR","types":["grass"],"base":{"hp":75,"attack":75,"defense":95,"special-attack":75,"special-defense":95,"speed":113},"capture":45},{"id":499,"name":"PIGNITE","types":["fire","fighting"],"base":{"hp":90,"attack":93,"defense":55,"special-attack":70,"special-defense":55,"speed":55},"capture":45},{"id":500,"name":"EMBOAR","types":["fire","fighting"],"base":{"hp":110,"attack":123,"defense":65,"special-attack":100,"special-defense":65,"speed":65},"capture":45},{"id":502,"name":"DEWOTT","types":["water"],"base":{"hp":75,"attack":75,"defense":60,"special-attack":83,"special-defense":60,"speed":60},"capture":45},{"id":503,"name":"SAMUROTT","types":["water"],"base":{"hp":95,"attack":100,"defense":85,"special-attack":108,"special-defense":70,"speed":70},"capture":45},{"id":651,"name":"QUILLADIN","types":["grass"],"base":{"hp":61,"attack":78,"defense":95,"special-attack":56,"special-defense":58,"speed":57},"capture":45},{"id":652,"name":"CHESNAUGHT","types":["grass","fighting"],"base":{"hp":88,"attack":107,"defense":122,"special-attack":74,"special-defense":75,"speed":64},"capture":45},{"id":654,"name":"BRAIXEN","types":["fire"],"base":{"hp":59,"attack":59,"defense":58,"special-attack":90,"special-defense":70,"speed":73},"capture":45},{"id":655,"name":"DELPHOX","types":["fire","psychic"],"base":{"hp":75,"attack":69,"defense":72,"special-attack":114,"special-defense":100,"speed":104},"capture":45},{"id":657,"name":"FROGADIER","types":["water"],"base":{"hp":54,"attack":63,"defense":52,"special-attack":83,"special-defense":56,"speed":97},"capture":45},{"id":658,"name":"GRENINJA","types":["water","dark"],"base":{"hp":72,"attack":95,"defense":67,"special-attack":103,"special-defense":71,"speed":122},"capture":45},{"id":723,"name":"DARTRIX","types":["grass","flying"],"base":{"hp":78,"attack":75,"defense":75,"special-attack":70,"special-defense":70,"speed":52},"capture":45},{"id":724,"name":"DECIDUEYE","types":["grass","ghost"],"base":{"hp":78,"attack":107,"defense":75,"special-attack":100,"special-defense":100,"speed":70},"capture":45},{"id":726,"name":"TORRACAT","types":["fire"],"base":{"hp":65,"attack":85,"defense":50,"special-attack":80,"special-defense":50,"speed":90},"capture":45},{"id":727,"name":"INCINEROAR","types":["fire","dark"],"base":{"hp":95,"attack":115,"defense":90,"special-attack":80,"special-defense":90,"speed":60},"capture":45},{"id":729,"name":"BRIONNE","types":["water"],"base":{"hp":60,"attack":69,"defense":69,"special-attack":91,"special-defense":81,"speed":50},"capture":45},{"id":730,"name":"PRIMARINA","types":["water","fairy"],"base":{"hp":80,"attack":74,"defense":74,"special-attack":126,"special-defense":116,"speed":60},"capture":45},{"id":811,"name":"THWACKEY","types":["grass"],"base":{"hp":70,"attack":85,"defense":70,"special-attack":55,"special-defense":60,"speed":80},"capture":45},{"id":812,"name":"RILLABOOM","types":["grass"],"base":{"hp":100,"attack":125,"defense":90,"special-attack":60,"special-defense":70,"speed":85},"capture":45},{"id":814,"name":"RABOOT","types":["fire"],"base":{"hp":65,"attack":86,"defense":60,"special-attack":55,"special-defense":60,"speed":94},"capture":45},{"id":815,"name":"CINDERACE","types":["fire"],"base":{"hp":80,"attack":116,"defense":75,"special-attack":65,"special-defense":75,"speed":119},"capture":45},{"id":817,"name":"DRIZZILE","types":["water"],"base":{"hp":65,"attack":60,"defense":55,"special-attack":95,"special-defense":55,"speed":90},"capture":45},{"id":818,"name":"INTELEON","types":["water"],"base":{"hp":70,"attack":85,"defense":65,"special-attack":125,"special-defense":65,"speed":120},"capture":45},{"id":907,"name":"FLORAGATO","types":["grass"],"base":{"hp":61,"attack":80,"defense":63,"special-attack":60,"special-defense":63,"speed":83},"capture":45},{"id":908,"name":"MEOWSCARADA","types":["grass","dark"],"base":{"hp":76,"attack":110,"defense":70,"special-attack":81,"special-defense":70,"speed":123},"capture":45},{"id":910,"name":"CROCALOR","types":["fire"],"base":{"hp":81,"attack":55,"defense":78,"special-attack":90,"special-defense":58,"speed":49},"capture":45},{"id":911,"name":"SKELEDIRGE","types":["fire","ghost"],"base":{"hp":104,"attack":75,"defense":100,"special-attack":110,"special-defense":75,"speed":66},"capture":45},{"id":913,"name":"QUAXWELL","types":["water"],"base":{"hp":70,"attack":85,"defense":65,"special-attack":65,"special-defense":60,"speed":65},"capture":45},{"id":914,"name":"QUAQUAVAL","types":["water","fighting"],"base":{"hp":85,"attack":120,"defense":80,"special-attack":85,"special-defense":75,"speed":85},"capture":45},{"id":134,"name":"VAPOREON","types":["water"],"base":{"hp":130,"attack":65,"defense":60,"special-attack":110,"special-defense":95,"speed":65},"capture":45},{"id":135,"name":"JOLTEON","types":["electric"],"base":{"hp":65,"attack":65,"defense":60,"special-attack":110,"special-defense":95,"speed":130},"capture":45},{"id":136,"name":"FLAREON","types":["fire"],"base":{"hp":65,"attack":130,"defense":60,"special-attack":95,"special-defense":110,"speed":65},"capture":45},{"id":470,"name":"LEAFEON","types":["grass"],"base":{"hp":65,"attack":110,"defense":130,"special-attack":60,"special-defense":65,"speed":95},"capture":45},{"id":471,"name":"GLACEON","types":["ice"],"base":{"hp":65,"attack":60,"defense":110,"special-attack":130,"special-defense":95,"speed":65},"capture":45},{"id":700,"name":"SYLVEON","types":["fairy"],"base":{"hp":95,"attack":65,"defense":65,"special-attack":110,"special-defense":130,"speed":60},"capture":45},{"id":448,"name":"LUCARIO","types":["fighting","steel"],"base":{"hp":70,"attack":110,"defense":70,"special-attack":115,"special-defense":70,"speed":90},"capture":45},{"id":886,"name":"DRAKLOAK","types":["dragon","ghost"],"base":{"hp":68,"attack":80,"defense":50,"special-attack":60,"special-defense":50,"speed":102},"capture":45},{"id":887,"name":"DRAGAPULT","types":["dragon","ghost"],"base":{"hp":88,"attack":120,"defense":75,"special-attack":100,"special-defense":75,"speed":142},"capture":45},{"id":444,"name":"GABITE","types":["dragon","ground"],"base":{"hp":68,"attack":90,"defense":65,"special-attack":50,"special-defense":55,"speed":82},"capture":45},{"id":445,"name":"GARCHOMP","types":["dragon","ground"],"base":{"hp":108,"attack":130,"defense":95,"special-attack":80,"special-defense":85,"speed":102},"capture":45},{"id":247,"name":"PUPITAR","types":["rock","ground"],"base":{"hp":70,"attack":84,"defense":70,"special-attack":65,"special-defense":70,"speed":51},"capture":45},{"id":248,"name":"TYRANITAR","types":["rock","dark"],"base":{"hp":100,"attack":134,"defense":110,"special-attack":95,"special-defense":100,"speed":61},"capture":45},{"id":400,"name":"BIBAREL","types":["normal","water"],"base":{"hp":79,"attack":85,"defense":60,"special-attack":55,"special-defense":60,"speed":71},"capture":127},{"id":164,"name":"NOCTOWL","types":["normal","flying"],"base":{"hp":100,"attack":50,"defense":50,"special-attack":86,"special-defense":96,"speed":70},"capture":90},{"id":424,"name":"AMBIPOM","types":["normal"],"base":{"hp":75,"attack":100,"defense":66,"special-attack":60,"special-defense":66,"speed":115},"capture":45},{"id":463,"name":"LICKILICKY","types":["normal"],"base":{"hp":110,"attack":85,"defense":95,"special-attack":80,"special-defense":95,"speed":50},"capture":30},{"id":462,"name":"MAGNEZONE","types":["electric","steel"],"base":{"hp":70,"attack":70,"defense":115,"special-attack":130,"special-defense":90,"speed":60},"capture":30},{"id":473,"name":"MAMOSWINE","types":["ice","ground"],"base":{"hp":110,"attack":130,"defense":80,"special-attack":70,"special-defense":60,"speed":80},"capture":50}],"evos":{"BULBASAUR":[{"to":"IVYSAUR","level":16}],"IVYSAUR":[{"to":"VENUSAUR","level":32}],"CHARMANDER":[{"to":"CHARMELEON","level":16}],"CHARMELEON":[{"to":"CHARIZARD","level":36}],"SQUIRTLE":[{"to":"WARTORTLE","level":16}],"WARTORTLE":[{"to":"BLASTOISE","level":36}],"CHIKORITA":[{"to":"BAYLEEF","level":16}],"BAYLEEF":[{"to":"MEGANIUM","level":32}],"CYNDAQUIL":[{"to":"QUILAVA","level":14}],"QUILAVA":[{"to":"TYPHLOSION","level":36}],"TOTODILE":[{"to":"CROCONAW","level":18}],"CROCONAW":[{"to":"FERALIGATR","level":30}],"TREECKO":[{"to":"GROVYLE","level":16}],"GROVYLE":[{"to":"SCEPTILE","level":36}],"TORCHIC":[{"to":"COMBUSKEN","level":16}],"COMBUSKEN":[{"to":"BLAZIKEN","level":36}],"MUDKIP":[{"to":"MARSHTOMP","level":16}],"MARSHTOMP":[{"to":"SWAMPERT","level":36}],"TURTWIG":[{"to":"GROTLE","level":18}],"GROTLE":[{"to":"TORTERRA","level":32}],"CHIMCHAR":[{"to":"MONFERNO","level":14}],"MONFERNO":[{"to":"INFERNAPE","level":36}],"PIPLUP":[{"to":"PRINPLUP","level":16}],"PRINPLUP":[{"to":"EMPOLEON","level":36}],"SNIVY":[{"to":"SERVINE","level":17}],"SERVINE":[{"to":"SERPERIOR","level":36}],"TEPIG":[{"to":"PIGNITE","level":17}],"PIGNITE":[{"to":"EMBOAR","level":36}],"OSHAWOTT":[{"to":"DEWOTT","level":17}],"DEWOTT":[{"to":"SAMUROTT","level":36}],"CHESPIN":[{"to":"QUILLADIN","level":16}],"QUILLADIN":[{"to":"CHESNAUGHT","level":36}],"FENNEKIN":[{"to":"BRAIXEN","level":16}],"BRAIXEN":[{"to":"DELPHOX","level":36}],"FROAKIE":[{"to":"FROGADIER","level":16}],"FROGADIER":[{"to":"GRENINJA","level":36}],"ROWLET":[{"to":"DARTRIX","level":17}],"DARTRIX":[{"to":"DECIDUEYE","level":34}],"LITTEN":[{"to":"TORRACAT","level":17}],"TORRACAT":[{"to":"INCINEROAR","level":34}],"POPPLIO":[{"to":"BRIONNE","level":17}],"BRIONNE":[{"to":"PRIMARINA","level":34}],"GROOKEY":[{"to":"THWACKEY","level":16}],"THWACKEY":[{"to":"RILLABOOM","level":35}],"SCORBUNNY":[{"to":"RABOOT","level":16}],"RABOOT":[{"to":"CINDERACE","level":35}],"SOBBLE":[{"to":"DRIZZILE","level":16}],"DRIZZILE":[{"to":"INTELEON","level":35}],"SPRIGATITO":[{"to":"FLORAGATO","level":16}],"FLORAGATO":[{"to":"MEOWSCARADA","level":36}],"FUECOCO":[{"to":"CROCALOR","level":16}],"CROCALOR":[{"to":"SKELEDIRGE","level":36}],"QUAXLY":[{"to":"QUAXWELL","level":16}],"QUAXWELL":[{"to":"QUAQUAVAL","level":36}],"EEVEE":[{"to":"VAPOREON","level":25,"standIn":true},{"to":"JOLTEON","level":25,"standIn":true},{"to":"FLAREON","level":25,"standIn":true},{"to":"ESPEON","level":25,"standIn":true},{"to":"UMBREON","level":25,"standIn":true},{"to":"LEAFEON","level":25,"standIn":true},{"to":"GLACEON","level":25,"standIn":true},{"to":"SYLVEON","level":25,"standIn":true}],"RIOLU":[{"to":"LUCARIO","level":25,"standIn":true}],"DREEPY":[{"to":"DRAKLOAK","level":50}],"DRAKLOAK":[{"to":"DRAGAPULT","level":60}],"GIBLE":[{"to":"GABITE","level":24}],"GABITE":[{"to":"GARCHOMP","level":48}],"PICHU":[{"to":"PIKACHU","level":15,"standIn":true}],"PIKACHU":[{"to":"RAICHU","level":40,"standIn":true}],"MAGIKARP":[{"to":"GYARADOS","level":20}],"LARVITAR":[{"to":"PUPITAR","level":30}],"PUPITAR":[{"to":"TYRANITAR","level":55}],"WOOPER":[{"to":"QUAGSIRE","level":20}],"BIDOOF":[{"to":"BIBAREL","level":15}],"PSYDUCK":[{"to":"GOLDUCK","level":33}],"PIDGEY":[{"to":"PIDGEOTTO","level":18}],"PIDGEOTTO":[{"to":"PIDGEOT","level":36}],"HOOTHOOT":[{"to":"NOCTOWL","level":20}],"AIPOM":[{"to":"AMBIPOM","level":32,"standIn":true}],"LICKITUNG":[{"to":"LICKILICKY","level":33,"standIn":true}],"GASTLY":[{"to":"HAUNTER","level":25}],"HAUNTER":[{"to":"GENGAR","level":40,"standIn":true}],"MAGNEMITE":[{"to":"MAGNETON","level":30}],"MAGNETON":[{"to":"MAGNEZONE","level":40,"standIn":true}],"SEEL":[{"to":"DEWGONG","level":34}],"SWINUB":[{"to":"PILOSWINE","level":33}],"PILOSWINE":[{"to":"MAMOSWINE","level":40,"standIn":true}],"HORSEA":[{"to":"SEADRA","level":32}],"SEADRA":[{"to":"KINGDRA","level":40,"standIn":true}]}}
const ART = {"1":"/rpg/a/1.gif","2":"/rpg/a/2.gif","3":"/rpg/a/3.gif","4":"/rpg/a/4.gif","5":"/rpg/a/5.gif","6":"/rpg/a/6.gif","7":"/rpg/a/7.gif","8":"/rpg/a/8.gif","9":"/rpg/a/9.gif","11":"/rpg/a/11.gif","14":"/rpg/a/14.gif","16":"/rpg/a/16.gif","17":"/rpg/a/17.gif","18":"/rpg/a/18.gif","25":"/rpg/a/25.gif","26":"/rpg/a/26.gif","35":"/rpg/a/35.gif","38":"/rpg/a/38.gif","39":"/rpg/a/39.gif","45":"/rpg/a/45.gif","49":"/rpg/a/49.gif","53":"/rpg/a/53.gif","54":"/rpg/a/54.gif","55":"/rpg/a/55.gif","57":"/rpg/a/57.gif","58":"/rpg/a/58.gif","59":"/rpg/a/59.gif","62":"/rpg/a/62.gif","64":"/rpg/a/64.gif","65":"/rpg/a/65.gif","67":"/rpg/a/67.gif","68":"/rpg/a/68.gif","71":"/rpg/a/71.gif","75":"/rpg/a/75.gif","76":"/rpg/a/76.gif","78":"/rpg/a/78.gif","79":"/rpg/a/79.gif","80":"/rpg/a/80.gif","81":"/rpg/a/81.gif","82":"/rpg/a/82.gif","86":"/rpg/a/86.gif","87":"/rpg/a/87.gif","89":"/rpg/a/89.gif","92":"/rpg/a/92.gif","93":"/rpg/a/93.gif","94":"/rpg/a/94.gif","95":"/rpg/a/95.gif","96":"/rpg/a/96.gif","101":"/rpg/a/101.gif","103":"/rpg/a/103.gif","106":"/rpg/a/106.gif","107":"/rpg/a/107.gif","108":"/rpg/a/108.gif","110":"/rpg/a/110.gif","111":"/rpg/a/111.gif","112":"/rpg/a/112.gif","113":"/rpg/a/113.gif","114":"/rpg/a/114.gif","116":"/rpg/a/116.gif","117":"/rpg/a/117.gif","119":"/rpg/a/119.gif","121":"/rpg/a/121.gif","122":"/rpg/a/122.gif","123":"/rpg/a/123.gif","124":"/rpg/a/124.gif","125":"/rpg/a/125.gif","126":"/rpg/a/126.gif","129":"/rpg/a/129.gif","130":"/rpg/a/130.gif","131":"/rpg/a/131.gif","132":"/rpg/a/132.gif","133":"/rpg/a/133.gif","134":"/rpg/a/134.gif","135":"/rpg/a/135.gif","136":"/rpg/a/136.gif","137":"/rpg/a/137.gif","139":"/rpg/a/139.gif","141":"/rpg/a/141.gif","142":"/rpg/a/142.gif","143":"/rpg/a/143.gif","148":"/rpg/a/148.gif","149":"/rpg/a/149.gif","152":"/rpg/a/152.gif","153":"/rpg/a/153.gif","154":"/rpg/a/154.gif","155":"/rpg/a/155.gif","156":"/rpg/a/156.gif","157":"/rpg/a/157.gif","158":"/rpg/a/158.gif","159":"/rpg/a/159.gif","160":"/rpg/a/160.gif","163":"/rpg/a/163.gif","164":"/rpg/a/164.gif","168":"/rpg/a/168.gif","169":"/rpg/a/169.gif","172":"/rpg/a/172.gif","177":"/rpg/a/177.gif","178":"/rpg/a/178.gif","182":"/rpg/a/182.gif","189":"/rpg/a/189.gif","190":"/rpg/a/190.gif","191":"/rpg/a/191.gif","194":"/rpg/a/194.gif","195":"/rpg/a/195.gif","196":"/rpg/a/196.gif","197":"/rpg/a/197.gif","198":"/rpg/a/198.gif","200":"/rpg/a/200.gif","205":"/rpg/a/205.gif","208":"/rpg/a/208.gif","219":"/rpg/a/219.gif","220":"/rpg/a/220.gif","221":"/rpg/a/221.gif","227":"/rpg/a/227.gif","229":"/rpg/a/229.gif","230":"/rpg/a/230.gif","235":"/rpg/a/235.gif","237":"/rpg/a/237.gif","241":"/rpg/a/241.gif","242":"/rpg/a/242.gif","243":"/rpg/a/243.gif","244":"/rpg/a/244.gif","245":"/rpg/a/245.gif","246":"/rpg/a/246.gif","247":"/rpg/a/247.gif","248":"/rpg/a/248.gif","252":"/rpg/a/252.gif","253":"/rpg/a/253.gif","254":"/rpg/a/254.gif","255":"/rpg/a/255.gif","256":"/rpg/a/256.gif","257":"/rpg/a/257.gif","258":"/rpg/a/258.gif","259":"/rpg/a/259.gif","260":"/rpg/a/260.gif","287":"/rpg/a/287.gif","300":"/rpg/a/300.gif","302":"/rpg/a/302.gif","303":"/rpg/a/303.gif","311":"/rpg/a/311.gif","312":"/rpg/a/312.gif","357":"/rpg/a/357.gif","387":"/rpg/a/387.gif","388":"/rpg/a/388.gif","389":"/rpg/a/389.gif","390":"/rpg/a/390.gif","391":"/rpg/a/391.gif","392":"/rpg/a/392.gif","393":"/rpg/a/393.gif","394":"/rpg/a/394.gif","395":"/rpg/a/395.gif","399":"/rpg/a/399.gif","400":"/rpg/a/400.gif","424":"/rpg/a/424.gif","441":"/rpg/a/441.gif","443":"/rpg/a/443.gif","444":"/rpg/a/444.gif","445":"/rpg/a/445.gif","447":"/rpg/a/447.gif","448":"/rpg/a/448.gif","450":"/rpg/a/450.gif","453":"/rpg/a/453.gif","462":"/rpg/a/462.gif","463":"/rpg/a/463.gif","470":"/rpg/a/470.gif","471":"/rpg/a/471.gif","473":"/rpg/a/473.gif","479":"/rpg/a/479.gif","495":"/rpg/a/495.gif","496":"/rpg/a/496.gif","497":"/rpg/a/497.gif","498":"/rpg/a/498.gif","499":"/rpg/a/499.gif","500":"/rpg/a/500.gif","501":"/rpg/a/501.gif","502":"/rpg/a/502.gif","503":"/rpg/a/503.gif","504":"/rpg/a/504.gif","505":"/rpg/a/505.gif","509":"/rpg/a/509.gif","510":"/rpg/a/510.gif","569":"/rpg/a/569.gif","650":"/rpg/a/650.gif","651":"/rpg/a/651.gif","652":"/rpg/a/652.gif","653":"/rpg/a/653.gif","654":"/rpg/a/654.gif","655":"/rpg/a/655.gif","656":"/rpg/a/656.gif","657":"/rpg/a/657.gif","658":"/rpg/a/658.gif","700":"/rpg/a/700.gif","722":"/rpg/a/722.gif","723":"/rpg/a/723.gif","724":"/rpg/a/724.gif","725":"/rpg/a/725.gif","726":"/rpg/a/726.gif","727":"/rpg/a/727.gif","728":"/rpg/a/728.gif","729":"/rpg/a/729.gif","730":"/rpg/a/730.gif","778":"/rpg/a/778.gif","810":"/rpg/a/810.gif","811":"/rpg/a/811.gif","812":"/rpg/a/812.gif","813":"/rpg/a/813.gif","814":"/rpg/a/814.gif","815":"/rpg/a/815.gif","816":"/rpg/a/816.gif","817":"/rpg/a/817.gif","818":"/rpg/a/818.gif","819":"/rpg/a/819.gif","820":"/rpg/a/820.gif","885":"/rpg/a/885.gif","886":"/rpg/a/886.gif","887":"/rpg/a/887.gif","906":"/rpg/a/906.gif","907":"/rpg/a/907.gif","908":"/rpg/a/908.gif","909":"/rpg/a/909.gif","910":"/rpg/a/910.gif","911":"/rpg/a/911.gif","912":"/rpg/a/912.gif","913":"/rpg/a/913.gif","914":"/rpg/a/914.gif","1000":"/rpg/a/1000.gif","1b":"/rpg/a/1-back.gif","4b":"/rpg/a/4-back.gif","7b":"/rpg/a/7-back.gif","152b":"/rpg/a/152-back.gif","155b":"/rpg/a/155-back.gif","158b":"/rpg/a/158-back.gif","252b":"/rpg/a/252-back.gif","255b":"/rpg/a/255-back.gif","258b":"/rpg/a/258-back.gif","387b":"/rpg/a/387-back.gif","390b":"/rpg/a/390-back.gif","393b":"/rpg/a/393-back.gif","495b":"/rpg/a/495-back.gif","498b":"/rpg/a/498-back.gif","501b":"/rpg/a/501-back.gif","650b":"/rpg/a/650-back.gif","653b":"/rpg/a/653-back.gif","656b":"/rpg/a/656-back.gif","722b":"/rpg/a/722-back.gif","725b":"/rpg/a/725-back.gif","728b":"/rpg/a/728-back.gif","810b":"/rpg/a/810-back.gif","813b":"/rpg/a/813-back.gif","816b":"/rpg/a/816-back.gif","906b":"/rpg/a/906-back.gif","909b":"/rpg/a/909-back.gif","912b":"/rpg/a/912-back.gif","133b":"/rpg/a/133-back.gif","447b":"/rpg/a/447-back.gif","885b":"/rpg/a/885-back.gif","443b":"/rpg/a/443-back.gif","172b":"/rpg/a/172-back.gif","129b":"/rpg/a/129-back.gif","246b":"/rpg/a/246-back.gif","194b":"/rpg/a/194-back.gif","399b":"/rpg/a/399-back.gif","54b":"/rpg/a/54-back.gif","16b":"/rpg/a/16-back.gif","163b":"/rpg/a/163-back.gif","190b":"/rpg/a/190-back.gif","108b":"/rpg/a/108-back.gif","92b":"/rpg/a/92-back.gif","81b":"/rpg/a/81-back.gif","86b":"/rpg/a/86-back.gif","220b":"/rpg/a/220-back.gif","116b":"/rpg/a/116-back.gif","1000b":"/rpg/a/1000-back.gif","450b":"/rpg/a/450-back.gif","53b":"/rpg/a/53-back.gif","302b":"/rpg/a/302-back.gif","303b":"/rpg/a/303-back.gif","820b":"/rpg/a/820-back.gif","143b":"/rpg/a/143-back.gif","569b":"/rpg/a/569-back.gif","191b":"/rpg/a/191-back.gif","137b":"/rpg/a/137-back.gif","17b":"/rpg/a/17-back.gif","11b":"/rpg/a/11-back.gif","14b":"/rpg/a/14-back.gif","123b":"/rpg/a/123-back.gif","35b":"/rpg/a/35-back.gif","241b":"/rpg/a/241-back.gif","93b":"/rpg/a/93-back.gif","200b":"/rpg/a/200-back.gif","94b":"/rpg/a/94-back.gif","57b":"/rpg/a/57-back.gif","67b":"/rpg/a/67-back.gif","106b":"/rpg/a/106-back.gif","107b":"/rpg/a/107-back.gif","62b":"/rpg/a/62-back.gif","227b":"/rpg/a/227-back.gif","205b":"/rpg/a/205-back.gif","208b":"/rpg/a/208-back.gif","87b":"/rpg/a/87-back.gif","124b":"/rpg/a/124-back.gif","131b":"/rpg/a/131-back.gif","221b":"/rpg/a/221-back.gif","117b":"/rpg/a/117-back.gif","130b":"/rpg/a/130-back.gif","148b":"/rpg/a/148-back.gif","230b":"/rpg/a/230-back.gif","300b":"/rpg/a/300-back.gif","113b":"/rpg/a/113-back.gif","242b":"/rpg/a/242-back.gif","504b":"/rpg/a/504-back.gif","505b":"/rpg/a/505-back.gif","287b":"/rpg/a/287-back.gif","96b":"/rpg/a/96-back.gif","39b":"/rpg/a/39-back.gif","311b":"/rpg/a/311-back.gif","312b":"/rpg/a/312-back.gif","25b":"/rpg/a/25-back.gif","441b":"/rpg/a/441-back.gif","479b":"/rpg/a/479-back.gif","819b":"/rpg/a/819-back.gif","357b":"/rpg/a/357-back.gif","58b":"/rpg/a/58-back.gif","59b":"/rpg/a/59-back.gif","79b":"/rpg/a/79-back.gif","177b":"/rpg/a/177-back.gif","64b":"/rpg/a/64-back.gif","509b":"/rpg/a/509-back.gif","453b":"/rpg/a/453-back.gif","510b":"/rpg/a/510-back.gif","132b":"/rpg/a/132-back.gif","235b":"/rpg/a/235-back.gif","778b":"/rpg/a/778-back.gif","178b":"/rpg/a/178-back.gif","103b":"/rpg/a/103-back.gif","80b":"/rpg/a/80-back.gif","168b":"/rpg/a/168-back.gif","49b":"/rpg/a/49-back.gif","89b":"/rpg/a/89-back.gif","169b":"/rpg/a/169-back.gif","237b":"/rpg/a/237-back.gif","95b":"/rpg/a/95-back.gif","68b":"/rpg/a/68-back.gif","197b":"/rpg/a/197-back.gif","45b":"/rpg/a/45-back.gif","198b":"/rpg/a/198-back.gif","229b":"/rpg/a/229-back.gif","149b":"/rpg/a/149-back.gif","6b":"/rpg/a/6-back.gif","142b":"/rpg/a/142-back.gif","75b":"/rpg/a/75-back.gif","111b":"/rpg/a/111-back.gif","139b":"/rpg/a/139-back.gif","141b":"/rpg/a/141-back.gif","55b":"/rpg/a/55-back.gif","195b":"/rpg/a/195-back.gif","121b":"/rpg/a/121-back.gif","119b":"/rpg/a/119-back.gif","26b":"/rpg/a/26-back.gif","101b":"/rpg/a/101-back.gif","82b":"/rpg/a/82-back.gif","125b":"/rpg/a/125-back.gif","114b":"/rpg/a/114-back.gif","189b":"/rpg/a/189-back.gif","71b":"/rpg/a/71-back.gif","182b":"/rpg/a/182-back.gif","110b":"/rpg/a/110-back.gif","196b":"/rpg/a/196-back.gif","122b":"/rpg/a/122-back.gif","65b":"/rpg/a/65-back.gif","219b":"/rpg/a/219-back.gif","38b":"/rpg/a/38-back.gif","126b":"/rpg/a/126-back.gif","78b":"/rpg/a/78-back.gif","18b":"/rpg/a/18-back.gif","112b":"/rpg/a/112-back.gif","243b":"/rpg/a/243-back.gif","244b":"/rpg/a/244-back.gif","245b":"/rpg/a/245-back.gif","76b":"/rpg/a/76-back.gif","2b":"/rpg/a/2-back.gif","3b":"/rpg/a/3-back.gif","5b":"/rpg/a/5-back.gif","8b":"/rpg/a/8-back.gif","9b":"/rpg/a/9-back.gif","153b":"/rpg/a/153-back.gif","154b":"/rpg/a/154-back.gif","156b":"/rpg/a/156-back.gif","157b":"/rpg/a/157-back.gif","159b":"/rpg/a/159-back.gif","160b":"/rpg/a/160-back.gif","253b":"/rpg/a/253-back.gif","254b":"/rpg/a/254-back.gif","256b":"/rpg/a/256-back.gif","257b":"/rpg/a/257-back.gif","259b":"/rpg/a/259-back.gif","260b":"/rpg/a/260-back.gif","388b":"/rpg/a/388-back.gif","389b":"/rpg/a/389-back.gif","391b":"/rpg/a/391-back.gif","392b":"/rpg/a/392-back.gif","394b":"/rpg/a/394-back.gif","395b":"/rpg/a/395-back.gif","496b":"/rpg/a/496-back.gif","497b":"/rpg/a/497-back.gif","499b":"/rpg/a/499-back.gif","500b":"/rpg/a/500-back.gif","502b":"/rpg/a/502-back.gif","503b":"/rpg/a/503-back.gif","651b":"/rpg/a/651-back.gif","652b":"/rpg/a/652-back.gif","654b":"/rpg/a/654-back.gif","655b":"/rpg/a/655-back.gif","657b":"/rpg/a/657-back.gif","658b":"/rpg/a/658-back.gif","723b":"/rpg/a/723-back.gif","724b":"/rpg/a/724-back.gif","726b":"/rpg/a/726-back.gif","727b":"/rpg/a/727-back.gif","729b":"/rpg/a/729-back.gif","730b":"/rpg/a/730-back.gif","811b":"/rpg/a/811-back.gif","812b":"/rpg/a/812-back.gif","814b":"/rpg/a/814-back.gif","815b":"/rpg/a/815-back.gif","817b":"/rpg/a/817-back.gif","818b":"/rpg/a/818-back.gif","907b":"/rpg/a/907-back.gif","908b":"/rpg/a/908-back.gif","910b":"/rpg/a/910-back.gif","911b":"/rpg/a/911-back.gif","913b":"/rpg/a/913-back.gif","914b":"/rpg/a/914-back.gif","134b":"/rpg/a/134-back.gif","135b":"/rpg/a/135-back.gif","136b":"/rpg/a/136-back.gif","470b":"/rpg/a/470-back.gif","471b":"/rpg/a/471-back.gif","700b":"/rpg/a/700-back.gif","448b":"/rpg/a/448-back.gif","886b":"/rpg/a/886-back.gif","887b":"/rpg/a/887-back.gif","444b":"/rpg/a/444-back.gif","445b":"/rpg/a/445-back.gif","247b":"/rpg/a/247-back.gif","248b":"/rpg/a/248-back.gif","400b":"/rpg/a/400-back.gif","164b":"/rpg/a/164-back.gif","424b":"/rpg/a/424-back.gif","463b":"/rpg/a/463-back.gif","462b":"/rpg/a/462-back.gif","473b":"/rpg/a/473-back.gif","herbVs":"/rpg/a/herb-vs.jpg","herbFace":"/rpg/a/herb-face.jpg","herbBody":"/rpg/a/herb-body.png","herbDown":"/rpg/a/herb-defeated.png","herbFaceDown":"/rpg/a/herb-face-down.jpg","brianVs":"/rpg/a/brian-vs.jpg","brianFace":"/rpg/a/brian-face.jpg","brianBody":"/rpg/a/brian-body.png","brianDown":"/rpg/a/brian-defeated.png","brianFaceDown":"/rpg/a/brian-face-down.jpg","alexVs":"/rpg/a/alex-vs.jpg","alexFace":"/rpg/a/alex-face.jpg","alexBody":"/rpg/a/alex-body.png","gymBody:falkner":"/rpg/a/gym-falkner-body.png","gymFace:falkner":"/rpg/a/gym-falkner-face.jpg","gymVs:falkner":"/rpg/a/gym-falkner-vs.jpg","gymBody:bugsy":"/rpg/a/gym-bugsy-body.png","gymFace:bugsy":"/rpg/a/gym-bugsy-face.jpg","gymVs:bugsy":"/rpg/a/gym-bugsy-vs.jpg","gymBody:whitney":"/rpg/a/gym-whitney-body.png","gymFace:whitney":"/rpg/a/gym-whitney-face.jpg","gymVs:whitney":"/rpg/a/gym-whitney-vs.jpg","gymBody:morty":"/rpg/a/gym-morty-body.png","gymFace:morty":"/rpg/a/gym-morty-face.jpg","gymVs:morty":"/rpg/a/gym-morty-vs.jpg","gymBody:chuck":"/rpg/a/gym-chuck-body.png","gymFace:chuck":"/rpg/a/gym-chuck-face.jpg","gymVs:chuck":"/rpg/a/gym-chuck-vs.jpg","gymBody:jasmine":"/rpg/a/gym-jasmine-body.png","gymFace:jasmine":"/rpg/a/gym-jasmine-face.jpg","gymVs:jasmine":"/rpg/a/gym-jasmine-vs.jpg","gymBody:pryce":"/rpg/a/gym-pryce-body.png","gymFace:pryce":"/rpg/a/gym-pryce-face.jpg","gymVs:pryce":"/rpg/a/gym-pryce-vs.jpg","gymBody:clair":"/rpg/a/gym-clair-body.png","gymFace:clair":"/rpg/a/gym-clair-face.jpg","gymVs:clair":"/rpg/a/gym-clair-vs.jpg","gymBody:will":"/rpg/a/gym-will-body.png","gymFace:will":"/rpg/a/gym-will-face.jpg","gymVs:will":"/rpg/a/gym-will-vs.jpg","gymBody:koga":"/rpg/a/gym-koga-body.png","gymFace:koga":"/rpg/a/gym-koga-face.jpg","gymVs:koga":"/rpg/a/gym-koga-vs.jpg","gymBody:bruno":"/rpg/a/gym-bruno-body.png","gymFace:bruno":"/rpg/a/gym-bruno-face.jpg","gymVs:bruno":"/rpg/a/gym-bruno-vs.jpg","gymBody:karen":"/rpg/a/gym-karen-body.png","gymFace:karen":"/rpg/a/gym-karen-face.jpg","gymVs:karen":"/rpg/a/gym-karen-vs.jpg","gymBody:lance":"/rpg/a/gym-lance-body.png","gymFace:lance":"/rpg/a/gym-lance-face.jpg","gymVs:lance":"/rpg/a/gym-lance-vs.jpg","gymBody:brock":"/rpg/a/gym-brock-body.png","gymFace:brock":"/rpg/a/gym-brock-face.jpg","gymVs:brock":"/rpg/a/gym-brock-vs.jpg","gymBody:misty":"/rpg/a/gym-misty-body.png","gymFace:misty":"/rpg/a/gym-misty-face.jpg","gymVs:misty":"/rpg/a/gym-misty-vs.jpg","gymBody:lt_surge":"/rpg/a/gym-lt_surge-body.png","gymFace:lt_surge":"/rpg/a/gym-lt_surge-face.jpg","gymVs:lt_surge":"/rpg/a/gym-lt_surge-vs.jpg","gymBody:erika":"/rpg/a/gym-erika-body.png","gymFace:erika":"/rpg/a/gym-erika-face.jpg","gymVs:erika":"/rpg/a/gym-erika-vs.jpg","gymBody:janine":"/rpg/a/gym-janine-body.png","gymFace:janine":"/rpg/a/gym-janine-face.jpg","gymVs:janine":"/rpg/a/gym-janine-vs.jpg","gymBody:sabrina":"/rpg/a/gym-sabrina-body.png","gymFace:sabrina":"/rpg/a/gym-sabrina-face.jpg","gymVs:sabrina":"/rpg/a/gym-sabrina-vs.jpg","gymBody:blaine":"/rpg/a/gym-blaine-body.png","gymFace:blaine":"/rpg/a/gym-blaine-face.jpg","gymVs:blaine":"/rpg/a/gym-blaine-vs.jpg","gymBody:blue":"/rpg/a/gym-blue-body.png","gymFace:blue":"/rpg/a/gym-blue-face.jpg","gymVs:blue":"/rpg/a/gym-blue-vs.jpg","roseVs":"/rpg/a/crew-rose-vs.jpg","roseFace":"/rpg/a/crew-rose-face.jpg","roseBody":"/rpg/a/crew-rose-body.webp","roseDown":"/rpg/a/crew-rose-down.webp","roseFaceDown":"/rpg/a/crew-rose-facedown.jpg","derekVs":"/rpg/a/crew-derek-vs.jpg","derekFace":"/rpg/a/crew-derek-face.jpg","derekBody":"/rpg/a/crew-derek-body.webp","derekDown":"/rpg/a/crew-derek-down.webp","derekFaceDown":"/rpg/a/crew-derek-facedown.jpg","nateVs":"/rpg/a/crew-nate-vs.jpg","nateFace":"/rpg/a/crew-nate-face.jpg","nateBody":"/rpg/a/crew-nate-body.webp","nateDown":"/rpg/a/crew-nate-down.webp","nateFaceDown":"/rpg/a/crew-nate-facedown.jpg","hanaVs":"/rpg/a/crew-hana-vs.jpg","hanaFace":"/rpg/a/crew-hana-face.jpg","hanaBody":"/rpg/a/crew-hana-body.webp","hanaDown":"/rpg/a/crew-hana-down.webp","hanaFaceDown":"/rpg/a/crew-hana-facedown.jpg","tylerVs":"/rpg/a/crew-tyler-vs.jpg","tylerFace":"/rpg/a/crew-tyler-face.jpg","tylerBody":"/rpg/a/crew-tyler-body.webp","tylerDown":"/rpg/a/crew-tyler-down.webp","tylerFaceDown":"/rpg/a/crew-tyler-facedown.jpg","danaVs":"/rpg/a/crew-dana-vs.jpg","danaFace":"/rpg/a/crew-dana-face.jpg","danaBody":"/rpg/a/crew-dana-body.webp","danaDown":"/rpg/a/crew-dana-down.webp","danaFaceDown":"/rpg/a/crew-dana-facedown.jpg","marcusVs":"/rpg/a/crew-marcus-vs.jpg","marcusFace":"/rpg/a/crew-marcus-face.jpg","marcusBody":"/rpg/a/crew-marcus-body.webp","marcusDown":"/rpg/a/crew-marcus-down.webp","marcusFaceDown":"/rpg/a/crew-marcus-facedown.jpg","grantVs":"/rpg/a/crew-grant-vs.jpg","grantFace":"/rpg/a/crew-grant-face.jpg","grantBody":"/rpg/a/crew-grant-body.webp","grantDown":"/rpg/a/crew-grant-down.webp","grantFaceDown":"/rpg/a/crew-grant-facedown.jpg","kyleVs":"/rpg/a/crew-kyle-vs.jpg","kyleFace":"/rpg/a/crew-kyle-face.jpg","kyleBody":"/rpg/a/crew-kyle-body.webp","kyleDown":"/rpg/a/crew-kyle-down.webp","kyleFaceDown":"/rpg/a/crew-kyle-facedown.jpg","mikaVs":"/rpg/a/crew-mika-vs.jpg","mikaFace":"/rpg/a/crew-mika-face.jpg","mikaBody":"/rpg/a/crew-mika-body.webp","mikaDown":"/rpg/a/crew-mika-down.webp","mikaFaceDown":"/rpg/a/crew-mika-facedown.jpg","paulVs":"/rpg/a/paul-vs.jpg","paulFace":"/rpg/a/paul-face.jpg","paulBody":"/rpg/a/paul-body.png","paulDown":"/rpg/a/paul-defeated.png","paulFaceDown":"/rpg/a/paul-face-down.jpg","jungle-scyther":"/rpg/a/jungle-scyther.webp","fossil-lapras":"/rpg/a/fossil-lapras.webp","team-rocket-giovanni":"/rpg/a/team-rocket-giovanni.webp","gym-heroes-brock":"/rpg/a/gym-heroes-brock.webp","pack:fossil-aerodactyl":"/rpg/a/attract/fossil-aerodactyl.webp","pack:fossil-lapras":"/rpg/a/attract/fossil-lapras.webp","pack:fossil-zapdos":"/rpg/a/attract/fossil-zapdos.webp","pack:gym-challenge-blaine":"/rpg/a/attract/gym-challenge-blaine.webp","pack:gym-challenge-giovanni":"/rpg/a/attract/gym-challenge-giovanni.webp","pack:gym-challenge-koga":"/rpg/a/attract/gym-challenge-koga.webp","pack:gym-challenge-sabrina":"/rpg/a/attract/gym-challenge-sabrina.webp","pack:gym-heroes-brock":"/rpg/a/attract/gym-heroes-brock.webp","pack:gym-heroes-erika":"/rpg/a/attract/gym-heroes-erika.webp","pack:gym-heroes-lt-surge":"/rpg/a/attract/gym-heroes-lt-surge.webp","pack:gym-heroes-misty":"/rpg/a/attract/gym-heroes-misty.webp","pack:jungle-flareon":"/rpg/a/attract/jungle-flareon.webp","pack:jungle-scyther":"/rpg/a/attract/jungle-scyther.webp","pack:jungle-wigglytuff":"/rpg/a/attract/jungle-wigglytuff.webp","pack:team-rocket-dark-gyarados":"/rpg/a/attract/team-rocket-dark-gyarados.webp","pack:team-rocket-giovanni":"/rpg/a/attract/team-rocket-giovanni.webp","pack:team-rocket-jessie-james":"/rpg/a/attract/team-rocket-jessie-james.webp","pack:team-rocket-rocket-gang":"/rpg/a/attract/team-rocket-rocket-gang.webp","maint:art":"/rpg/a/maint/art.webp","maint:logo":"/rpg/a/maint/logo.webp","maint:qr":"/rpg/a/maint/qr.webp","item:antidote":"/rpg/a/items/antidote.png","item:ball":"/rpg/a/items/ball.png","item:burnheal":"/rpg/a/items/burnheal.png","item:dragonscale":"/rpg/a/items/dragonscale.png","item:expshare":"/rpg/a/items/expshare.png","item:firestone":"/rpg/a/items/firestone.png","item:fullheal":"/rpg/a/items/fullheal.png","item:great":"/rpg/a/items/great.png","item:iceheal":"/rpg/a/items/iceheal.png","item:icestone":"/rpg/a/items/icestone.png","item:leafstone":"/rpg/a/items/leafstone.png","item:linkcable":"/rpg/a/items/linkcable.png","item:parlyz":"/rpg/a/items/parlyz.png","item:potion":"/rpg/a/items/potion.png","item:revive":"/rpg/a/items/revive.png","item:super":"/rpg/a/items/super.png","item:thunderstone":"/rpg/a/items/thunderstone.png","item:waterstone":"/rpg/a/items/waterstone.png","badge:boulder":"/rpg/a/badges/boulder.png","badge:cascade":"/rpg/a/badges/cascade.png","badge:earth":"/rpg/a/badges/earth.png","badge:fog":"/rpg/a/badges/fog.png","badge:glacier":"/rpg/a/badges/glacier.png","badge:hive":"/rpg/a/badges/hive.png","badge:marsh":"/rpg/a/badges/marsh.png","badge:mineral":"/rpg/a/badges/mineral.png","badge:plain":"/rpg/a/badges/plain.png","badge:rainbow":"/rpg/a/badges/rainbow.png","badge:rising":"/rpg/a/badges/rising.png","badge:soul":"/rpg/a/badges/soul.png","badge:storm":"/rpg/a/badges/storm.png","badge:thunder":"/rpg/a/badges/thunder.png","badge:volcano":"/rpg/a/badges/volcano.png","badge:zephyr":"/rpg/a/badges/zephyr.png","cry:1":"/rpg/a/cries/1.ogg","cry:1000":"/rpg/a/cries/1000.ogg","cry:106":"/rpg/a/cries/106.ogg","cry:107":"/rpg/a/cries/107.ogg","cry:108":"/rpg/a/cries/108.ogg","cry:11":"/rpg/a/cries/11.ogg","cry:113":"/rpg/a/cries/113.ogg","cry:116":"/rpg/a/cries/116.ogg","cry:117":"/rpg/a/cries/117.ogg","cry:123":"/rpg/a/cries/123.ogg","cry:124":"/rpg/a/cries/124.ogg","cry:129":"/rpg/a/cries/129.ogg","cry:130":"/rpg/a/cries/130.ogg","cry:131":"/rpg/a/cries/131.ogg","cry:132":"/rpg/a/cries/132.ogg","cry:133":"/rpg/a/cries/133.ogg","cry:134":"/rpg/a/cries/134.ogg","cry:135":"/rpg/a/cries/135.ogg","cry:136":"/rpg/a/cries/136.ogg","cry:137":"/rpg/a/cries/137.ogg","cry:14":"/rpg/a/cries/14.ogg","cry:143":"/rpg/a/cries/143.ogg","cry:148":"/rpg/a/cries/148.ogg","cry:152":"/rpg/a/cries/152.ogg","cry:153":"/rpg/a/cries/153.ogg","cry:154":"/rpg/a/cries/154.ogg","cry:155":"/rpg/a/cries/155.ogg","cry:156":"/rpg/a/cries/156.ogg","cry:157":"/rpg/a/cries/157.ogg","cry:158":"/rpg/a/cries/158.ogg","cry:159":"/rpg/a/cries/159.ogg","cry:16":"/rpg/a/cries/16.ogg","cry:160":"/rpg/a/cries/160.ogg","cry:163":"/rpg/a/cries/163.ogg","cry:164":"/rpg/a/cries/164.ogg","cry:17":"/rpg/a/cries/17.ogg","cry:172":"/rpg/a/cries/172.ogg","cry:177":"/rpg/a/cries/177.ogg","cry:190":"/rpg/a/cries/190.ogg","cry:191":"/rpg/a/cries/191.ogg","cry:194":"/rpg/a/cries/194.ogg","cry:2":"/rpg/a/cries/2.ogg","cry:200":"/rpg/a/cries/200.ogg","cry:205":"/rpg/a/cries/205.ogg","cry:208":"/rpg/a/cries/208.ogg","cry:220":"/rpg/a/cries/220.ogg","cry:221":"/rpg/a/cries/221.ogg","cry:227":"/rpg/a/cries/227.ogg","cry:230":"/rpg/a/cries/230.ogg","cry:235":"/rpg/a/cries/235.ogg","cry:241":"/rpg/a/cries/241.ogg","cry:242":"/rpg/a/cries/242.ogg","cry:243":"/rpg/a/cries/243.ogg","cry:244":"/rpg/a/cries/244.ogg","cry:245":"/rpg/a/cries/245.ogg","cry:246":"/rpg/a/cries/246.ogg","cry:247":"/rpg/a/cries/247.ogg","cry:248":"/rpg/a/cries/248.ogg","cry:25":"/rpg/a/cries/25.ogg","cry:252":"/rpg/a/cries/252.ogg","cry:253":"/rpg/a/cries/253.ogg","cry:254":"/rpg/a/cries/254.ogg","cry:255":"/rpg/a/cries/255.ogg","cry:256":"/rpg/a/cries/256.ogg","cry:257":"/rpg/a/cries/257.ogg","cry:258":"/rpg/a/cries/258.ogg","cry:259":"/rpg/a/cries/259.ogg","cry:260":"/rpg/a/cries/260.ogg","cry:287":"/rpg/a/cries/287.ogg","cry:3":"/rpg/a/cries/3.ogg","cry:300":"/rpg/a/cries/300.ogg","cry:302":"/rpg/a/cries/302.ogg","cry:303":"/rpg/a/cries/303.ogg","cry:311":"/rpg/a/cries/311.ogg","cry:312":"/rpg/a/cries/312.ogg","cry:35":"/rpg/a/cries/35.ogg","cry:357":"/rpg/a/cries/357.ogg","cry:387":"/rpg/a/cries/387.ogg","cry:388":"/rpg/a/cries/388.ogg","cry:389":"/rpg/a/cries/389.ogg","cry:39":"/rpg/a/cries/39.ogg","cry:390":"/rpg/a/cries/390.ogg","cry:391":"/rpg/a/cries/391.ogg","cry:392":"/rpg/a/cries/392.ogg","cry:393":"/rpg/a/cries/393.ogg","cry:394":"/rpg/a/cries/394.ogg","cry:395":"/rpg/a/cries/395.ogg","cry:399":"/rpg/a/cries/399.ogg","cry:4":"/rpg/a/cries/4.ogg","cry:400":"/rpg/a/cries/400.ogg","cry:424":"/rpg/a/cries/424.ogg","cry:441":"/rpg/a/cries/441.ogg","cry:443":"/rpg/a/cries/443.ogg","cry:444":"/rpg/a/cries/444.ogg","cry:445":"/rpg/a/cries/445.ogg","cry:447":"/rpg/a/cries/447.ogg","cry:448":"/rpg/a/cries/448.ogg","cry:450":"/rpg/a/cries/450.ogg","cry:453":"/rpg/a/cries/453.ogg","cry:462":"/rpg/a/cries/462.ogg","cry:463":"/rpg/a/cries/463.ogg","cry:470":"/rpg/a/cries/470.ogg","cry:471":"/rpg/a/cries/471.ogg","cry:473":"/rpg/a/cries/473.ogg","cry:479":"/rpg/a/cries/479.ogg","cry:495":"/rpg/a/cries/495.ogg","cry:496":"/rpg/a/cries/496.ogg","cry:497":"/rpg/a/cries/497.ogg","cry:498":"/rpg/a/cries/498.ogg","cry:499":"/rpg/a/cries/499.ogg","cry:5":"/rpg/a/cries/5.ogg","cry:500":"/rpg/a/cries/500.ogg","cry:501":"/rpg/a/cries/501.ogg","cry:502":"/rpg/a/cries/502.ogg","cry:503":"/rpg/a/cries/503.ogg","cry:504":"/rpg/a/cries/504.ogg","cry:505":"/rpg/a/cries/505.ogg","cry:509":"/rpg/a/cries/509.ogg","cry:510":"/rpg/a/cries/510.ogg","cry:53":"/rpg/a/cries/53.ogg","cry:54":"/rpg/a/cries/54.ogg","cry:569":"/rpg/a/cries/569.ogg","cry:57":"/rpg/a/cries/57.ogg","cry:58":"/rpg/a/cries/58.ogg","cry:59":"/rpg/a/cries/59.ogg","cry:62":"/rpg/a/cries/62.ogg","cry:64":"/rpg/a/cries/64.ogg","cry:650":"/rpg/a/cries/650.ogg","cry:651":"/rpg/a/cries/651.ogg","cry:652":"/rpg/a/cries/652.ogg","cry:653":"/rpg/a/cries/653.ogg","cry:654":"/rpg/a/cries/654.ogg","cry:655":"/rpg/a/cries/655.ogg","cry:656":"/rpg/a/cries/656.ogg","cry:657":"/rpg/a/cries/657.ogg","cry:658":"/rpg/a/cries/658.ogg","cry:67":"/rpg/a/cries/67.ogg","cry:7":"/rpg/a/cries/7.ogg","cry:700":"/rpg/a/cries/700.ogg","cry:722":"/rpg/a/cries/722.ogg","cry:723":"/rpg/a/cries/723.ogg","cry:724":"/rpg/a/cries/724.ogg","cry:725":"/rpg/a/cries/725.ogg","cry:726":"/rpg/a/cries/726.ogg","cry:727":"/rpg/a/cries/727.ogg","cry:728":"/rpg/a/cries/728.ogg","cry:729":"/rpg/a/cries/729.ogg","cry:730":"/rpg/a/cries/730.ogg","cry:76":"/rpg/a/cries/76.ogg","cry:778":"/rpg/a/cries/778.ogg","cry:79":"/rpg/a/cries/79.ogg","cry:8":"/rpg/a/cries/8.ogg","cry:81":"/rpg/a/cries/81.ogg","cry:810":"/rpg/a/cries/810.ogg","cry:811":"/rpg/a/cries/811.ogg","cry:812":"/rpg/a/cries/812.ogg","cry:813":"/rpg/a/cries/813.ogg","cry:814":"/rpg/a/cries/814.ogg","cry:815":"/rpg/a/cries/815.ogg","cry:816":"/rpg/a/cries/816.ogg","cry:817":"/rpg/a/cries/817.ogg","cry:818":"/rpg/a/cries/818.ogg","cry:819":"/rpg/a/cries/819.ogg","cry:820":"/rpg/a/cries/820.ogg","cry:86":"/rpg/a/cries/86.ogg","cry:87":"/rpg/a/cries/87.ogg","cry:885":"/rpg/a/cries/885.ogg","cry:886":"/rpg/a/cries/886.ogg","cry:887":"/rpg/a/cries/887.ogg","cry:9":"/rpg/a/cries/9.ogg","cry:906":"/rpg/a/cries/906.ogg","cry:907":"/rpg/a/cries/907.ogg","cry:908":"/rpg/a/cries/908.ogg","cry:909":"/rpg/a/cries/909.ogg","cry:910":"/rpg/a/cries/910.ogg","cry:911":"/rpg/a/cries/911.ogg","cry:912":"/rpg/a/cries/912.ogg","cry:913":"/rpg/a/cries/913.ogg","cry:914":"/rpg/a/cries/914.ogg","cry:92":"/rpg/a/cries/92.ogg","cry:93":"/rpg/a/cries/93.ogg","cry:94":"/rpg/a/cries/94.ogg","cry:96":"/rpg/a/cries/96.ogg","cry:980":"/rpg/a/cries/980.ogg","bg:aaron_day":"/rpg/a/bg/aaron_day.webp","bg:aaron_evening":"/rpg/a/bg/aaron_evening.webp","bg:aaron_night":"/rpg/a/bg/aaron_night.webp","bg:arcade_day":"/rpg/a/bg/arcade_day.webp","bg:arcade_evening":"/rpg/a/bg/arcade_evening.webp","bg:arcade_night":"/rpg/a/bg/arcade_night.webp","bg:beach_day":"/rpg/a/bg/beach_day.webp","bg:beach_evening":"/rpg/a/bg/beach_evening.webp","bg:beach_night":"/rpg/a/bg/beach_night.webp","bg:bertha_day":"/rpg/a/bg/bertha_day.webp","bg:bertha_evening":"/rpg/a/bg/bertha_evening.webp","bg:bertha_night":"/rpg/a/bg/bertha_night.webp","bg:castle_day":"/rpg/a/bg/castle_day.webp","bg:castle_evening":"/rpg/a/bg/castle_evening.webp","bg:castle_night":"/rpg/a/bg/castle_night.webp","bg:cave_1_day":"/rpg/a/bg/cave_1_day.webp","bg:cave_1_evening":"/rpg/a/bg/cave_1_evening.webp","bg:cave_1_night":"/rpg/a/bg/cave_1_night.webp","bg:cave_2_day":"/rpg/a/bg/cave_2_day.webp","bg:cave_2_evening":"/rpg/a/bg/cave_2_evening.webp","bg:cave_2_night":"/rpg/a/bg/cave_2_night.webp","bg:cave_3_day":"/rpg/a/bg/cave_3_day.webp","bg:cave_3_evening":"/rpg/a/bg/cave_3_evening.webp","bg:cave_3_night":"/rpg/a/bg/cave_3_night.webp","bg:city_day":"/rpg/a/bg/city_day.webp","bg:city_evening":"/rpg/a/bg/city_evening.webp","bg:city_night":"/rpg/a/bg/city_night.webp","bg:cynthia_day":"/rpg/a/bg/cynthia_day.webp","bg:cynthia_evening":"/rpg/a/bg/cynthia_evening.webp","bg:cynthia_night":"/rpg/a/bg/cynthia_night.webp","bg:distortion_day":"/rpg/a/bg/distortion_day.webp","bg:distortion_evening":"/rpg/a/bg/distortion_evening.webp","bg:distortion_night":"/rpg/a/bg/distortion_night.webp","bg:factory_day":"/rpg/a/bg/factory_day.webp","bg:factory_evening":"/rpg/a/bg/factory_evening.webp","bg:factory_night":"/rpg/a/bg/factory_night.webp","bg:flint_day":"/rpg/a/bg/flint_day.webp","bg:flint_evening":"/rpg/a/bg/flint_evening.webp","bg:flint_night":"/rpg/a/bg/flint_night.webp","bg:forest_day":"/rpg/a/bg/forest_day.webp","bg:forest_evening":"/rpg/a/bg/forest_evening.webp","bg:forest_night":"/rpg/a/bg/forest_night.webp","bg:hall_day":"/rpg/a/bg/hall_day.webp","bg:hall_evening":"/rpg/a/bg/hall_evening.webp","bg:hall_night":"/rpg/a/bg/hall_night.webp","bg:ice_day":"/rpg/a/bg/ice_day.webp","bg:ice_evening":"/rpg/a/bg/ice_evening.webp","bg:ice_night":"/rpg/a/bg/ice_night.webp","bg:indoors_1_day":"/rpg/a/bg/indoors_1_day.webp","bg:indoors_1_evening":"/rpg/a/bg/indoors_1_evening.webp","bg:indoors_1_night":"/rpg/a/bg/indoors_1_night.webp","bg:indoors_2_day":"/rpg/a/bg/indoors_2_day.webp","bg:indoors_2_evening":"/rpg/a/bg/indoors_2_evening.webp","bg:indoors_2_night":"/rpg/a/bg/indoors_2_night.webp","bg:indoors_3_day":"/rpg/a/bg/indoors_3_day.webp","bg:indoors_3_evening":"/rpg/a/bg/indoors_3_evening.webp","bg:indoors_3_night":"/rpg/a/bg/indoors_3_night.webp","bg:lucian_day":"/rpg/a/bg/lucian_day.webp","bg:lucian_evening":"/rpg/a/bg/lucian_evening.webp","bg:lucian_night":"/rpg/a/bg/lucian_night.webp","bg:marsh_day":"/rpg/a/bg/marsh_day.webp","bg:marsh_evening":"/rpg/a/bg/marsh_evening.webp","bg:marsh_night":"/rpg/a/bg/marsh_night.webp","bg:meadow_day":"/rpg/a/bg/meadow_day.webp","bg:meadow_evening":"/rpg/a/bg/meadow_evening.webp","bg:meadow_night":"/rpg/a/bg/meadow_night.webp","bg:mountain_day":"/rpg/a/bg/mountain_day.webp","bg:mountain_evening":"/rpg/a/bg/mountain_evening.webp","bg:mountain_night":"/rpg/a/bg/mountain_night.webp","bg:plain_day":"/rpg/a/bg/plain_day.webp","bg:plain_evening":"/rpg/a/bg/plain_evening.webp","bg:plain_night":"/rpg/a/bg/plain_night.webp","bg:puddles_day":"/rpg/a/bg/puddles_day.webp","bg:puddles_evening":"/rpg/a/bg/puddles_evening.webp","bg:puddles_night":"/rpg/a/bg/puddles_night.webp","bg:snow_day":"/rpg/a/bg/snow_day.webp","bg:snow_evening":"/rpg/a/bg/snow_evening.webp","bg:snow_night":"/rpg/a/bg/snow_night.webp","bg:tower_day":"/rpg/a/bg/tower_day.webp","bg:tower_evening":"/rpg/a/bg/tower_evening.webp","bg:tower_night":"/rpg/a/bg/tower_night.webp","bg:water_day":"/rpg/a/bg/water_day.webp","bg:water_evening":"/rpg/a/bg/water_evening.webp","bg:water_night":"/rpg/a/bg/water_night.webp"}   // id -> front GIF, `${id}b` -> back GIF

Object.assign(SFX, {
  rustle:  { file: null, synth: (ac, o, t) => { for (let i = 0; i < 3; i++) noise(ac, o, t + i * .11, { dur: .09, vol: .22, filter: 'bandpass', f: 2400, q: 1.2 }) } },
  bang:    { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 880, dur: .07, vol: .14 }); tone(ac, o, t + .08, { f: 1320, dur: .12, vol: .14 }) } },
  throw:   { file: null, synth: (ac, o, t) => noise(ac, o, t, { dur: .32, vol: .22, filter: 'bandpass', f: 500, f1: 2600, q: 1.4 }) },
  absorb:  { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'triangle', f: 400, f1: 1600, dur: .35, vol: .16 }); noise(ac, o, t, { dur: .3, vol: .08, filter: 'highpass', f: 4000 }) } },
  wobble:  { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'sine', f: 160, f1: 110, dur: .12, vol: .35 }); noise(ac, o, t, { dur: .05, vol: .15, filter: 'bandpass', f: 1200 }) } },
  click:   { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .03, vol: .35, filter: 'highpass', f: 3000 }); noise(ac, o, t + .07, { dur: .03, vol: .35, filter: 'highpass', f: 3000 }) } },
  breakout:{ file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .18, vol: .4, filter: 'bandpass', f: 1600, f1: 400, q: 1 }); tone(ac, o, t, { f: 900, f1: 300, dur: .2, vol: .14 }) } },
  heal:    { file: null, synth: (ac, o, t) => arp(ac, o, t, ['G5', 'C6', 'E6', 'G6', 'C7'], .07, .09) },
  run:     { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 900, f1: 300, dur: .25, vol: .1 }); noise(ac, o, t, { dur: .25, vol: .15, filter: 'bandpass', f: 2000, f1: 600 }) } },
})
SONGS.caught = { file: null, loop: false, bpm: 150, div: 2,
  lead: 'C5 E5 G5 C6 . B5 . G5 A5 . F5 . G5 . . . . . -'.split(' '),
  bass: 'C3 . G3 . C3 . E3 . F3 . A3 . G3 . . . . . -'.split(' '),
  drums: 'K.h.S.h.K.h.S.SSC.......'.slice(0, 19) }

/* The modern type chart, in full: attacking type -> defending type -> multiplier. */
const CHART = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon: { dragon: 2, steel: .5, fairy: 0 },
  dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
}
const gameMult = (type, def) => def.reduce((m, t) => m * (CHART[type]?.[t] ?? 1), 1)
function soften(m) {
  if (m === 0) return 0.5
  if (m >= 4) return 2
  if (m >= 2) return 1.5
  if (m <= 0.25) return 0.5
  if (m < 1) return 0.67
  return 1
}
const TYPE_COL = { normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', grass: '#7ac74c', electric: '#f7d02c', ice: '#96d9d6',
  fighting: '#c22e28', poison: '#a33ea1', ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746', steel: '#b7b7ce', fairy: '#d685ad' }

/* ── individual stats ── */
const NATURES = [['Hardy'], ['Lonely', 'atk', 'def'], ['Brave', 'atk', 'spe'], ['Adamant', 'atk', 'spa'], ['Naughty', 'atk', 'spd'],
  ['Bold', 'def', 'atk'], ['Docile'], ['Relaxed', 'def', 'spe'], ['Impish', 'def', 'spa'], ['Lax', 'def', 'spd'],
  ['Timid', 'spe', 'atk'], ['Hasty', 'spe', 'def'], ['Serious'], ['Jolly', 'spe', 'spa'], ['Naive', 'spe', 'spd'],
  ['Modest', 'spa', 'atk'], ['Mild', 'spa', 'def'], ['Quiet', 'spa', 'spe'], ['Bashful'], ['Rash', 'spa', 'spd'],
  ['Calm', 'spd', 'atk'], ['Gentle', 'spd', 'def'], ['Sassy', 'spd', 'spe'], ['Careful', 'spd', 'spa'], ['Quirky']]
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const STAT_LABEL = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SP.A', spd: 'SP.D', spe: 'SPE' }
const BASE_KEY = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', spe: 'speed' }

/** A small seeded generator, so the demo rolls the same Pokémon every time. In
    the app this roll happens on the server, once, when the Pokémon appears. */
function rng(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** One individual: its own IVs and nature, and the stats they give at a level. */
function individual(species, level, rand) {
  const ivs = Object.fromEntries(STAT_KEYS.map((k) => [k, Math.floor(rand() * 32)]))
  const nature = NATURES[Math.floor(rand() * NATURES.length)]
  const stats = {}
  for (const k of STAT_KEYS) {
    const b = species.base[BASE_KEY[k]], core = Math.floor((2 * b + ivs[k]) * level / 100)
    stats[k] = k === 'hp' ? core + level + 10
      : Math.floor((core + 5) * (nature[1] === k ? 1.1 : nature[2] === k ? 0.9 : 1))
  }
  return { ...species, level, ivs, nature, stats, hp: stats.hp }
}

/* Starter moves: a Normal move, and a first move of its own type. */
const OWN_MOVE = { fire: 'EMBER', water: 'WATER GUN', grass: 'VINE WHIP' }
const NORMAL_MOVE = { CHARMANDER: 'SCRATCH', TORCHIC: 'SCRATCH', CHIMCHAR: 'SCRATCH', FENNEKIN: 'SCRATCH', LITTEN: 'SCRATCH', SPRIGATITO: 'SCRATCH',
  GROOKEY: 'SCRATCH', TREECKO: 'POUND', FROAKIE: 'POUND', QUAXLY: 'POUND', SNIVY: 'TACKLE' }
const MOVEDEX = {
  TACKLE: { type: 'normal', power: 40, cat: 'phys', cost: 0, fx: 'dash', snd: 'whoosh' },
  SCRATCH: { type: 'normal', power: 40, cat: 'phys', cost: 0, fx: 'slash', snd: 'whoosh' },
  POUND: { type: 'normal', power: 40, cat: 'phys', cost: 0, fx: 'dash', snd: 'thud' },
  EMBER: { type: 'fire', power: 40, cat: 'spec', cost: 1, fx: 'ember', snd: 'whoosh' },
  'WATER GUN': { type: 'water', power: 40, cat: 'spec', cost: 1, fx: 'water', snd: 'whoosh' },
  'VINE WHIP': { type: 'grass', power: 45, cat: 'phys', cost: 1, fx: 'slash', snd: 'whoosh' },
}
/*
 * What the wild ones use, by their first type. Moves of kind 'low' travel
 * along the ground: they can't be parried or dodged, only jumped (+1 PP).
 * `fx` picks the animation: quake, roll, sweep, wave, current, shadow, vines.
 * Flying, Bug, Dark and Fairy have no ground attack that fits, so none here.
 */
const S_ = (name, type, power, cat, snd, more = {}) => ({ name, type, power, cat, hits: 1, kind: 'strike', snd, ...more })
const L_ = (name, type, power, cat, fx, snd, more = {}) => ({ name, type, power, cat, hits: 1, kind: 'low', fx, snd, ...more })
const WILD_MOVES = {
  normal:   [S_('TACKLE', 'normal', 40, 'phys', 'thud'), L_('RAPID SPIN', 'normal', 40, 'phys', 'roll', 'thud'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
  fighting: [S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), L_('LOW SWEEP', 'fighting', 40, 'phys', 'sweep', 'thud'), S_('DOUBLE KICK', 'fighting', 25, 'phys', 'thud', { hits: 2 })],
  dragon:   [S_('DRAGON BREATH', 'dragon', 40, 'spec', 'shadow', { ranged: true }), L_('DRAGON TAIL', 'dragon', 45, 'phys', 'sweep', 'thud'), S_('BITE', 'dark', 40, 'phys', 'crunch')],
  electric: [S_('THUNDER SHOCK', 'electric', 40, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 40, 'spec', 'current', 'zap'), S_('NUZZLE', 'electric', 20, 'phys', 'zap', { hits: 2 })],
  water:    [S_('WATER GUN', 'water', 40, 'spec', 'whoosh', { ranged: true }), L_('SURF', 'water', 45, 'spec', 'wave', 'whoosh'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  rock:     [S_('ROCK THROW', 'rock', 50, 'phys', 'thud', { ranged: true }), L_('ROLLOUT', 'rock', 25, 'phys', 'roll', 'thud', { hits: 2 }), L_('BULLDOZE', 'ground', 40, 'phys', 'quake', 'quake')],
  ground:   [S_('MUD-SLAP', 'ground', 25, 'spec', 'thud', { ranged: true }), L_('BULLDOZE', 'ground', 40, 'phys', 'quake', 'quake'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  fire:     [S_('EMBER', 'fire', 40, 'spec', 'whoosh', { ranged: true }), L_('FLAME WHEEL', 'fire', 40, 'phys', 'roll', 'whoosh'), S_('SCRATCH', 'normal', 40, 'phys', 'whoosh')],
  grass:    [S_('RAZOR LEAF', 'grass', 40, 'phys', 'whoosh', { ranged: true }), L_('GRASS KNOT', 'grass', 40, 'spec', 'vines', 'thud'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  ice:      [S_('POWDER SNOW', 'ice', 40, 'spec', 'whoosh', { ranged: true }), L_('ICE BALL', 'ice', 25, 'phys', 'roll', 'thud', { hits: 2 }), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  poison:   [S_('POISON STING', 'poison', 30, 'phys', 'whoosh', { ranged: true }), L_('SLUDGE WAVE', 'poison', 45, 'spec', 'wave', 'whoosh'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  psychic:  [S_('CONFUSION', 'psychic', 40, 'spec', 'shadow', { ranged: true }), L_('PSYWAVE', 'psychic', 40, 'spec', 'wave', 'shadow'), S_('POUND', 'normal', 40, 'phys', 'thud')],
  ghost:    [S_('ASTONISH', 'ghost', 30, 'phys', 'shadow'), L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('LICK', 'ghost', 30, 'phys', 'crunch')],
  steel:    [S_('METAL CLAW', 'steel', 50, 'phys', 'crunch'), L_('STEEL ROLLER', 'steel', 45, 'phys', 'roll', 'thud'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  flying:   [S_('GUST', 'flying', 40, 'spec', 'whoosh', { ranged: true }), S_('WING ATTACK', 'flying', 50, 'phys', 'whoosh')],
  bug:      [S_('BUG BITE', 'bug', 50, 'phys', 'crunch'), S_('STRUGGLE BUG', 'bug', 40, 'spec', 'whoosh', { ranged: true })],
  dark:     [S_('BITE', 'dark', 40, 'phys', 'crunch'), S_('SNARL', 'dark', 40, 'spec', 'shadow', { ranged: true })],
  fairy:    [S_('FAIRY WIND', 'fairy', 40, 'spec', 'whoosh', { ranged: true }), S_('DRAINING KISS', 'fairy', 40, 'spec', 'whoosh')],
}
const MAGIKARP = [{ name: 'SPLASH', splash: true }, S_('TACKLE', 'normal', 40, 'phys', 'thud')]

/* ── music, fuller ──
   The same melodies, now with company. Each song names its chords, and from
   them come: a soft pad holding the chord, the melody harmonised a third or
   sixth below (always from the chord's own notes, so it stays in key), an
   arpeggio ticking through the chord on the faster songs, the bass, and the
   drums. The lead gets a second, slightly detuned voice and a short echo. */
const MIDI = (n) => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) }
const HZ = (m) => 440 * Math.pow(2, (m - 69) / 12)
/** 'Am', 'G7', 'F#m', 'B' -> pitch classes, root first. */
function chordPcs(name) {
  const m = /^([A-G][#b]?)(m)?(7)?$/.exec(name), root = MIDI(m[1] + '4') % 12
  return [0, m[2] ? 3 : 4, 7, ...(m[3] ? [10] : [])].map((i) => (root + i) % 12)
}
Object.assign(SONGS.vs, { chordLen: 8, chords: 'Em Em Em'.split(' ') })
Object.assign(SONGS.battle, { chordLen: 8, chords: 'Am F G E Am F G E'.split(' '), arp: true })
Object.assign(SONGS.encounter, { chordLen: 4, chords: 'Em Em Em Em C D Em B'.split(' '), arp: true })
Object.assign(SONGS.win, { chordLen: 8, chords: 'C F G7 C'.split(' '), arp: true })
Object.assign(SONGS.victory, { chordLen: 4, chords: 'C C C C'.split(' ') })
Object.assign(SONGS.caught, { chordLen: 4, chords: 'C C F G G'.split(' ') })

/** A held note: soft attack, sustain, gentle release (tone() is for plucks). */
function held(ac, out, t, { type = 'triangle', f, dur, vol, attack = 0.05, release = 0.12, detune = 0 }) {
  if (t < 0) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.frequency.value = f; o.detune.value = detune
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack)
  g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release)); g.gain.linearRampToValueAtTime(0, t + dur)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05)
}
/** One echo and one warm filter per music output, made the first time it's used. */
function musicBuses(ac, out, step) {
  if (out.__buses) return out.__buses
  const echoIn = ac.createGain(), d = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain()
  d.delayTime.value = Math.min(0.9, step * 3); fb.gain.value = 0.28; wet.gain.value = 0.22
  echoIn.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(out)
  const padIn = ac.createBiquadFilter(); padIn.type = 'lowpass'; padIn.frequency.value = 1100; padIn.Q.value = 0.4; padIn.connect(out)
  return (out.__buses = { echoIn, padIn })
}

scheduleSong = function scheduleSong(ac, out, song, t0) {
  const step = 60 / song.bpm / song.div
  const { echoIn, padIn } = musicBuses(ac, out, step)
  const each = (track, fn) => {
    for (let i = 0; i < track.length; i++) {
      const n = track[i]; if (n === '.' || n === '-') continue
      let len = 1; while (track[i + len] === '.') len++
      fn(t0 + i * step, n, len * step, i)
    }
  }
  const chordAt = (i) => song.chords ? chordPcs(song.chords[Math.min(song.chords.length - 1, Math.floor(i / song.chordLen))]) : null

  // Lead: two square voices a few cents apart, the pair also feeding the echo.
  each(song.lead, (t, n, d) => {
    const f = NOTE(n)
    tone(ac, out, t, { f, dur: d * 0.95, vol: 0.062 })
    tone(ac, out, t, { f: f * 1.0045, dur: d * 0.95, vol: 0.028 })
    tone(ac, echoIn, t, { f, dur: d * 0.9, vol: 0.05 })
  })
  // Harmony: under each melody note, the nearest chord tone 3-9 semitones down.
  if (song.chords) each(song.lead, (t, n, d, i) => {
    const lead = MIDI(n), pcs = chordAt(i)
    let h = null
    for (let k = 3; k <= 9; k++) if (pcs.includes(((lead - k) % 12 + 12) % 12)) { h = lead - k; break }
    if (h != null) held(ac, out, t, { type: 'triangle', f: HZ(h), dur: d * 0.92, vol: 0.05, attack: 0.012, release: 0.06 })
  })
  // Pad: the chord voiced around middle C, two detuned saws per note, filtered soft.
  if (song.chords) song.chords.forEach((c, k) => {
    const t = t0 + k * song.chordLen * step, dur = Math.min(song.chordLen, song.lead.length - k * song.chordLen) * step
    for (const pc of chordPcs(c).slice(0, 3)) {
      const m = 55 + ((pc - 55) % 12 + 12) % 12   // G3..F#4
      for (const det of [-7, 7]) held(ac, padIn, t, { type: 'sawtooth', f: HZ(m), dur, vol: 0.016, attack: 0.08, release: 0.15, detune: det })
    }
  })
  // Arpeggio: up and back through the chord, an octave above the pad.
  if (song.arp) for (let i = 0; i < song.lead.length; i++) {
    const pcs = chordAt(i).slice(0, 3), notes = pcs.map((pc) => 67 + ((pc - 67) % 12 + 12) % 12).sort((a, b) => a - b)
    const seq = [notes[0], notes[1], notes[2], notes[0] + 12, notes[2], notes[1]]
    tone(ac, out, t0 + i * step, { type: 'square', f: HZ(seq[i % seq.length]), dur: step * 0.7, vol: 0.018 })
  }
  // Bass, as before, with a quiet octave-up square for bite.
  each(song.bass, (t, n, d) => {
    tone(ac, out, t, { type: 'triangle', f: NOTE(n), dur: d * 0.9, vol: 0.2 })
    tone(ac, out, t, { type: 'square', f: NOTE(n) * 2, dur: Math.min(d, step) * 0.6, vol: 0.022 })
  })
  ;[...song.drums].forEach((c, i) => {
    const t = t0 + i * step
    if (c === 'K') tone(ac, out, t, { type: 'sine', f: 150, f1: 45, dur: .14, vol: .5 })
    if (c === 'S') { noise(ac, out, t, { dur: .12, vol: .22, filter: 'bandpass', f: 1800 }); tone(ac, out, t, { type: 'triangle', f: 190, dur: .06, vol: .08 }) }
    if (c === 'h') noise(ac, out, t, { dur: .035, vol: .05, filter: 'highpass', f: 7500 })
    if (c === 'C') noise(ac, out, t, { dur: .9, vol: .14, filter: 'highpass', f: 5000 })
  })
  return song.lead.length * step
}

/* ── Pokémon cries ──
   The real cries (OGG, from PokeAPI), decoded once per audio context and
   played through the effects bus a little under full volume. Sound.cry(id)
   logs each one, so the offline render for videos can place it too. */
const CRY_VOL = 0.4   // 20% quieter than it was (0.5)
const cryCache = new WeakMap()
async function cryBuffer(ac, id) {
  const src = ART['cry:' + id]; if (!src) return null
  if (!cryCache.has(ac)) cryCache.set(ac, new Map())
  const m = cryCache.get(ac)
  if (!m.has(id)) m.set(id, fetch(src).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).catch(() => null))
  return m.get(id)
}
function playBuffer(ac, out, buf, t, rate) {
  const s = ac.createBufferSource(), g = ac.createGain()
  s.buffer = buf; s.playbackRate.value = rate; g.gain.value = CRY_VOL
  s.connect(g).connect(out); s.start(t)
}
window.__playCry = async (ac, out, id, rate = 1) => { const buf = await cryBuffer(ac, id); if (buf) playBuffer(ac, out, buf, ac.currentTime + 0.01, rate) }
window.__scheduleCries = async (ac, out, log, fromMs) => {
  for (const e of log) {
    const t = (e.t - fromMs) / 1000
    if (e.kind !== 'cry' || t < 0) continue
    const buf = await cryBuffer(ac, e.id); if (buf) playBuffer(ac, out, buf, t, e.rate ?? 1)
  }
}
/* ══════════════ music engine, second generation ══════════════
   The chiptune voices (square, triangle, noise) give way to synthesised
   instruments in the spirit of the DS era: brass leads, string pads, FM
   electric piano and glockenspiel, a filtered synth bass and a full drum kit.
   Still clearly digital, but a step closer to real instruments. Every voice
   sits on its own mixer channel with a stereo position and a reverb send,
   and the mix runs through a room reverb and a compressor. The melodies,
   chords and bass lines are the same as before; the arrangement around them
   is new. */

/* ── mixer: channels, reverb, glue compressor (one set per music output) ── */
function roomIR(ac, secs = 1.7) {
  const n = Math.floor(ac.sampleRate * secs), ir = ac.createBuffer(2, n, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0
    for (let i = 0; i < n; i++) {
      // Decaying noise, smoothed a little so the tail is warm rather than hissy.
      lp += 0.35 * ((Math.random() * 2 - 1) - lp)
      d[i] = lp * Math.pow(1 - i / n, 2.4) * (i < ac.sampleRate * 0.008 ? i / (ac.sampleRate * 0.008) : 1)
    }
  }
  return ir
}
const CHANNELS = {   // gain, stereo position, reverb send
  lead:  { g: 0.55, pan: 0,     rev: 0.22 },
  harm:  { g: 0.30, pan: -0.32, rev: 0.30 },
  pad:   { g: 0.26, pan: 0.3,   rev: 0.45 },
  keys:  { g: 0.36, pan: 0.45,  rev: 0.25 },
  glock: { g: 0.20, pan: -0.5,  rev: 0.35 },
  bass:  { g: 0.62, pan: 0,     rev: 0.04 },
  kick:  { g: 0.80, pan: 0,     rev: 0.03 },
  snare: { g: 0.50, pan: 0.06,  rev: 0.18 },
  hat:   { g: 0.20, pan: 0.30,  rev: 0.06 },
  cym:   { g: 0.22, pan: -0.15, rev: 0.25 },
  tom:   { g: 0.45, pan: -0.2,  rev: 0.15 },
}
function mixer(ac, out, vol = 1) {
  if (out.__mix) return out.__mix
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.16
  // A trim after the glue, so the fuller arrangement sits at the old music's level under effects and cries.
  const trim = ac.createGain(); trim.gain.value = 0.3 * vol
  comp.connect(trim).connect(out)
  const conv = ac.createConvolver(); conv.buffer = roomIR(ac)
  const ret = ac.createGain(); ret.gain.value = 0.32
  conv.connect(ret).connect(comp)
  const ch = {}
  for (const [name, c] of Object.entries(CHANNELS)) {
    const g = ac.createGain(); g.gain.value = c.g
    const p = ac.createStereoPanner(); p.pan.value = c.pan
    const s = ac.createGain(); s.gain.value = c.rev
    g.connect(p).connect(comp); g.connect(s).connect(conv)
    ch[name] = g
  }
  return (out.__mix = ch)
}

/* ── instruments ── each plays one note: (ac, channel, time, hz, seconds, velocity 0..1) */
const oscAt = (ac, type, f, t, end, detune = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t); o.stop(end); return o }
/** Attack, decay to a sustain level, release from the note's end. */
function adsr(param, t, dur, peak, a, d, s, r) {
  param.setValueAtTime(0, t); param.linearRampToValueAtTime(peak, t + a)
  param.setTargetAtTime(peak * s, t + a, d / 3)
  const off = t + Math.max(dur, a + 0.01)
  param.setTargetAtTime(0, off, r / 3)
  return off + r * 2
}
const INST = {
  /** Brass: two detuned saws and a quiet sub, through a filter that opens with a bite, plus delayed vibrato. */
  brass(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 1.4
    const end = adsr(g.gain, t, dur, 0.22 * v, 0.018, 0.14, 0.72, 0.09)
    flt.frequency.setValueAtTime(f * 1.3, t); flt.frequency.linearRampToValueAtTime(Math.min(9000, f * 9), t + 0.045)
    flt.frequency.setTargetAtTime(Math.min(6000, f * 4.2), t + 0.05, 0.08)
    const lfo = oscAt(ac, 'sine', 5.4, t, end), lg = ac.createGain()
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, dur * 0.8))
    lfo.connect(lg)
    for (const [type, mul, det, gain] of [['sawtooth', 1, -6, 1], ['sawtooth', 1, 6, 1], ['square', 0.5, 0, 0.35]]) {
      const o = oscAt(ac, type, f * mul, t, end, det), og = ac.createGain(); og.gain.value = gain
      lg.connect(o.frequency); o.connect(og).connect(flt)
    }
    flt.connect(g).connect(ch)
  },
  /** Synth lead: two detuned squares an octave apart, a quick filter blip, and fast vibrato. Unmistakably digital. */
  synth(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 3
    const end = adsr(g.gain, t, dur, 0.16 * v, 0.006, 0.1, 0.8, 0.06)
    flt.frequency.setValueAtTime(Math.min(10000, f * 10), t); flt.frequency.setTargetAtTime(Math.min(7000, f * 5), t + 0.01, 0.06)
    const lfo = oscAt(ac, 'triangle', 6.5, t, end), lg = ac.createGain()
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + Math.min(0.25, dur * 0.7)); lfo.connect(lg)
    for (const [mul, det, gain] of [[1, -8, 1], [1, 8, 0.8], [2, 0, 0.25]]) {
      const o = oscAt(ac, 'square', f * mul, t, end, det), og = ac.createGain(); og.gain.value = gain
      lg.connect(o.frequency); o.connect(og).connect(flt)
    }
    flt.connect(g).connect(ch)
  },
  /** Strings: three detuned saws, a slow swell, a soft filter. */
  strings(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = Math.min(4200, f * 5); flt.Q.value = 0.6
    const end = adsr(g.gain, t, dur, 0.15 * v, Math.min(0.22, dur * 0.5), 0.3, 0.9, 0.32)
    for (const det of [-10, 10]) oscAt(ac, 'sawtooth', f, t, end, det).connect(flt)
    flt.connect(g).connect(ch)
  },
  /** FM electric piano: a mellow body plus a short metallic tine, both fading. */
  epiano(ac, ch, t, f, dur, v) {
    const len = Math.max(0.35, Math.min(0.9, dur * 1.3)), end = t + len + 0.05
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + len)
    const car = oscAt(ac, 'sine', f, t, end)
    const m1 = oscAt(ac, 'sine', f, t, end), i1 = ac.createGain(); i1.gain.setValueAtTime(f * 2.2, t); i1.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.6)
    const m2 = oscAt(ac, 'sine', f * 14, t, end), i2 = ac.createGain(); i2.gain.setValueAtTime(f * 1.1, t); i2.gain.exponentialRampToValueAtTime(f * 0.01, t + 0.07)
    m1.connect(i1).connect(car.frequency); m2.connect(i2).connect(car.frequency)
    car.connect(g).connect(ch)
  },
  /** FM glockenspiel: bright, inharmonic, ringing. */
  glock(ac, ch, t, f, dur, v) {
    const len = 0.55, end = t + len + 0.05
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0006, t + len)
    const car = oscAt(ac, 'sine', f, t, end), m = oscAt(ac, 'sine', f * 3.5, t, end), i = ac.createGain()
    i.gain.setValueAtTime(f * 1.6, t); i.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.25)
    m.connect(i).connect(car.frequency); car.connect(g).connect(ch)
  },
  /** Synth bass: saw and sine sub, a resonant filter that snaps shut. */
  bass(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 4
    const end = adsr(g.gain, t, dur * 0.92, 0.42 * v, 0.004, 0.18, 0.62, 0.05)
    flt.frequency.setValueAtTime(Math.min(5000, f * 11), t); flt.frequency.setTargetAtTime(f * 2.6, t + 0.005, 0.05)
    oscAt(ac, 'sawtooth', f, t, end).connect(flt)
    const sub = oscAt(ac, 'sine', f, t, end), sg = ac.createGain(); sg.gain.value = 0.9; sub.connect(sg).connect(g)
    flt.connect(g).connect(ch)
  },
}
/* ── drum kit ── */
function noiseHit(ac, ch, t, { type, f, q = 0.8, len, vol, f1 }) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf(ac)
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + len); fl.Q.value = q
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len)
  s.connect(fl).connect(g).connect(ch); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02)
}
function toneHit(ac, ch, t, { type = 'sine', f, f1, len, vol }) {
  const o = oscAt(ac, type, f, t, t + len + 0.02), g = ac.createGain()
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.6)
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len)
  o.connect(g).connect(ch)
}
const KIT = {
  K: (ac, m, t, v = 1) => { toneHit(ac, m.kick, t, { f: 155, f1: 46, len: 0.34, vol: 0.95 * v }); noiseHit(ac, m.kick, t, { type: 'highpass', f: 3000, len: 0.012, vol: 0.35 * v }) },
  S: (ac, m, t, v = 1) => { noiseHit(ac, m.snare, t, { type: 'bandpass', f: 1900, q: 0.7, len: 0.17, vol: 0.85 * v }); noiseHit(ac, m.snare, t, { type: 'highpass', f: 6000, len: 0.09, vol: 0.35 * v }); toneHit(ac, m.snare, t, { type: 'triangle', f: 205, f1: 170, len: 0.09, vol: 0.5 * v }) },
  g: (ac, m, t) => KIT.S(ac, m, t, 0.28),   // ghost snare
  h: (ac, m, t, v = 1) => noiseHit(ac, m.hat, t, { type: 'highpass', f: 8200, len: 0.045, vol: 0.55 * v }),
  o: (ac, m, t) => noiseHit(ac, m.hat, t, { type: 'highpass', f: 7600, len: 0.28, vol: 0.45 }),
  C: (ac, m, t) => { noiseHit(ac, m.cym, t, { type: 'highpass', f: 4800, len: 1.6, vol: 0.6 }); noiseHit(ac, m.cym, t, { type: 'bandpass', f: 9500, q: 0.6, len: 0.9, vol: 0.3 }) },
  T: (ac, m, t) => toneHit(ac, m.tom, t, { f: 190, f1: 115, len: 0.3, vol: 0.8 }),
  t: (ac, m, t) => toneHit(ac, m.tom, t, { f: 140, f1: 85, len: 0.34, vol: 0.8 }),
}

/* ── lookahead scheduling ──
   A song pass no longer builds every note up front. It queues them, and each
   note's audio nodes are created only shortly before it plays: about a third
   of a second ahead while the page is visible, a couple of seconds when it's
   hidden (background tabs only wake timers once a second). That keeps the
   work at any moment small, however long or rich the arrangement. Offline
   renders (the videos) flush the queue in one-second steps the same way. */
const JIT_AHEAD = 0.35, JIT_AHEAD_HIDDEN = 2.2
function jitQueue(ac) {
  if (ac.__q) return ac.__q
  ac.__q = []
  if (!(ac instanceof OfflineAudioContext)) setInterval(() => jitFlush(ac, ac.currentTime + (document.hidden ? JIT_AHEAD_HIDDEN : JIT_AHEAD)), 25)
  return ac.__q
}
function jitFlush(ac, until) {
  const q = ac.__q; if (!q?.length) return
  let n = 0; while (n < q.length && q[n].t < until) n++
  // Notes for a song that has since been stopped are dropped, not played.
  for (const e of q.splice(0, n)) if (!e.out.__stopped) e.fn()
}
/** For an offline render of `secs`: flush the queue a second at a time as it renders. */
function prepareOffline(ac, secs) {
  jitFlush(ac, 1.5)
  for (let s = 1; s < secs; s += 1) ac.suspend(s).then(() => { jitFlush(ac, s + 1.5); ac.resume() })
}

/* ── arrangements ── how each song's parts are voiced (the notes are the same as before) */
Object.assign(SONGS.battle, { leadInst: 'brass', comp: true, hats16: true, fill: 'TTtt', glock: true })

/* ── new themes ──
   Two original pieces, written in the same step format as the others (one
   token per eighth note: a note starts, '.' holds it, '-' rests). */
const bars = (...b) => b.join(' ').split(' ')
/** Wild battle: urgent, in D minor, lifting into F major in the second half. */
SONGS.wild = { file: null, loop: true, bpm: 160, div: 2, chordLen: 8,
  chords: 'Dm Bb C A Dm Bb Gm A'.split(' '),
  lead: bars('D5 . F5 A5 . G5 F5 E5', 'F5 . D5 . Bb4 . D5 F5', 'E5 . G5 . C6 . Bb5 A5', 'A5 . . . E5 . C#5 E5',
    'D6 . C6 A5 . F5 G5 A5', 'Bb5 . A5 F5 . D5 F5 Bb5', 'A5 . G5 . F5 . E5 D5', 'C#5 . E5 . A5 . . -'),
  bass: bars('D2 D2 D3 D2 D2 D3 D2 D3', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2', 'C2 C2 C3 C2 C2 C3 C2 C3', 'A1 A1 A2 A1 A1 A2 A1 A2',
    'D2 D2 D3 D2 D2 D3 D2 D3', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2', 'G1 G1 G2 G1 G1 G2 G1 G2', 'A1 A1 A2 A1 A2 G2 E2 C#2'),
  drums: 'KhSgKKSh'.repeat(7) + 'KhShSSSS',
  leadInst: 'brass', harmInst: 'strings', glock: true, hats16: true, fill: 'SSTt' }
/*
 * Rival battles run long, so both rival themes are built from sections, each
 * with its own chords, melody, instruments and drum feel. `intro` plays once;
 * `sections` then loop. Anything a section doesn't set comes from the song.
 */
const ROCK = 'KhSKhKSh'.repeat(7) + 'KSKSKSSS'
const HALF = 'KhhhShhh'.repeat(7) + 'KhhhSSSS'
/** Rival A: cocky, rock-flavoured, E minor. Verse, higher verse, a half-time bridge in G, a build. About 40 s a loop. */
SONGS.rival = { file: null, loop: true, bpm: 168, div: 2, chordLen: 8, leadInst: 'synth', harmInst: 'brass', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Em', 'B'], lead: bars('E5 . - E5 . - E5 .', 'B4 . - B4 . - - -'), bass: bars('E2 . - E2 . - E2 .', 'B1 . - B1 . - - -'),
    drums: 'K.K.SKSK' + 'KSKSSSSS', hats16: false, comp: false, fill: '' },
  sections: [
    { // A: the verse
      chords: 'Em C D B Em C Am B7'.split(' '),
      lead: bars('E5 . B4 E5 G5 . F#5 E5', 'G5 . . E5 C5 . E5 G5', 'F#5 . A5 . D6 . C6 A5', 'B5 . . . A5 . F#5 D#5',
        'E5 G5 B5 . A5 G5 F#5 E5', 'E5 . G5 . C6 . B5 G5', 'A5 . C6 . E6 . D6 C6', 'B5 . A5 . F#5 D#5 B4 -'),
      bass: bars('E2 . E3 E2 . E2 B2 D3', 'C2 . C3 C2 . C2 G2 B2', 'D2 . D3 D2 . D2 A2 C3', 'B1 . B2 B1 . B1 F#2 A2',
        'E2 . E3 E2 . E2 B2 D3', 'C2 . C3 C2 . C2 G2 B2', 'A1 . A2 A1 . A1 E2 G2', 'B1 . B2 B1 D#2 F#2 A2 B2'),
      drums: ROCK },
    { // A': the verse again, answered higher, with the glockenspiel in
      chords: 'Em C D B Em C Am B7'.split(' '), glock: true,
      lead: bars('B5 . G5 B5 E6 . D6 B5', 'C6 . . G5 E5 . G5 C6', 'A5 . F#5 . D6 . F#6 .', 'D#6 . . . B5 . F#5 .',
        'G5 . B5 . E6 . G6 .', 'E6 . C6 . G5 . E5 .', 'C6 . A5 . E5 . A5 C6', 'B5 . . . - - - -'),
      bass: bars('E2 . E3 E2 . E2 B2 D3', 'C2 . C3 C2 . C2 G2 B2', 'D2 . D3 D2 . D2 A2 C3', 'B1 . B2 B1 . B1 F#2 A2',
        'E2 . E3 E2 . E2 B2 D3', 'C2 . C3 C2 . C2 G2 B2', 'A1 . A2 A1 . A1 E2 G2', 'B1 . B2 B1 D#2 F#2 A2 B2'),
      drums: ROCK },
    { // Bridge: half-time, G major, long brass lines over the strings
      chords: 'G D Em C G D C B'.split(' '), leadInst: 'brass', harmInst: 'strings', comp: false, hats16: false, crash: true, fill: 'TTtt',
      lead: bars('D6 . . . B5 . . .', 'A5 . . . F#5 . . .', 'G5 . . . B5 . E6 .', 'E6 . . . . . . .',
        'G5 . B5 . D6 . G6 .', 'F#6 . . . D6 . A5 .', 'E6 . . . C6 . G5 .', 'F#5 . . . D#6 . . .'),
      bass: bars('G2 . . . G2 . D2 .', 'D2 . . . D2 . A1 .', 'E2 . . . E2 . B1 .', 'C2 . . . C2 . G1 .',
        'G2 . . . G2 . D2 .', 'D2 . . . D2 . A1 .', 'C2 . . . C2 . G1 .', 'B1 . . . B1 . F#2 .'),
      drums: HALF },
    { // Build: stabs and a snare roll back into the verse
      chords: 'Am Am B B'.split(' '), comp: false, glock: true, fill: 'SSSS',
      lead: bars('E5 . E5 . A5 . E5 .', 'C6 . C6 . A5 . E5 .', 'F#5 . F#5 . B5 . D#6 .', 'F#6 . . . - - - -'),
      bass: bars('A1 A1 A2 A1 A1 A2 A1 A2', 'A1 A1 A2 A1 A1 A2 A1 A2', 'B1 B1 B2 B1 B1 B2 B1 B2', 'B1 . . . B1 . . .'),
      drums: 'KhKhKhKh' + 'KhKhKhKh' + 'KSKSKSKS' + 'SSSSSSSS' },
  ] }

/**
 * Rival encounter: plays under the rival's dialogue before the battle, every
 * time they turn up. Cheeky, swung, at a walking tempo and sitting quieter
 * than the battle music so it stays under the text. A one-bar brass "hey!"
 * as they step up, then an eight-bar loop for as long as they talk. E minor,
 * ending each loop on B7, so it hands over cleanly to either rival battle
 * theme (A is in E minor, B in A minor). The lead is the rival's synth.
 */
SONGS.rivalTalk = { file: null, loop: true, bpm: 132, div: 2, chordLen: 8, swing: 0.32, vol: 0.75,
  leadInst: 'synth', leadVel: 0.7, harmInst: 'strings', comp: true, hats16: false, crash: false, fill: '',
  intro: { chords: ['B7'], lead: bars('B4 . D#5 . F#5 . B5 .'), bass: bars('B1 . . . B1 . . .'), drums: 'K.S.K.SS',
    leadInst: 'brass', leadVel: 0.9, comp: false, crash: true },
  sections: [{
    chords: 'Em Am D G C Am B7 B7'.split(' '),
    lead: bars('E5 . - G5 . F#5 E5 -', 'A5 . - C6 . B5 A5 -', 'F#5 . A5 . D6 . C6 A5', 'B5 . . . - - G5 A5',
      'G5 . E5 . C6 . B5 G5', 'A5 . - E5 . A5 C6 -', 'D#6 . . . F#5 . A5 .', 'B5 . - - D#5 . F#5 .'),
    bass: bars('E2 . B1 . E2 . G2 .', 'A1 . E2 . A1 . C2 .', 'D2 . A1 . D2 . F#2 .', 'G1 . D2 . G1 . B1 .',
      'C2 . G1 . C2 . E2 .', 'A1 . E2 . A1 . G1 .', 'B1 . F#2 . B1 . A1 .', 'B1 . D#2 . F#2 . B1 .'),
    drums: 'KhShKhSh'.repeat(3) + 'KhShKhSg' + 'KhShKhSh'.repeat(3) + 'KhShSoSo' }] }

/**
 * Gym leader intro: under the VS splash and the leader's words. A brass
 * fanfare with timpani toms, then a stately eight-bar loop in D minor that
 * holds for as long as they talk. Broad and ceremonial, not yet a fight.
 */
SONGS.gymIntro = { file: null, loop: true, bpm: 112, div: 2, chordLen: 8, vol: 0.85,
  leadInst: 'brass', harmInst: 'brass', comp: false, hats16: false, crash: false, fill: 'TTtt',
  intro: { chords: ['Dm', 'A'], lead: bars('A4 . D5 . F5 . A5 .', 'C#6 . . . A5 . . .'), bass: bars('D2 . . . D2 . . .', 'A1 . . . A1 . . .'),
    drums: 'K...T.t.' + 'K.T.ttSS', crash: true, fill: '' },
  sections: [{
    chords: 'Dm Bb Gm A Dm F Gm A'.split(' '),
    lead: bars('D5 . . . F5 . A5 .', 'Bb5 . . . A5 . G5 .', 'G5 . . . Bb5 . D6 .', 'C#6 . . . . . A5 .',
      'D6 . . . A5 . F5 .', 'C6 . . . A5 . F5 .', 'Bb5 . A5 . G5 . Bb5 .', 'A5 . . . E5 . C#5 .'),
    bass: bars('D2 . . . A1 . . .', 'Bb1 . . . F2 . . .', 'G1 . . . D2 . . .', 'A1 . . . E2 . . .',
      'D2 . . . A1 . . .', 'F2 . . . C2 . . .', 'G1 . . . D2 . . .', 'A1 . . . A1 . C#2 .'),
    drums: 'K..hS.h.'.repeat(7) + 'K.TtTtSS' }] }

/**
 * Gym battle: the biggest piece, C minor at 176 bpm, about 38 s a loop.
 * Brass stabs, a driving verse, the verse again higher with the glockenspiel,
 * a heroic half-time bridge in E-flat major, and a build back to the top.
 */
const GYM_A_BASS = bars('C2 C2 C3 C2 C2 C3 C2 Bb1', 'Ab1 Ab1 Ab2 Ab1 Ab1 Ab2 Ab1 G1', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1', 'G1 G1 G2 G1 G1 G2 F2 D2',
  'C2 C2 C3 C2 C2 C3 C2 Bb1', 'Ab1 Ab1 Ab2 Ab1 Ab1 Ab2 Ab1 G1', 'F1 F1 F2 F1 F1 F2 F1 Ab1', 'G1 G1 G2 G1 B1 D2 F2 G2')
SONGS.gym = { file: null, loop: true, bpm: 176, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Cm', 'G'], lead: bars('C5 . - C5 . - Eb5 .', 'D5 . - B4 . - G4 .'), bass: bars('C2 . - C2 . - Eb2 .', 'D2 . - B1 . - G1 .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', hats16: false, comp: false, fill: '', crash: true },
  sections: [
    { // A: the verse
      chords: 'Cm Ab Bb G Cm Ab Fm G'.split(' '),
      lead: bars('C5 . Eb5 G5 . F5 Eb5 D5', 'Eb5 . C5 . Ab5 . G5 F5', 'F5 . D5 . Bb5 . Ab5 G5', 'G5 . . . B4 . D5 F5',
        'Eb5 G5 C6 . Bb5 Ab5 G5 F5', 'Eb5 . Ab5 . C6 . Ab5 Eb5', 'F5 . Ab5 . C6 . Bb5 Ab5', 'G5 . . . D5 . B4 .'),
      bass: GYM_A_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS' },
    { // A': higher, with the glockenspiel
      chords: 'Cm Ab Bb G Cm Ab Fm G'.split(' '), glock: true,
      lead: bars('G5 . . C6 Eb6 . D6 C6', 'C6 . . Ab5 Eb6 . C6 Ab5', 'D6 . . Bb5 F6 . D6 Bb5', 'D6 . . . B5 . G5 .',
        'C6 . Eb6 . G6 . F6 Eb6', 'Eb6 . C6 . Ab5 . C6 Eb6', 'F6 . Eb6 . C6 . Ab5 F5', 'G5 . B5 . D6 . F6 .'),
      bass: GYM_A_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS' },
    { // Bridge: heroic, half-time, E-flat major
      chords: 'Eb Bb Cm Ab Eb Bb Ab G'.split(' '), harmInst: 'strings', comp: false, hats16: false, crash: true,
      lead: bars('G5 . . . Bb5 . . .', 'D6 . . . F5 . . .', 'Eb6 . . . C6 . G5 .', 'C6 . . . . . . .',
        'Bb5 . . . Eb6 . G6 .', 'F6 . . . D6 . Bb5 .', 'Eb6 . . . C6 . Ab5 .', 'B5 . . . D6 . F6 .'),
      bass: bars('Eb2 . . . Eb2 . Bb1 .', 'Bb1 . . . Bb1 . F2 .', 'C2 . . . C2 . G1 .', 'Ab1 . . . Ab1 . Eb2 .',
        'Eb2 . . . Eb2 . Bb1 .', 'Bb1 . . . Bb1 . F2 .', 'Ab1 . . . Ab1 . Eb2 .', 'G1 . . . G1 . D2 .'),
      drums: 'KhhhShhh'.repeat(7) + 'KhhhSSSS' },
    { // Build: stabs and a snare roll back to the top
      chords: 'Fm Fm G G'.split(' '), comp: false, glock: true, fill: 'SSSS',
      lead: bars('C5 . C5 . F5 . C5 .', 'Ab5 . Ab5 . F5 . C5 .', 'D5 . D5 . G5 . B5 .', 'D6 . . . - - - -'),
      bass: bars('F1 F1 F2 F1 F1 F2 F1 F2', 'F1 F1 F2 F1 F1 F2 F1 F2', 'G1 G1 G2 G1 G1 G2 G1 G2', 'G1 . . . G1 . . .'),
      drums: 'KhKhKhKh' + 'KhKhKhKh' + 'KSKSKSKS' + 'SSSSSSSS' },
  ] }

/** Rival B: darker and electronic, A minor, a sixteenth-note synth bass under everything. About 45 s a loop. */
const AVERSE = { chords: 'Am F C G Am F E7 E7'.split(' '),
  lead: bars('A4 . C5 E5 A5 . G5 E5', 'F5 . . A5 C6 . A5 F5', 'G5 . E5 C5 G5 . E5 G5', 'B5 . . . D6 . B5 G5',
    'A5 . E5 A5 C6 . B5 A5', 'A5 . F5 . C6 . A5 F5', 'G#5 . B5 . D6 . B5 G#5', 'E5 . . . - - - -'),
  drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS' }
SONGS.rivalB = { file: null, loop: true, bpm: 172, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: false, hats16: true, fill: 'TTtt',
  bassGen: 'octave16', bass: [],
  intro: { chords: ['Am', 'E7'], lead: bars('- - - - - - - -', '- - - - - - - -'), drums: 'K.h.K.h.' + 'K.h.SSSS', hats16: true, fill: '' },
  sections: [
    { ...AVERSE },
    { // Bridge: the lift into C major, soaring brass
      chords: 'F G Em Am F G E E'.split(' '), crash: true, comp: true, fill: 'TTtt',
      lead: bars('C6 . . . A5 . . .', 'B5 . . . D6 . . .', 'E6 . . . B5 . G5 .', 'A5 . . . . . . .',
        'F5 . A5 . C6 . F6 .', 'D6 . . . B5 . G5 .', 'G#5 . . . B5 . . .', 'E6 . . . D6 . B5 .'),
      drums: 'KhhhShhh'.repeat(4) + 'KhSKKhSh'.repeat(3) + 'KhSKSSSS' },
    { // Breakdown: call and response, synth asks and brass answers
      chords: 'Dm Am Dm Am Bb C E7 E7'.split(' '), leadInst: 'synth', glock: true, crash: true, fill: 'SSSS',
      lead: bars('D5 F5 A5 . - - - -', '- - - - E5 A5 C6 .', 'D6 . A5 F5 - - - -', '- - - - C6 . B5 A5',
        'Bb5 . D6 . F6 . D6 Bb5', 'C6 . E6 . G6 . E6 C6', 'B5 . G#5 . E5 . D6 .', 'B5 . . . - - - -'),
      drums: 'K.h.K.h.'.repeat(4) + 'KhSKKhSh'.repeat(3) + 'SSSSSSSS' },
    { ...AVERSE, leadInst: 'synth', leadOct: -1, glock: true },   // the verse again, an octave down on the synth
  ] }
Object.assign(SONGS.encounter, { leadInst: 'brass', comp: false, hats16: true, glock: true, pulse: true })
Object.assign(SONGS.win, { leadInst: 'epiano', leadOct: 0, comp: true, glock: true, harmInst: 'strings' })
Object.assign(SONGS.vs, { leadInst: 'brass', hit: true })
Object.assign(SONGS.victory, { leadInst: 'brass', hit: true })
Object.assign(SONGS.caught, { leadInst: 'glock', harmInst: 'brass', hit: true })

scheduleSong = function scheduleSong(ac, out, song, t0) {
  if (!song.sections) return schedulePart(ac, out, song, t0)
  const list = song.intro && !out.__introDone ? [song.intro, ...song.sections] : song.sections
  out.__introDone = true
  let t = t0
  for (const sec of list) t += schedulePart(ac, out, { ...song, ...sec }, t)
  return t - t0
}
function schedulePart(ac, out, song, t0) {
  const step = 60 / song.bpm / song.div, M = mixer(ac, out, song.vol), q = jitQueue(ac)
  /** Where step i lands: on the grid, or with swing, the off-beats pushed late. */
  const T = (i) => t0 + i * step + (song.swing && i % 2 ? song.swing * step : 0)
  const at = (t, fn) => q.push({ t, out, fn })   // every note goes through the lookahead queue
  const each = (track, fn) => {
    for (let i = 0; i < track.length; i++) {
      const n = track[i]; if (n === '.' || n === '-') continue
      let len = 1; while (track[i + len] === '.') len++
      fn(T(i), n, len * step - (song.swing && i % 2 ? song.swing * step : 0), i)
    }
  }
  const chordAt = (i) => song.chords ? chordPcs(song.chords[Math.min(song.chords.length - 1, Math.floor(i / song.chordLen))]) : null
  const play = (name, ch, t, m, d, v) => at(t, () => INST[name](ac, ch, t, HZ(m), d, v))
  const hit = (c, t, v) => at(t, () => KIT[c](ac, M, t, v))
  const lastLead = song.lead.reduce((k, n, i) => (n !== '.' && n !== '-' ? i : k), 0)

  // Lead melody.
  each(song.lead, (t, n, d, i) => {
    const m = MIDI(n) + (song.leadOct ?? 0) * 12
    play(song.leadInst ?? 'brass', M.lead, t, m, d, i === lastLead && song.hit ? 1 : (song.leadVel ?? 0.85))
  })
  // Harmony under the melody: the nearest chord tone 3-9 semitones down.
  if (song.chords) each(song.lead, (t, n, d, i) => {
    const lead = MIDI(n), pcs = chordAt(i)
    for (let k = 3; k <= 9; k++) if (pcs.includes(((lead - k) % 12 + 12) % 12)) { play(song.harmInst ?? 'brass', M.harm, t, lead - k, d, 0.55); break }
  })
  // String pad holding each chord, voiced around middle C.
  if (song.chords) song.chords.forEach((c, k) => {
    const t = t0 + k * song.chordLen * step, dur = Math.min(song.chordLen, song.lead.length - k * song.chordLen) * step
    for (const pc of chordPcs(c).slice(0, 3)) play('strings', M.pad, t, 55 + ((pc - 55) % 12 + 12) % 12, dur * 0.98, 0.8)
  })
  // Electric piano comping: chord stabs on the off-beats.
  if (song.comp) for (let i = 1; i < song.lead.length; i += 2) {
    const pcs = chordAt(i).slice(0, 2)
    for (const pc of pcs) play('epiano', M.keys, T(i), 60 + ((pc - 60) % 12 + 12) % 12, step * 0.9, 0.55)
  }
  // Glockenspiel arpeggio up and back through the chord.
  if (song.glock) for (let i = 0; i < song.lead.length; i++) {
    const notes = chordAt(i).slice(0, 3).map((pc) => 72 + ((pc - 72) % 12 + 12) % 12).sort((a, b) => a - b)
    const seq = [notes[0], notes[1], notes[2], notes[0] + 12, notes[2], notes[1]]
    play('glock', M.glock, T(i), seq[i % seq.length], step, i % 2 ? 0.5 : 0.75)
  }
  // Generated bass: sixteenth notes bouncing between the chord's root and its octave.
  if (song.bassGen === 'octave16') for (let i = 0; i < song.lead.length; i++) {
    const r = 33 + ((chordAt(i)[0] - 33) % 12 + 12) % 12   // the root, from A1 up
    play('bass', M.bass, t0 + i * step, r, step * 0.45, 1); play('bass', M.bass, t0 + (i + 0.5) * step, r + 12, step * 0.4, 0.7)
  }
  // Bass: the written line; on pulse songs, an extra eighth-note pulse on the root.
  each(song.bass, (t, n, d, i) => {
    if (song.pulse && d > step * 1.5) { for (let k = 0; k < d / step - 0.5; k++) play('bass', M.bass, t + k * step, MIDI(n), step * 0.8, k ? 0.6 : 1) }
    else play('bass', M.bass, t, MIDI(n), d, 1)
  })
  // Drums, as written; then sixteenth-note hats between the steps, and a tom fill closing the loop.
  const fillFrom = song.fill ? song.drums.length - song.fill.length : Infinity
  ;[...song.drums].forEach((c, i) => {
    const t = T(i)
    if (i >= fillFrom) { hit(song.fill[i - fillFrom], t); return }
    if (KIT[c]) hit(c, t)
    if (song.hats16) hit('h', t + step / 2, 0.5)
    if (song.hats16 && c !== 'h' && c !== 'C' && i % 2 === 1) hit('h', t, 0.8)
  })
  if (song.crash ?? (song.loop && song.hats16)) hit('C', t0)   // a crash on each loop's (or section's) downbeat
  // Jingles end on an orchestra hit: a full brass chord, crash and low tom together.
  if (song.hit && song.chords) {
    const t = t0 + lastLead * step, pcs = chordAt(lastLead).slice(0, 3)
    for (const [k, pc] of pcs.entries()) { play('brass', M.harm, t, 55 + ((pc - 55) % 12 + 12) % 12, step * 6, 0.9); play('strings', M.pad, t, 43 + ((pc - 43) % 12 + 12) % 12 + (k ? 12 : 0), step * 7, 1) }
    hit('C', t); hit('t', t); hit('K', t)
  }
  q.sort((a, b) => a.t - b.t)
  return song.lead.length * step
}

/* ── video soundtrack, now in stereo ──
   Replaces the template's mono render: the same timeline of logged sounds,
   rendered offline through the same buses, as 16-bit stereo WAV. */
window.__renderAudio = async (fromMs, toMs, rate = 24000) => {
  const dur = (toMs - fromMs) / 1000
  const ac = new OfflineAudioContext(2, Math.ceil(dur * rate), rate)
  const master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination)
  const s = ac.createGain(); s.gain.value = 0.9; s.connect(master)
  const m = ac.createGain(); m.gain.value = 0.5; m.connect(master)
  const log = window.__audioLog.filter((e) => e.t <= toMs)
  await window.__scheduleCries?.(ac, s, log, fromMs)
  log.forEach((e, i) => {
    const t = (e.t - fromMs) / 1000
    if (e.kind === 'sfx' && t >= 0 && SFX[e.name]) SFX[e.name].synth(ac, s, t)
    if (e.kind === 'music' && e.name) {
      const song = SONGS[e.name]
      const end = (log.slice(i + 1).find((x) => x.kind === 'music')?.t ?? toMs) - fromMs
      if (end / 1000 < 0) return
      const g = ac.createGain(); g.connect(m)
      g.gain.setValueAtTime(1, Math.max(0, end / 1000)); g.gain.linearRampToValueAtTime(0, Math.max(0, end / 1000) + 0.08)
      let t0 = t + 0.06
      do { const len = scheduleSong(ac, g, song, t0); t0 += len } while (song.loop && t0 < end / 1000)
    }
  })
  prepareOffline(ac, dur)
  const buf = await ac.startRendering()
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length
  const out = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o, x) => [...x].forEach((c, k) => out.setUint8(o + k, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * 4, true)
  for (let k = 0; k < n; k++) {
    out.setInt16(44 + k * 4, Math.max(-1, Math.min(1, L[k])) * 0x7fff, true)
    out.setInt16(46 + k * 4, Math.max(-1, Math.min(1, R[k])) * 0x7fff, true)
  }
  const bytes = new Uint8Array(out.buffer); let bin = ''
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000))
  return btoa(bin)
}

/* ══════════════ the League's music ══════════════
   Each Elite Four member gets their own intro under the VS splash and their
   words, in the spirit of their type; all four share one battle theme. The
   Champion gets a set of his own. Same shape as the gym's: a short sting,
   then a loop that holds for as long as they talk or fight. */

/** Will, psychic: E minor, an eerie glockenspiel line over slow strings. */
SONGS.e4Will = { file: null, loop: true, bpm: 104, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'glock', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Em', 'B7'], lead: bars('B4 . E5 . G5 . B5 .', 'D#6 . . . . . . .'), bass: bars('E2 . . . . . . .', 'B1 . . . . . . .'),
    drums: 'K.......' + 'T.t.T.t.', crash: true },
  sections: [{
    chords: 'Em C Am B7 Em G C B7'.split(' '),
    lead: bars('E5 . G5 . B5 . G5 .', 'C6 . B5 . G5 . E5 .', 'A5 . C6 . E6 . C6 .', 'D#6 . . . B5 . F#5 .',
      'G5 . B5 . E6 . B5 .', 'D6 . B5 . G5 . D5 .', 'E5 . G5 . C6 . E6 .', 'D#6 . . . . . - -'),
    bass: bars('E2 . . . B1 . . .', 'C2 . . . G1 . . .', 'A1 . . . E2 . . .', 'B1 . . . F#2 . . .',
      'E2 . . . B1 . . .', 'G1 . . . D2 . . .', 'C2 . . . G1 . . .', 'B1 . . . B1 . . .'),
    drums: 'K...h...'.repeat(7) + 'K...T.t.' }] }

/** Koga, poison: D minor with a flattened second (the ninja's E-flat), a sly synth and tom hits. */
SONGS.e4Koga = { file: null, loop: true, bpm: 120, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'synth', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Dm', 'A'], lead: bars('D5 . . . Eb5 . . .', 'C#5 . . . . . . .'), bass: bars('D2 . . . D2 . . .', 'A1 . . . A1 . . .'),
    drums: 'K...T...' + 'T.t.TtSS', crash: true },
  sections: [{
    chords: 'Dm Eb Dm C Dm Eb Gm A'.split(' '),
    lead: bars('D5 . F5 . A5 . F5 .', 'G5 . Eb5 . Bb4 . G5 .', 'A5 . . F5 D5 . F5 .', 'E5 . G5 . C6 . G5 .',
      'D6 . A5 . F5 . A5 .', 'Bb5 . G5 . Eb5 . G5 .', 'G5 . Bb5 . D6 . Bb5 .', 'C#6 . . . A5 . E5 .'),
    bass: bars('D2 . . D2 . . A1 .', 'Eb2 . . Eb2 . . Bb1 .', 'D2 . . D2 . . A1 .', 'C2 . . C2 . . G1 .',
      'D2 . . D2 . . A1 .', 'Eb2 . . Eb2 . . Bb1 .', 'G1 . . G1 . . D2 .', 'A1 . . A1 . . E2 .'),
    drums: 'K..T..t.'.repeat(7) + 'K.TtTtSS' }] }

/** Bruno, fighting: A minor, pounding brass and a kick that doesn't let up. */
SONGS.e4Bruno = { file: null, loop: true, bpm: 132, div: 2, chordLen: 8, vol: 0.82,
  leadInst: 'brass', harmInst: 'brass', comp: true, hats16: false, crash: false, fill: 'TTtt',
  intro: { chords: ['Am', 'E'], lead: bars('A4 . - A4 . - C5 .', 'E5 . . . . . . .'), bass: bars('A1 . - A1 . - C2 .', 'E1 . . . . . . .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', crash: true, comp: false, fill: '' },
  sections: [{
    chords: 'Am Am F G Am Am F E'.split(' '),
    lead: bars('A4 . . A4 C5 . E5 .', 'A5 . . . G5 . E5 .', 'F5 . . F5 A5 . C6 .', 'B5 . . . G5 . D5 .',
      'A5 . C6 . E6 . C6 .', 'A5 . . . E5 . A5 .', 'F5 . A5 . C6 . A5 .', 'G#5 . . . B5 . E5 .'),
    bass: bars('A1 A1 A2 A1 A1 A2 A1 A1', 'A1 A1 A2 A1 A1 A2 A1 G1', 'F1 F1 F2 F1 F1 F2 F1 F1', 'G1 G1 G2 G1 G1 G2 G1 G1',
      'A1 A1 A2 A1 A1 A2 A1 A1', 'A1 A1 A2 A1 A1 A2 A1 G1', 'F1 F1 F2 F1 F1 F2 F1 F1', 'E1 E1 E2 E1 E1 E2 E1 E1'),
    drums: 'K.SKK.S.'.repeat(7) + 'K.SKSSSS' }] }

/** Karen, dark: F minor, slow and swung, a smoky electric piano with a walking bass. */
SONGS.e4Karen = { file: null, loop: true, bpm: 96, div: 2, chordLen: 8, swing: 0.3, vol: 0.8,
  leadInst: 'epiano', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Fm', 'C7'], lead: bars('C5 . F5 . Ab5 . C6 .', 'E5 . . . . . . .'), bass: bars('F2 . . . . . . .', 'C2 . . . . . . .'),
    drums: 'K.......' + 'S.g.S.gg' },
  sections: [{
    chords: 'Fm Db Bb7 C7 Fm Db Bbm C7'.split(' '),
    lead: bars('F5 . Ab5 . C6 . Ab5 .', 'Db6 . . . C6 . Ab5 .', 'Bb5 . D6 . F5 . Ab5 .', 'G5 . . . E5 . C5 .',
      'F5 . C6 . Ab5 . F5 .', 'Ab5 . F5 . Db5 . F5 .', 'Bb5 . Db6 . F6 . Db6 .', 'E5 . G5 . Bb5 . . .'),
    bass: bars('F2 . C2 . F2 . Ab2 .', 'Db2 . Ab1 . Db2 . F2 .', 'Bb1 . F2 . Bb1 . D2 .', 'C2 . G1 . C2 . E2 .',
      'F2 . C2 . F2 . Ab2 .', 'Db2 . Ab1 . Db2 . F2 .', 'Bb1 . F2 . Bb1 . Db2 .', 'C2 . G1 . C2 . E2 .'),
    drums: 'K.h.S.h.'.repeat(7) + 'K.h.S.Sg' }] }

/**
 * The Elite Four battle: B minor at 172 bpm, about 45 s a loop. A driving
 * verse, the verse again higher with the glockenspiel, a broad bridge in
 * D major, and a build back to the top.
 */
const E4_CHORDS = 'Bm G A F# Bm G Em F#'.split(' ')
const E4_BASS = bars('B1 B1 B2 B1 B1 B2 B1 A1', 'G1 G1 G2 G1 G1 G2 G1 F#1', 'A1 A1 A2 A1 A1 A2 A1 A1', 'F#1 F#1 F#2 F#1 F#1 F#2 E2 C#2',
  'B1 B1 B2 B1 B1 B2 B1 A1', 'G1 G1 G2 G1 G1 G2 G1 G1', 'E1 E1 E2 E1 E1 E2 E1 E1', 'F#1 F#1 F#2 F#1 A#1 C#2 E2 F#2')
SONGS.elite = { file: null, loop: true, bpm: 172, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Bm', 'F#'], lead: bars('B4 . - B4 . - D5 .', 'C#5 . - A#4 . - F#4 .'), bass: bars('B1 . - B1 . - D2 .', 'C#2 . - A#1 . - F#1 .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', hats16: false, comp: false, fill: '', crash: true },
  sections: [
    { chords: E4_CHORDS, bass: E4_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS',
      lead: bars('B4 . D5 F#5 . E5 D5 C#5', 'D5 . B4 . G5 . F#5 E5', 'E5 . C#5 . A5 . G5 F#5', 'F#5 . . . A#4 . C#5 E5',
        'D5 F#5 B5 . A5 G5 F#5 E5', 'D5 . G5 . B5 . G5 D5', 'E5 . G5 . B5 . A5 G5', 'F#5 . . . C#5 . A#4 .') },
    { chords: E4_CHORDS, bass: E4_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS', glock: true,
      lead: bars('F#5 . . B5 D6 . C#6 B5', 'B5 . . G5 D6 . B5 G5', 'C#6 . . A5 E6 . C#6 A5', 'C#6 . . . A#5 . F#5 .',
        'B5 . D6 . F#6 . E6 D6', 'D6 . B5 . G5 . B5 D6', 'E6 . D6 . B5 . G5 E5', 'F#5 . A#5 . C#6 . E6 .') },
    { // Bridge: broad, half-time, D major
      chords: 'D A Bm G D A G F#'.split(' '), comp: false, hats16: false, crash: true,
      lead: bars('F#5 . . . A5 . . .', 'C#6 . . . E5 . . .', 'D6 . . . B5 . F#5 .', 'B5 . . . . . . .',
        'A5 . . . D6 . F#6 .', 'E6 . . . C#6 . A5 .', 'D6 . . . B5 . G5 .', 'A#5 . . . C#6 . E6 .'),
      bass: bars('D2 . . . D2 . A1 .', 'A1 . . . A1 . E2 .', 'B1 . . . B1 . F#2 .', 'G1 . . . G1 . D2 .',
        'D2 . . . D2 . A1 .', 'A1 . . . A1 . E2 .', 'G1 . . . G1 . D2 .', 'F#1 . . . F#1 . C#2 .'),
      drums: 'KhhhShhh'.repeat(7) + 'KhhhSSSS' },
    { // Build back to the top
      chords: 'Em Em F# F#'.split(' '), comp: false, glock: true, fill: 'SSSS',
      lead: bars('B4 . B4 . E5 . B4 .', 'G5 . G5 . E5 . B4 .', 'C#5 . C#5 . F#5 . A#5 .', 'C#6 . . . - - - -'),
      bass: bars('E1 E1 E2 E1 E1 E2 E1 E2', 'E1 E1 E2 E1 E1 E2 E1 E2', 'F#1 F#1 F#2 F#1 F#1 F#2 F#1 F#2', 'F#1 . . . F#1 . . .'),
      drums: 'KhKhKhKh' + 'KhKhKhKh' + 'KSKSKSKS' + 'SSSSSSSS' },
  ] }

/** The Champion's intro: a regal brass fanfare with timpani, then a stately loop in E-flat. */
SONGS.championIntro = { file: null, loop: true, bpm: 100, div: 2, chordLen: 8, vol: 0.88,
  leadInst: 'brass', harmInst: 'brass', comp: false, hats16: false, crash: false, fill: 'TTtt', glock: true,
  intro: { chords: ['Bb', 'Bb'], lead: bars('F4 . Bb4 . D5 . F5 .', 'Bb5 . . . . . . .'), bass: bars('Bb1 . . . . . . .', 'Bb1 . . . . . . .'),
    drums: 'K...T.t.' + 'TtTtTtSS', crash: true, fill: '' },
  sections: [{
    chords: 'Eb Cm Ab Bb Eb Gm Ab Bb'.split(' '),
    lead: bars('G5 . . . Bb5 . Eb6 .', 'Eb6 . . . C6 . G5 .', 'Ab5 . . . C6 . Eb6 .', 'D6 . . . . . Bb5 .',
      'G5 . Bb5 . Eb6 . G6 .', 'F6 . . . D6 . Bb5 .', 'C6 . . . Eb6 . Ab5 .', 'Bb5 . . . F5 . D5 .'),
    bass: bars('Eb2 . . . Bb1 . . .', 'C2 . . . G1 . . .', 'Ab1 . . . Eb2 . . .', 'Bb1 . . . F2 . . .',
      'Eb2 . . . Bb1 . . .', 'G1 . . . D2 . . .', 'Ab1 . . . Eb2 . . .', 'Bb1 . . . Bb1 . D2 .'),
    drums: 'K..hT.h.'.repeat(7) + 'K.TtTtSS' }] }

/**
 * The Champion's battle: F minor at 180 bpm, the biggest piece in the game.
 * A relentless verse, a heroic half-time chorus with the glockenspiel, and
 * the verse again on the synth over the brass.
 */
const CHAMP_A = { chords: 'Fm Db Eb C Fm Db Bbm C'.split(' '), drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS',
  lead: bars('F5 . Ab5 C6 . Bb5 Ab5 G5', 'F5 . Db5 . Ab5 . F5 Db5', 'Eb5 . G5 . Bb5 . Ab5 G5', 'G5 . . . E5 . C5 .',
    'C6 . . F6 . Eb6 Db6 C6', 'Db6 . Ab5 . F5 . Ab5 Db6', 'Db6 . Bb5 . F5 . Db6 F6', 'E6 . . . C6 . G5 .'),
  bass: bars('F1 F1 F2 F1 F1 F2 F1 F1', 'Db2 Db2 Db3 Db2 Db2 Db3 Db2 C2', 'Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2', 'C2 C2 C3 C2 C2 C3 Bb1 G1',
    'F1 F1 F2 F1 F1 F2 F1 F1', 'Db2 Db2 Db3 Db2 Db2 Db3 Db2 C2', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1', 'C2 C2 C3 C2 E2 G2 Bb2 C3') }
SONGS.champion = { file: null, loop: true, bpm: 180, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Fm', 'C'], lead: bars('F5 . - F5 . - Ab5 .', 'G5 . - E5 . - C5 .'), bass: bars('F1 . - F1 . - Ab1 .', 'G1 . - E2 . - C2 .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', hats16: false, comp: false, fill: '', crash: true },
  sections: [
    { ...CHAMP_A },
    { // Chorus: heroic, half-time
      chords: 'Db Eb Cm Fm Db Eb C C'.split(' '), comp: false, hats16: false, crash: true, glock: true,
      lead: bars('F5 . . . Ab5 . . .', 'G5 . . . Bb5 . . .', 'C6 . . . G5 . Eb5 .', 'F5 . . . . . . .',
        'Ab5 . . . Db6 . F6 .', 'G6 . . . Eb6 . Bb5 .', 'C6 . . . E6 . G6 .', 'C6 . . . - - - -'),
      bass: bars('Db2 . . . Db2 . Ab1 .', 'Eb2 . . . Eb2 . Bb1 .', 'C2 . . . C2 . G1 .', 'F1 . . . F1 . C2 .',
        'Db2 . . . Db2 . Ab1 .', 'Eb2 . . . Eb2 . Bb1 .', 'C2 . . . C2 . G1 .', 'C2 . . . C2 . . .'),
      drums: 'KhhhShhh'.repeat(7) + 'KhhhSSSS' },
    { ...CHAMP_A, leadInst: 'synth', glock: true },
  ] }

/** Which intro plays under each League member's words. */
const LEAGUE_INTRO = { will: 'e4Will', koga: 'e4Koga', bruno: 'e4Bruno', karen: 'e4Karen', lance: 'championIntro' }

/*
 * Multi-hit moves. Each hit gets its own STRIKE ring, and a missed ring is a
 * missed hit: only landing every ring deals the move's full damage. `power`
 * is per hit. PP cost goes by total power (power × hits): up to 50 costs
 * 1 PP, 55–75 costs 2, 80 and up costs 3. Everyone gets one, picked by
 * species where it's a real signature (Froakie's Water Shuriken), otherwise
 * by type.
 */
Object.assign(MOVEDEX, {
  'DOUBLE HIT':     { type: 'normal', power: 35, cat: 'phys', cost: 2, hits: 2, fx: 'dash', snd: 'thud' },
  'FURY SWIPES':    { type: 'normal', power: 20, cat: 'phys', cost: 2, hits: 3, fx: 'slash', snd: 'whoosh' },
  'DOUBLE KICK':    { type: 'fighting', power: 30, cat: 'phys', cost: 2, hits: 2, fx: 'dash', snd: 'thud' },
  'BULLET SEED':    { type: 'grass', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'seed', snd: 'whoosh' },
  'WATER SHURIKEN': { type: 'water', power: 20, cat: 'spec', cost: 2, hits: 3, fx: 'shuriken', snd: 'whoosh' },
  'DUAL CHOP':      { type: 'dragon', power: 40, cat: 'phys', cost: 3, hits: 2, fx: 'slash', snd: 'thud' },
  'ROCK BLAST':     { type: 'rock', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'rock', snd: 'thud' },
  'BONE RUSH':      { type: 'ground', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'dash', snd: 'thud' },
  'ICICLE SPEAR':   { type: 'ice', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'icicle', snd: 'whoosh' },
  TWINEEDLE:        { type: 'bug', power: 25, cat: 'phys', cost: 1, hits: 2, fx: 'needle', snd: 'whoosh' },
  'DUAL WINGBEAT':  { type: 'flying', power: 40, cat: 'phys', cost: 3, hits: 2, fx: 'dash', snd: 'whoosh' },
})
const MULTI_BY_SPECIES = { TORCHIC: 'DOUBLE KICK', CHIMCHAR: 'FURY SWIPES', FROAKIE: 'WATER SHURIKEN', TREECKO: 'BULLET SEED', CHESPIN: 'BULLET SEED', RIOLU: 'DOUBLE KICK', GIBLE: 'DUAL CHOP', LARVITAR: 'ROCK BLAST' }
const MULTI_BY_TYPE = { grass: 'BULLET SEED', water: 'WATER SHURIKEN', fighting: 'DOUBLE KICK', dragon: 'DUAL CHOP', rock: 'ROCK BLAST', ground: 'BONE RUSH', ice: 'ICICLE SPEAR', bug: 'TWINEEDLE', flying: 'DUAL WINGBEAT' }
const multiMoveOf = (m) => MULTI_BY_SPECIES[m.name] ?? MULTI_BY_TYPE[m.types[0]] ?? 'DOUBLE HIT'

/*
 * Support moves, which 2v2 brings in. They heal, raise stats, or change who
 * goes when. A ring still decides how well they work: PERFECT gives the
 * strongest version. `prio` is the priority bracket (higher acts first).
 * After You is +4 here (it's 0 in the games, where it often whiffs on a
 * faster ally); the point of it in this game is "let my partner go now".
 */
const SUPPORT = {
  'HELPING HAND': { type: 'normal', target: 'ally', effect: 'boost', prio: 5, cost: 0, sub: 'ally ×1.5 · first' },
  'AFTER YOU':    { type: 'normal', target: 'ally', effect: 'hurry', prio: 4, cost: 0, sub: 'ally goes next' },
  HOWL:           { type: 'normal', target: 'side', effect: 'atkUp', prio: 0, cost: 1, sub: 'ATK ▲ both', solo: 'ATK ▲' },
  GROWTH:         { type: 'normal', target: 'self', effect: 'growth', prio: 0, cost: 1, sub: 'ATK/SP.A ▲ self', solo: 'ATK/SP.A ▲' },
  'LIFE DEW':     { type: 'water', target: 'side', effect: 'heal', amount: 0.25, prio: 0, cost: 1, sub: 'heal both 25%', solo: 'heal 25%' },
  'HEAL PULSE':   { type: 'psychic', target: 'ally', effect: 'heal', amount: 0.5, prio: 0, cost: 1, sub: 'heal ally 50%' },
  TAILWIND:       { type: 'flying', target: 'side', effect: 'tailwind', prio: 0, cost: 1, sub: 'SPE ×2 · 4 turns' },
  RECOVER:        { type: 'normal', target: 'self', effect: 'heal', amount: 0.5, prio: 0, cost: 0, sub: 'heals self 50%' },
  'SLACK OFF':    { type: 'normal', target: 'self', effect: 'heal', amount: 0.5, prio: 0, cost: 0, sub: 'heals self 50%' },
}
const SUPPORT_BY_TYPE = { water: 'LIFE DEW', psychic: 'HEAL PULSE', fairy: 'HEAL PULSE', fire: 'HOWL', fighting: 'HOWL', dark: 'HOWL', grass: 'GROWTH', flying: 'TAILWIND', dragon: 'TAILWIND' }
/* What scalpers' Pokémon add in a 2v2: a way to patch themselves up. */
const TRAINER_SUPPORT = { GHOLDENGO: 'RECOVER', HIPPOWDON: 'SLACK OFF' }
/* Moves that hit both of yours in a 2v2, at 0.75× each, like the games' spread moves. */
const SPREAD = new Set(['BULLDOZE', 'SURF', 'DISCHARGE', 'SLUDGE WAVE'])

const moveInfo = (name) => SUPPORT[name] ? { name, kind: 'support', ...SUPPORT[name] } : { name, kind: 'strike', ...MOVEDEX[name] }

/*
 * Spread moves for your side in a 2v2. 'foes' hits both opponents; 'all'
 * hits everyone else on the field, your own partner included, like
 * Earthquake in the games. These all travel along the ground, so the
 * partner can JUMP to get out of the way. With more than one target each
 * takes 0.75×.
 */
Object.assign(MOVEDEX, {
  'HEAT WAVE':      { type: 'fire', power: 45, cat: 'spec', cost: 1, spread: 'foes', fx: 'ember', snd: 'whoosh' },
  'RAZOR LEAF':     { type: 'grass', power: 40, cat: 'phys', cost: 1, spread: 'foes', fx: 'seed', snd: 'whoosh' },
  'ROCK SLIDE':     { type: 'rock', power: 45, cat: 'phys', cost: 1, spread: 'foes', fx: 'rock', snd: 'thud' },
  'ICY WIND':       { type: 'ice', power: 35, cat: 'spec', cost: 1, spread: 'foes', fx: 'icicle', snd: 'whoosh' },
  'AIR CUTTER':     { type: 'flying', power: 40, cat: 'spec', cost: 1, spread: 'foes', fx: 'slash', snd: 'whoosh' },
  'DAZZLING GLEAM': { type: 'fairy', power: 45, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'whoosh' },
  SNARL:            { type: 'dark', power: 35, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'crunch' },
  'STRUGGLE BUG':   { type: 'bug', power: 35, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'whoosh' },
  'HYPER VOICE':    { type: 'normal', power: 45, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'whoosh' },
  SURF:             { type: 'water', power: 45, cat: 'spec', cost: 1, spread: 'all', fx: 'water', snd: 'whoosh' },
  EARTHQUAKE:       { type: 'ground', power: 50, cat: 'phys', cost: 1, spread: 'all', fx: 'quake', snd: 'quake' },
  DISCHARGE:        { type: 'electric', power: 40, cat: 'spec', cost: 1, spread: 'all', fx: 'spray', snd: 'zap' },
  'SLUDGE WAVE':    { type: 'poison', power: 45, cat: 'spec', cost: 1, spread: 'all', fx: 'spray', snd: 'whoosh' },
})
const SPREAD_BY_TYPE = { fire: 'HEAT WAVE', water: 'SURF', grass: 'RAZOR LEAF', electric: 'DISCHARGE', ground: 'EARTHQUAKE', rock: 'ROCK SLIDE', ice: 'ICY WIND',
  poison: 'SLUDGE WAVE', flying: 'AIR CUTTER', fairy: 'DAZZLING GLEAM', dark: 'SNARL', bug: 'STRUGGLE BUG' }
/* ── PP to start a battle with ──
   Most Pokémon start each battle with 1 PP. The four natures that raise
   Speed (Timid, Hasty, Jolly, Naive) are quick off the mark: they start
   with 2. In a 2v2 both Pokémon bring theirs to the shared pool. */
const QUICK_NATURES = new Set(['Timid', 'Hasty', 'Jolly', 'Naive'])
const startPP = (m) => (QUICK_NATURES.has(m.nature[0]) ? 2 : 1)

/* ── EXP ──
   Medium-fast growth: Lv L to L+1 takes (L+1)^3 - L^3 points. Beating or
   catching a Pokémon is worth 12 × its level, 18 × from a scalper's. */
const expToNext = (L) => (L + 1) ** 3 - L ** 3
const expYield = (foe, trainer = false) => Math.round(foe.level * (trainer ? 18 : 12))
/** Stats at a level, from the same IVs and nature (the formula individual() uses). */
function statsAt(m, level) {
  const stats = {}
  for (const k of STAT_KEYS) {
    const b = m.base[BASE_KEY[k]], core = Math.floor((2 * b + m.ivs[k]) * level / 100)
    stats[k] = k === 'hp' ? core + level + 10 : Math.floor((core + 5) * (m.nature[1] === k ? 1.1 : m.nature[2] === k ? 0.9 : 1))
  }
  return stats
}
Object.assign(SFX, {
  exp: { file: null, synth: (ac, o, t) => tone(ac, o, t, { type: 'triangle', f: 520, f1: 1560, dur: .32, vol: .07 }) },
})

/* ── learned moves, and the four that are equipped ──
   Every Pokémon learns a pool of moves and carries at most four into
   battle, swapped in the Box. Everyone learns three 0-PP moves (Tackle, its
   species' own basic move where it has one, and Quick Attack), and must keep
   at least one 0-PP attack equipped, so there's always something to use with an
   empty PP bar. Support moves only work in a 2v2. */
Object.assign(MOVEDEX, {
  'QUICK ATTACK':  { type: 'normal', power: 40, cat: 'phys', cost: 0, prio: 1, fx: 'dash', snd: 'whoosh', sub: 'goes first' },
  'THUNDER SHOCK': { type: 'electric', power: 40, cat: 'spec', cost: 1, fx: 'spray', snd: 'zap' },
  'POWDER SNOW':   { type: 'ice', power: 40, cat: 'spec', cost: 1, fx: 'icicle', snd: 'whoosh' },
  'KARATE CHOP':   { type: 'fighting', power: 50, cat: 'phys', cost: 1, fx: 'slash', snd: 'thud' },
  'ROCK THROW':    { type: 'rock', power: 50, cat: 'phys', cost: 1, fx: 'rock', snd: 'thud' },
  'MUD-SLAP':      { type: 'ground', power: 30, cat: 'spec', cost: 1, fx: 'spray', snd: 'thud' },
  'DRAGON BREATH': { type: 'dragon', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow' },
  ASTONISH:        { type: 'ghost', power: 35, cat: 'phys', cost: 1, fx: 'dash', snd: 'shadow' },
  BITE:            { type: 'dark', power: 45, cat: 'phys', cost: 1, fx: 'dash', snd: 'crunch' },
  'METAL CLAW':    { type: 'steel', power: 50, cat: 'phys', cost: 1, fx: 'slash', snd: 'crunch' },
  CONFUSION:       { type: 'psychic', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow' },
  'POISON STING':  { type: 'poison', power: 35, cat: 'phys', cost: 1, fx: 'needle', snd: 'whoosh' },
  'BUG BITE':      { type: 'bug', power: 50, cat: 'phys', cost: 1, fx: 'dash', snd: 'crunch' },
  GUST:            { type: 'flying', power: 40, cat: 'spec', cost: 1, fx: 'spray', snd: 'whoosh' },
  'FAIRY WIND':    { type: 'fairy', power: 40, cat: 'spec', cost: 1, fx: 'spray', snd: 'whoosh' },
})
/* Alex's Porygon. */
Object.assign(MOVEDEX, {
  'TRI ATTACK': { type: 'normal', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'zap' },
  PSYBEAM:      { type: 'psychic', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow' },
})
Object.assign(OWN_MOVE, { electric: 'THUNDER SHOCK', ice: 'POWDER SNOW', fighting: 'KARATE CHOP', rock: 'ROCK THROW', ground: 'MUD-SLAP', dragon: 'DRAGON BREATH',
  ghost: 'ASTONISH', dark: 'BITE', steel: 'METAL CLAW', psychic: 'CONFUSION', poison: 'POISON STING', bug: 'BUG BITE', flying: 'GUST', fairy: 'FAIRY WIND' })
const MAX_MOVES = 4
const moveCost = (name) => (SUPPORT[name] ?? MOVEDEX[name]).cost ?? 0
/*
 * Moves are learned gradually. Each Pokémon has a level schedule, built
 * from its type: its basic 0-PP move at Lv 1, its type move at 3, Quick
 * Attack at 6, the multi-hit at 9, a support move at 12, the spread move at
 * 15, a second support move at 18. It appears knowing only what its level
 * allows, so a Lv 5 starter knows two moves. Move Discs teach anything else.
 */
function levelMoves(m) {
  const t = m.types[0], basic = NORMAL_MOVE[m.name] ?? 'TACKLE', own = OWN_MOVE[t], sup = SUPPORT_BY_TYPE[t] ?? 'HELPING HAND'
  const list = [[1, basic], [3, own ?? 'QUICK ATTACK'], ...(own ? [[6, 'QUICK ATTACK']] : []), [7, statusOf(m)], [9, multiMoveOf(m)], [10, 'REFRESH'], [12, sup],
    [15, SPREAD_BY_TYPE[t] ?? 'HYPER VOICE'], [18, sup === 'HELPING HAND' ? 'AFTER YOU' : 'HELPING HAND'], ...(basic !== 'TACKLE' ? [[21, 'TACKLE']] : [])]
  const seen = new Set()
  return list.filter(([, n]) => !seen.has(n) && seen.add(n))
}
/**
 * Fills in learned and equipped moves the first time they're needed: all
 * moves due by its level, with the basic 0-PP move plus the three most
 * recent equipped (the games keep the latest four).
 */
function learn(m) {
  if (m.moves) return m
  const known = levelMoves(m).filter(([lv]) => lv <= m.level).map(([, n]) => n)
  m.learned = known
  m.moves = [known[0], ...known.slice(1).slice(-(MAX_MOVES - 1))]
  return m
}
/** Teaches one move (a level-up or a Move Disc), equipping it if there's a free slot. */
function teach(m, n, fromDisc = false) {
  learn(m)
  if (m.learned.includes(n)) return { name: n, already: true }
  if (fromDisc && !canLearnDisc(m, n)) return { name: n, cant: true }
  m.learned.push(n)
  const equipped = m.moves.length < MAX_MOVES
  if (equipped) m.moves.push(n)
  return { name: n, equipped }
}
/** Everything due at exactly this level, taught. */
const learnAtLevel = (m) => levelMoves(learn(m)).filter(([lv, n]) => lv === m.level && !m.learned.includes(n)).map(([, n]) => teach(m, n))
/** What it learns later, for the Box: [[level, name]]. */
const upcoming = (m) => levelMoves(learn(m)).filter(([lv, n]) => lv > m.level && !m.learned.includes(n))

/* Move Discs: one-use items that teach their move to any Pokémon. The VVM can
   stock them, and a beaten scalper drops one. */
const DISC_POOL = ['HELPING HAND', 'TAILWIND', 'AFTER YOU', 'HEAL PULSE', 'HOWL', 'EARTHQUAKE', 'ROCK SLIDE', 'HYPER VOICE']
const discKey = (n) => 'disc:' + n
/*
 * Which Pokémon each disc can teach, like the games' TM lists. The support
 * staples work for nearly everyone; the rest follow type, with a few extra
 * species that fit. Magikarp learns nothing from a disc.
 */
const DISC_RULES = {
  'HELPING HAND': { all: true },
  'AFTER YOU':    { all: true },
  'HYPER VOICE':  { all: true },
  HOWL:           { all: true },
  EARTHQUAKE:     { types: ['ground', 'rock', 'steel', 'fighting', 'dragon'], species: ['SNORLAX', 'GREEDENT'] },
  'ROCK SLIDE':   { types: ['ground', 'rock', 'steel', 'fighting', 'dragon'], species: ['SNORLAX', 'GREEDENT'] },
  TAILWIND:       { types: ['flying', 'dragon'], species: ['EEVEE'] },
  'HEAL PULSE':   { types: ['psychic', 'fairy', 'water'] },
}
const DISC_NEVER = ['MAGIKARP']
/** Can this Pokémon learn this disc's move? */
function canLearnDisc(m, move) {
  const r = DISC_RULES[move]
  if (!r || DISC_NEVER.includes(m.name)) return false
  return !!(r.all || r.types?.some((t) => m.types.includes(t)) || r.species?.includes(m.name))
}
/** Registers a disc as a Bag item the first time one turns up. */
const discItem = (n) => (ITEMS[discKey(n)] ??= { name: n, sub: `MOVE DISC · teaches ${n}`, cls: 't-disc', disc: n })
/** The equipped moves (at most four), used in 1v1 and 2v2 alike. */
const movesOf = (m) => learn(m).moves
const duoMovesOf = movesOf
/**
 * Puts `name` into equipped slot `slot`. Returns an error message instead
 * when that would leave no 0-PP move equipped.
 */
function equip(m, slot, name) {
  learn(m)
  if (m.moves.includes(name)) return `${name} is already equipped.`
  const next = m.moves.slice(); next[slot] = name
  // A 0-PP *attack*: Helping Hand costs nothing too, but it can't hit anything.
  if (!next.some((n) => moveCost(n) === 0 && !SUPPORT[n])) return `Keep at least one 0 PP attack (like ${m.moves[slot]}) so ${m.name} always has something to hit with.`
  m.moves = next
  return null
}

/*
 * Accuracy and evasion, on the timing rings. Each stage (−3 to +3, reset on
 * switching out) works out as one number per attack: the attacker's accuracy
 * stage minus the target's evasion stage, counting only when it's below 0.
 *  · Your attack on a target you have trouble hitting: your STRIKE ring
 *    closes 15% faster per stage and every grade's window (PERFECT, GREAT…)
 *    is 20% tighter per stage.
 *  · An attack on you from a foe that has trouble hitting you: its ring
 *    closes 15% slower per stage and your parry, dodge and jump windows are
 *    20% wider per stage.
 * Accuracy drops: Sand Attack, Smokescreen, Flash, Kinesis, and Mud-Slap's
 * hit. Evasion: Minimize, Double Team. Foes use them too.
 */
Object.assign(SUPPORT, {
  'SAND ATTACK': { type: 'ground', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  SMOKESCREEN:   { type: 'normal', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  FLASH:         { type: 'normal', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  KINESIS:       { type: 'psychic', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  MINIMIZE:      { type: 'normal', target: 'self', effect: 'evaUp', prio: 0, cost: 1, sub: 'EVA ▲ self', solo: 'EVA ▲' },
  'DOUBLE TEAM': { type: 'normal', target: 'self', effect: 'evaUp', prio: 0, cost: 1, sub: 'EVA ▲ self', solo: 'EVA ▲' },
})
MOVEDEX['MUD-SLAP'].accDown = 1   // damage, and the target's accuracy falls a stage
/** Each type's accuracy/evasion move, learned at Lv 7 (and what foes of that type use). */
const STATUS_BY_TYPE = { ground: 'SAND ATTACK', rock: 'SAND ATTACK', fire: 'SMOKESCREEN', electric: 'FLASH', fairy: 'FLASH', psychic: 'KINESIS',
  poison: 'MINIMIZE', ghost: 'MINIMIZE', water: 'MINIMIZE' }
const statusOf = (m) => STATUS_BY_TYPE[m.types[0]] ?? 'DOUBLE TEAM'
const STAGE_MAX = 3
/** Attacker's accuracy minus target's evasion, only counting when it's below 0: −3..0. */
const ringNet = (acc, eva) => Math.max(-STAGE_MAX, Math.min(0, (acc ?? 0) - (eva ?? 0)))
const strikeRing = (net) => ({ speed: 1 - 0.15 * -net, tight: 1 - 0.2 * -net })   // your ring: faster, tighter
const defendRing = (net) => ({ speed: 1 + 0.15 * -net, wide: 1 + 0.2 * -net })    // their ring on you: slower, wider windows
/**
 * How a foe paces its attacks, so you have to watch the ring rather than tap
 * from rhythm: each hit's ring closes at a speed picked from `speed`, after a
 * wind-up of up to `wait` ms once the move is announced. `tell` is the chance
 * of a feint, ×2 or low → high (Gym Leaders keep their own `tellRate`).
 * Wild Pokémon and Brian vary a little; scalpers and leaders a lot. Everyday
 * trainers and the crew start throwing tells once your lead is Lv 15.
 */
function attackPace(T, lv) {
  if (!T || T.easy) return { speed: [0.92, 1.08], wait: 250, tell: 0 }
  if (T.hard) return { speed: [0.75, 1.15], wait: 550, tell: 0 }
  if (T === HERB || T === PAUL) return { speed: [0.78, 1.15], wait: 500, tell: lv >= 10 ? 0.25 : 0.12 }
  return { speed: [0.85, 1.12], wait: 400, tell: lv >= 15 ? 0.12 : 0 }
}
const paceRoll = ([lo, hi]) => lo + Math.random() * (hi - lo)
/** "ACC▼2", "EVA▲" for the HUD tags. */
const stageTags = (t) => [t.acc && `ACC${t.acc > 0 ? '▲' : '▼'}${Math.abs(t.acc) > 1 ? Math.abs(t.acc) : ''}`, t.eva && `EVA${t.eva > 0 ? '▲' : '▼'}${Math.abs(t.eva) > 1 ? Math.abs(t.eva) : ''}`].filter(Boolean)
Object.assign(DISC_RULES, { 'SAND ATTACK': { all: true }, SMOKESCREEN: { all: true }, 'DOUBLE TEAM': { all: true }, MINIMIZE: { all: true }, FLASH: { all: true } })
DISC_POOL.push('SAND ATTACK', 'SMOKESCREEN', 'DOUBLE TEAM', 'MINIMIZE', 'FLASH')

/*
 * Status conditions: one at a time on a Pokémon (`m.status`). They carry over
 * between battles, like HP, until cured: a cure item, Refresh or Heal Bell,
 * the Pokémon Center, a Revive, or fainting.
 *  · PAR, paralysis: 25% of turns it can't move; its parry, dodge and jump
 *    windows are 20% narrower; half Speed (in 2v2, where Speed sets order).
 *  · FRZ, frozen: can't move; thaws 20% of turns, or at once when hit by a
 *    fire move. Rings on it can't be parried, dodged or jumped.
 *  · BRN, burned: its physical attacks do half damage; loses 1/16 of max HP
 *    at the end of each turn.
 *  · PSN, poisoned: loses 1/8 of max HP at the end of each turn.
 * Electric types can't be paralyzed, Fire types burned, Ice types frozen,
 * Poison and Steel types poisoned.
 */
const STATUS_NAME = { par: 'PAR', frz: 'FRZ', brn: 'BRN', psn: 'PSN' }
const STATUS_WORD = { par: 'paralyzed', frz: 'frozen', brn: 'burned', psn: 'poisoned' }
const STATUS_IMMUNE = { par: ['electric'], brn: ['fire'], frz: ['ice'], psn: ['poison', 'steel'] }
/** Moves with a chance to inflict a status when they land, per hit: [status, chance]. */
const STATUS_ON_HIT = {
  'THUNDER SHOCK': ['par', 0.1], THUNDERBOLT: ['par', 0.1], DISCHARGE: ['par', 0.3], NUZZLE: ['par', 1], SPARK: ['par', 0.3],
  EMBER: ['brn', 0.1], FLAMETHROWER: ['brn', 0.1], 'FIRE FANG': ['brn', 0.1], 'LAVA PLUME': ['brn', 0.3], 'FLAME WHEEL': ['brn', 0.1], 'HEAT WAVE': ['brn', 0.1],
  'POWDER SNOW': ['frz', 0.1], BLIZZARD: ['frz', 0.1], 'ICE BEAM': ['frz', 0.1],
  'POISON STING': ['psn', 0.3], 'SLUDGE WAVE': ['psn', 0.1], 'SLUDGE BOMB': ['psn', 0.3], 'CROSS POISON': ['psn', 0.1], TWINEEDLE: ['psn', 0.2], 'POISON JAB': ['psn', 0.3],
}
/* Status moves that inflict one outright (taught by Move Disc). */
Object.assign(SUPPORT, {
  'THUNDER WAVE':   { type: 'electric', target: 'foe', effect: 'status', status: 'par', prio: 0, cost: 1, sub: 'paralyzes the foe', solo: 'paralyzes' },
  'WILL-O-WISP':    { type: 'fire', target: 'foe', effect: 'status', status: 'brn', prio: 0, cost: 1, sub: 'burns the foe', solo: 'burns' },
  'POISON POWDER':  { type: 'poison', target: 'foe', effect: 'status', status: 'psn', prio: 0, cost: 1, sub: 'poisons the foe', solo: 'poisons' },
})
Object.assign(DISC_RULES, { 'THUNDER WAVE': { types: ['electric', 'normal', 'psychic', 'dragon'] }, 'WILL-O-WISP': { types: ['fire', 'ghost', 'psychic'] }, 'POISON POWDER': { types: ['grass', 'bug', 'poison'] } })
DISC_POOL.push('THUNDER WAVE', 'WILL-O-WISP', 'POISON POWDER')
/** Can `m` take this status right now? (Not if it already has one, or its type is immune.) */
const canTake = (m, st) => !m.status && m.hp > 0 && !STATUS_IMMUNE[st].some((t) => m.types.includes(t))
/** After a landed hit: the status it inflicts, if its chance comes up. */
function statusFromHit(def, mv, r) { const e = STATUS_ON_HIT[mv.name]; return e && canTake(def, e[0]) && (window.__forceStatusHit || r() < e[1]) ? e[0] : null }   // __forceStatusHit: testing only
/** At a Pokémon's turn: 'thaw', 'frozen', 'para' (can't move this turn) or null. */
function statusAtAction(m, r) {
  if (m.status === 'frz') { if (r() < 0.2) { m.status = null; return 'thaw' } return 'frozen' }
  return m.status === 'par' && r() < 0.25 ? 'para' : null
}
const STATUS_TEXT = { thaw: 'thawed out!', frozen: 'is frozen solid!', para: "is paralyzed! It can't move!" }
const STATUS_GOT = { par: 'is paralyzed! It may be unable to move!', frz: 'was frozen solid!', brn: 'was burned!', psn: 'was poisoned!' }
/** End of turn: the HP a burn or poison takes. */
const statusTick = (m) => (m.hp > 0 && (m.status === 'brn' || m.status === 'psn') ? Math.max(1, Math.floor(m.stats.hp / (m.status === 'brn' ? 16 : 8))) : 0)
const statusChip = (m) => (m.status ? `<span class="st ${m.status}">${STATUS_NAME[m.status]}</span>` : '')

/* Curing a status: items (Antidote, Paralyze Heal, Burn Heal, Ice Heal, Full
   Heal), and two support moves. Refresh cures the user (everyone learns it at
   Lv 10); Heal Bell cures your whole side (Move Disc). */
const CURE_ITEMS = ['antidote', 'parlyz', 'burnheal', 'iceheal', 'fullheal']
/** The cure to spend on `m`: the one made for its status if you have it, else a Full Heal; null if none fits. */
const cureFor = (m, bag) => (!m.status ? null : CURE_ITEMS.find((k) => k !== 'fullheal' && bag[k] && ITEMS[k].cure.includes(m.status)) ?? (bag.fullheal ? 'fullheal' : null))
const cureCount = (bag) => CURE_ITEMS.reduce((n, k) => n + (bag[k] ?? 0), 0)
Object.assign(SUPPORT, {
  REFRESH:     { type: 'normal', target: 'self', effect: 'cure', prio: 0, cost: 1, sub: 'cures own status', solo: 'cures its status' },
  'HEAL BELL': { type: 'normal', target: 'side', effect: 'cure', prio: 0, cost: 1, sub: 'cures both', solo: 'cures its status' },
})
Object.assign(DISC_RULES, { REFRESH: { all: true }, 'HEAL BELL': { all: true } })
DISC_POOL.push('HEAL BELL')

/* The battle Bag: a scrolling list of what you have, in this order. */
const BATTLE_ITEMS = ['ball', 'great', 'potion', 'super', 'revive', ...CURE_ITEMS]
/** One battle-Bag button: `off` greys it out, `why` is the line under its name. */
const bagButton = (k, n, off, why) => `<button class="btn ${ITEMS[k].cls}${off ? ' off' : ''}" data-act="${k}">${ITEMS[k].name}<small>× ${n} · ${why}</small></button>`
/** The list, scrolling, with BACK below it; a note when it's empty. */
const bagPanel = (buttons) => `<div class="bagscroll">${buttons.join('') || '<p class="bagempty">Your Bag is empty.</p>'}</div><button class="btn fback t-run" data-act="back">◀ BACK</button>`

/**
 * After the battle Bag is drawn: a bouncing ▼ at its foot while items
 * are hidden below, kept up to date as it scrolls.
 */
function bagMore(panel) {
  const list = panel.querySelector('.bagscroll'); if (!list) return
  const tag = document.createElement('div'); tag.className = 'bagmore'; panel.appendChild(tag)
  const update = () => {
    const below = [...list.querySelectorAll('.btn')].filter((b) => b.offsetTop + b.offsetHeight / 2 > list.scrollTop + list.clientHeight).length
    tag.textContent = '▼'; tag.hidden = !below   // just a bouncing arrow while there's more below
  }
  list.addEventListener('scroll', update, { passive: true }); requestAnimationFrame(update)
}

/*
 * Evolution. Each species' next form and level come from DATA.evos (real
 * levels where the games use them, stand-ins for stones, trade and the like).
 * It's checked on a level-up: a Pokémon at or past its level is prompted to
 * evolve after the battle (even one caught above that level: at its next
 * level-up). Stopped, it tries again 5 levels later. Branching species (Eevee)
 * pick one form, once.
 */
const speciesByName = (n) => [...DATA.starters, ...DATA.wild, ...DATA.trainer, ...(DATA.forms ?? [])].find((s) => s.name === n)
/** The evolution `m` is due for at its level, or null. */
function evoDue(m) {
  if (m.evoForce) return m.evoForce   // an evolution item, used from the Bag
  if (m.hp <= 0) return null
  const how = EVO_HOW[m.name]
  if (how) {
    if (m.evoWait && m.level < m.evoWait) return null
    // At a level-up: knowing the move, or a full Bond (with the time of day or a Fairy move where that picks the form).
    return how.find((r) => (r.move ? learn(m).learned.includes(r.move) : r.bond ? bondReady(m, r) : false)) ?? null
  }
  const opts = DATA.evos?.[m.name]; if (!opts?.length) return null
  m.evoPick ??= Math.floor(Math.random() * opts.length)
  const e = opts[Math.min(m.evoPick, opts.length - 1)]
  return m.level >= e.level && (!m.evoWait || m.level >= m.evoWait) ? e : null
}
/** "Charmeleon at Lv 16", for the stat page. */
function evoText(m) {
  const how = EVO_HOW[m.name]
  if (how) return how.map((r) => `${cap1(r.to)} ${howText(r)}`).join('; ') + (m.evoWait ? ` (it was stopped: not before Lv ${m.evoWait})` : '')
  const opts = DATA.evos?.[m.name]; if (!opts?.length) return ''
  const names = [...new Set(opts.map((o) => o.to))], lv = opts[0].level
  const when = m.evoWait && m.evoWait > lv ? `Lv ${m.evoWait} (it was stopped)` : `Lv ${lv}${opts[0].standIn ? ' (stand-in)' : ''}`
  return `${names.length > 1 ? names.join(', ') : names[0]} at ${when}`
}
/** Becomes the new form: same level, IVs, nature, moves; new species, types and stats; the HP it was missing stays missing. */
function evolveInto(m, to) {
  const sp = speciesByName(to), missing = m.stats.hp - m.hp
  Object.assign(m, { id: sp.id, name: sp.name, types: sp.types, base: sp.base, capture: sp.capture })
  delete m.evo; delete m.evoPick; delete m.evoWait; delete m.evoForce
  m.stats = statsAt(m, m.level); m.hp = Math.max(1, m.stats.hp - missing)
}
/* The music: a shimmering loop while it changes, then a short fanfare. */
SONGS.evolution = { file: null, loop: true, bpm: 132, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'glock', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  sections: [{
    chords: 'C Am F G C Am F G'.split(' '),
    lead: bars('C5 E5 G5 C6 G5 E5 C5 E5', 'A4 C5 E5 A5 E5 C5 A4 C5', 'F4 A4 C5 F5 C5 A4 F4 A4', 'G4 B4 D5 G5 D5 B4 G4 B4',
      'E5 G5 C6 E6 C6 G5 E5 G5', 'C5 E5 A5 C6 A5 E5 C5 E5', 'A4 C5 F5 A5 F5 C5 A4 C5', 'B4 D5 G5 B5 D6 B5 G5 D5'),
    bass: bars('C2 . . . . . . .', 'A1 . . . . . . .', 'F1 . . . . . . .', 'G1 . . . . . . .', 'C2 . . . . . . .', 'A1 . . . . . . .', 'F1 . . . . . . .', 'G1 . . . G1 . . .'),
    drums: '........'.repeat(6) + 'K...K...' + 'K.K.SSSS' }] }
SONGS.evolved = { file: null, loop: false, bpm: 140, div: 2, chordLen: 8, vol: 0.9,
  leadInst: 'brass', harmInst: 'brass', comp: false, hats16: false, crash: true, fill: '', glock: true,
  sections: [{
    chords: 'C F G C'.split(' '),
    lead: bars('G4 . C5 . E5 . G5 .', 'A5 . . . F5 . A5 .', 'G5 . B5 . D6 . . .', 'C6 . . . . . . -'),
    bass: bars('C2 . . . G1 . . .', 'F1 . . . C2 . . .', 'G1 . . . D2 . . .', 'C2 . . . . . . -'),
    drums: 'K...S...' + 'K...S...' + 'K.S.K.SS' + 'C.......' }] }

/*
 * Evolutions that don't go by level, the way the games do them:
 *   item  — use an evolution stone (or the LINKING CORD, for trade evolutions)
 *           on it from the Bag. Seadra also needs a DRAGON SCALE in the Bag.
 *   bond  — its Bond is full at a level-up. Eevee's form then follows the time
 *           of day (Espeon by day, Umbreon at night), or Sylveon if it knows a
 *           Fairy move.
 *   move  — it levels up knowing that move (learned by level, or a Move Disc).
 * Stopped (B) on a level-up, it tries again 5 levels later; stopped with an
 * item, the item isn't used.
 */
const EVO_HOW = {
  PIKACHU: [{ to: 'RAICHU', item: 'thunderstone' }],
  MAGNETON: [{ to: 'MAGNEZONE', item: 'thunderstone' }],
  EEVEE: [{ to: 'VAPOREON', item: 'waterstone' }, { to: 'JOLTEON', item: 'thunderstone' }, { to: 'FLAREON', item: 'firestone' },
    { to: 'LEAFEON', item: 'leafstone' }, { to: 'GLACEON', item: 'icestone' },
    { to: 'SYLVEON', bond: true, fairy: true }, { to: 'ESPEON', bond: true, time: 'day' }, { to: 'UMBREON', bond: true, time: 'night' }],
  PICHU: [{ to: 'PIKACHU', bond: true }],
  RIOLU: [{ to: 'LUCARIO', bond: true }],
  AIPOM: [{ to: 'AMBIPOM', move: 'DOUBLE HIT' }],
  LICKITUNG: [{ to: 'LICKILICKY', move: 'ROLLOUT' }],
  PILOSWINE: [{ to: 'MAMOSWINE', move: 'ANCIENT POWER' }],
  HAUNTER: [{ to: 'GENGAR', item: 'linkcable' }],
  SEADRA: [{ to: 'KINGDRA', item: 'linkcable', needs: 'dragonscale' }],
}
const cap1 = (s) => s[0] + s.slice(1).toLowerCase()
const EVO_ITEM_NAME = { thunderstone: 'THUNDER STONE', waterstone: 'WATER STONE', firestone: 'FIRE STONE', leafstone: 'LEAF STONE', icestone: 'ICE STONE', linkcable: 'LINKING CORD', dragonscale: 'DRAGON SCALE' }
/** "with a THUNDER STONE", "at full Bond, by day", "levelling up knowing ROLLOUT". */
const howText = (r) => (r.item ? `with a ${EVO_ITEM_NAME[r.item]}${r.needs ? ` (and a ${EVO_ITEM_NAME[r.needs]})` : ''}`
  : r.bond ? `at full Bond${r.fairy ? ', knowing a Fairy move' : r.time === 'day' ? ', by day' : r.time === 'night' ? ', at night' : ''}`
  : `levelling up knowing ${r.move}`)

/* Bond: 0-100, per Pokémon. It grows from battles it fights in (+10), sitting
   out with the EXP. SHARE (+4), and PERFECT strikes and parries (+2 each); a
   faint costs 10. */
const BOND_FULL = 100
const addBond = (m, n) => { if (m) m.bond = Math.max(0, Math.min(BOND_FULL, (m.bond ?? 0) + n)) }
const knowsFairy = (m) => learn(m).learned.some((n) => (SUPPORT[n] ?? MOVEDEX[n])?.type === 'fairy')
function bondReady(m, r) {
  if ((m.bond ?? 0) < BOND_FULL) return false
  if (r.fairy) return knowsFairy(m)
  const t = typeof timeOfDay === 'function' ? timeOfDay() : 'day'
  return !r.time || (r.time === 'night' ? t === 'night' : t !== 'night')
}
/** Does any of its evolutions go by Bond? (for the stat page's heart) */
const bondEvolves = (m) => !!EVO_HOW[m.name]?.some((r) => r.bond)
/** The rule an item would use on `m`, or a reason it won't work. */
function evoByItem(m, key, bag) {
  const r = EVO_HOW[m.name]?.find((x) => x.item === key)
  if (!r) return { why: `${m.name} won't react to it` }
  if (m.hp <= 0) return { why: `${m.name} has fainted` }
  if (r.needs && !bag[r.needs]) return { why: `needs a ${EVO_ITEM_NAME[r.needs]} too` }
  return { rule: r }
}

/* The moves those evolutions need, as moves. Aipom's multi-hit move is Fury
   Swipes until Double Hit at 32 (when it evolves, a level later), Lickitung
   learns Rollout at 33, Piloswine Ancient Power at 40; Move Discs teach them
   sooner. Eevee needs a disc for a Fairy move (Fairy Wind). */
Object.assign(MOVEDEX, {
  ROLLOUT:         { type: 'rock', power: 30, cat: 'phys', cost: 3, hits: 3, fx: 'dash', snd: 'thud' },
  'ANCIENT POWER': { type: 'rock', power: 60, cat: 'spec', cost: 2, fx: 'rock', snd: 'thud' },
})
MULTI_BY_SPECIES.AIPOM = 'FURY SWIPES'
const EVO_MOVES = { AIPOM: [32, 'DOUBLE HIT'], LICKITUNG: [33, 'ROLLOUT'], PILOSWINE: [40, 'ANCIENT POWER'] }
{
  const base = levelMoves
  levelMoves = (m) => { const l = base(m), e = EVO_MOVES[m.name]; return e && !l.some(([, n]) => n === e[1]) ? [...l, e].sort((a, b) => a[0] - b[0]) : l }
}
Object.assign(DISC_RULES, {
  'DOUBLE HIT':    { types: ['normal', 'fighting'] },
  ROLLOUT:         { types: ['rock', 'ground', 'normal', 'ice'] },
  'ANCIENT POWER': { types: ['rock', 'ground', 'ice'] },
  'FAIRY WIND':    { types: ['fairy', 'flying'], species: ['EEVEE'] },
})
DISC_POOL.push('DOUBLE HIT', 'ROLLOUT', 'ANCIENT POWER', 'FAIRY WIND')

const TRAINER_MOVES = {
  GHOLDENGO: [
    { name: 'MAKE IT RAIN', type: 'steel', power: 20, cat: 'spec', hits: 3, kind: 'strike', ranged: true, fx: 'coins', snd: 'coin' },
    L_('LOW KICK', 'fighting', 40, 'phys', 'sweep', 'thud'),
    { name: 'SHADOW BALL', type: 'ghost', power: 40, cat: 'spec', hits: 1, kind: 'strike', ranged: true, fx: 'orb', snd: 'shadow' },
  ],
  // Paul's ground-type wall: two of its three moves have to be jumped.
  HIPPOWDON: [
    L_('BULLDOZE', 'ground', 40, 'phys', 'quake', 'quake'),
    S_('CRUNCH', 'dark', 45, 'phys', 'crunch'),
    L_('SAND TOMB', 'ground', 35, 'phys', 'wave', 'thud'),
  ],
  // The rest of the scalpers' pools.
  PERSIAN: [S_('PAY DAY', 'normal', 40, 'phys', 'coin', { ranged: true, fx: 'coins' }), S_('SLASH', 'normal', 50, 'phys', 'whoosh'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
  SABLEYE: [L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('POWER GEM', 'rock', 50, 'spec', 'shadow', { ranged: true }), S_('FURY SWIPES', 'normal', 18, 'phys', 'whoosh', { hits: 3 })],
  MAWILE: [S_('IRON HEAD', 'steel', 50, 'phys', 'crunch'), S_('PLAY ROUGH', 'fairy', 50, 'phys', 'thud'), S_('CRUNCH', 'dark', 45, 'phys', 'crunch')],
  GREEDENT: [S_('BULLET SEED', 'grass', 20, 'phys', 'whoosh', { hits: 3, ranged: true }), S_('BODY SLAM', 'normal', 50, 'phys', 'thud'), L_('STOMPING TANTRUM', 'ground', 45, 'phys', 'quake', 'quake')],
  SNORLAX: [S_('BODY SLAM', 'normal', 55, 'phys', 'thud'), L_('HIGH HORSEPOWER', 'ground', 50, 'phys', 'quake', 'quake'), S_('CRUNCH', 'dark', 45, 'phys', 'crunch')],
  GARBODOR: [L_('SLUDGE WAVE', 'poison', 45, 'spec', 'wave', 'whoosh'), S_('BODY SLAM', 'normal', 50, 'phys', 'thud'), S_('ACID SPRAY', 'poison', 35, 'spec', 'whoosh', { ranged: true })],
  // Brian's: whatever was cheapest.
  MAGIKARP,
  BIDOOF: [S_('TACKLE', 'normal', 40, 'phys', 'thud'), L_('ROLLOUT', 'rock', 25, 'phys', 'roll', 'thud', { hits: 2 }), S_('HEADBUTT', 'normal', 45, 'phys', 'thud')],
  SUNKERN: [S_('ABSORB', 'grass', 30, 'spec', 'whoosh', { ranged: true }), S_('RAZOR LEAF', 'grass', 40, 'phys', 'whoosh', { ranged: true })],
  PSYDUCK: [S_('WATER GUN', 'water', 40, 'spec', 'whoosh', { ranged: true }), S_('SCRATCH', 'normal', 40, 'phys', 'whoosh'), S_('CONFUSION', 'psychic', 40, 'spec', 'shadow', { ranged: true })],
}

/*
 * Each scalper draws from a pool rather than bringing one set Pokémon. `min`
 * is the trainer level a Pokémon starts turning up at. Every trainer brings
 * two or three (their deck): see deckFor().
 */
const POOLS = {
  HERB: [{ name: 'GHOLDENGO', min: 1 }, { name: 'PERSIAN', min: 1 }, { name: 'SABLEYE', min: 8 }, { name: 'MAWILE', min: 12 }],
  PAUL: [{ name: 'HIPPOWDON', min: 1 }, { name: 'GREEDENT', min: 1 }, { name: 'SNORLAX', min: 10 }, { name: 'GARBODOR', min: 14 }],
  BRIAN: [{ name: 'MAGIKARP', min: 1 }, { name: 'BIDOOF', min: 1 }, { name: 'SUNKERN', min: 1 }, { name: 'PSYDUCK', min: 5 }],
}
/*
 * The scalpers. `down` and `faceDown` are their pose and portrait after
 * losing. Each line set is a list of variations, one picked per battle:
 * `intro` before, `outro` when they lose, `gloat` when they win.
 */
const HERB = {
  short: 'HERB', full: 'TEAM UNEMPLOYED HERB', vs: 'herbVs', face: 'herbFace', body: 'herbBody', down: 'herbDown', faceDown: 'herbFaceDown', tokens: '0.75', mon: 'GHOLDENGO',
  intro: [
    ["Ayy, machine's closed, chief.", "Been refreshing since 6 AM. This restock's mine."],
    ['You here for the packs? Cute.', "I got a bot, two phones and a cousin in the back. You got... that?"],
    ["Don't even look at the Charizard slot.", "I already sold it. Online. Twenty minutes ago."],
    ['Retail is for people with patience.', 'I have a resale margin.'],
    ["Funny seeing you again.", "Same spot, same restock. Different outcome this time."],
  ],
  outro: [
    ['...Aight. You got hands.', "Machine's yours. I'll catch the next one."],
    ['Nah, that was lag.', "...Fine. It wasn't lag."],
    ['Whatever. My bot gets the next drop anyway.', "Probably. Hopefully."],
    ["You know what? Keep 'em.", "Market's soft on this set anyway."],
    ['Tell nobody about this.', "Especially not Paul."],
  ],
  gloat: [
    ['Told you. Restock was always mine.', 'Try being faster next time.'],
    ["Don't feel bad. Everybody loses to me eventually.", 'Mostly at checkout.'],
    ["That's the cost of retail, chief.", 'Go heal up and come back crying.'],
    ["I'll save you a pack.", "Triple MSRP, though."],
  ],
}
const PAUL = {
  short: 'PAUL', full: 'TEAM UNEMPLOYED PAUL', vs: 'paulVs', face: 'paulFace', body: 'paulBody', down: 'paulDown', faceDown: 'paulFaceDown', tokens: '1.00', mon: 'HIPPOWDON',
  intro: [
    ['Purchase limit? Never heard of her.', 'Forty booster boxes in the basement. Room for forty more.'],
    ["I'm just browsing.", "...Browsing the whole machine. Every slot."],
    ['My mom says I can have one more shelf.', "This restock is that shelf."],
    ['Back of the line, buddy.', "The line is me. I'm the line."],
    ['Oh. You again.', "Fine. Quick battle. I've got boxes to sort."],
  ],
  outro: [
    ['Oof. Okay. Fine.', "Basement's getting kinda full anyway."],
    ["That's... that's fair.", "I'll just go reorganise my binders."],
    ['Mom is gonna ask why I came home empty-handed.', 'I am not telling her about this.'],
    ["You can have it. I'm on a budget now.", "...Since about four seconds ago."],
    ["Good battle. Real good.", "Don't tell Herb I said that."],
  ],
  gloat: [
    ['Heh. Sorry, buddy.', 'This restock goes in the basement.'],
    ["Don't worry about it.", "I'll list one for you. Small markup. Tiny."],
    ['Shelf space secured.', 'Better luck next drop.'],
    ['You should get a bigger team.', 'Or a bigger basement.'],
  ],
}
/* When they show up together: a line each, Herb then Paul. */
const TAG_BANTER = [
  ['Paul. PAUL. We got company.', "Two of us, two of them. Fair's fair."],
  ['Me and my associate here split everything.', 'Fifty-fifty. Well. Sixty-forty. Him.'],
  ["You take the left slot, I'll take the right.", 'We are talking about the battle, right? Not the machine?'],
  ['Tag team. Nobody beats the tag team.', "We've lost before though. Twice. This week."],
]
/* The same, when one of them faces you alone with two out at once. */
const SOLO_DOUBLE = {
  HERB: [['Two at once. Keeps it moving.', "I've got a drop at noon."], ['Double battle, double the margin.', "That's how math works, chief."]],
  PAUL: [['I brought two. I always bring two.', 'Backups. Of everything.'], ['Double battle. Like double-sleeving.', 'Safe. Thorough. Mine.']],
  BRIAN: [['Two at once? Is that allowed?', 'Okay. Go, uh... both of you.'], ['My kid said to bring two.', "I think. I wasn't really listening."]],
}
/*
 * Brian doesn't know the first thing about Pokémon. He's here for the resale
 * money and claims it's all "for his kid". He's the easy one, though his
 * Pokémon are as strong as anyone's: `easy` has them pick targets at random
 * in a 2v2, and `blunder` is the chance he wastes a turn entirely. `calls` is what he
 * thinks his Pokémon are called.
 */
const BRIAN = {
  short: 'BRIAN', full: 'RESELLER BRIAN', title: 'RESELLER · "FOR MY KID"', vs: 'brianVs', face: 'brianFace', body: 'brianBody', down: 'brianDown', faceDown: 'brianFaceDown',
  tokens: '0.50', mon: 'MAGIKARP', easy: true, blunder: 0.4,
  calls: { MAGIKARP: 'the fish one', BIDOOF: 'the beaver', SUNKERN: 'the seed guy', PSYDUCK: 'the duck' },
  intro: [
    ['Whoa, whoa. Back of the line, pal.', "These are for my kid. My son. Or daughter. My child."],
    ['You into these pokey-men too?', "My kid loves 'em. The shiny ones are worth more, right?"],
    ["Look, I'm just a dad.", 'A dad who heard these go for four hundred bucks online.'],
    ['Is this the line for the Pikachus?', 'My kid needs, uh... all of them. Every Pikachu.'],
    ['Hey, quick question.', 'Which one of these is the Charizard? Asking for my child.'],
  ],
  outro: [
    ["Huh. Didn't know they could do that.", "Kid's gonna be... fine. Probably."],
    ['Okay, okay. You know your pokey-mans.', "I'll tell my kid you said hi. Theoretically."],
    ["That's fine. I'll just buy 'em online.", 'At a markup. From Herb, probably.'],
    ['My kid is going to be so disappointed.', "...I don't actually have a kid."],
    ["Wait, you don't get money for winning?", 'What are we even doing here, then.'],
  ],
  gloat: [
    ["Ha! Beginner's luck. My kid's luck. Whoever's.", 'Anyway, these are mine now.'],
    ['I have no idea what just happened.', "But I'll take it."],
    ["See? It's easy. You just yell at them.", "Restock's mine. For the child."],
    ['Wow. You lost to me?', 'I thought the fish one was broken.'],
  ],
  blunders: [
    ['BRIAN told {mon} to "do the Pikachu thing."', "{mon} didn't know what that meant."],
    ['BRIAN is checking resale prices', 'on his phone...'],
    ['BRIAN shouted "Use Charizard!"', "There's no Charizard. {mon} just stood there."],
    ['BRIAN is reading the back of a booster pack', 'for instructions...'],
    ['{mon} is waiting for orders.', 'BRIAN is on a call. "Yeah, two hundred, firm."'],
    ['BRIAN told {mon} to "go evolve."', 'It did not.'],
  ],
}
/*
 * Everyday trainers who turn up at the machine too: not scalpers, just
 * people who also want the restock. They battle like the scalpers (same
 * fields: pose and portrait after losing, a pool by trainer level, line
 * sets picked per battle), with `role` under their name when they talk
 * and `title` on their VS card. Names are placeholders for now.
 */
const ROSE = {
  short: 'ROSE', full: 'GRANDMA ROSE', role: 'GRANDMA', title: 'GRANDMA · ON A VIDEO CALL', vs: 'roseVs', face: 'roseFace', body: 'roseBody', down: 'roseDown', faceDown: 'roseFaceDown', tokens: '0.50', mon: 'SKITTY',
  intro: [
    ['Say hi to the nice trainer, sweetie!', "My grandson's on the phone. He says you're standing in front of the Charizards."],
    ['Oh, are you in line, dear?', "I've been here since the store opened. I brought a folding chair."],
    ['My grandkids sent me a list.', "Booster boxes, tins, and something called a 'chase card'."],
    ['You remind me of my grandson.', 'He also stands too close to the machine.'],
  ],
  outro: [
    ["Oh my. You're very good at this.", "I'll tell the grandkids you said hello."],
    ["Well, that's alright, dear.", "There's always the next restock. I'm retired. I have time."],
    ["Hang on, he's asking what happened.", '...Nana lost, sweetie. To a very polite young trainer.'],
    ['Take a butterscotch for the road.', "And keep those Pokémon warm. It's chilly out."],
  ],
  gloat: [
    ['Bless your heart.', 'Maybe have a snack and try again later.'],
    ['Did you see that, sweetie? Nana won!', "...He says I'm 'goated.' Is that good?"],
    ['I raised four kids.', 'I can handle one battle at a vending machine.'],
  ],
}
const DEREK = {
  short: 'DEREK', full: 'OFFICE WORKER DEREK', role: 'OFFICE WORKER', title: 'OFFICE WORKER · ON LUNCH BREAK', vs: 'derekVs', face: 'derekFace', body: 'derekBody', down: 'derekDown', faceDown: 'derekFaceDown', tokens: '0.75', mon: 'PATRAT',
  intro: [
    ['I have twenty-six minutes left on my lunch break.', 'This is going to be quick.'],
    ["Sorry, I'm on a call. On mute. Mostly.", "Can we battle without my manager hearing?"],
    ['My restock alert went off in the middle of a meeting.', 'I told them it was a family emergency.'],
    ["I've had four meetings today that could've been emails.", 'Just let me have this one thing.'],
  ],
  outro: [
    ['...Great. Perfect. Love that.', 'Back to my desk, I guess.'],
    ["I'm going to be late back from lunch.", 'For nothing. Late for nothing.'],
    ["Just got pinged. 'Quick sync?'", 'Nothing is ever a quick sync.'],
    ["That's fine. I'll circle back.", "...I've been saying that too much."],
  ],
  gloat: [
    ['Yes! Finally, a win this week.', 'Putting this in my performance review.'],
    ['Per my last attack...', 'You should have dodged.'],
    ["Great battle. Let's take this offline.", "Actually, no. The restock's mine. Bye."],
  ],
}
const NATE = {
  short: 'NATE', full: 'CAMPER NATE', role: 'CAMPER', title: 'CAMPER · HERE SINCE 3 AM', vs: 'nateVs', face: 'nateFace', body: 'nateBody', down: 'nateDown', faceDown: 'nateFaceDown', tokens: '0.75', mon: 'SLAKOTH',
  intro: [
    ["*yawn* ...Oh. Someone's here.", "I've been camping this machine since 3 AM. In my pajamas."],
    ["Don't talk to me. I haven't slept.", 'But I WILL battle you.'],
    ["You don't get to just walk up.", 'I slept on the floor for this. It was very cold.'],
    ['Is it morning?', "Doesn't matter. It's restock o'clock."],
  ],
  outro: [
    ["...I'm going back to bed.", 'Wake me up for the next restock.'],
    ['All night. I waited all night.', 'For this. To lose. In Crocs.'],
    ['Fine. You win.', "I'm too tired to be mad. I'll be mad later."],
    ['Note to self:', 'next time, bring coffee. And a better team.'],
  ],
  gloat: [
    ["Ha. Didn't even fully wake up for that.", 'Camping pays off.'],
    ['The early bird gets the packs.', 'And the early bird is me. In pajamas.'],
    ["Good battle. Now if you'll excuse me,", "I'm going to buy everything and then sleep for a week."],
  ],
}
const HANA = {
  short: 'HANA', full: 'IDOL FAN HANA', role: 'IDOL FAN', title: 'IDOL FAN · PHOTOCARD HUNTER', vs: 'hanaVs', face: 'hanaFace', body: 'hanaBody', down: 'hanaDown', faceDown: 'hanaFaceDown', tokens: '0.75', mon: 'JIGGLYPUFF',
  intro: [
    ["I'm not here for the cards. Okay, a little.", 'My favorite idol collects them, so now I do too.'],
    ['Lightstick: charged. Tote bag: packed.', 'Do you know how many photocards I traded to afford this?'],
    ['Cards are just photocards for a different fandom.', "And I'm going to complete this set too."],
    ['Out of my way!', 'Pulling rare cards is literally my whole personality.'],
  ],
  outro: [
    ['...My lightstick is crying.', "I mean I am. I'm crying."],
    ["That's okay. I'm used to losing.", 'Concert ticket sales trained me for this.'],
    ['You were good! Like, really good.', 'Can I have your autograph? For trading purposes?'],
    ["Fine. I'll be back.", "Fans don't give up. We just stream harder."],
  ],
  gloat: [
    ['Yes!! Fan power!', 'I learned dodging in concert crowds.'],
    ["That's what happens", 'when you go up against a fan who never misses a comeback.'],
    ['Hehe. Better luck next era!', "Restock's mine."],
  ],
}
const TYLER = {
  short: 'TYLER', full: 'STREAMER TYLER', role: 'STREAMER', title: 'STREAMER · LIVE NOW', vs: 'tylerVs', face: 'tylerFace', body: 'tylerBody', down: 'tylerDown', faceDown: 'tylerFaceDown', tokens: '1.00', mon: 'PIKACHU',
  intro: [
    ["What's up, chat! We're live at the VVM!", 'And look, we got a challenger! Chat, say hi.'],
    ['Chat says you look nervous.', 'Chat is never wrong.'],
    ['Smash that follow button!', "Because I'm about to smash YOU."],
    ['A battle? On stream?', "Twelve viewers are watching. That's a big moment for both of us."],
  ],
  outro: [
    ["Chat, clip that... no, DON'T clip that.", 'Ending stream. Technical difficulties.'],
    ['We lost viewers. During the battle.', 'Down to three. One of them is my mom.'],
    ['Okay, okay. GG.', "Chat says you're cracked. Chat's right."],
    ['This is the worst stream ever.', "Which means it'll probably do numbers."],
  ],
  gloat: [
    ["LET'S GOOO! Chat, spam it!", 'Pack opening stream starts now!'],
    ['GG EZ. ...Is that mean?', "Chat says it's mean. Sorry. GG."],
    ["That's going in the highlight reel.", "Don't worry, I'll blur your face."],
  ],
}
const DANA = {
  short: 'DANA', full: 'CLERK DANA', role: 'STORE CLERK', title: 'STORE CLERK · ON SHIFT', vs: 'danaVs', face: 'danaFace', body: 'danaBody', down: 'danaDown', faceDown: 'danaFaceDown', tokens: '0.75', mon: 'SKWOVET',
  intro: [
    ['I work here. I see who camps this machine.', 'And I know every restock day by heart.'],
    ['Hi! Welcome in! Can I help you find anything?', '...Besides the packs. Those are mine. Employee perks.'],
    ["I'm technically on break.", "I'm spending it beating you."],
    ['Price check on aisle you!', "Ha. Retail humor. Let's battle."],
  ],
  outro: [
    ["Okay, that's fair.", 'Back to stocking shelves.'],
    ["My manager's going to ask where I've been.", "I'll say 'inventory.' Kind of true."],
    ["You're good. Like, scary good.", "Please don't camp here tomorrow."],
    ["Customer's always right, I guess.", 'Have a great day! Come back soon! ...Not too soon.'],
  ],
  gloat: [
    ['Thank you for shopping with us!', 'Your receipt says: you lost.'],
    ['Sorry! Employees know the restock schedule.', 'Home field advantage.'],
    ['Cleanup on aisle you!', "...I've been waiting all week to say that."],
  ],
}
const MARCUS = {
  short: 'MARCUS', full: 'GUARD MARCUS', role: 'SECURITY', title: 'SECURITY · ONE AT A TIME', vs: 'marcusVs', face: 'marcusFace', body: 'marcusBody', down: 'marcusDown', faceDown: 'marcusFaceDown', tokens: '1.00', mon: 'GROWLITHE',
  intro: [
    ['Step back from the machine.', 'One trainer at a time. Store policy.'],
    ["I've seen grown adults fight over this thing.", "Let's keep it civil. A Pokémon battle. Civil."],
    ["Copy that. I've got eyes on a challenger.", 'Requesting backup: my Pokémon.'],
    ['No loitering.', "...Unless it's me. I'm on duty."],
  ],
  outro: [
    ['Respect.', "Machine's yours. Purchase limit still applies."],
    ['Radio, this is Marcus.', "I lost. Don't put it in the report."],
    ['Clean battle.', 'No complaints from me. Move along, champ.'],
    ['Alright, you win.', "Don't tell the store manager."],
  ],
  gloat: [
    ['Situation contained.', 'Machine stays closed for now.'],
    ['Nothing personal.', 'Just doing my job. And my job is winning, apparently.'],
    ['Back of the line, champ.', 'And no cutting.'],
  ],
}
const GRANT = {
  short: 'GRANT', full: 'PROFESSOR GRANT', role: 'PROFESSOR', title: 'PROFESSOR · "FOR RESEARCH"', vs: 'grantVs', face: 'grantFace', body: 'grantBody', down: 'grantDown', faceDown: 'grantFaceDown', tokens: '1.00', mon: 'SLOWPOKE',
  intro: [
    ['Ah. A field sample.', "I'm studying the secondary market for collectible cards."],
    ['This is purely academic, you understand.', 'I need a sealed booster box for... my research.'],
    ["I'm writing a paper on scarcity economics.", "You're about to become a case study."],
    ['My grad students think I am holding office hours.', 'I am not holding office hours.'],
  ],
  outro: [
    ['Fascinating. A most unexpected result.', "I'll need to revise my hypothesis."],
    ["That's fine.", 'Peer review is always brutal.'],
    ['You clearly did the reading.', "I'll grade that an A."],
    ['The sample size was too small.', "That's what I'll write in my notes, anyway."],
  ],
  gloat: [
    ['As my research predicted.', 'Hypothesis confirmed.'],
    ['Class dismissed.', 'Read chapters four through nine before next time.'],
    ['Thank you for participating.', 'Your contribution will be cited. Probably.'],
  ],
}
const KYLE = {
  short: 'KYLE', full: 'KEYBOARD KYLE', role: 'POSTER', title: 'POSTER · TERMINALLY ONLINE', vs: 'kyleVs', face: 'kyleFace', body: 'kyleBody', down: 'kyleDown', faceDown: 'kyleFaceDown', tokens: '0.50', mon: 'PURRLOIN',
  intro: [
    ['Imagine buying packs at retail.', "Couldn't be me. Actually, it's me. I'm here."],
    ["Hold on, I'm posting about you.", "'Just saw the cringiest trainer at the VVM.'"],
    ["L + ratio + you're battling me.", "I already wrote the post where I win."],
    ['Do you even know the meta?', 'I read every forum thread. Every single one.'],
  ],
  outro: [
    ["Whatever. That doesn't count.", "I wasn't even trying. I was typing."],
    ['Deleting this post.', 'Deleting all my posts.'],
    ['Okay, that was lag.', "Real-life lag. It's a thing. Look it up."],
    ['Touching grass now.', 'This grass is mid.'],
  ],
  gloat: [
    ["Ratio'd.", 'Posting the screenshot right now.'],
    ['Get good.', "Or don't. More packs for me."],
    ["That's going on my timeline.", "With a caption. You'll hate it."],
  ],
}
const MIKA = {
  short: 'MIKA', full: 'COLLECTOR MIKA', role: 'COLLECTOR', title: 'COLLECTOR · MERCH HAUL', vs: 'mikaVs', face: 'mikaFace', body: 'mikaBody', down: 'mikaDown', faceDown: 'mikaFaceDown', tokens: '0.75', mon: 'DITTO',
  intro: [
    ['Do you know how much merch is in this bag?', 'Neither do I. I stopped counting.'],
    ['I already have every other card in this set.', 'The last one is in that machine. I can feel it.'],
    ['My shelf has room for exactly one more thing.', "That thing is today's restock."],
    ['You have the look of a fellow collector.', 'Too bad. Only one of us gets the full set.'],
  ],
  outro: [
    ['Noooo. My merch!', "...Okay, I'm picking it all up. Don't look."],
    ['This is fine.', "I'll just trade for it online. Again."],
    ['You beat me. Fair and square.', 'Want to trade duplicates sometime?'],
    ['My collection is crying.', 'Everything goes back in the bag. Somehow.'],
  ],
  gloat: [
    ['Another one for the shelf!', 'Collection status: one step closer.'],
    ["Gotta collect 'em all!", 'And by all, I mean this whole restock.'],
    ["Hehe. Don't worry.", "I'll post the haul so you can look at it."],
  ],
}
const CREW = [ROSE, DEREK, NATE, HANA, TYLER, DANA, MARCUS, GRANT, KYLE, MIKA]
/* Their Pokémon, by the trainer level each starts turning up at (as POOLS above). */
Object.assign(POOLS, {
  ROSE: [{ name: 'SKITTY', min: 1 }, { name: 'CHANSEY', min: 1 }, { name: 'MILTANK', min: 8 }, { name: 'BLISSEY', min: 14 }],
  DEREK: [{ name: 'PATRAT', min: 1 }, { name: 'MAGNEMITE', min: 1 }, { name: 'WATCHOG', min: 8 }, { name: 'PORYGON', min: 12 }],
  NATE: [{ name: 'SLAKOTH', min: 1 }, { name: 'HOOTHOOT', min: 1 }, { name: 'DROWZEE', min: 6 }, { name: 'SNORLAX', min: 12 }],
  HANA: [{ name: 'JIGGLYPUFF', min: 1 }, { name: 'PLUSLE', min: 1 }, { name: 'MINUN', min: 1 }, { name: 'CLEFAIRY', min: 8 }],
  TYLER: [{ name: 'PIKACHU', min: 1 }, { name: 'CHATOT', min: 1 }, { name: 'ROTOM', min: 8 }],
  DANA: [{ name: 'SKWOVET', min: 1 }, { name: 'SUNKERN', min: 1 }, { name: 'TROPIUS', min: 8 }, { name: 'GREEDENT', min: 12 }],
  MARCUS: [{ name: 'GROWLITHE', min: 1 }, { name: 'MACHOKE', min: 1 }, { name: 'HITMONCHAN', min: 8 }, { name: 'ARCANINE', min: 14 }],
  GRANT: [{ name: 'SLOWPOKE', min: 1 }, { name: 'NATU', min: 1 }, { name: 'PORYGON', min: 8 }, { name: 'KADABRA', min: 12 }],
  KYLE: [{ name: 'PURRLOIN', min: 1 }, { name: 'CROAGUNK', min: 1 }, { name: 'GARBODOR', min: 8 }, { name: 'LIEPARD', min: 14 }],
  MIKA: [{ name: 'DITTO', min: 1 }, { name: 'SMEARGLE', min: 1 }, { name: 'MIMIKYU', min: 10 }],
})
/* What each says sending out two at once (as SOLO_DOUBLE above). */
Object.assign(SOLO_DOUBLE, {
  ROSE: [["Two at once? The grandkids call that a 'double battle.'", "Nana's going to try it."], ['I brought two. One for each grandkid.', 'Otherwise they argue.']],
  DEREK: [['Two at once. Multitasking.', "It's on my résumé."], ['A double battle. Like double-booked meetings.', "I'm used to it."]],
  NATE: [['Two at once. Less time awake.', "Let's get this over with."], ['I brought both.', 'One to battle, one to hold my spot.']],
  HANA: [['Two at once! Like a duet!', 'Ready? Cheer with me.'], ['My two favorites, together.', "It's a reunion stage."]],
  TYLER: [['Two at once! Double the content!', 'Chat, this is a collab.'], ['Double battle, double the views.', "That's just analytics."]],
  DANA: [['Two at once. Two registers open.', 'Faster checkout.'], ["I'm used to doing two things at once.", 'Watch this.']],
  MARCUS: [['Two units on scene.', "Let's do this by the book."], ['I always bring a partner on patrol.', 'Standard procedure.']],
  GRANT: [['A controlled experiment.', 'Two variables at once.'], ['Two at once. Twice the data.', 'Excellent.']],
  KYLE: [['Two at once. Alt accounts.', "Don't report me."], ['A double battle?', 'Double ratio.']],
  MIKA: [['Two at once! A matching set!', 'Collectors always buy two.'], ['One to battle,', 'and one to keep mint in the box.']],
})
/* What each says teaming up with someone in a 2v2 (Herb and Paul have their own double act: TAG_BANTER). */
const TEAM_UP = {
  HERB: ["Fine, we team up. But I get first pick, chief.", "New partner? Cool. Don't slow me down."],
  PAUL: ['Tag team! I brought backups.', 'We split it evenly. Mostly. I get the boxes.'],
  BRIAN: ["We're a team now? Great. You do the Pokémon part.", 'My kid would love this. Hypothetically.'],
  ROSE: ['Oh, a team! Like bingo night, but louder.', "Stand behind Nana, dear. I've got this."],
  DEREK: ["Fine. Let's circle up and align on this.", 'Teamwork makes the dream work. I hate that I said that.'],
  NATE: ["You take the left side. I'm too tired to argue.", 'Two of us? Great. Less work for me.'],
  HANA: ["A duo! Let's do a fan chant!", "We're a unit now. Matching lightsticks next time."],
  TYLER: ['Collab! Chat, meet my new co-host.', 'Two-person stream. Double the content.'],
  DANA: ['Team effort! Like a holiday shift.', "I'll cover this register. You cover that one."],
  MARCUS: ['Requesting backup. Backup has arrived.', 'Two-person patrol. By the book.'],
  GRANT: ["A collaboration. I'll be first author.", "Let's call this a joint study."],
  KYLE: ["Duo queue. Don't throw.", 'My alt account showed up. Let\'s go.'],
  MIKA: ['A matching set! We even look like a combo.', "Two collectors, one machine. Let's clear it."],
}
/* Everyone who can block the machine. In Play, who turns up is random. */
/*
 * The roaming legendaries: Raikou, Entei and Suicune. One of each roams at a
 * time, shared by every trainer: whoever meets one fights the same Pokémon,
 * with whatever HP the last trainer left it on. They attack once, then flee
 * on their second turn. Catch rate 3, so it takes a worn-down one, a good
 * ball and an Excellent throw. Knocked out or caught, a fresh one (full HP,
 * new IVs and nature) starts roaming in its place.
 */
const LEGEND_LEVEL = 40
const LEGEND_RATE = 0.04   // the share of wild encounters that turn out to be a roaming legendary
const LEGENDS = ['RAIKOU', 'ENTEI', 'SUICUNE']
const LEGEND_MOVES = {
  RAIKOU: [S_('THUNDERBOLT', 'electric', 75, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 60, 'spec', 'current', 'zap'), S_('EXTRASENSORY', 'psychic', 65, 'spec', 'shadow', { ranged: true })],
  ENTEI: [S_('FLAMETHROWER', 'fire', 75, 'spec', 'whoosh', { ranged: true }), S_('FIRE FANG', 'fire', 65, 'phys', 'crunch'), L_('LAVA PLUME', 'fire', 65, 'spec', 'wave', 'whoosh')],
  SUICUNE: [L_('SURF', 'water', 70, 'spec', 'wave', 'whoosh'), S_('AURORA BEAM', 'ice', 60, 'spec', 'whoosh', { ranged: true }), S_('EXTRASENSORY', 'psychic', 65, 'spec', 'shadow', { ranged: true })],
}
// Herb and Paul pick their hardest-hitting move, like a leader (no tells, though).
HERB.smart = PAUL.smart = true
const SCALPERS = [HERB, PAUL, BRIAN, ...CREW]
/*
 * Alex: the trainer who steps in the first time you meet the scalpers. He
 * has you pick a starter, then fights beside you with his Porygon, which he
 * commands himself, and coaches you through each mechanic the first time it
 * comes up (TUTORIAL_TIPS).
 */
const ALEX = {
  short: 'ALEX', full: 'TRAINER ALEX', role: 'TRAINER', vs: 'alexVs', face: 'alexFace', body: 'alexBody', ally: true, mon: 'PORYGON',
  moves: ['TRI ATTACK', 'PSYBEAM', 'THUNDER SHOCK', 'RECOVER'],
  hello: ["Hold up! Don't let these two push you around.", "No Pokémon? No problem. Pick a partner, and we'll take them on together."],
  picked: (name) => [`${name}! Good pick.`, "I'll send out Porygon. You call the shots for yours, I'll handle mine."],
  gift: ['Here, take these: five Potions and five Poké Balls.', "Potions patch your team up. Balls are for the wild ones that jump out around the machine."],
  again: ['Ready for round two?', "Same plan: you take yours, I'll take Porygon."],
  won: ["That's how it's done! You're a natural.", "They'll be back. They always are. Now you know how to send them packing."],
  lost: ['Ah, they got us this time.', "Heal up and we'll go again. I'm not going anywhere."],
}
/* The scalpers, the first time: they size you up before Alex steps in. */
const FIRST_TAUNT = { HERB: ['Look who it is. Got any Pokémon, kid?', "...No? Then this restock's ours."], PAUL: ["Herb, be nice. They just got here.", "...The restock's still ours, though."] }
/* What Alex says the first time each thing happens in that battle. */
const TUTORIAL_TIPS = {
  start: ["Each turn you pick for your Pokémon. I'll handle Porygon.", 'Tap FIGHT, pick a move, then pick which of them to hit.'],
  strike: ['When you attack, a ring closes on your target.', 'Tap A right as it lands. The closer you are, the harder you hit.'],
  defend: ["Incoming! When they attack, the ring's on you.", 'Tap A as it closes to PARRY, or B to DODGE. Dodging is easier.'],
  jump: ['See that amber ring on the ground?', "That one can't be parried. JUMP it with ▲!"],
  pp: ['Nice! Stop every hit of an attack and you earn PP.', 'PP pays for your stronger moves, like your type move.'],
  partner: ["Don't worry about Porygon.", "I've got my own rings to hit."],
}
/*
 * Battle supplies the machine can stock beside the packs, as an admin sets
 * them up: whether each is sold at all, its price in tokens, and its
 * appearance rate, the chance (%) it's on the shelf when the machine is
 * stocked. In the app this belongs on the admin "Machine Items" page with
 * the packs; here the Play-mode admin panel edits it, and it's saved in this
 * browser so the settings survive a reload.
 */
const SHOP_DEFAULT = {
  potion: { on: true, price: 0.25, rate: 40 },
  super:  { on: true, price: 0.5, rate: 15 },
  ball:   { on: true, price: 0.2, rate: 35 },
  great:  { on: false, price: 0.4, rate: 10 },
  revive: { on: true, price: 0.6, rate: 15 },
  summon: { on: true, price: 3, rate: 30 },   // a Gym Leader summon: always for your next gym
  elite:  { on: true, price: 5, rate: 30 },
  expshare: { on: false, price: 4, rate: 20 },
  antidote: { on: true, price: 0.15, rate: 20 },   // status cures
  parlyz:   { on: true, price: 0.2, rate: 15 },
  burnheal: { on: true, price: 0.2, rate: 15 },
  iceheal:  { on: true, price: 0.2, rate: 10 },
  fullheal: { on: true, price: 0.5, rate: 10 },
  // Evolution items (see EVO_HOW).
  thunderstone: { on: true, price: 1, rate: 10 },
  waterstone: { on: true, price: 1, rate: 8 },
  firestone: { on: true, price: 1, rate: 8 },
  leafstone: { on: true, price: 1, rate: 6 },
  icestone: { on: true, price: 1, rate: 6 },
  linkcable: { on: true, price: 1.5, rate: 8 },
  dragonscale: { on: true, price: 1, rate: 5 },   // a key item: off until switched on in the admin panel   // the Elite Four ticket: once you have all 8 Johto badges, until you're Champion
}
const SHOP = (() => {
  const base = structuredClone(SHOP_DEFAULT)
  try { const saved = JSON.parse(localStorage.getItem('vvm-shop')); if (saved) for (const k in base) Object.assign(base[k], saved[k]) } catch {}
  return base
})()
const saveShop = () => { try { localStorage.setItem('vvm-shop', JSON.stringify(SHOP)) } catch {} }
/*
 * Bundles: several supplies sold together as one thing on the shelf, at
 * their own price and appearance rate. An admin makes and edits them, with
 * any mix of BUNDLE_ITEMS; bought, they land in the Bag as the separate
 * items. Saved in this browser with the rest of the admin settings.
 */
const BUNDLE_ITEMS = ['potion', 'super', 'revive', 'ball', 'great']
const BUNDLES_DEFAULT = [
  { id: 'heal', name: 'HEALING BUNDLE', items: { potion: 3, revive: 1 }, price: 1.1, rate: 35, on: true },
  { id: 'catch', name: 'CATCH BUNDLE', items: { ball: 5, great: 1 }, price: 1.2, rate: 25, on: true },
]
const BUNDLES = (() => { try { const s = JSON.parse(localStorage.getItem('vvm-bundles')); if (Array.isArray(s)) return s } catch {} return structuredClone(BUNDLES_DEFAULT) })()
const saveBundles = () => { try { localStorage.setItem('vvm-bundles', JSON.stringify(BUNDLES)) } catch {} }
const bundleById = (id) => BUNDLES.find((b) => b.id === id)
const bundleText = (b) => BUNDLE_ITEMS.filter((k) => b.items[k] > 0).map((k) => `${b.items[k]} ${ITEMS[k].name}`).join(' + ')
/** What a bundle's contents cost bought one by one, at today's prices. */
const bundleWorth = (b) => BUNDLE_ITEMS.reduce((s, k) => s + (b.items[k] ?? 0) * SHOP[k].price, 0)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const ITEMS = {
  summon: { name: 'GYM SUMMON', sub: 'summons your next Gym Leader', cls: 't-summon' },
  elite: { name: 'ELITE FOUR TICKET', sub: 'all five League battles', cls: 't-summon' },
  expshare: { name: 'EXP. SHARE', sub: 'your whole party shares EXP', cls: 't-key', key: true },
  antidote: { name: 'ANTIDOTE', sub: 'cures poison', cls: 't-cure', cure: ['psn'] },
  parlyz:   { name: 'PARALYZE HEAL', sub: 'cures paralysis', cls: 't-cure', cure: ['par'] },
  burnheal: { name: 'BURN HEAL', sub: 'cures a burn', cls: 't-cure', cure: ['brn'] },
  iceheal:  { name: 'ICE HEAL', sub: 'thaws it out', cls: 't-cure', cure: ['frz'] },
  fullheal: { name: 'FULL HEAL', sub: 'cures any status', cls: 't-cure', cure: ['psn', 'par', 'brn', 'frz'] },
  thunderstone: { name: 'THUNDER STONE', sub: 'evolves Pikachu, Magneton, Eevee', cls: 't-evo', evo: true },
  waterstone: { name: 'WATER STONE', sub: 'evolves Eevee into Vaporeon', cls: 't-evo', evo: true },
  firestone: { name: 'FIRE STONE', sub: 'evolves Eevee into Flareon', cls: 't-evo', evo: true },
  leafstone: { name: 'LEAF STONE', sub: 'evolves Eevee into Leafeon', cls: 't-evo', evo: true },
  icestone: { name: 'ICE STONE', sub: 'evolves Eevee into Glaceon', cls: 't-evo', evo: true },
  linkcable: { name: 'LINKING CORD', sub: 'evolves Haunter and Seadra', cls: 't-evo', evo: true },
  dragonscale: { name: 'DRAGON SCALE', sub: 'Seadra needs it with a LINKING CORD', cls: 't-evo', held: true },
  ball: { name: 'POKé BALL', sub: 'catch ×1', cls: 't-ball' },
  great: { name: 'GREAT BALL', sub: 'catch ×1.5', cls: 't-great' },
  potion: { name: 'POTION', sub: 'heals 30%', cls: 't-potion', heal: 0.3 },
  super: { name: 'SUPER POTION', sub: 'heals 60%', cls: 't-heal', heal: 0.6 },
  revive: { name: 'REVIVE', sub: 'revives at 50% HP', cls: 't-revive', revive: 0.5 },
}
/* Item icons: the Scarlet/Violet Bag art, wherever an item is drawn. */
;(() => {
  const css = ['ball', 'great', 'potion', 'super', 'revive', 'expshare', 'antidote', 'parlyz', 'burnheal', 'iceheal', 'fullheal', 'thunderstone', 'waterstone', 'firestone', 'leafstone', 'icestone', 'linkcable', 'dragonscale'].map((k) => {
    const u = `url("${ART['item:' + k]}")`
    return `.supic.${k}, .ic.${k} { background: ${u} center / contain no-repeat !important; border: 0 !important; border-radius: 0 !important; transform: none !important; box-shadow: none !important; }
.supic.${k}::after, .ic.${k}::after { display: none !important; }
.btn.${ITEMS[k].cls} { padding-right: 30px; }
.btn.${ITEMS[k].cls} small { white-space: nowrap; letter-spacing: -.01em; }
.btn.${ITEMS[k].cls}::after { content: ''; position: absolute; right: 5px; top: 50%; width: 24px; height: 24px; margin-top: -12px; background: ${u} center / contain no-repeat; filter: drop-shadow(0 1px 1px rgba(0,0,0,.35)); }
.ibtn.${k} { position: relative; padding-left: 40px; }
.ibtn.${k}::before { content: ''; position: absolute; left: 8px; top: 50%; width: 26px; height: 26px; margin-top: -13px; background: ${u} center / contain no-repeat; }`
  }).join('\n')
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
})()
/** A badge's image, by its name (ZEPHYR, BOULDER...). */
const badgeArt = (name) => ART['badge:' + name.toLowerCase()]

/* ══════════════ plumbing ══════════════ */
const $ = (id) => document.getElementById(id)
const STOP = Symbol('stop')
let RUN = 0
/*
 * App mode: inside the TCG Tracker app (?app=1&u=<user id>). Play only, saves
 * per account, and the app's Settings (stored by the app on this same
 * origin) for text speed, advancing, volume and vibration.
 */
const APP = (() => {
  const q = new URLSearchParams(location.search)
  let s = {}
  try { s = JSON.parse(localStorage.getItem('tcg-settings') || '{}') } catch {}
  const on = q.has('app')
  return {
    on,
    uid: on ? (q.get('u') || '') : '',
    charMs: on ? ({ slow: 24, normal: 13, fast: 5 }[s.textSpeed] ?? 13) : 13,
    autoAdvance: on && s.advance === 'auto',
    haptics: on && s.haptics !== false,
    // The defaults (80% effects, 60% music) are the game's own mix.
    fx: (s.effectsVolume ?? 0.8) / 0.8,
    music: (s.musicVolume ?? 0.6) / 0.6,
  }
})()
/** A short vibration, in the app, if the player hasn't turned it off. */
const buzz = (p) => { if (APP.haptics) try { navigator.vibrate?.(p) } catch {} }
/** The sound engine calls this when it builds its mixer: the app's volume settings go on the two buses. */
window.__busReady = (sfx, mus) => { if (APP.on) { sfx.gain.value = 0.9 * APP.fx; mus.gain.value = 0.5 * APP.music } }
if (APP.on) document.body.classList.add('app')
let MODE = APP.on ? 'play' : { play: 'play', duo: 'duo', gym: 'gym' }[new URLSearchParams(location.search).get('mode')] ?? 'demo'
let listeners = []
function press(btn) {
  const t = performance.now()
  for (const fn of [...listeners]) fn(btn, t)
}
const listen = (fn) => { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn) } }
function hot(el) { if (!el) return; el.classList.add('hot'); setTimeout(() => el.classList.remove('hot'), 160) }
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-btn]')
  // On a phone there's no A key: while someone is talking, a tap on their box or the battle screen moves it on.
  if (!el && MODE === 'play' && $('talk').style.display === 'block' && e.target.closest('#talk, #ts')) { e.preventDefault(); press('a'); return }
  if (!el && MODE === 'play' && $('msg').classList.contains('wait') && e.target.closest('#battleL')) { e.preventDefault(); press('a'); return }
  if (!el || MODE !== 'play' || el.closest('.panel')?.style.display === 'none') return
  e.preventDefault(); hot(el); press(el.dataset.btn)
})
const KEYS = { x: 'a', X: 'a', Enter: 'a', ' ': 'a', z: 'b', Z: 'b', Backspace: 'b', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
addEventListener('keydown', (e) => {
  const k = KEYS[e.key]
  if (!k || e.repeat || MODE !== 'play' || $('sheet').classList.contains('open')) return
  e.preventDefault(); press(k)
})
const ATTRACT_PACKS = ['jungle-scyther', 'gym-heroes-brock', 'fossil-lapras', 'team-rocket-giovanni', 'gym-challenge-koga', 'jungle-flareon', 'gym-heroes-misty', 'fossil-zapdos',
  'team-rocket-dark-gyarados', 'gym-challenge-blaine', 'jungle-wigglytuff', 'gym-heroes-lt-surge', 'fossil-aerodactyl', 'team-rocket-jessie-james',
  'gym-challenge-sabrina', 'gym-heroes-erika', 'team-rocket-rocket-gang', 'gym-challenge-giovanni']
;(() => {
  const rows = [[], [], [], []]
  ATTRACT_PACKS.forEach((f, i) => rows[i % 4].push(f))
  $('attractRows').innerHTML = rows.map((files, i) => {
    // Each strip slides by half its width, so a half must be wider than the screen: repeat, then double.
    const base = Array.from({ length: Math.max(1, Math.ceil(10 / files.length)) }, () => files).flat()
    const imgs = [...base, ...base].map((f) => `<img src="${ART['pack:' + f]}" alt="">`).join('')
    return `<div class="row"><div class="strip" style="animation:${i % 2 ? 'driftR' : 'driftL'} ${21 + i * 5}s linear infinite">${imgs}</div></div>`
  }).join('')
})()
for (const [id, k] of [['maintLogo', 'logo'], ['maintQr', 'qr'], ['maintArt', 'art']]) $(id).src = ART['maint:' + k]
function fit() { $('screen').style.setProperty('--z', String($('sw').clientWidth / 320)) }
addEventListener('resize', fit)
const MODES = { mDemo: 'demo', mDuo: 'duo', mGym: 'gym', mPlay: 'play' }
function setMode(m) { MODE = m; for (const [id, v] of Object.entries(MODES)) $(id).setAttribute('aria-pressed', String(v === m)) }
$('mDemo').onclick = () => { setMode('demo'); start() }
$('mDuo').onclick = () => { setMode('duo'); start() }
$('mGym').onclick = () => { setMode('gym'); start() }
$('mPlay').onclick = () => { setMode('play'); Sound.setOn(true); syncSnd(); start() }
function syncSnd() { $('snd').textContent = Sound.on ? 'Sound: on' : 'Sound: off'; $('snd').setAttribute('aria-pressed', String(Sound.on)) }
$('snd').onclick = () => { Sound.setOn(!Sound.on); syncSnd() }
/*
 * Battle scenes: Platinum's backgrounds with their matching platforms, one
 * picked at random per encounter. Wild battles happen out in the field or in
 * caves; scalpers can turn up anywhere, arenas included. Like the game, the
 * palette follows the clock: evening 17:00–19:59, night 20:00–03:59.
 */
const WILD_SCENES = ['plain', 'meadow', 'beach', 'marsh', 'water', 'puddles', 'forest', 'mountain', 'snow', 'ice', 'cave_1', 'cave_2', 'cave_3']
const SCALPER_SCENES = [...WILD_SCENES, 'city', 'indoors_1', 'indoors_2', 'indoors_3', 'aaron', 'bertha', 'flint', 'lucian', 'cynthia', 'distortion', 'tower', 'factory', 'arcade', 'castle', 'hall']
function timeOfDay() { const h = new Date().getHours(); return h >= 17 && h < 20 ? 'evening' : h >= 20 || h < 4 ? 'night' : 'day' }
function setScene(list, roll = Math.random) { $('scene').src = ART[`bg:${list[Math.floor(roll() * list.length)]}_${timeOfDay()}`] }
setScene(['plain'])
Object.assign(SFX, {
  wipe:   { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .5, vol: .25, filter: 'bandpass', f: 300, f1: 3500, q: 1 }); tone(ac, o, t, { f: 220, f1: 880, dur: .45, vol: .08 }) } },
  restock:{ file: null, synth: (ac, o, t) => arp(ac, o, t, ['E5', 'G5', 'C6', 'E6'], .08, .1) },
  blocked:{ file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 196, dur: .14, vol: .16 }); tone(ac, o, t + .15, { f: 147, dur: .26, vol: .16 }) } },
})
function start() { RUN++; listeners = []; closeSheetNow(); run(RUN).catch((e) => { if (e !== STOP) console.error(e) }) }
let sheetCloser = null
function closeSheetNow() { $('sheet').classList.remove('open'); sheetCloser = null }
$('sheetClose').onclick = () => { if (MODE === 'play') sheetCloser?.() }
$('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet') && MODE === 'play') sheetCloser?.() })

/* ══════════════ the session ══════════════ */

/* ══════════════ the league: Johto's gyms, the Elite Four, Kanto's gyms ══════════════
   Summoned with a token bought from the machine, one challenge at a time, in
   order: Johto's eight gyms, then the Elite Four and Champion Lance back to
   back on a single summon, and once you're Champion, Kanto's eight gyms.
   Far tougher than scalpers: bigger teams, Pokémon above your level with high
   IVs, quicker attacks, sharp move choices, and a Full Restore on their last
   Pokémon. `team` lists their Pokémon, ace last.

   Levels climb steadily across all 21 leaders. `min` is the lowest level a
   leader's ace can be: Johto 13 → 41, the Elite Four 44 → 50, Lance 53, Kanto
   55 → 67, Blue 70. Out-level a leader and their ace sits 3 above your best
   instead; the rest of the team is 2 below the ace. Blue is the exception: he
   doesn't add 3, he matches you, his team mirroring yours level for level once
   you're past his 70. Nobody goes above Lv 100. */
const GYMS = [
  { short: 'FALKNER', full: 'GYM LEADER FALKNER', city: 'VIOLET CITY', type: 'flying', badge: 'ZEPHYR', color: '#7fb2ff', scene: 'tower', min: 13,
    team: ['PIDGEY', 'HOOTHOOT', 'PIDGEOTTO'],
    intro: ["Falkner, Violet City's Gym Leader. You summoned me to a vending machine?", "Fine. My birds don't care where they fly. Show me you can keep up with them!"],
    outro: ["You grounded my birds... Not bad. Not bad at all.", 'This is yours now: the ZEPHYR BADGE.'],
    gloat: ['Too slow. The wind was on our side.', 'Come back when you can read the sky.'] },
  { short: 'BUGSY', full: 'GYM LEADER BUGSY', city: 'AZALEA TOWN', type: 'bug', badge: 'HIVE', color: '#86efac', scene: 'forest', min: 17,
    team: ['METAPOD', 'KAKUNA', 'SCYTHER'],
    intro: ["I'm Bugsy! I study bug Pokémon, and I've got notes on every one of yours.", "Let's see if my research holds up. Ready?"],
    outro: ["Huh! That's going straight in my notebook.", 'You earned it. Here, take the HIVE BADGE.'],
    gloat: ['My research says I win this one!', 'Keep studying. You were close.'] },
  { short: 'WHITNEY', full: 'GYM LEADER WHITNEY', city: 'GOLDENROD CITY', type: 'normal', badge: 'PLAIN', color: '#f9a8d4', scene: 'hall', min: 21,
    team: ['CLEFAIRY', 'AIPOM', 'LICKITUNG', 'MILTANK'],
    intro: ["I'm Whitney! Isn't my Miltank the cutest?", "Don't let that fool you, though. We play to win!"],
    outro: ["No fair! You weren't supposed to win!", "...Ugh, fine. Here's the PLAIN BADGE. Don't gloat."],
    gloat: ['Ha! Nobody stops Miltank.', 'Better luck next time, cutie!'] },
  { short: 'MORTY', full: 'GYM LEADER MORTY', city: 'ECRUTEAK CITY', type: 'ghost', badge: 'FOG', color: '#c4b5fd', scene: 'distortion', min: 25,
    team: ['GASTLY', 'HAUNTER', 'MISDREAVUS', 'GENGAR'],
    intro: ["I'm Morty. I had a feeling someone would call on me today.", "Let's see whether the future I saw was the right one."],
    outro: ["So that's how it goes. I didn't foresee this.", 'You have earned the FOG BADGE.'],
    gloat: ['I saw this ending before we began.', "Your path isn't clear yet. Keep walking it."] },
  { short: 'CHUCK', full: 'GYM LEADER CHUCK', city: 'CIANWOOD CITY', type: 'fighting', badge: 'STORM', color: '#fdba74', scene: 'bertha', min: 29,
    team: ['PRIMEAPE', 'MACHOKE', 'HITMONLEE', 'HITMONCHAN', 'POLIWRATH'],
    intro: ["HOOAH! I'm Chuck! My Pokémon and I train harder than anyone!", "Let's see what you've got! No holding back!"],
    outro: ["HOOAH... I lost?! What a fight!", 'You deserve this. The STORM BADGE is yours!'],
    gloat: ['HOOAH! More training for you!', "Come back stronger, and we'll go again!"] },
  { short: 'JASMINE', full: 'GYM LEADER JASMINE', city: 'OLIVINE CITY', type: 'steel', badge: 'MINERAL', color: '#cbd5e1', scene: 'factory', min: 33,
    team: ['MAGNEMITE', 'MAGNEMITE', 'SKARMORY', 'FORRETRESS', 'STEELIX'],
    intro: ["...Oh. Hello. I'm Jasmine. I use steel types.", "...They're very sturdy. I hope you're ready."],
    outro: ["...You were wonderful.", '...Please take the MINERAL BADGE.'],
    gloat: ["...Sorry. Steel doesn't bend easily.", '...Do come back again.'] },
  { short: 'PRYCE', full: 'GYM LEADER PRYCE', city: 'MAHOGANY TOWN', type: 'ice', badge: 'GLACIER', color: '#bae6fd', scene: 'ice', min: 37,
    team: ['SEEL', 'DEWGONG', 'SWINUB', 'JYNX', 'LAPRAS', 'PILOSWINE'],
    intro: ["I am Pryce. I have trained ice Pokémon longer than you have been alive.", "Patience and cold. Let us see if you have learned either."],
    outro: ["Hm. The ice gives way to you. I am impressed.", 'Take the GLACIER BADGE, young one.'],
    gloat: ['The cold is patient. You were not.', 'Warm up, and think on what went wrong.'] },
  { short: 'CLAIR', full: 'GYM LEADER CLAIR', city: 'BLACKTHORN CITY', type: 'dragon', badge: 'RISING', color: '#a5b4fc', scene: 'cynthia', min: 41,
    team: ['HORSEA', 'SEADRA', 'GYARADOS', 'DRAGONAIR', 'DRAGONAIR', 'KINGDRA'],
    intro: ["I'm Clair. The best dragon trainer you'll ever meet.", "You summoned me, so I hope you're not wasting my time."],
    outro: ["...I lost? To you?", "...Fine. The RISING BADGE. You've earned it, I suppose."],
    gloat: ['Of course. Dragons are the strongest.', 'Train more before you dare face me again.'] },

  /* Kanto, open once you're Champion. Their aces' signature moves ride on the
     leader (`sig`), not the species, so Guard Marcus's Arcanine and the like
     keep fighting the way they always have. */
  { short: 'BROCK', full: 'GYM LEADER BROCK', city: 'PEWTER CITY', type: 'rock', badge: 'BOULDER', color: '#d6d3d1', scene: 'mountain', min: 55, tokens: '10.00',
    team: ['GOLEM', 'RHYDON', 'OMASTAR', 'KABUTOPS', 'STEELIX'],   // a rematch: his HGSS team, evolved
    sig: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('ROCK SLIDE', 'rock', 65, 'phys', 'thud', { ranged: true }), L_('ROLLOUT', 'rock', 30, 'phys', 'roll', 'thud', { hits: 3 })],
    intro: ["I'm Brock, Pewter City's Gym Leader. Rock types are all about grit.", "You beat the Champion? Then my defense is the real test."],
    outro: ['My rock-hard defense... crumbled. That was great.', "Here. The BOULDER BADGE. You've earned it."],
    gloat: ["Rock doesn't move. That's the whole point.", 'Work on your offense and come back.'] },
  { short: 'MISTY', full: 'GYM LEADER MISTY', city: 'CERULEAN CITY', type: 'water', badge: 'CASCADE', color: '#67e8f9', scene: 'water', min: 57, tokens: '10.00',
    team: ['GOLDUCK', 'SEAKING', 'QUAGSIRE', 'LAPRAS', 'STARMIE'],
    sig: [S_('PSYCHIC', 'psychic', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('SWIFT', 'normal', 40, 'spec', 'whoosh', { ranged: true, hits: 2 })],
    intro: ["Misty, Cerulean City's Gym Leader. Water types, all the way.", "Champion or not, I'm going to soak you!"],
    outro: ["Ugh, you're good. Really good.", 'Fine! The CASCADE BADGE is yours.'],
    gloat: ['Washed out! Told you so.', 'Go dry off and try again.'] },
  { short: 'LT. SURGE', full: 'GYM LEADER LT. SURGE', city: 'VERMILION CITY', type: 'electric', badge: 'THUNDER', color: '#fde047', scene: 'city', min: 59, tokens: '10.00', key: 'lt_surge',
    team: ['ELECTRODE', 'MAGNETON', 'ELECTRODE', 'ELECTABUZZ', 'RAICHU'],
    sig: [S_('THUNDERBOLT', 'electric', 75, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 55, 'spec', 'current', 'zap'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['Lt. Surge, Vermilion City! Ten-hut! My Pokémon run on pure voltage!', "Let's see if the Champion can take a shock!"],
    outro: ["Whoa! You're the real deal, kid!", 'The THUNDER BADGE. You earned every volt of it.'],
    gloat: ["Zapped! That's how we do it in Vermilion!", 'Come back with something insulated!'] },
  { short: 'ERIKA', full: 'GYM LEADER ERIKA', city: 'CELADON CITY', type: 'grass', badge: 'RAINBOW', color: '#bef264', scene: 'meadow', min: 61, tokens: '10.00',
    team: ['TANGELA', 'JUMPLUFF', 'VICTREEBEL', 'VILEPLUME', 'BELLOSSOM'],
    sig: [S_('PETAL BLIZZARD', 'grass', 70, 'phys', 'whoosh', { ranged: true }), L_('GRASS KNOT', 'grass', 55, 'spec', 'vines', 'thud'), S_('MOONBLAST', 'fairy', 70, 'spec', 'whoosh', { ranged: true })],
    intro: ["Oh... I must have dozed off. I'm Erika, of Celadon City.", 'I use grass types. Shall we begin? Gently, of course.'],
    outro: ["Oh my. You're very strong. I concede.", 'Please accept the RAINBOW BADGE.'],
    gloat: ['The flowers bloomed for me today.', 'Do come and visit the garden again.'] },
  { short: 'JANINE', full: 'GYM LEADER JANINE', city: 'FUCHSIA CITY', type: 'poison', badge: 'SOUL', color: '#f5d0fe', scene: 'marsh', min: 63, tokens: '10.00',
    team: ['CROBAT', 'WEEZING', 'ARIADOS', 'MUK', 'VENOMOTH'],
    sig: [S_('BUG BUZZ', 'bug', 70, 'spec', 'whoosh', { ranged: true }), S_('PSYBEAM', 'psychic', 55, 'spec', 'shadow', { ranged: true }), L_('SLUDGE WAVE', 'poison', 55, 'spec', 'wave', 'whoosh')],
    intro: ["I'm Janine! My father Koga taught me everything about poison.", "I'm a ninja too, you know. You won't see me coming!"],
    outro: ['Aww... Father warned me you were strong.', 'Here. The SOUL BADGE.'],
    gloat: ['Ha! Father would be proud of that one!', "Train harder. I'll be waiting in Fuchsia."] },
  { short: 'SABRINA', full: 'GYM LEADER SABRINA', city: 'SAFFRON CITY', type: 'psychic', badge: 'MARSH', color: '#fbcfe8', scene: 'hall', min: 65, tokens: '10.00',
    team: ['SLOWBRO', 'JYNX', 'MR. MIME', 'ESPEON', 'ALAKAZAM'],
    sig: [S_('PSYCHIC', 'psychic', 80, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('SHADOW BALL', 'ghost', 65, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('PSYWAVE', 'psychic', 50, 'spec', 'wave', 'shadow')],
    intro: ['I am Sabrina. I knew you would summon me today.', 'I also know how this ends. Shall we confirm it?'],
    outro: ['...That was not the future I saw.', 'The MARSH BADGE. Take it.'],
    gloat: ['As I foresaw.', 'Your future holds another try. Not yet a win.'] },
  { short: 'BLAINE', full: 'GYM LEADER BLAINE', city: 'CINNABAR ISLAND', type: 'fire', badge: 'VOLCANO', color: '#fb923c', scene: 'flint', min: 67, tokens: '10.00',
    team: ['MAGCARGO', 'NINETALES', 'MAGMAR', 'ARCANINE', 'RAPIDASH'],
    sig: [S_('FLARE BLITZ', 'fire', 80, 'phys', 'whoosh'), L_('FLAME WHEEL', 'fire', 50, 'phys', 'roll', 'whoosh'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['Blaine! My gym burned down, so a vending machine will have to do!', 'Pop quiz: what melts a Champion? My fire types!'],
    outro: ["I've burned out! What a battle!", 'You have earned the VOLCANO BADGE!'],
    gloat: ['The answer was my fire. Correct!', 'Study up and come back for a retake!'] },
  { short: 'BLUE', full: 'GYM LEADER BLUE', city: 'VIRIDIAN CITY', type: 'normal', badge: 'EARTH', color: '#93c5fd', scene: 'tower', min: 70, tokens: '20.00', matchYou: true,
    team: ['PIDGEOT', 'ALAKAZAM', 'RHYDON', 'EXEGGUTOR', 'GYARADOS', 'ARCANINE'],
    sig: [S_('FLARE BLITZ', 'fire', 80, 'phys', 'whoosh'), S_('CRUNCH', 'dark', 70, 'phys', 'crunch'), S_('EXTREME SPEED', 'normal', 50, 'phys', 'whoosh', { fast: true })],
    intro: ["So you're the one who beat Lance. I'm Blue. I was Champion once, you know.", "I've never gone easy on anyone. Don't expect me to start now."],
    outro: ["...Heh. You're the real thing.", "Take the EARTH BADGE. That's every gym there is."],
    gloat: ["Too bad. I'm still the best there is.", "Come back when you've caught up."] },
]
GYMS.forEach((L, i) => Object.assign(L, { gym: i, region: i < 8 ? 'johto' : 'kanto', role: 'GYM LEADER', hard: true, tokens: L.tokens ?? '8.00',
  // Blue's gym has no type of its own.
  title: `${L.city} GYM · ${L.matchYou ? 'EVERY' : L.type.toUpperCase()} TYPE`, summonName: `${L.badge} SUMMON` }, art(L)))

/* The Elite Four and the Champion: one summon, five fights back to back. Your
   party carries its HP from one fight into the next (items still work in
   battle). Lose anywhere and the run is over; the next summon starts again
   from Will. Each win pays as you go. */
const ELITE = [
  { short: 'WILL', full: 'ELITE FOUR WILL', type: 'psychic', color: '#f0abfc', scene: 'lucian', min: 44, tokens: '6.00',
    team: ['JYNX', 'EXEGGUTOR', 'SLOWBRO', 'XATU', 'XATU'],
    sig: [S_('PSYCHIC', 'psychic', 75, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('AIR SLASH', 'flying', 65, 'spec', 'whoosh', { ranged: true }), L_('PSYWAVE', 'psychic', 45, 'spec', 'wave', 'shadow')],
    intro: ["Will, of the Elite Four. I've studied psychic power on every continent.", "A vending machine summons me, and you expect to win? Let's see your mind."],
    outro: ['...My psychic power, outmatched. Remarkable.', 'Go on. Koga is next, and he is far less polite.'],
    gloat: ['Your thoughts were loud. I heard every move coming.', 'Clear your head before you try the League again.'] },
  { short: 'KOGA', full: 'ELITE FOUR KOGA', type: 'poison', color: '#d8b4fe', scene: 'aaron', min: 46, tokens: '6.00',
    team: ['ARIADOS', 'VENOMOTH', 'FORRETRESS', 'MUK', 'CROBAT'],
    sig: [S_('CROSS POISON', 'poison', 70, 'phys', 'crunch'), S_('AIR SLASH', 'flying', 65, 'spec', 'whoosh', { ranged: true }), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['Fwahahaha! Koga of the Elite Four. A ninja is never where you expect.', "Poison and patience. You'll be tangled before you notice."],
    outro: ['Hmm... You saw through every technique. Well done.', 'Bruno is next. Mind your footing.'],
    gloat: ['Fwahaha! Caught in the web, as planned.', 'Return when you can see what is hidden.'] },
  { short: 'BRUNO', full: 'ELITE FOUR BRUNO', type: 'fighting', color: '#fda4af', scene: 'bertha', min: 48, tokens: '6.00',
    team: ['HITMONTOP', 'HITMONLEE', 'HITMONCHAN', 'ONIX', 'MACHAMP'],
    sig: [S_('CROSS CHOP', 'fighting', 80, 'phys', 'thud'), L_('LOW SWEEP', 'fighting', 50, 'phys', 'sweep', 'thud'), S_('BULLET PUNCH', 'steel', 40, 'phys', 'thud', { fast: true })],
    intro: ['Bruno of the Elite Four! My Pokémon and I train until the mountains crack!', 'No tricks. No excuses. Hit us with everything!'],
    outro: ['Hah! Beaten fair and square. That was a real fight!', "Karen is next. She's tougher than she looks."],
    gloat: ['HAAH! Your guard was down!', 'Train your body, then come back!'] },
  { short: 'KAREN', full: 'ELITE FOUR KAREN', type: 'dark', color: '#94a3b8', scene: 'castle', min: 50, tokens: '6.00',
    team: ['UMBREON', 'VILEPLUME', 'GENGAR', 'MURKROW', 'HOUNDOOM'],
    sig: [S_('FLAMETHROWER', 'fire', 75, 'spec', 'whoosh', { ranged: true }), S_('CRUNCH', 'dark', 70, 'phys', 'crunch'), L_('FLAME WHEEL', 'fire', 50, 'phys', 'roll', 'whoosh')],
    intro: ['Karen, of the Elite Four. I use dark types, and I raise them with love.', 'Strength is in how you treat your Pokémon. Show me yours.'],
    outro: ['Well, well. You really do care for your team.', "Go on. The Champion is waiting for you."],
    gloat: ['Not bad, but not enough. Love them harder.', 'Come back when your team trusts you completely.'] },
  { short: 'LANCE', full: 'CHAMPION LANCE', role: 'CHAMPION', type: 'dragon', color: '#f87171', scene: 'cynthia', min: 53, tokens: '20.00',
    team: ['GYARADOS', 'DRAGONITE', 'CHARIZARD', 'AERODACTYL', 'DRAGONITE', 'DRAGONITE'],
    sig: [S_('OUTRAGE', 'dragon', 80, 'phys', 'thud'), L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('EXTREME SPEED', 'normal', 50, 'phys', 'whoosh', { fast: true })],
    intro: ["I've been waiting. I'm Lance: the Champion, and a dragon master.", "Four down in one go. Let's see if you can finish it."],
    outro: ["...It's over. You're the new Champion of the Johto League.", "Kanto's Gym Leaders will want to meet you. Go show them."],
    gloat: ["Dragons don't yield. Neither do I.", 'The Elite Four are waiting. Start again from Will.'] },
]
ELITE.forEach((L) => Object.assign(L, { elite: true, city: 'INDIGO PLATEAU', role: L.role ?? 'ELITE FOUR', hard: true,
  title: `${L.role === 'CHAMPION' ? 'CHAMPION' : 'ELITE FOUR'} · ${L.type.toUpperCase()} TYPE` }, art(L)))
/** What the Elite Four summon shows on the shelf and in the Bag. */
const ELITE_CARD = { short: 'THE ELITE FOUR', city: 'INDIGO PLATEAU', summonName: 'ELITE FOUR TICKET', face: 'gymFace:lance', color: '#f87171', tag: 'LEAGUE' }

/** A leader's art keys (build.mjs embeds `gymBody:<key>` and friends). */
function art(L) {
  const k = L.key ?? L.short.toLowerCase()
  return { key: k, vs: `gymVs:${k}`, face: `gymFace:${k}`, body: `gymBody:${k}`, down: `gymBody:${k}`, faceDown: `gymFace:${k}` }
}

const LEVEL_CAP = 100
/**
 * The levels a leader's team fights at, ace last, against a party at these
 * levels: the ace at the leader's minimum or 3 above your best, the rest 2
 * below it. Blue matches instead: his Pokémon mirror yours, strongest against
 * strongest, never below his own 70 (68 for the rest of his team).
 */
function leaderLevels(L, partyLevels) {
  const best = Math.max(1, ...partyLevels), last = L.team.length - 1
  if (!L.matchYou) {
    const ace = Math.min(LEVEL_CAP, Math.max(L.min, best + 3))
    return L.team.map((_, i) => (i === last ? ace : Math.max(1, ace - 2)))
  }
  const yours = [...partyLevels].sort((a, b) => b - a)
  return L.team.map((_, i) => {
    const rank = last - i   // the ace (last) answers your strongest
    return Math.min(LEVEL_CAP, Math.max(rank === 0 ? L.min : L.min - 2, yours[Math.min(rank, yours.length - 1)] ?? 1))
  })
}

/**
 * What a summon brings next, given the gyms beaten and whether you're
 * Champion: a gym's index (Johto 0-7, Kanto 8-15), 'elite' between the two
 * regions, or null once every gym is beaten.
 */
function nextChallenge(badges, champion) {
  if (badges.length < 8) return badges.length
  if (!champion) return 'elite'
  return badges.length < GYMS.length ? badges.length : null
}
/** The leader, or the Elite Four's card, that a challenge refers to. */
const challengeCard = (n) => (n === 'elite' ? ELITE_CARD : GYMS[n])

/* The aces' signature moves; the rest of a leader's team fights with its type's moves. */
Object.assign(TRAINER_MOVES, {
  PIDGEOTTO: [S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), S_('GUST', 'flying', 45, 'spec', 'whoosh', { ranged: true, hits: 2 })],
  SCYTHER: [S_('FURY CUTTER', 'bug', 30, 'phys', 'whoosh', { hits: 3 }), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh')],
  MILTANK: [L_('ROLLOUT', 'rock', 30, 'phys', 'roll', 'thud', { hits: 3 }), S_('STOMP', 'normal', 65, 'phys', 'thud'), S_('ATTRACT', 'normal', 30, 'spec', 'whoosh', { ranged: true })],
  GENGAR: [S_('SHADOW BALL', 'ghost', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('SLUDGE BOMB', 'poison', 70, 'spec', 'whoosh', { ranged: true })],
  POLIWRATH: [S_('DYNAMIC PUNCH', 'fighting', 75, 'phys', 'thud'), L_('SURF', 'water', 60, 'spec', 'wave', 'whoosh'), S_('DOUBLE SLAP', 'normal', 20, 'phys', 'thud', { hits: 3 })],
  STEELIX: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('IRON TAIL', 'steel', 75, 'phys', 'crunch'), S_('ROCK THROW', 'rock', 55, 'phys', 'thud', { ranged: true })],
  PILOSWINE: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('ICE SHARD', 'ice', 45, 'phys', 'whoosh', { fast: true, ranged: true }), S_('BLIZZARD', 'ice', 75, 'spec', 'whoosh', { ranged: true })],
  KINGDRA: [S_('DRAGON PULSE', 'dragon', 70, 'spec', 'shadow', { ranged: true }), L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('TWISTER', 'dragon', 35, 'spec', 'whoosh', { ranged: true, hits: 2 })],
})
/** A challenge's summon as a Bag item key: 'summon:3', 'summon:elite'. */
const summonKey = (n) => 'summon:' + n
/** A challenge's summon as a Bag item, registered the first time one turns up. */
const summonItem = (n) => (ITEMS[summonKey(n)] ??= n === 'elite'
  ? { name: ELITE_CARD.summonName, sub: 'the Elite Four and Champion Lance, one at a time', cls: 't-summon', summon: n }
  : { name: GYMS[n].summonName, sub: `summons ${GYMS[n].short} of ${GYMS[n].city}`, cls: 't-summon', summon: n })

/* The Elite Four's aces fight with their signature moves (the rest with their type's). */
ELITE.forEach((L) => { if (L.sig) TRAINER_MOVES[L.team.at(-1)] ??= L.sig })

/*
 * Balance (sim.mjs, thousands of simulated battles): early leaders tell less
 * and their rings close a little slower; a few are moved up or down a level or
 * two to smooth the curve (Bugsy and Chuck were spikes; the late gyms and the
 * Elite Four were soft). lvAdj is added to every level on their team.
 * Aim, for an average player arriving at the leader's level: about 3 wins in 4
 * (Lance about 1 in 2).
 */
const JOHTO_ADJ = [-1, -2, -1, -1, -3, 0, 2, 2]
// Kanto comes after the Champion, against a full, evolved party: well above you (Blue, who mirrors your levels, least).
const KANTO_ADJ = [6, 6, 10, 8, 10, 10, 12, 5]
GYMS.forEach((L, i) => Object.assign(L, i < 8
  ? { lvAdj: JOHTO_ADJ[i], tellRate: i < 3 ? 0.15 : i < 6 ? 0.3 : 0.4, ringFast: i < 3 ? 0.9 : i < 6 ? 0.85 : 0.8 }
  : { lvAdj: KANTO_ADJ[i - 8], tellRate: 0.45, ringFast: 0.8 }))
ELITE.forEach((L) => Object.assign(L, { lvAdj: { KAREN: 8, LANCE: 1 }[L.short] ?? 6, tellRate: L.role === 'CHAMPION' ? 0.5 : 0.45, ringFast: 0.8 }))

/* What a leader says after a tell: a jab when it lands, by the tell, or a grudging nod when you read it. */
const TELL_QUIP = {
  hit: ['Stay focused, trainer!', 'Eyes on the ring, not on me!', "Too slow! A leader doesn't fight fair.", 'Did that one catch you off guard?'],
  feint: ['Ha! You flinched at nothing!', 'Patience, trainer. Wait for it next time.'],
  double: ['One ring is never the whole story!', 'Thought it was over? Think again!'],
  lowHigh: ['Watch the feet, then the fists!', 'Low, then high. Keep up!'],
  clean: ["Hmph. Not bad. Let's see you do it twice.", 'You read that one. Lucky?', "Sharp eyes. They won't save you forever."],
}
/* Each leader's own jab, used about half the time when a tell lands. */
const TELL_QUIPS = {
  FALKNER: 'My birds strike from where you least expect!', BUGSY: "Bugs are quicker than they look. I've studied it!",
  WHITNEY: 'Hee hee! Did that one sting?', MORTY: "You can't trust your eyes against a ghost.",
  CHUCK: 'WAHAHA! Keep your guard up!', JASMINE: 'Um... sorry. You should watch more closely.',
  PRYCE: 'Patience is learned over many winters, child.', CLAIR: 'Is that all? I expected more from a challenger.',
  BROCK: 'Rock-solid timing beats rushing in.', MISTY: "Ha! You're all wet!", 'LT. SURGE': 'Stay sharp, soldier!',
  ERIKA: 'Oh my... you seemed a little distracted.', JANINE: 'A ninja never shows the real strike!',
  SABRINA: 'I saw you hesitate before you did.', BLAINE: 'Hah! Hot-headed, are we?', BLUE: "What, you thought I'd go easy on you?",
  WILL: 'Your mind betrayed you there.', KOGA: "Fwahahaha! Deception is the ninja's art!", BRUNO: 'Hoo hah! Train harder!',
  KAREN: 'Strong trainers keep their eyes open.', LANCE: "A Champion's challenger can't afford to blink.",
}
/* A leader calling on their last Pokémon, before it comes out. */
const LAST_MON = ["It's all up to you, {mon}!", "{mon}, show them why you're my ace!", "Don't hold back now, {mon}!", "This is it. {mon}, let's finish this!"]

/*
 * Kanto's teams, below their ace, fight with full-power moves of their type
 * (the wild sets top out around 40 power, which barely scratches a Lv 55+
 * party). Each set has one move along the ground, to jump.
 */
const STRONG_MOVES = {
  normal:   [S_('BODY SLAM', 'normal', 70, 'phys', 'thud'), L_('RAPID SPIN', 'normal', 50, 'phys', 'roll', 'thud'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
  fighting: [S_('CROSS CHOP', 'fighting', 75, 'phys', 'thud'), L_('LOW SWEEP', 'fighting', 55, 'phys', 'sweep', 'thud'), S_('MACH PUNCH', 'fighting', 40, 'phys', 'thud', { fast: true })],
  flying:   [S_('AIR SLASH', 'flying', 70, 'spec', 'whoosh', { ranged: true }), S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh'), L_('TWISTER', 'dragon', 45, 'spec', 'wave', 'whoosh')],
  poison:   [S_('SLUDGE BOMB', 'poison', 70, 'spec', 'whoosh', { ranged: true }), L_('SLUDGE WAVE', 'poison', 55, 'spec', 'wave', 'whoosh'), S_('POISON JAB', 'poison', 65, 'phys', 'thud')],
  ground:   [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('DIG', 'ground', 65, 'phys', 'thud'), S_('MUD SHOT', 'ground', 55, 'spec', 'whoosh', { ranged: true })],
  rock:     [S_('STONE EDGE', 'rock', 80, 'phys', 'thud'), S_('ROCK SLIDE', 'rock', 65, 'phys', 'thud', { ranged: true }), L_('ROLLOUT', 'rock', 30, 'phys', 'roll', 'thud', { hits: 3 })],
  bug:      [S_('BUG BUZZ', 'bug', 70, 'spec', 'whoosh', { ranged: true }), S_('X-SCISSOR', 'bug', 65, 'phys', 'whoosh'), S_('PIN MISSILE', 'bug', 25, 'phys', 'whoosh', { hits: 3 })],
  ghost:    [S_('SHADOW BALL', 'ghost', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('HEX', 'ghost', 60, 'spec', 'shadow', { ranged: true })],
  steel:    [S_('IRON HEAD', 'steel', 70, 'phys', 'thud'), S_('FLASH CANNON', 'steel', 70, 'spec', 'whoosh', { ranged: true }), L_('BULLDOZE', 'ground', 50, 'phys', 'quake', 'quake')],
  fire:     [S_('FLAMETHROWER', 'fire', 70, 'spec', 'whoosh', { ranged: true }), L_('FLAME WHEEL', 'fire', 50, 'phys', 'roll', 'whoosh'), S_('FIRE FANG', 'fire', 60, 'phys', 'crunch')],
  water:    [L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('WATERFALL', 'water', 70, 'phys', 'whoosh'), S_('AQUA JET', 'water', 40, 'phys', 'whoosh', { fast: true })],
  grass:    [S_('ENERGY BALL', 'grass', 70, 'spec', 'whoosh', { ranged: true }), L_('GRASS KNOT', 'grass', 55, 'spec', 'vines', 'thud'), S_('RAZOR LEAF', 'grass', 55, 'phys', 'whoosh', { ranged: true })],
  electric: [S_('THUNDERBOLT', 'electric', 70, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 55, 'spec', 'current', 'zap'), S_('SPARK', 'electric', 55, 'phys', 'zap')],
  psychic:  [S_('PSYCHIC', 'psychic', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('PSYWAVE', 'psychic', 50, 'spec', 'wave', 'shadow'), S_('PSYBEAM', 'psychic', 55, 'spec', 'shadow', { ranged: true })],
  ice:      [S_('ICE BEAM', 'ice', 70, 'spec', 'whoosh', { ranged: true }), S_('ICE SHARD', 'ice', 40, 'phys', 'whoosh', { fast: true }), L_('BULLDOZE', 'ground', 50, 'phys', 'quake', 'quake')],
  dragon:   [S_('DRAGON PULSE', 'dragon', 70, 'spec', 'shadow', { ranged: true }), S_('DRAGON CLAW', 'dragon', 70, 'phys', 'whoosh'), L_('TWISTER', 'dragon', 45, 'spec', 'wave', 'whoosh')],
  dark:     [S_('CRUNCH', 'dark', 70, 'phys', 'crunch'), S_('FEINT ATTACK', 'dark', 55, 'phys', 'whoosh'), L_('SUCKER PUNCH', 'dark', 45, 'phys', 'shadow', 'shadow', { fast: true })],
  fairy:    [S_('MOONBLAST', 'fairy', 70, 'spec', 'whoosh', { ranged: true }), S_('DAZZLING GLEAM', 'fairy', 60, 'spec', 'whoosh', { ranged: true }), L_('DRAINING KISS', 'fairy', 45, 'spec', 'wave', 'whoosh')],
}
/** A Kanto leader's Pokémon's moves (not their ace's: that's the leader's `sig`). */
const strongMoves = (m) => STRONG_MOVES[m.types[0]] ?? STRONG_MOVES.normal

async function run(id) {
  const demo = MODE !== 'play'   // 'demo' and 'duo' are both watched
  const live = () => id === RUN
  const W = (ms) => new Promise((r, j) => setTimeout(() => (live() ? r() : j(STOP)), ms))
  const anim = (el, frames, opts) => el.animate(frames, { fill: 'forwards', ...opts })
  const sfx = (n) => { if (live()) Sound.sfx(n) }
  const cry = (m) => { if (live() && m) Sound.cry(m.id) }   // a Pokémon's cry, as it comes out
  const fx = $('fx')
  const rand = demo ? rng(1) : Math.random
  const sceneRoll = demo ? rng(7) : Math.random   // its own stream, so the demo's battles stay as tuned
  const flavor = demo ? rng(11) : Math.random     // lines and drops: also their own stream
  const pickOf = (list) => list[Math.floor(flavor() * list.length)]
  const bag = { ball: 0, great: 0, potion: 0, super: 0, revive: 0 }   // empty: Alex hands you the first Potions and Balls
  const badges = [], nextGym = () => badges.length   // gyms beaten, in order
  let champion = false   // beat the Elite Four and Lance: opens Kanto (and its row in the badge case)
  /*
   * The Elite Four ladder. One ticket covers all five battles, fought one at
   * a time from the Bag, with as long as you like in between. A win moves
   * you up a rung and keeps the ticket; a loss spends it and drops you back
   * to Will. Beating Lance spends it too, and makes you Champion.
   */
  let eliteStep = 0   // 0-4: who's next (Will, Koga, Bruno, Karen, Lance)
  let pendingSummon = null   // a summon chosen in the Bag, to fight once the sheet closes
  const cart = new Map()   // the machine's cart: shelf key -> how many
  let pendingEvoItem = false   // an evolution item used in the Bag: the evolution plays once the sheet closes
  let wallet = 10, shelfItems = []   // tokens to spend, and the supplies on the shelf this restock
  let freeHeal = 1
  const party = [], box = []
  let busy = false

  /* ── reset ── */
  fx.innerHTML = ''; $('wipe').innerHTML = ''
  for (const w of ['enemy', 'player', 'trainer']) { $(w).getAnimations().forEach((a) => a.cancel()); $(w).style.visibility = 'hidden'; $(w).style.opacity = '1' }
  $('trainer').style.display = 'none'
  ;['ehud', 'phud'].forEach((h) => { $(h).style.visibility = 'hidden' })
  for (const el of ['showcase', 'sum', 'vs', 'talk']) $(el).style.display = 'none'
  $('vs').getAnimations({ subtree: true }).forEach((a) => a.cancel())
  $('devlink').hidden = demo
  panel(null); msg0('', ''); Sound.stopMusic()
  showLayer('battle')
  renderTools(); toolsEnabled(false)

  function cap(tag, text) { $('cap').innerHTML = `<b>${tag}</b><p>${text}</p>` }
  const pendingEvos = new Set()   // Pokémon that levelled into an evolution this battle
  function panel(name) { for (const p of ['pPick', 'pNext', 'pMain', 'pFight', 'pBag', 'pParty', 'pDefend', 'pStrike', 'pEvo']) $(p).style.display = p === name ? 'block' : 'none' }
  function msg0(a, b) { $('l1').textContent = a; $('l2').textContent = b }
  async function say(a, b = '', hold = demo ? 470 : 620) {
    msg0('', '')
    const full = [a, b]
    for (let line = 0; line < 2; line++) for (let i = 1; i <= full[line].length; i++) { $(line ? 'l2' : 'l1').textContent = full[line].slice(0, i); await W(APP.charMs) }
    await W(hold)
  }
  /**
   * A move being announced, by either side: in Play it stays up until you
   * press A or tap, so there's time to read it and get ready. The demo runs on.
   */
  async function announce(a, b = '', hold) {
    // Settings → Attack announcements → Automatic: they move on by themselves, after time to read.
    if (demo || APP.autoAdvance) return say(a, b, Math.max(hold ?? 0, demo ? 0 : 900))
    await say(a, b, 0)
    $('msg').classList.add('wait')
    try { await waitFor(['a']) } finally { $('msg').classList.remove('wait') }
    sfx('advance')
  }
  function waitFor(btns) { return new Promise((res, rej) => { const off = listen((b) => { if (!live()) { off(); rej(STOP) } else if (btns.includes(b)) { off(); res(b) } }) }) }
  async function demoPress(btn, after = 380, el = null) { await W(after); hot(el); press(btn) }

  /* ── layers and wipes ── */
  function showLayer(which) { $('home').style.display = which === 'home' ? 'block' : 'none'; $('battleL').style.display = which === 'battle' ? 'block' : 'none' }
  /** The classic wild-encounter wipe: three flashes, then black bars sweep in from alternating sides. */
  async function wipeWild(swap) {
    sfx('wipe')
    const wp = $('wipe'); wp.innerHTML = '<div class="whiteout"></div>'
    const wo = wp.firstChild
    for (let i = 0; i < 3; i++) { anim(wo, [{ opacity: .9 }, { opacity: 0 }], { duration: 120 }); await W(140) }
    const N = 12, h = 426 / N
    const bars = Array.from({ length: N }, (_, i) => { const b = document.createElement('i'); b.style.top = (i * h) + 'px'; b.style.height = (h + 1) + 'px'; wp.appendChild(b); return b })
    await Promise.all(bars.map((b, i) => anim(b, [{ transform: `translateX(${i % 2 ? 100 : -100}%)` }, { transform: 'none' }], { duration: 300, delay: i * 22, easing: 'cubic-bezier(.5,0,.5,1)' }).finished))
    await swap(); await W(120)
    await Promise.all(bars.map((b, i) => anim(b, [{ transform: 'none' }, { transform: `translateX(${i % 2 ? -100 : 100}%)` }], { duration: 300, delay: (N - i) * 18, easing: 'cubic-bezier(.5,0,.5,1)' }).finished))
    wp.innerHTML = ''
  }
  /** Scalpers get their own wipe: red and black shutters slamming shut on a diagonal. */
  async function wipeTrainer(swap) {
    sfx('wipe')
    const wp = $('wipe'); wp.innerHTML = ''
    const a = document.createElement('div'), b = document.createElement('div')
    a.className = b.className = 'shard'
    a.style.background = '#e11d48'; a.style.clipPath = 'polygon(0 0, 100% 0, 0 100%)'
    b.style.background = '#05070d'; b.style.clipPath = 'polygon(100% 0, 100% 100%, 0 100%)'
    wp.append(a, b)
    await Promise.all([
      anim(a, [{ transform: 'translate(-100%,-100%)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
      anim(b, [{ transform: 'translate(100%,100%)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
    ])
    shake(5, 220)
    await swap(); await W(150)
    await Promise.all([
      anim(a, [{ transform: 'none' }, { transform: 'translate(-100%,-100%)' }], { duration: 300, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
      anim(b, [{ transform: 'none' }, { transform: 'translate(100%,100%)' }], { duration: 300, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
    ])
    wp.innerHTML = ''
  }
  /** Back to the machine: a plain fade through black. */
  async function fadeThrough(swap) {
    const wp = $('wipe'); wp.innerHTML = '<div class="shard" style="background:#05070d;opacity:0"></div>'
    const s = wp.firstChild
    await anim(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 }).finished
    await swap(); await W(100)
    await anim(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished
    wp.innerHTML = ''
  }

  /* ── the machine's own screen ── */
  const PACKS = ['jungle-scyther', 'fossil-lapras', 'team-rocket-giovanni', 'gym-heroes-brock']
  let homeState = 'idle'
  let scalper = HERB, lastCrew = []
  /** n different trainers at random, never anyone from the encounter just before. */
  /*
   * A trainer you've just beaten stays away for a while: BEATEN_REST of your
   * taps (each tap counts it down). They're skipped when picking who turns up,
   * unless that would leave too few to choose from.
   */
  const BEATEN_REST = 6, resting = new Map()   // trainer -> taps left
  const restBeaten = (crew) => crew.forEach((T) => resting.set(T.short, BEATEN_REST))
  const tickRest = () => { for (const [k, n] of resting) n <= 1 ? resting.delete(k) : resting.set(k, n - 1) }
  function randomTrainers(n) {
    const fresh = SCALPERS.filter((T) => !lastCrew.includes(T) && !resting.has(T.short))
    const pool = fresh.length >= n ? fresh : SCALPERS.filter((T) => !lastCrew.includes(T)), out = []
    while (out.length < n) out.push(pool.splice(Math.floor(flavor() * pool.length), 1)[0])
    lastCrew = out
    return out
  }
  /**
   * The machine's screen. 'idle' is the attract screen (the default, and what
   * shows before any interaction); a tap turns into one of the state screens:
   * 'in' (stocked), 'out' (sold out) or 'maint' (maintenance).
   */
  function renderHome(state, blocked = false) {
    homeState = state
    const h = $('home')
    h.className = 'layer home ' + state
    if (blocked) h.classList.add('blocked')
    $('wallet').textContent = `${wallet.toFixed(2)} tk`
    h.classList.toggle('haswallet', !$('tools').hidden)
    if (state !== 'in') cart.clear()
    paintCart()
    if (state === 'idle') {
      const other = typeof machine !== 'undefined' && machine.lockedBy && machine.lockedBy !== 'YOU' ? machine.lockedBy : null
      h.classList.toggle('inuse', !!other)
      $('tts').innerHTML = other ? `${other} IS USING IT<small>you can still tap: something may jump out</small>` : 'TOUCH TO START'
      $('homeLoiterer').style.display = 'none'; $('supplies').innerHTML = ''; return
    }
    // Stocked: the machine's grid, the packs and then whatever battle supplies this restock has, side by side.
    const sup = state === 'in' ? shelfItems : []
    h.classList.toggle('has-sup', sup.length > 0)
    $('supplies').innerHTML = state === 'in' ? STOCK_PACKS.map((p) => `<button class="tile pack" data-pack="${p.name}"><span class="art"><img src="${ART['pack:' + p.art]}" alt=""></span><span class="qty">${p.left}</span><b>${p.name}</b><span class="meta">1 token · ${p.left} left</span></button>`).join('') + sup.map(supplyTile).join('') : ''
    $('homeLine').textContent = blocked ? 'BLOCKED!' : { in: 'PACKS ARE IN!', out: 'NEXT RESTOCK 03:12', maint: 'BACK SOON' }[state]
    $('homeSub').textContent = blocked ? `${scalper.short} is camping the machine` : { in: 'tap items to add them to your cart', out: 'sold out', maint: 'under maintenance' }[state]
    if (blocked) $('homeLoiterer').src = ART[scalper.body]
    $('homeLoiterer').style.display = blocked ? 'block' : 'none'
  }
  /* The packs in the stocked grid (the app's real stock: one per set, a token each). */
  const STOCK_PACKS = [{ art: 'jungle-scyther', name: 'Jungle', left: 12 }, { art: 'gym-heroes-brock', name: 'Gym Heroes', left: 7 }, { art: 'fossil-lapras', name: 'Fossil', left: 9 },
    { art: 'team-rocket-giovanni', name: 'Team Rocket', left: 4 }, { art: 'gym-challenge-koga', name: 'Gym Challenge', left: 15 }]
  /** A battle supply's tile in the grid: an item, a bundle, or your next gym's summon. */
  function supplyTile(k) {
    if (k.startsWith('bundle:')) {
      const b = bundleById(k.slice(7)); if (!b) return ''
      const n = BUNDLE_ITEMS.reduce((s, i) => s + (b.items[i] ?? 0), 0)
      return `<button class="tile bundle" data-buy="${k}"><span class="art">${BUNDLE_ITEMS.filter((i) => b.items[i] > 0).map((i) => `<span class="brow"><span class="supic ${i}"></span>×${b.items[i]}</span>`).join('')}</span><i class="kind">BUNDLE</i><b>${esc(b.name)}</b><span class="meta">${b.price.toFixed(2)} tk · ${n} items</span></button>`
    }
    if (k === 'elite') return `<button class="tile summon" data-buy="elite"><span class="art"><img src="${ART[ELITE_CARD.face]}" alt=""></span><i class="kind">LEAGUE</i><b>ELITE FOUR TICKET</b><span class="meta">${SHOP.elite.price.toFixed(2)} tk · all 5 battles</span></button>`
    if (k === 'summon') { const L = GYMS[nextGym()]; return `<button class="tile summon" data-buy="summon"><span class="art"><img src="${ART[L.face]}" alt=""></span><i class="kind">GYM</i><b>${L.badge} SUMMON</b><span class="meta">${SHOP.summon.price.toFixed(2)} tk · ${L.short}</span></button>` }
    return `<button class="tile item" data-buy="${k}"><span class="art"><span class="supic ${k}"></span></span><i class="kind">${ITEMS[k].key ? 'KEY ITEM' : 'ITEM'}</i><b>${ITEMS[k].name}</b><span class="meta">${SHOP[k].price.toFixed(2)} tk · ${ITEMS[k].sub}</span></button>`
  }
  /** Buys one supply off the shelf: tokens out, the item (or a bundle's items) into the Bag. */
  function buySupply(k) {
    const b = k.startsWith('bundle:') ? bundleById(k.slice(7)) : null
    if (k.startsWith('bundle:') && !b) return false
    const price = b ? b.price : SHOP[k].price, el = $('supplies').querySelector(`[data-buy="${k}"]`)
    if (wallet + 1e-9 < price) { sfx('blocked'); $('homeSub').textContent = `not enough tokens for ${b ? `the ${b.name}` : `a ${ITEMS[k].name}`}`; return false }
    wallet = Math.round((wallet - price) * 100) / 100
    if (b) {
      for (const i of BUNDLE_ITEMS) if (b.items[i] > 0) bag[i] = (bag[i] ?? 0) + b.items[i]
      $('homeSub').textContent = `bought the ${b.name} for ${price.toFixed(2)} tk · ${bundleText(b)} into your Bag`
    } else {
      // A summon is always for your next gym: it goes in the Bag as that gym's.
      const key = k === 'summon' ? (summonItem(nextGym()), summonKey(nextGym())) : k === 'elite' ? (summonItem('elite'), summonKey('elite')) : k
      bag[key] = ITEMS[key].key ? 1 : (bag[key] ?? 0) + 1   // a key item is had or not
      $('homeSub').textContent = `bought ${/^[AEIOU]/.test(ITEMS[key].name) ? 'an' : 'a'} ${ITEMS[key].name} for ${price.toFixed(2)} tk · ${ITEMS[key].key ? 'a key item, in your Bag' : `×${bag[key]} in your Bag`}`
    }
    renderTools(); sfx('click')
    $('wallet').textContent = `${wallet.toFixed(2)} tk`
    window.__saveSoon?.()
    if (el) anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 260 })
    return true
  }
  // A tap on a supply buys it rather than counting as a tap on the screen (which goes back to idle).
  $('supplies').onclick = (e) => {
    const b = e.target.closest('[data-buy]'), pk = e.target.closest('[data-pack]')
    if (!b && !pk) return
    e.stopPropagation()
    if (MODE !== 'play' || busy || !live()) return
    if (pk) { hot(pk); $('homeSub').textContent = `${pk.dataset.pack} packs check out as they do today`; return }
    const k = b.dataset.buy
    if (e.target.closest('[data-minus]')) { const n = (cart.get(k) ?? 0) - 1; n > 0 ? cart.set(k, n) : cart.delete(k); sfx('move') }
    else {
      const n = cart.get(k) ?? 0
      if (n >= cartMax(k)) { sfx('blocked'); $('homeSub').textContent = cartMax(k) === 1 ? 'one of those at a time' : `up to ${cartMax(k)} of each`; return }
      cart.set(k, n + 1); sfx('click'); hot(b)
      anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 200 })
    }
    paintCart()
  }
  /* ── the cart ──
     Taps put supplies in the cart; CHECKOUT shows the order, PAY takes the
     tokens and the machine dispenses (like the packs in the app), and the
     items land in the Bag. A summon, a ticket or a key item is one at a time. */
  const cartMax = (k) => (k === 'summon' || k === 'elite' || ITEMS[k]?.key ? 1 : 9)
  const priceOf = (k) => (k.startsWith('bundle:') ? bundleById(k.slice(7))?.price ?? 0 : SHOP[k].price)
  const nameOf = (k) => (k.startsWith('bundle:') ? bundleById(k.slice(7))?.name ?? 'BUNDLE' : k === 'summon' ? `${GYMS[nextGym()]?.badge ?? 'GYM'} SUMMON` : ITEMS[k].name)
  const cartCount = () => [...cart.values()].reduce((a, b) => a + b, 0)
  const cartTotal = () => Math.round([...cart].reduce((s, [k, n]) => s + priceOf(k) * n, 0) * 100) / 100
  /** The tiles' counts and the bar under them. */
  function paintCart() {
    for (const el of $('supplies').querySelectorAll('[data-buy]')) {
      const n = cart.get(el.dataset.buy) ?? 0
      el.querySelector('.incart')?.remove(); el.querySelector('.minus')?.remove()
      el.classList.toggle('picked', n > 0)
      if (n) el.insertAdjacentHTML('beforeend', `<span class="incart">×${n}</span><span class="minus" data-minus="1">−</span>`)
    }
    const n = cartCount()
    $('cbSum').innerHTML = homeState === 'in' ? (n ? `<b>CART ${n}</b> · ${cartTotal().toFixed(2)} tk` : 'CART empty') : ''
    $('cbGo').disabled = !n
  }
  /** Puts one bought supply (or a bundle's items) in the Bag. */
  function giveSupply(k) {
    const b = k.startsWith('bundle:') ? bundleById(k.slice(7)) : null
    if (b) { for (const i of BUNDLE_ITEMS) if (b.items[i] > 0) bag[i] = (bag[i] ?? 0) + b.items[i]; return }
    const key = k === 'summon' ? (summonItem(nextGym()), summonKey(nextGym())) : k === 'elite' ? (summonItem('elite'), summonKey('elite')) : k
    bag[key] = ITEMS[key].key ? 1 : (bag[key] ?? 0) + 1
  }
  /** The checkout screen: the order, the total, your tokens before and after. */
  function drawCheckout() {
    const total = cartTotal(), short = wallet + 1e-9 < total
    $('checkout').innerHTML = `<div class="cohd">CHECKOUT</div>
      <div class="colines">${[...cart].map(([k, n]) => `<div class="coline">${k.startsWith('bundle:') || k === 'summon' || k === 'elite' ? '<span class="coic box"></span>' : `<span class="coic supic ${k}"></span>`}<span class="conm">${nameOf(k)}</span><span class="coqty">×${n}</span><span class="copr">${(priceOf(k) * n).toFixed(2)}</span></div>`).join('')}</div>
      <div class="cotot"><span>TOTAL</span><b>${total.toFixed(2)} tokens</b></div>
      <div class="cobal">Your tokens: ${wallet.toFixed(2)} → <b class="${short ? 'bad' : ''}">${short ? 'not enough' : (wallet - total).toFixed(2)}</b></div>
      <div class="cobtns"><button class="cb back" data-co="back">◀ KEEP SHOPPING</button><button class="cb go" data-co="pay" ${short ? 'disabled' : ''}>PAY ${total.toFixed(2)}</button></div>`
  }
  /** PAY: tokens out, then the machine dispenses, one item at a time, and it all goes in the Bag. */
  async function payCart() {
    const total = cartTotal(), items = [...cart], n = cartCount()
    if (!n || wallet + 1e-9 < total) return
    wallet = Math.round((wallet - total) * 100) / 100; $('wallet').textContent = `${wallet.toFixed(2)} tk`
    for (const [k, q] of items) for (let i = 0; i < q; i++) giveSupply(k)
    cart.clear(); renderTools(); window.__saveSoon?.()
    const co = $('checkout'); co.classList.add('disp')
    for (let i = 1; i <= n; i++) {
      co.innerHTML = `<p class="dsm">COLLECTING</p><p class="dbig">${i} OF ${n} TOTAL ITEM${n === 1 ? '' : 'S'}</p><div class="dline"></div><p class="dsm dim">PLEASE WAIT</p>`
      sfx('click'); await W(i === n ? 700 : 450)
    }
    sfx('tokens')
    co.innerHTML = `<p class="dbig">THANK YOU!</p><div class="dline"></div><p class="dsm">${n} item${n === 1 ? '' : 's'} added to your Bag</p><p class="dsm dim">${total.toFixed(2)} tokens · ${wallet.toFixed(2)} left</p>`
    feed(`<b>You</b> bought ${items.map(([k, q]) => `${q} ${nameOf(k)}`).join(', ')} for ${total.toFixed(2)} tokens.`)
    await W(1700)
    co.classList.remove('open', 'disp'); co.innerHTML = ''
    await toIdle()
  }
  $('cbGo').onclick = (e) => { e.stopPropagation(); if (MODE !== 'play' || busy || !cartCount()) return; sfx('select'); drawCheckout(); $('checkout').classList.add('open') }
  $('cbBack').onclick = (e) => { e.stopPropagation(); if (MODE !== 'play' || busy) return; sfx('move'); cart.clear(); paintCart(); guard(() => toIdle())() }
  $('checkout').onclick = (e) => {
    e.stopPropagation()
    const btn = e.target.closest('[data-co]'); if (!btn || btn.disabled || MODE !== 'play' || busy) return
    if (btn.dataset.co === 'back') { sfx('move'); $('checkout').classList.remove('open'); paintCart() }
    if (btn.dataset.co === 'pay') guard(payCart)()
  }
  function bangOn(layer, x, y) {
    const bang = document.createElement('div'); bang.className = 'bang'; bang.textContent = '!'
    bang.style.left = x + 'px'; bang.style.top = y + 'px'; layer.appendChild(bang); sfx('bang')
    anim(bang, [{ transform: 'scale(.3)' }, { transform: 'scale(1.4)', offset: .5 }, { transform: 'scale(1)' }], { duration: 260 })
    return bang
  }

  /* ── toolbar and sheets ── */
  function renderTools() {
    $('partyMinis').innerHTML = party.slice(0, 3).map((m) => `<img src="${ART[m.id]}" alt="">`).join('') + (party.length > 3 ? `<span style="font-size:10px">+${party.length - 3}</span>` : '')
    $('partyDot').style.display = party.some((m) => m.hp < m.stats.hp) ? 'block' : 'none'
    $('bagN').textContent = String(Object.values(bag).reduce((a, b) => a + b, 0))
    $('boxN').textContent = String(box.length)
  }
  function toolsEnabled(on) { document.querySelectorAll('.tool').forEach((t) => { t.disabled = !on; t.style.opacity = on ? '1' : '.45' }) }
  const hpCol = (p) => (p > 50 ? '#22c55e' : p > 20 ? '#eab308' : '#ef4444')
  /* ── sheets: party (list, stats), bag (list, choose a Pokémon), box ── */
  const HEALS = ['potion', 'super', 'revive']
  const ivTotal = (m) => STAT_KEYS.reduce((s, k) => s + m.ivs[k], 0)
  let toast = '', toastBad = false   // toastBad: a refusal, shown in amber rather than green

  /** One item on one Pokémon. Returns what happened, for the sheet to say. */
  function useItem(key, m) {
    if (!bag[key]) return `No ${ITEMS[key].name}s left.`
    if (ITEMS[key].cure) {
      if (!m.status) return `${m.name} has no status to cure.`
      if (!ITEMS[key].cure.includes(m.status)) return `A ${ITEMS[key].name} won't help: ${m.name} is ${STATUS_WORD[m.status]}.`
      bag[key]--; m.status = null; sfx('heal'); renderTools()
      return `${m.name} is cured!`
    }
    if (ITEMS[key].revive) {
      if (m.hp > 0) return `${m.name} hasn't fainted. Revives are for fainted Pokémon.`
      bag[key]--; m.hp = Math.ceil(m.stats.hp * ITEMS[key].revive); sfx('heal'); renderTools()
      return `${m.name} was revived with ${m.hp} HP!`
    }
    if (m.hp <= 0) return `${m.name} has fainted — a Potion can't help. Use a Revive.`
    if (m.hp >= m.stats.hp) return `${m.name} is already at full HP.`
    const from = m.hp
    bag[key]--; m.hp = Math.min(m.stats.hp, m.hp + Math.ceil(m.stats.hp * ITEMS[key].heal))
    sfx('heal'); renderTools()
    return `${m.name} recovered ${m.hp - from} HP.`
  }
  function hpBar(m) {
    const pct = m.hp / m.stats.hp * 100
    return `<div class="hp"><div><i style="width:${pct}%;background:${hpCol(pct)}"></i></div>${m.hp}/${m.stats.hp}</div>`
  }
  function itemButtons(m) {
    return HEALS.map((k) => {
      const rev = !!ITEMS[k].revive
      const why = !bag[k] ? 'none left' : rev ? (m.hp <= 0 ? `back at ${Math.round(ITEMS[k].revive * 100)}%` : 'not fainted') : m.hp <= 0 ? 'fainted' : m.hp >= m.stats.hp ? 'full HP' : `+${Math.ceil(m.stats.hp * ITEMS[k].heal)} HP`
      const off = !bag[k] || (rev ? m.hp > 0 : m.hp <= 0 || m.hp >= m.stats.hp)
      return `<button class="ibtn ${k}" data-use="${k}" ${off ? 'disabled' : ''}><b>${ITEMS[k].name} ×${bag[k] ?? 0}</b><span>${why}</span></button>`
    }).join('')
  }

  function partyList() {
    const hurt = party.some((m) => m.hp < m.stats.hp || m.status)
    const caseFor = (region, label) => { const gs = GYMS.filter((g) => g.region === region), got = gs.filter((g) => badges.includes(g.gym)).length
      return `<div class="badgecase"><b>${label} ${got}/${gs.length}</b><span>${gs.map((g) => `<img class="${badges.includes(g.gym) ? 'on' : ''}" src="${badgeArt(g.badge)}" alt="${g.badge} BADGE" title="${g.badge} BADGE (${g.short})">`).join('')}</span></div>` }
    const caseRow = caseFor('johto', 'JOHTO') + (champion ? caseFor('kanto', 'KANTO') : '')   // Kanto shows once it's unlocked
    return caseRow + `<button class="heal" data-heal ${freeHeal && hurt ? '' : 'disabled'}><span class="cross"></span><span>POKéMON CENTER<small>${freeHeal ? (hurt ? 'Heal the whole party, free — 1 left today' : 'Everyone is at full HP') : 'Free heal used today. Potions still work.'}</small></span></button>` +
      party.map((m, i) => `<div class="prow${m.hp <= 0 ? ' fainted' : ''}">
        <button class="pmain" data-stat="${i}" aria-label="${m.name}'s stats"><img src="${ART[m.id]}" alt=""><span class="mid">
          <span class="nm"><b>${i + 1}. ${m.name}${i === 0 ? '<span class="lead">LEAD</span>' : ''}${m.status ? `<span class="tags">${statusChip(m)}</span>` : ''}</b><span>Lv ${m.level}</span></span>
          ${hpBar(m)}<span class="sub">${m.nature[0]} · IV ${ivTotal(m)}/186 · tap for stats</span></span></button>
        <span class="ord">
          <button data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${m.name} up">▲</button>
          <button data-down="${i}" ${i === party.length - 1 ? 'disabled' : ''} aria-label="Move ${m.name} down">▼</button>
        </span></div>`).join('') +
      `<p class="note">Battle order: number 1 goes out first. Use ▲ ▼ to change it. HP carries over between battles.</p>`
  }
  function statPage(m) {
    const i = party.indexOf(m)
    const [nat, up, dn] = m.nature
    const rows = STAT_KEYS.map((k) => {
      const col = m.ivs[k] >= 30 ? '#eab308' : m.ivs[k] >= 21 ? '#22c55e' : m.ivs[k] >= 11 ? '#3b82f6' : '#94a3b8'
      const tag = up === k ? '<em class="up">▲</em>' : dn === k ? '<em class="dn">▼</em>' : ''
      return `<tr><td class="k">${STAT_LABEL[k]}${tag}</td><td class="v">${m.stats[k]}</td><td class="bar"><div><i style="width:${m.ivs[k] / 31 * 100}%;background:${col}"></i></div></td><td class="iv">${m.ivs[k]}/31</td></tr>`
    }).join('')
    return `<button class="back" data-back>◀ Party</button>
      <div class="svhead"><img src="${ART[m.id]}" alt=""><div>
        <div class="nm"><b>${m.name}</b> <span>Lv ${m.level}${i === 0 ? ' · LEAD' : ` · #${i + 1} in order`}</span></div>
        <div class="types">${m.types.map((t) => `<span style="background:${TYPE_COL[t]}">${t}</span>`).join('')}</div>
        ${hpBar(m)}</div></div>
      <div class="svnat"><b>${nat}</b> nature${up ? `: <em class="up">${STAT_LABEL[up]} +10%</em>, <em class="dn">${STAT_LABEL[dn]} −10%</em>` : ': no stat changes'} · IV total <b>${ivTotal(m)}</b>/186 · starts battles with <b>${startPP(m)} PP</b>${startPP(m) > 1 ? ' (quick nature)' : ''}</div>
      <div class="svexp"><span>EXP</span><div><i style="width:${(m.exp ?? 0) / expToNext(m.level) * 100}%"></i></div><b>${m.exp ?? 0}/${expToNext(m.level)}</b><small>to Lv ${m.level + 1}</small></div>
      <table class="svt"><tr><th></th><th>Stat</th><th>IV</th><th></th></tr>${rows}</table>
      ${evoText(m) ? `<p class="note">Evolves: ${evoText(m)}</p>` : ''}
      ${bondEvolves(m) ? `<div class="svbond"><span>♥ BOND</span><div><i style="width:${(m.bond ?? 0) / BOND_FULL * 100}%"></i></div><b>${m.bond ?? 0}/${BOND_FULL}</b><small>${(m.bond ?? 0) >= BOND_FULL ? 'full: it evolves at its next level-up' : 'grows as it battles with you'}</small></div>` : ''}
      <div class="svmoves"><div class="lbl">Moves <span>change them in the Box</span></div>${movesOf(m).map((n) => `<span style="background:${TYPE_COL[moveInfo(n).type]}">${n} · ${moveCost(n)} PP</span>`).join('')}</div>
      <div class="svitems"><div class="lbl">Use an item</div>${itemButtons(m)}</div>`
  }
  function bagList() {
    // Only what you actually have: an item at 0 drops out of the list.
    const held = Object.entries(ITEMS).filter(([k]) => k !== 'summon' && k !== 'elite' && bag[k] > 0)
    return (held.length ? '' : `<p class="note">Your Bag is empty.</p>`) + held.map(([k, it]) => {
      if (it.key) return `<div class="irow key"><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">KEY ITEM · always on: Pokémon that sit out a battle still get half its EXP</span></span></div>`
      if (it.summon === 'elite') {
        const L = ELITE[eliteStep], ok = badges.length >= 8 && !champion
        return `<button class="irow" data-item="${k}"${ok ? '' : ' disabled'}><img class="ic face" src="${ART[L.face]}" alt=""><span class="mid"><b>${it.name}</b><span class="sub">${champion ? "you're already Champion" : !ok ? 'needs all 8 Johto badges' : `next: ${L.short} (${eliteStep + 1} of 5) · tap`}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>`
      }
      if (it.summon != null) {
        const n = it.summon, L = GYMS[n], done = badges.includes(n), ready = n === nextGym() && (n < 8 || champion)
        const sub = done ? `you already have the ${L.badge} BADGE` : ready ? `challenge ${L.short} of ${L.city} · tap` : n === 8 && !champion ? 'become Champion first' : `beat ${GYMS[n - 1].short} first`
        return `<button class="irow" data-item="${k}"${ready ? '' : ' disabled'}><img class="ic face" src="${ART[L.face]}" alt=""><span class="mid"><b>${it.name}</b><span class="sub">${sub}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>`
      }
      if (it.disc) { const n = party.filter((m) => canLearnDisc(m, it.disc) && !learn(m).learned.includes(it.disc)).length
        return `<button class="irow" data-item="${k}"${n ? '' : ' disabled'}><span class="ic disc"></span><span class="mid"><b>${it.name}</b><span class="sub">MOVE DISC · ${n ? `${n} of your party can learn it · tap to use` : 'nobody in your party can learn it'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      if (it.evo || it.held) { const n = it.evo ? party.filter((m) => evoByItem(m, k, bag).rule).length : 0
        return `<button class="irow" data-item="${k}"${n ? '' : ' disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${it.held ? it.sub : n ? `${n === 1 ? '1 Pokémon' : `${n} Pokémon`} can evolve with it · tap to use` : `${it.sub} · nobody in your party can use it`}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      if (it.cure) { const n = party.filter((m) => m.status && it.cure.includes(m.status)).length
        return `<button class="irow" data-item="${k}"${n && bag[k] ? '' : ' disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${it.sub} · ${n ? `${n === 1 ? '1 Pokémon needs' : `${n} Pokémon need`} it · tap to use` : 'nobody needs it right now'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      const usable = HEALS.includes(k)
      return `<button class="irow" data-item="${k}" ${usable && bag[k] ? '' : 'disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${usable ? it.sub + ' · tap to use' : 'throw these in wild battles'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>`
    }).join('') + `<p class="note">Balls, potions, revives and bundles are bought from the VVM, alongside the packs; a bundle's items land here separately. Beaten trainers drop Move Discs too.</p>`
  }
  /** A summon's challenge page: who, how many, how strong; then the button. */
  function summonPage(k) {
    const n = ITEMS[k].summon, L = GYMS[n], ace = Math.min(LEVEL_CAP, leaderLevels(L, party.map((m) => m.level)).at(-1) + (L.lvAdj ?? 0))
    return `<button class="back" data-back>◀ Bag</button>
      <div class="gymcard" style="--c:${L.color}"><img src="${ART[L.face]}" alt=""><div>
        <b>${L.full}</b><span>${L.city} GYM · ${L.type.toUpperCase()} TYPE</span>
        <span>${L.team.length} Pokémon · their ace around Lv ${ace} · uses a Full Restore</span></div></div>
      <p class="note">${L.region === 'kanto' ? 'Kanto' : 'Johto'} gym ${(n % 8) + 1} of 8. Win and you get the ${L.badge} BADGE and ${L.tokens} tokens. The summon is used up when ${L.short} arrives, win or lose.</p>
      <div class="lbl">Your party</div>
      <div class="mvchips" style="margin-bottom:10px">${party.map((m) => `<i style="background:${TYPE_COL[m.types[0]]}">${m.name} Lv ${m.level}</i>`).join('')}</div>
      <button class="challenge" data-challenge="${n}" style="--c:${L.color}">SUMMON ${L.short}</button>`
  }
  /** The Elite Four ticket's page: the ladder, where you are on it, and the button for the next battle. */
  function elitePage(k) {
    const L = ELITE[eliteStep]
    return `<button class="back" data-back>◀ Bag</button>
      <div class="ladder">${ELITE.map((E, i) => `<span class="${i < eliteStep ? 'done' : i === eliteStep ? 'next' : ''}"><img src="${ART[E.face]}" alt=""><b>${E.short}</b><i>${i < eliteStep ? 'BEATEN' : i === eliteStep ? 'NEXT' : E.role === 'CHAMPION' ? 'CHAMPION' : `#${i + 1}`}</i></span>`).join('')}</div>
      <div class="gymcard" style="--c:${L.color}"><img src="${ART[L.face]}" alt=""><div>
        <b>${L.full}</b><span>${L.type.toUpperCase()} TYPE · battle ${eliteStep + 1} of 5</span>
        <span>${L.team.length} Pokémon · their ace around Lv ${Math.min(LEVEL_CAP, leaderLevels(L, party.map((m) => m.level)).at(-1) + (L.lvAdj ?? 0))} · pays ${L.tokens} tokens</span></div></div>
      <p class="note">One ticket covers all five battles. Take as long as you like between them: heal up, buy supplies, then come back here. Win and the ticket stays for the next battle; lose and it's gone, and the next ticket starts again from WILL. Beat LANCE and you're Champion.</p>
      <div class="lbl">Your party</div>
      <div class="mvchips" style="margin-bottom:10px">${party.map((m) => `<i style="background:${TYPE_COL[m.types[0]]}">${m.name} Lv ${m.level} · ${m.hp}/${m.stats.hp}</i>`).join('')}</div>
      <button class="challenge" data-elite="" style="--c:${L.color}">CHALLENGE ${L.short}</button>`
  }
  function bagTarget(k) {
    if (ITEMS[k].evo) return `<button class="back" data-back>◀ Bag</button><p class="note" style="margin:0 2px 8px"><b>${ITEMS[k].name}</b> ×${bag[k]} — use it on which Pokémon?</p>` +
      party.map((m, i) => { const r = evoByItem(m, k, bag)
        return `<button class="prow tgt${r.rule ? '' : ' cant'}" data-target="${i}" ${r.rule ? '' : 'disabled'}><img src="${ART[m.id]}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${r.rule ? `evolves into ${r.rule.to}` : r.why}</span></span>${hpBar(m)}</span></button>` }).join('')
    if (ITEMS[k].disc) return `<button class="back" data-back>◀ Bag</button><p class="note" style="margin:0 2px 8px">MOVE DISC <b>${ITEMS[k].disc}</b> — teach it to which Pokémon?</p>` +
      party.map((m, i) => { const knows = learn(m).learned.includes(ITEMS[k].disc), can = canLearnDisc(m, ITEMS[k].disc)
        return `<button class="prow tgt${can ? '' : ' cant'}" data-target="${i}" ${knows || !can ? 'disabled' : ''}><img src="${ART[m.id]}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${!can ? "can't learn this" : knows ? 'already knows it' : `Lv ${m.level} · can learn`}</span></span><span class="mvchips">${movesOf(m).map((n) => `<i style="background:${TYPE_COL[moveInfo(n).type]}">${n}</i>`).join('')}</span></span></button>` }).join('')
    return `<button class="back" data-back>◀ Bag</button><p class="note" style="margin:0 2px 8px"><b>${ITEMS[k].name}</b> ×${bag[k]} — use on which Pokémon?</p>` +
      party.map((m, i) => {
        const rev = !!ITEMS[k].revive, cure = ITEMS[k].cure
        const off = !bag[k] || (cure ? !(m.status && cure.includes(m.status)) : rev ? m.hp > 0 : m.hp <= 0 || m.hp >= m.stats.hp)
        const what = cure ? (m.status ? (cure.includes(m.status) ? `${STATUS_WORD[m.status]} · cure it` : `${STATUS_WORD[m.status]} · won't help`) : 'no status') : rev ? (m.hp <= 0 ? `fainted · revive to ${Math.ceil(m.stats.hp * ITEMS[k].revive)} HP` : 'not fainted') : m.hp <= 0 ? 'fainted' : m.hp >= m.stats.hp ? 'full HP' : `+${Math.ceil(m.stats.hp * ITEMS[k].heal)} HP`
        return `<button class="prow tgt" data-target="${i}" ${off ? 'disabled' : ''}><img src="${ART[m.id]}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${what}</span></span>${hpBar(m)}</span></button>`
      }).join('')
  }
  const everyone = () => [...party, ...box]
  function boxBody() {
    const row = (m, i, where) => `<button class="prow pmain boxmon" data-mon="${i}"><img src="${ART[m.id]}" alt=""><span class="mid">
        <span class="nm"><b>${m.name}</b><span>Lv ${m.level} · ${where}</span></span>
        <span class="mvchips">${movesOf(m).map((n) => `<i style="background:${TYPE_COL[moveInfo(n).type]}">${n}</i>`).join('')}</span></span><span class="go">›</span></button>`
    return `<p class="note" style="margin:0 2px 8px">Tap a Pokémon to choose its four moves.</p>` +
      everyone().map((m, i) => row(m, i, i < party.length ? 'party' : 'box')).join('') +
      `<p class="note">Your party holds six. Catches after that land in the Box, and you can swap them in and out between battles.</p>`
  }
  function moveCard(n, attrs, extra = '') {
    const m = moveInfo(n)
    const detail = m.kind === 'support' ? `${m.sub} · ${m.solo ? 'works in 1v1 too' : '2v2 only'}` : `${m.cat === 'spec' ? 'SPECIAL' : 'PHYSICAL'} · ${m.power} power${m.hits ? ` × ${m.hits} hits` : ''}${m.spread ? (m.spread === 'all' ? ' · hits everyone else' : ' · both foes') : ''}${m.prio ? ' · goes first' : ''}`
    return `<button class="mvcard${extra}" ${attrs}><span class="ty" style="background:${TYPE_COL[m.type]}">${m.type}</span><b>${n}</b><span class="pp${m.cost ? '' : ' free'}">${m.cost} PP</span><small>${detail}</small></button>`
  }
  function movesPage(m, slot, backTo = 'Box') {
    learn(m)
    const spare = m.learned.filter((n) => !m.moves.includes(n))
    return `<button class="back" data-back>◀ ${backTo}</button>
      <div class="svhead"><img src="${ART[m.id]}" alt=""><div><div class="nm"><b>${m.name}</b> <span>Lv ${m.level}</span></div>
        <div class="types">${m.types.map((t) => `<span style="background:${TYPE_COL[t]}">${t}</span>`).join('')}</div></div></div>
      <div class="lbl">Equipped · ${m.moves.length}/${MAX_MOVES} <span>${slot == null ? 'tap one to swap it out' : 'now tap a learned move below'}</span></div>
      <div class="mvgrid">${m.moves.map((n, i) => moveCard(n, `data-slot="${i}"`, i === slot ? ' sel' : '')).join('')}</div>
      <div class="lbl">Learned <span>${spare.length} more</span></div>
      <div class="mvlist">${spare.map((n) => moveCard(n, `data-learn="${n}"`, slot == null ? ' dim' : '')).join('') || '<p class="note">Everything it knows is equipped.</p>'}</div>
      ${upcoming(m).length ? `<div class="lbl">Learns later <span>by leveling up</span></div><div class="later">${upcoming(m).map(([lv, n]) => `<span><b>Lv ${lv}</b> ${n}</span>`).join('')}</div>` : ''}
      <p class="note">Swap any time outside battle. Keep at least one 0 PP attack (TACKLE, SCRATCH, QUICK ATTACK…) so it always has something to hit with. HOWL, GROWTH and LIFE DEW work in 1v1 too; the rest of the support moves need a 2v2.</p>`
  }

  /**
   * Admin: battle supplies for the machine. Mirrors the app's admin "Machine
   * Items" page, where it would live beside the packs; here it's a Play-mode
   * panel and never appears in the demos. Edits apply from the next stocked tap.
   */
  function openAdmin() {
    $('sheetTitle').textContent = 'Admin · Machine items'
    const card = (k) => {
      const s = SHOP[k]
      return `<div class="adm${s.on ? '' : ' off'}">
        <div class="admhead"><span class="ic ${k}"></span><b>${ITEMS[k].name}</b>
          <label class="admsw"><input type="checkbox" data-shop="${k}:on"${s.on ? ' checked' : ''}><span>In the machine</span></label></div>
        <div class="admrow"><span>Price</span><span class="pin"><input type="number" min="0" step="0.05" value="${s.price.toFixed(2)}" data-shop="${k}:price"> tokens</span></div>
        <div class="admrow"><span>Appearance rate</span><b id="rate-${k}">${s.rate}%</b></div>
        <input type="range" min="0" max="100" step="5" value="${s.rate}" data-shop="${k}:rate" aria-label="${ITEMS[k].name} appearance rate">
      </div>`
    }
    // Bundles: a name, any mix of supplies, a price, a rate.
    const bcard = (b, i) => `<div class="adm bundle${b.on ? '' : ' off'}">
        <div class="admhead"><span class="ic bundle"></span><input class="bname" value="${esc(b.name)}" maxlength="24" data-bundle="${i}:name" aria-label="Bundle name">
          <label class="admsw"><input type="checkbox" data-bundle="${i}:on"${b.on ? ' checked' : ''}><span>In the machine</span></label></div>
        <div class="bitems">${BUNDLE_ITEMS.map((k) => `<label><span class="ic ${k}"></span><span>${ITEMS[k].name}</span><input type="number" min="0" max="20" step="1" value="${b.items[k] ?? 0}" data-bundle="${i}:item:${k}"></label>`).join('')}</div>
        <div class="admrow"><span>Price <small id="bworth-${i}">(${bundleWorth(b).toFixed(2)} tk bought separately)</small></span><span class="pin"><input type="number" min="0" step="0.05" value="${b.price.toFixed(2)}" data-bundle="${i}:price"> tokens</span></div>
        <div class="admrow"><span>Appearance rate</span><b id="brate-${i}">${b.rate}%</b></div>
        <input type="range" min="0" max="100" step="5" value="${b.rate}" data-bundle="${i}:rate" aria-label="${esc(b.name)} appearance rate">
        <button class="bdel" data-delbundle="${i}">Remove bundle</button>
      </div>`
    // Redrawn in place when bundles are added, removed or reset (reopening would leave the first open waiting forever).
    const draw = () => $('sheetBody').innerHTML = `<p class="note" style="margin:0 2px 10px">Battle supplies the machine can stock beside the packs. <b>Appearance rate</b> is the chance an item is on the shelf when the machine is stocked. Changes apply from the next stocked tap.</p>` +
      Object.keys(SHOP).map(card).join('') +
      `<h3 class="admh">Bundles</h3><p class="note" style="margin:0 2px 8px">Several supplies sold together at one price. Bought, the items go into the Bag separately.</p>` +
      BUNDLES.map(bcard).join('') + `<button class="back" data-addbundle>+ New bundle</button>` +
      `<button class="back" data-reset style="margin-top:6px">Reset to defaults</button>`
    draw()
    $('sheetBody').oninput = (e) => {
      const bl = e.target.closest('[data-bundle]')
      if (bl) {
        const [i, f, k] = bl.dataset.bundle.split(':'), b = BUNDLES[+i]
        if (f === 'name') b.name = bl.value.toUpperCase().slice(0, 24) || 'BUNDLE'
        if (f === 'on') { b.on = bl.checked; bl.closest('.adm').classList.toggle('off', !bl.checked) }
        if (f === 'price') { const v = Math.round(+bl.value * 100) / 100; if (Number.isFinite(v) && v >= 0) b.price = v }
        if (f === 'rate') { b.rate = +bl.value; $('brate-' + i).textContent = bl.value + '%' }
        if (f === 'item') { const n = Math.max(0, Math.min(20, Math.round(+bl.value) || 0)); b.items[k] = n; $('bworth-' + i).textContent = `(${bundleWorth(b).toFixed(2)} tk bought separately)` }
        saveBundles(); return
      }
      const el = e.target.closest('[data-shop]'); if (!el) return
      const [k, f] = el.dataset.shop.split(':')
      if (f === 'on') { SHOP[k].on = el.checked; el.closest('.adm').classList.toggle('off', !el.checked) }
      if (f === 'price') { const v = Math.round(+el.value * 100) / 100; if (Number.isFinite(v) && v >= 0) SHOP[k].price = v }
      if (f === 'rate') { SHOP[k].rate = +el.value; $('rate-' + k).textContent = el.value + '%' }
      saveShop()
    }
    $('sheetBody').onclick = (e) => {
      if (e.target.closest('[data-reset]')) { for (const k in SHOP) Object.assign(SHOP[k], SHOP_DEFAULT[k]); BUNDLES.splice(0, BUNDLES.length, ...structuredClone(BUNDLES_DEFAULT)); saveShop(); saveBundles(); draw() }
      if (e.target.closest('[data-addbundle]')) { BUNDLES.push({ id: 'b' + Date.now().toString(36), name: 'NEW BUNDLE', items: { potion: 2 }, price: 0.45, rate: 20, on: true }); saveBundles(); draw() }
      const del = e.target.closest('[data-delbundle]'); if (del) { BUNDLES.splice(+del.dataset.delbundle, 1); saveBundles(); draw() }
    }
    $('sheet').classList.add('open')
    return new Promise((res) => { sheetCloser = () => { closeSheetNow(); $('sheetBody').oninput = null; $('sheetBody').onclick = null; res() } })
  }

  /**
   * Opens a sheet. Every action goes through do_(), so a tap in play and a
   * step in the demo run exactly the same code.
   */
  function openSheet(kind) {
    let view = { page: 'list' }
    const title = () => kind === 'party' ? (view.page === 'stats' ? 'Stats' : `Party · ${party.length}/6`) : kind === 'bag' ? (view.page === 'target' ? 'Use item' : view.page === 'moves' ? 'Moves' : view.page === 'summon' ? 'Gym challenge' : view.page === 'elite' ? 'Elite Four' : 'Bag') : view.page === 'moves' ? 'Moves' : `Box · ${everyone().length}`
    const draw = () => {
      $('sheetTitle').textContent = title()
      const body = kind === 'party' ? (view.page === 'stats' ? statPage(view.mon) : partyList())
        : kind === 'bag' ? (view.page === 'target' ? bagTarget(view.item) : view.page === 'summon' ? summonPage(view.item) : view.page === 'elite' ? elitePage(view.item) : view.page === 'moves' ? movesPage(view.mon, view.slot, 'Bag') : bagList()) : view.page === 'moves' ? movesPage(view.mon, view.slot) : boxBody()
      $('sheetBody').innerHTML = (toast ? `<div class="toast${toastBad ? ' bad' : ''}">${toast}</div>` : '') + body
    }
    const do_ = (a) => {
      toast = ''; toastBad = false
      if (a.heal != null && freeHeal) { freeHeal--; party.forEach((m) => { m.hp = m.stats.hp; m.status = null }); sfx('heal'); toast = 'Your party is fully healed, and any status is cured!' }
      if (a.stat != null) { view = { page: 'stats', mon: party[a.stat] }; sfx('select') }
      if (a.back != null) { view = { page: 'list' }; sfx('move') }
      if (a.up != null && a.up > 0) { [party[a.up - 1], party[a.up]] = [party[a.up], party[a.up - 1]]; sfx('move') }
      if (a.down != null && a.down < party.length - 1) { [party[a.down + 1], party[a.down]] = [party[a.down], party[a.down + 1]]; sfx('move') }
      if (a.use != null) toast = useItem(a.use, view.mon)
      if (a.item != null) { const s = ITEMS[a.item].summon; view = { page: s === 'elite' ? 'elite' : s != null ? 'summon' : 'target', item: a.item }; sfx('select') }
      // The Elite Four ticket isn't spent here: only a loss, or beating Lance, uses it up.
      if (a.elite != null) { pendingSummon = 'elite'; sfx('select'); sheetCloser?.(); return }
      // Summon: spend it, close the sheet, and the leader turns up.
      if (a.challenge != null) { bag[summonKey(a.challenge)]--; pendingSummon = a.challenge; renderTools(); sfx('select'); sheetCloser?.(); return }
      if (a.target != null && ITEMS[view.item].disc) {
        // A Move Disc: learned now, equipped if there's room, otherwise straight to the move editor.
        const m = party[a.target], n = ITEMS[view.item].disc, r = teach(m, n, true)
        if (r.cant || r.already) { toast = r.cant ? `${m.name} can't learn ${n}.` : `${m.name} already knows ${n}.`; toastBad = true; draw(); return }
        bag[view.item]--; sfx('levelup')
        toast = r.equipped ? `${m.name} learned ${n}! It's equipped.` : `${m.name} learned ${n}! Tap an equipped move to swap it in, or leave it in Learned.`
        view = { page: 'moves', mon: m, slot: null }
      } else if (a.target != null && ITEMS[view.item].evo) {
        // An evolution item: the sheet closes and the evolution plays (the item is spent only if it isn't stopped).
        const m = party[a.target], r = evoByItem(m, view.item, bag)
        if (!r.rule) { toast = `It won't work: ${r.why}.`; toastBad = true; draw(); return }
        m.evoForce = r.rule; pendingEvos.add(m); pendingEvoItem = true; sfx('select'); sheetCloser?.(); return
      } else if (a.target != null) { toast = useItem(view.item, party[a.target]); if (!bag[view.item]) view = { page: 'list' } }
      // Box: pick a Pokémon, pick an equipped slot, pick a learned move to put there.
      if (a.mon != null) { view = { page: 'moves', mon: everyone()[a.mon], slot: null }; sfx('select') }
      if (a.slot != null) { view.slot = view.slot === a.slot ? null : a.slot; sfx('move') }
      if (a.learn != null) {
        if (view.slot == null) { toast = 'First tap the equipped move to swap out.'; toastBad = true }
        else { const was = view.mon.moves[view.slot], err = equip(view.mon, view.slot, a.learn); if (err) { toast = err; toastBad = true; sfx('blocked') } else { toast = `${view.mon.name} swapped ${was} for ${a.learn}.`; view.slot = null; sfx('select') } }
      }
      draw(); renderTools()
    }
    toast = ''; draw(); $('sheet').classList.add('open')
    anim($('sheet').firstElementChild, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220 })
    const KEYS_ = ['heal', 'stat', 'back', 'up', 'down', 'use', 'item', 'target', 'mon', 'slot', 'learn', 'challenge', 'elite']
    const read = (el) => { for (const k of KEYS_) if (el.hasAttribute('data-' + k)) { const v = el.getAttribute('data-' + k); return { [k]: v === '' ? true : isNaN(+v) ? v : +v } } return null }
    $('sheetBody').onclick = (e) => {
      if (MODE !== 'play') return
      const el = e.target.closest('button'); if (!el || el.disabled) return
      const a = read(el); if (a) do_(a)
    }
    return {
      /** Demo: press the button matching a selector, visibly, as a tap would. */
      async tap(sel, wait = 1100) {
        const el = $('sheetBody').querySelector(sel)
        // Light it first: acting re-renders the sheet and would replace it.
        if (el) { el.classList.add('hot'); await W(260); do_(read(el)) }
        await W(wait)
      },
      closed: new Promise((res) => { sheetCloser = () => { closeSheetNow(); res() } }),
    }
  }

  /* ══════════ attack visuals, shared by 1v1 and 2v2 ══════════ */
  /**
   * One hit of one of your moves, from A to T (centres). `el` is the
   * attacker's sprite. Later hits of a multi-hit move run quicker.
   */
  async function strikeFx(mv, A, T, el, quick = false) {
    const dx = T.x - A.x, dy = T.y - A.y, sp = quick ? 0.6 : 1
    const shot = (css, n, gap, dur, spin = 0) => {
      for (let i = 0; i < n; i++) {
        const s = document.createElement('div'); s.style.cssText = `position:absolute;left:${A.x - 6}px;top:${A.y - 26}px;` + css; fx.appendChild(s)
        anim(s, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx + (i - (n - 1) / 2) * 8}px,${dy + 26}px) rotate(${spin}deg)` }], { duration: dur * sp, delay: i * gap * sp, easing: 'ease-in' })
        setTimeout(() => s.remove(), (dur + i * gap) * sp + 60)
      }
      return W((dur + (n - 1) * gap) * sp + 40)
    }
    if (mv.fx === 'ember') return shot('width:12px;height:12px;border-radius:50% 50% 50% 0;background:radial-gradient(#fff7ae,#fb923c 60%,#c2410c)', 5, 50, 380, 45)
    if (mv.fx === 'water') return shot('width:10px;height:10px;border-radius:50%;background:#93c5fd;box-shadow:0 0 6px #3b82f6', 6, 40, 340)
    if (mv.fx === 'seed') return shot('width:9px;height:11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bbf7d0,#16a34a 60%,#14532d)', 2, 50, 300)
    if (mv.fx === 'shuriken') return shot('width:16px;height:16px;background:#bfdbfe;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 4px #3b82f6)', 1, 0, 300, 720)
    if (mv.fx === 'rock') return shot('width:14px;height:12px;border-radius:40% 55% 45% 50%;background:linear-gradient(#d6c08a,#8b6d3a)', 1, 0, 320, 300)
    if (mv.fx === 'icicle') return shot('width:7px;height:18px;clip-path:polygon(50% 100%,0 0,100% 0);background:linear-gradient(#e0f2fe,#38bdf8)', 1, 0, 280)
    if (mv.fx === 'needle') return shot('width:4px;height:16px;background:linear-gradient(#f5f5f4,#a3a3a3)', 1, 0, 260, 60)
    if (mv.fx === 'spray') { const c = TYPE_COL[mv.type] ?? '#e2e8f0'; return shot(`width:11px;height:11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,${c} 60%);box-shadow:0 0 6px ${c}`, 4, 45, 340) }
    if (mv.fx === 'quake') {
      // A shockwave along the ground; nobody leaves their spot.
      const w = document.createElement('div'); w.className = 'groundwave'; w.style.left = (A.x - 30) + 'px'; w.style.top = (A.y + 30) + 'px'; fx.appendChild(w)
      anim(w, [{ transform: 'translate(0,0) scale(.5,.7)' }, { transform: `translate(${dx}px,${dy}px) scale(1.6,1.1)`, opacity: .95, offset: .9 }, { opacity: 0 }], { duration: 420 * sp, easing: 'ease-in' })
      setTimeout(() => w.remove(), 460 * sp); return W(420 * sp)
    }
    // Contact: the attacker lunges most of the way, then springs back.
    anim(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 0.78}px,${dy * 0.78}px)`, offset: .5 }, { transform: 'translate(0,0)' }], { duration: 380 * sp })
    await W(200 * sp)
    if (mv.fx === 'slash') {
      const s = document.createElement('div'); s.style.cssText = `position:absolute;left:${T.x - 34}px;top:${T.y - 34}px;width:68px;height:68px;border-radius:50%;border:5px solid transparent;border-top-color:#f8fafc;border-right-color:#f8fafc`
      fx.appendChild(s); anim(s, [{ transform: `rotate(${quick ? 50 : -40}deg)`, opacity: 1 }, { transform: `rotate(${quick ? 230 : 140}deg)`, opacity: 0 }], { duration: 300 }); setTimeout(() => s.remove(), 320)
    }
  }
  /** One ball per Pokémon: red while it can fight, grey once fainted, glowing for the one out now. */
  function drawBalls(el, team, out = []) {
    const html = team.map((m) => `<i class="${m.hp <= 0 ? 'down' : out.includes(m) ? 'cur' : ''}"></i>`).join('')
    if (el.__html !== html) { el.innerHTML = html; el.__html = html }
  }
  /**
   * Keeps both rows up to date for as long as `alive()` says the battle's
   * on screen: every quarter second it redraws from the teams' current HP,
   * so faints, switches and send-outs all show without each one having to.
   */
  function watchBalls(eEl, pEl, sides, alive) {
    const tick = () => {
      if (!live() || !alive()) { eEl.hidden = pEl.hidden = true; return }
      const s = sides(); eEl.hidden = !s.enemy; pEl.hidden = false
      if (s.enemy) drawBalls(eEl, s.enemy, s.enemyOut)
      drawBalls(pEl, s.mine, s.mineOut)
      setTimeout(tick, 250)
    }
    tick()
  }
  const ACC_CLS = { PERFECT: 'gold', GREAT: 'green', GOOD: 'blue', OK: 'small', MISS: 'red small' }
  /** Little rising sparks (heals) or arrows (stat boosts) from a Pokémon at `c`. */
  function rise(c, color, kind) {
    for (let i = 0; i < (kind === 'arrow' ? 3 : 8); i++) {
      const d = document.createElement('div')
      if (kind === 'arrow') { d.className = 'uparrow'; d.style.left = (c.x - 24 + i * 18) + 'px'; d.style.top = (c.y + 10) + 'px' }
      else d.style.cssText = `position:absolute;left:${c.x - 30 + (i * 37) % 60}px;top:${c.y + 20}px;width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}`
      fx.appendChild(d); anim(d, [{ transform: 'translateY(0)', opacity: kind === 'arrow' ? 0 : 1 }, { opacity: 1, offset: .3 }, { transform: 'translateY(-64px)', opacity: 0 }], { duration: 700, delay: i * (kind === 'arrow' ? 90 : 50) })
      setTimeout(() => d.remove(), 900 + i * 90)
    }
  }
  /**
   * Your trainer level. The full app would track it on its own; here your
   * best Pokémon's level stands in for it.
   */
  const trainerLevel = () => Math.max(1, ...party.map((m) => m.level))
  /**
   * A scalper's Pokémon for one battle, drawn from their pool: only ones they
   * can have at your trainer level, at about your level. How many they carry
   * grows with you: 1 below Lv 10, 1-2 from Lv 10, 2-3 from Lv 20. `force`
   * names them outright (the demos).
   */
  /*
   * Opponent levels, set around your lead Pokémon (the first one in your party
   * that can fight), so your strongest doesn't make every fight hard for the
   * rest. Herb and Paul: 1 below to 1 above. Everyone else (the everyday
   * trainers, Brian): 2 to 3 below. A trainer's ace, their last Pokémon, is one
   * above the rest. Gym leaders, the Elite Four and Lance set their own (above
   * you on purpose). Aim: you win about 3 trainer battles in 4.
   */
  const leadLevel = () => (party.find((m) => m.hp > 0) ?? party[0])?.level ?? 5
  // Balanced from Lv 10 (sim.mjs): Herb and Paul at your level to 2 above, everyone else 1 below to even; gentler before that.
  const levelBand = (T, lv = leadLevel()) => (T === HERB || T === PAUL ? (lv < 10 ? [-1, 1] : [0, 2]) : (lv < 10 ? [-3, -2] : [-1, 0]))
  /**
   * A wild Pokémon's level: up to 3 below your lead, never above the level
   * its species evolves at (an unevolved Pokémon past that wouldn't be one).
   */
  function wildLevel(species) {
    // Not capped at the species' evolution level any more: one caught above it evolves at its next level-up.
    return Math.max(2, Math.min(LEVEL_CAP, leadLevel() - 3 + Math.floor(Math.random() * 4)))
  }
  function deckFor(T, lv, force) {
    const tl = trainerLevel()
    const names = force ?? (() => {
      const size = rand() < 0.5 ? 2 : 3   // every trainer brings two or three
      // What your level has unlocked from their pool, topped up with the next in line when that's fewer than they bring.
      const pool = [...POOLS[T.short]].sort((a, b) => a.min - b.min), out = []
      const avail = pool.filter((p) => p.min <= tl).map((p) => p.name)
      for (const p of pool) if (avail.length < size && !avail.includes(p.name)) avail.push(p.name)
      while (out.length < Math.min(size, avail.length)) { const n = avail[Math.floor(rand() * avail.length)]; if (!out.includes(n)) out.push(n) }
      return out
    })()
    // Levels from the band for this kind of trainer, around `lv` (your lead); their ace, last, one above the rest.
    const [lo, hi] = levelBand(T, lv), base = lv + lo + Math.floor(rand() * (hi - lo + 1))
    return names.map((n, i) => individual(DATA.trainer.find((t) => t.name === n), Math.max(2, Math.min(LEVEL_CAP, base + (i === names.length - 1 && names.length > 1 ? 1 : 0))), rand))
  }
  /** A partner's timing ring, tapped by them: usually GREAT, sometimes PERFECT, now and then GOOD. */
  async function autoTap(cx, cy, label, approach = 820) {
    const rg = ring(cx, cy, approach, label), q = flavor(), dt = q < 0.35 ? 20 : q < 0.85 ? 90 : 180
    await W(approach - dt)
    const acc = accuracy(dt)
    rg.el.getAnimations().forEach((a) => a.pause()); rg.el.style.borderColor = acc.color
    await W(dt + 240); rg.clear()
    return acc
  }
  /** Scalpers turning up at the machine: one or two of them, then BLOCKED! Returns the second figure (to remove later). */
  async function campOut(crew) {
    $('homeLoiterer').src = ART[crew[0].body]; $('homeLoiterer').style.display = 'block'
    anim($('homeLoiterer'), [{ transform: 'translateX(220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' })
    let second = null
    if (crew[1]) {
      second = $('homeLoiterer').cloneNode(); second.id = 'homeLoiterer2'; second.src = ART[crew[1].body]; second.classList.add('second'); $('homeLoiterer').after(second)
      anim(second, [{ transform: 'translateX(-220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 120, fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)' })
    }
    await W(700)
    $('home').classList.add('blocked')
    $('homeLine').textContent = 'BLOCKED!'; $('homeSub').textContent = crew[1] ? `${crew[0].short} and ${crew[1].short} are camping the machine` : `${crew[0].short} is camping the machine`
    sfx('blocked'); const b = bangOn($('home'), 214, 92); await W(700); b.remove()
    return second
  }
  /** The VS splash for a 2v2: the tag team's split portrait, or one scalper's. */
  function vsSplash(crew, onField) {
    const vs = $('vs'); vs.style.display = 'block'
    if (crew[1]) {
      $('vsImg').src = ART[crew[1].vs]; $('vsName').textContent = `${crew[0].short} & ${crew[1].short}`; vs.classList.add('duo')   // whoever the pair is
      const two = $('vsImg').parentElement.cloneNode(true); two.classList.add('who2'); two.querySelector('img').removeAttribute('id'); two.querySelector('img').src = ART[crew[0].vs]; $('vsImg').parentElement.before(two)
      vs.querySelector('.name span').textContent = 'TAG TEAM · 2 VS 2'
      anim(two, [{ transform: 'translateX(-260px)' }, { transform: 'none' }], { duration: 420, delay: 520, fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)' })
    } else {
      $('vsImg').src = ART[crew[0].vs]; $('vsName').textContent = crew[0].full
      vs.querySelector('.name span').textContent = `${crew[0].easy ? 'RESELLER · ' : ''}DOUBLE BATTLE · ${onField} VS 2`
    }
    vsIn(vs)
  }
  /** The same splash in blue for someone on your side, with ALLY where VS goes. */
  function allySplash(T, sub) {
    const vs = $('vs'); vs.classList.add('ally'); vs.style.display = 'block'
    $('vsImg').src = ART[T.vs]; $('vsName').textContent = T.full; vs.querySelector('.name span').textContent = sub; vs.querySelector('.big').textContent = 'ALLY'
    vsIn(vs)
  }
  function vsHide() {
    const vs = $('vs'); vs.style.display = 'none'; vs.getAnimations({ subtree: true }).forEach((a) => a.cancel())
    vs.querySelector('.who2')?.remove(); vs.querySelector('.name span').textContent = 'SCALPER'; vs.querySelector('.big').textContent = 'VS'
    vs.classList.remove('duo', 'ally', 'gym')
  }
  /** "HERB sent out GHOLDENGO!", or, for Brian, what he thinks it's called. */
  const sentOut = (T, mon) => T.calls?.[mon.name] ? [`${T.short} sent out "${T.calls[mon.name]}"!`, `(It's ${mon.name}.)`] : [`${T.short} sent out`, `${mon.name}!`]
  /** A wasted turn from a scalper who doesn't know what they're doing: true if it happened. */
  async function blunder(T, mon) {
    if (!T?.blunder || flavor() >= T.blunder) return false
    await blunderLine(T, mon)
    return true
  }
  async function blunderLine(T, mon) {
    const [a, b] = pickOf(T.blunders).map((x) => x.replaceAll('{mon}', mon.name))
    sfx('blocked'); await say(a, b, READ_MS)
  }
  /**
   * What a beaten scalper leaves behind. The tokens are paid by the caller and
   * always come; these are only sometimes there: a Potion (or a Super Potion)
   * about a third of the time, a Move Disc about one time in five.
   */
  async function loot(T) {
    const got = []
    if (flavor() < 0.35) { const k = flavor() < 0.25 ? 'super' : 'potion'; bag[k]++; got.push(`a ${ITEMS[k].name}`) }
    if (flavor() < 0.2) { const n = pickOf(DISC_POOL); discItem(n); bag[discKey(n)] = (bag[discKey(n)] ?? 0) + 1; got.push(`a MOVE DISC (${n})`) }
    // Now and then, an evolution item.
    if (flavor() < 0.08) { const k = pickOf(['thunderstone', 'waterstone', 'firestone', 'leafstone', 'icestone', 'linkcable', 'dragonscale']); bag[k] = (bag[k] ?? 0) + 1; got.push(`a ${ITEMS[k].name}`) }
    renderTools()
    if (got.length) { sfx('click'); await say(`${T.short} dropped`, `${got.join(' and ')}!`, 700) }
  }
  /** How long a foe's move name stays up before its attack starts: time to read it and pick parry, dodge or jump. */
  const READ_MS = demo ? 850 : 1150

  /**
   * The timing target for an attack you have to JUMP: not the white ring
   * around the body but an amber oval closing in on the ground at the
   * Pokémon's feet, with chevrons pointing up. `fy` is where the feet are.
   */
  function groundRing(cx, fy, approach) {
    const W2 = 112, H2 = 30
    const box = `left:${cx - W2 / 2}px;top:${fy - H2 / 2}px;width:${W2}px;height:${H2}px`
    const t = document.createElement('div'); t.className = 'target low'; t.style.cssText = box
    const r = document.createElement('div'); r.className = 'ring low'; r.style.cssText = box
    const g = document.createElement('div'); g.className = 'glyph low'; g.textContent = 'JUMP'; g.style.left = cx + 'px'; g.style.top = (fy + H2 / 2 + 2) + 'px'
    const chev = [0, 1, 2].map((i) => { const c = document.createElement('div'); c.className = 'chev'; c.style.left = (cx - 8) + 'px'; c.style.top = (fy - 34 - i * 12) + 'px'; return c })
    fx.append(t, r, g, ...chev)
    anim(r, [{ transform: 'scale(2.4)', opacity: .15 }, { transform: 'scale(1)', opacity: 1 }], { duration: approach, easing: 'linear' })
    chev.forEach((c, i) => c.animate([{ transform: 'translateY(6px)', opacity: 0 }, { opacity: 1, offset: .4 }, { transform: 'translateY(-8px)', opacity: 0 }], { duration: 520, delay: i * 120, iterations: Infinity }))
    return { el: r, clear: () => { t.remove(); r.remove(); g.remove(); chev.forEach((c) => c.remove()) } }
  }

  /**
   * EXP for one Pokémon, filling `bar` (its HUD's EXP bar) as it goes and
   * rolling over on a level-up: new stats, the HP it gained added on, and a
   * call to `onLevel` so the HUD can redraw its level and HP.
   */
  /**
   * The EXP. SHARE (a key item): every Pokémon in the party that didn't fight
   * gets half of each foe's EXP, as long as it hasn't fainted. Given quietly,
   * with one line for the lot; only level-ups and new moves are announced.
   */
  async function shareExp(amount, fought) {
    if (!bag.expshare) return
    const rest = party.filter((m) => m.hp > 0 && !fought.includes(m)); if (!rest.length) return
    const half = Math.max(1, Math.round(amount / 2))
    await say(`The rest of your party got ${half} EXP.`, 'thanks to the EXP. SHARE.', 300)
    for (const m of rest) {
      m.exp ??= 0; addBond(m, 4)
      let left = half
      while (left > 0 && m.level < LEVEL_CAP) {
        const need = expToNext(m.level), take = Math.min(left, need - m.exp)
        m.exp += take; left -= take
        if (m.exp < need) break
        const hpBefore = m.stats.hp
        m.level++; m.exp = 0; m.stats = statsAt(m, m.level); m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore))
        sfx('levelup'); await say(`${m.name} grew to`, `Lv. ${m.level}!`, 500)
        if (evoDue(m)) pendingEvos.add(m)
        for (const r of learnAtLevel(m)) await say(`${m.name} learned ${r.name}!`, r.equipped ? '' : 'Swap it in from the Box.', 500)
      }
    }
    renderTools()
  }
  async function gainExp(m, amount, bar, onLevel) {
    m.exp ??= 0
    addBond(m, 10)   // fought in it
    await say(`${m.name} gained`, `${amount} EXP. Points!`, 180)
    let left = amount
    while (left > 0) {
      const need = expToNext(m.level), take = Math.min(left, need - m.exp)
      const a = m.exp / need * 100; m.exp += take; left -= take
      const b = m.exp / need * 100
      sfx('exp')
      if (bar) {
        bar.getAnimations().forEach((x) => x.cancel())
        const A = anim(bar, [{ width: a + '%' }, { width: b + '%' }], { duration: 300 + (b - a) * 10, easing: 'linear' })
        await A.finished; bar.style.width = b + '%'; A.cancel()
      } else await W(250)
      if (m.exp >= need) {
        const hpBefore = m.stats.hp
        m.level++; m.exp = 0; m.stats = statsAt(m, m.level); m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore))
        sfx('levelup')
        if (bar) { anim(bar.parentElement, [{ boxShadow: '0 0 0 2px #fde047, 0 0 10px #fde047' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 700 }); await W(250); bar.style.width = '0%' }
        onLevel?.(m)
        await say(`${m.name} grew to`, `Lv. ${m.level}!`, 600)
        if (evoDue(m)) pendingEvos.add(m)   // evolves after the battle
        for (const r of learnAtLevel(m)) { sfx('levelup'); await say(`${m.name} learned ${r.name}!`, r.equipped ? '' : 'Swap it in from the Box.', 700) }
      }
    }
    renderTools()
  }

  /* ══════════ 2v2: the framework ══════════
   * Two Pokémon a side. Each turn every Pokémon on the field picks an action,
   * then they all resolve in order: priority bracket first (Helping Hand +5,
   * After You +4, Quick Attack +1), then Speed (Tailwind doubles it), ties at
   * random. Ring timing carries over: STRIKE at the foe you picked, defend
   * (parry / dodge / jump) at whichever of yours is targeted, and support
   * moves get an ASSIST ring that sets how strong the effect is.
   * Not in yet: items, switching, running, and trainers with more than one
   * Pokémon each - the shapes below (slots, bench, side state) leave room.
   */
  const DUO_AT = {
    e: [{ x: 194, y: 118, maxH: 92, maxW: 104, scale: 1.3 }, { x: 266, y: 108, maxH: 84, maxW: 94, scale: 1.2 }],
    p: [{ x: 58, y: 206, maxH: 118, maxW: 118, scale: 1.7 }, { x: 146, y: 200, maxH: 110, maxW: 108, scale: 1.6 }],
  }
  const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s))

  /**
   * `foes`: [{ mon, owner }] on the field at the start (one or two). `bench`:
   * the same, waiting; when one of an owner's Pokémon faints they send the
   * next (in a solo double, any of theirs).
   */
  async function duoBattle({ foes, bench: foeBench = [], trainers, allies = [], tips = null, plan }) {
    // Tips: what a partner says the first time each thing happens (TUTORIAL_TIPS).
    const shownTips = new Set()
    const tip = async (k) => { if (!tips?.[k] || shownTips.has(k)) return; shownTips.add(k); await talk(tips.who, tips[k]) }
    plan = plan ? plan.map((t) => ({ ...t, cmds: [...(t.cmds ?? [])], foes: { ...(t.foes ?? {}) }, defend: [...(t.defend ?? [])] })) : null
    const ts = $('ts'), made = []
    const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; ts.appendChild(d); made.push(d); return d }
    const sides = { p: { slots: [], tailwind: 0 }, e: { slots: [], tailwind: 0 } }
    const st = new Map()   // per Pokémon, for this battle: stat stages, Helping Hand boost
    const S = (m) => { if (!st.has(m)) st.set(m, { atk: 0, spa: 0, spe: 0, boost: 1, acc: 0, eva: 0 }); return st.get(m) }
    let dpp = 0
    const ppChip = mk('dpp', 'PP ' + '<i></i>'.repeat(5))
    const setDPP = (n, gained) => {
      dpp = Math.max(0, Math.min(5, n)); [...ppChip.querySelectorAll('i')].forEach((p, i) => p.classList.toggle('on', i < dpp))
      if (gained) { sfx('pp'); anim(ppChip, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260 }) }
    }
    setDPP(0)

    /* ── the field ── */
    function hudHtml(s) {
      const m = s.mon
      return `<div class="row"><span>${m.name}${s.owner?.ally ? `<em class="own">${s.owner.short}</em>` : ''}</span><span class="lv">Lv${m.level}</span></div>` +
        `<div class="hpl"><b>HP</b><div class="hpb"><i style="width:${m.hp / m.stats.hp * 100}%;background:${hpColor(m.hp / m.stats.hp * 100)}"></i></div></div>` +
        (s.side === 'p' ? `<div class="dhn">${m.hp}/${m.stats.hp}</div><div class="exp"><i style="width:${(m.exp ?? 0) / expToNext(m.level) * 100}%"></i></div>` : '') + `<div class="tags"></div>`
    }
    function tags(s) {
      const t = S(s.mon), out = []
      if (t.atk) out.push(`ATK${t.atk > 0 ? '▲' : '▼'}${Math.abs(t.atk) > 1 ? Math.abs(t.atk) : ''}`)
      if (t.spa) out.push(`SP.A${t.spa > 0 ? '▲' : '▼'}${Math.abs(t.spa) > 1 ? Math.abs(t.spa) : ''}`)
      if (sides[s.side].tailwind) out.push('TAILWIND')
      if (t.boost > 1) out.push('HELPED')
      out.push(...stageTags(t))
      s.hud.querySelector('.tags').innerHTML = statusChip(s.mon) + out.map((x) => `<span>${x}</span>`).join('')
    }
    const retag = () => [...sides.p.slots, ...sides.e.slots].forEach((s) => s.mon.hp > 0 && tags(s))
    async function hpTo(s, to) {
      const m = s.mon, from = m.hp; m.hp = Math.max(0, Math.min(m.stats.hp, to))
      const bar = s.hud.querySelector('.hpb i'), a = from / m.stats.hp * 100, b = m.hp / m.stats.hp * 100
      const dur = Math.min(650, 160 + Math.abs(from - m.hp) * 36)
      anim(bar, [{ width: a + '%', background: hpColor(a) }, { width: b + '%', background: hpColor(b) }], { duration: dur })
      const n = s.hud.querySelector('.dhn')
      if (n) { const steps = Math.max(1, Math.abs(from - m.hp)); for (let i = 1; i <= steps; i++) { await W(dur / steps); n.textContent = `${Math.round(from + (m.hp - from) * i / steps)}/${m.stats.hp}` } } else await W(dur)
      renderTools()
    }
    async function enter(side, i, mon, owner = null) {
      const at = DUO_AT[side][i]
      const el = mk(`mon duo ${side}${i}`, '<img alt="">')
      el.style.opacity = '0'   // hidden while its image loads; it used to show, then pop in again
      const r = await place(el, ART[mon.id + (side === 'p' ? 'b' : '')], at.x, at.y, at.scale, at.maxH, at.maxW)
      const s = { side, i, mon, owner, ally: !!owner?.ally, el, c: { x: r.x, y: Math.min(r.y, side === 'p' ? 196 : 200) }, hud: mk(`hud dh ${side}${i}`) }
      s.hud.innerHTML = hudHtml(s); s.hud.style.opacity = '0'; sides[side].slots[i] = s; tags(s)
      sfx('ball'); flash('#fff', .35, 140)
      cry(mon); await anim(el, [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 360 }).finished
      // In for good: drop the load-time opacity 0, or the next effect that cancels this sprite's animations would hide it again.
      el.style.opacity = ''; el.getAnimations().forEach((x) => x.cancel())
      anim(s.hud, [{ transform: `translateX(${side === 'p' ? 180 : -180}px)`, opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 260 })
      return s
    }
    const alive = (side) => sides[side].slots.filter((s) => s && s.mon.hp > 0)
    /** One of yours fainted: which of the bench goes in (your pick when there's a choice; the demo takes the first). */
    async function pickIncoming(list) {
      if (demo || list.length < 2) return list[0]
      $('pParty').classList.remove('six')
      $('pParty').innerHTML = [0, 1, 2, 3].map((i) => { const m = list[i]; if (!m) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const pct = m.hp / m.stats.hp * 100
        return `<button class="btn fm${i} t-party pmon" data-act="p${i}"><img src="${ART[m.id]}" alt=""><span style="flex:1;min-width:0">${m.name}<small>${m.hp}/${m.stats.hp} HP</small><span class="hpm"><i style="width:${pct}%;background:${hpColor(pct)}"></i></span></span></button>` }).join('')
      panel('pParty'); msg0('Send out which Pokémon?', '')
      const p = await pick('pParty', null); panel(null)
      return list[+p.slice(1)]
    }
    const allyOf = (s) => sides[s.side].slots.find((x) => x && x !== s && x.mon.hp > 0)
    const other = (side) => (side === 'p' ? 'e' : 'p')
    const bench = () => party.filter((m) => m.hp > 0 && !sides.p.slots.some((s) => s?.mon === m))

    /* ── openers ── */
    $('msg').style.display = 'block'
    await say(`${trainers.map((t) => t.short).join(' and ')}`, trainers.length > 1 ? 'want to battle!' : 'wants to battle!', 300)
    for (let i = 0; i < foes.length; i++) { await say(...sentOut(foes[i].owner, foes[i].mon), 60); await enter('e', i, foes[i].mon, foes[i].owner) }
    if (foes.length === 1) await say(`${foes[0].owner.short} only has`, 'one Pokémon ready. 2 on 1!', 300)
    // Yours fill the slots a partner isn't using.
    const firstTwo = party.filter((m) => m.hp > 0).slice(0, 2 - allies.length)
    await say(`Go! ${firstTwo.map((m) => m.name).join(' and ')}!`, '', 80)
    for (let i = 0; i < firstTwo.length; i++) await enter('p', i, firstTwo[i])
    for (const [j, a] of allies.entries()) { await say(...sentOut(a.owner, a.mon), 80); await enter('p', firstTwo.length + j, a.mon, a.owner) }
    // The shared pool starts with what each of yours brings: 1, or 2 for a quick nature.
    setDPP(firstTwo.reduce((n, m) => n + startPP(m), 0), true)

    // Each side's whole team (started once the field and its helpers exist): on the field and on the bench. A partner's Pokémon aren't yours.
    const foeTeam = [...foes.map((f) => f.mon), ...foeBench.map((b) => b.mon)]
    const eRow = mk('balls ebs duo'), pRow = mk('balls pbs duo')
    watchBalls(eRow, pRow, () => ({ enemy: foeTeam, enemyOut: alive('e').map((s) => s.mon), mine: party, mineOut: alive('p').filter((s) => !s.ally).map((s) => s.mon) }), () => eRow.isConnected)

    /* ── damage, with stages and Helping Hand ── */
    function dmgOf(att, def, mv, mult) {
      const key = mv.cat === 'spec' ? 'spa' : 'atk'
      const A = (mv.cat === 'spec' ? att.stats.spa : att.stats.atk) * stageMult(S(att)[key]), D = mv.cat === 'spec' ? def.stats.spd : def.stats.def
      const base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * mv.power * A / D) / 50) + 2
      const stab = att.types.includes(mv.type) ? 1.5 : 1, eff = soften(gameMult(mv.type, def.types))
      const burn = att.status === 'brn' && mv.cat !== 'spec' ? 0.5 : 1
      return { dmg: Math.max(1, Math.round(base * stab * eff * mult * S(att).boost * burn)), eff }
    }
    const speed = (s) => s.mon.stats.spe * stageMult(S(s.mon).spe) * (sides[s.side].tailwind ? 2 : 1) * (s.mon.status === 'par' ? 0.5 : 1)
    const slotOf = (m) => [...sides.p.slots, ...sides.e.slots].find((x) => x && x.mon === m && !x.gone)
    async function afflict(s, st) {
      if (!s || !st || !canTake(s.mon, st)) return false
      s.mon.status = st; tags(s); sfx(st === 'par' ? 'zap' : st === 'brn' ? 'whoosh' : st === 'frz' ? 'clang' : 'shadow')
      await say(s.mon.name, STATUS_GOT[st], 350); return true
    }
    async function blockedByStatus(s) {
      const r = statusAtAction(s.mon, rand); if (!r) return false
      tags(s); await say(s.mon.name, STATUS_TEXT[r], r === 'thaw' ? 250 : 450); return r !== 'thaw'
    }

    /* ── choosing ── */
    function pick(panelId, scripted) {
      return new Promise((resolve, reject) => {
        if (demo) {
          setTimeout(() => { if (!live()) return reject(STOP); hot($(panelId).querySelector(`[data-act="${scripted}"]`)); sfx('select'); setTimeout(() => resolve(scripted), 200) }, 700)
          return
        }
        const cleanup = () => { $(panelId).removeEventListener('pointerdown', onTap); $(panelId).removeEventListener('click', onTap); offKey() }
        const onTap = (e) => {
          const b = e.target.closest('[data-act]'); if (!b || (e.type === 'click') !== !!b.closest('.bagscroll')) return   // the scrolling list answers clicks
          if (b.disabled || b.classList.contains('off') || !live()) return
          e.preventDefault(); hot(b); cleanup(); sfx('select'); resolve(b.dataset.act)
        }
        const offKey = listen((k) => { if (k === 'b' && $(panelId).querySelector('[data-act="back"]:not([disabled])')) { cleanup(); resolve('back') } })
        $(panelId).addEventListener('pointerdown', onTap); $(panelId).addEventListener('click', onTap)
      })
    }
    function drawMoves(s, budget, canBack) {
      const ms = duoMovesOf(s.mon), ally = allyOf(s)
      $('pFight').innerHTML = [0, 1, 2, 3].map((i) => ms[i]).map((n, i) => {
        if (!n) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const m = moveInfo(n), noAlly = m.target === 'ally' && !ally
        const sub = m.kind === 'support' ? m.sub : m.spread ? `${m.spread === 'all' ? 'ALL · hits partner' : 'BOTH FOES'} · PP ${m.cost}` : `${m.type.toUpperCase()}${m.hits ? ` · ${m.hits} HITS` : ''}${m.prio ? ' · FIRST' : ''} · ${m.cost ? `PP ${m.cost}` : '+1 PP'}`
        return `<button class="btn fm${i} t-${m.type}${m.kind === 'support' ? ' sup' : ''}${m.cost > budget || noAlly ? ' off' : ''}" data-act="m${i}">${n}<small>${sub}</small></button>`
      }).join('') + `<button class="btn fback t-run" data-act="back">◀ BACK · PP is shared by both</button>`
    }
    function drawTargets(list) {
      $('pFight').classList.remove('six')
      $('pFight').innerHTML = list.map((t, i) => `<button class="btn fm${i} t-${t.mon.types[0]} tgt" data-act="t${i}"><img src="${ART[t.mon.id]}" alt=""><span>${t.mon.name}<small>${Math.round(t.mon.hp / t.mon.stats.hp * 100)}% HP</small></span></button>`).join('') +
        `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
    }
    async function commands(step) {
      const mine = alive('p').filter((s) => !s.ally), acts = []
      for (let k = 0; k < mine.length; k++) {
        const s = mine[k], scripted = step?.cmds?.[k]
        const spent = acts.reduce((n, a) => n + (a.move.cost ?? 0), 0)
        const undo = () => { const a = acts.pop(); if (a?.move.kind === 'item') { bag[a.move.item]++; renderTools() } }
        // FIGHT, BAG, POKéMON, and RUN (or BACK to your first Pokémon's choice).
        $('pMain').innerHTML = `<button class="btn bFight" data-act="fight">FIGHT</button><button class="btn bm3 a t-bag" data-act="bag">BAG</button>` +
          `<button class="btn bm3 b t-party" data-act="party">POKéMON</button>` + (k ? `<button class="btn bm3 c t-run" data-act="back">◀ BACK</button>` : `<button class="btn bm3 c t-run" data-act="run">RUN</button>`)
        panel('pMain'); msg0(`What will ${s.mon.name} do?`, k ? '' : 'Pick for each of yours, then it plays out.')
        s.el.classList.add('choosing')
        const top = await pick('pMain', scripted ? (scripted.menu ?? 'fight') : null)
        s.el.classList.remove('choosing')
        if (top === 'back') { undo(); k -= 2; continue }
        if (top === 'run') { panel(null); await say("There's no running", 'from a trainer battle!'); k--; continue }
        if (top === 'bag') {
          // Items go first, before any attack, and are spent as soon as they're chosen.
          // Potions only for someone who's hurt, as in 1v1: no wasting one on full HP.
          const hurt = alive('p').filter((x) => !x.ally && x.mon.hp < x.mon.stats.hp)
          // Revive: anyone of yours who's fainted (and isn't already being revived this turn).
          const down = party.filter((m) => m.hp <= 0 && !acts.some((a) => a.move.item === 'revive' && a.target.mon === m)).map((mon) => ({ mon }))
          // Everything you have, scrolling. A cure lights up when one of yours has the status it fixes.
          const sickFor = (k) => alive('p').filter((x) => !x.ally && x.mon.status && ITEMS[k].cure.includes(x.mon.status))
          $('pBag').classList.remove('six')
          $('pBag').innerHTML = bagPanel(BATTLE_ITEMS.filter((k) => bag[k] > 0).map((k) => {
            const it = ITEMS[k], ball = k === 'ball' || k === 'great'
            const off = ball || (it.revive ? !down.length : it.cure ? !sickFor(k).length : !hurt.length)
            const why = ball ? "not on a trainer's" : it.revive ? (down.length ? it.sub : 'nobody has fainted') : it.cure ? (sickFor(k).length ? it.sub : 'nobody has that status') : hurt.length ? it.sub : 'everyone is at full HP'
            return bagButton(k, bag[k], off, why)
          }))
          bagMore($('pBag'))
          panel('pBag'); msg0('Use which item?', 'Items go before any attack.')
          const it = await pick('pBag', scripted?.item ?? null)
          if (it === 'back') { k--; continue }
          const up = it === 'revive' ? down : ITEMS[it].cure ? sickFor(it) : hurt; let target = up[0]
          if (up.length > 1) {
            drawTargets(up); panel('pFight'); msg0(`${ITEMS[it].name}: on which one?`, '')
            const t = await pick('pFight', scripted ? 't' + (scripted.target ?? 0) : null)
            if (t === 'back') { k--; continue }
            target = up[+t.slice(1)]
          }
          const key = it
          bag[key]--; renderTools()
          acts.push({ actor: s, move: { name: ITEMS[key].name, kind: 'item', item: key, prio: 6, cost: 0 }, target })
          continue
        }
        if (top === 'party') {
          const free = bench().filter((m) => !acts.some((a) => a.to === m))
          if (!free.length) { panel(null); await say('There are no other Pokémon', 'ready to come in!'); k--; continue }
          $('pParty').innerHTML = [0, 1, 2, 3].map((i) => { const m = free[i]; if (!m) return `<button class="btn fm${i} t-empty" disabled>—</button>`
            const pct = m.hp / m.stats.hp * 100
            return `<button class="btn fm${i} t-party pmon" data-act="p${i}"><img src="${ART[m.id]}" alt=""><span style="flex:1;min-width:0">${m.name}<small>${m.hp}/${m.stats.hp} HP</small><span class="hpm"><i style="width:${pct}%;background:${hpColor(pct)}"></i></span></span></button>` }).join('') +
            `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
          panel('pParty'); msg0(`Switch ${s.mon.name} for?`, 'Switches go before any attack.')
          const p = await pick('pParty', scripted?.to ?? null)
          if (p === 'back') { k--; continue }
          acts.push({ actor: s, move: { name: 'SWITCH', kind: 'switch', prio: 6, cost: 0 }, to: free[+p.slice(1)] })
          continue
        }
        drawMoves(s, dpp - spent, true); panel('pFight'); msg0(`${s.mon.name}: which move?`, '')
        const ms = duoMovesOf(s.mon)
        const a = await pick('pFight', scripted ? 'm' + ms.indexOf(scripted.move) : null)
        if (a === 'back') { k--; continue }
        const move = moveInfo(ms[+a.slice(1)])
        let target = null
        if (move.spread) target = null   // spread moves hit everyone they can
        else if (move.kind === 'strike' || move.target === 'foe') {
          const foesUp = alive('e')
          if (foesUp.length > 1) {
            drawTargets(foesUp); msg0(`${move.name}: which one?`, '')
            const t = await pick('pFight', scripted ? 't' + (scripted.target ?? 0) : null)
            if (t === 'back') { k--; continue }
            target = foesUp[+t.slice(1)]
          } else target = foesUp[0]
        } else if (move.target === 'ally') target = allyOf(s)
        else target = s
        acts.push({ actor: s, move, target, planned: scripted?.planned })
      }
      panel(null); $('pFight').classList.remove('six')
      return acts
    }
    /** A partner's choice: Recover once when low, otherwise the attack that does most to either foe. */
    function allyCommands() {
      return alive('p').filter((s) => s.ally).map((s) => {
        const ms = s.owner.moves.map(moveInfo)
        const heal = ms.find((m) => m.effect === 'heal')
        if (heal && !s.healed && s.mon.hp < s.mon.stats.hp * 0.4) { s.healed = true; return { actor: s, move: heal, target: s } }
        let pick = null
        for (const m of ms.filter((x) => x.kind === 'strike')) for (const f of alive('e')) {
          const v = m.power * soften(gameMult(m.type, f.mon.types)) * (s.mon.types.includes(m.type) ? 1.5 : 1)
          if (!pick || v > pick.v) pick = { v, m, f }
        }
        return pick && { actor: s, move: pick.m, target: pick.f }
      }).filter(Boolean)
    }
    function foeCommands(step) {
      return alive('e').map((s) => {
        const scripted = step?.foes?.[s.mon.name]
        const atk = TRAINER_MOVES[s.mon.name] ?? WILD_MOVES[s.mon.types[0]] ?? WILD_MOVES.normal
        const heal = TRAINER_SUPPORT[s.mon.name]
        if (scripted?.move && SUPPORT[scripted.move]) return { actor: s, move: moveInfo(scripted.move), target: s }
        // Decided now, when it would pick a move: the wasted turn still happens in speed order.
        if (!scripted && s.owner?.blunder && flavor() < s.owner.blunder) return { actor: s, move: { name: 'BLUNDER', kind: 'blunder', prio: 0, cost: 0 } }
        if (!scripted && heal && s.mon.hp < s.mon.stats.hp * 0.45 && rand() < 0.7) return { actor: s, move: moveInfo(heal), target: s }
        // Now and then, once per Pokémon: its type's accuracy or evasion move.
        if (!scripted && !s.usedStatus && (window.__forceStatusMove || rand() < 0.1)) { s.usedStatus = true; const sm = moveInfo(statusOf(s.mon)); const up = alive('p')
          return { actor: s, move: sm, target: sm.target === 'foe' ? up[Math.floor(rand() * up.length)] : s } }
        s.turn = (s.turn ?? 0)
        const mv = (scripted?.move && atk.find((m) => m.name === scripted.move)) || atk[s.turn++ % atk.length]
        const up = alive('p')
        // Prefer whichever of yours the move hits hardest; otherwise either.
        const best = up.slice().sort((x, y) => soften(gameMult(mv.type, y.mon.types)) - soften(gameMult(mv.type, x.mon.types)))
        const target = scripted?.target != null ? (up[scripted.target] ?? up[0]) : !s.owner?.easy && rand() < 0.6 ? best[0] : up[Math.floor(rand() * up.length)]
        return { actor: s, move: { ...mv, kind: mv.kind ?? 'strike', foe: true }, target }
      })
    }

    /* ── resolving ── */
    /**
     * One hit of one of your attacks on one foe: its STRIKE ring, the visual,
     * the damage. Returns { eff, crit }, or null when a multi-hit move's ring
     * was missed (that hit whiffs).
     */
    async function hitOnce(actor, T, mv, planned, label, approach, mult, whiffOnMiss) {
      let acc
      const sr = strikeRing(ringNet(S(actor.mon).acc, S(T.mon).eva)); approach = Math.round(approach * sr.speed)
      if (actor.ally) acc = await autoTap(T.c.x, T.c.y, label, approach)   // a partner hits their own ring
      else {
        await tip('strike')
        panel('pStrike'); $('bStrike').innerHTML = `${label === 'STRIKE' ? 'STRIKE!' : label}<small style="font-size:12px;margin-top:6px">tap as the ring closes</small><span class="key">A</span>`
        acc = await timedTap(planned, T.c.x, T.c.y, label, approach, sr.tight)
        panel(null)
      }
      if (whiffOnMiss && acc.label === 'MISS') { pop('MISSED', T.c.x, T.c.y - 70, 'red small'); sfx('dodge'); return null }
      pop(`${acc.label} ×${acc.mult.toFixed(1)}`, T.c.x - 24, T.c.y - 72, ACC_CLS[acc.label])
      sfx(mv.snd); await strikeFx(mv, actor.c, T.c, actor.el, approach < 820)
      const { dmg, eff } = dmgOf(actor.mon, T.mon, mv, acc.mult * mult)
      const from = T.mon.hp
      sfx(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit'); if (eff > 1 || acc.crit) shake(5, 280)
      sparks(T.c.x, T.c.y, mv.type === 'fire' ? '#fb923c' : TYPE_COL[mv.type] ?? '#e2e8f0', 8)
      await Promise.all([blink(T.el, 2), hpTo(T, from - dmg)])
      pop(`-${from - T.mon.hp}`, T.c.x + 30, T.c.y - 30, acc.crit ? 'gold' : '')
      if (T.mon.hp > 0 && T.mon.status === 'frz' && mv.type === 'fire') { T.mon.status = null; tags(T); await say(T.mon.name, STATUS_TEXT.thaw, 250) }
      if (T.mon.hp > 0) await afflict(T, statusFromHit(T.mon, mv, rand))
      if (mv.accDown && acc.label !== 'MISS' && T.mon.hp > 0) { const t = S(T.mon); if (t.acc > -STAGE_MAX) { t.acc--; tags(T); await say(`${T.mon.name}'s accuracy`, 'fell!', 250) } }
      return { eff, crit: acc.crit, label: acc.label }
    }

    async function strike(act, step) {
      const { actor, move: mv } = act
      const planned = [].concat(act.planned ?? 'great')
      const results = []
      if (mv.spread) {
        const foesUp = alive('e'); if (!foesUp.length) return
        await announce(`${actor.ally ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, `${mv.name}! ${mv.spread === 'all' ? '(hits everyone else)' : '(hits both foes)'}`, 140)
        if (!actor.ally) setDPP(dpp - (mv.cost ?? 0))
        if (mv.fx === 'quake') { sfx('quake'); shake(9, 600) }
        // One ring per foe; with two of them each takes 0.75×.
        const mult = foesUp.length > 1 ? 0.75 : 1
        for (const [k, F] of foesUp.entries()) {
          if (F.mon.hp <= 0) continue
          results.push(await hitOnce(actor, F, mv, planned[k] ?? planned.at(-1), foesUp.length > 1 ? `FOE ${k + 1}/${foesUp.length}` : 'STRIKE', k ? 620 : 820, mult, false))
        }
        // Earthquake, Surf and the like roll on into your own partner. It can jump.
        const ally = mv.spread === 'all' ? allyOf(actor) : null
        if (ally) {
          await say(`It's coming at ${ally.mon.name} too!`, '', 120)
          await defendHit(ally, actor, { ...mv, kind: 'low' }, 0, step, 0.75, true)
        }
      } else {
        let T = act.target && act.target.mon.hp > 0 ? act.target : alive('e')[0]
        if (!T) return
        await announce(`${actor.ally ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, `${mv.name}!`, 120)
        if (!actor.ally) setDPP(dpp - (mv.cost ?? 0))   // a partner's moves don't spend your PP
        const hits = mv.hits ?? 1
        for (let h = 0; h < hits && T.mon.hp > 0; h++) {
          results.push(await hitOnce(actor, T, mv, planned[h] ?? planned.at(-1), hits > 1 ? `HIT ${h + 1}/${hits}` : 'STRIKE', h ? 560 : 820, 1, hits > 1))
        }
        if (hits > 1) { const n = results.filter(Boolean).length; await say(n === hits ? `Hit ${hits} times — full damage!` : `Hit ${n} of ${hits} times.`, '', 260) }
      }
      S(actor.mon).boost = 1; if (actor.mon.hp > 0) tags(actor)
      const landed = results.filter(Boolean)
      // A 0-PP move that lands (any timing but MISS) builds PP: +1 per attack (yours, not a partner's).
      if (!actor.ally && !(mv.cost ?? 0) && landed.some((r) => r.label !== 'MISS')) { setDPP(dpp + 1, true); pop('+1 PP', 236, 136, 'blue small') }
      if (landed.some((r) => r.crit)) await say('A critical hit!')
      if (!mv.spread && landed.length && landed.at(-1).eff > 1) await say("It's super effective!")
      if (!mv.spread && landed.length && landed.at(-1).eff < 1) await say("It's not very effective...")
    }

    /**
     * One incoming hit on one of yours: the ring (the amber ground oval when
     * it has to be jumped), the press, and what follows. `ownPartner` is your
     * other Pokémon's spread move rolling into this one: jumping it dodges the
     * hit but earns no PP. Returns 'parry', 'dodge', 'jump' or 'miss'.
     */
    async function defendHit(T, actor, mv, h, step, mult, ownPartner = false) {
      const dr = defendRing(ringNet(S(actor.mon).acc, S(T.mon).eva)); if (T.mon.status === 'par') dr.wide *= 0.8
      // Every ring closes at its own speed, after a wind-up of its own (see attackPace).
      const pace = attackPace(ownPartner ? null : actor.owner, leadLevel())
      const vary = demo ? 1 : paceRoll(pace.speed), windup = demo || ownPartner ? 0 : Math.round(Math.random() * pace.wait)
      const approach = Math.round((mv.fast ? 640 : h === 0 ? 820 : 560) * dr.speed * vary)
      let first = null
      const auto = T.ally   // a partner's Pokémon: they defend it, and your presses don't count here
      // Armed through the wind-up, so tapping early still counts as your press (and misses).
      const armed = performance.now()
      const off = auto ? () => {} : listen((btn, t) => { if (!first && t >= armed && ['a', 'b', 'up'].includes(btn)) first = { btn, t } })
      if (auto) panel(null); else { panel('pDefend'); document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.add('armed')) }
      if (windup) await W(windup)
      const t0 = performance.now(), hitAt = t0 + approach
      if (demo && !auto) {
        const p = ownPartner ? 'jump' : step?.defend?.shift() ?? (mv.kind === 'low' ? 'jump' : 'parry')
        const at = { parry: approach - 40, dodge: approach - 120, jump: approach - 70, late: approach + 190 }[p]
        setTimeout(() => { if (!live()) return; const b = { parry: 'a', dodge: 'b', jump: 'up', late: 'a' }[p]; hot($('pDefend').querySelector(`[data-btn="${b}"]`)); press(b) }, at)
      }
      const rg = mv.kind === 'low' ? groundRing(T.c.x, DUO_AT.p[T.i].y - 4, approach) : ring(T.c.x, T.c.y, approach, '')
      const dx = T.c.x - actor.c.x, dy = T.c.y - actor.c.y
      if (mv.kind === 'low') {
        const w = document.createElement('div'); w.className = 'groundwave'; w.style.left = (actor.c.x - 30) + 'px'; w.style.top = (actor.c.y + 30) + 'px'; fx.appendChild(w)
        anim(w, [{ transform: 'translate(0,0) scale(.4,.6)', opacity: .9 }, { transform: `translate(${dx}px,${dy}px) scale(1.4,1)`, opacity: .9, offset: .95 }, { opacity: 0 }], { duration: approach + 60, easing: 'ease-in' }); setTimeout(() => w.remove(), approach + 120)
        if (mv.fx === 'quake' && !ownPartner) anim(actor.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: .82 }, { transform: 'translateY(0)' }], { duration: approach, easing: 'ease-in' })
      } else if (mv.ranged) anim(actor.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) translateY(-6px)', offset: .5 }, { transform: 'scale(1)' }], { duration: approach })
      else { const k = approach / (approach + 160); anim(actor.el, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * .8}px,${dy * .8}px)`, offset: k }, { transform: 'translate(0,0)' }], { duration: approach + 160, easing: 'ease-in' }) }
      await W(approach); rg.clear()
      if (!first) await W(240)
      off(); document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.remove('armed')); panel(null)
      if (T.mon.status === 'frz') first = null   // frozen solid: no parry, dodge or jump
      const dt = first ? first.t - hitAt : Infinity
      let r = 'miss'
      if (auto) r = flavor() < (mv.kind === 'low' ? 0.8 : 0.65) ? (mv.kind === 'low' ? 'jump' : 'parry') : 'miss'   // good, not perfect
      else if (mv.kind === 'low') { if (first?.btn === 'up' && Math.abs(dt) <= 260 * dr.wide) r = 'jump' }
      else if (first?.btn === 'a' && Math.abs(dt) <= 120 * dr.wide) r = 'parry'
      else if (first?.btn === 'b' && Math.abs(dt) <= 230 * dr.wide) r = 'dodge'
      if (mv.fx === 'quake' && !ownPartner) { sfx('quake'); shake(8, 420) }
      if (r === 'parry') { sfx('parry'); pop('PARRY!', T.c.x, T.c.y - 64, 'gold'); sparks(T.c.x + 20, T.c.y - 20) }
      else if (r === 'dodge') { sfx('dodge'); pop('DODGE', T.c.x, T.c.y - 64, 'blue'); anim(T.el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-26px)', offset: .4 }, { transform: 'translateX(0)' }], { duration: 340 }) }
      else if (r === 'jump') { sfx('jump'); pop('JUMP!', T.c.x, T.c.y - 76, 'green'); anim(T.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-50px)', offset: .45 }, { transform: 'translateY(0)' }], { duration: 520 }) }
      else {
        if (mv.snd && mv.snd !== 'coin' && mv.snd !== 'shadow') sfx(mv.snd)
        const { dmg, eff } = dmgOf(actor.mon, T.mon, mv, mult)
        sfx(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit'); flash('#ef4444', .2, 140); if (!auto) buzz(eff > 1 ? 60 : 30)
        const from = T.mon.hp
        await Promise.all([blink(T.el, 2), hpTo(T, Math.max(demo ? 1 : 0, from - dmg))])
        pop(`-${from - T.mon.hp}`, T.c.x + 36, T.c.y - 40, 'red')
        if (ownPartner) await say(`${T.mon.name} got caught in it!`, '', 200)
        if (T.mon.hp > 0 && T.mon.status === 'frz' && mv.type === 'fire') { T.mon.status = null; tags(T); await say(T.mon.name, STATUS_TEXT.thaw, 250) }
        if (T.mon.hp > 0) await afflict(T, statusFromHit(T.mon, mv, rand))
      }
      await W(mv.hits > 1 ? 70 : 160)
      return r
    }

    async function incoming(act, step) {
      const { actor, move: mv } = act
      if (!mv || mv.kind === 'blunder') return
      if (mv.splash) { await announce(`${actor.owner ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, 'SPLASH!', 200); anim(actor.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-20px)', offset: .5 }, { transform: 'translateY(0)' }], { duration: 300, iterations: 2 }); await W(600); await say('But nothing happened!'); return }
      const spread = SPREAD.has(mv.name)
      const aimed = act.target?.gone ? sides.p.slots[act.target.i] : act.target
      let targets = spread ? alive('p') : [aimed && aimed.mon.hp > 0 ? aimed : alive('p')[0]]
      targets = targets.filter(Boolean); if (!targets.length) return
      // The move's name stays up long enough to read it and decide.
      await announce(`${actor.owner ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, `${mv.name}!${spread ? ' (hits all around it)' : ''}`, READ_MS)
      let rings = 0, evaded = 0
      for (const T of targets) {
        let allParried = true
        for (let h = 0; h < (mv.hits ?? 1); h++) {
          if (T.mon.hp <= 0) break
          if (h === 0) await tip(T.ally ? 'partner' : mv.kind === 'low' ? 'jump' : 'defend')
          const r = await defendHit(T, actor, mv, h, step, spread ? 0.75 : 1)
          if (!T.ally) { rings++; if (r === 'parry' || r === 'jump') evaded++ }   // PP is yours: only your rings count
          if (r !== 'parry') allParried = false
        }
        // A clean parry of every hit earns a counter, as in 1v1.
        if (allParried && mv.kind !== 'low' && T.mon.hp > 0 && actor.mon.hp > 0) {
          sfx('counter'); pop('COUNTER!', T.c.x + 40, T.c.y - 90, 'orange'); await W(120)
          await strikeFx({ fx: 'dash' }, T.c, actor.c, T.el)
          const { dmg } = dmgOf(T.mon, actor.mon, { ...MOVEDEX.TACKLE }, 0.8), from = actor.mon.hp
          sparks(actor.c.x, actor.c.y, '#fdba74')
          await Promise.all([blink(actor.el, 2), hpTo(actor, from - dmg)]); pop(`-${from - actor.mon.hp}`, actor.c.x + 30, actor.c.y - 30)
        }
      }
      // One PP per attack, only when every ring of it was parried or jumped.
      if (rings && evaded === rings) { setDPP(dpp + 1, true); pop('+1 PP', 236, 136, 'blue small'); await tip('pp') }
      else if (evaded) pop(`${evaded}/${rings} — no PP`, 236, 136, 'small')
      // Their spread moves hit their own partner too.
      const partner = spread ? allyOf(actor) : null
      if (partner && actor.mon.hp > 0) {
        const { dmg } = dmgOf(actor.mon, partner.mon, mv, 0.75), from = partner.mon.hp
        if (mv.snd && mv.snd !== 'coin') sfx(mv.snd); sfx('hit')
        await Promise.all([blink(partner.el, 2), hpTo(partner, from - dmg)])
        pop(`-${from - partner.mon.hp}`, partner.c.x + 30, partner.c.y - 30, 'red')
        await say(`It hit its own partner,`, `${partner.mon.name}, too!`, 200)
      }
    }

    async function support(act, queue) {
      const { actor, move: mv } = act
      const mine = actor.side === 'p'
      let T = act.target
      if (mv.target === 'ally' && (!T || T.mon.hp <= 0 || T === actor)) { await say(`${actor.mon.name} used ${mv.name}!`, 'But there was no partner to help...'); return }
      await announce(`${actor.mon.name} used`, `${mv.name}!`, 100)
      if (mine && !actor.ally) setDPP(dpp - (mv.cost ?? 0))
      // Yours get a ring over whoever it's for; better timing, stronger effect.
      let acc = { label: 'GOOD', mult: 1, crit: false }
      if (actor.ally) acc = await autoTap(T.c.x, T.c.y, 'ASSIST')
      else if (mine) {
        panel('pStrike'); $('bStrike').innerHTML = 'ASSIST!<small style="font-size:12px;margin-top:6px">time it for a stronger effect</small><span class="key">A</span>'
        acc = await timedTap(act.planned ?? 'great', T.c.x, T.c.y, 'ASSIST')
        panel(null); pop(acc.label, T.c.x - 20, T.c.y - 72, ACC_CLS[acc.label])
      }
      const strong = acc.crit, weak = acc.label === 'MISS'
      const who = mv.target === 'side' ? alive(actor.side) : [T]
      if (mv.effect === 'heal') {
        sfx('heal')
        for (const s of who) {
          if (s.mon.hp >= s.mon.stats.hp) { pop('FULL', s.c.x, s.c.y - 60, 'small'); continue }
          const amt = Math.ceil(s.mon.stats.hp * Math.min(0.6, mv.amount * (mine ? acc.mult : 1)))
          healFx(s); const from = s.mon.hp
          await hpTo(s, from + amt); pop(`+${s.mon.hp - from}`, s.c.x + 30, s.c.y - 40, 'green')
        }
        await say(who.length > 1 ? `${who.map((s) => s.mon.name).join(' and ')}` : `${who[0].mon.name}'s HP`, who.length > 1 ? 'recovered HP!' : 'was restored!', 200)
      } else if (mv.effect === 'atkUp' || mv.effect === 'growth') {
        const n = strong ? 2 : 1
        for (const s of who) {
          const t = S(s.mon); t.atk = Math.min(6, t.atk + n); if (mv.effect === 'growth') t.spa = Math.min(6, t.spa + n)
          buffFx(s); tags(s)
        }
        sfx('levelup')
        await say(`${who.map((s) => s.mon.name).join(' and ')}'s`, `${mv.effect === 'growth' ? 'ATK and SP.A' : 'ATTACK'} ${n > 1 ? 'rose sharply' : 'rose'}!`, 200)
      } else if (mv.effect === 'boost') {
        S(T.mon).boost = strong ? 1.75 : weak ? 1.25 : 1.5; tags(T)
        sfx('perfect'); pop(`×${S(T.mon).boost}`, T.c.x, T.c.y - 70, 'gold'); buffFx(T)
        await say(`${actor.mon.name} is ready to help`, `${T.mon.name}! (×${S(T.mon).boost})`, 200)
      } else if (mv.effect === 'hurry') {
        const i = queue.findIndex((q) => q.actor === T)
        if (i < 0) { await say('But it failed...', `${T.mon.name} already moved.`); return }
        queue.unshift(...queue.splice(i, 1))
        sfx('perfect'); pop('NEXT!', T.c.x, T.c.y - 70, 'gold'); buffFx(T)
        await say(`${T.mon.name} took the kind offer`, 'and moves next!', 200)
      } else if (mv.effect === 'cure') {
        const sick = who.filter((s) => s.mon.status)
        if (!sick.length) await say('But it failed!', 'No status to cure.', 250)
        for (const s of sick) { s.mon.status = null; tags(s); healFx(s); await say(`${s.mon.name}'s status`, 'returned to normal!', 250) }
      } else if (mv.effect === 'status') {
        if (weak || !(await afflict(T, mv.status))) await say('But it failed!', '', 250)
      } else if (mv.effect === 'accDown' || mv.effect === 'evaUp') {
        const key = mv.effect === 'accDown' ? 'acc' : 'eva', by = (mv.effect === 'accDown' ? -1 : 1) * (strong ? 2 : 1)
        for (const s of who) {
          const t = S(s.mon), from = t[key]; t[key] = Math.max(-STAGE_MAX, Math.min(STAGE_MAX, t[key] + by)); tags(s)
          await say(`${s.mon.name}'s ${key === 'acc' ? 'accuracy' : 'evasiveness'}`, t[key] === from ? `won't go any ${by > 0 ? 'higher' : 'lower'}!` : `${by > 0 ? 'rose' : 'fell'}${Math.abs(by) > 1 ? ' sharply' : ''}!`, 250)
        }
      } else if (mv.effect === 'tailwind') {
        sides[actor.side].tailwind = strong ? 5 : 4; windFx(actor.side); sfx('whoosh'); retag()
        await say('A tailwind blew from behind', `your team! (${sides[actor.side].tailwind - 1} more turns)`, 200)
      }
    }
    function healFx(s) {
      for (let i = 0; i < 8; i++) {
        const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${s.c.x - 30 + (i * 37) % 60}px;top:${s.c.y + 20}px;width:8px;height:8px;border-radius:50%;background:#86efac;box-shadow:0 0 8px #22c55e`
        fx.appendChild(d); anim(d, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-70px)', opacity: 0 }], { duration: 700, delay: i * 50 }); setTimeout(() => d.remove(), 800 + i * 50)
      }
    }
    function buffFx(s) {
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('div'); d.className = 'uparrow'; d.style.left = (s.c.x - 24 + i * 18) + 'px'; d.style.top = (s.c.y + 10) + 'px'
        fx.appendChild(d); anim(d, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .3 }, { transform: 'translateY(-60px)', opacity: 0 }], { duration: 700, delay: i * 90 }); setTimeout(() => d.remove(), 900)
      }
    }
    function windFx(side) {
      for (let i = 0; i < 9; i++) {
        const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${side === 'p' ? -40 : 340}px;top:${40 + i * 20}px;width:46px;height:2px;background:rgba(255,255,255,.75);border-radius:2px`
        fx.appendChild(d); anim(d, [{ transform: 'translateX(0)' }, { transform: `translateX(${side === 'p' ? 400 : -400}px)` }], { duration: 520, delay: i * 40 }); setTimeout(() => d.remove(), 620 + i * 40)
      }
    }

    async function useItemDuo(act) {
      if (act.move.item === 'revive') {
        const m = act.target.mon
        await say('You used', `a REVIVE on ${m.name}!`, 200)
        if (m.hp > 0) { await say("It didn't have any effect."); return }
        m.hp = Math.ceil(m.stats.hp * ITEMS.revive.revive); m.status = null; sfx('heal')
        await say(`${m.name} was revived!`, 'It can come in when a spot opens.')
        return
      }
      const it = act.move.item, T = act.target?.gone ? sides.p.slots[act.target.i] : act.target
      await say('You used', `a ${ITEMS[it].name} on ${T.mon.name}!`, 200)
      if (ITEMS[it].cure) {
        if (!T.mon.status || !ITEMS[it].cure.includes(T.mon.status)) { await say("It didn't have any effect."); return }
        T.mon.status = null; tags(T); sfx('heal'); healFx(T); await say(`${T.mon.name} is cured.`); return
      }
      if (T.mon.hp <= 0 || T.mon.hp >= T.mon.stats.hp) { await say("It didn't have any effect."); return }
      sfx('heal'); healFx(T); const from = T.mon.hp
      await hpTo(T, from + Math.ceil(T.mon.stats.hp * ITEMS[it].heal)); pop(`+${T.mon.hp - from}`, T.c.x + 30, T.c.y - 40, 'green')
      await say(`${T.mon.name} recovered`, `${T.mon.hp - from} HP.`)
    }
    async function switchDuo(act) {
      const s = act.actor
      await say(`Come back, ${s.mon.name}!`, '', 160)
      await anim(s.el, [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(0)', opacity: 0, filter: 'brightness(3) sepia(1) hue-rotate(-50deg)' }], { duration: 320 }).finished
      st.delete(s.mon); s.gone = true; s.el.remove(); s.hud.remove()   // stat changes go with it, as in the games
      await say(`Go! ${act.to.name}!`, '', 60)
      await enter('p', s.i, act.to)
    }

    /** EXP for one fainted foe, to each of your Pokémon on the field (not a partner's), and the rest of the party with the EXP. SHARE. */
    const pendingExp = []
    async function expFor(foeMon) {
      await shareExp(expYield(foeMon, true), alive('p').map((x) => x.mon))
      for (const p of alive('p').filter((x) => !x.ally)) {
        await gainExp(p.mon, expYield(foeMon, true), p.hud.querySelector('.exp i'), (m) => {
          p.hud.querySelector('.lv').textContent = 'Lv' + m.level; p.hud.querySelector('.dhn').textContent = `${m.hp}/${m.stats.hp}`
          const bar = p.hud.querySelector('.hpb i'); bar.getAnimations().forEach((x) => x.cancel()); bar.style.width = m.hp / m.stats.hp * 100 + '%'
        })
      }
    }
    async function faints() {
      for (const side of ['e', 'p']) for (const s of sides[side].slots) {
        if (!s || s.mon.hp > 0 || s.out) continue
        s.out = true; sfx('faint')
        await anim(s.el, [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(90px)', clipPath: 'inset(0 0 90px 0)' }], { duration: 480, easing: 'ease-in' }).finished
        s.el.style.visibility = 'hidden'; s.hud.style.visibility = 'hidden'
        await say(`${side === 'e' ? `${s.owner?.short ?? 'The foe'}'s ` : ''}${s.mon.name}`, 'fainted!')
        // EXP now while the battle goes on; for the faint that ends it, after the scalpers' parting words.
        if (side === 'e') { if (!alive('e').length && !foeBench.length) pendingExp.push(s.mon); else await expFor(s.mon) }
        if (side === 'e') {
          // Next one up from the same scalper (in a solo double, whichever is next).
          const j = foeBench.findIndex((b) => trainers.length === 1 || b.owner === s.owner)
          if (j >= 0) { const nx = foeBench.splice(j, 1)[0]; await say(...sentOut(nx.owner, nx.mon), 120); s.el.remove(); s.hud.remove(); await enter('e', s.i, nx.mon, nx.owner) }
        }
        if (side === 'p' && !s.ally) {
          const next = await pickIncoming(bench())
          if (next) { await say(`Go! ${next.name}!`, '', 60); s.el.remove(); s.hud.remove(); await enter('p', s.i, next) }
        }
      }
    }

    /* ── the turn loop ── */
    for (let turn = 0; ; turn++) {
      const step = demo ? (plan[turn] ?? null) : null
      if (step?.cap) cap(step.cap[0], step.cap[1])
      // Past the end of the script, the demo just keeps attacking.
      const best = (s) => movesOf(s.mon).map(moveInfo).filter((m) => m.kind === 'strike' && m.cost <= dpp / 2).sort((a, b) => b.power * (b.hits ?? 1) - a.power * (a.hits ?? 1))[0]?.name ?? movesOf(s.mon)[0]
      if (turn === 0) await tip('start')
      const mineActs = await commands(step ?? (demo ? { cmds: alive('p').filter((s) => !s.ally).map((s) => ({ move: best(s), target: 0, planned: 'perfect' })) } : null))
      const queue = [...mineActs, ...allyCommands(), ...foeCommands(step)]
      // Priority bracket, then Speed (Tailwind ×2), ties at random.
      queue.forEach((q) => { q.roll = rand() })
      queue.sort((a, b) => (b.move.prio ?? (b.move.fast ? 1 : 0)) - (a.move.prio ?? (a.move.fast ? 1 : 0)) || speed(b.actor) - speed(a.actor) || a.roll - b.roll)
      while (queue.length) {
        const act = queue.shift()
        if (act.actor.mon.hp <= 0) continue
        if (step?.capAt?.[act.move.name]) cap(...step.capAt[act.move.name])
        if (act.move.kind === 'blunder') await blunderLine(act.actor.owner, act.actor.mon)
        else if (act.move.kind === 'item') await useItemDuo(act)
        else if (act.move.kind === 'switch') await switchDuo(act)
        else if (await blockedByStatus(act.actor)) { /* frozen or fully paralyzed: the turn is lost */ }
        else if (act.move.kind === 'support') await support(act, queue)
        else if (act.actor.side === 'p') await strike(act, step)
        else await incoming(act, step)
        await faints()
        if (!alive('e').length || !alive('p').length) break
      }
      for (const s of [...alive('p'), ...alive('e')]) {
        const d = statusTick(s.mon); if (!d) continue
        sfx('hitWeak'); await hpTo(s, s.mon.hp - d); await say(s.mon.name, `is hurt by its ${s.mon.status === 'brn' ? 'burn' : 'poison'}!`, 250)
      }
      await faints()
      for (const side of ['p', 'e']) if (sides[side].tailwind) { sides[side].tailwind--; if (!sides[side].tailwind) await say(`The tailwind on ${side === 'p' ? 'your' : 'the foe'}'s side`, 'petered out.') }
      for (const s of [...sides.p.slots, ...sides.e.slots]) if (s) { S(s.mon).boost = 1 }
      retag()
      if (!alive('e').length || !alive('p').length) break
    }
    const won = !alive('e').length
    const cleanup = () => made.forEach((d) => d.remove())
    // `exp`: the EXP held back from the faint that ended it, for after the parting words.
    return { result: won ? 'won' : 'lost', cleanup, exp: async () => { for (const m of pendingExp.splice(0)) await expFor(m) } }
  }

  /* ══════════ 2v2 at the machine ══════════
   * 'tag': Herb and Paul together, one Pokémon each on the field, any others
   * on deck. 'solo': one scalper with two out at once, or, when they only
   * carry one, a 2-on-1. Either way your first two Pokémon fight.
   */
  async function duoEncounter(demoPlan, variant = 'tag', state = 'in') {
    toolsEnabled(false)
    if (!party.some((m) => m.hp > 0)) { $('homeSub').textContent = 'heal your party first'; toolsEnabled(true); return }
    const lead = party.filter((m) => m.hp > 0).slice(0, 2)
    const lv = Math.round(lead.reduce((n, m) => n + m.level, 0) / lead.length)   // your first two, on average: deckFor() sets the band around it
    // A tag team is any two trainers; the demo's is Herb and Paul. Solo: one trainer with two out.
    const crew = demoPlan ? (variant === 'tag' ? [HERB, PAUL] : [pickOf(SCALPERS)]) : randomTrainers(variant === 'tag' ? 2 : 1)
    const decks = crew.map((T) => deckFor(T, lv, demoPlan ? [T.mon] : null).map((mon) => ({ mon, owner: T })))
    // On the field: one from each in a tag team; up to two of the one scalper's otherwise.
    const field = variant === 'tag' ? decks.map((d) => d.shift()) : decks[0].splice(0, 2)
    const waiting = decks.flat()
    renderHome(state); if (state === 'in') sfx('restock'); await W(demo ? 1000 : 700)
    const second = await campOut(crew)
    Sound.music('vs')
    await wipeTrainer(async () => {
      second?.remove()
      setScene(SCALPER_SCENES, sceneRoll); showLayer('battle')
      vsSplash(crew, field.length)
    })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    if (demo) cap('TAG TEAM', "Sometimes both scalpers show up. That's a 2v2: your first two Pokémon against both of theirs.")
    await W(1500)
    if (crew[1] && crew.includes(HERB) && crew.includes(PAUL)) { const [h, p] = demoPlan ? TAG_BANTER[0] : pickOf(TAG_BANTER); await talk(HERB, [h]); await talk(PAUL, [p]) }
    else if (crew[1]) { for (const T of crew) await talk(T, [pickOf(TEAM_UP[T.short])]) }
    else await talk(crew[0], pickOf(SOLO_DOUBLE[crew[0].short]))
    vsHide()
    Sound.music('battle')
    const out = await duoBattle({ foes: field, bench: waiting, trainers: crew, plan: demoPlan })
    if (out.result === 'won') {
      restBeaten(crew)   // they stay away for a while
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      for (const T of crew) { await trainerOn(T, 'down'); await talk(T, pickOf(T.outro), 'faceDown'); await trainerOff() }
      await out.exp(); out.cleanup()   // EXP after their parting words, then tokens
      const tokens = crew.reduce((n, T) => n + +T.tokens, 0).toFixed(2)
      wallet = Math.round((wallet + +tokens) * 100) / 100
      sfx('tokens'); await say(`You got ${tokens} tokens!`, 'The VVM is free!', 600)   // always
      for (const T of crew) await loot(T)   // sometimes
      Sound.stopMusic(); await backToMachine(state)
    } else {
      out.cleanup()
      for (const T of crew) { await trainerOn(T); await talk(T, pickOf(T.gloat)); await trainerOff() }
      Sound.stopMusic(); await say(`${crew.map((T) => T.short).join(' and ')} ${crew[1] ? 'are' : 'is'} still`, 'at the VVM...'); await backToMachine(state, true)
    }
  }
  /* ══════════ the first time: Herb and Paul, and Alex ══════════
   * Your first restock, before you have a Pokémon. Herb and Paul are camping
   * the machine; Alex steps in, has you pick a starter, and fights beside you
   * with his Porygon, coaching as you go. Afterwards the game opens up.
   * Assumes campOut() already showed them at the machine.
   */
  let tutorialDone = false, gifted = false

  /* ══════════ gym battles ══════════ */
  /** A leader's team for this fight: the ace at their minimum or 3 above your best, the rest 2 below it; every IV at least 20. */
  function gymTeam(n) {
    // leaderLevels(): the ace at their minimum or 3 above your best, the rest 2 below (Blue mirrors your party instead); then their balance offset.
    const L = GYMS[n], lv = leaderLevels(L, party.map((m) => m.level)).map((x) => Math.min(LEVEL_CAP, x + (L.lvAdj ?? 0)))
    return L.team.map((name, i) => {
      const m = individual(DATA.trainer.find((t) => t.name === name), lv[i], rand)
      for (const k of STAT_KEYS) m.ivs[k] = Math.max(20, m.ivs[k])
      m.stats = statsAt(m, m.level); m.hp = m.stats.hp
      return m
    })
  }
  /** Summoned from the Bag: the leader's VS, their words, the battle, a badge. The summon is spent either way. */
  async function gymBattle(n, demoPlan) {
    const L = GYMS[n]
    toolsEnabled(false)
    Sound.music('gymIntro')   // the fanfare, then the intro loop under their words
    await wipeTrainer(async () => {
      setScene([L.scene]); showLayer('battle')
      const vs = $('vs'); vs.classList.add('gym'); vs.style.setProperty('--gym', L.color)
      $('vsImg').src = ART[L.vs]; $('vsName').textContent = L.full; vs.querySelector('.name span').textContent = L.title; vs.style.display = 'block'
      vsIn(vs)
    })
    if (demo) cap('GYM LEADER', `${L.short} of ${L.city}: ${L.team.length} Pokémon, above your level, with sharp move choices and a Full Restore for the last one.`)
    await W(1400)
    await talk(L, L.intro)
    vsHide()
    Sound.music('gym')
    const team = gymTeam(n)
    const out = await battle({ kind: 'trainer', foe: team[0], roster: team.slice(1), trainer: L, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(L); await talk(L, L.outro); await trainerOff()
      await out.exp?.()
      badges.push(n); sfx('levelup'); showBadge(L)
      await say(`You got the ${L.badge} BADGE`, `from ${L.short}!`, 1100)
      wallet = Math.round((wallet + +L.tokens) * 100) / 100
      sfx('tokens'); await say(`You got ${L.tokens} tokens!`, '', 600)
    } else {
      await trainerOn(L); await talk(L, L.gloat); await trainerOff()
      await say(`${L.short} headed back to the ${L.city} GYM.`, 'The SUMMON was used up.')
    }
    Sound.stopMusic(); await backToMachine('idle')
  }
  /** An Elite Four member's team: levels as leaderLevels() sets them, every IV at least 20. */
  function eliteTeam(L) {
    const lv = leaderLevels(L, party.map((m) => m.level)).map((x) => Math.min(LEVEL_CAP, x + (L.lvAdj ?? 0)))
    return L.team.map((name, i) => {
      const m = individual(DATA.trainer.find((t) => t.name === name), lv[i], rand)
      for (const k of STAT_KEYS) m.ivs[k] = Math.max(20, m.ivs[k])
      m.stats = statsAt(m, m.level); m.hp = m.stats.hp
      return m
    })
  }
  /**
   * The next rung of the Elite Four, from the ticket in the Bag. Win: tokens,
   * and the ticket stays for the next one (or, after Lance, you're Champion).
   * Lose: the ticket is gone and the ladder starts again from Will.
   */
  async function eliteBattle(demoPlan) {
    const L = ELITE[eliteStep], key = summonKey('elite')
    toolsEnabled(false)
    Sound.music('gymIntro')
    await wipeTrainer(async () => {
      setScene([L.scene]); showLayer('battle')
      const vs = $('vs'); vs.classList.add('gym'); vs.style.setProperty('--gym', L.color)
      $('vsImg').src = ART[L.vs]; $('vsName').textContent = L.full; vs.querySelector('.name span').textContent = `${L.title} · ${eliteStep + 1} OF 5`; vs.style.display = 'block'
      vsIn(vs)
    })
    await W(1400)
    await talk(L, L.intro)
    vsHide()
    Sound.music('gym')
    const team = eliteTeam(L)
    const out = await battle({ kind: 'trainer', foe: team[0], roster: team.slice(1), trainer: L, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(L); await talk(L, L.outro); await trainerOff()
      await out.exp?.()
      wallet = Math.round((wallet + +L.tokens) * 100) / 100
      sfx('tokens'); await say(`You got ${L.tokens} tokens!`, '', 600)
      eliteStep++
      if (eliteStep === ELITE.length) {
        eliteStep = 0; champion = true; bag[key] = Math.max(0, (bag[key] ?? 0) - 1)
        sfx('levelup'); await say("You're the new CHAMPION!", "The ELITE FOUR TICKET is spent. Kanto's gyms are open.", 1500)
      } else await say(`Next up: ${ELITE[eliteStep].full}.`, "Use your ELITE FOUR TICKET whenever you're ready.", 900)
    } else {
      await trainerOn(L); await talk(L, L.gloat); await trainerOff()
      bag[key] = Math.max(0, (bag[key] ?? 0) - 1)
      const from = eliteStep; eliteStep = 0
      await say('The ELITE FOUR TICKET was used up.', from ? 'The next ticket starts again from WILL.' : 'Train up and try again.', 900)
    }
    renderTools()
    Sound.stopMusic(); await backToMachine('idle')
  }
  /** The badge, popped in the middle of the screen. */
  function showBadge(L) {
    const b = document.createElement('div'); b.className = 'badgepop'; b.style.setProperty('--c', L.color); b.innerHTML = `<img src="${badgeArt(L.badge)}" alt=""><b>${L.badge} BADGE</b>`
    fx.appendChild(b)
    anim(b, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(6deg)', opacity: 1, offset: .5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 2600 })
    setTimeout(() => b.remove(), 2700)
  }
  /** Watch gym: a party of three buys a summon, uses it from the Bag, and takes on Falkner. */
  async function gymDemo() {
    for (const name of ['FUECOCO', 'QUAXLY', 'SPRIGATITO']) { const m = individual(DATA.starters.find((s) => s.name === name), 18, rand); m.hp = m.stats.hp; party.push(m) }
    tutorialDone = true; gifted = true; showTools(true); renderTools()
    cap('GYMS', "Gym Leaders from Johto: eight of them, beaten in order. You can't run into one. You summon them, with a token from the machine.")
    await backToMachine('idle'); await W(1600)
    setMachine('in')
    cap('SUMMON', "A stocked machine sometimes carries a summon. It's always for your next gym: right now that's FALKNER, so it's a ZEPHYR SUMMON.")
    hot($('home')); await tapMachine({ enc: null, items: ['summon', 'potion'] }); await W(2000)
    hot($('supplies').querySelector('[data-buy="summon"]')); buySupply('summon'); await W(1800)
    await toIdle(); await W(600)
    cap('BAG', "Summons are used from the Bag. The challenge page shows who you'll face; the summon is spent when the leader arrives, win or lose.")
    hot($('tBag')); sfx('select')
    const sh = openSheet('bag'); await W(1400)
    await sh.tap(`[data-item="${summonKey(0)}"]`, 2600)
    await sh.tap('[data-challenge]', 400)
    pendingSummon = null
    await gymBattle(0, { turns: [], defend: [] })
    cap('BADGES', 'The ZEPHYR BADGE goes in your badge case, in the Party sheet. Now the machine offers HIVE SUMMONS, for BUGSY.')
    hot($('tParty')); sfx('select'); openSheet('party'); await W(3200)
    hot($('sheetClose')); closeSheetNow()
    cap('NEXT', 'Next up: BUGSY of Azalea Town.')
    await W(2600)
  }
  /** After the first battle, win or lose: Alex hands over five Potions and five Poké Balls (once). */
  async function starterKit() {
    if (gifted) return
    gifted = true
    await talk(ALEX, ALEX.gift)
    bag.potion += 5; bag.ball += 5; renderTools(); sfx('levelup')
    await say('ALEX gave you 5 POTIONS', 'and 5 POKé BALLS!', 900)
  }
  /** Party, Bag and Box: hidden until you have a Pokémon and the first battle is behind you. */
  function showTools(on) { $('tools').hidden = !on; $('poolPanel').hidden = !on; $('home').classList.toggle('haswallet', on); $('wallet').textContent = `${wallet.toFixed(2)} tk`; if (on) renderPool(); fit() }
  /**
   * One tap of TOUCH TO START. Two separate rolls: the machine's state
   * (stocked, sold out, maintenance), and whether something's waiting: a
   * wild Pokémon or a scalper can turn up whatever the stock. `force` pins
   * either (the demo, and the "Next tap" picker in Play); `force.plan` is a
   * demo script for the encounter.
   */
  /*
   * The machine is shared: its stock state (stocked, sold out, maintenance)
   * is the same for every trainer, and only one trainer at a time can be on
   * its purchase screen (`lockedBy`). What happens when you tap is yours
   * alone: each trainer's tap rolls its own encounter, so trainers tapping at
   * the same moment get independent results, which may match or differ.
   * Battles never take the lock. In the app the stock state and the lock live
   * on the server; the encounter roll belongs there too, made per trainer per
   * tap, so it can't be predicted or replayed from the client.
   */
  const machine = { state: 'in', lockedBy: null }
  const YOU = 'YOU'
  /** One trainer's encounter roll: nothing, a wild Pokémon, a scalper, or a 2v2. */
  const ENC_RATES = { none: 0.5, wild: 0.3, scalper: 0.13, duo: 0.07 }
  function rollEncounter(r) {
    let x = r()
    for (const [k, p] of Object.entries(ENC_RATES)) { if (x < p) return k === 'none' ? null : k; x -= p }
    return null
  }
  /*
   * Empty taps. After PITY_AFTER empty taps in a row, the next one always
   * turns something up: it's rolled again among the encounters alone, at
   * their usual odds against each other. And an empty tap can still find
   * something small at the machine (FIND_CHANCE): a stray Poké Ball or
   * Potion, or a few cents of tokens left in the change slot. Each trainer's
   * run of empty taps is their own. In the app, both belong on the server
   * with the encounter roll.
   */
  const PITY_AFTER = 2, FIND_CHANCE = 0.35
  const emptyRun = {}
  /** A trainer's tap with the pity rule; `forced` (anything but undefined) pins it and skips the rule. */
  function rollTap(who, r, forced) {
    let enc = forced !== undefined ? forced : rollEncounter(r), pity = false
    if (forced === undefined && !enc && (emptyRun[who] ?? 0) >= PITY_AFTER) {
      let x = r() * (1 - ENC_RATES.none); enc = 'wild'
      for (const [k, p] of Object.entries(ENC_RATES)) { if (k === 'none') continue; if (x < p) { enc = k; break } x -= p }
      pity = true
    }
    emptyRun[who] = enc ? 0 : (emptyRun[who] ?? 0) + 1
    return { enc, pity }
  }
  /** Something small found on an empty tap ({ item } or { tokens }), or null. `sure` skips the chance. */
  function rollFind(sure = false) {
    if (!sure && flavor() >= FIND_CHANCE) return null
    const x = flavor()
    return x < 0.4 ? { item: 'ball' } : x < 0.7 ? { item: 'potion' } : { tokens: (1 + Math.floor(flavor() * 5)) * 0.05 }
  }
  const findText = (f) => f.item ? `a stray ${ITEMS[f.item].name}` : `${f.tokens.toFixed(2)} tokens in the change slot`
  /** Yours: into the Bag or the wallet, with a little pop on the machine's screen. */
  function collectFind(f) {
    if (f.item) bag[f.item] = (bag[f.item] ?? 0) + 1
    else wallet = Math.round((wallet + f.tokens) * 100) / 100
    renderTools(); $('wallet').textContent = `${wallet.toFixed(2)} tk`
    sfx(f.item ? 'click' : 'tokens')
    const el = document.createElement('div'); el.className = 'find'
    el.innerHTML = `${f.item ? `<span class="supic ${f.item}"></span>` : '<span class="coin">¢</span>'}<b>Found ${findText(f)}!</b>`
    $('home').appendChild(el)
    anim(el, [{ transform: 'translate(-50%, 12px) scale(.92)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.12 }, { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%, -10px)', opacity: 0 }], { duration: 2800, easing: 'ease-out' }).finished.then(() => el.remove(), () => el.remove())
    feed(`<b>You</b> found ${findText(f)} by the machine.`)
  }
  // Each trainer rolls from their own stream (seeded in the demos, so they replay the same).
  const OTHERS = ['MAYA', 'SAM', 'JO']
  /** One of each legendary, roaming. A fresh one replaces any that's knocked out or caught. */
  const ROAM = {}
  const spawnLegend = (name) => { const m = individual(DATA.trainer.find((t) => t.name === name), LEGEND_LEVEL, rand); m.roamer = true; ROAM[name] = m; renderRoamers(); return m }
  const pickLegend = (r = flavor) => ROAM[LEGENDS[Math.floor(r() * LEGENDS.length)]]
  const pct = (m) => Math.round(m.hp / m.stats.hp * 100)
  /** The testing panel's line: each one's HP as it stands. */
  function renderRoamers() { const el = $('roamers'); if (el) el.innerHTML = LEGENDS.filter((n) => ROAM[n]).map((n) => `${n} <b>${pct(ROAM[n])}%</b>`).join(' · ') }
  /**
   * After a legendary battle, for any trainer: a fresh one if it was knocked
   * out or caught, otherwise it keeps its HP for whoever meets it next.
   */
  function legendAfter(m, result, who) {
    if (result === 'caught' || result === 'fainted') {
      feed(`<b>${who}</b> ${result === 'caught' ? 'caught' : 'knocked out'} the roaming <b>${m.name}</b>! A new ${m.name} is roaming, at full HP.`)
      spawnLegend(m.name)
    } else feed(`The roaming <b>${m.name}</b> got away from <b>${who}</b> with <b>${pct(m)}%</b> HP left.`)
    renderRoamers()
  }
  /** Another trainer meets one: they chip at it (sometimes finish it, very rarely catch it), and it runs. */
  function otherLegend(name, r) {
    const m = pickLegend(r), hit = Math.round(m.stats.hp * (0.08 + r() * 0.3))
    m.hp = Math.max(0, m.hp - hit)
    const caught = m.hp > 0 && r() < 0.03 * (1 - m.hp / m.stats.hp)
    feed(`<b>${name}</b> tapped: the roaming legendary <b>${m.name}</b> burst out!`)
    legendAfter(m, caught ? 'caught' : m.hp <= 0 ? 'fainted' : 'fled', name)
  }
  const streams = Object.fromEntries([YOU, ...OTHERS].map((n, i) => [n, demo ? rng(101 + i * 17) : Math.random]))
  const ENC_TEXT = { null: 'nothing jumped out', wild: 'a wild Pokémon jumped out', scalper: 'a trainer stopped them', duo: 'a double battle stopped them' }

  /*
   * Wild pools, one per real machine. Each machine's pool is six species
   * drawn from the wild list, picked fresh every week (Monday) from the
   * machine's code and the week, so everyone on that machine sees the same
   * six and nobody can predict next week's from this week's.
   *
   * A trainer's seed is the machine of their latest timer report. With no
   * reports yet, they're given a random active machine, fixed for the week
   * (from their id and the week) so it doesn't reshuffle every tap. In the
   * app, MACHINES is the `machines` table and the report is a `timer_reports`
   * row; the seed lookup and the weekly pick belong on the server.
   */
  const MACHINES = [
    { code: 'VVM-101', venue: 'Riverside Mall', city: 'food court' },
    { code: 'VVM-114', venue: 'Union Station', city: 'main concourse' },
    { code: 'VVM-127', venue: 'Northgate Plaza', city: 'east entrance' },
    { code: 'VVM-139', venue: 'Harbor Arcade', city: 'pier level' },
    { code: 'VVM-152', venue: 'West Commons', city: 'lower level' },
    { code: 'VVM-166', venue: 'Campus Center', city: 'student union' },
  ]
  const POOL_SIZE = 6
  const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
  // Weeks since the epoch, rolling over on Monday. The demo is pinned to one week so it always plays the same.
  let weekShift = 0
  const thisWeek = () => (demo ? 2900 : Math.floor((Date.now() / 864e5 + 3) / 7)) + weekShift
  const nextRotation = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d - Date.now() }
  /** A machine's six species for a week. */
  function poolFor(code, week = thisWeek()) {
    const r = rng(hashStr(`${code}:${week}`)), names = DATA.wild.map((w) => w.name)
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]] }
    return names.slice(0, POOL_SIZE)
  }
  /** Each trainer's seed: the machine of their latest report, or a random one for the week. */
  const trainerId = (() => { if (demo) return 'demo-trainer'; try { let id = localStorage.getItem('vvm-trainer-id'); if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('vvm-trainer-id', id) } return id } catch { return 'guest' } })()
  const reports = {}   // trainer -> { code, week } of their latest timer report
  function seedOf(who) {
    if (reports[who]) return { m: MACHINES.find((x) => x.code === reports[who].code), why: 'report' }
    return { m: MACHINES[hashStr(`${who === YOU ? trainerId : who}:${thisWeek()}`) % MACHINES.length], why: 'random' }
  }
  /** A timer report: the trainer moves to that machine's pool. */
  function reportTimer(who, code) {
    reports[who] = { code, week: thisWeek() }
    if (who === YOU) { renderPool(true); feed(`<b>You</b> reported a timer at <b>${code}</b>. Your wild Pokémon now come from its pool.`) }
    else feed(`<b>${who}</b> reported a timer at <b>${code}</b>.`)
  }
  const wildFrom = (who, roll = Math.random) => { const pool = poolFor(seedOf(who).m.code), name = pool[Math.floor(roll() * pool.length)]; return DATA.wild.find((w) => w.name === name) }
  function renderPool(flash = false) {
    const { m, why } = seedOf(YOU), ms = nextRotation(), dd = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24
    $('poolWhere').innerHTML = `<b>${m.code}</b> · ${m.venue}, ${m.city}<small>${why === 'report' ? 'from your latest timer report' : 'random machine (no timer reports yet) · report a timer to choose'}</small>`
    $('poolWhen').textContent = demo ? 'changes every Monday' : weekShift ? `week +${weekShift}` : `changes in ${dd}d ${hh}h`
    $('poolMons').innerHTML = poolFor(m.code).map((n) => { const w = DATA.wild.find((x) => x.name === n); return `<span><img src="${ART[w.id]}" alt="">${n}</span>` }).join('')
    if (flash) anim($('poolPanel'), [{ boxShadow: '0 0 0 3px #facc15' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 900 })
  }

  function feed(text) {
    $('feed').hidden = false
    const li = document.createElement('li'); li.innerHTML = text
    $('feedList').prepend(li); while ($('feedList').children.length > 6) $('feedList').lastChild.remove()
    anim(li, [{ background: 'rgba(250, 204, 21, .35)' }, { background: 'transparent' }], { duration: 900 })
  }
  function setMachine(state) {
    machine.state = state; $('machineState').value = state
    if (state !== 'in' && machine.lockedBy) machine.lockedBy = null
    if (homeState === 'idle') renderHome('idle')
  }
  // Each hold of the purchase screen gets its own ticket, so a finished visit's
  // timer can't release a later visit by the same trainer.
  let lockSeq = 0
  function lockFor(name) { machine.lockedBy = name; machine.lockId = ++lockSeq; if (homeState === 'idle') renderHome('idle'); return machine.lockId }
  function unlock(name, id = machine.lockId) { if (machine.lockedBy === name && machine.lockId === id) machine.lockedBy = null; if (homeState === 'idle') renderHome('idle') }

  /**
   * Another trainer's tap, against the same machine: their own roll, and the
   * purchase screen if they get through to it and it's free.
   */
  function otherTaps(name, forced) {
    const { enc } = rollTap(name, streams[name], forced)
    const found = !enc && forced === undefined ? rollFind() : null
    if (found) feed(`<b>${name}</b> found ${findText(found)} by the machine.`)
    if (enc === 'wild' && streams[name]() < LEGEND_RATE) return otherLegend(name, streams[name])
    if (enc === 'wild') { const w = wildFrom(name, streams[name]); return feed(`<b>${name}</b> tapped: a wild <b>${w.name}</b> jumped out <small>(${seedOf(name).m.code}'s pool)</small>.`) }
    if (enc) return feed(`<b>${name}</b> tapped: ${ENC_TEXT[enc]}.`)
    if (machine.state !== 'in') return feed(`<b>${name}</b> tapped: ${machine.state === 'out' ? 'sold out' : 'under maintenance'}.`)
    if (machine.lockedBy) return feed(`<b>${name}</b> tapped, but ${machine.lockedBy === YOU ? 'you are' : machine.lockedBy + ' is'} on the purchase screen.`)
    const id = lockFor(name); feed(`<b>${name}</b> is on the purchase screen.`)
    setTimeout(() => { if (!live() || machine.lockId !== id) return; unlock(name, id); feed(`<b>${name}</b> finished buying.`) }, 7000 + Math.floor(Math.random() * 4000))
  }

  /**
   * Your tap. The stock state is the machine's; the encounter is your own
   * roll. With nothing waiting on a stocked machine you go to the purchase
   * screen, unless another trainer is already on it. `force` pins the
   * encounter (the demo, "Your next tap"); `force.plan` is a demo script.
   */
  async function tapMachine(force = {}) {
    const state = machine.state
    tickRest()   // beaten trainers' rest counts down with your taps
    const { enc, pity } = rollTap(YOU, streams[YOU], 'enc' in force ? force.enc : undefined)
    // An empty tap may still turn up something small ("Your next tap" can ask for one; the demo's pinned taps never do).
    const found = enc ? null : force.find ? rollFind(true) : 'enc' in force ? null : rollFind()
    // Each enabled supply is on a stocked shelf with its appearance rate as the chance.
    // Bundles the same way, each with its own rate.
    if (state === 'in') shelfItems = force.items ?? [...Object.keys(SHOP).filter((k) => SHOP[k].on && (k !== 'summon' || (nextGym() < GYMS.length && (nextGym() < 8 || champion))) && (k !== 'elite' || (badges.length >= 8 && !champion)) && !(ITEMS[k].key && bag[k]) && flavor() * 100 < SHOP[k].rate),
      ...BUNDLES.filter((b) => b.on && BUNDLE_ITEMS.some((i) => b.items[i] > 0) && flavor() * 100 < b.rate).map((b) => 'bundle:' + b.id)]
    $('tts').textContent = 'STARTING…'; sfx('select'); await W(450)
    // The purchase screen is one trainer at a time; encounters don't need it.
    const waiting = !enc && state === 'in' && machine.lockedBy && machine.lockedBy !== YOU
    if (!enc && state === 'in' && !waiting) lockFor(YOU)
    await fadeThrough(async () => {
      renderHome(state)
      if (waiting) { $('home').classList.add('waiting'); $('home').classList.remove('has-sup'); $('supplies').innerHTML = ''; $('homeLine').textContent = `${machine.lockedBy} IS USING IT`; $('homeSub').textContent = 'the purchase screen is one trainer at a time · tap to go back' }
    })
    if (found) collectFind(found)
    if (pity) feed(`<b>You</b>: after two empty taps, this one was sure to turn something up.`)
    if (enc === 'wild') return wildEncounter(force.plan, state, force.legend)
    if (enc === 'scalper') return scalperEncounter(force.plan, state)
    if (enc === 'duo') return duoEncounter(force.plan, flavor() < 0.5 ? 'tag' : 'solo', state)
  }
  /** Back to idle, giving up the purchase screen if you had it. */
  const toIdle = () => fadeThrough(async () => { if (machine.lockedBy === YOU) machine.lockedBy = null; renderHome('idle') })
  async function firstEncounter(demoPlan) {
    toolsEnabled(false)
    const crew = [HERB, PAUL]
    Sound.music('vs')
    await wipeTrainer(async () => { $('homeLoiterer2')?.remove(); setScene(SCALPER_SCENES, sceneRoll); showLayer('battle'); vsSplash(crew, 2) })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    if (demo) cap('FIRST RESTOCK', "Your very first restock, and two scalpers are already camping it. You don't even have a Pokémon yet.")
    await W(1400)
    await talk(HERB, FIRST_TAUNT.HERB); await talk(PAUL, FIRST_TAUNT.PAUL)
    vsHide()
    // Alex steps in.
    sfx('select'); allySplash(ALEX, 'TRAINER · HERE TO HELP')
    if (demo) cap('ALEX', 'Alex steps in. He has you pick a starter, then fights beside you as your partner in a 2v2.')
    await W(1100)
    if (!party.length) {
      await talk(ALEX, ALEX.hello)
      vsHide()
      const me = await pickStarter()
      party.push(me); renderTools()
      if (demo) cap('IVS', `These numbers are this ${me.name}'s alone: a hidden value (IV) from 0 to 31 per stat, and a nature that boosts one stat 10% and lowers another.`)
      await summary(me, `Every ${me.name} rolls its own IVs and nature. No two are alike.`, `${me.name} joined your party!`, 'Its stats are its own.')
      allySplash(ALEX, 'YOUR PARTNER'); await W(500)
      await talk(ALEX, ALEX.picked(me.name))
    } else await talk(ALEX, ALEX.again)
    vsHide()
    Sound.music('battle')
    if (demo) cap('TUTORIAL', 'You command your Pokémon; Alex commands Porygon and hits his own rings. He explains each thing the first time it comes up.')
    // Gentle opponents, and a partner a little ahead of you.
    const foes = crew.map((T) => ({ mon: individual(DATA.trainer.find((t) => t.name === T.mon), 4, rand), owner: T }))
    const porygon = individual(DATA.trainer.find((t) => t.name === ALEX.mon), 8, rand)
    const out = await duoBattle({ foes, trainers: crew, allies: [{ mon: porygon, owner: ALEX }], tips: { who: ALEX, ...TUTORIAL_TIPS }, plan: demoPlan })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      for (const T of crew) { await trainerOn(T, 'down'); await talk(T, pickOf(T.outro), 'faceDown'); await trainerOff() }
      await out.exp(); out.cleanup()   // EXP after their parting words, then tokens
      wallet = Math.round((wallet + 1.75) * 100) / 100
      sfx('tokens'); await say('You got 1.75 tokens!', 'The VVM is free!', 600)
      for (const T of crew) await loot(T)
      await trainerOn(ALEX); await talk(ALEX, ALEX.won); await starterKit(); await trainerOff()
      tutorialDone = true; showTools(true)
      Sound.stopMusic(); await backToMachine('idle')
    } else {
      out.cleanup()
      await trainerOn(ALEX); await talk(ALEX, ALEX.lost); await starterKit(); await trainerOff()
      showTools(true)
      party.forEach((m) => { m.hp = m.stats.hp })   // Alex patches you up
      Sound.stopMusic(); await backToMachine('in', true)
      await campOut(crew)
    }
  }
  /** The VS splash's slide-ins. `fill: 'both'` holds each one at its start during
   *  its delay; without it they sat in place, jumped out, then slid in again. */
  function vsIn(vs) {
    const o = (delay, duration, easing = 'ease-out') => ({ delay, duration, easing, fill: 'both' })
    anim(vs.querySelector('.b1'), [{ transform: 'skewY(-12deg) translateX(-110%)' }, { transform: 'skewY(-12deg) translateX(0)' }], o(250, 300))
    anim(vs.querySelector('.b2'), [{ transform: 'skewY(-12deg) translateX(110%)' }, { transform: 'skewY(-12deg) translateX(0)' }], o(250, 300))
    anim($('vsImg').parentElement, [{ transform: 'translateX(240px)' }, { transform: 'none' }], o(400, 420, 'cubic-bezier(.2,.8,.3,1)'))
    anim(vs.querySelector('.big'), [{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], o(760, 260))
    anim(vs.querySelector('.name'), [{ transform: 'translateX(-260px)' }, { transform: 'none' }], o(620, 320))
  }

  /** Watch 2v2: a party of two, straight to the tag team. */
  async function duoDemo() {
    for (const n of ['FUECOCO', 'QUAXLY']) {
      const m = individual(DATA.starters.find((s) => s.name === n), 15, rand); m.hp = m.stats.hp; party.push(m)
      // The script's moves, equipped (the level schedule alone would carry others).
      learn(m); m.moves = n === 'FUECOCO' ? ['TACKLE', 'DOUBLE HIT', 'HOWL', 'HEAT WAVE'] : ['POUND', 'WATER SHURIKEN', 'LIFE DEW', 'SURF']
      for (const x of m.moves) if (!m.learned.includes(x)) m.learned.push(x)
    }
    discItem('HELPING HAND'); bag[discKey('HELPING HAND')] = 1
    showTools(true); renderTools()
    cap('2V2', 'A party of two at Lv 15: FUECOCO and QUAXLY. Each carries four moves into battle.')
    await backToMachine('out'); await W(1300)
    // Moves come with levels: the Box shows what each has learned, and what's next.
    cap('LEVELS', 'Moves are learned with levels: a type move at 3, QUICK ATTACK at 6, multi-hit at 9, support at 12, spread at 15. At Lv 15 FUECOCO knows six and carries four.')
    hot($('tBox')); sfx('select')
    let sh = openSheet('box'); await W(1400)
    await sh.tap('[data-mon="0"]', 3600)
    hot($('sheetClose')); closeSheetNow(); await W(500)
    // ...and Move Discs teach anything else.
    cap('MOVE DISC', 'Move Discs teach a move straight away. QUAXLY learns HELPING HAND from one, then swaps it in for WATER SHURIKEN.')
    hot($('tBag')); sfx('select')
    sh = openSheet('bag'); await W(1300)
    await sh.tap(`[data-item="${discKey('HELPING HAND')}"]`, 1200)
    await sh.tap('[data-target="1"]', 2200)
    await sh.tap('[data-slot="1"]', 800); await sh.tap('[data-learn="HELPING HAND"]', 1800)
    hot($('sheetClose')); closeSheetNow(); await W(600)
    await duoEncounter([
      { cap: ['PRIORITY', "QUAXLY's HELPING HAND has +5 priority: it goes before everyone and powers up FUECOCO's next move ×1.5 (×1.75 on a PERFECT)."],
        cmds: [{ move: 'DOUBLE HIT', target: 1, planned: ['perfect', 'great'] }, { move: 'HELPING HAND', planned: 'perfect' }],
        foes: { GHOLDENGO: { move: 'MAKE IT RAIN', target: 1 }, HIPPOWDON: { move: 'BULLDOZE' } },
        defend: ['parry', 'parry', 'parry', 'jump', 'jump'],
        capAt: { 'MAKE IT RAIN': ['TARGETS', 'Attacks pick a target: the ring shows up on whichever of yours is hit. Parry all three for a counter.'],
          BULLDOZE: ['SPREAD', 'BULLDOZE hits both of yours: two rings, two jumps.'],
          'DOUBLE HIT': ['MULTI-HIT', 'DOUBLE HIT hits twice: one ring per hit, and only landing both deals full damage.'] } },
      { cap: ['BUFF', 'HOWL raises ATTACK for both of yours, so physical hits like DOUBLE HIT land harder from here on.'],
        cmds: [{ move: 'HOWL', planned: 'perfect' }, { move: 'LIFE DEW', planned: 'great' }],
        foes: { GHOLDENGO: { move: 'LOW KICK', target: 0 }, HIPPOWDON: { move: 'CRUNCH', target: 1 } },
        defend: ['late', 'dodge'],
        capAt: { 'LIFE DEW': ['HEAL', 'LIFE DEW heals both of yours. The ASSIST ring scales it: a GREAT heals more than an OK.'] } },
      { cap: ['SPREAD', 'HEAT WAVE hits both foes. SURF hits everyone else, FUECOCO included, so FUECOCO jumps it.'],
        cmds: [{ move: 'HEAT WAVE', planned: ['perfect', 'great'] }, { move: 'SURF', planned: ['great', 'perfect'] }],
        foes: { GHOLDENGO: { move: 'SHADOW BALL', target: 1 }, HIPPOWDON: { move: 'SLACK OFF' } },
        defend: ['parry'],
        capAt: { 'SLACK OFF': ['THEIRS TOO', 'Scalpers\' Pokémon have support moves as well: HIPPOWDON patches itself up with SLACK OFF.'],
          SURF: ['FRIENDLY FIRE', 'SURF rolls on into your own partner. Its ring is the amber JUMP oval: jump it and FUECOCO takes nothing.'] } },
      { cap: ['STACKED', 'ATTACK is up two stages from HOWL: DOUBLE HIT lands twice as hard.'],
        cmds: [{ move: 'DOUBLE HIT', target: 1, planned: ['perfect', 'perfect'] }, { move: 'SURF', planned: ['perfect', 'perfect'] }] },
      { cmds: [{ move: 'HEAT WAVE', planned: ['perfect', 'perfect'] }, { move: 'SURF', planned: ['perfect', 'perfect'] }] },
      { cmds: [{ move: 'HEAT WAVE', planned: ['perfect', 'perfect'] }, { move: 'POUND', target: 0, planned: 'perfect' }] },
    ])
    cap('FREE', 'Both scalpers beaten: their tokens add up, and the machine is back to normal.')
    await W(3000)
  }
  /* ── effects ── */
  function pop(text, x, y, cls = '') {
    const el = document.createElement('div'); el.className = 'pop ' + cls
    el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px'; fx.appendChild(el)
    anim(el, [{ transform: 'translate(-50%,8px) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-4px) scale(1.15)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-14px) scale(1)', opacity: 1, offset: .75 }, { transform: 'translate(-50%,-22px)', opacity: 0 }], { duration: 950 })
    setTimeout(() => el.remove(), 1000)
  }
  function sparks(x, y, color = '#fde047', n = 10) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div'), a = (i / n) * Math.PI * 2, d = 26 + (i % 3) * 9
      s.style.cssText = `position:absolute;left:${x - 3}px;top:${y - 3}px;width:6px;height:6px;background:${color};box-shadow:0 0 6px ${color}`
      fx.appendChild(s)
      anim(s, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' })
      setTimeout(() => s.remove(), 460)
    }
  }
  function flash(color = '#fff', o = .8, dur = 160) { const f = $('flash'); f.style.background = color; anim(f, [{ opacity: o }, { opacity: 0 }], { duration: dur }) }
  function shake(px = 6, dur = 360) { $('screen').animate([0, -px, px, -px * .7, px * .7, -px * .3, 0].map((v) => ({ transform: `translate(${v}px, ${v * .3}px)` })), { duration: dur }) }
  async function blink(el, n = 3) { for (let i = 0; i < n; i++) { el.style.opacity = '0'; await W(65); el.style.opacity = '1'; await W(65) } }
  function ring(cx, cy, approach, label) {
    const R = 32
    const t = document.createElement('div'); t.className = 'target'; t.style.cssText = `left:${cx - R}px;top:${cy - R}px;width:${R * 2}px;height:${R * 2}px`
    const r = document.createElement('div'); r.className = 'ring'; r.style.cssText = `left:${cx - R}px;top:${cy - R}px;width:${R * 2}px;height:${R * 2}px`
    fx.append(t, r)
    let g = null
    if (label) { g = document.createElement('div'); g.className = 'glyph'; g.textContent = label; g.style.left = cx + 'px'; g.style.top = (cy - R - 20) + 'px'; fx.appendChild(g) }
    anim(r, [{ transform: 'scale(2.6)', opacity: .1 }, { transform: 'scale(1)', opacity: 1 }], { duration: approach, easing: 'linear' })
    return { el: r, clear: () => { t.remove(); r.remove(); g?.remove() } }
  }
  function accuracy(dt) {
    if (dt <= 40) return { label: 'PERFECT', mult: 1.6, crit: true, color: '#fde047' }
    if (dt <= 320) {
      const mult = 1.45 - (dt - 40) / 280 * 0.65
      const label = dt <= 120 ? 'GREAT' : dt <= 220 ? 'GOOD' : 'OK'
      return { label, mult, crit: false, color: label === 'GREAT' ? '#86efac' : label === 'GOOD' ? '#7dd3fc' : '#e2e8f0' }
    }
    return { label: 'MISS', mult: 0.7, crit: false, color: '#fca5a5' }
  }
  /** `tight` < 1 narrows every grade's window (an accuracy drop). */
  async function timedTap(planned, cx, cy, label, approach = 820, tight = 1) {
    const t0 = performance.now(), closeAt = t0 + approach
    let first = null
    const rg = ring(cx, cy, approach, label)
    const off = listen((btn, t) => {
      if (first || btn !== 'a' || t < t0) return
      first = t; rg.el.getAnimations().forEach((a) => a.pause()); rg.el.style.borderColor = accuracy(Math.abs(t - closeAt) / tight).color
    })
    if (demo) setTimeout(() => { if (live()) { hot($('bStrike')); press('a') } }, planned === 'perfect' ? approach - 20 : planned === 'great' ? approach - 90 : approach + 160)
    await W(approach); if (!first) await W(240)
    off(); await W(120); rg.clear()
    return accuracy(first == null ? Infinity : Math.abs(first - closeAt) / tight)
  }

  /* ── sprites, HUD ── */
  function place(el, src, cx, by, scale, maxH = Infinity, maxW = Infinity) {
    return new Promise((res) => {
      const img = el.querySelector('img'); let done = false
      const fin = () => {
        if (done) return; done = true
        // Tall or wide species shrink to fit, so none of them clip.
        const k = Math.min(scale, maxH / img.naturalHeight, maxW / img.naturalWidth)
        const w = img.naturalWidth * k, h = img.naturalHeight * k
        el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.left = (cx - w / 2) + 'px'; el.style.top = (by - h) + 'px'
        res({ x: cx, y: by - h / 2 })
      }
      img.onload = fin; img.src = src
      if (img.complete && img.naturalWidth) fin()
    })
  }
  const C = { e: { x: 220, y: 74 }, p: { x: 100, y: 150 } }
  // Where each side's feet meet its platform, and the most room a sprite gets
  // there: the enemy stays below the top edge, the player below the foe's HUD.
  const FOOT = { e: { x: 220, y: 114, maxH: 106, maxW: 190 }, p: { x: 100, y: 194, maxH: 132, maxW: 190 } }
  const hpColor = (p) => (p > 50 ? '#4ade80' : p > 20 ? '#facc15' : '#f87171')
  function setHP(which, hp, max) {
    const bar = $(which === 'p' ? 'php' : 'ehp'), pct = Math.max(0, hp) / max * 100
    bar.getAnimations().forEach((a) => a.cancel()); bar.style.width = pct + '%'; bar.style.background = hpColor(pct)
    if (which === 'p') $('pnum').textContent = `${Math.max(0, hp)}/${max}`
  }
  async function drain(which, from, to, max) {
    const bar = $(which === 'p' ? 'php' : 'ehp')
    const a = from / max * 100, b = Math.max(0, Math.min(max, to)) / max * 100
    const dur = Math.min(700, 180 + Math.abs(from - to) * 40)
    anim(bar, [{ width: a + '%', background: hpColor(a) }, { width: b + '%', background: hpColor(b) }], { duration: dur })
    if (which === 'p') {
      const steps = Math.max(1, Math.abs(from - to))
      for (let i = 1; i <= steps; i++) { await W(dur / steps); $('pnum').textContent = `${Math.max(0, Math.round(from + (to - from) * i / steps))}/${max}` }
    } else await W(dur)
  }
  let pp = 3
  function setPP(n, gained = false) {
    pp = Math.max(0, Math.min(5, n))
    const pips = [...$('ppips').querySelectorAll('i')]; pips.forEach((p, i) => p.classList.toggle('on', i < pp))
    if (gained) { sfx('pp'); const p = pips[pp - 1]; if (p) anim(p, [{ transform: 'scale(2)' }, { transform: 'scale(1)' }], { duration: 280 }) }
  }

  function showSummary(mon, extra = '') {
    const [nat, up, dn] = mon.nature
    const rows = STAT_KEYS.map((k) => {
      const cls = up === k ? 'up' : dn === k ? 'dn' : '', mark = up === k ? ' ▲' : dn === k ? ' ▼' : ''
      const pct = mon.ivs[k] / 31 * 100
      const col = mon.ivs[k] >= 30 ? '#fde047' : mon.ivs[k] >= 21 ? '#4ade80' : mon.ivs[k] >= 11 ? '#60a5fa' : '#94a3b8'
      return `<tr><td class="k ${cls}">${STAT_LABEL[k]}${mark}</td><td class="v">${mon.stats[k]}</td><td class="bar"><div><i style="width:${pct}%;background:${col}"></i></div></td><td class="iv">IV <b>${mon.ivs[k]}</b>/31</td></tr>`
    }).join('')
    const total = STAT_KEYS.reduce((s, k) => s + mon.ivs[k], 0)
    const natLine = up ? `<b>${nat}</b> nature: <em>${STAT_LABEL[up]} +10%</em>, <i>${STAT_LABEL[dn]} −10%</i>` : `<b>${nat}</b> nature: no stat changes`
    $('sum').innerHTML = `<div class="pic"><img src="${ART[mon.id]}" style="height:80px" alt=""></div>
      <div class="hd"><b>${mon.name}</b><span class="lv">Lv ${mon.level}</span>
        <div class="types">${mon.types.map((t) => `<span style="background:${TYPE_COL[t]};color:#111">${t}</span>`).join('')}<span class="ivt">IV total <b>${total}</b>/186</span></div>
        <div class="nat">${natLine}</div></div>
      <table>${rows}</table><div class="evo">${extra}</div>`
    $('sum').style.display = 'block'
    anim($('sum'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260 })
  }
  async function summary(mon, extra, line1, line2) {
    showSummary(mon, extra)
    panel('pNext'); msg0(line1, line2)
    if (demo) await demoPress('a', 3600, $('pNext').firstElementChild); else await waitFor(['a'])
    sfx('select'); panel(null); $('sum').style.display = 'none'
  }

  /* ── trainer on the field, and talking ── */
  function trainerOn(T, pose = 'body') {
    return new Promise((res) => {
      const el = $('trainer'), img = el.querySelector('img')
      const go = () => {
        // Scalpers stand on the far platform; a partner (Alex) on yours, nearer and bigger.
        const near = !!T.ally, h = near ? 150 : 108, w = img.naturalWidth / img.naturalHeight * h
        el.style.height = h + 'px'; el.style.width = w + 'px'; el.style.left = ((near ? 92 : 220) - w / 2) + 'px'; el.style.top = ((near ? 196 : 117) - h) + 'px'
        el.style.display = 'block'; el.style.visibility = 'visible'
        anim(el, [{ transform: `translateX(${near ? -200 : 200}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(res)
      }
      img.style.imageRendering = T.pixel ? 'pixelated' : ''
      img.onload = go; img.src = ART[T[pose]]
      if (img.complete && img.naturalWidth) { img.onload = null; go() }
    })
  }
  async function trainerOff() {
    const near = parseFloat($('trainer').style.left) < 160
    await anim($('trainer'), [{ transform: 'none', opacity: 1 }, { transform: `translateX(${near ? -180 : 180}px)`, opacity: 0 }], { duration: 340, easing: 'ease-in' }).finished
    $('trainer').style.display = 'none'
  }
  async function talk(T, lines, face = 'face') {
    $('msg').style.display = 'none'; panel(null)
    $('face').src = ART[T[face]]; $('tag').textContent = T.short; $('talk').querySelector('.sub').textContent = T.role ?? 'SCALPER'; $('talk').style.display = 'block'
    for (const line of lines) {
      $('say').textContent = ''; $('hint').textContent = ''
      for (let i = 1; i <= line.length; i++) { $('say').textContent = line.slice(0, i); await W(Math.round(18 * APP.charMs / 13)) }
      $('hint').textContent = demo ? '' : matchMedia('(pointer: coarse)').matches ? 'TAP ▶' : 'A ▶'
      if (demo) await W(950); else await waitFor(['a'])
      sfx('advance')
    }
    $('talk').style.display = 'none'; $('msg').style.display = 'block'
  }

  /* ══════════ the battle, wild or trainer ══════════ */
  async function battle({ kind, foe, trainer, roster = [], plan, planD }) {
    let me = party.find((m) => m.hp > 0)
    const foeTeam = kind === 'trainer' ? [foe, ...roster] : null   // a wild Pokémon has no team to show
    watchBalls($('eBalls'), $('pBalls'), () => ({ enemy: foeTeam, enemyOut: [foe], mine: party, mineOut: [me] }), () => getComputedStyle($('battleL')).display !== 'none')
    // Stat stages for this battle (Howl, Growth). Switching out clears them, as in the games.
    const stg = new Map(), ST = (m) => { if (!stg.has(m)) stg.set(m, { atk: 0, spa: 0, acc: 0, eva: 0 }); return stg.get(m) }
    const showTags = () => {
      const t = ST(me); $('ptags').innerHTML = statusChip(me) + [t.atk && `ATK▲${t.atk > 1 ? t.atk : ''}`, t.spa && `SP.A▲${t.spa > 1 ? t.spa : ''}`, ...stageTags(t)].filter(Boolean).map((x) => `<span>${x}</span>`).join('')
      $('etags').innerHTML = statusChip(foe) + stageTags(ST(foe)).map((x) => `<span>${x}</span>`).join('')
    }
    const who = (m) => `${m === foe && kind === 'wild' ? 'The wild ' : ''}${m.name}`
    /** Inflict a status (from a hit or a move); false if it can't take it. */
    async function afflict(m, st) {
      if (!st || !canTake(m, st)) return false
      m.status = st; sfx(st === 'par' ? 'zap' : st === 'brn' ? 'whoosh' : st === 'frz' ? 'clang' : 'shadow'); showTags()
      await say(who(m), STATUS_GOT[st], 400); return true
    }
    /** At its turn: can it move? Says why not (or that it thawed). */
    async function blockedByStatus(m) {
      const r = statusAtAction(m, rand); if (!r) return false
      if (r === 'thaw') { showTags(); await say(who(m), STATUS_TEXT.thaw, 300); return false }
      await say(who(m), STATUS_TEXT[r], 500); return true
    }
    /** End of a turn: burn or poison damage. */
    async function tickStatus(m) {
      const d = statusTick(m); if (!d) return
      const from = m.hp; m.hp = Math.max(0, m.hp - d); sfx('hitWeak')
      if (m === me) await drain('p', from, me.hp, me.stats.hp); else await drain('e', from, foe.hp, foe.max)
      renderTools(); await say(who(m), `is hurt by its ${m.status === 'brn' ? 'burn' : 'poison'}!`, 300)
    }
    /** A stage change from a status move (or Mud-Slap), with its line. */
    async function stage(m, key, by, isFoe) {
      const t = ST(m), from = t[key]; t[key] = Math.max(-STAGE_MAX, Math.min(STAGE_MAX, t[key] + by))
      const name = `${isFoe && kind === 'wild' ? 'The wild ' : ''}${m.name}'s ${key === 'acc' ? 'accuracy' : 'evasiveness'}`
      if (t[key] === from) return say(name, `won't go any ${by > 0 ? 'higher' : 'lower'}!`)
      sfx(by > 0 ? 'levelup' : 'flinch'); rise(isFoe ? C.e : C.p, by > 0 ? '#93c5fd' : '#94a3b8', by > 0 ? 'arrow' : 'dot'); showTags()
      await say(name, `${by > 0 ? 'rose' : 'fell'}${Math.abs(by) > 1 ? ' sharply' : ''}!`, 300)
    }
    foe.max = foe.stats.hp; foe.turn = 0
    const movesFor = (f) => (f.roamer && LEGEND_MOVES[f.name]) || (kind === 'trainer' && trainer?.sig && !roster.length && trainer.sig) || (kind === 'trainer' && trainer?.region === 'kanto' && strongMoves(f)) || (kind === 'trainer' && TRAINER_MOVES[f.name]) || (f.name === 'MAGIKARP' ? MAGIKARP : WILD_MOVES[f.types[0]] ?? WILD_MOVES.normal)   // a leader's ace (their last) fights with the leader's own moves
    let restored = false   // a Gym Leader's one Full Restore
    let sigUsed = false    // a leader's signature status move, once a battle
    let quipped = false    // a leader's first tell always gets a quip; later ones, half the time
    let fled = false       // a roaming legendary ran
    let foeMoves = movesFor(foe)
    plan = plan ? [...plan] : null; planD = planD ? [...planD] : null

    $('ename').textContent = foe.name; $('elv').textContent = foe.level; setHP('e', foe.hp, foe.max)
    const er = await place($('enemy'), ART[foe.id], FOOT.e.x, FOOT.e.y, 1.6, FOOT.e.maxH, FOOT.e.maxW)
    C.e = { x: er.x, y: er.y }

    if (kind === 'wild') {
      Sound.music('wild')
      $('enemy').style.visibility = 'visible'
      await anim($('enemy'), [{ transform: 'translateX(-230px)', filter: 'brightness(0)' }, { transform: 'none', filter: 'brightness(0)', offset: .75 }, { transform: 'none', filter: 'brightness(1)' }], { duration: 760, easing: 'ease-out' }).finished
      $('enemy').getAnimations().forEach((a) => a.cancel())
      $('ehud').style.visibility = 'visible'; anim($('ehud'), [{ transform: 'translateX(-180px)' }, { transform: 'none' }], { duration: 280 })
      cry(foe)
      if (foe.roamer) { shake(8, 500); await say(`The roaming legendary ${foe.name}`, `appeared! (${Math.round(foe.hp / foe.max * 100)}% HP)`, 700) }
      else await say(`A wild ${foe.name}`, 'appeared!', 300)
    } else {
      await trainerOn(trainer)
      if (roster.length) await say(`${trainer.short} has`, `${roster.length + 1} Pokémon on deck!`, 300)
      await say(...sentOut(trainer, foe), 120)
      sfx('ball'); await trainerOff()
      $('enemy').style.visibility = 'visible'; flash('#fff', .5, 180)
      cry(foe); await anim($('enemy'), [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380 }).finished
      $('ehud').style.visibility = 'visible'; anim($('ehud'), [{ transform: 'translateX(-180px)' }, { transform: 'none' }], { duration: 280 })
    }

    async function sendOut(m) {
      // A faint leaves its slide-and-clip held on the sprite (anim fills forwards); clear it or the next one comes out invisible.
      $('player').getAnimations().forEach((a) => a.cancel())
      const pr = await place($('player'), ART[m.id + 'b'], FOOT.p.x, FOOT.p.y, 2.0, FOOT.p.maxH, FOOT.p.maxW)
      C.p = { x: pr.x, y: Math.min(pr.y, 200) }
      await say(`Go! ${m.name}!`, '', 100)
      sfx('ball'); $('player').style.visibility = 'visible'; flash('#fff', .5, 180)
      cry(m); await anim($('player'), [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380 }).finished
      $('pname').textContent = m.name; $('plv').textContent = m.level; setHP('p', m.hp, m.stats.hp)
      $('pexp').getAnimations().forEach((a) => a.cancel()); $('pexp').style.width = (m.exp ?? 0) / expToNext(m.level) * 100 + '%'
      $('phud').style.visibility = 'visible'; anim($('phud'), [{ transform: 'translateX(180px)' }, { transform: 'none' }], { duration: 280 })
    }
    await sendOut(me); setPP(startPP(me)); showTags()   // PP: 1, or 2 for a quick nature

    function damage(att, def, mv, mult) {
      const A = (mv.cat === 'spec' ? att.stats.spa : att.stats.atk) * stageMult(ST(att)[mv.cat === 'spec' ? 'spa' : 'atk']), D = mv.cat === 'spec' ? def.stats.spd : def.stats.def
      const base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * mv.power * A / D) / 50) + 2
      const stab = att.types.includes(mv.type) ? 1.5 : 1
      const eff = soften(gameMult(mv.type, def.types))
      const burn = att.status === 'brn' && mv.cat !== 'spec' ? 0.5 : 1
      return { dmg: Math.max(1, Math.round(base * stab * eff * mult * burn)), eff }
    }

    /* ── menus: one top level, each with its own page ── */
    function drawMain() {
      $('pMain').innerHTML =
        `<button class="btn bFight" data-act="fight">FIGHT</button>` +
        `<button class="btn bm3 a t-bag" data-act="bag">BAG</button>` +
        `<button class="btn bm3 b t-party" data-act="party">POKéMON</button>` +
        `<button class="btn bm3 c t-run" data-act="run">RUN</button>`
    }
    function drawFight() {
      const ms = movesOf(me)
      $('pFight').innerHTML = [0, 1, 2, 3].map((i) => {
        const n = ms[i]; if (!n) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const m = moveInfo(n)
        if (m.kind === 'support') return m.solo ? `<button class="btn fm${i} t-${m.type} sup${m.cost > pp ? ' off' : ''}" data-act="m${i}">${n}<small>${m.solo} · PP ${m.cost}</small></button>`
          : `<button class="btn fm${i} t-${m.type} sup off" data-act="m${i}">${n}<small>2v2 only</small></button>`
        return `<button class="btn fm${i} t-${m.type}${m.cost > pp ? ' off' : ''}" data-act="m${i}">${n}<small>${m.type.toUpperCase()}${m.hits ? ` · ${m.hits} HITS` : ''}${m.prio ? ' · FIRST' : ''} · ${m.cost ? `PP ${m.cost}` : '+1 PP'}</small></button>`
      }).join('') + `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
    }
    function drawBag() {
      // Everything you have, scrolling: balls, heals, Revive, then status cures.
      const down = party.some((m) => m.hp <= 0)
      $('pBag').classList.remove('six')
      $('pBag').innerHTML = bagPanel(BATTLE_ITEMS.filter((k) => bag[k] > 0).map((k) => {
        const it = ITEMS[k], ball = k === 'ball' || k === 'great'
        const why = ball ? (kind === 'trainer' ? "not on a trainer's" : it.sub) : it.revive ? (down ? it.sub : 'nobody has fainted')
          : it.cure ? (me.status && it.cure.includes(me.status) ? it.sub : me.status ? `won't fix ${STATUS_NAME[me.status]}` : 'no status to cure') : me.hp < me.stats.hp ? it.sub : 'HP is full'
        const off = ball ? kind === 'trainer' : it.revive ? !down : it.cure ? !(me.status && it.cure.includes(me.status)) : me.hp >= me.stats.hp
        return bagButton(k, bag[k], off, why)
      }))
      bagMore($('pBag'))
    }
    /** The party panel: all six (switching), or, `sending` after a faint, who goes in next (no going back). */
    function drawParty(sending = false) {
      const n = party.length > 4 ? 6 : 4
      $('pParty').classList.toggle('six', n === 6)
      $('pParty').innerHTML = [...Array(n).keys()].map((i) => {
        const m = party[i]; if (!m) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const pct = m.hp / m.stats.hp * 100
        return `<button class="btn fm${i} t-party pmon${m.hp <= 0 ? ' off' : ''}${m === me ? ' sel' : ''}" data-act="p${i}"><img src="${ART[m.id]}" alt=""><span style="flex:1;min-width:0">${m.name}<small>${m.hp}/${m.stats.hp} HP</small><span class="hpm"><i style="width:${pct}%;background:${hpColor(pct)}"></i></span></span></button>`
      }).join('') + (sending ? '' : `<button class="btn fback t-run" data-act="back">◀ BACK</button>`)
    }
    function choose(panelId, scripted) {
      return new Promise((resolve, reject) => {
        if (demo) {
          setTimeout(() => {
            if (!live()) return reject(STOP)
            hot($(panelId).querySelector(`[data-act="${scripted}"]`)); sfx('select')
            setTimeout(() => resolve(scripted), 200)
          }, 760)
          return
        }
        const cleanup = () => { $(panelId).removeEventListener('pointerdown', onTap); $(panelId).removeEventListener('click', onTap); offKey() }
        const onTap = (e) => {
          const b = e.target.closest('[data-act]')
          if (!b || (e.type === 'click') !== !!b.closest('.bagscroll')) return   // the scrolling list answers clicks, the rest pointerdown
          if (b.disabled || b.classList.contains('off') || !live()) return
          e.preventDefault(); hot(b); cleanup(); sfx('select'); resolve(b.dataset.act)
        }
        // B backs out of a sub-menu from the keyboard.
        const offKey = listen((k) => { if (k === 'b' && $(panelId).querySelector('[data-act="back"]')) { cleanup(); resolve('back') } })
        $(panelId).addEventListener('pointerdown', onTap); $(panelId).addEventListener('click', onTap)
      })
    }

    async function useMove(name, planned) {
      const mv = MOVEDEX[name], hits = mv.hits ?? 1, plan_ = [].concat(planned ?? [])
      await announce(`${me.name} used`, `${name}!`, 160)
      setPP(pp - mv.cost)
      let landed = 0, crit = false, eff = 1, clean = false
      const sr = strikeRing(ringNet(ST(me).acc, ST(foe).eva))
      for (let h = 0; h < hits && foe.hp > 0; h++) {
        panel('pStrike'); $('bStrike').innerHTML = `${hits > 1 ? `HIT ${h + 1} / ${hits}` : 'STRIKE!'}<small style="font-size:12px;margin-top:6px">tap as the ring closes</small><span class="key">A</span>`
        const acc = await timedTap(plan_[h] ?? plan_.at(-1) ?? null, C.e.x, C.e.y, hits > 1 ? `HIT ${h + 1}/${hits}` : 'STRIKE', Math.round((h ? 560 : 820) * sr.speed), sr.tight)
        panel(null)
        // One ring per hit. Miss a ring and that hit misses, so only landing
        // every ring deals the move's full damage.
        if (hits > 1 && acc.label === 'MISS') { pop('MISSED', C.e.x, C.e.y - 70, 'red small'); sfx('dodge'); continue }
        pop(`${acc.label} ×${acc.mult.toFixed(1)}`, C.e.x - 24, C.e.y - 72, ACC_CLS[acc.label])
        sfx(mv.snd)
        await strikeFx(mv, C.p, C.e, $('player'), h > 0)
        const r = damage(me, foe, mv, acc.mult)
        const from = foe.hp; foe.hp = Math.max(demo && kind === 'wild' ? 1 : 0, foe.hp - r.dmg)
        sfx(r.eff > 1 ? 'hitSuper' : r.eff < 1 ? 'hitWeak' : 'hit')
        if (r.eff > 1 || acc.crit) shake(6, 320)
        sparks(C.e.x, C.e.y, mv.type === 'fire' ? '#fb923c' : '#e2e8f0', 9)
        pop(`-${from - foe.hp}`, C.e.x + 34, C.e.y - 30, acc.crit ? 'gold' : '')
        await Promise.all([blink($('enemy'), hits > 1 ? 2 : 3), drain('e', from, foe.hp, foe.max)])
        if (acc.crit) addBond(me, 2)
        landed++; crit ||= acc.crit; eff = r.eff; if (acc.label !== 'MISS') clean = true
        if (foe.hp > 0 && foe.status === 'frz' && mv.type === 'fire') { foe.status = null; showTags(); await say(who(foe), STATUS_TEXT.thaw, 300) }
        if (foe.hp > 0) await afflict(foe, statusFromHit(foe, { ...mv, name }, rand))
      }
      // A 0-PP move that lands (any timing but MISS) builds PP: +1 per attack.
      if (mv.cost === 0 && clean) { setPP(pp + 1, true); pop('+1 PP', C.p.x - 30, C.p.y - 96, 'blue small') }
      if (mv.accDown && clean && foe.hp > 0) await stage(foe, 'acc', -mv.accDown, true)
      if (hits > 1) await say(landed === hits ? `Hit ${hits} times — full damage!` : `Hit ${landed} of ${hits} times.`)
      if (crit) await say('A critical hit!')
      if (landed && eff > 1) await say("It's super effective!")
      if (landed && eff < 1) await say("It's not very effective...")
    }

    /** A self-targeting support move in a 1v1: Howl, Growth, Life Dew. The ASSIST ring sets how strong it is. */
    async function useSupport(name, planned) {
      const mv = moveInfo(name)
      await announce(`${me.name} used`, `${name}!`, 160)
      setPP(pp - mv.cost)
      panel('pStrike'); $('bStrike').innerHTML = 'ASSIST!<small style="font-size:12px;margin-top:6px">time it for a stronger effect</small><span class="key">A</span>'
      const acc = await timedTap(planned, C.p.x, C.p.y, 'ASSIST')
      panel(null); pop(acc.label, C.p.x, C.p.y - 72, ACC_CLS[acc.label])
      if (mv.effect === 'heal') {
        if (me.hp >= me.stats.hp) { await say(`${me.name}'s HP is full.`); return }
        const from = me.hp; me.hp = Math.min(me.stats.hp, me.hp + Math.ceil(me.stats.hp * Math.min(0.6, mv.amount * acc.mult)))
        sfx('heal'); rise(C.p, '#86efac', 'dot')
        await drain('p', from, me.hp, me.stats.hp); pop(`+${me.hp - from}`, C.p.x + 34, C.p.y - 40, 'green'); renderTools()
        await say(`${me.name} recovered`, `${me.hp - from} HP.`)
      } else if (mv.effect === 'cure') {
        if (!me.status) await say('But it failed!', `${me.name} has no status to cure.`, 300)
        else { me.status = null; sfx('heal'); rise(C.p, '#86efac', 'dot'); showTags(); await say(`${me.name}'s status`, 'returned to normal!', 300) }
      } else if (mv.effect === 'status') { if (acc.label === 'MISS' || !(await afflict(foe, mv.status))) await say('But it failed!', '', 300) }
      else if (mv.effect === 'accDown') await stage(foe, 'acc', acc.crit ? -2 : -1, true)
      else if (mv.effect === 'evaUp') await stage(me, 'eva', acc.crit ? 2 : 1, false)
      else {
        const n = acc.crit ? 2 : 1, t = ST(me)
        t.atk = Math.min(6, t.atk + n); if (mv.effect === 'growth') t.spa = Math.min(6, t.spa + n)
        sfx('levelup'); rise(C.p, '#f87171', 'arrow'); showTags()
        await say(`${me.name}'s ${mv.effect === 'growth' ? 'ATK and SP.A' : 'ATTACK'}`, n > 1 ? 'rose sharply!' : 'rose!')
      }
    }

    async function throwBall(k, planned, forcedShakes) {
      if (kind === 'trainer') {
        await say("The trainer blocked the ball!", "Don't be a thief!"); return 'blocked'
      }
      bag[k]--; renderTools()
      await say('You threw a', `${ITEMS[k].name}!`, 120)
      panel('pStrike'); $('bStrike').innerHTML = 'THROW!<small style="font-size:12px;margin-top:6px">release as the ring closes</small><span class="key">A</span>'
      const acc = await timedTap(planned, C.e.x, C.e.y, 'THROW')
      panel(null)
      const throwMult = { PERFECT: 1.8, GREAT: 1.5, GOOD: 1.25, OK: 1.1, MISS: 1 }[acc.label]
      const tName = { PERFECT: 'Excellent!', GREAT: 'Great!', GOOD: 'Nice!', OK: '', MISS: '' }[acc.label]
      if (tName) pop(tName, C.e.x - 20, C.e.y - 72, acc.label === 'PERFECT' ? 'gold' : 'blue')
      sfx('throw')
      const ball = document.createElement('div'); ball.className = 'bigball' + (k === 'great' ? ' great' : '')
      // Thrown by the trainer behind the camera: it enters from the bottom-
      // left corner, below the top screen, rather than from the Pokémon.
      // Starting at the Pokémon left only ~140px across to climb ~100px, which
      // crammed the whole bend into a tight hook - the "ceiling".
      const S = { x: 6, y: 262 }
      ball.style.left = (S.x - 9) + 'px'; ball.style.top = (S.y - 9) + 'px'; fx.appendChild(ball)
      const dx = C.e.x - S.x, dy = (C.e.y + 2) - S.y
      // A real arc, sampled from a parabola: x moves evenly, y follows the
      // curve, and a constant step in time is what makes it slow near the top
      // and speed up on the way down.
      const SAMPLES = 32
      // Peak ~44px above the target, but never within 26px of the top edge.
      const peakY = Math.max(26, (C.e.y + 2) - 44)
      const apex = Math.min(peakY - S.y, Math.min(0, dy) - 4)
      // Vertex form through (0,0), (tPeak, apex) and (1, dy):
      //   y(t) = a·t² + b·t,  a = −apex / tPeak²,  b = −2·a·tPeak
      const tPeak = Math.sqrt(-apex) / (Math.sqrt(-apex) + Math.sqrt(dy - apex))
      const a = -apex / (tPeak * tPeak), b = -2 * a * tPeak
      const yAt = (t) => a * t * t + b * t
      const arc = Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const t = i / SAMPLES
        return { transform: `translate(${dx * t}px,${yAt(t)}px) rotate(${-720 * t}deg)` }
      })
      await anim(ball, arc, { duration: 620, easing: 'linear' }).finished
      sfx('absorb'); flash('#fecaca', .5, 200)
      await anim($('enemy'), [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(0)', filter: 'brightness(4) sepia(1) hue-rotate(-50deg)' }], { duration: 360, easing: 'ease-in' }).finished
      $('enemy').style.visibility = 'hidden'
      await anim(ball, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: `translate(${dx}px,${dy + 38}px)`, offset: .6 }, { transform: `translate(${dx}px,${dy + 30}px)`, offset: .8 }, { transform: `translate(${dx}px,${dy + 38}px)` }], { duration: 420, easing: 'ease-in' }).finished
      let shakes = forcedShakes
      if (shakes == null) {
        const a = ((3 * foe.max - 2 * foe.hp) * foe.capture * (k === 'great' ? 1.5 : 1) * throwMult) / (3 * foe.max)
        const b = a >= 255 ? 65536 : 65536 / Math.pow(255 / a, 0.1875)
        shakes = 0; while (shakes < 4 && Math.random() * 65536 < b) shakes++
      }
      for (let i = 0; i < Math.min(3, shakes); i++) {
        await W(450); sfx('wobble')
        await anim(ball, [{ transform: `translate(${dx}px,${dy + 38}px) rotate(0)` }, { transform: `translate(${dx}px,${dy + 38}px) rotate(-24deg)`, offset: .3 }, { transform: `translate(${dx}px,${dy + 38}px) rotate(18deg)`, offset: .7 }, { transform: `translate(${dx}px,${dy + 38}px) rotate(0)` }], { duration: 420 }).finished
      }
      await W(420)
      if (shakes === 4) {
        sfx('click')
        for (let i = 0; i < 3; i++) { const s = document.createElement('div'); s.className = 'star'; s.style.left = (C.e.x - 5) + 'px'; s.style.top = (C.e.y + 34) + 'px'; fx.appendChild(s); anim(s, [{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${(i - 1) * 26}px,-30px) scale(1.2)`, opacity: 0 }], { duration: 700 }); setTimeout(() => s.remove(), 720) }
        Sound.music('caught')
        buzz([20, 50, 20, 50, 60])
        await say('Gotcha!', `${foe.name} was caught!`, 900)
        ball.remove(); return 'caught'
      }
      sfx('breakout'); flash('#fff', .6, 160); ball.remove()
      $('enemy').getAnimations().forEach((a) => a.cancel())
      $('enemy').style.visibility = 'visible'
      await anim($('enemy'), [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: .7 }, { transform: 'scale(1)' }], { duration: 300 }).finished
      await say(['Oh no! It broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Gah! It was so close, too!'][Math.min(3, shakes)])
      return 'free'
    }

    const onLevel = (m) => { if (m === me) { $('plv').textContent = m.level; setHP('p', m.hp, m.stats.hp) } }
    const winExp = async () => { const n = expYield(foe, kind === 'trainer'); await gainExp(me, n, $('pexp'), onLevel); await shareExp(n, [me]) }

    /** The foe fainted: EXP, then the scalper's next Pokémon if they have one. Returns the result, or null to fight on. */
    async function foeDown() {
      sfx('faint')
      await anim($('enemy'), [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(100px)', clipPath: 'inset(0 0 100px 0)' }], { duration: 520, easing: 'ease-in' }).finished
      $('enemy').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'
      await say(`${kind === 'wild' ? 'The wild ' : `${trainer.short}'s `}${foe.name}`, 'fainted!')
      // A scalper's last one: they say their piece first, so EXP is handed back to run after it.
      if (kind === 'trainer' && !roster.length) return { result: 'won', exp: winExp }
      await winExp()
      if (kind !== 'trainer' || !roster.length) return { result: kind === 'wild' ? 'fainted' : 'won' }
      foe = roster.shift(); foe.max = foe.stats.hp; foe.turn = 0; foeMoves = movesFor(foe); showTags()   // the new one starts with no stage changes
      if (trainer.hard && !roster.length) { await trainerOn(trainer); await talk(trainer, [pickOf(LAST_MON).replaceAll('{mon}', foe.name)]); await trainerOff() }
      await say(...sentOut(trainer, foe), 200)
      $('ename').textContent = foe.name; $('elv').textContent = foe.level; setHP('e', foe.hp, foe.max)
      $('enemy').getAnimations().forEach((a) => a.cancel())
      const er = await place($('enemy'), ART[foe.id], FOOT.e.x, FOOT.e.y, 1.6, FOOT.e.maxH, FOOT.e.maxW)
      C.e = { x: er.x, y: er.y }
      $('enemy').style.visibility = 'visible'; sfx('ball'); flash('#fff', .5, 180)
      cry(foe); await anim($('enemy'), [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380 }).finished
      $('ehud').style.visibility = 'visible'; anim($('ehud'), [{ transform: 'translateX(-180px)' }, { transform: 'none' }], { duration: 280 })
      return null
    }

    async function switchTo(m) {
      await say(`Come back, ${me.name}!`, '', 200)
      await anim($('player'), [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(0)', opacity: 0, filter: 'brightness(3) sepia(1) hue-rotate(-50deg)' }], { duration: 320 }).finished
      $('player').getAnimations().forEach((a) => a.cancel()); $('player').style.visibility = 'hidden'
      stg.delete(me); me = m; await sendOut(me); showTags()
    }

    /**
     * Ground attacks, each timed to reach the player's feet at `approach` ms.
     * The ring and its ▲ JUMP! label are drawn by the caller.
     */
    function lowFx(mv, approach, E) {
      const a = FOOT.e, b = FOOT.p, dx = b.x - a.x, dy = b.y - a.y
      const COL = { water: ['#bfdbfe', '#3b82f6'], poison: ['#e9d5ff', '#9333ea'], psychic: ['#fbcfe8', '#db2777'], fire: ['#fed7aa', '#ea580c'], ice: ['#e0f2fe', '#38bdf8'], steel: ['#f1f5f9', '#64748b'], fighting: ['#fee2e2', '#dc2626'], dragon: ['#ddd6fe', '#6d28d9'] }
      const [hi, lo] = COL[mv.type] ?? ['#f8fafc', '#94a3b8']
      const piece = (css, frames, opts) => {
        const d = document.createElement('div'); d.style.cssText = 'position:absolute;pointer-events:none;' + css; fx.appendChild(d)
        anim(d, frames, { fill: 'both', ...opts }); setTimeout(() => d.remove(), opts.duration + Math.max(0, opts.delay ?? 0) + 40)
      }
      if (mv.fx === 'quake') {
        // A small hop (it used to clear 28px, enough to lift tall ones off the top), then the ground shakes.
        anim(E, [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: .82 }, { transform: 'translateY(0)' }], { duration: approach, easing: 'ease-in' })
      } else if (mv.fx === 'roll') {
        // The Pokémon itself rolls down to the player's feet and back, glowing in its move's colour.
        const glow = mv.type === 'normal' || mv.type === 'rock' ? 'brightness(1)' : `drop-shadow(0 0 6px ${lo})`
        const k = approach / (approach + 220)
        anim(E, [{ transform: 'translate(0,0) rotate(0)', filter: glow }, { transform: `translate(${dx}px,${dy}px) rotate(-900deg)`, filter: glow, offset: k }, { transform: 'translate(0,0) rotate(-1080deg)', filter: 'brightness(1)' }], { duration: approach + 220, easing: 'linear' })
        for (let i = 1; i <= 4; i++) piece(`left:${a.x - 6}px;top:${a.y - 3}px;width:12px;height:6px;border-radius:50%;background:rgba(255,255,255,.45)`,
          [{ transform: `translate(${dx * i / 5}px,${dy * i / 5}px)`, opacity: .9 }, { transform: `translate(${dx * i / 5}px,${dy * i / 5 - 6}px) scale(2)`, opacity: 0 }], { duration: 320, delay: approach * i / 5 })
      } else if (mv.fx === 'sweep') {
        // A low lunge, and a crescent that skims the platform at ankle height.
        const k = approach / (approach + 160)
        anim(E, [{ transform: 'translate(0,0)' }, { transform: 'translate(10px,-4px)', offset: k * .6 }, { transform: `translate(${dx + 30}px,${dy - 40}px)`, offset: k }, { transform: 'translate(0,0)' }], { duration: approach + 160, easing: 'ease-in' })
        piece(`left:${b.x - 84}px;top:${b.y - 24}px;width:130px;height:30px;border-radius:50%;border-bottom:5px solid ${hi};filter:drop-shadow(0 0 4px ${lo});opacity:0`,
          [{ transform: 'translateX(120px) scaleX(.3)', opacity: 0 }, { transform: 'translateX(0) scaleX(1)', opacity: 1, offset: .75 }, { transform: 'translateX(-50px) scaleX(1.1)', opacity: 0 }], { duration: 280, delay: approach - 210 })
      } else if (mv.fx === 'wave') {
        // A wave rises at the foe's platform and rolls across the ground, growing as it comes.
        anim(E, [{ transform: 'scale(1)' }, { transform: 'scale(1.06) translateY(-6px)', offset: .3 }, { transform: 'scale(1)' }], { duration: approach })
        piece(`left:${a.x - 40}px;top:${a.y - 36}px;width:80px;height:38px;border-radius:60% 60% 8px 8px / 100% 100% 8px 8px;background:linear-gradient(${hi},${lo} 65%);border-top:3px solid #fff;opacity:.92;transform-origin:50% 100%`,
          [{ transform: 'translate(0,0) scale(.3,.2)' }, { transform: `translate(${dx * .15}px,${dy * .15}px) scale(.8,.9)`, offset: .25 }, { transform: `translate(${dx}px,${dy}px) scale(1.7,1.1)`, offset: .92 }, { transform: `translate(${dx * 1.15}px,${dy * 1.08}px) scale(1.9,.3)`, opacity: 0 }], { duration: approach + 80, easing: 'ease-in' })
      } else if (mv.fx === 'current') {
        // Sparks crawl along the ground from the foe to the player.
        anim(E, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) drop-shadow(0 0 6px #facc15)', offset: .3 }, { filter: 'brightness(1)' }], { duration: approach })
        for (let i = 0; i < 7; i++) piece(`left:${a.x - 6}px;top:${a.y - 6}px;width:12px;height:12px;background:#fde047;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 4px #facc15)`,
          [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx * .5 + (i % 2 ? 9 : -9)}px,${dy * .5}px) rotate(180deg)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) rotate(360deg)` }], { duration: approach * .7, delay: approach * .3 + i * 22 - 130, easing: 'linear' })
      } else if (mv.fx === 'shadow') {
        // The foe's shadow peels off and slides under the player, then lunges up.
        anim(E, [{ opacity: 1 }, { opacity: .45, offset: .2 }, { opacity: .45, offset: .9 }, { opacity: 1 }], { duration: approach })
        piece(`left:${a.x - 32}px;top:${a.y - 9}px;width:64px;height:18px;border-radius:50%;background:radial-gradient(ellipse,rgba(30,10,60,.95),rgba(30,10,60,0) 70%)`,
          [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)`, offset: .85 }, { transform: `translate(${dx}px,${dy - 30}px) scale(.6,3)`, opacity: 0 }], { duration: approach + 60, easing: 'ease-in' })
      } else if (mv.fx === 'vines') {
        // Grass ripples toward the player, and a knot of vines snaps up at the feet.
        anim(E, [{ transform: 'scale(1)' }, { transform: 'scale(1.06) translateY(-4px)', offset: .3 }, { transform: 'scale(1)' }], { duration: approach })
        for (let i = 1; i <= 5; i++) piece(`left:${a.x + dx * i / 6 - 6}px;top:${a.y + dy * i / 6 - 12}px;width:12px;height:12px;background:#4ade80;clip-path:polygon(0 100%,25% 20%,45% 100%,60% 0,80% 100%,100% 30%,100% 100%);transform-origin:50% 100%;opacity:0`,
          [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1, offset: .4 }, { transform: 'scaleY(0)', opacity: 0 }], { duration: 300, delay: approach * i / 6 - 200 })
        piece(`left:${b.x - 32}px;top:${b.y - 32}px;width:64px;height:32px;background:linear-gradient(#86efac,#15803d);clip-path:polygon(0 100%,15% 10%,30% 100%,45% 0,60% 100%,75% 15%,90% 100%,100% 40%,100% 100%);transform-origin:50% 100%;opacity:0`,
          [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1.2)', opacity: 1, offset: .5 }, { transform: 'scaleY(0)', opacity: 0 }], { duration: 380, delay: approach - 170 })
      }
    }

    /** A leader's tell, by their Pokémon's type: fliers and tricksters feint, fighters go low then high, the rest strike twice. */
    const leaderTell = (m) => (['flying', 'psychic', 'ghost', 'dark'].includes(m.types[0]) ? 'feint' : ['fighting', 'rock', 'ground'].includes(m.types[0]) ? 'lowHigh' : 'double')
    const TELL_LABEL = { feint: 'FEINT!', double: '×2!', lowHigh: 'LOW → HIGH!' }
    /** Leaders' signature status moves (by art key). */
    const LEADER_STATUS = { koga: 'POISON POWDER', janine: 'POISON POWDER', erika: 'POISON POWDER', bugsy: 'POISON POWDER',
      karen: 'WILL-O-WISP', morty: 'WILL-O-WISP', blaine: 'WILL-O-WISP', lt_surge: 'THUNDER WAVE', sabrina: 'THUNDER WAVE', will: 'THUNDER WAVE', lance: 'THUNDER WAVE' }
    async function foeTurn() {
      // A roaming legendary attacks once, then runs on its second turn, keeping whatever HP it has left.
      if (foe.roamer && foe.turn >= 1) {
        sfx('run'); await anim($('enemy'), [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(260px)', opacity: 0 }], { duration: 520, easing: 'ease-in' }).finished
        $('enemy').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'
        await say(`${foe.name} fled!`, `It still has ${Math.round(foe.hp / foe.max * 100)}% of its HP.`, 700)
        fled = true; return
      }
      if (kind === 'trainer' && !demoNoBlunder && (await blunder(trainer, foe))) return
      if (await blockedByStatus(foe)) return
      // A Gym Leader keeps a Full Restore for their last Pokémon.
      if (trainer?.hard && !roster.length && !restored && foe.hp < foe.max * 0.35) {
        restored = true
        await say(`${trainer.short} used`, 'a FULL RESTORE!', 300); sfx('heal')
        const from = foe.hp; foe.hp = foe.max; await drain('e', from, foe.hp, foe.max)
        await say(`${foe.name}'s HP was restored!`); return
      }
      // Leaders choose: usually the move that hits you hardest, sometimes the next best.
      const pickHard = () => {
        const score = (m) => (m.power ?? 0) * (m.hits ?? 1) * soften(gameMult(m.type, me.types)) * (foe.types.includes(m.type) ? 1.5 : 1)
        const ranked = foeMoves.filter((m) => !m.splash).slice().sort((a, b) => score(b) - score(a))
        return ranked[rand() < 0.7 ? 0 : Math.min(1, ranked.length - 1)]
      }
      // Leaders with a signature status move use it on purpose, once a battle, early, on a Pokémon that can take it.
      const sig = LEADER_STATUS[trainer?.key]
      if (sig && !sigUsed && foe.turn < 2 && canTake(me, SUPPORT[sig].status) && rand() < 0.6) {
        sigUsed = true
        await announce(`${trainer.short}'s ${foe.name} used`, `${sig}!`, READ_MS)
        await afflict(me, SUPPORT[sig].status); foe.turn++
        return
      }
      // Now and then (more often for leaders), once per Pokémon: its type's accuracy or evasion move.
      if (!foe.roamer && !foe.usedStatus && (window.__forceStatusMove || rand() < (trainer?.hard ? 0.25 : 0.1))) {   // __forceStatusMove: testing only
        foe.usedStatus = true
        const sn = statusOf(foe), sm = SUPPORT[sn]
        await announce(`${kind === 'trainer' ? '' : 'The wild '}${foe.name} used`, `${sn}!`, 300)
        if (sm.effect === 'accDown') await stage(me, 'acc', -1, false); else await stage(foe, 'eva', 1, true)
        return
      }
      const mv = trainer?.hard || trainer?.smart ? pickHard() : foe.roamer ? (foe.turn++, foeMoves[Math.floor(rand() * foeMoves.length)]) : foeMoves[foe.turn++ % foeMoves.length]
      if (mv.splash) { await announce(`${foe.name} used`, 'SPLASH!', 200); anim($('enemy'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-20px)', offset: .5 }, { transform: 'translateY(0)' }], { duration: 300, iterations: 2 }); await W(600); await say('But nothing happened!'); return }
      if (demo && planD.length) {
        const next = planD[0]
        cap(mv.kind === 'low' ? 'JUMP' : mv.hits > 1 ? 'PARRY THE COMBO' : next === 'dodge' ? 'DODGE' : next === 'late' ? 'MISSED' : 'PARRY',
          mv.kind === 'low' ? `${mv.name} comes along the ground — it can't be parried or dodged. Jump it with ▲ for +1 PP.`
          : mv.hits > 1 ? `${mv.name} hits ${mv.hits} times. The timing ring sits in front of ${me.name} for every hit — parry all of them for a counter.`
          : next === 'dodge' ? 'Dodge works here too: a wider window, no damage, but no PP.'
          : next === 'late' ? `Too late — ${me.name} takes the hit, and keeps the damage after the battle.`
          : 'Parry with A: a tight window, no damage, +1 PP, and a counter.')
      }
      panel('pDefend')
      // The move's name stays up long enough to read it and decide.
      await announce(`${kind === 'trainer' ? '' : 'The wild '}${foe.name} used`, `${mv.name}!`, READ_MS)
      // A tell, on some attacks: a feint, a second ring, or low-then-high. Leaders most, scalpers and veterans now and then.
      const pace = attackPace(kind === 'trainer' ? trainer : null, me.level)
      const tell = trainer?.hard ? (rand() < (trainer.tellRate ?? 0.4) ? leaderTell(foe) : null) : !demo && Math.random() < pace.tell ? leaderTell(foe) : null
      const hits = tell === 'double' ? (mv.hits ?? 1) + 1 : tell === 'lowHigh' ? 2 : mv.hits
      const kindOf = (h) => (tell === 'lowHigh' ? (h === 0 ? 'low' : 'strike') : mv.kind)
      if (tell) { pop(TELL_LABEL[tell], C.e.x - 10, C.e.y - 86, 'orange'); sfx('blocked'); await W(350) }
      let allParried = true, evaded = 0
      for (let h = 0; h < hits; h++) {
        const kind_ = kindOf(h), feint = tell === 'feint' && h === 0 ? 450 : 0   // a feint holds the ring still this long
        // Leaders' attacks close faster: less time to react.
        const dr = defendRing(ringNet(ST(foe).acc, ST(me).eva)); if (me.status === 'par') dr.wide *= 0.8
        // Every ring closes at its own speed, after a wind-up of its own: no two attacks share a rhythm.
        const vary = demo ? 1 : paceRoll(pace.speed), windup = demo ? 0 : Math.round(Math.random() * pace.wait)
        const approach = Math.round((mv.fast ? 640 : h === 0 ? 860 : 560) * (trainer?.hard ? trainer.ringFast ?? 0.8 : 1) * dr.speed * vary)
        // Armed through the wind-up, so tapping early still counts as your press (and misses).
        const armed = performance.now()
        let first = null
        const off = listen((btn, t) => { if (!first && t >= armed && ['a', 'b', 'up'].includes(btn)) first = { btn, t } })
        document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.add('armed'))
        if (windup) await W(windup)
        const t0 = performance.now(), hitAt = t0 + approach + feint
        if (demo) {
          const p = planD.shift() ?? (kind_ === 'low' ? 'jump' : 'parry')
          const at = feint + { parry: approach - 40, dodge: approach - 120, jump: approach - 70, late: approach + 190 }[p]
          setTimeout(() => { if (!live()) return; const b = { parry: 'a', dodge: 'b', jump: 'up', late: 'a' }[p]; hot($('pDefend').querySelector(`[data-btn="${b}"]`)); press(b) }, at)
        }
        const rg = kind_ === 'low' ? groundRing(FOOT.p.x, FOOT.p.y - 4, approach) : ring(C.p.x, C.p.y, approach, '')
        if (feint) setTimeout(() => {   // the feint: the ring stops halfway and flickers, then carries on
          if (!live()) return
          rg.el.getAnimations().forEach((x) => x.pause()); rg.el.classList.add('feint')
          setTimeout(() => { rg.el.getAnimations().forEach((x) => x.play()); rg.el.classList.remove('feint') }, feint)
        }, approach * 0.5)
        const E = $('enemy')
        if (mv.fx === 'coins') { const c = document.createElement('div'); c.style.cssText = `position:absolute;left:${C.p.x - 30 + h * 26}px;top:-16px;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff7c2,#facc15 55%,#b45309);border:1px solid #92400e`; fx.appendChild(c); anim(c, [{ transform: 'translateY(0)' }, { transform: `translateY(${C.p.y - 10}px)` }], { duration: approach, easing: 'ease-in' }); setTimeout(() => c.remove(), approach + 40) }
        if (mv.fx === 'orb') { const o = document.createElement('div'); o.style.cssText = `position:absolute;left:${C.e.x - 14}px;top:${C.e.y - 14}px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#e9d5ff 0,#7c3aed 45%,#2e1065 100%);box-shadow:0 0 14px #8b5cf6`; fx.appendChild(o); anim(o, [{ transform: 'translate(0,0) scale(.4)' }, { transform: 'translate(0,0) scale(1)', offset: .45 }, { transform: `translate(${C.p.x - C.e.x}px,${C.p.y - C.e.y}px) scale(1.2)` }], { duration: approach, easing: 'ease-in' }); setTimeout(() => o.remove(), approach + 30) }
        if (kind_ === 'low') lowFx(mv.kind === 'low' ? mv : { ...mv, fx: 'sweep' }, approach, E)
        else if (mv.ranged) anim(E, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) translateY(-6px)', offset: .5 }, { transform: 'scale(1)' }], { duration: approach })
        else { const k = approach / (approach + 160); anim(E, [{ transform: 'translate(0,0)' }, { transform: 'translate(12px,-6px)', offset: k * .8 }, { transform: 'translate(-96px,70px)', offset: k }, { transform: 'translate(0,0)' }], { duration: approach + 160, easing: 'ease-in' }) }
        await W(approach + feint); rg.clear()
        if (!first) await W(kind_ === 'low' ? 260 : 230)
        off(); document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.remove('armed'))
        if (me.status === 'frz') first = null   // frozen solid: no parry, dodge or jump
        const dt = first ? first.t - hitAt : Infinity
        let r = 'miss'
        if (kind_ === 'low') { if (first?.btn === 'up' && Math.abs(dt) <= 260 * dr.wide) r = 'jump' }
        else if (first?.btn === 'a' && Math.abs(dt) <= 120 * dr.wide) r = 'parry'
        else if (first?.btn === 'b' && Math.abs(dt) <= 230 * dr.wide) r = 'dodge'
        if (mv.fx === 'quake') { sfx('quake'); shake(10, 520) }
        if (mv.snd === 'coin') sfx('coin')
        if (r !== 'parry') allParried = false
        if (r === 'parry') { addBond(me, 2); sfx('parry'); pop('PARRY!', C.p.x + h * 14, C.p.y - 64 - h * 18, 'gold'); sparks(C.p.x + 30, C.p.y - 26); flash('#fff', .35, 90); evaded++ }
        else if (r === 'dodge') { sfx('dodge'); pop('DODGE', C.p.x, C.p.y - 64, 'blue'); anim($('player'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-34px)', offset: .4 }, { transform: 'translateX(0)' }], { duration: 360 }) }
        else if (r === 'jump') { sfx('jump'); pop('JUMP!', C.p.x, C.p.y - 80, 'green'); anim($('player'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-60px)', offset: .45 }, { transform: 'translateY(0)' }], { duration: 540 }); evaded++ }
        else {
          if (mv.snd && mv.snd !== 'coin' && mv.snd !== 'shadow') sfx(mv.snd)
          const { dmg, eff } = damage(foe, me, mv, 1)
          const from = me.hp; me.hp = Math.max(0, me.hp - dmg)
          sfx(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit'); flash('#ef4444', .25, 160); buzz(eff > 1 ? 60 : 30)
          pop(`-${dmg}`, C.p.x + 40, C.p.y - 40, 'red')
          await Promise.all([blink($('player')), drain('p', from, me.hp, me.stats.hp)])
          renderTools()
          if (me.hp <= 0) { panel(null); return }
          if (me.status === 'frz' && mv.type === 'fire') { me.status = null; showTags(); await say(who(me), STATUS_TEXT.thaw, 300) }
          await afflict(me, statusFromHit(me, mv, rand))
        }
        await W(hits > 1 ? 80 : 220)
      }
      panel(null)
      // One PP per attack, and only for a clean sweep: parry (or jump) 2 of 3 hits and it's nothing.
      if (evaded === hits) { setPP(pp + 1, true); pop('+1 PP', C.p.x - 30, C.p.y - 96, 'blue small') }
      else if (evaded) pop(`${evaded}/${mv.hits} — no PP`, C.p.x - 30, C.p.y - 96, 'small')
      if (allParried && mv.kind === 'strike' && foe.hp > 0) {
        sfx('counter'); pop('COUNTER!', 168, 96, 'orange'); await W(120)
        anim($('player'), [{ transform: 'translate(0,0)' }, { transform: 'translate(120px,-110px)', offset: .45 }, { transform: 'translate(0,0)' }], { duration: 420 })
        await W(210)
        const dmg = Math.max(1, Math.round(damage(me, foe, MOVEDEX.TACKLE, 1).dmg * 0.8))
        const from = foe.hp; foe.hp = Math.max(kind === 'wild' ? 1 : 0, foe.hp - dmg)
        sparks(C.e.x, C.e.y, '#fdba74'); pop(`-${from - foe.hp}`, C.e.x + 34, C.e.y - 30)
        await Promise.all([blink($('enemy')), drain('e', from, foe.hp, foe.max)])
      }
      if (tell && foe.hp > 0 && me.hp > 0 && (!quipped || rand() < 0.5)) { quipped = true; await tellQuip(tell, evaded === hits) }
    }
    /**
     * After a tell: the leader steps out in front of their Pokémon for a snarky
     * line (their own, or one for the tell), or a grudging one if you read it.
     */
    async function tellQuip(tell, clean) {
      const own = TELL_QUIPS[trainer.short]
      const line = clean ? pickOf(TELL_QUIP.clean) : own && rand() < 0.5 ? own : pickOf([...TELL_QUIP.hit, ...TELL_QUIP[tell]])
      const E = $('enemy')
      await anim(E, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).finished
      await trainerOn(trainer); await talk(trainer, [line]); await trainerOff()
      await anim(E, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).finished
      E.getAnimations().forEach((a) => a.cancel())
    }

    /* the turn loop */
    for (;;) {
      // If the script runs short (rolls differ), keep attacking rather than stall.
      const affordable = () => movesOf(me).filter((n) => !SUPPORT[n] && moveCost(n) <= pp).sort((a, b) => (MOVEDEX[b].power * (MOVEDEX[b].hits ?? 1)) - (MOVEDEX[a].power * (MOVEDEX[a].hits ?? 1)))[0] ?? movesOf(me)[0]
      const step = demo ? (plan.shift() ?? { menu: 'fight', move: affordable(), planned: 'perfect' }) : null
      if (demo && step?.cap) cap(step.cap[0], step.cap[1])
      drawMain(); panel('pMain'); msg0('What will', `${me.name} do?`)
      const top = await choose('pMain', demo ? step.menu : null)
      let used = false
      if (top === 'run') {
        if (kind === 'trainer') { panel(null); await say("There's no running", 'from a trainer battle!'); continue }
        panel(null); sfx('run'); await say('Got away safely!')
        return { result: 'ran' }
      }
      if (top === 'fight') {
        drawFight(); panel('pFight'); msg0('Choose a move.', '')
        const a = await choose('pFight', demo ? 'm' + movesOf(me).indexOf(step.move) : null)
        if (a === 'back') continue
        const name = movesOf(me)[+a.slice(1)]
        if (moveCost(name) > pp) { pop('NO PP!', 160, 120, 'red small'); continue }
        panel(null)
        if (await blockedByStatus(me)) setPP(pp)   // frozen or fully paralyzed: the turn is lost
        else if (SUPPORT[name]) await useSupport(name, demo ? step.planned : null); else await useMove(name, demo ? step.planned : null)
        used = true
        if (foe.hp <= 0) { const r = await foeDown(); if (r) return r; continue }
      }
      if (top === 'bag') {
        drawBag(); panel('pBag'); msg0('Use which item?', '')
        const it = await choose('pBag', demo ? step.item : null)
        if (it === 'back') continue
        panel(null)
        if (it === 'ball' || it === 'great') {
          const r = await throwBall(it, demo ? step.planned : null, demo ? step.shakes : null)
          if (r === 'caught') { await winExp(); return { result: 'caught' } }   // catching earns EXP too
          if (r === 'blocked') continue
          used = true
        } else if (ITEMS[it].cure) {
          if (!me.status || !ITEMS[it].cure.includes(me.status)) { await say("It won't have any effect."); continue }
          bag[it]--; renderTools(); sfx('heal'); me.status = null; showTags()
          await say(`You used a ${ITEMS[it].name}!`, `${me.name} is cured.`); used = true
        } else if (it === 'revive') {
          // On one of your others who's fainted: back at half HP, ready to switch in.
          const down = party.filter((m) => m.hp <= 0)
          if (!down.length) { await say('Nobody has fainted.'); continue }
          let m = down[0]
          if (down.length > 1) {
            $('pParty').innerHTML = down.slice(0, 4).map((d, i) => `<button class="btn fm${i} t-party pmon" data-act="r${i}"><img src="${ART[d.id]}" alt=""><span style="flex:1;min-width:0">${d.name}<small>fainted</small></span></button>`).join('') + `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
            panel('pParty'); msg0('Revive which Pokémon?', '')
            const r = await choose('pParty', null)
            if (r === 'back') continue
            m = down[+r.slice(1)]; panel(null)
          }
          bag.revive--; renderTools(); sfx('heal')
          m.hp = Math.ceil(m.stats.hp * ITEMS.revive.revive); m.status = null
          await say(`${m.name} was revived!`, `It's back with ${m.hp} HP.`); used = true
        } else {
          if (me.hp === me.stats.hp) { await say(`${me.name}'s HP is full.`); continue }
          bag[it]--; renderTools(); sfx('heal')
          const from = me.hp; me.hp = Math.min(me.stats.hp, me.hp + Math.ceil(me.stats.hp * ITEMS[it].heal))
          await drain('p', from, me.hp, me.stats.hp)
          await say(`${me.name} recovered`, `${me.hp - from} HP.`); used = true
        }
      }
      if (top === 'party') {
        drawParty(); panel('pParty'); msg0('Switch to which Pokémon?', '')
        const p = await choose('pParty', demo ? step.to : null)
        if (p === 'back') continue
        const m = party[+p.slice(1)]
        panel(null)
        if (m === me) { await say(`${me.name} is already out!`); continue }
        await switchTo(m); used = true
      }
      if (!used) continue
      await foeTurn()
      if (fled) return { result: 'fled' }
      if (me.hp > 0) await tickStatus(me)
      if (foe.hp > 0) await tickStatus(foe)
      if (foe.hp <= 0) { const r = await foeDown(); if (r) return r }
      if (me.hp <= 0) {
        sfx('faint')
        await anim($('player'), [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(120px)', clipPath: 'inset(0 0 120px 0)' }], { duration: 520 }).finished
        $('player').style.visibility = 'hidden'
        await say(`${me.name} fainted!`); addBond(me, -10)
        const up = party.filter((m) => m.hp > 0)
        if (!up.length) { $('phud').style.visibility = 'hidden'; return { result: 'lost' } }
        // Your call who goes in next (the demo takes the first).
        let next = up[0]
        if (!demo && up.length > 1) {
          drawParty(true); panel('pParty'); msg0('Send out which Pokémon?', '')
          next = party[+(await choose('pParty', null)).slice(1)]; panel(null)
        }
        me = next; await sendOut(me)
      }
    }
  }

  let demoNoBlunder = false
  /* ══════════ encounters, from the machine ══════════ */
  /**
   * Evolutions due from this battle, one at a time, on the battle screen: the
   * old and new forms flicker faster and faster to the evolution music, and
   * STOP (B) cancels it, for another try 5 levels later. The demo lets it run.
   */
  async function runEvolutions() {
    for (const m of [...pendingEvos]) {
      pendingEvos.delete(m)
      const e = evoDue(m); if (!e) continue
      const to = speciesByName(e.to); if (!to) continue
      for (const w of ['enemy', 'player', 'trainer']) { $(w).getAnimations().forEach((a) => a.cancel()); $(w).style.visibility = 'hidden' }
      ;['ehud', 'phud'].forEach((h) => { $(h).style.visibility = 'hidden' }); fx.innerHTML = ''
      const stage = document.createElement('div'); stage.className = 'evostage'
      stage.innerHTML = `<img class="a" src="${ART[m.id]}" alt=""><img class="b" src="${ART[to.id]}" alt="">`
      $('ts').appendChild(stage)
      const [a, b] = stage.querySelectorAll('img')
      Sound.music('evolution')
      await say('What?', `${m.name} is evolving!`, 500)
      $('pEvo').querySelector('small').textContent = e.item ? `keeps the ${EVO_ITEM_NAME[e.item]}` : 'it will try again in 5 levels'
      panel(demo ? null : 'pEvo')
      let stopped = false
      const off = listen((btn) => { if (btn === 'b') stopped = true })
      // The flicker: white silhouettes swapping, faster as it goes (about 6 s).
      a.classList.add('glow'); b.classList.add('glow')
      for (let i = 0, gap = 520; i < 26 && !stopped; i++, gap = Math.max(70, gap * 0.86)) {
        const showNew = i % 2 === 1
        a.style.opacity = showNew ? 0 : 1; b.style.opacity = showNew ? 1 : 0
        await W(gap)
      }
      off(); panel(null)
      a.classList.remove('glow'); b.classList.remove('glow')
      if (stopped) {
        a.style.opacity = 1; b.style.opacity = 0
        sfx('flinch'); Sound.stopMusic()
        await say(`Huh? ${m.name}`, 'stopped evolving!', 500)
        // Stopped with an item: the item isn't used. On a level-up: another try in 5 levels.
        if (e.item) { delete m.evoForce; await say(`The ${EVO_ITEM_NAME[e.item]} wasn't used.`, '', 700) }
        else { m.evoWait = m.level + 5; await say(`It will try again at Lv ${m.evoWait}.`, '', 700) }
      } else {
        if (e.item) { bag[e.item]--; if (e.needs) bag[e.needs]-- }   // the item (and Seadra's Dragon Scale) is used up
        a.style.opacity = 0; b.style.opacity = 1
        flash('#fff', 0.95, 600); Sound.music('evolved'); cry(to)
        const was = m.name
        evolveInto(m, to.name)
        await say('Congratulations! Your', `${was} evolved into ${m.name}!`, 1400)
        for (const r of learnAtLevel(m)) await say(`${m.name} learned ${r.name}!`, r.equipped ? '' : 'Swap it in from the Box.', 600)
        renderTools()
      }
      stage.remove()
      Sound.stopMusic()
    }
  }
  async function backToMachine(state, blocked = false) {
    await runEvolutions()
    // Status conditions carry over, like HP: a fainted Pokémon loses its, the rest keep theirs until cured.
    for (const m of [...party, ...box]) if (m.hp <= 0) m.status = null
    await fadeThrough(async () => {
      for (const w of ['enemy', 'player']) { $(w).getAnimations().forEach((a) => a.cancel()); $(w).style.visibility = 'hidden' }
      ;['ehud', 'phud'].forEach((h) => { $(h).style.visibility = 'hidden' })
      fx.innerHTML = ''; panel(null); msg0('', '')
      renderHome(state, blocked); showLayer('home')
    })
    renderTools(); toolsEnabled(true); saveGame()
  }

  async function wildEncounter(demoPlan, state = homeState, legend = false) {
    if (!party.some((m) => m.hp > 0)) { renderHome(homeState); $('homeSub').textContent = 'your party has fainted. Heal them first!'; sfx('blocked'); return }
    toolsEnabled(false)
    // The machine shudders, and something leaps out from behind it.
    sfx('rustle')
    await anim($(state === 'maint' ? 'maint' : 'attractRows'), [0, -4, 4, -3, 3, 0].map((v) => ({ transform: `translateX(${v}px)` })), { duration: 360 }).finished
    const b = bangOn($('home'), 150, 160); await W(560); b.remove()
    // Now and then, one of the roaming legendaries instead: the shared one, HP and all.
    const roamer = legend || (!demoPlan && flavor() < LEGEND_RATE) ? pickLegend() : null
    const species = demoPlan ? DATA.wild.find((w) => w.name === demoPlan.wild) : wildFrom(YOU)   // from your seed's pool this week
    const foe = roamer ?? individual(species, demoPlan ? 4 : wildLevel(species), rand)
    if (roamer) { sfx('quake'); $('homeSub').textContent = `a powerful presence... ${roamer.name} burst out!` }
    await wipeWild(async () => { setScene(WILD_SCENES, sceneRoll); showLayer('battle') })
    const out = await battle({ kind: 'wild', foe, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'caught') {
      foe.hp = foe.stats.hp
      if (party.length < 6) party.push(foe); else box.push(foe)
      $('player').style.visibility = 'hidden'; $('phud').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'
      renderTools()
      if (demo) cap('CAUGHT', `It arrives with its own IVs and nature, rolled the moment it appeared. ${party[0].name} kept its damage — HP carries over.`)
      await summary(foe, evoText(foe) ? `Evolves: ${evoText(foe)}` : 'It does not evolve.', `${foe.name} joined your party!`, `Party ${party.length}/6`)
      Sound.stopMusic()
    }
    else if (out.result === 'lost') { await say('You have no Pokémon left', 'that can fight!') }
    if (roamer) { if (out.result === 'caught') foe.roamer = false; legendAfter(roamer, out.result, 'You') }
    Sound.stopMusic()
    await backToMachine(state)
  }

  async function scalperEncounter(demoPlan, state = 'in') {
    toolsEnabled(false)
    if (demoPlan?.who) scalper = demoPlan.who
    // Who's camping it. The demo always meets Herb; in Play it's anyone, at random.
    if (!demoPlan && $('homeLoiterer').style.display !== 'block') scalper = randomTrainers(1)[0]
    const T = scalper
    // The machine restocks... and someone's already standing at it.
    renderHome(state); if (state === 'in') sfx('restock'); await W(demo ? 1200 : 700)
    $('homeLoiterer').src = ART[T.body]
    $('homeLoiterer').style.display = 'block'
    anim($('homeLoiterer'), [{ transform: 'translateX(220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' })
    await W(560)
    renderHome(state, true); $('homeLoiterer').style.display = 'block'
    sfx('blocked'); const b = bangOn($('home'), 214, 92); await W(700); b.remove()
    if (!party.some((m) => m.hp > 0)) { $('homeSub').textContent = 'heal your party to take them on'; toolsEnabled(true); return }
    Sound.music('vs')
    await wipeTrainer(async () => {
      setScene(SCALPER_SCENES, sceneRoll); showLayer('battle')
      const vs = $('vs'); $('vsImg').src = ART[T.vs]; $('vsName').textContent = T.full; vs.querySelector('.name span').textContent = T.title ?? 'SCALPER'; vs.style.display = 'block'
      vsIn(vs)
    })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    if (demo) cap('SCALPER', 'Scalpers get their own wipe and a VS splash, then say their piece. They block the restock for everyone until someone beats them.')
    await W(1300)
    await talk(T, demoPlan ? T.intro[0] : pickOf(T.intro))
    $('vs').style.display = 'none'; $('vs').getAnimations({ subtree: true }).forEach((a) => a.cancel())
    Sound.music('battle')
    // Their Pokémon for this battle, from their pool; the demo always meets Herb's GHOLDENGO.
    const deck = deckFor(T, leadLevel(), demoPlan ? [T.mon] : null)   // around your lead: see levelBand()
    demoNoBlunder = !!demoPlan?.noBlunder
    const out = await battle({ kind: 'trainer', foe: deck[0], roster: deck.slice(1), trainer: T, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'won') {
      restBeaten([T])   // they stay away for a while
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(T, 'down')
      anim($('trainer'), [{ transform: 'none' }, { transform: 'translateY(3px) scaleY(.97)', offset: .5 }, { transform: 'none' }], { duration: 520, easing: 'ease-in-out' })
      await talk(T, pickOf(T.outro), 'faceDown'); await trainerOff()
      await out.exp?.()   // EXP after their parting words, then tokens
      wallet = Math.round((wallet + +T.tokens) * 100) / 100
      sfx('tokens'); await say(`You got ${T.tokens} tokens!`, 'The VVM is free!', 600)   // always
      await loot(T)   // sometimes
      Sound.stopMusic()
      await backToMachine(state)
    } else {
      Sound.stopMusic()
      await trainerOn(T); await talk(T, pickOf(T.gloat)); await trainerOff()
      await say(`${T.short} is still`, 'at the VVM...')
      await backToMachine(state, true)
      $('homeLoiterer').src = ART[T.body]
    }
  }

  /* ══════════ starter pick ══════════ */
  async function pickStarter() {
    Sound.music('win')
    let region = 0, sel = 1
    const S = (r) => DATA.starters.filter((s) => s.region === r)
    $('showcase').style.display = 'block'
    $('chips').innerHTML = DATA.regions.map((r, i) => `<button class="chip" data-region="${i}">${r.slice(0, 3).toUpperCase()}</button>`).join('')
    function draw() {
      const three = S(region)
      $('regionName').innerHTML = `${DATA.regions[region].toUpperCase()}<small>CHOOSE YOUR PARTNER · ${region + 1}/9</small>`
      three.forEach((m, i) => { const slot = $('slot' + i), img = slot.querySelector('img'); img.src = ART[m.id]; img.style.height = '84px'; slot.style.left = (36 + i * 92) + 'px'; slot.classList.toggle('dim', i !== sel) })
      $('pick3').innerHTML = three.map((m, i) => `<button class="btn t-${m.types[0]}${i === sel ? ' sel' : ''}" data-pick="${i}">${m.name}<small>${m.types.join(' / ').toUpperCase()}</small></button>`).join('')
      document.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', i === region))
      $('bChoose').textContent = `CHOOSE ${three[sel].name}`
    }
    draw(); panel('pPick'); msg0('Choose your first partner!', "Any region's starter.")
    cap('STARTER', demo ? "Your first Pokémon can be any region's starter — 27 of them, Kanto to Paldea, all level 5." : 'Pick a region along the top, then a starter. ← → region, ↑ ↓ starter, A chooses.')
    const onTap = (e) => {
      if (MODE !== 'play' || !live()) return
      const r = e.target.closest('[data-region]'), p = e.target.closest('[data-pick]')
      if (r) { region = +r.dataset.region; sfx('move'); draw() }
      if (p) { sel = +p.dataset.pick; sfx('move'); draw() }
    }
    $('pPick').addEventListener('pointerdown', onTap)
    try {
      if (demo) {
        for (const r of [3, 6, 8]) { await W(420); region = r; sfx('move'); draw() }
        sel = S(region).findIndex((m) => m.name === 'FUECOCO'); await W(450); sfx('move'); draw()
        await demoPress('a', 600, $('bChoose'))
      } else {
        for (;;) {
          const b = await waitFor(['a', 'left', 'right', 'up', 'down'])
          if (b === 'a') break
          if (b === 'left') region = (region + 8) % 9
          if (b === 'right') region = (region + 1) % 9
          if (b === 'up') sel = (sel + 2) % 3
          if (b === 'down') sel = (sel + 1) % 3
          sfx('move'); draw()
        }
      }
    } finally { $('pPick').removeEventListener('pointerdown', onTap) }
    sfx('select')
    const chosen = individual(S(region)[sel], 5, rand)
    flash('#fff', .7, 200); $('showcase').style.display = 'none'; panel(null)
    return chosen
  }

  /* ══════════ the run ══════════ */
  fit(); await W(200)
  if (MODE === 'duo') { await duoDemo(); if (live()) start(); return }
  if (MODE === 'gym') { await gymDemo(); if (live()) start(); return }
  for (const n of LEGENDS) spawnLegend(n)
  // Before any interaction: the idle screen, and no toolbar yet.
  showLayer('home'); renderHome('idle'); showTools(false)
  $('feedList').innerHTML = ''; $('feed').hidden = true   // a fresh run: nobody else at the machine yet
  /** The first tap of all: a restock, with Herb and Paul already camping it. */
  async function firstRestock(demoPlan) {
    $('tts').textContent = 'STARTING…'; sfx('select'); await W(450)
    await fadeThrough(async () => renderHome('in')); sfx('restock'); await W(500)
    await campOut([HERB, PAUL])
    await firstEncounter(demoPlan)
  }

  if (demo) {
    // 1. The first tap: a restock, Herb and Paul, Alex, a starter, and a 2v2 beside him.
    cap('IDLE', 'Before anything happens the machine shows its usual idle screen. No Party, Bag or Box yet: you have no Pokémon.')
    await W(2600); hot($('home'))
    await firstRestock([
      { cmds: [{ move: 'EMBER', target: 0, planned: 'perfect' }],
        foes: { GHOLDENGO: { move: 'MAKE IT RAIN', target: 0 }, HIPPOWDON: { move: 'BULLDOZE' } },
        defend: ['parry', 'parry', 'parry', 'jump'] },
      { cmds: [{ move: 'TACKLE', target: 1, planned: 'great' }],
        foes: { GHOLDENGO: { move: 'SHADOW BALL', target: 0 }, HIPPOWDON: { move: 'CRUNCH', target: 1 } },
        defend: ['dodge'] },
    ])
    // 2. Back to the idle screen, now with the toolbar. Every tap rolls an outcome.
    cap('TAP', "Party, Bag and Box are here now, under the same idle screen. The machine's state is shared, the same for every trainer: right now it's sold out...")
    setMachine('out')
    await W(2600); hot($('home')); await tapMachine({ enc: null }); await W(1700)
    hot($('home')); await toIdle(); await W(700)
    cap('TAP', '...or under maintenance. Nobody gets to the packs then, whoever taps.')
    setMachine('maint')
    hot($('home')); await tapMachine({ enc: null }); await W(1700)
    hot($('home')); await toIdle(); await W(700)
    setMachine('in')
    // What happens on a tap is each trainer's own roll.
    // The wild pool: random until you report a timer, then the machine you reported at.
    const eeveeAt = MACHINES.find((m) => poolFor(m.code).includes('EEVEE') && m.code !== seedOf(YOU).m.code) ?? MACHINES[0]
    cap('WILD POOL', `Each real machine has its own pool of wild Pokémon, six that change every Monday. With no timer reports yet, you're on a random one: ${seedOf(YOU).m.code}.`)
    await W(3200)
    cap('REPORT', `Report a timer at a machine and your pool moves there. You report one at ${eeveeAt.code}, ${eeveeAt.venue}: its pool this week has EEVEE in it.`)
    reportTimer(YOU, eeveeAt.code); await W(3400)
    cap('TOGETHER', 'What happens when you tap is rolled for each trainer on their own. Three trainers tapping in the same second can all get something different.')
    otherTaps('MAYA', 'wild'); await W(500); otherTaps('SAM', null); await W(2400)
    // 1. Tap the sold-out machine: a wild Eevee.
    cap('WILD', "SAM is on the purchase screen, and only one trainer can be at a time. But battles don't need it: your tap still rolls, and an EEVEE jumps out.")
    await W(1600); hot($('home'))
    await tapMachine({ enc: 'wild', items: ['potion', 'ball'], plan: {
      wild: 'EEVEE',
      turns: [
        { menu: 'fight', move: 'EMBER', planned: 'good', cap: ['MENUS', 'FIGHT, BAG, POKéMON and RUN are separate now. FIGHT opens its own page with every move.'] },
        { menu: 'bag', item: 'ball', planned: 'good', shakes: 2, cap: ['BAG', 'BAG is its own page too: balls and potions. At high HP a catch is a long shot.'] },
        { menu: 'fight', move: 'TACKLE', planned: 'perfect', cap: ['CATCHING', 'Weaken it with a gentler move so it stays awake to be caught.'] },
        { menu: 'bag', item: 'ball', planned: 'perfect', shakes: 4, cap: ['THROW', 'An Excellent throw nearly doubles the catch chance.'] },
      ],
      defend: ['dodge', 'jump', 'late'],
    } })
    unlock('SAM'); lockFor(YOU)   // SAM's done; the stocked screen you're back on is yours
    // Supplies on the stocked shelf: buy a Potion.
    cap('SUPPLIES', "A stocked machine can carry battle supplies beside the packs, each with its own price, and they don't turn up every time. Tap one to buy it with tokens.")
    await W(2200); hot($('supplies').querySelector('[data-buy="potion"]')); buySupply('potion'); await W(1800)
    // 2. Use a Potion from the Bag, on the Pokémon you choose.
    await W(900)
    cap('BAG', 'Items work from the Bag outside battle too: pick the item, then the Pokémon. Balls stay greyed out — they\'re for wild battles.')
    hot($('tBag')); sfx('select')
    let sh = openSheet('bag')
    await W(1700)
    await sh.tap('[data-item="potion"]', 1500)
    await sh.tap(`[data-target="${party.indexOf(party.find((m) => m.name === 'FUECOCO'))}"]`, 2000)
    hot($('sheetClose')); closeSheetNow(); await W(500)

    // 3. The Party: tap a Pokémon for its stats, and change the battle order.
    cap('PARTY', 'Tap a Pokémon for its full stat page — numbers, IVs, nature — with item buttons right there. ▲ ▼ set the battle order.')
    hot($('tParty')); sfx('select')
    sh = openSheet('party')
    await W(1600)
    await sh.tap('[data-stat="1"]', 3200)
    await sh.tap('[data-back]', 1000)
    cap('ORDER', 'Number 1 goes out first. Moving EEVEE up makes it the lead...')
    await sh.tap('[data-up="1"]', 1600)
    cap('ORDER', '...and ▲ again puts FUECOCO back in front.')
    await sh.tap('[data-up="1"]', 1500)
    hot($('sheetClose')); closeSheetNow(); await W(500)
    // 4. Another tap: Brian, who doesn't know the first thing about Pokémon.
    await toIdle(); await W(600)
    cap('BRIAN', "Not every scalper knows Pokémon. Brian's in it for the resale money, and his \"kid\". He's the easy one.")
    await W(1400); hot($('home'))
    await tapMachine({ enc: 'scalper', plan: {
      who: BRIAN,
      turns: [
        { menu: 'fight', move: 'TACKLE', planned: 'perfect', cap: ['EASY', 'Brian picks Pokémon by price and calls them whatever. Nearly half his turns go to waste.'] },
        { menu: 'fight', move: 'QUICK ATTACK', planned: 'perfect' },
      ],
      defend: ['parry', 'parry'],
    } })
    cap('FREE', 'Brian is gone too. He paid less, but he was a lot less trouble.')
    await W(3200)
    if (live()) start()
    return
  }

  /* Play: everything hangs off the machine and the toolbar. Until the first
     restock is cleared (with Alex), every tap leads there. */
  const playCap = () => cap('PLAY', "Tap TOUCH TO START. The machine's state is shared by everyone; what jumps out is rolled for you alone. Other trainers are using it too (see the feed): only the purchase screen is one at a time.")
  cap('PLAY', "This is the machine's idle screen. You don't have a Pokémon yet. Tap TOUCH TO START.")
  const guard = (fn) => async () => { if (busy || !live()) return; busy = true; try { await fn() } catch (e) { if (e !== STOP) console.error(e) } finally { busy = false } }
  /** Other trainers use the same machine every few seconds, once you're past the tutorial. */
  const othersLoop = () => {
    const tick = () => { if (!live()) return; if (tutorialDone) otherTaps(OTHERS[Math.floor(Math.random() * OTHERS.length)]); setTimeout(tick, 5000 + Math.random() * 5000) }
    setTimeout(tick, 3000)
  }
  /*
   * Saving. Play mode keeps one save in this browser: the party and Box (each
   * Pokémon's level, EXP, moves, HP and status), the Bag, tokens, badges, the
   * Elite Four ladder and Champion, today's free heal, timer reports and the
   * roaming legendaries. SAVE under the machine saves now; it also saves on its
   * own after every battle, purchase or Bag/Party/Box visit, and every 30 s.
   * In the real app this lives on the server instead.
   */
  // In the app, one save per account on this device.
  const SAVE_KEY = 'vvm-save' + (APP.uid ? ':' + APP.uid : '')
  function saveGame(why = 'auto') {
    if (demo || !tutorialDone) return false
    const data = { v: 1, at: Date.now(), party, box, bag, wallet, badges, champion, eliteStep, freeHeal, gifted, roam: ROAM, weekShift, reports }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)) } catch { return false }
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    $('saveN').textContent = why === 'manual' ? 'saved!' : t
    if (why === 'manual') { sfx('select'); feed(`<b>You</b> saved the game.`); setTimeout(() => { $('saveN').textContent = t }, 1500) }
    return true
  }
  /** Puts a save back: true if there was one. */
  function loadGame() {
    let s; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch { return false }
    if (!s?.v || !s.party?.length) return false
    party.splice(0, party.length, ...s.party); box.splice(0, box.length, ...(s.box ?? []))
    for (const k of Object.keys(bag)) delete bag[k]
    for (const [k, n] of Object.entries(s.bag ?? {})) {
      // Discs and summons are registered as items the first time one turns up: do that again.
      if (k.startsWith('disc:')) discItem(k.slice(5))
      if (k.startsWith('summon:')) summonItem(k === 'summon:elite' ? 'elite' : +k.slice(7))
      if (ITEMS[k]) bag[k] = n
    }
    wallet = s.wallet ?? wallet; badges.splice(0, badges.length, ...(s.badges ?? []))
    champion = !!s.champion; eliteStep = s.eliteStep ?? 0; freeHeal = s.freeHeal ?? freeHeal; gifted = s.gifted ?? true
    for (const [n, m] of Object.entries(s.roam ?? {})) ROAM[n] = m
    weekShift = s.weekShift ?? 0; Object.assign(reports, s.reports ?? {})
    tutorialDone = true
    $('wallet').textContent = `${wallet.toFixed(2)} tk`; renderRoamers?.(); renderPool?.(); renderTools()
    return new Date(s.at)
  }
  const first = async () => { await (homeState === 'idle' ? firstRestock() : firstEncounter()); if (tutorialDone) { playCap(); toolsEnabled(true); othersLoop(); saveGame() } }
  // A save from before: straight back to where you were.
  const loaded = loadGame()
  if (!loaded) $('saveN').textContent = '—'
  if (loaded) { showTools(true); toolsEnabled(true); playCap(); othersLoop(); feed(`<b>Welcome back.</b> Loaded your save from ${loaded.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`); $('saveN').textContent = loaded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }
  setInterval(() => { if (live() && !busy) saveGame() }, 30000)
  window.__saveSoon = () => setTimeout(() => { if (live()) saveGame() }, 200)
  // The app's exit button saves before it leaves.
  window.__saveNow = () => { if (live()) saveGame() }
  $('tSave').onclick = () => { if (!busy) saveGame('manual') }
  $('bNewGame').onclick = () => { if (!confirm('Delete your save and start a new game?')) return; try { localStorage.removeItem(SAVE_KEY) } catch {} start() }
  $('reportAt').innerHTML = MACHINES.map((m) => `<option value="${m.code}">${m.code} · ${m.venue}</option>`).join('')
  $('bReport').onclick = () => { if (tutorialDone) reportTimer(YOU, $('reportAt').value) }
  // Testing: jump to the League (all 8 Johto badges, the party at Lv 45, healed, and 10 more tokens).
  $('bLeague').onclick = guard(async () => {
    if (!tutorialDone) return
    for (let i = 0; i < 8; i++) if (!badges.includes(i)) badges.push(i)
    for (const m of party) { m.level = Math.max(m.level, 45); m.exp = 0; m.stats = statsAt(m, m.level); m.hp = m.stats.hp; learnAtLevel(m) }
    wallet = Math.round((wallet + 10) * 100) / 100; $('wallet').textContent = `${wallet.toFixed(2)} tk`; renderTools()
    feed('Skipped to the League: all 8 Johto badges, the party at Lv 45. ELITE FOUR TICKETS can now turn up on a stocked machine.')
  })
  // Testing: every party Pokémon goes up a level (as a real level-up would), and any evolution plays out.
  $('bLevel').onclick = guard(async () => {
    if (!tutorialDone || !party.length) return
    for (const m of party) { const hpBefore = m.stats.hp; m.level = Math.min(LEVEL_CAP, m.level + 1); m.exp = 0; m.stats = statsAt(m, m.level); m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore)); if (evoDue(m)) pendingEvos.add(m); learnAtLevel(m) }
    feed(`Testing: your party is now ${party.map((m) => `${m.name} Lv ${m.level}`).join(', ')}.`)
    if (!pendingEvos.size) return renderTools()
    toolsEnabled(false)
    await fadeThrough(async () => { setScene(['plain']); showLayer('battle') })
    await backToMachine('idle')
  })
  $('bWeek').onclick = () => { if (!tutorialDone) return; weekShift++; renderPool(true); feed(`A new week: every machine's wild pool has changed.${Object.keys(reports).includes(YOU) ? '' : ' With no report, you are on a new random machine.'}`) }
  // Other trainers report timers now and then too, moving their own pools.
  setInterval(() => { if (live() && tutorialDone && Math.random() < 0.25) reportTimer(OTHERS[Math.floor(Math.random() * OTHERS.length)], MACHINES[Math.floor(Math.random() * MACHINES.length)].code) }, 9000)
  window.__vvm = { machine, otherTaps, rollEncounter, poolFor, seedOf, reportTimer, MACHINES, thisWeek, bumpWeek: () => { weekShift++; renderPool() }, party, bag, get wallet() { return wallet }, renderTools, emptyRun, PITY_AFTER, rollTap }   // for tests: the shared machine, the other trainers, and your party, Bag and tokens
  $('machineState').onchange = () => { setMachine($('machineState').value); feed(`The machine is now <b>${{ in: 'stocked', out: 'sold out', maint: 'under maintenance' }[machine.state]}</b>, for everyone.`) }
  // Three trainers tap in the same instant: three independent rolls. Yours then plays out.
  $('bTogether').onclick = guard(async () => {
    if (!tutorialDone || homeState !== 'idle') return
    const mine = rollEncounter(streams[YOU])
    for (const n of ['MAYA', 'SAM']) otherTaps(n)
    feed(`<b>You</b> tapped: ${ENC_TEXT[mine].replace('them', 'you')}.`)
    await tapMachine({ enc: mine })
  })
  $('home').onclick = guard(async () => {
    if (!tutorialDone) return first()
    // A scalper who beat you is still camping it; otherwise a state screen goes back to idle, and idle rolls a tap.
    if ($('homeLoiterer').style.display === 'block') return scalperEncounter(null, homeState)
    if (homeState !== 'idle') return toIdle()
    const v = $('nextTap').value
    await tapMachine(!v ? {} : v === 'find' ? { enc: null, find: true } : v === 'legend' ? { enc: 'wild', legend: true } : { enc: v === 'none' ? null : v })
  })
  $('bAdmin').onclick = guard(() => openAdmin())
  // Listen to any song, including ones for battles that aren't in the game yet (rivals).
  $('musicPick').onchange = () => { const v = $('musicPick').value; if (!v) return Sound.stopMusic(); Sound.setOn(true); syncSnd(); Sound.music(v) }
  for (const [b, k] of [['tParty', 'party'], ['tBag', 'bag'], ['tBox', 'box']]) {
    $(b).onclick = guard(async () => {
      if (!party.length) return
      const sh = openSheet(k); await sh.closed
      saveGame()
      // A summon chosen in the Bag: the Gym Leader appears once the sheet is closed.
      if (pendingSummon != null) { const n = pendingSummon; pendingSummon = null; await (n === 'elite' ? eliteBattle() : gymBattle(n)) }
      // An evolution item used in the Bag: the evolution plays on the battle screen, then back to the machine.
      if (pendingEvoItem) {
        pendingEvoItem = false; toolsEnabled(false)
        const was = homeState
        await fadeThrough(async () => { setScene(['plain']); showLayer('battle') })
        await backToMachine(was)
      }
    })
  }
}

try { if (localStorage.getItem('vvm-sound') === '1') Sound.setOn(true) } catch {}
// In the app, sound follows Settings → Sound effects (the app's 'vm-sound' switch).
if (APP.on) { let off = false; try { off = localStorage.getItem('vm-sound') === 'off' } catch {} ; Sound.setOn(!off) }
syncSnd(); setMode(MODE)
document.fonts.ready.then(() => { fit(); start() })

