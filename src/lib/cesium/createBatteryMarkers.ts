import type { Entity, Viewer } from "cesium";
import type { BatteryAsset } from "@/lib/grid/types";
import type { CesiumModule } from "./types";

export const GRID_ASSET_MARKER_PROPERTY = "isGridAssetMarker";
export const GRID_ASSET_ID_PROPERTY = "gridAssetId";

// Battery markers are simulated grid infrastructure, only relevant once a
// planner has zoomed into a city; they should never appear at world scale
// alongside the city markers.
const MARKER_MAX_DISTANCE = 400_000;
const MARKER_MIN_DISTANCE = 0;

export type CreateBatteryMarkersOptions = {
  Cesium: CesiumModule;
  viewer: Viewer;
  assets: BatteryAsset[];
};

export function createBatteryMarkers({
  Cesium,
  viewer,
  assets,
}: CreateBatteryMarkersOptions): Entity[] {
  const entities: Entity[] = [];

  for (const asset of assets) {
    const position = Cesium.Cartesian3.fromDegrees(
      asset.location.longitude,
      asset.location.latitude
    );

    const entity = viewer.entities.add({
      position,
      point: {
        pixelSize: 16,
        color: Cesium.Color.fromCssColorString("#6287FF"),
        outlineColor: Cesium.Color.fromCssColorString("#070A0F"),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          MARKER_MIN_DISTANCE,
          MARKER_MAX_DISTANCE
        ),
      },
      label: {
        text: `\u26A1 ${asset.name} (simulated)`,
        font: "600 13px system-ui, sans-serif",
        fillColor: Cesium.Color.fromCssColorString("#F5F7FA"),
        outlineColor: Cesium.Color.fromCssColorString("#070A0F"),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -26),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          MARKER_MIN_DISTANCE,
          MARKER_MAX_DISTANCE
        ),
      },
    });

    // Slow pulse to distinguish battery markers from static city markers.
    const basePixelSize = 16;
    entity.point!.pixelSize = new Cesium.CallbackProperty(() => {
      const seconds = Date.now() / 1000;
      return basePixelSize + Math.sin(seconds * 1.4) * 2;
    }, false);

    entity.addProperty(GRID_ASSET_MARKER_PROPERTY);
    entity.addProperty(GRID_ASSET_ID_PROPERTY);
    (entity as unknown as Record<string, unknown>)[
      GRID_ASSET_MARKER_PROPERTY
    ] = true;
    (entity as unknown as Record<string, unknown>)[GRID_ASSET_ID_PROPERTY] =
      asset.id;

    entities.push(entity);
  }

  return entities;
}

export function setBatteryMarkersVisible(
  entities: Entity[],
  visible: boolean
): void {
  for (const entity of entities) {
    entity.show = visible;
  }
}

export function getGridAssetIdFromEntity(entity: Entity): string | null {
  const value = (entity as unknown as Record<string, unknown>)[
    GRID_ASSET_ID_PROPERTY
  ];
  return typeof value === "string" ? value : null;
}

export function isGridAssetMarkerEntity(entity: Entity): boolean {
  return Boolean(
    (entity as unknown as Record<string, unknown>)[
      GRID_ASSET_MARKER_PROPERTY
    ]
  );
}
