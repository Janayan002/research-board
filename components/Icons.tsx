// Icon set: rounded strokes with a soft tinted fill on key shapes (duotone).
// All icons use currentColor, so they follow the text color.

type P = { size?: number };
const base = (size = 18) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});
const tint = { fill: "currentColor", fillOpacity: 0.18 };

// ---- tools ----
export const IconSelect = ({ size }: P) => (<svg {...base(size)}><path d="M5.5 3.5l12 7.2-5.4 1.3-2.6 5.5z" {...tint} /></svg>);
export const IconHand = ({ size }: P) => (<svg {...base(size)}><path d="M8 12.5V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6.5a1.5 1.5 0 013 0V14c0 4-2.4 6.5-6 6.5-2.7 0-4.3-1.4-5.4-3.6L4 13.6a1.4 1.4 0 012.4-1.4L8 14.5" /></svg>);
export const IconNote = ({ size }: P) => (<svg {...base(size)}><path d="M4.5 4.5h15v10l-5 5h-10z" {...tint} /><path d="M14.5 19.5v-5h5M8 9h8M8 12.5h4" /></svg>);
export const IconText = ({ size }: P) => (<svg {...base(size)}><path d="M5 7V5h14v2M12 5v14M9 19h6" /></svg>);
export const IconLink = ({ size }: P) => (<svg {...base(size)}><path d="M10 14a4 4 0 005.7 0l2.8-2.8a4 4 0 00-5.7-5.7l-.9.9" /><path d="M14 10a4 4 0 00-5.7 0l-2.8 2.8a4 4 0 005.7 5.7l.9-.9" /></svg>);
export const IconImage = ({ size }: P) => (<svg {...base(size)}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="15.5" cy="9.5" r="2" {...tint} /><path d="M3.5 17l5-5.5 4 4 2.5-2.5 5.5 5" /></svg>);
export const IconQuote = ({ size }: P) => (<svg {...base(size)}><path d="M5 11.5c0-3 1.5-5 4-6M5 11.5h3.5v5H5zM13.5 11.5c0-3 1.5-5 4-6M13.5 11.5H17v5h-3.5z" {...tint} /></svg>);
export const IconSparkle = ({ size }: P) => (<svg {...base(size)}><path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" {...tint} /><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>);
export const IconSearch = ({ size }: P) => (<svg {...base(size)}><circle cx="10.5" cy="10.5" r="6" {...tint} /><path d="M15 15l5 5" /></svg>);

// ---- navigation & actions ----
export const IconBack = ({ size }: P) => (<svg {...base(size)}><path d="M14.5 5.5L8 12l6.5 6.5" /></svg>);
export const IconForward = ({ size }: P) => (<svg {...base(size)}><path d="M9.5 5.5L16 12l-6.5 6.5" /></svg>);
export const IconClose = ({ size }: P) => (<svg {...base(size)}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>);
export const IconPlus = ({ size }: P) => (<svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = ({ size }: P) => (<svg {...base(size)}><path d="M5 12h14" /></svg>);
export const IconFit = ({ size }: P) => (<svg {...base(size)}><path d="M4 9V5.5A1.5 1.5 0 015.5 4H9M15 4h3.5A1.5 1.5 0 0120 5.5V9M20 15v3.5a1.5 1.5 0 01-1.5 1.5H15M9 20H5.5A1.5 1.5 0 014 18.5V15" /><rect x="8" y="8.5" width="8" height="7" rx="1" {...tint} /></svg>);
export const IconTrash = ({ size }: P) => (<svg {...base(size)}><path d="M4.5 7h15M10 11v5.5M14 11v5.5M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7" /></svg>);
export const IconExternal = ({ size }: P) => (<svg {...base(size)}><path d="M14 4.5h5.5V10M19.5 4.5L11 13M17.5 14v4.5a1 1 0 01-1 1h-11a1 1 0 01-1-1v-11a1 1 0 011-1H10" /></svg>);
export const IconPencil = ({ size }: P) => (<svg {...base(size)}><path d="M15.5 4.5l4 4L9 19H5v-4z" {...tint} /><path d="M13 7l4 4" /></svg>);
export const IconDuplicate = ({ size }: P) => (<svg {...base(size)}><rect x="8.5" y="8.5" width="11" height="11" rx="2" {...tint} /><path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5" /></svg>);
export const IconPages = ({ size }: P) => (<svg {...base(size)}><path d="M7.5 4.5h9l3 3v12h-12z" {...tint} /><path d="M4.5 7.5v12a1 1 0 001 1h11" /></svg>);
export const IconPanelRight = ({ size }: P) => (<svg {...base(size)}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /><path d="M14.5 4.5h3.5a2.5 2.5 0 012.5 2.5v10a2.5 2.5 0 01-2.5 2.5h-3.5z" {...tint} /></svg>);
export const IconCopy = ({ size }: P) => (<svg {...base(size)}><rect x="8" y="8" width="11.5" height="11.5" rx="2" /><path d="M5 15.5V6a1.5 1.5 0 011.5-1.5H16" /></svg>);

export const IconFolder = ({ size }: P) => (<svg {...base(size)}><path d="M3.5 7a1.5 1.5 0 011.5-1.5h4.2l2 2.2H19a1.5 1.5 0 011.5 1.5V17a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 17z" {...tint} /></svg>);
export const IconClock = ({ size }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>);
export const IconMore = ({ size }: P) => (<svg {...base(size)}><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></svg>);
export const IconGrid = ({ size }: P) => (<svg {...base(size)}><rect x="4.5" y="4.5" width="6" height="6" rx="1.5" /><rect x="13.5" y="4.5" width="6" height="6" rx="1.5" /><rect x="4.5" y="13.5" width="6" height="6" rx="1.5" /><rect x="13.5" y="13.5" width="6" height="6" rx="1.5" /></svg>);

// a push pin, the Tack logo (solid, so it reads at small sizes)
export const IconTack = ({ size = 18 }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 3h8l-1.3 6.2 3.3 3.3V14H6v-1.5l3.3-3.3z" /><path d="M11.2 14h1.6l-.8 7z" /></svg>);

// ---- research types ----
export const IconArtist = ({ size }: P) => (<svg {...base(size)}><path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.9 1.5-1.9-.4-1.3.4-2.6 1.8-2.6h1.6a3.6 3.6 0 003.6-3.6C20.5 7.3 16.7 3.5 12 3.5z" {...tint} /><circle cx="7.8" cy="11" r="1.1" /><circle cx="10.5" cy="7.3" r="1.1" /><circle cx="15" cy="7.8" r="1.1" /></svg>);
export const IconMuseum = ({ size }: P) => (<svg {...base(size)}><path d="M3.5 9L12 4l8.5 5z" {...tint} /><path d="M5.5 9.5v7.5M9.8 9.5v7.5M14.2 9.5v7.5M18.5 9.5v7.5M3.5 20h17M4.5 17.5h15" /></svg>);
export const IconArticle = ({ size }: P) => (<svg {...base(size)}><path d="M6 3.5h9l3.5 3.5v13.5H6z" {...tint} /><path d="M15 3.5V7h3.5M9 11h6.5M9 14h6.5M9 17h4" /></svg>);
export const IconExhibition = ({ size }: P) => (<svg {...base(size)}><path d="M12 3.5l-3 3.5M12 3.5l3 3.5" /><rect x="5" y="7" width="14" height="10" rx="1" {...tint} /><path d="M8 14l2.5-3 2 2 1.5-1.5L16 14M3.5 20.5h17" /></svg>);
export const IconApp = ({ size }: P) => (<svg {...base(size)}><rect x="6.5" y="3" width="11" height="18" rx="2.5" /><rect x="9" y="6.5" width="2.5" height="2.5" rx=".6" {...tint} /><rect x="12.5" y="6.5" width="2.5" height="2.5" rx=".6" {...tint} /><rect x="9" y="10" width="2.5" height="2.5" rx=".6" {...tint} /><path d="M10.5 18h3" /></svg>);
export const IconCompass = ({ size }: P) => (<svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" {...tint} /></svg>);

export const RESEARCH_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  artist: IconArtist, museum: IconMuseum, article: IconArticle, exhibition: IconExhibition, product: IconApp, any: IconCompass,
};
export const IconKey = ({ size }: P) => (<svg {...base(size)}><circle cx="8" cy="15" r="4" {...tint} /><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2" /></svg>);
export const IconPrint = ({ size }: P) => (<svg {...base(size)}><path d="M7 9V4.5h10V9" /><rect x="3.5" y="9" width="17" height="7.5" rx="2" {...tint} /><path d="M7 14h10v5.5H7z" /></svg>);
