<!--
	The app's header: the logo (same image as the tab icon), the name in the
	theme's display font, then broadcast-style speed bars. The mark is drawn
	in currentColor so it follows --ink on every theme.
-->
<div class="wordmark">
	<img class="logo" src="/favicon.png" alt="" />
	<span class="display name">Escillex Tools</span>
	<!-- Broadcast "speed bars": forward-slanted at the same 18° as .tag,
	     thinning out behind the name like a lower-third wipe. -->
	<svg class="mark" viewBox="0 0 32.5 10" aria-hidden="true">
		<polygon class="lead" points="3.2,0 12.2,0 9,10 0,10" />
		<polygon points="16.2,0 21.2,0 18,10 13,10" />
		<polygon points="25.2,0 27.7,0 24.5,10 22,10" />
		<polygon points="31.2,0 32.4,0 29.2,10 28,10" />
	</svg>
</div>

<style>
	.wordmark {
		display: flex;
		/* Baseline, not center: the bars then sit exactly on the letters' feet. */
		align-items: baseline;
		gap: 0.25em;
		padding-bottom: 8px;
		border-bottom: 2px solid var(--line);
		color: var(--ink);
		font-size: calc(2.1rem / var(--font-wide));
	}
	.logo {
		height: 1.1em;
		width: auto;
		flex: none;
		margin-right: 0.1em;
		/* Its bottom lands on the baseline; drop it so it centers on the caps. */
		position: relative;
		top: calc(0.55em - 0.36em);
		top: calc(0.55em - 0.5cap);
	}
	.mark {
		/* Exactly the caps' height (cap unit), so it works for every theme font. */
		height: 0.72em;
		height: 1cap;
		width: auto;
		flex: none;
		fill: currentColor;
	}
	.lead {
		fill: var(--accent);
	}
	.name {
		line-height: 1;
	}
</style>
