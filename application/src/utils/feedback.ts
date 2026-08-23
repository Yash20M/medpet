import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;

const getPlayer = (): AudioPlayer | null => {
  if (player) return player;
  try {
    setAudioModeAsync({ playsInSilentMode: true });
    player = createAudioPlayer(require('../../assets/sounds/pop.wav'));
    player.volume = 1;
  } catch (e) {
    console.warn('[feedback] sound init failed:', e);
  }
  return player;
};

/** Soft pop + light vibration — fired when an item is added to the cart. */
export const addToCartFeedback = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  try {
    const p = getPlayer();
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch (e) {
    console.warn('[feedback] sound play failed:', e);
  }
};
