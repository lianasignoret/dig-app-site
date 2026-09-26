# Dig, the app's waiting-list page

One static page (`index.html` + `station.js`) that replaces the Lovable waitlist at digrecords.app. Dig's design
(black, one accent, Helvetica, pills), EN/FR toggle, the promo text next to a browser port of the app's listening
station (`station.js`: the same proportions and behaviours as `src/components/turntable.tsx`, with Gil Scott-Heron's
Pieces Of A Man, previews from Apple's catalogue at load, no key). Assets are copies of `assets/turntable/*` and
`assets/brand/dig.png`; `banner.jpg` is the crate photo from the previous page.

The form writes to the `waitlist` table of the DIG Record App project on Lovable Cloud (Supabase project
`fzuviylfyyrfsjdgwsde`, publishable key in the form's `data-key`), the same table the previous Lovable page filled, so
the list continues. The emails are in Lovable → the project → Cloud → Database → waitlist.

Published from Lovable at **https://digrecords.app** (project "DIG Record App", repo `lianasignoret/dig-vinyl-vibes`, connected
2026-09-14 18:15; digrecords.store and digrecords.fr point at the same project). There the page is served as is by
`src/routes/index.tsx` from `src/site/index.html`, with `station.js` and the images in `public/` and absolute asset paths.
To update: copy `index.html` to `src/site/`, the other files to `public/`, make the asset paths absolute (`/deck.jpg`),
push to `main`; Lovable syncs it, then Publish → Update. A mirror runs on GitHub Pages at
https://lianasignoret.github.io/dig-app-site/ (repo `lianasignoret/dig-app-site`, relative paths).

**Sign-up emails to the team.** The page calls the Edge Function `join` (`supabase/functions/join/index.ts`, deployed on
Lovable Cloud 2026-09-14 18:25): it writes the row and, when the secrets exist, mails the team through Resend. Secrets in
Lovable → project → Cloud → Secrets: `RESEND_API_KEY` (resend.com, with digrecords.app verified there), `WAITLIST_NOTIFY_TO`
(comma-separated addresses), optional `WAITLIST_FROM` (default `Dig <hello@digrecords.app>`). Without them the row is
still written and no email goes out. If the function is ever missing, the page inserts the row directly.
