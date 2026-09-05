"use client";

import { useState, type ChangeEventHandler } from "react";

import { inputClass } from "./auth-styles";

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

export function PasswordField({
  name,
  label,
  autoComplete,
  error,
  value,
  onChange,
}: Readonly<PasswordFieldProps>) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={128}
          value={value}
          onChange={onChange}
          onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error ? `${name}-error` : "", capsLock ? `${name}-caps` : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={`${inputClass} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-3 my-auto h-fit text-sm font-semibold text-[var(--accent)]"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {capsLock && (
        <p
          id={`${name}-caps`}
          role="status"
          className="mt-2 text-sm text-[var(--muted)]"
        >
          Caps Lock is on.
        </p>
      )}
      {error && (
        <span
          id={`${name}-error`}
          className="mt-2 block text-sm text-[var(--danger)]"
        >
          {error}
        </span>
      )}
    </div>
  );
}
