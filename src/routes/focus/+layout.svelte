<script lang="ts">
	// While FOCUS is open, its own look (Focus settings) applies over the global one. Covers /focus/log too.
	import { enterTool, leaveTool } from '#lib/core/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		enterTool('focus');
		return leaveTool;
	});
</script>

{@render children()}
