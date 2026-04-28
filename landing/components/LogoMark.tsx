interface LogoMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LogoMark({ size = "md", className }: LogoMarkProps) {
  const sizes = {
    sm: "text-lg tracking-[0.25em]",
    md: "text-2xl tracking-[0.3em]",
    lg: "text-5xl tracking-[0.35em]",
  };

  return (
    <span
      className={`font-cinzel ${sizes[size]} text-bone select-none ${className ?? ""}`}
    >
      AUGURY
    </span>
  );
}
