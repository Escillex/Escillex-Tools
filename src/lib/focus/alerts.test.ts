import { describe, expect, it } from 'vitest';
import { notify, notifyOptions, notifyState, phaseText } from './alerts';

describe('alerts', () => {
	it('notifyState', () => {
		expect(notifyState(true, 'granted')).toBe('on');
		expect(notifyState(false, 'granted')).toBe('off');
		expect(notifyState(true, 'default')).toBe('ask');
		expect(notifyState(true, 'denied')).toBe('blocked');
		expect(notifyState(false, 'denied')).toBe('blocked');
		expect(notifyState(true, undefined)).toBe('unsupported');
	});

	it('phaseText says what ended', () => {
		expect(phaseText('focus', 'break').title).toBe('Focus done');
		expect(phaseText('break', 'focus').title).toBe('Break over');
		expect(phaseText('long', 'focus').title).toBe('Long break over');
		expect(phaseText('long', null).title).toBe('Cycle done');
		expect(phaseText('focus', 'long').body).toBeTruthy();
	});

	it('notify never throws when notifications are missing', async () => {
		await expect(notify('a', 'b')).resolves.toBeUndefined();
	});

	it('every notification alerts again, even when the last one is still showing', () => {
		expect(notifyOptions('b')).toMatchObject({ body: 'b', tag: 'focus', renotify: true });
	});

	it('phaseText: a waiting next phase asks for a press', () => {
		expect(phaseText('focus', 'break', true).body).toBe('Press start for your break.');
		expect(phaseText('break', 'focus', true).body).toBe('Press start to focus.');
		expect(phaseText('focus', 'break').body).toBe('Break started.');
	});
});
