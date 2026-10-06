<script lang="ts">
	// While the Reader is open, its own look (Reader settings) applies over the global one.
	import { enterTool, leaveTool } from '#lib/core/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		enterTool('reader');
		return leaveTool;
	});
</script>

{@render children()}
