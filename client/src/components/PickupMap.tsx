/**
 * PickupMap — Google Maps view for the Pickup Info section
 *
 * Shows:
 *   • Red star pins for the two pickup store locations
 *   • Semi-transparent red circles (5 km radius) for each delivery zone
 *   • Info windows on pin click with store name + address
 */
import { useRef, useCallback } from "react";
import { MapView } from "@/components/Map";

// ── Data ─────────────────────────────────────────────────────────────────────

const PICKUP_LOCATIONS = [
  {
    name: "BQ Direct",
    address: "126 Fairbank Rd, Clayton South VIC 3169",
    // Pre-geocoded coordinates
    lat: -37.9538,
    lng: 145.1208,
  },
  {
    name: "Mitchells Quality Meat",
    address: "Cranbourne Park Shopping Centre, Cranbourne VIC 3977",
    lat: -38.1027,
    lng: 145.2833,
  },
];

const DELIVERY_ZONES: { suburb: string; price: number; lat: number; lng: number }[] = [
  { suburb: "Clayton",       price: 5,  lat: -37.9200, lng: 145.1200 },
  { suburb: "Cranbourne",    price: 5,  lat: -38.1027, lng: 145.2833 },
  { suburb: "Berwick",       price: 10, lat: -38.0333, lng: 145.3500 },
  { suburb: "Frankston",     price: 10, lat: -38.1455, lng: 145.1262 },
  { suburb: "Dandenong",     price: 10, lat: -37.9870, lng: 145.2150 },
  { suburb: "Glen Waverley", price: 10, lat: -37.8800, lng: 145.1630 },
  { suburb: "Cheltenham",    price: 10, lat: -37.9530, lng: 145.0530 },
  { suburb: "Brighton",      price: 10, lat: -37.9050, lng: 144.9940 },
  { suburb: "Pakenham",      price: 15, lat: -38.0710, lng: 145.4870 },
  { suburb: "Tooradin",      price: 15, lat: -38.2220, lng: 145.3820 },
  { suburb: "Mornington",    price: 15, lat: -38.2180, lng: 145.0370 },
  { suburb: "Ringwood",      price: 15, lat: -37.8160, lng: 145.2290 },
  { suburb: "Mooroolbark",   price: 15, lat: -37.7820, lng: 145.3040 },
  { suburb: "Doncaster",     price: 15, lat: -37.7880, lng: 145.1260 },
  { suburb: "Melbourne CBD", price: 15, lat: -37.8136, lng: 144.9631 },
  { suburb: "Upwey",         price: 15, lat: -37.9000, lng: 145.3190 },
  { suburb: "Dromana",       price: 20, lat: -38.3370, lng: 145.1380 },
];

// Colour per price tier
const ZONE_COLOURS: Record<number, string> = {
  5:  "#c73e3a",
  10: "#e07b39",
  15: "#d4a017",
  20: "#7b5ea7",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PickupMap() {
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    // Shared InfoWindow
    infoWindowRef.current = new google.maps.InfoWindow();

    // ── Delivery zone circles ────────────────────────────────────────────────
    DELIVERY_ZONES.forEach((zone) => {
      const colour = ZONE_COLOURS[zone.price] ?? "#c73e3a";
      new google.maps.Circle({
        map,
        center: { lat: zone.lat, lng: zone.lng },
        radius: 5000, // 5 km
        strokeColor: colour,
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        fillColor: colour,
        fillOpacity: 0.08,
        clickable: false,
      });

      // Zone label marker (text only)
      const labelEl = document.createElement("div");
      labelEl.style.cssText = `
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        color: ${colour};
        background: rgba(10,10,10,0.75);
        padding: 2px 5px;
        border-radius: 2px;
        white-space: nowrap;
        pointer-events: none;
      `;
      labelEl.textContent = `${zone.suburb} $${zone.price}`;

      new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: zone.lat, lng: zone.lng },
        content: labelEl,
        title: `${zone.suburb} — $${zone.price} delivery`,
      });
    });

    // ── Pickup location pins ─────────────────────────────────────────────────
    PICKUP_LOCATIONS.forEach((loc) => {
      // Custom red pin element
      const pinEl = document.createElement("div");
      pinEl.style.cssText = `
        width: 32px;
        height: 32px;
        background: #c73e3a;
        border: 2px solid #f5f2ec;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      `;
      const inner = document.createElement("div");
      inner.style.cssText = `
        width: 10px;
        height: 10px;
        background: #f5f2ec;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      `;
      pinEl.appendChild(inner);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: loc.lat, lng: loc.lng },
        content: pinEl,
        title: loc.name,
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(`
          <div style="font-family:'Inter Tight',sans-serif;padding:4px 2px;min-width:160px">
            <p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#0a0a0a">${loc.name}</p>
            <p style="font-size:12px;color:#555;margin:0">${loc.address}</p>
          </div>
        `);
        infoWindowRef.current.open({ map, anchor: marker });
      });
    });

    // Fit map to show all markers
    const bounds = new google.maps.LatLngBounds();
    PICKUP_LOCATIONS.forEach((l) => bounds.extend({ lat: l.lat, lng: l.lng }));
    DELIVERY_ZONES.forEach((z) => bounds.extend({ lat: z.lat, lng: z.lng }));
    map.fitBounds(bounds, 40);
  }, []);

  return (
    <div className="w-full flex flex-col gap-3">
      <MapView
        className="h-[420px] border border-white/10"
        initialCenter={{ lat: -38.0, lng: 145.15 }}
        initialZoom={10}
        onMapReady={handleMapReady}
      />
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
        {Object.entries(ZONE_COLOURS).map(([price, colour]) => (
          <div key={price} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full border border-white/20"
              style={{ background: colour }}
            />
            <span className="font-mono-brand text-[11px] text-[#8a857c]">
              ${price} delivery
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-[#c73e3a] border border-[#f5f2ec]/60" />
          <span className="font-mono-brand text-[11px] text-[#8a857c]">Pickup store</span>
        </div>
      </div>
    </div>
  );
}
