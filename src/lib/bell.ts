// Motor de som do Bambu (Web Audio). Todos os sons são sintetizados — livres de direitos.
// Para usar arquivos próprios, coloque-os em public/sounds/ e preencha AMBIENT_FILES / BELL_FILES.
// Chamar apenas no navegador.

export type BellKind = "tigela" | "gongo" | "sino" | "carrilhao";
export type AmbientKind = "silencio" | "chuva" | "floresta" | "mar" | "rio" | "lareira" | "ruido";

export const BELLS: { id: BellKind; label: string }[] = [
  { id: "tigela", label: "Tigela tibetana" },
  { id: "gongo", label: "Gongo suave" },
  { id: "sino", label: "Sino pequeno" },
  { id: "carrilhao", label: "Carrilhão" },
];

export const AMBIENTS: { id: AmbientKind; label: string }[] = [
  { id: "silencio", label: "Silêncio" },
  { id: "chuva", label: "Chuva" },
  { id: "floresta", label: "Floresta" },
  { id: "mar", label: "Mar" },
  { id: "rio", label: "Rio" },
  { id: "lareira", label: "Lareira" },
  { id: "ruido", label: "Ruído branco" },
];

/** Opcional: caminho de arquivo (ex.: "/sounds/chuva.mp3") substitui o som sintetizado. */
export const AMBIENT_FILES: Partial<Record<AmbientKind, string>> = {};
export const BELL_FILES: Partial<Record<BellKind, string>> = {};

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

function partial(c: AudioContext, out: AudioNode, f: number, g: number, d: number, t: number, attack = 0.02) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = f;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(g, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + d + 0.1);
}

export function playBell(kind: BellKind = "tigela", volume = 0.7) {
  const file = BELL_FILES[kind];
  if (file) {
    const a = new Audio(file);
    a.volume = volume;
    void a.play().catch(() => {});
    return;
  }
  unlockAudio();
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + 0.02;
  const master = c.createGain();
  master.gain.value = 0.4 * volume;
  master.connect(c.destination);
  if (kind === "tigela") {
    for (const [f, g, d] of [[220, 1, 9], [222.5, 0.6, 9], [593, 0.4, 6], [1132, 0.18, 4], [1850, 0.06, 3]] as const)
      partial(c, master, f, g, d, t, 0.04);
  } else if (kind === "gongo") {
    for (const [f, g, d] of [[110, 1, 8], [163, 0.5, 7], [227, 0.35, 6], [319, 0.2, 5], [431, 0.1, 4]] as const)
      partial(c, master, f, g, d, t, 0.25);
  } else if (kind === "sino") {
    for (const [f, g, d] of [[1320, 0.8, 3], [3550, 0.25, 1.6], [5200, 0.08, 0.9]] as const)
      partial(c, master, f, g, d, t, 0.005);
  } else {
    [784, 659, 523].forEach((f, i) => {
      partial(c, master, f, 0.7, 3.5, t + i * 0.55, 0.005);
      partial(c, master, f * 2.76, 0.12, 1.5, t + i * 0.55, 0.005);
    });
  }
}

// ---------- Som ambiente ----------

function noiseBuffer(c: AudioContext, color: "white" | "pink" | "brown") {
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") d[i] = w * 0.5;
    else if (color === "pink") {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  }
  return buf;
}

export interface AmbientHandle {
  pause(): void;
  resume(): void;
  stop(): void;
}

export function startAmbient(kind: AmbientKind, volume = 0.5): AmbientHandle | null {
  if (kind === "silencio" || typeof window === "undefined") return null;

  const file = AMBIENT_FILES[kind];
  if (file) {
    const a = new Audio(file);
    a.loop = true;
    a.volume = volume;
    void a.play().catch(() => {});
    return { pause: () => a.pause(), resume: () => void a.play().catch(() => {}), stop: () => a.pause() };
  }

  const AC =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const c = new AC();
  const out = c.createGain();
  out.gain.setValueAtTime(0, c.currentTime);
  out.gain.linearRampToValueAtTime(volume * 0.6, c.currentTime + 3);
  out.connect(c.destination);
  const timers: ReturnType<typeof setTimeout>[] = [];

  const src = (color: "white" | "pink" | "brown") => {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, color);
    s.loop = true;
    s.start();
    return s;
  };
  const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = c.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const lfo = (target: AudioParam, rate: number, depth: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = rate;
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
  };
  const schedule = (fn: () => void, min: number, max: number) => {
    const loop = () => {
      fn();
      timers.push(setTimeout(loop, min + Math.random() * (max - min)));
    };
    timers.push(setTimeout(loop, min));
  };

  if (kind === "ruido") {
    src("white").connect(filter("lowpass", 9000)).connect(out);
  } else if (kind === "chuva") {
    src("pink").connect(filter("highpass", 600)).connect(filter("lowpass", 7000)).connect(out);
  } else if (kind === "mar") {
    const g = c.createGain();
    g.gain.value = 0.6;
    lfo(g.gain, 0.09, 0.45);
    src("brown").connect(filter("lowpass", 700)).connect(g).connect(out);
  } else if (kind === "rio") {
    const bp = filter("bandpass", 900, 0.4);
    lfo(bp.frequency, 0.3, 250);
    src("pink").connect(bp).connect(out);
  } else if (kind === "lareira") {
    src("brown").connect(filter("lowpass", 350)).connect(out);
    schedule(() => {
      const s = c.createBufferSource();
      s.buffer = noiseBuffer(c, "white");
      const g = c.createGain();
      const t = c.currentTime;
      g.gain.setValueAtTime(0.5 + Math.random() * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.05);
      s.connect(filter("highpass", 1500)).connect(g).connect(out);
      s.start(t, Math.random() * 3, 0.1);
    }, 80, 700);
  } else if (kind === "floresta") {
    const g = c.createGain();
    g.gain.value = 0.35;
    src("pink").connect(filter("lowpass", 1400)).connect(g).connect(out);
    schedule(() => {
      const t = c.currentTime;
      const base = 2500 + Math.random() * 2000;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const o = c.createOscillator();
        const og = c.createGain();
        const st = t + i * 0.14;
        o.frequency.setValueAtTime(base, st);
        o.frequency.exponentialRampToValueAtTime(base * 1.4, st + 0.08);
        og.gain.setValueAtTime(0, st);
        og.gain.linearRampToValueAtTime(0.08, st + 0.02);
        og.gain.exponentialRampToValueAtTime(0.0001, st + 0.12);
        o.connect(og).connect(out);
        o.start(st);
        o.stop(st + 0.15);
      }
    }, 1500, 6000);
  }

  return {
    pause: () => void c.suspend(),
    resume: () => void c.resume(),
    stop: () => {
      timers.forEach(clearTimeout);
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(() => void c.close(), 1700);
    },
  };
}

/** Pré-escuta curta de um som ambiente. */
export function previewAmbient(kind: AmbientKind, volume: number, ms = 4000) {
  const h = startAmbient(kind, volume);
  if (h) setTimeout(() => h.stop(), ms);
  return h;
}
