import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        "surface-2": c("surface-2"),
        border: c("border"),
        text: c("text"),
        muted: c("muted"),
        primary: c("primary"),
        "primary-fg": c("primary-fg"),
        accent: c("accent"),
        cta: c("cta"),
        "cta-fg": c("cta-fg"),
        ink: c("ink"),
        "ink-2": c("ink-2"),
        "ink-fg": c("ink-fg"),
        "ink-muted": c("ink-muted"),
        success: c("success"),
        warning: c("warning"),
        danger: c("danger"),
      },
      borderRadius: {
        DEFAULT: "0.625rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.04)",
        card: "0 2px 10px rgb(0 0 0 / 0.06)",
        pop: "0 12px 32px rgb(0 0 0 / 0.14)",
      },
    },
  },
  plugins: [],
};
export default config;
