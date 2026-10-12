/**
 * Annotation sets (multiple named sets per user) are switched off: nobody used more than one.
 * Off, each user reads and writes only their default set; /sets redirects to /reader and every
 * set chooser is hidden. Flip to true to bring the whole feature back; nothing was deleted.
 */
export const SETS_ENABLED = false;
