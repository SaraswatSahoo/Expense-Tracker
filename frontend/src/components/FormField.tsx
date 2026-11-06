import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

const controlClasses =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-brand-600 focus:ring-1 focus:ring-brand-600 focus:outline-none " +
  "disabled:bg-slate-100 disabled:text-slate-500";

const borderClasses = (invalid?: boolean) => (invalid ? "border-red-500" : "border-slate-300");

type FieldProps = {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

function FieldWrapper({ label, error, hint, children }: FieldProps & { children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

/** A labelled text input with an optional hint and error message. */
export function InputField({
  label,
  error,
  hint,
  className = "",
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={`${controlClasses} ${borderClasses(Boolean(error))} ${className}`}
      />
    </FieldWrapper>
  );
}

/** A labelled dropdown with an optional hint and error message. */
export function SelectField({
  label,
  error,
  hint,
  className = "",
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <select
        {...props}
        aria-invalid={Boolean(error)}
        className={`${controlClasses} ${borderClasses(Boolean(error))} ${className}`}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

/** An input without a label, for tight layouts. Always pass an aria-label. */
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { "aria-label": string }) {
  return <input {...props} className={`${controlClasses} ${borderClasses()} ${className}`} />;
}
