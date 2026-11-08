// Small inline icons (no icon library needed).
type P = { size?: number };
const s = (size = 16) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const IconSelect = ({ size }: P) => (<svg {...s(size)}><path d="M5 3l14 8-6 1.5L10 19z" /></svg>);
export const IconHand = ({ size }: P) => (<svg {...s(size)}><path d="M8 13V5.5a1.5 1.5 0 013 0V12M11 11.5V4a1.5 1.5 0 013 0v8M14 11.5V5.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6.5 7S5 18.5 4 16l-1.5-3.5a1.5 1.5 0 012.6-1.4L8 14" /></svg>);
export const IconNote = ({ size }: P) => (<svg {...s(size)}><path d="M5 4h14v11l-5 5H5z" /><path d="M14 20v-5h5" /></svg>);
export const IconLink = ({ size }: P) => (<svg {...s(size)}><path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" /></svg>);
export const IconImage = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 17l-5-5-9 8" /></svg>);
export const IconPerson = ({ size }: P) => (<svg {...s(size)}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-6 7-6s6 2 7 6" /></svg>);
export const IconSparkle = ({ size }: P) => (<svg {...s(size)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>);
export const IconPanelRight = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>);
export const IconBack = ({ size }: P) => (<svg {...s(size)}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconFrame = ({ size }: P) => (<svg {...s(size)}><path d="M7 3v18M17 3v18M3 7h18M3 17h18" /></svg>);
export const IconTrash = ({ size }: P) => (<svg {...s(size)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>);
export const IconClose = ({ size }: P) => (<svg {...s(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconExternal = ({ size }: P) => (<svg {...s(size)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>);
