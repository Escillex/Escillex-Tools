/**
 * Fidget's useless facts. Conversions turn a toy's count into something
 * silly ("= 2.0 full sheets"); trivia unlocks one fact per 250 presses
 * across all toys, in random order. All bundled: no network.
 */
import type { ToyId } from './toys';

export const FACT_EVERY = 250;
export const FACT_SHOW_MS = 4000;

export interface Fact {
	/** Stable: unlocked facts are stored by id, so never renumber. */
	id: string;
	text: string;
}

const TEXTS = [
	'Bubble wrap was invented in 1957 as a textured wallpaper. Nobody bought it.',
	'Octopuses have three hearts and blue blood.',
	'Botanically, bananas are berries and strawberries are not.',
	'A group of flamingos is called a flamboyance.',
	'Wombats make cube-shaped poop.',
	"Scotland's national animal is the unicorn.",
	'The Eiffel Tower grows about 15 cm taller in summer as its iron expands.',
	'Sea otters hold hands while they sleep so they don\'t drift apart.',
	'A day on Venus is longer than a year on Venus.',
	'The dot over a lowercase i or j is called a tittle.',
	'In 1947 engineers found a real moth stuck in a Harvard computer relay: the first logged "bug".',
	'Under some conditions, hot water can freeze faster than cold. It\'s called the Mpemba effect.',
	'There are more possible games of chess than atoms in the observable universe.',
	'The QWERTY layout comes from typewriters of the 1870s.',
	'A jiffy is a real unit: in electronics, one cycle of mains power (1/50 or 1/60 of a second).',
	"Koala fingerprints are so close to humans' that they could confuse a crime scene.",
	'The shortest war on record, Britain vs Zanzibar in 1896, lasted under an hour.',
	'A pineapple takes about two years to grow.',
	'"Strengths" is one of the longest English words with only one vowel.',
	'The man who designed the Pringles can had some of his ashes buried in one.',
	'An octopus can taste with its arms.',
	'Venus spins the opposite way to most planets, so the Sun rises in the west there.',
	'Saturn is less dense than water. In a big enough bath, it would float.',
	'Your stomach replaces its inner lining every few days so it doesn\'t digest itself.',
	'A teaspoon of neutron star would weigh billions of tonnes.',
	'Sunlight is about 8 minutes old by the time it reaches you.',
	'Oxford University was teaching students before the Aztec capital Tenochtitlan was founded.',
	'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.',
	'The word "robot" comes from the Czech robota, meaning forced labour.',
	'Butterflies taste with their feet.',
	'A lightning bolt is about five times hotter than the surface of the Sun.',
	'Hippos make a reddish fluid that works like sunscreen.',
	'Crows can recognise individual human faces, and hold grudges.',
	'Some turtles can breathe through their rear ends.',
	'The Moon drifts about 3.8 cm further from Earth every year.',
	'Peanuts are not nuts. They are legumes, like peas.',
	'The # symbol is officially called an octothorpe.',
	'In Italian, the @ sign is a chiocciola: a snail.',
	"The first webcam watched a coffee pot at Cambridge University, so nobody walked to an empty pot.",
	'Nintendo was founded in 1889 to make playing cards.',
	"A shrimp's heart is in its head.",
	'Goats have rectangular pupils.',
	'Honeybees tell each other where flowers are by dancing.',
	'Astronauts get up to about 5 cm taller in space as their spines stretch out.',
	'Sharks have been around longer than trees.',
	'There is a basketball court above the US Supreme Court, nicknamed "the highest court in the land".',
	'Hawaiian pizza was invented in Canada.',
	'Charles Osborne had the hiccups for 68 years.',
	'Some penguins court a mate by offering them a pebble.',
	'Cats can\'t taste sweetness.',
	'In the 1830s, ketchup was sold as medicine.',
	"Google's first name was BackRub.",
	'The first thing ever sold on eBay was a broken laser pointer.',
	"An ostrich's eye is bigger than its brain.",
	'In medieval England, a "moment" was a unit of time: about 90 seconds.',
	'Mechanical keyboard switches are often rated for tens of millions of presses.',
	'A cloud can weigh hundreds of tonnes and still float.',
	'The fingerprints of identical twins are not identical.',
	'Hot air balloons were first flown with a sheep, a duck and a rooster as passengers.',
	'The inventor of the frisbee was turned into a frisbee after he died.'
];

export const TRIVIA: Fact[] = TEXTS.map((text, i) => ({ id: `f${String(i + 1).padStart(2, '0')}`, text }));

/** How many facts this total has earned. */
export const factTarget = (total: number) => Math.min(TRIVIA.length, Math.floor(total / FACT_EVERY));

/** A random fact not unlocked yet, or null when all are found. */
export function pickFact(unlocked: ReadonlySet<string>, rand: () => number = Math.random): Fact | null {
	const left = TRIVIA.filter((f) => !unlocked.has(f.id));
	if (!left.length) return null;
	return left[Math.min(left.length - 1, Math.floor(rand() * left.length))];
}

/**
 * Presses until the next fact. 1 when the total is ahead of the facts
 * (they unlock one per press until caught up). When more are unlocked
 * than the total implies (an older backup restored), counts up to the
 * next threshold past what's already found, so it's never negative.
 */
export function untilNext(total: number, unlocked: number): number | null {
	if (unlocked >= TRIVIA.length) return null;
	if (unlocked < factTarget(total)) return 1;
	return (unlocked + 1) * FACT_EVERY - total;
}

interface Conversion {
	/** Presses per one unit. */
	per: number;
	unit: string;
}

const CONVERSIONS: Record<ToyId, Conversion[]> = {
	bubbles: [
		{ per: 48, unit: 'full 6×8 sheets' },
		{ per: 60, unit: 'minutes at one pop a second' },
		{ per: 3600, unit: 'hours at one pop a second' }
	],
	keys: [
		{ per: 5, unit: 'words typed (5 keys a word)' },
		{ per: 280, unit: 'posts of 280 characters' },
		{ per: 1800, unit: 'paperback pages (about 1,800 characters each)' }
	],
	ratchet: [
		{ per: 24, unit: 'turns of a 24-click knob' },
		{ per: 60, unit: 'hours, if every click were a minute' },
		{ per: 1440, unit: 'days, if every click were a minute' }
	],
	switches: [
		{ per: 2, unit: 'times a light went on and off' },
		{ per: 365, unit: 'years of one flip a day' },
		{ per: 1000, unit: 'kiloflips' }
	],
	pen: [
		{ per: 2, unit: 'full clicks (down and up)' },
		{ per: 60, unit: 'minutes of meeting at one click a second' },
		{ per: 1000, unit: 'kiloclicks' }
	],
	slider: [
		{ per: 10, unit: 'trips across a 10-notch slider' },
		{ per: 1000, unit: 'kilometres, if every notch were a metre' },
		{ per: 42195, unit: 'marathons, if every notch were a metre' }
	]
};

const fmt = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString('en-US'));

/** The line under a toy's number. Changes every 100 presses so it keeps moving. */
export function conversion(toy: ToyId, count: number): string {
	if (count <= 0) return 'Nothing yet. Go on.';
	const list = CONVERSIONS[toy];
	let c = list[Math.floor(count / 100) % list.length];
	// "= 0.0 marathons" says nothing: until a unit shows, use the smallest (each list starts with it).
	if (count / c.per < 0.05) c = list[0];
	return `= ${fmt(count / c.per)} ${c.unit}`;
}
