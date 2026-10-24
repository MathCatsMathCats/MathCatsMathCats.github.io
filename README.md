# makohippo.com

Studio home page: the makohippo logo, the slogan and a link to each game's site.
Plain HTML (`index.html`, styles inline), nothing to build.

This is the root GitHub Pages site of the `MathCatsMathCats` account. The custom domain is set here,
so every project site is served under it: `makohippo.com/MakoCatsMath/`, `/ChromaticDrift/`, `/ThrowAPlate/`
and the `*-privacy` repos. DNS is at Cloudflare ("DNS only", no proxy).

Keep these files:
- `CNAME`: the custom domain. Removing it takes every site off makohippo.com.
- `app-ads.txt`: AdMob reads it at the domain root for the Android app and Chromatic Drift.
- `robots.txt`: crawlers only read it at the domain root, so it lists every site's sitemap.
- `.nojekyll`: serve the files as they are.

Images: `img/logo-*.webp` come from `Website/Logo/Logo.png`; the game icons are the apps' 1024 px icons.
