'use client';

import { create } from 'zustand';
import { DEFAULT_LANGUAGES, LANG_COOKIE, LANGUAGE_IDS } from '@/lib/config';

export interface Profile {
  name: string;
  avatar: string; // avatar preset id
}

interface PersistedUser {
  profile: Profile | null;
  languages: string[];
  onboardingComplete: boolean;
}

const USER_KEY = 'musicarea:user:v1';

const EMPTY: PersistedUser = {
  profile: null,
  languages: [],
  onboardingComplete: false,
};

function load(): PersistedUser {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PersistedUser>;
    return {
      profile: parsed.profile ?? null,
      languages: Array.isArray(parsed.languages)
        ? parsed.languages.filter((l) => LANGUAGE_IDS.includes(l))
        : [],
      onboardingComplete: !!parsed.onboardingComplete,
    };
  } catch {
    return EMPTY;
  }
}

function persist(state: PersistedUser) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(state));
    // Mirror languages into a cookie so server components can SSR the feed for
    // the right languages on the next navigation.
    const langs = state.languages.length ? state.languages : DEFAULT_LANGUAGES;
    document.cookie = `${LANG_COOKIE}=${encodeURIComponent(langs.join(','))}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;
  } catch {
    /* quota or unavailable */
  }
}

export interface UserState extends PersistedUser {
  /** False during SSR and until the client reads localStorage, so the gate can
   *  avoid flashing the onboarding flow for already-onboarded users. */
  hydrated: boolean;

  hydrate: () => void;
  setProfile: (profile: Profile) => void;
  toggleLanguage: (id: string) => void;
  setLanguages: (ids: string[]) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useUser = create<UserState>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const loaded = load();
    set({ ...loaded, hydrated: true });
    // Ensure the cookie exists for SSR even for returning users.
    persist(loaded);
  },

  setProfile: (profile) => {
    set({ profile });
    persist({ profile, languages: get().languages, onboardingComplete: get().onboardingComplete });
  },

  toggleLanguage: (id) => {
    if (!LANGUAGE_IDS.includes(id)) return;
    const has = get().languages.includes(id);
    const languages = has
      ? get().languages.filter((l) => l !== id)
      : [...get().languages, id];
    set({ languages });
    persist({ profile: get().profile, languages, onboardingComplete: get().onboardingComplete });
  },

  setLanguages: (ids) => {
    const languages = ids.filter((l) => LANGUAGE_IDS.includes(l));
    set({ languages });
    persist({ profile: get().profile, languages, onboardingComplete: get().onboardingComplete });
  },

  completeOnboarding: () => {
    set({ onboardingComplete: true });
    persist({ profile: get().profile, languages: get().languages, onboardingComplete: true });
  },

  reset: () => {
    set({ ...EMPTY });
    persist(EMPTY);
  },
}));
