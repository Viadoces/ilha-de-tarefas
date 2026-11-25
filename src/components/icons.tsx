const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ChevronLeft = () => (
  <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>
);
export const ChevronRight = () => (
  <svg {...base}><path d="M9 18l6-6-6-6" /></svg>
);
export const ChevronUp = () => (
  <svg {...base}><path d="M18 15l-6-6-6 6" /></svg>
);
export const Plus = () => (
  <svg {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const Search = () => (
  <svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const Gear = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const Copy = () => (
  <svg {...base}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
);
export const Refresh = () => (
  <svg {...base}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
);
export const External = () => (
  <svg {...base} width={13} height={13}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const Doc = () => (
  <svg {...base} width={14} height={14}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
);
export const Close = () => (
  <svg {...base}><path d="M18 6L6 18M6 6l12 12" /></svg>
);
export const Trash = () => (
  <svg {...base} width={15} height={15}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const ArrowUp = () => (
  <svg {...base} strokeWidth={2.4}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);
export const Stop = () => (
  <svg width={12} height={12} viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="2.5" fill="currentColor" /></svg>
);
export const Check = () => (
  <svg {...base} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const Folder = () => (
  <svg {...base} width={15} height={15}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);
