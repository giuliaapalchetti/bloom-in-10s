import { useEffect, useRef, useCallback } from 'react';
import { FREQUENCIES } from '../constants';

export function useGardenAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const playChime = useCallback((row: number, isSuccess = false) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(FREQUENCIES[row], ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(isSuccess ? 0.4 : 0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 2.0);
  }, []);

  const playSuccessArpeggio = useCallback(() => {
    setTimeout(() => playChime(7, true), 0);
    setTimeout(() => playChime(5, true), 100);
    setTimeout(() => playChime(2, true), 200);
    setTimeout(() => playChime(0, true), 300);
  }, [playChime]);

  return { initAudio, playChime, playSuccessArpeggio };
}
