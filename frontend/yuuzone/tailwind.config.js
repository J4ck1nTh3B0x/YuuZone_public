/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      width: {
        '88': '22rem', // 352px for sidebar width
      },
      margin: {
        'l-88': '22rem', // 352px for sidebar margin
      },
      colors: {
        // Primary Brand Colors - Using CSS variables for dynamic theming
        "theme-blue": "var(--theme-blue, #37affe)",
        "theme-blue-coral": "var(--theme-blue-coral, #3172ff)",
        "theme-light-blue": "var(--theme-light-blue, #69bcff)",
        "theme-pale-blue": "var(--theme-pale-blue, #93ceff)",
        "theme-gray-blue": "var(--theme-gray-blue, #22638f)",
        "theme-cultured": "var(--theme-cultured, #004b96)",

        // Neutral Colors
        "theme-less-white": "var(--theme-less-white, #f4f4f4)",
        "theme-light-gray": "var(--theme-light-gray, #d9d9d9)",
        "theme-light-gray2": "var(--theme-light-gray2, #dfdfdf)",
        "theme-light-gray3": "var(--theme-light-gray3, #e7e5e5)",
        "theme-gray": "var(--theme-gray, #c4c4c4)",
        "theme-pale-gray": "var(--theme-pale-gray, #eaeaea)",

        // Semantic UI Colors
        "theme-text-primary": "var(--theme-text-primary, #374151)",
        "theme-text-secondary": "var(--theme-text-secondary, #6b7280)",
        "theme-text-muted": "var(--theme-text-muted, #9ca3af)",
        "theme-text-light": "var(--theme-text-light, #d1d5db)",

        // Background Colors
        "theme-bg-primary": "var(--theme-bg-primary, #ffffff)",
        "theme-bg-secondary": "var(--theme-bg-secondary, #f9fafb)",
        "theme-bg-tertiary": "var(--theme-bg-tertiary, #f3f4f6)",
        "theme-bg-dark": "var(--theme-bg-dark, #1f2937)",
        "theme-bg-darker": "var(--theme-bg-darker, #111827)",
        "theme-bg-hover": "var(--theme-bg-hover, #e5e7eb)",

        // Border Colors
        "theme-border-light": "var(--theme-border-light, #e5e7eb)",
        "theme-border-medium": "var(--theme-border-medium, #d1d5db)",
        "theme-border-dark": "var(--theme-border-dark, #4b5563)",
        "theme-border-darker": "var(--theme-border-darker, #374151)",

        // Interactive Colors
        "theme-link": "var(--theme-link, #2563eb)",
        "theme-link-hover": "var(--theme-link-hover, #1d4ed8)",
        "theme-button-primary": "var(--theme-button-primary, #2563eb)",
        "theme-button-primary-hover": "var(--theme-button-primary-hover, #1d4ed8)",
        "theme-button-active": "var(--theme-button-active, #1e40af)",
        "theme-button-disabled": "var(--theme-button-disabled, #9ca3af)",
        "theme-button-loading": "var(--theme-button-loading, #374151)",

        // Status Colors
        "theme-success": "var(--theme-success, #059669)",
        "theme-success-light": "var(--theme-success-light, #d1fae5)",
        "theme-success-border": "var(--theme-success-border, #a7f3d0)",
        "theme-error": "var(--theme-error, #dc2626)",
        "theme-error-light": "var(--theme-error-light, #fef2f2)",
        "theme-error-border": "var(--theme-error-border, #fecaca)",
        "theme-warning": "var(--theme-warning, #d97706)",
        "theme-warning-light": "var(--theme-warning-light, #fef3c7)",
        "theme-warning-border": "var(--theme-warning-border, #fde68a)",
        "theme-info": "var(--theme-info, #2563eb)",

        // Special Role Colors
        "theme-yellow-crown": "var(--theme-yellow-crown, #FFD700)",
        "theme-wine-wrench": "var(--theme-wine-wrench, #722F37)",

        // Badge Colors
        "theme-support-primary": "var(--theme-support-primary, #9333EA)",
        "theme-support-text": "var(--theme-support-text, #E9D5FF)",
        "theme-vip-primary": "var(--theme-vip-primary, #EAB308)",
        "theme-vip-text": "var(--theme-vip-text, #FEF9C3)",

        // Chat/Messaging Colors
        "theme-received": "var(--theme-received, #43b751)",
        "theme-sender": "var(--theme-sender, #47acde)",
        "theme-online": "var(--theme-online, #10b981)",

        // Comment Thread Colors
        "theme-comment-border-1": "var(--theme-comment-border-1, #fbbf24)",
        "theme-comment-border-2": "var(--theme-comment-border-2, #60a5fa)",
        "theme-comment-border-3": "var(--theme-comment-border-3, #a78bfa)",
        "theme-comment-border-4": "var(--theme-comment-border-4, #34d399)",
        "theme-comment-border-5": "var(--theme-comment-border-5, #38bdf8)",
        "theme-comment-border-6": "var(--theme-comment-border-6, #f472b6)",

        // Dark Mode Colors
        "theme-dark-bg": "var(--theme-dark-bg, #1f2937)",
        "theme-dark-bg-secondary": "var(--theme-dark-bg-secondary, #111827)",
        "theme-dark-card": "var(--theme-dark-card, #23232a)",
        "theme-dark-text": "var(--theme-dark-text, #ffffff)",
        "theme-dark-text-secondary": "var(--theme-dark-text-secondary, #e5e7eb)",
        "theme-dark-border": "var(--theme-dark-border, #374151)",
        "theme-dark-placeholder": "var(--theme-dark-placeholder, #d1d5db)",
        "theme-dark-placeholder-80": "var(--theme-dark-placeholder-80, rgba(209, 213, 219, 0.8))",
        "theme-dark-hover": "var(--theme-dark-hover, #18181b)",

        // Loader/Animation Colors
        "theme-loader-light": "var(--theme-loader-light, #ffffff)",
        "theme-loader-dark": "var(--theme-loader-dark, #333333)",

        // Modal/Overlay Colors
        "theme-overlay": "var(--theme-overlay, rgba(0, 0, 0, 0.9))",
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require("@tailwindcss/typography")],
};
