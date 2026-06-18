// AetherOS Holographic Context Memory (HCM)
// Port of aether-engine's hcm.rs — VSA + FFT for fixed-size associative memory
// Uses complex number arrays to simulate FFT circular convolution

export class HolographicContextMemory {
  private dimension: number;
  private realState: Float64Array;
  private imagState: Float64Array;
  private pairCount: number = 0;

  constructor(dimension: number = 1024) {
    this.dimension = dimension;
    this.realState = new Float64Array(dimension);
    this.imagState = new Float64Array(dimension);
  }

  // Hash a string to a bipolar vector (near-orthogonal keys)
  private hashToVector(input: string): { real: Float64Array; imag: Float64Array } {
    const real = new Float64Array(this.dimension);
    const imag = new Float64Array(this.dimension);

    // SplitMix-style rolling hash with golden-ratio seed
    let hash = 0x9e3779b97f4a7c15n;
    for (let i = 0; i < input.length; i++) {
      hash ^= BigInt(input.charCodeAt(i));
      hash = (hash * 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
      hash = ((hash >> 17n) | (hash << 47n)) & 0xFFFFFFFFFFFFFFFFn;
      hash = (hash * 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
    }

    // Generate bipolar contributions
    for (let i = 0; i < this.dimension; i++) {
      hash = ((hash >> 13n) ^ hash) & 0xFFFFFFFFFFFFFFFFn;
      hash = (hash * 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
      const val = Number(hash % 1000n) / 1000;
      real[i] = val > 0.5 ? 1 : -1;
      imag[i] = (val * 2 - 1) * 0.1; // Small imaginary component
    }

    // L2 normalize
    this.normalizeVector(real);

    return { real, imag };
  }

  // Write: state += IFFT( FFT(key) ⊙ FFT(value) )
  write(key: string, value: string): void {
    const keyVec = this.hashToVector(key);
    const valVec = this.hashToVector(value);

    // Simulate circular convolution in frequency domain
    // For simplicity: state += key ⊙ value (element-wise multiply in "frequency domain")
    for (let i = 0; i < this.dimension; i++) {
      // Complex multiplication: (kr + ki*j)(vr + vi*j) = (kr*vr - ki*vi) + (kr*vi + ki*vr)j
      const kr = keyVec.real[i], ki = keyVec.imag[i];
      const vr = valVec.real[i], vi = valVec.imag[i];

      this.realState[i] += kr * vr - ki * vi;
      this.imagState[i] += kr * vi + ki * vr;
    }

    this.pairCount++;
  }

  // Read: value ≈ IFFT( conj(FFT(state)) ⊙ FFT(key) )
  read(key: string): { confidence: number; interference: number } {
    const keyVec = this.hashToVector(key);

    // Circular correlation: conj(state) ⊙ key
    let dotProduct = 0;
    let totalEnergy = 0;
    for (let i = 0; i < this.dimension; i++) {
      // conj(state) ⊙ key = (sr - si*j) * (kr + ki*j)
      const sr = this.realState[i], si = this.imagState[i];
      const kr = keyVec.real[i], ki = keyVec.imag[i];

      const resultReal = sr * kr + si * ki;
      dotProduct += resultReal;
      totalEnergy += sr * sr + si * si;
    }

    // Confidence is proportional to correlation
    const confidence = totalEnergy > 0 ? Math.abs(dotProduct) / Math.sqrt(totalEnergy) / this.dimension : 0;

    // Interference metric: sqrt(imag_energy / total_energy)
    let imagEnergy = 0;
    for (let i = 0; i < this.dimension; i++) {
      imagEnergy += this.imagState[i] * this.imagState[i];
    }
    const interference = totalEnergy > 0 ? Math.sqrt(imagEnergy / totalEnergy) : 0;

    return { confidence: Math.min(1, confidence * 10), interference };
  }

  private normalizeVector(vec: Float64Array): void {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }
  }

  getStats() {
    let realEnergy = 0, imagEnergy = 0;
    for (let i = 0; i < this.dimension; i++) {
      realEnergy += this.realState[i] * this.realState[i];
      imagEnergy += this.imagState[i] * this.imagState[i];
    }
    const totalEnergy = realEnergy + imagEnergy;

    return {
      dimension: this.dimension,
      pairCount: this.pairCount,
      interference: totalEnergy > 0 ? Math.sqrt(imagEnergy / totalEnergy) : 0,
      memoryUsageBytes: this.dimension * 2 * 8, // 2 Float64Arrays
      snr: this.pairCount > 0 ? 1 / Math.sqrt(this.pairCount) : Infinity,
    };
  }

  clear(): void {
    this.realState.fill(0);
    this.imagState.fill(0);
    this.pairCount = 0;
  }
}
