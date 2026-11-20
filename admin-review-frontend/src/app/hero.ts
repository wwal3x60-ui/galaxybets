import { heroui } from "@heroui/react";

export default heroui({
  defaultTheme: "dark",
  themes: {
    dark: {
      colors: {
        background: "#0B0714",
        foreground: "#F5F3FF",
        divider: "rgba(167, 139, 250, 0.16)",
        focus: "#A78BFA",
        content1: { DEFAULT: "#151024", foreground: "#F5F3FF" },
        content2: { DEFAULT: "#19122B", foreground: "#F5F3FF" },
        content3: { DEFAULT: "#241A3B", foreground: "#F5F3FF" },
        content4: { DEFAULT: "#34264F", foreground: "#F5F3FF" },
        default: {
          50: "#0B0714",
          100: "#151024",
          200: "#241A3B",
          300: "#34264F",
          400: "#625574",
          500: "#9890AA",
          600: "#B6ACC8",
          700: "#D5CBE3",
          800: "#EEE8F5",
          900: "#FAF8FF",
          DEFAULT: "#241A3B",
          foreground: "#F5F3FF",
        },
        primary: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
          DEFAULT: "#7C3AED",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#A78BFA",
          foreground: "#1A102C",
        },
      },
    },
  },
});
