/* ================================================================== */
/* LEGO BLOCK — demo catalog media. The backend (data/mock/brigade-data */
/* /*.json) stores media.url as a bare filename ("item-photo-1.jpg"),   */
/* since data/ has no business knowing about Vite's asset pipeline.     */
/* This is the one place that imports the actual files (so Vite bundles */
/* /hashes/inlines them as usual) and maps bare filename -> real URL.   */
/* brigadeStore.js's fetchBrigadeCatalog rewrites media urls through    */
/* this lookup after fetching; a URL that isn't a known bare filename   */
/* (e.g. a real uploaded data: URL, once that exists) passes through    */
/* unchanged.                                                           */
/* ================================================================== */

import demoPhoto1 from "../assets/item-photo-1.jpg";
import demoPhoto2 from "../assets/item-photo-2.jpg";
import demoPhoto3 from "../assets/item-photo-3.jpg";
import demoClip from "../assets/item-demo-clip.mp4";
import demoClipPoster from "../assets/item-demo-clip-poster.jpg";

const DEMO_MEDIA_LOOKUP = {
  "item-photo-1.jpg": demoPhoto1,
  "item-photo-2.jpg": demoPhoto2,
  "item-photo-3.jpg": demoPhoto3,
  "item-demo-clip.mp4": demoClip,
  "item-demo-clip-poster.jpg": demoClipPoster,
};

export function resolveDemoMediaUrl(url) {
  return DEMO_MEDIA_LOOKUP[url] || url;
}

export function resolveCatalogMedia(catalog) {
  return catalog.map((item) => {
    if (!item.media?.length) return item;
    return {
      ...item,
      media: item.media.map((m) => ({
        ...m,
        url: resolveDemoMediaUrl(m.url),
        ...(m.poster ? { poster: resolveDemoMediaUrl(m.poster) } : {}),
      })),
    };
  });
}
