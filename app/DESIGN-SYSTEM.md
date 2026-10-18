# Studio design system

## Principles

- Natural sentence/title case. No tracking utilities, custom letter spacing or forced uppercase.
- Use page titles without descriptive filler. Explain only genuinely complex behavior and important safety constraints.
- Use system fonts, shared spacing, dark surfaces and restrained green accents from `src/renderer/src/index.css`.
- Distinguish drafts, simulations and verified device state. Never hide safety warnings to simplify a screen.

## Dropdowns

All dropdowns use the shared `Select` component in `src/renderer/src/components/Select.tsx`, not native HTML selects or one-off menus. It is renderer-only and platform-independent; do not embed OS checks or device operations in it.

```tsx
<label htmlFor="effect">Effect</label>
<Select
  id="effect"
  value={effect}
  options={[{ value: 1, label: 'Fixed on' }, { value: 11, label: 'Neon stream' }]}
  disabled={busy}
  onChange={setEffect}
/>
```

- Controlled value with typed string/number options. Values must be unique; provide a matching current value and at least one option.
- Always pair the stable `id` with a visible label using `htmlFor`.
- `onChange` receives the option value, not a DOM event. Choosing the current option does not emit a change.
- The trigger exposes combobox state; the menu uses listbox/options, selected state and active-descendant navigation.
- Click, Enter or Space opens. Arrows browse; Home/End jump. Enter/Space commits. Escape dismisses without changing the value. Tab closes and moves focus normally. Typing searches labels; repeated letters cycle matching options.
- Outside pointer interaction and focus leaving dismiss the menu. Disabled controls cannot open or commit.
- Styling uses `.select`, `.select-trigger`, `.select-menu` and `.select-option`; selected and keyboard-active states are distinct. Focus outlines remain visible.
- Menus are local overlays: do not place inside overflow-clipped containers. If a future layout needs viewport-aware placement or portals, extend this component rather than building another dropdown.

## Validation

The hardware-disabled Electron smoke test exercises dropdown keyboard selection, cancellation, pointer selection, typeahead, outside dismissal, focus and disabled behavior. No device operation should occur merely by opening or browsing a dropdown.
