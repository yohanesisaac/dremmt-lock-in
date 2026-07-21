"use client";

import { useRef, type ChangeEvent } from "react";
import { errorTextClass, hintClass, inputClass, labelClass } from "@/components/ui";
import {
  caretAfterFormat,
  formatUsPhoneDisplay,
} from "@/lib/phone";

export function PhoneField({
  id,
  name,
  label = "Phone number",
  value,
  onChange,
  error,
  helperText = "Enter a 10-digit U.S. number.",
  placeholder = "(310) 902-8228",
  required,
  disabled,
}: {
  id: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (formatted: string) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const previousValue = el.value;
    const previousCaret = el.selectionStart ?? previousValue.length;
    const formatted = formatUsPhoneDisplay(previousValue);
    onChange(formatted);

    // Restore caret after React commits the formatted value.
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const nextCaret = caretAfterFormat(previousValue, previousCaret, formatted);
      node.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        disabled={disabled}
        className={inputClass}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
      {helperText ? <p className={hintClass}>{helperText}</p> : null}
      {error ? <p className={errorTextClass}>{error}</p> : null}
    </div>
  );
}
