/* eslint no-redeclare: 0 */
/* global fetch:writable */
import { configRead } from './config';

const SHELF_SHORTS = 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS';

// Verification counter (read it from the inspector: window.__kingShorts).
window.__kingShorts = { removed: 0, shelves: 0 };

const origParse = JSON.parse;
JSON.parse = function () {
  const r = origParse.apply(this, arguments);
  if (!configRead('removeShorts')) {
    return r;
  }

  // Only browse/search style responses carry tiles and shelves.
  if (
    r &&
    typeof r === 'object' &&
    (r.contents || r.continuationContents || r.onResponseReceivedActions)
  ) {
    try {
      sanitize(r);
    } catch (e) {
      console.warn('[shorts] sanitize failed', e);
    }
  }

  return r;
};

export function isShortsTile(item) {
  const tile = item?.tileRenderer;
  if (!tile) return false;
  if (tile.onSelectCommand?.reelWatchEndpoint != null) return true;
  if (tile.contentType === 'TILE_CONTENT_TYPE_SHORTS') return true;
  const overlays = tile.header?.tileHeaderRenderer?.thumbnailOverlays;
  return (
    Array.isArray(overlays) &&
    overlays.some(
      (o) => o?.thumbnailOverlayTimeStatusRenderer?.style === 'SHORTS'
    )
  );
}

export function isShortsShelf(item) {
  return item?.shelfRenderer?.tvhtml5ShelfRendererType === SHELF_SHORTS;
}

/**
 * Walks a response and removes every Shorts tile or Shorts shelf, wherever it
 * sits (home shelves, grids, search results, continuations).
 */
export function sanitize(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const item = node[i];
      if (isShortsShelf(item)) {
        node.splice(i, 1);
        window.__kingShorts.shelves++;
      } else if (isShortsTile(item)) {
        node.splice(i, 1);
        window.__kingShorts.removed++;
      } else {
        sanitize(item);
      }
    }
  } else if (node && typeof node === 'object') {
    for (const key in node) {
      const v = node[key];
      if (v && typeof v === 'object') sanitize(v);
    }
  }
}
