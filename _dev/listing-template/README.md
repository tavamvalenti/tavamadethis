# Free sample listing pages (TavaMadeThis)

One template builds a private, unlisted sample page per listing at `/c/<slug>/` (the `/c/` folder is already `noindex` in `_headers` and `robots.txt`).

## Build one

1. Pick a prospect from the Prospects sheet, confirm the listing is still ACTIVE, and run the photo fit check (see the Listing Page Mini-Offer doc). Skip weak photos.
2. Save 1 good exterior (hero) + 4 to 6 interior photos to `/mnt/project-files/samples/<slug>/src/` (outside the repo; portals block automated downloads, so Tava saves them by hand).
3. Higgsfield (about 5 to 7 credits total, never a video):
   - Upscale the hero to 4K with `upscale_image` (2 credits) -> `hero.png`.
   - Make the night version with an image edit of the hero (`gpt_image_2_6` 2k medium was 1 credit, `flux_3_image` 2k was 3), check it keeps the architecture, then upscale it to 4K (2 credits) -> `night.png`.
   - To feed a local file to Higgsfield, push it to a branch and use `media_import_url` with the raw.githubusercontent URL (upload.higgsfield.ai is blocked from the container).
4. Copy `listings/solana-k7m2qd.json`, edit the fields (price, beds, baths, sqft, lot, year, MLS, agent, brokerage, headline, description, highlights, gallery files and crops).
5. `python3 _dev/listing-template/build.py _dev/listing-template/listings/<slug>.json` (needs ffmpeg with libwebp). Output: `c/<slug>/index.html` + `img/`.
6. Preview, open a PR, merge. Send the private link only with Tava's OK.

## Features in the template
Hero with 4K cover, count-up facts, sticky mini bar with price and tour button, share button, draggable day/night slider with an intro sweep, gallery with lightbox, monthly payment estimate, "full page includes" upgrade card, tour request card (sends nothing), 4 themes (coastal, midnight, modern, sage), scroll reveals.

## Rules
- Always label AI visuals; sample pages say "not affiliated" and the tour form sends nothing.
- Gallery photos are small and cropped to remove portal watermarks; source photos never go in the repo.
- Never promise what we cannot deliver; if the photos fail the fit check, do not build the sample.
