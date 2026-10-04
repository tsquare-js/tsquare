/**
 * Link prefixes (see share.ts): the letter in front of a link's data names the language version
 * its text was written in. Shared by the library and the playground's browser code, so a new
 * prefix can't be added to one and missed in the other.
 */
/** What links are made with today: 0.6.0 and later. */
export const LINK_PREFIX = "y";
/** Links made before 0.6.0; decoded with the old rules (upgradeWireframe's fromLink). */
export const LEGACY_LINK_PREFIX = "z";

/** Whether `data` (a render URL's path segment or a share link's fragment, without "#") is link data. */
export const isLinkData = (data: string) => data.startsWith(LINK_PREFIX) || data.startsWith(LEGACY_LINK_PREFIX);
