import * as THREE from "three";
import { makeImpulseResponse } from "./procedural-ir";

export type RoomAudio = { context: AudioContext; output: GainNode; convolver: ConvolverNode; dispose: () => void };

export function createRoomAudio(listener: THREE.AudioListener): RoomAudio {
  const context = listener.context;
  const output = context.createGain();
  const convolver = context.createConvolver();
  const [left, right] = makeImpulseResponse({ rt60: 0.62, preDelayMs: 8, brightness: 0.62 });
  const buffer = context.createBuffer(2, left.length, context.sampleRate);
  buffer.copyToChannel(left, 0);
  buffer.copyToChannel(right, 1);
  convolver.buffer = buffer;
  convolver.connect(output);
  output.connect(context.destination);
  return { context, output, convolver, dispose: () => { convolver.disconnect(); output.disconnect(); } };
}
