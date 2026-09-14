# Dig, the app's waiting-list page

One static page (`index.html` + `station.js`) that replaces the Lovable waitlist at digrecords.app. Dig's design
(black, one accent, Helvetica, pills), EN/FR toggle, the promo text next to a browser port of the app's listening
station (`station.js`: the same proportions and behaviours as `src/components/turntable.tsx`, with Gil Scott-Heron's
Pieces Of A Man, previews from Apple's catalogue at load, no key). Assets are copies of `assets/turntable/*` and
`assets/brand/dig.png`; `banner.jpg` is the crate photo from the previous page.

The form writes to the `waitlist` table of the DIG Record App project on Lovable Cloud (Supabase project
`fzuviylfyyrfsjdgwsde`, publishable key in the form's `data-key`), the same table the previous Lovable page filled, so
the list continues. The emails are in Lovable → the project → Cloud → Database → waitlist.

Live at https://lianasignoret.github.io/dig-app-site/ from the public repo `lianasignoret/dig-app-site` (GitHub Pages).
To update: copy this folder's files into that repo and push. To serve it at digrecords.app: add a `CNAME` file
containing `digrecords.app`, set the custom domain in the repo's Pages settings, and at the registrar point
`digrecords.app` (A records 185.199.108.153, .109.153, .110.153, .111.153) and `www` (CNAME lianasignoret.github.io) there.
