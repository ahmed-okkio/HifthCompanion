/**
 * V3 Story 15 — Tags card (inert placeholder).
 * Chrome matches Notes/Share cards: white surface / radius-lg / neutral-200 border / shadow-e1.
 *
 * PLACEHOLDER: No tagging backend, no DB, no event handlers.
 * Chips are aria-disabled and non-interactive — stub only.
 * The 999px chip radius (via --radius-full) is the ONLY sanctioned pill exception in the app
 * per PRD 0002 Non-negotiable constraint #5.
 */

const PLACEHOLDER_TAGS = ['Opening', 'Reflection', 'Tajweed'] as const;

export default function TagsCard() {
  return (
    <section
      data-testid="tags-card"
      style={{
        background: 'var(--surface-main)',
        borderRadius: 'var(--radius-lg-px)',
        border: '1px solid var(--neutral-200)',
        boxShadow: 'var(--shadow-e1)',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: 'var(--space-16) var(--space-16) var(--space-12)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <h2
          className="font-semibold"
          style={{ fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Tags
        </h2>

        {/* Inert "+" affordance — placeholder, no handler */}
        <button
          aria-disabled="true"
          aria-label="Add tag (not yet available)"
          tabIndex={-1}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: 'var(--radius-sm-px)',
            border: '1px solid var(--neutral-200)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '14px',
            lineHeight: 1,
            cursor: 'default',
            pointerEvents: 'none',
          }}
        >
          +
        </button>
      </div>

      {/* Card body — chips */}
      <div
        className="flex flex-wrap"
        style={{ padding: 'var(--space-12) var(--space-16)', gap: 'var(--space-8)' }}
      >
        {PLACEHOLDER_TAGS.map(tag => (
          /* Chip — border-radius: 999px is the ONLY sanctioned pill exception per PRD constraint #5.
             Using --radius-full (9999px) which satisfies the "token if full-radius var exists" guidance. */
          <span
            key={tag}
            aria-disabled="true"
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-full)',   /* 9999px — sanctioned pill exception */
              padding: '3px var(--space-12)',
              fontSize: 'var(--type-caption-size)', /* 12px */
              fontWeight: 'var(--type-caption-weight)' as React.CSSProperties['fontWeight'],
              color: 'var(--green-600)',
              background: 'var(--green-soft)',
              border: '1px solid transparent',
              letterSpacing: '-0.01em',
              userSelect: 'none',
              cursor: 'default',
              pointerEvents: 'none',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
