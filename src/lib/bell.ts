// Sino suave sintetizado (Web Audio). Chamar apenas no navegador.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function playBell() {
  unlockAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  const partials = [
    { f: 528, g: 1, d: 6 },
    { f: 1056, g: 0.35, d: 4 },
    { f: 1584, g: 0.18, d: 3 },
    { f: 2640, g: 0.08, d: 2 },
  ];
  for (const p of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = p.f;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(p.g, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + p.d + 0.1);
  }
}
