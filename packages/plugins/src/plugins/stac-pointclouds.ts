/**
 * Choosing the point cloud of each STAC item when several results are loaded together.
 *
 * The LiDAR control draws one cloud per load, so a set of results becomes one layer per cloud;
 * this picks which asset of each item to stream. Kept apart from the panel so it can be tested.
 */
import { assetFormat, type StacAsset, type StacItem } from "./stac-api";

/** Most point clouds one action loads: each streams on its own, so the set has to stay small. */
export const MAX_POINT_CLOUDS = 10;

/** One item's cloud: the asset to stream. */
export interface ItemPointCloud {
  item: StacItem;
  key: string;
  asset: StacAsset;
}

/**
 * How well suited an asset is to streaming: 0 for COPC (range reads of a single file), 1 for an
 * Entwine Point Tile root, 2 for a plain LAS/LAZ file that has to be read whole.
 */
function streamingRank(asset: StacAsset): number {
  const type = (asset.type ?? "").toLowerCase();
  if (type.includes("copc") || /\.copc\.laz($|\?)/i.test(asset.href)) return 0;
  if (/\/ept\.json($|\?)/i.test(asset.href)) return 1;
  return 2;
}

/**
 * The point cloud asset of an item, preferring COPC over EPT over plain LAS/LAZ.
 *
 * @param item - A STAC item.
 * @returns The best cloud asset with its key, or undefined when the item has none the panel can load.
 */
export function pointCloudOf(item: StacItem): ItemPointCloud | undefined {
  let best: ItemPointCloud | undefined;
  for (const [key, asset] of Object.entries(item.assets ?? {})) {
    if (!asset?.href || assetFormat(asset) !== "pointcloud") continue;
    if (!best || streamingRank(asset) < streamingRank(best.asset)) best = { item, key, asset };
  }
  return best;
}

/**
 * The clouds a set of results would load, in the order given, and whether some were left out.
 *
 * @param items - The results, best first.
 * @param limit - Most clouds to take.
 * @returns The chosen clouds, and how many more there were beyond the limit.
 */
export function pointCloudsOf(
  items: readonly StacItem[],
  limit = MAX_POINT_CLOUDS,
): { clouds: ItemPointCloud[]; skipped: number } {
  const all = items.flatMap((item) => pointCloudOf(item) ?? []);
  return { clouds: all.slice(0, limit), skipped: Math.max(0, all.length - limit) };
}
