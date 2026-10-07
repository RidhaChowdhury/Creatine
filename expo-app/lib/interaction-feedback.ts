import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

export type FeedbackKind = 'water' | 'supplement' | 'undo' | 'goal' | 'selection' | 'error';
export type FeedbackPreferences = { soundEnabled: boolean; vibrationEnabled: boolean; motion: 'system' | 'full' | 'reduced' };
const sources = {
  water: require('../assets/feedback/water.wav'), supplement: require('../assets/feedback/supplement.wav'),
  undo: require('../assets/feedback/undo.wav'), goal: require('../assets/feedback/goal.wav'), error: require('../assets/feedback/error.wav'),
};
const players = new Map<string, AudioPlayer>();
let last = -Infinity;
let context: AudioContext | undefined;
export function primeFeedback(enabled: boolean) {
  if (Platform.OS !== 'web' || !enabled) return;
  try { context ??= new AudioContext(); if (context.state === 'suspended') void context.resume().catch(() => undefined); } catch { /* Optional browser audio. */ }
}
function webSound(kind: FeedbackKind) {
  if (!context || context.state !== 'running' || kind === 'selection') return;
  const notes = kind === 'goal' ? [[523, 784, .16, 0], [784, 1046, .16, .09]]
    : kind === 'water' ? [[620, 310, .14, 0], [1040, 520, .08, .025]]
    : kind === 'supplement' ? [[980, 1250, .065, 0], [660, 660, .085, .025]]
    : kind === 'undo' ? [[430, 260, .085, 0]] : [[220, 180, .1, 0]];
  notes.forEach(([from, to, duration, delay], index) => {
    const oscillator = context!.createOscillator(); const gain = context!.createGain(); const at = context!.currentTime + delay;
    oscillator.frequency.setValueAtTime(from, at); oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(index ? .012 : .035, at + .005); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain).connect(context!.destination); oscillator.start(at); oscillator.stop(at + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
export async function interactionFeedback(kind: FeedbackKind, preferences: FeedbackPreferences, active = true) {
  if (!active || performance.now() - last < 65) return;
  last = performance.now();
  if (preferences.soundEnabled && kind !== 'selection') {
    try {
      if (Platform.OS === 'web') { primeFeedback(true); webSound(kind); }
      else { let player = players.get(kind); if (!player) { player = createAudioPlayer(sources[kind]); player.volume = .2; players.set(kind, player); } await player.seekTo(0); player.play(); }
    } catch { /* Logging success is independent of optional audio. */ }
  }
  if (preferences.vibrationEnabled && Platform.OS !== 'web') {
    try {
      if (kind === 'goal' || kind === 'error') await Haptics.notificationAsync(kind === 'goal' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      else if (kind === 'selection') await Haptics.selectionAsync();
      else await Haptics.impactAsync(kind === 'supplement' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    } catch { /* Haptics may be unavailable on simulators. */ }
  }
}
export function stopFeedback() { players.forEach(player => player.pause()); }
