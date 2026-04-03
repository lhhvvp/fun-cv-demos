import * as ToneModule from "tone";

const Tone = ToneModule?.Tone ?? ToneModule?.default ?? globalThis.Tone;

const isToneAvailable =
  !!Tone &&
  typeof Tone.PolySynth === "function" &&
  typeof Tone.start === "function";

if (!isToneAvailable && typeof console !== "undefined") {
  console.warn("Tone.js failed to load; sound effects are disabled.");
}

const UNLOCK_EVENTS = ["pointerdown", "touchstart", "mousedown", "keydown"];

let synth = null;
let reverb = null;
let filter = null;
let chorus = null;
let limiter = null;
let volume = null;
let isAudioUnlocked = false;
let unlockListenersAttached = false;
let isInitialized = false;

function ensureAudioGraph() {
  if (!isToneAvailable || synth) {
    return;
  }

  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: "sine"
    },
    envelope: {
      attack: 0.004,
      decay: 0.2,
      sustain: 0.1,
      release: 0.1
    }
  });

  chorus = new Tone.Chorus({
    frequency: 1.5,
    delayTime: 2,
    depth: 0.3,
    wet: 0.25
  }).start();

  filter = new Tone.Filter({
    type: "lowpass",
    frequency: 1000,
    Q: 1.2,
    rolloff: -12
  });

  reverb = new Tone.Reverb({
    decay: 0.3,
    wet: 0.8
  });

  volume = new Tone.Volume(-8);
  limiter = new Tone.Limiter(-3);

  synth.chain(chorus, filter, reverb, volume, limiter, Tone.Destination);
}

function removeUnlockListeners() {
  if (typeof document === "undefined") {
    return;
  }

  UNLOCK_EVENTS.forEach((eventName) => {
    document.removeEventListener(eventName, handleUnlock);
  });

  unlockListenersAttached = false;
}

async function unlockAudio() {
  if (!isToneAvailable || isAudioUnlocked) {
    return;
  }

  try {
    await Tone.start();
    isAudioUnlocked = true;
    ensureAudioGraph();
  } catch (error) {
    isAudioUnlocked = false;
    attachUnlockListeners();
  }
}

async function handleUnlock() {
  removeUnlockListeners();
  await unlockAudio();
}

function attachUnlockListeners() {
  if (!isToneAvailable || typeof document === "undefined" || unlockListenersAttached || isAudioUnlocked) {
    return;
  }

  UNLOCK_EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, handleUnlock, { once: true, passive: true });
  });

  unlockListenersAttached = true;
}

export function initializeSoundEffects() {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  if (!isToneAvailable) {
    return;
  }

  ensureAudioGraph();
  attachUnlockListeners();
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function getScaleForSphereType(type) {
  if (type === "glow") {
    return {
      root: 48, // C4
      intervals: 
        [0, 2, 3, 7, 8,
        12, 14, 15, 19, 20,
        24 , 26, 27, 31, 32] // Hirajoshi scale
    };
  }

  return {
    root: 48, // C3
    intervals: [0] // Single note
  };
}

function calculateImpactEnergy({ impactStrength = 0, baseSpeed = 0, radius = 1 }) {
  const impactComponent = clamp01(impactStrength / 3.2);
  const speedComponent = clamp01(baseSpeed / 3.2);
  const radiusComponent = clamp01((radius - 0.5) / 1.1);

  const baseEnergy = 0.15;
  const energy = baseEnergy + impactComponent * 0.65 + speedComponent * 0.15 + radiusComponent * 0.08;

  return clamp01(energy);
}

function getNoteSet({ sphereType, radius, hue, energy }) {
  if (!isToneAvailable) {
    return [];
  }

  const { root, intervals } = getScaleForSphereType(sphereType);
  
  // Use hue and radius to deterministically select notes from the pentatonic scale
  const hueInfluence = typeof hue === "number" ? hue : Math.random();
  const radiusInfluence = clamp01((radius - 0.5) / 1.5);
  
  // Select note from pentatonic scale based on properties
  const noteIndex = Math.floor((hueInfluence * 0.7 + radiusInfluence * 0.3) * intervals.length);
  const interval = intervals[noteIndex % intervals.length];
  
  // Add subtle octave variation based on energy
  const octaveShift = energy > 0.7 ? 12 : 0;
  
  const baseMidi = root + interval + octaveShift;
  const notes = [Tone.Frequency(baseMidi, "midi").toNote()];

  return notes;
}

export function playCollisionSound({
  impactStrength = 0,
  baseSpeed = 0,
  radius = 1,
  sphereType = "generic",
  hue = null
} = {}) {
  if (!isToneAvailable) {
    return;
  }

  if (!synth) {
    ensureAudioGraph();
  }

  if (!isAudioUnlocked || !synth) {
    return;
  }

  const energy = calculateImpactEnergy({ impactStrength, baseSpeed, radius });
  const notes = getNoteSet({ sphereType, radius, hue, energy });

  if (notes.length === 0) {
    return;
  }

  const now = Tone.now();
  const duration = 0.12 + energy * 0.18;
  const velocity = 0.3 + energy * 0.5;

  // Minimal detune for organic feel without dissonance
  const detuneRange = sphereType === "glow" ? 20 : 5;
  const detuneAmount = (Math.random() - 0.5) * detuneRange;
  synth.set({ detune: detuneAmount });

  if (reverb) {
    const targetWet = 0.25 + energy * 0.2;
    reverb.wet.rampTo(targetWet, 0.05);
  }

  if (filter) {
    // Brighter, more open filter for clarity
    const baseFrequency = sphereType === "glow" ? 8500 : 2800;
    const hueInfluence = typeof hue === "number" ? hue : 0.5;
    const targetFrequency = baseFrequency + hueInfluence * 800 + energy * 600;
    filter.frequency.rampTo(targetFrequency, 0.03);
  }

  synth.triggerAttackRelease(notes, duration, now, velocity);
}