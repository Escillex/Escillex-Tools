/**
 * Which wallet is centered on the Wallet screen ('all' or a wallet id).
 * Kept outside the page so it survives going to Manage/Calendar and back,
 * and so the Wallet section's colors can follow it everywhere.
 */
let selectedId = $state('all');

export const selection = {
	get id() {
		return selectedId;
	},
	set id(v: string) {
		selectedId = v;
	}
};
