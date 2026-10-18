import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { DesignPreview } from './DesignPreview';
import { Select } from './components/Select';
import type { FixedColor } from '../../shared/color';

import type { IndicatorColors } from '../../shared/indicators';

export function BrightnessPanel({
  enabled,
  indicators,
  onIndicators,
}: {
  enabled: boolean;
  indicators: IndicatorColors | null;
  onIndicators: (colors: IndicatorColors) => void;
}) {
  const [value, setValue] = useState(9);
  const [color, setColor] = useState<FixedColor>({ red: 255, green: 0, blue: 0, colourful: false });
  const [observedColor, setObservedColor] = useState<FixedColor | null>(null);
  const [brightnessMode, setBrightnessMode] = useState<'individual' | 'global'>('individual');
  const [globalBrightness, setGlobalBrightness] = useState<number | null>(null);
  const [speed, setSpeed] = useState(4);
  const [observedSpeed, setObservedSpeed] = useState<number | null>(null);
  const [effect, setEffect] = useState(11);
  const [observedEffect, setObservedEffect] = useState<number | null>(null);
  const [observed, setObserved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState('Waiting to read keyboard lighting…');

  async function transact(action: 'read' | 'brightness' | 'effect' | 'speed' | 'color') {
    if (busy || blocked || !enabled) return;
    setBusy(true);
    setMessage(
      action !== 'read'
        ? 'Reading fresh configuration, applying and verifying…'
        : 'Reading device configuration…',
    );
    try {
      if (action === 'color') {
        const result = await window.aula.setColor(color);
        setColor(result);
        setObservedColor(result);
        setMessage('Color applied. Palette and lighting settings verified.');
      } else if (action === 'speed') {
        const result = await window.aula.setSpeed(speed);
        setSpeed(result);
        setObservedSpeed(result);
        setMessage('Speed applied and verified.');
      } else if (action === 'brightness') {
        const brightness = await window.aula.setBrightness(value);
        setObserved(brightness);
        setValue(brightness);
        if (brightnessMode === 'global') setGlobalBrightness(brightness);
        setMessage('Brightness applied and verified.');
      } else {
        const selected =
          action === 'effect'
            ? brightnessMode === 'global' && globalBrightness !== null && effect !== 17
              ? await window.aula.setEffectBrightness(effect, globalBrightness)
              : await window.aula.setEffect(effect)
            : await window.aula.readEffect();
        const supported = selected === 1 || selected === 11 || selected === 17;
        if (supported) setEffect(selected);
        setObservedEffect(selected);
        setObserved(null);
        setObservedSpeed(null);
        setObservedColor(null);
        if (selected === 1 || selected === 11) {
          const brightness = await window.aula.readBrightness();
          setObserved(brightness);
          setValue(brightness);
          if (brightnessMode === 'global' && globalBrightness === null)
            setGlobalBrightness(brightness);
          if (selected === 11) {
            const currentSpeed = await window.aula.readSpeed();
            setSpeed(currentSpeed);
            setObservedSpeed(currentSpeed);
          }
        }
        if (selected === 21) onIndicators(await window.aula.readIndicators());
        if (selected === 1) {
          const currentColor = await window.aula.readColor();
          setColor(currentColor);
          setObservedColor(currentColor);
        }
        setMessage(
          selected === 21
            ? 'Custom per-key colors read. Use Per-key colors below; ordinary effect transitions are disabled in this mode.'
            : !supported
              ? 'This effect is not supported. Choose an effect and select Apply effect to replace it. Nothing was changed.'
              : action === 'effect'
                ? 'Effect applied and verified. Available settings refreshed from the keyboard.'
                : 'Settings read from the keyboard. Nothing was changed.',
        );
      }
    } catch (error) {
      setObserved(null);
      setObservedEffect(null);
      setObservedColor(null);
      setObservedSpeed(null);
      setBlocked(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Operation failed; device state may be uncertain. No retry or restoration. Restart Studio before reading again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const startupReadStarted = useRef(false);
  const readOnStartup = useEffectEvent(() => {
    void transact('read');
  });
  useEffect(() => {
    if (!enabled || startupReadStarted.current) return;
    startupReadStarted.current = true;
    readOnStartup();
  }, [enabled]);

  return (
    <section className="panel lighting-controls" aria-labelledby="live-brightness-title">
      <header className="action-row">
        <h2 id="live-brightness-title">Lighting settings</h2>
        <button
          type="button"
          className="secondary-button"
          disabled={!enabled || busy || blocked}
          onClick={() => {
            void transact('read');
          }}
        >
          Read from keyboard
        </button>
      </header>
      <DesignPreview
        effect={observedEffect}
        brightness={observed}
        color={observedColor}
        indicators={indicators}
      />

      <div className="lighting-sections">
        <section className="lighting-section" aria-labelledby="effect-color-title">
          <h3 id="effect-color-title">Effect &amp; color</h3>
          <label htmlFor="live-effect">Effect</label>
          <Select
            id="live-effect"
            value={effect}
            options={[
              { value: 11, label: 'Neon stream' },
              { value: 1, label: 'Fixed on' },
              { value: 17, label: 'Blossoming' },
            ]}
            disabled={
              !enabled || busy || blocked || observedEffect === null || observedEffect === 21
            }
            onChange={setEffect}
          />
          <p className="supporting">
            Current:{' '}
            {observedEffect === null
              ? 'not read'
              : observedEffect === 11
                ? 'Neon stream'
                : observedEffect === 1
                  ? 'Fixed on'
                  : observedEffect === 17
                    ? 'Blossoming'
                    : observedEffect === 21
                      ? 'Custom per-key mode · use Per-key colors below'
                      : `Unsupported effect (${observedEffect})`}
            {effect !== observedEffect && observedEffect !== null && observedEffect !== 21
              ? ' · Selection not applied'
              : ''}
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={
              !enabled || busy || blocked || observedEffect === null || observedEffect === 21
            }
            onClick={() => {
              void transact('effect');
            }}
          >
            Apply effect
          </button>

          {observedEffect === 11 && (
            <div>
              <label htmlFor="live-speed">Neon stream speed: {speed}</label>
              <input
                id="live-speed"
                type="range"
                min="0"
                max="4"
                step="1"
                value={speed}
                disabled={
                  !enabled || busy || blocked || observedSpeed === null || effect !== observedEffect
                }
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
              <p className="supporting">Current speed: {observedSpeed ?? 'not read'}</p>
              <button
                type="button"
                className="primary-button"
                disabled={
                  !enabled || busy || blocked || observedSpeed === null || effect !== observedEffect
                }
                onClick={() => {
                  void transact('speed');
                }}
              >
                Apply speed
              </button>
            </div>
          )}

          {observedEffect === 1 && (
            <fieldset
              disabled={
                !enabled || busy || blocked || observedColor === null || effect !== observedEffect
              }
            >
              <legend>Fixed color</legend>
              <label htmlFor="fixed-color">Solid color</label>
              <input
                id="fixed-color"
                type="color"
                value={
                  '#' +
                  [color.red, color.green, color.blue]
                    .map((channel) => channel.toString(16).padStart(2, '0'))
                    .join('')
                }
                onChange={(event) => {
                  const hex = event.target.value;
                  setColor((previous) => ({
                    ...previous,
                    red: parseInt(hex.slice(1, 3), 16),
                    green: parseInt(hex.slice(3, 5), 16),
                    blue: parseInt(hex.slice(5, 7), 16),
                  }));
                }}
              />
              <label>
                <input
                  type="checkbox"
                  checked={color.colourful}
                  onChange={(event) =>
                    setColor((previous) => ({ ...previous, colourful: event.target.checked }))
                  }
                />{' '}
                Rainbow
              </label>
              <p className="supporting">Turn off rainbow to use the selected solid color.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void transact('color');
                }}
              >
                Apply color
              </button>
            </fieldset>
          )}
        </section>

        <section className="lighting-section" aria-labelledby="brightness-title">
          <h3 id="brightness-title">Brightness</h3>
          <label htmlFor="brightness-mode">Brightness behavior</label>
          <Select<'individual' | 'global'>
            id="brightness-mode"
            value={brightnessMode}
            options={[
              { value: 'individual', label: 'Per effect' },
              { value: 'global', label: 'Shared across effects' },
            ]}
            disabled={busy || blocked}
            onChange={(mode) => {
              setBrightnessMode(mode);
              setGlobalBrightness(mode === 'global' ? observed : null);
            }}
          />
          <p className="supporting">
            {brightnessMode === 'global'
              ? `Shared brightness: ${globalBrightness ?? 'read a supported effect first'}. Kept during Blossoming and applied when switching to a supported effect. This preference lasts until Studio closes.`
              : 'Each effect keeps its own stored brightness.'}
          </p>
          <label htmlFor="live-brightness">Brightness: {value}</label>
          <input
            id="live-brightness"
            type="range"
            min="0"
            max="9"
            step="1"
            value={value}
            disabled={!enabled || busy || blocked || observed === null || effect !== observedEffect}
            onChange={(event) => setValue(Number(event.target.value))}
          />
          <p className="supporting">
            Current brightness:{' '}
            {observed ?? (observedEffect === 17 ? 'unsupported for Blossoming' : 'not read')}
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={!enabled || busy || blocked || observed === null || effect !== observedEffect}
            onClick={() => {
              void transact('brightness');
            }}
          >
            Apply brightness
          </button>
        </section>
      </div>
      <p role="status">
        {enabled ? message : 'Keyboard lighting is unavailable in this environment.'}
      </p>
    </section>
  );
}
