'use client';

import { useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { VoiceSearchButton } from './VoiceSearchButton';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Rendered under the field, for the suggestion sheet. */
  children?: React.ReactNode;
  onFocus?: () => void;
}

/**
 * The large search field, with a voice button.
 *
 * A real `<form>` with `role="search"`, not a bare input. That gives the on-screen keyboard a
 * "Go" key on mobile and Enter-to-submit for free, both of which have to be hand-wired
 * otherwise, and it announces itself correctly to a screen reader.
 *
 * `type="search"` is deliberately avoided in favour of `type="text"`. Search inputs render a
 * browser-native clear button in WebKit which cannot be styled and sits underneath the custom
 * one here, giving two overlapping crosses.
 */
export function SearchField({ value, onChange, onSubmit, children, onFocus }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative w-full max-w-3xl">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
          // Dismisses the on-screen keyboard so results are not hidden behind it on a phone.
          inputRef.current?.blur();
        }}
        className="relative flex items-center gap-1 rounded-pill border border-white/15 bg-surface-raised/80 pl-4 pr-2 transition focus-within:border-accent/60 focus-within:bg-surface-raised focus-within:shadow-glow"
      >
        <span className="pointer-events-none text-text-secondary">
          <Icon name="search" size={18} />
        </span>

        <input
          ref={inputRef}
          type="text"
          // Off for all four: a search box for song titles should not be autocorrected toward
          // dictionary words, and browser autofill has nothing useful to offer it.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder="Songs, artists, albums, playlists"
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] font-medium outline-none placeholder:text-text-muted"
        />

        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange('');
              // Focus returns to the field, because clearing is nearly always a prelude to
              // typing something else.
              inputRef.current?.focus();
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-secondary transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" size={15} />
          </button>
        )}

        {/* Renders nothing where the Web Speech API is unavailable. */}
        <VoiceSearchButton onTranscript={onChange} onSubmit={onSubmit} />
      </form>

      {children}
    </div>
  );
}
