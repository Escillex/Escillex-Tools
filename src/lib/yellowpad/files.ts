/**
 * Everything that touches real files. Chromium (Edge, Chrome) can save
 * back to the file it opened; elsewhere we fall back to a file input for
 * opening and a download for saving. Kept thin: the logic worth testing
 * lives in codec.ts, recent.ts and saver.svelte.ts.
 */
import { decode, encode, type Eol } from './codec';
import { refreshPreview, rememberFile } from './db';

export interface OpenFile {
	handle: FileSystemFileHandle | null;
	name: string;
	text: string;
	eol: Eol;
	bom: boolean;
	/** False: not UTF-8, so it's opened read-only (see codec.ts). */
	utf8: boolean;
	lastModified: number;
}

// Parts of the File System Access API that TypeScript's DOM types don't include yet.
type Mode = 'read' | 'readwrite';
interface Permissions {
	queryPermission(o: { mode: Mode }): Promise<PermissionState>;
	requestPermission(o: { mode: Mode }): Promise<PermissionState>;
}
interface Pickers {
	showOpenFilePicker?: (o?: object) => Promise<FileSystemFileHandle[]>;
	showSaveFilePicker?: (o?: object) => Promise<FileSystemFileHandle>;
}
const pickers = () => window as unknown as Pickers;

const TYPES = [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }];

/*
 * Some Chromium-based browsers (embedded ones, like an app's built-in browser pane)
 * hand out file handles from the picker but refuse to read them. Once that's seen,
 * this browser stops using the picker: files open as copies through a plain file input,
 * and saving downloads, the same as Safari.
 */
const BLOCKED_KEY = 'reader:fileAccessBlocked';
// Remembered in this browser, so the refusal (and the sheet that explains it) only ever happens once.
// Storage can throw (private windows, blocked site data); then it's just remembered until reload.
let accessBlocked = (() => {
	try {
		return localStorage.getItem(BLOCKED_KEY) === '1';
	} catch {
		return false;
	}
})();

/** "Open files as copies" (Yellowpad settings). Per browser, never synced: it's about what this browser allows. */
export const openAsCopies = () => accessBlocked;
export function setOpenAsCopies(on: boolean): void {
	accessBlocked = on;
	try {
		if (on) localStorage.setItem(BLOCKED_KEY, '1');
		else localStorage.removeItem(BLOCKED_KEY);
	} catch {
		/* remembered until reload */
	}
}

/** The error a browser gives when it won't let the page read a file it just picked. */
export const isAccessBlocked = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError';

/** Thrown once, the first time reading is refused: Yellowpad then offers to open a copy (a plain file input). */
export class FileAccessBlocked extends Error {
	constructor() {
		super("This browser won't let the app read files directly.");
		this.name = 'FileAccessBlocked';
	}
}

export const canSaveInPlace = () => !accessBlocked && typeof pickers().showSaveFilePicker === 'function';

const cancelled = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

async function fromFile(file: File, handle: FileSystemFileHandle | null): Promise<OpenFile> {
	const d = decode(new Uint8Array(await file.arrayBuffer()));
	return { handle, name: file.name, ...d, lastModified: file.lastModified };
}

export async function readHandle(handle: FileSystemFileHandle): Promise<OpenFile> {
	const file = await fromFile(await handle.getFile(), handle);
	await rememberFile(handle, file.text);
	return file;
}

export async function pickFile(): Promise<OpenFile | null> {
	const open = pickers().showOpenFilePicker;
	if (open && !accessBlocked) {
		let handle: FileSystemFileHandle;
		try {
			[handle] = await open({ types: TYPES, excludeAcceptAllOption: false });
		} catch (e) {
			if (cancelled(e)) return null;
			throw e;
		}
		try {
			return await readHandle(handle);
		} catch (e) {
			if (!isAccessBlocked(e)) throw e;
			// The picker already used up this click, so the file input has to wait for the next one.
			setOpenAsCopies(true);
			throw new FileAccessBlocked();
		}
	}
	// Safari / Firefox, or a browser that blocks reading: a plain file input. No handle, so saving downloads a copy.
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.md,.markdown,text/markdown';
		input.onchange = async () => resolve(input.files?.[0] ? await fromFile(input.files[0], null) : null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}

export async function newFile(): Promise<OpenFile | null> {
	const save = pickers().showSaveFilePicker;
	if (!save || accessBlocked) return { handle: null, name: 'untitled.md', text: '', eol: '\n', bom: false, utf8: true, lastModified: Date.now() };
	try {
		const handle = await save({ suggestedName: 'untitled.md', types: TYPES });
		const writable = await handle.createWritable();
		await writable.close(); // create it empty on disk
		return await readHandle(handle);
	} catch (e) {
		if (cancelled(e)) return null;
		throw e;
	}
}

/** Do we have this permission? With `ask`, prompt for it (needs a click or keypress to be in progress). */
export async function permission(handle: FileSystemFileHandle, mode: Mode, ask: boolean): Promise<boolean> {
	const h = handle as unknown as Permissions;
	if ((await h.queryPermission({ mode })) === 'granted') return true;
	if (!ask) return false;
	return (await h.requestPermission({ mode })) === 'granted';
}

export async function writeFile(file: OpenFile, text: string): Promise<number> {
	if (!file.handle) throw new Error('no handle');
	const writable = await file.handle.createWritable();
	await writable.write(encode(text, file.eol, file.bom));
	await writable.close();
	refreshPreview(file.handle, text).catch(() => {}); // the Recent preview; a failure here mustn't fail the save
	return (await file.handle.getFile()).lastModified;
}

export function downloadCopy(file: OpenFile, text: string): void {
	const url = URL.createObjectURL(new Blob([encode(text, file.eol, file.bom)], { type: 'text/markdown' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = file.name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function diskModified(handle: FileSystemFileHandle): Promise<number | null> {
	try {
		return (await handle.getFile()).lastModified;
	} catch {
		return null;
	}
}
