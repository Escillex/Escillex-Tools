/**
 * The three models in the picker. Each is pinned to one Hugging Face
 * revision so a change upstream can't break the tool, and so the cached
 * copy stays valid.
 */
export type ModelId = 'fast' | 'balanced' | 'best';

export interface ModelSpec {
	id: ModelId;
	name: string;
	note: string;
	repo: string;
	revision: string;
	dtype: 'q8' | 'fp32';
	/** Set when the file name doesn't follow the dtype naming (Best's file is already fp16 but loads as-is). */
	fileName?: string;
	/** The big file; the model counts as downloaded once this one is cached. */
	file: string;
	bytes: number;
	needsWebGPU: boolean;
	/** Storage buffers per shader the GPU must allow (some adapters allow very few). */
	minGpuBuffers?: number;
	/** The model's input and output tensor names. */
	input: string;
	output: string;
	/** BiRefNet outputs raw scores; the others output 0..1 already. */
	sigmoid: boolean;
	/** RMBG's config has no model type Transformers.js knows, so it's loaded as a plain custom model. */
	custom: boolean;
}

const MB = 1048576;

export const MODELS: ModelSpec[] = [
	{
		id: 'fast',
		name: 'Fast',
		note: 'Best for people and older phones',
		repo: 'Xenova/modnet',
		revision: 'fa2fa546052fba4c08921230a26cc69a333fca12',
		dtype: 'q8',
		file: 'onnx/model_quantized.onnx',
		bytes: Math.round(6.3 * MB),
		needsWebGPU: false,
		input: 'input',
		output: 'output',
		sigmoid: false,
		custom: false
	},
	{
		id: 'balanced',
		name: 'Balanced',
		note: 'Anything: people, pets, products',
		repo: 'briaai/RMBG-1.4',
		revision: '2ceba5a5efaec153162aedea169f76caf9b46cf8',
		dtype: 'q8',
		file: 'onnx/model_quantized.onnx',
		bytes: Math.round(42.3 * MB),
		needsWebGPU: false,
		input: 'input',
		output: 'output',
		sigmoid: false,
		custom: true
	},
	{
		id: 'best',
		name: 'Best',
		note: 'Sharpest hair and fine detail',
		// BiRefNet-lite with its graph rewritten to run on WebGPU (the official export needs
		// 17 storage buffers in one shader; Chrome on Windows allows 16). Same weights.
		repo: 'jiabins0303/birefnet-lite-1024-webgpu',
		revision: '1ad01cef0f4101a285c5a3e0bd7f15597d93403f',
		dtype: 'fp32',
		fileName: 'model_fp16',
		file: 'onnx/model_fp16.onnx',
		bytes: Math.round(109.5 * MB),
		needsWebGPU: true,
		minGpuBuffers: 8,
		input: 'input_image',
		output: 'output_image',
		sigmoid: true,
		custom: false
	}
];

export const modelById = (id: string | null | undefined) => MODELS.find((m) => m.id === id);

export interface Device {
	webgpu: boolean;
	/** navigator.deviceMemory in GB (Chrome only); null when the browser doesn't say. */
	memoryGB: number | null;
	/** The GPU's maxStorageBuffersPerShaderStage; null without WebGPU. */
	gpuBuffers: number | null;
}

/** Why a model can't run on this device, or null when it can. */
export function unusableReason(m: ModelSpec, d: Device): string | null {
	if (!m.needsWebGPU) return null;
	if (!d.webgpu) return 'Your device does not support WebGPU';
	if ((d.gpuBuffers ?? 0) < (m.minGpuBuffers ?? 0)) return "Your GPU can't run this model";
	return null;
}

export const usable = (m: ModelSpec, d: Device) => unusableReason(m, d) === null;

/** Last used if it still works here; otherwise Fast for weak devices, Balanced for the rest. */
export function defaultModel(d: Device, last?: string | null): ModelId {
	const prev = modelById(last);
	if (prev && usable(prev, d)) return prev.id;
	return !d.webgpu || (d.memoryGB !== null && d.memoryGB <= 4) ? 'fast' : 'balanced';
}

/** Where Transformers.js caches downloads (Cache API), keyed by the file's URL. */
export const MODEL_CACHE = 'transformers-cache';

export const modelFileUrl = (m: ModelSpec) => `https://huggingface.co/${m.repo}/resolve/${m.revision}/${m.file}`;
export const belongsTo = (m: ModelSpec, url: string) => url.includes(`/${m.repo}/resolve/${m.revision}/`);
export const isDownloaded = (m: ModelSpec, urls: string[]) => urls.includes(modelFileUrl(m));
