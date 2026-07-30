/** @type {import('tailwindcss').Config} */
// Scoped deliberately to just the Orbit Workspace files. The rest of the
// Clydec portal is 100% inline-style React (see src/App.jsx's design-tokens
// comment) and was never written against Tailwind — scanning the whole
// `src` tree for utility classes would be harmless on its own (no other
// file uses Tailwind class names, so nothing extra would actually generate),
// but scoping the `content` glob to `src/orbit/**` keeps the intent explicit
// and keeps future Tailwind-class typos in Orbit from silently searching a
// much bigger tree. `preflight` is switched off below (see corePlugins) so
// Tailwind's base stylesheet reset never touches the rest of the app.
export default {
  content: ["./src/orbit/**/*.{js,jsx}"],
  corePlugins: {
    // Disabled: Tailwind's preflight reset (margins/box-sizing/etc. on bare
    // elements) would bleed into the rest of the portal, which relies on its
    // own `.cly` reset (see App.jsx's CSS template string) and is not
    // written to expect Tailwind's base styles. Utility classes (bg-*,
    // flex, px-*, etc.) still work fine without preflight.
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
