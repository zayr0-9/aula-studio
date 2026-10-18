import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}
interface SelectProps<T extends string | number> {
  id: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** Single-select combobox. Focus stays on the trigger while browsing options. */
export function Select<T extends string | number>({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: SelectProps<T>) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const expanded = open && !disabled && options.length > 0;

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [expanded]);

  useEffect(() => {
    if (expanded)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded, listId]);

  function show(index = selected < 0 ? 0 : selected) {
    if (disabled || options.length === 0) return;
    setActive(index);
    search.current.text = '';
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || disabled) return;
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) return;
    const last = options.length - 1;
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'Escape') {
      if (expanded) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Enter' || event.key === ' ') {
        if (expanded) choose(active);
        else show();
      } else if (event.key === 'Home') show(0);
      else if (event.key === 'End') show(last);
      else if (!expanded) show();
      else
        setActive((previous) =>
          Math.max(0, Math.min(last, previous + (event.key === 'ArrowDown' ? 1 : -1))),
        );
      return;
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const now = performance.now();
    const text =
      (now - search.current.time < 700 ? search.current.text : '') + event.key.toLocaleLowerCase();
    search.current = { text, time: now };
    const query = [...text].every((char) => char === text[0]) ? text[0] : text;
    const start = expanded ? active : selected;
    for (let offset = 1; offset <= options.length; offset++) {
      const index = (Math.max(-1, start) + offset) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(query)) {
        setActive(index);
        setOpen(true);
        return;
      }
    }
  }

  return (
    <div
      className="select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        disabled={disabled || options.length === 0}
        onKeyDown={keyDown}
        onClick={() => {
          if (expanded) setOpen(false);
          else show();
        }}
      >
        <span>{options[selected]?.label ?? 'Choose an option'}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-labelledby={id}
        aria-hidden={!expanded}
        inert={!expanded}
        className={`select-menu t-dropdown ${expanded ? 'is-open' : ''}`}
        data-origin="top-left"
      >
        {options.map((option, index) => (
          <li
            id={`${listId}-${index}`}
            key={option.value}
            role="option"
            aria-selected={index === selected}
            className={`select-option ${index === active ? 'is-active' : ''}`}
            onPointerMove={() => setActive(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              choose(index);
              trigger.current?.focus();
            }}
          >
            <span>{option.label}</span>
            <span aria-hidden="true">{index === selected ? '✓' : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
