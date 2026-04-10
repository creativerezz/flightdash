"use client";

import { useEffect, useState, useCallback } from "react";
import { Map, Marker, useMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Aircraft {
  hex: string;
  callsign: string;
  lat: number;
  lon: number;
  altitude: number | string;
  speed: number | string;
  heading: number | string;
  type: string;
  registration: string;
  distance: number;
  isMilitary: boolean;
  category: string;
}

interface AircraftData {
  count: number;
  militaryCount: number;
  aircraft: Aircraft[];
  center: { lat: number; lon: number };
}

function FlyToButton({ lat, lon, onClick }: { lat: number; lon: number; onClick?: () => void }) {
  const { map } = useMap();
  return (
    <button
      onClick={() => {
        map?.flyTo({ center: [lon, lat], zoom: 12 });
        onClick?.();
      }}
      className="text-xs text-muted-foreground hover:text-primary transition-colors"
    >
      Fly to
    </button>
  );
}

export default function Page() {
  const [data, setData] = useState<AircraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [militaryOnly, setMilitaryOnly] = useState(false);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/aircraft");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to fetch aircraft:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const displayedAircraft = militaryOnly
    ? data?.aircraft.filter((a) => a.isMilitary) || []
    : data?.aircraft || [];

  const center: [number, number] = data
    ? [data.center.lon, data.center.lat]
    : [-117.388, 34.451];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Mobile Tab Toggle */}
      <div className="lg:hidden flex border-b bg-card shrink-0">
        <button
          onClick={() => setMobileView("list")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            mobileView === "list" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          )}
        >
          List ({displayedAircraft.length})
        </button>
        <button
          onClick={() => setMobileView("map")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            mobileView === "map" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
          )}
        >
          Map
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden lg:flex-row">
        {/* Sidebar / List View */}
        <div
          className={cn(
            "flex flex-col bg-card lg:w-[380px] lg:border-r lg:flex shrink-0",
            "w-full absolute lg:relative z-10",
            mobileView === "list" ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Header */}
          <div className="p-4 border-b shrink-0">
            <h1 className="text-lg font-semibold">🛩️ FlightDash</h1>
            <p className="text-xs text-muted-foreground mt-1">
              200-mile radius • Victorville, CA
            </p>
            {data && (
              <div className="flex gap-4 mt-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-medium">{data.count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Military:</span>{" "}
                  <span className="font-medium text-amber-500">
                    {data.militaryCount}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-3">
              <Button
                variant={militaryOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setMilitaryOnly(!militaryOnly)}
              >
                {militaryOnly ? "Showing Military" : "Show Military Only"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {loading ? "Updating..." : `Updated ${lastUpdated.toLocaleTimeString()}`}
              </span>
            </div>
          </div>

          {/* Aircraft List */}
          <div className="flex-1 overflow-auto">
            {displayedAircraft.map((ac) => (
              <div
                key={ac.hex}
                onClick={() => {
                  setSelectedHex(ac.hex);
                  setMobileView("map");
                }}
                className={cn(
                  "p-3 border-b cursor-pointer transition-colors",
                  selectedHex === ac.hex ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium truncate">
                        {ac.callsign || "N/A"}
                      </span>
                      {ac.isMilitary && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">
                          MIL
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                      <span>{ac.type || "Unknown"}</span>
                      <span>•</span>
                      <span>{ac.distance} mi</span>
                      <span>•</span>
                      <span>{ac.altitude !== "N/A" ? `${ac.altitude} ft` : "N/A"}</span>
                    </div>
                  </div>
                  <FlyToButton 
                    lat={ac.lat} 
                    lon={ac.lon} 
                    onClick={() => setMobileView("map")}
                  />
                </div>
              </div>
            ))}
            {displayedAircraft.length === 0 && !loading && (
              <div className="p-8 text-center text-muted-foreground">
                {militaryOnly ? "No military aircraft in range" : "No aircraft in range"}
              </div>
            )}
          </div>
        </div>

        {/* Map View */}
        <div className="flex-1 relative lg:flex w-full h-full">
          {/* On mobile, use key to force Map re-mount when tab changes - ensures proper dimensions */}
          <div 
            key={`map-${mobileView}`}
            className={cn(
              "absolute inset-0 lg:static lg:inset-auto",
              mobileView === "map" ? "block" : "hidden lg:block"
            )}
          >
            <Map center={center} zoom={8} className="w-full h-full">
              {displayedAircraft.map((ac) => (
                <Marker
                  key={ac.hex}
                  position={[ac.lon, ac.lat]}
                  color={ac.isMilitary ? "#f59e0b" : "#ef4444"}
                  onClick={() => setSelectedHex(ac.hex)}
                />
              ))}
            </Map>
          </div>

          {/* Selected Aircraft Panel */}
          {selectedHex && (
            <div className="absolute top-4 right-4 left-4 lg:left-auto bg-card border rounded-lg p-4 shadow-lg lg:min-w-[250px] max-w-sm z-20">
              {(() => {
                const ac = data?.aircraft.find((a) => a.hex === selectedHex);
                if (!ac) return null;
                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-mono font-semibold">
                        {ac.callsign || "N/A"}
                      </h3>
                      {ac.isMilitary && (
                        <span className="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded">
                          MILITARY
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hex</span>
                        <span className="font-mono">{ac.hex}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span>{ac.type || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Registration</span>
                        <span>{ac.registration || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distance</span>
                        <span>{ac.distance} mi</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Altitude</span>
                        <span>{ac.altitude !== "N/A" ? `${ac.altitude} ft` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Speed</span>
                        <span>{ac.speed !== "N/A" ? `${ac.speed} kts` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Heading</span>
                        <span>{ac.heading !== "N/A" ? `${ac.heading}°` : "N/A"}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full mt-3"
                      onClick={() => setSelectedHex(null)}
                    >
                      Close
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
