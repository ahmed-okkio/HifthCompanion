import type { ReactNode } from 'react';

export type Tool = 'pen' | 'highlighter' | 'circle' | 'underline' | 'text' | 'eraser';

export const ALL_TOOLS: Tool[] = ['pen', 'highlighter', 'circle', 'underline', 'text', 'eraser'];

export const PRESET_COLORS = [
  { name: 'Red',    value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green',  value: '#22c55e' },
  { name: 'Blue',   value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Black',  value: '#111827' },
];

export const TOOL_ICONS: Record<Tool, ReactNode> = {
  pen: (
    <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  highlighter: (
    <svg style={{ width: '22px', height: '22px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 15.5L15.5 4 20 8.5 8.5 20H4v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13.5 6l4.5 4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3.5 21h9" />
    </svg>
  ),
  circle: (
    <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx={12} cy={12} r={7.5} strokeWidth={2.4} />
    </svg>
  ),
  underline: (
    <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M7.5 5.5v6.25a4.5 4.5 0 009 0V5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6.5 19.5h11" />
    </svg>
  ),
  text: (
    <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.35} d="M5.5 6.5h13" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.35} d="M12 6.5v12" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.35} d="M9.5 18.5h5" />
    </svg>
  ),
  eraser: (
    <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4.5 15.5L14 6a2 2 0 012.8 0l2.7 2.7a2 2 0 010 2.8L12 19H8l-3.5-3.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11.5 8.5l4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19h7.5" />
    </svg>
  ),
};

export const TOOL_LABELS: Record<Tool, string> = {
  pen: 'Pen',
  highlighter: 'Highlighter',
  circle: 'Circle',
  underline: 'Underline',
  text: 'Text',
  eraser: 'Eraser',
};

const cursorSvg = (svg: string, x = 12, y = 12) => {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `url("data:image/svg+xml,${encoded}") ${x} ${y}, auto`;
};

export const getToolCursor = (tool: Tool): string => {
  const cursors: Record<Tool, string> = {
    pen: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M21.2 4.8l6 6L11.8 26.2 5 28l1.8-6.8L21.2 4.8z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/><path d="M19.3 7.2l5.5 5.5" stroke="#10b981" stroke-width="3" stroke-linecap="round"/></svg>', 6, 27),
    highlighter: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 19.5L20.5 6 26 11.5 12.5 25H7v-5.5z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/><path d="M18.5 8.5l5 5" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><path d="M5 28h14" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/></svg>', 7, 26),
    circle: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="#fff" stroke="#111827" stroke-width="3"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke="#10b981" stroke-width="3" stroke-linecap="round"/></svg>', 16, 16),
    underline: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="7" fill="#fff" stroke="#111827" stroke-width="2.5"/><path d="M10 9v7a6 6 0 0012 0V9" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/><path d="M9 24h14" stroke="#10b981" stroke-width="4" stroke-linecap="round"/></svg>', 16, 24),
    text: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="7" fill="#fff" stroke="#111827" stroke-width="2.5"/><path d="M10 10h12M16 10v13M13 23h6" stroke="#111827" stroke-width="3" stroke-linecap="round"/></svg>', 16, 16),
    eraser: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M21 5l7 7-12 12H9l-5-5L21 5z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/><path d="M15.5 10.5l6 6" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/><path d="M15 27h12" stroke="#10b981" stroke-width="4" stroke-linecap="round"/></svg>', 8, 22),
  };
  return cursors[tool];
};
