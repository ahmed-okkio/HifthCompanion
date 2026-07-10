/** localStorage key for the last circle the user viewed. Lets the main NavRail's
 *  "Circles" item link straight to that circle (one navigation) instead of hitting
 *  the /tracker index, which redirects — a double hop that flashes two skeletons. */
export const LAST_CIRCLE_KEY = 'hifth:lastCircle';

/** localStorage key for the last reader page segment the user viewed (e.g. "42" or the
 *  spread "41-42"). Lets the NavRail "My Mushaf" item link straight to that page instead
 *  of /reader, whose index does a client redirect — an extra hop before content shows. */
export const LAST_READER_PAGE_KEY = 'hifth:lastReaderPage';
