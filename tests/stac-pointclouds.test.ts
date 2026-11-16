import assert from "node:assert/strict";
import test from "node:test";
import type { StacItem } from "../packages/plugins/src/plugins/stac-api";
import {
  MAX_POINT_CLOUDS,
  pointCloudOf,
  pointCloudsOf,
} from "../packages/plugins/src/plugins/stac-pointclouds";

const item = (id: string, assets: Record<string, unknown>): StacItem =>
  ({ type: "Feature", id, geometry: null, properties: {}, assets }) as unknown as StacItem;

test("an item's COPC asset is preferred over EPT and plain LAZ", () => {
  const found = pointCloudOf(
    item("a", {
      laz: { href: "https://x.test/a.laz", type: "application/vnd.laszip" },
      ept: { href: "https://x.test/a/ept.json", type: "application/json" },
      copc: { href: "https://x.test/a.copc.laz", type: "application/vnd.laszip+copc" },
    }),
  );
  assert.equal(found?.key, "copc");
  assert.equal(
    pointCloudOf(
      item("b", {
        laz: { href: "https://x.test/b.laz" },
        ept: { href: "https://x.test/b/ept.json" },
      }),
    )?.key,
    "ept",
  );
});

test("an item with no loadable point cloud has none", () => {
  assert.equal(pointCloudOf(item("c", { image: { href: "https://x.test/c.tif" } })), undefined);
  // A cloud at an address the readers cannot open is not offered.
  assert.equal(pointCloudOf(item("d", { laz: { href: "abfs://c/d.laz" } })), undefined);
  assert.equal(pointCloudOf(item("e", {})), undefined);
});

test("a set skips results without a cloud, keeps their order, and stops at the limit", () => {
  const items = [
    item("one", { copc: { href: "https://x.test/1.copc.laz" } }),
    item("none", { image: { href: "https://x.test/n.tif" } }),
    ...Array.from({ length: MAX_POINT_CLOUDS + 2 }, (_, i) =>
      item(`m${i}`, { copc: { href: `https://x.test/m${i}.copc.laz` } }),
    ),
  ];
  const { clouds, skipped } = pointCloudsOf(items);
  assert.equal(clouds.length, MAX_POINT_CLOUDS);
  assert.deepEqual(
    clouds.slice(0, 3).map((cloud) => cloud.item.id),
    ["one", "m0", "m1"],
  );
  assert.equal(skipped, 3);
  assert.deepEqual(pointCloudsOf(items, 2).clouds.length, 2);
});
