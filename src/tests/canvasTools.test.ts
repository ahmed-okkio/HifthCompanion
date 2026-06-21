import { describe, it, expect } from 'vitest';
import { getToolCursor, ALL_TOOLS, TOOL_LABELS, TOOL_ICONS, type Tool } from '../lib/canvasTools';

describe('getToolCursor', () => {
  it('returns a CSS cursor string for every tool', () => {
    for (const tool of ALL_TOOLS) {
      const cursor = getToolCursor(tool);
      expect(cursor).toMatch(/^url\("data:image\/svg\+xml,/);
      expect(cursor).toMatch(/auto$/);
    }
  });

  it('cursor strings are unique per tool', () => {
    const cursors = ALL_TOOLS.map(t => getToolCursor(t));
    const unique = new Set(cursors);
    expect(unique.size).toBe(ALL_TOOLS.length);
  });
});

describe('TOOL_LABELS', () => {
  it('every tool has a non-empty label', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_LABELS[tool]).toBeTruthy();
    }
  });
});

describe('TOOL_ICONS', () => {
  it('every tool has an icon', () => {
    for (const tool of ALL_TOOLS) {
      expect(TOOL_ICONS[tool]).toBeDefined();
    }
  });
});

describe('ALL_TOOLS', () => {
  it('contains exactly 6 tools', () => {
    expect(ALL_TOOLS).toHaveLength(6);
  });

  it('includes expected tool names', () => {
    const expected: Tool[] = ['pen', 'highlighter', 'circle', 'underline', 'text', 'eraser'];
    expect(ALL_TOOLS).toEqual(expected);
  });
});
