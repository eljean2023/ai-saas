"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...rest },
  ref
) {
  const resolvedId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={resolvedId}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={resolvedId}
        className={cn(
          "block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50"
            : "border-gray-300 focus:border-teal-500 focus:ring-teal-500 bg-white",
          "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={
          error ? `${resolvedId}-error` : hint ? `${resolvedId}-hint` : undefined
        }
        {...rest}
      />
      {error && (
        <p id={`${resolvedId}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${resolvedId}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
