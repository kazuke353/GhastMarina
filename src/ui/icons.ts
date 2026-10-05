const S = (body: string, color = 'currentColor') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS: Record<string, (c?: string) => string> = {
  ammo: (c = '#ffd060') => S('<rect x="5" y="9" width="4" height="11" rx="1"/><path d="M5 9l2-5 2 5"/><rect x="11" y="9" width="4" height="11" rx="1"/><path d="M11 9l2-5 2 5"/><rect x="17" y="12" width="3" height="8" rx="1"/>', c),
  shell: (c = '#ff6040') => S('<rect x="6" y="6" width="5" height="14" rx="1"/><rect x="13" y="6" width="5" height="14" rx="1"/><path d="M6 17h5M13 17h5"/>', c),
  cell: (c = '#60e0ff') => S('<rect x="7" y="4" width="10" height="17" rx="2"/><path d="M10 2h4M13 8l-3 5h4l-3 5"/>', c),
  medkit: (c = '#ff5050') => S('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10v7M8.5 13.5h7"/>', c),
  bandage: (c = '#f0e8d8') => S('<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)"/><path d="M10 11l1 1M13 10l1 1M11 13l1 1"/>', c),
  pills: (c = '#b06cff') => S('<rect x="7" y="7" width="10" height="14" rx="2"/><rect x="6" y="3" width="12" height="4" rx="1"/><path d="M10 12h4M12 10v4"/>', c),
  scrap: (c = '#a0a8b0') => S('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', c),
  chem: (c = '#80ff60') => S('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>', c),
  cloth: (c = '#e0d0b0') => S('<path d="M4 6c4 2 12-2 16 0v12c-4-2-12 2-16 0z"/><path d="M4 10c4 2 12-2 16 0"/>', c),
  flare: (c = '#ff4030') => S('<rect x="10" y="9" width="4" height="12" rx="1"/><path d="M12 9c-3-2-1-5 0-7 1 2 3 5 0 7z"/>', c),
  bomb: (c = '#b0b0b0') => S('<rect x="4" y="10" width="14" height="6" rx="2"/><path d="M18 13h2M20 13c1-2 2-3 1-5"/><path d="M8 10v6M12 10v6"/>', c),
  pistol: (c = '#3ef0ff') => S('<path d="M3 7h16v4H9l-1 7H4l1-7H3z"/><path d="M19 9h2"/>', c),
  shotgun: (c = '#ff8040') => S('<path d="M2 10h18v3H8l-2 5H3l1-5H2z"/><path d="M10 13v2h4"/>', c),
  arc: (c = '#60e0ff') => S('<path d="M3 11h13l3-3v8l-3-3H3z"/><path d="M8 6l-2 3h3l-2 3"/>', c),
  axe: (c = '#ff3030') => S('<path d="M14 3l7 7-4 1-4-4z"/><path d="M14 7L4 21"/>', c),
  pipe: (c = '#a0a8b0') => S('<path d="M5 19L19 5"/><path d="M17 3l4 4"/>', c),
  credit: (c = '#ffd84a') => S('<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5a3 3 0 1 0 0 5"/>', c),
  fuse: (c = '#ffc040') => S('<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M8 8h8M8 16h8M12 10v4"/>', c),
  card: (c = '#ff4040') => S('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>', c),
  valve: (c = '#d08040') => S('<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="2"/>', c),
  bulb: (c = '#b070ff') => S('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>', c),
  coil: (c = '#ff8040') => S('<path d="M6 4h12M6 20h12M8 4c-3 2 11 2 8 4s-11 2-8 4 11 2 8 4-11 2-8 4"/>', c),
  key: (c = '#ff2a4a') => S('<circle cx="7" cy="12" r="4"/><path d="M11 12h10M17 12v3M20 12v2"/>', c),
  heart: (c = '#ff3a4a') => S('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>', c),
  eye: (c = '#b06cff') => S('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', c),
  gloomy: (c = '#60c0ff') => S('<path d="M4 12a8 6 0 0 1 16 0z"/><path d="M10 12v7h4v-7"/><circle cx="9.5" cy="9.5" r=".8"/><circle cx="14.5" cy="9.5" r=".8"/>', c),
  log: (c = '#ff3040') => S('<rect x="4" y="6" width="16" height="12" rx="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M9 14h6"/>', c),
  evidence: (c = '#ff5fd2') => S('<path d="M4 12h12l4-4v8l-4-4"/><circle cx="7" cy="12" r="1"/>', c),
  save: (c = '#7dff8a') => S('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>', c),
  warn: (c = '#ff2a4a') => S('<path d="M12 3l9 17H3z"/><path d="M12 10v4M12 17v.5"/>', c),
  info: (c = '#3ef0ff') => S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', c),
  item: (c = '#3ef0ff') => S('<rect x="5" y="5" width="14" height="14" rx="2"/>', c),
  skull: (c = '#ff2a4a') => S('<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10 20v-2M14 20v-2"/>', c),
};

export function icon(name: string, color?: string) {
  const f = ICONS[name] ?? ICONS.item;
  return f(color);
}
