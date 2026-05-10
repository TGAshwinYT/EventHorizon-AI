/**
 * PCM Worklet Processor — EventHorizon AI
 * 
 * Runs on the audio rendering thread. Extracts RMS amplitude
 * from raw PCM samples and posts it to the main thread for
 * waveform visualization. Designed to be ultra-lightweight
 * with zero allocations in the hot path.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameCount = 0;
    // Only send RMS every N frames to reduce message overhead
    // At 128 samples/frame @ 16kHz, that's ~8ms/frame
    // Sending every 4 frames = ~32ms updates = 30fps visualization
    this._sendInterval = 4;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    this._frameCount++;

    if (this._frameCount % this._sendInterval !== 0) {
      return true;
    }

    const samples = input[0];
    const len = samples.length;
    let sum = 0;

    // Compute RMS (Root Mean Square) for amplitude
    for (let i = 0; i < len; i++) {
      const s = samples[i];
      sum += s * s;
    }

    const rms = Math.sqrt(sum / len);

    // Also compute peak for more responsive visualization
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const abs = samples[i] < 0 ? -samples[i] : samples[i];
      if (abs > peak) peak = abs;
    }

    this.port.postMessage({
      rms: rms,
      peak: peak,
      timestamp: currentTime,
    });

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
