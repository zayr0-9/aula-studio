import type { CSSProperties, ReactNode } from 'react';
import { f75Layout } from './keyboard-layout';
import type { KeyboardKey, KeyboardLayout } from './keyboard-layout';
import './keyboard.css';

export interface KeyboardKeyAppearance {
  label?: ReactNode;
  color?: string;
  disabled?: boolean;
  description?: string;
}

export interface KeyboardProps {
  layout?: KeyboardLayout;
  label?: string;
  selectedKeys?: readonly string[];
  keyAppearance?: Readonly<Record<string, KeyboardKeyAppearance>>;
  onKeySelect?: (key: KeyboardKey) => void;
  className?: string;
}

/** Presentation only: selection never reads or writes a device. */
export function Keyboard({
  layout = f75Layout,
  label = layout.name,
  selectedKeys = [],
  keyAppearance = {},
  onKeySelect,
  className = '',
}: KeyboardProps) {
  return (
    <div className={`keyboard-scroll ${className}`}>
      <div
        className="keyboard-case"
        role="group"
        aria-label={label}
        style={
          { '--keyboard-ratio': `${layout.width + 0.8} / ${layout.height + 0.8}` } as CSSProperties
        }
      >
        <div className="keyboard-deck">
          <span className="keyboard-indicator" aria-hidden="true" />
          {layout.keys.map((key) => {
            const appearance = keyAppearance[key.id];
            const selected = selectedKeys.includes(key.id);
            const name = key.id === 'Space' ? 'Space' : key.id.replace(/(Left|Right)$/, ' $1');
            const style = {
              left: `${(key.x / layout.width) * 100}%`,
              top: `${(key.y / layout.height) * 100}%`,
              width: `${(key.width / layout.width) * 100}%`,
              height: `${100 / layout.height}%`,
              '--key-color': appearance?.color,
            } as CSSProperties;
            const classes = `keyboard-key${key.kind === 'knob' ? ' keyboard-knob' : ''}${selected ? ' is-selected' : ''}${appearance?.color ? ' has-color' : ''}`;
            const content = (
              <span className="keyboard-keycap">{appearance?.label ?? key.label}</span>
            );
            return onKeySelect ? (
              <button
                type="button"
                key={key.id}
                className={classes}
                style={style}
                aria-label={appearance?.description ? `${name}: ${appearance.description}` : name}
                aria-pressed={selected}
                disabled={appearance?.disabled}
                onClick={() => onKeySelect(key)}
              >
                {content}
              </button>
            ) : (
              <span key={key.id} className={classes} style={style} aria-label={name}>
                {content}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
