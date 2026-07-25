// BeamMP map paths and metadata
// These are the canonical map paths used inside ServerConfig.toml's Map field.

export interface MapOption {
  value: string;
  label: string;
  description: string;
}

export const COMMON_MAPS: MapOption[] = [
  {
    value: "/levels/gridmap_v2/info.json",
    label: "Gridmap v2",
    description: "Default testing map. Flat, open, great for freeroam and stunts.",
  },
  {
    value: "/levels/west_coast_usa/info.json",
    label: "West Coast USA",
    description: "Large open-world map with highways, towns, and twisty mountain roads.",
  },
  {
    value: "/levels/italy/info.json",
    label: "Italy",
    description: "Coastal Mediterranean map with tight village streets and scenic roads.",
  },
  {
    value: "/levels/jungle_rock_island/info.json",
    label: "Jungle Rock Island",
    description: "Tropical island with dirt roads and off-road terrain.",
  },
  {
    value: "/levels/industrial/info.json",
    label: "Industrial",
    description: "Compact industrial site with warehouses and ramps.",
  },
  {
    value: "/levels/small_island/info.json",
    label: "Small Island",
    description: "Tiny island, perfect for small lobbies and contact derbies.",
  },
  {
    value: "/levels/driver_training/info.json",
    label: "Driver Training",
    description: "Driving school layout with cones, gates, and skill zones.",
  },
  {
    value: "/levels/hirochi_raceway/info.json",
    label: "Hirochi Raceway",
    description: "Purpose-built race circuit, ideal for timed events.",
  },
  {
    value: "/levels/farcity/info.json",
    label: "Far City",
    description: "Dense urban city grid with multi-lane avenues.",
  },
];

export function findMapByValue(value: string): MapOption | undefined {
  return COMMON_MAPS.find((m) => m.value === value);
}
