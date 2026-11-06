import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

type StyleProps = { variant?: Variant; size?: Size; className?: string };

const classes = ({ variant = "primary", size = "md", className = "" }: StyleProps) =>
  `${base} ${variants[variant]} ${sizes[size]} ${className}`;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps & { loading?: boolean; children: ReactNode };

export function Button({ variant, size, className, loading, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={classes({ variant, size, className })}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

/** A link that looks like a button. */
export function LinkButton({ variant, size, className, ...props }: LinkProps & StyleProps) {
  return <Link {...props} className={classes({ variant, size, className })} />;
}
