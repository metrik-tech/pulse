/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-mode="dark"]'],
  content: ["src/**/*.tsx", "index.html"],
  theme: {
    extend: {
      keyframes: {
        dialogOverlayShow: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        dialogContentShow: {
          from: {
            opacity: "0",
            transform: "translate(-50%, -45%) scale(0.95)",
          },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
      },
      animation: {
        // Dialog
        dialogOverlayShow:
          "dialogOverlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        dialogContentShow:
          "dialogContentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
