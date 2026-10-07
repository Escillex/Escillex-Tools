// The Markdown tool used to live at /md. Old bookmarks, home-screen shortcuts and
// installed apps' .md file handler still land here. Routing is client-side
// (ssr is off), so this redirect also works offline and stays in the same
// document: a file handed over through launchQueue still reaches Yellowpad.
import { redirect } from '@sveltejs/kit';

export function load({ url }) {
	redirect(308, `/yellowpad${url.search}`);
}
