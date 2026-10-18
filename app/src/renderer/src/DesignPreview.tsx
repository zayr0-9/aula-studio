import type { CSSProperties } from 'react';
import type { FixedColor } from '../../shared/color';
import { Keyboard } from './components/Keyboard';
import { f75Layout } from './components/keyboard-layout';

export interface LightingPreviewProps {
  effect: number | null;
  brightness: number | null;
  color: FixedColor | null;
}

/** Visualizes verified device state only; no independent controls or device I/O. */
export function DesignPreview({ effect, brightness, color }: LightingPreviewProps) {
  const supported = effect === 1 || effect === 11 || effect === 17;
  const rgb = color ? `rgb(${color.red}, ${color.green}, ${color.blue})` : undefined;
  const colorful = effect === 11 || effect === 17 || (effect === 1 && color?.colourful);
  const lit = supported && (effect !== 1 || color !== null);
  return (
    <div className="lighting-visual" aria-labelledby="preview-title">
      <div className="section-header">
        <h2 id="preview-title">Keyboard lighting</h2>
        <span className="small-tag">{effect === null ? 'Not read' : 'Last verified settings'}</span>
      </div>
      <div
        className={`light-preview${colorful ? ' effect-spectrum' : ''}`}
        style={{ '--preview-opacity': brightness === null ? 1 : brightness / 9 } as CSSProperties}
      >
        <Keyboard
          label={
            effect === null
              ? 'Keyboard lighting not read'
              : 'Approximation of last verified keyboard lighting'
          }
          keyAppearance={Object.fromEntries(
            f75Layout.keys
              .filter((key) => key.kind !== 'knob' && lit)
              .map((key) => [key.id, { color: colorful ? '#84edc0' : rgb }]),
          )}
        />
      </div>
      <p className="supporting">
        {effect === null
          ? 'Read from the keyboard to display its lighting. Close the official AULA app first.'
          : !supported
            ? `Effect ${effect} is not supported for visualization.`
            : 'Reflects the last read or applied settings. Animated effects are approximate, not a live LED feed.'}
      </p>
    </div>
  );
}
