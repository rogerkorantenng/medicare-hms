import type { Config } from 'tailwindcss';

/**
 * Every value here comes from the design system the submitted Design
 * Documentation describes, extracted from the working v1.0 applications.
 * These are the values, not a component library's defaults: a colour or a
 * radius that disagrees with the documents is a defect, not a preference.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1D4ED8',   // primary actions, active nav, links
          hover: '#1E40AF',
          deep: '#1E3A8A',      // gradient end, link hover
          bright: '#2563EB',    // avatar tiles, gradient start
          tint: '#E0EAFF',      // icon tile backgrounds, secondary buttons
          wash: '#EEF3FB',      // table headers, callout panels
        },
        surface: {
          wash: '#F1F5FD',      // input backgrounds
          page: '#EEF3FB',      // staff workspace canvas
          mobile: '#F2F6FD',    // patient app canvas
          row: '#F6F9FE',       // table row hover
        },
        sidebar: '#0D1B3E',     // sidebar and toast background
        ink: {
          DEFAULT: '#0D1B3E',   // body text, headings
          soft: '#64748B',      // supporting text, labels
          faint: '#94A3B8',     // timestamps, placeholders
          disabled: '#B6C2D9',  // struck-through slots
        },
        hairline: 'rgba(30,64,175,.12)',

        // Semantic status. Every chip carries a colour AND a word, so it
        // survives printing and colour blindness.
        success: { bg: '#ECFDF5', fg: '#047857', br: '#A7F3D0' },
        warning: { bg: '#FFFBEB', fg: '#B45309', br: '#FDE68A' },
        danger:  { bg: '#FEF2F2', fg: '#DC2626', br: '#FECACA' },
        info:    { bg: '#EFF6FF', fg: '#1D4ED8', br: '#BFDBFE' },

        // Purple is reserved for AI. Do not use it for anything else. It is how
        // a user tells a suggestion from a recorded fact.
        ai: { bg: '#F5F3FF', fg: '#7C3AED', br: '#DDD6FE' },

        momo: { mtn: '#F5B800', mtnInk: '#3b2f00', telecel: '#E60000', at: '#0D1B3E' },
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // desktop scale
        title: ['22px', { lineHeight: '1.25', fontWeight: '800' }],
        section: ['18px', { lineHeight: '1.3', fontWeight: '800' }],
        card: ['15px', { lineHeight: '1.35', fontWeight: '800' }],
        body: ['13.5px', { lineHeight: '1.5' }],
        support: ['12.5px', { lineHeight: '1.45' }],
        label: ['11px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '.07em' }],
        chip: ['11px', { lineHeight: '1.1', fontWeight: '700' }],
        // mobile scale
        'm-section': ['17px', { lineHeight: '1.3', fontWeight: '800' }],
        'm-body': ['12.5px', { lineHeight: '1.5' }],
        'm-support': ['11.5px', { lineHeight: '1.45' }],
        'm-chip': ['10.5px', { lineHeight: '1.1', fontWeight: '700' }],
      },
      borderRadius: {
        input: '10px',
        control: '12px',
        card: '16px',
        row: '18px',
        panel: '20px',
        modal: '24px',
        sheet: '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,27,62,.04)',
        raised: '0 14px 34px -12px rgba(13,27,62,.25)',
        modal: '0 32px 80px -20px rgba(13,27,62,.5)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        fadeUp: 'fadeUp .28s ease both',
        breathe: 'breathe 1.5s ease-in-out infinite',
        spin: 'spin .8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
