<script lang="ts">
	// While Fidget is open, its own look (Fidget settings) applies over the global one. Covers /fidget/facts too.
	import { enterTool, leaveTool } from '#lib/core/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		enterTool('fidget');
		return leaveTool;
	});
</script>

{@render children()}
