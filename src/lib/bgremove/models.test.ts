import { describe, expect, it } from 'vitest';
import { MODELS, belongsTo, defaultModel, isDownloaded, modelById, modelFileUrl, unusableReason, usable } from './models';

const strong = { webgpu: true, memoryGB: 8, gpuBuffers: 31 };
const weak = { webgpu: false, memoryGB: 4, gpuBuffers: null };
// Chrome on Windows caps every GPU at 16 storage buffers per shader (seen on an RTX 3070).
const windowsGpu = { webgpu: true, memoryGB: 8, gpuBuffers: 16 };
// WebGPU, but an adapter that allows very few storage buffers.
const smallGpu = { webgpu: true, memoryGB: 8, gpuBuffers: 4 };
const best = modelById('best')!;
const balanced = modelById('balanced')!;

describe('model choice', () => {
	it('weak devices start on Fast, others on Balanced', () => {
		expect(defaultModel(weak)).toBe('fast');
		expect(defaultModel({ webgpu: false, memoryGB: 8, gpuBuffers: null })).toBe('fast');
		expect(defaultModel({ webgpu: true, memoryGB: 2, gpuBuffers: 31 })).toBe('fast');
		expect(defaultModel(strong)).toBe('balanced');
		expect(defaultModel({ webgpu: true, memoryGB: null, gpuBuffers: 31 })).toBe('balanced');
	});
	it('remembers the last model while it is still usable', () => {
		expect(defaultModel(strong, 'best')).toBe('best');
		expect(defaultModel(weak, 'balanced')).toBe('balanced');
		expect(defaultModel(weak, 'best')).toBe('fast'); // lost WebGPU: fall back
		expect(defaultModel(strong, 'nonsense')).toBe('balanced');
	});
	it('Best needs WebGPU', () => {
		expect(usable(best, strong)).toBe(true);
		expect(usable(best, weak)).toBe(false);
		expect(usable(balanced, weak)).toBe(true);
	});
	it('Best also needs a GPU that allows enough storage buffers', () => {
		expect(usable(best, windowsGpu)).toBe(true);
		expect(usable(best, smallGpu)).toBe(false);
		expect(defaultModel(smallGpu, 'best')).toBe('balanced');
	});
	it('says why a model is greyed out', () => {
		expect(unusableReason(best, weak)).toBe('Your device does not support WebGPU');
		expect(unusableReason(best, smallGpu)).toBe("Your GPU can't run this model");
		expect(unusableReason(best, strong)).toBeNull();
		expect(unusableReason(balanced, weak)).toBeNull();
	});
	it('lists Fast, Balanced, Best in order', () => {
		expect(MODELS.map((m) => m.id)).toEqual(['fast', 'balanced', 'best']);
	});
});

describe('model cache', () => {
	const url = modelFileUrl(balanced);
	it('points Best at the WebGPU-patched BiRefNet export', () => {
		expect(modelFileUrl(best)).toBe('https://huggingface.co/jiabins0303/birefnet-lite-1024-webgpu/resolve/1ad01cef0f4101a285c5a3e0bd7f15597d93403f/onnx/model_fp16.onnx');
	});
	it('points at the pinned revision', () => {
		expect(url).toBe('https://huggingface.co/briaai/RMBG-1.4/resolve/2ceba5a5efaec153162aedea169f76caf9b46cf8/onnx/model_quantized.onnx');
	});
	it('is downloaded only when the model file itself is cached', () => {
		const config = `https://huggingface.co/briaai/RMBG-1.4/resolve/${balanced.revision}/config.json`;
		expect(isDownloaded(balanced, [config])).toBe(false); // cancelled after the small files
		expect(isDownloaded(balanced, [config, url])).toBe(true);
	});
	it('knows which cached files belong to a model', () => {
		expect(belongsTo(balanced, url)).toBe(true);
		expect(belongsTo(best, url)).toBe(false);
	});
});
