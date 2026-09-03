import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Filters } from '../api/types';
import { AXES, RANGE_KEYS } from '../config/filters';
import { isWholeAxis } from './range';

/**
 * Saved boards, kept on the device: the corpus and the watched list are the
 * server's, but which filters this person re-tunes every week is nobody
 * else's business and must survive a dead network.
 */
export type Preset = {
  id: string;
  name: string;
  filters: Filters;
};

const KEY = 'whatwatch.presets';

export async function loadPresets(): Promise<Preset[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Preset[];
    return Array.isArray(list) ? list : [];
  } catch {
    return []; // a corrupt store loses presets, not the app
  }
}

export async function savePresets(list: Preset[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export const newPresetId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The auto-name is the board's own receipt line, lowercased and plain: it is
 * generated from the same filters the summary renders, so the name and the
 * card beneath it can never disagree.
 */
export function autoName(filters: Filters): string {
  const parts: string[] = [
    filters.kinds.map((k) => (k === 'movie' ? 'movies' : 'tv shows')).join(' + '),
  ];
  for (const key of RANGE_KEYS) {
    const axis = AXES[key];
    const value = filters[key];
    if (isWholeAxis(axis, value)) continue;
    const unit = key === 'rating' ? '★ ' : '';
    const suffix = key === 'votes' ? '' : '';
    parts.push(`${unit}${axis.fmt(value[0])}–${axis.fmt(value[1])}${suffix}`);
  }
  const genres = Object.entries(filters.genres) as [string, 'include' | 'exclude'][];
  const marks = genres.map(([g, state]) => `${state === 'include' ? '+' : '−'} ${g}`);
  return [...parts, ...marks].join(' · ');
}
