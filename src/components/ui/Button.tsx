import * as React from "react";

type Variant =
  | "default"
  | "primary"
  | "secondary"
  | "soft"
  | "outline"
  | "ghost"
  | "destructive";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "default",
  size = "md",
  className = "",
  ...props
}: Props) {
  const v =
    variant === "secondary" || variant === "soft"
      ? "bg-secondary text-secondary-foreground"
      : variant === "outline"
      ? "border border-input bg-background"
      : variant === "ghost"
      ? "bg-transparent"
      : variant === "destructive"
      ? "bg-destructive text-destructive-foreground"
      : "bg-primary text-primary-foreground";

  const s = size === "sm" ? "h-8 px-3 text-sm" : size === "lg" ? "h-11 px-5" : "h-10 px-4";

  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center rounded-md font-medium transition",
        "disabled:opacity-50 disabled:pointer-events-none",
        v,
        s,
        className,
      ].join(" ")}
    />
  );
}

export default Button;
