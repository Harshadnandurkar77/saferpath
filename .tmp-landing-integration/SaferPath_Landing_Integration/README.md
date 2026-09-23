# SaferPath Landing Page Integration

This package contains the responsive SaferPath landing page and its interactive seeded route-context demo.

## Included files

- `SaferPathLanding.tsx` — the complete React landing-page component.
- `saferpath-landing.css` — the required theme, responsive layout, map illustration, route cards, modal, and accessibility styles.
- `App.example.tsx` — a minimal integration example.
- `index-head.example.html` — the document-head font and metadata example.

## Requirements

The component expects:

- React 18 or React 19.
- TypeScript.
- Tailwind CSS v4 because the stylesheet uses `@import "tailwindcss"` and Tailwind utility classes.
- `lucide-react` for the interface icons.

Install the icon dependency if your project does not already have it:

```bash
npm install lucide-react
```

## Integration

Copy the two source files into your project and import the stylesheet once from your application entry point or global stylesheet:

```tsx
import SaferPathLanding from "./SaferPathLanding";
import "./saferpath-landing.css";

export default function App() {
  return <SaferPathLanding />;
}
```

If your project already has a global Tailwind stylesheet, merge the contents of `saferpath-landing.css` into that file instead of importing both files independently. Preserve the `@theme inline` block, the `:root` tokens, and the custom component classes because the landing page uses those tokens.

Add the font imports from `index-head.example.html` to your existing HTML document head. The page uses:

- **Fraunces** for display headings.
- **DM Sans** for interface and body text.
- **DM Mono** for metadata and labels.

## Behaviour included

The page includes:

- Responsive desktop and mobile navigation.
- Scroll links for the lens, evidence, privacy, and partner sections.
- Time controls for 6:00 PM, 9:00 PM, and 11:30 PM.
- Three seeded route options with context bands, notes, and confidence.
- Selectable route cards.
- “Why this route?” accessible modal explanations.
- Reduced-motion support.
- A CSS/SVG map illustration that does not require external map credentials.

## Important implementation boundary

This is the public landing-page experience and a seeded demonstration. It does not include authentication, real routing, live GPS, backend APIs, live reports, trusted-contact delivery, or emergency dispatch. Connect those capabilities through your own backend and replace the seeded `timeData` object when the product API is available.

The current demo intentionally uses language such as “stronger contextual support” and “limited or stale evidence” rather than claiming that any route is guaranteed safe.

## Customising the component

The easiest places to customise are:

1. `timeData` near the top of `SaferPathLanding.tsx` for the seeded route scenarios.
2. The `Logo` component for your own wordmark.
3. The alert placeholders in the sign-in and pilot CTA buttons.
4. The `routeInsight` messages used by the explanation modal.
5. The CSS colour tokens in `saferpath-landing.css` under `:root`.

If you use a router, replace the anchor links with your router’s link component where needed. If your app uses a strict Content Security Policy, self-host the Google fonts or replace the font import with your approved font strategy.
