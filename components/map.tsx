import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  center: [number, number];
  zoom?: number;
  children?: React.ReactNode;
  className?: string;
}

interface MapContextType {
  map: maplibregl.Map | null;
}

const MapContext = React.createContext<MapContextType>({ map: null });

import React from "react";

export function Map({ center, zoom = 7, children, className }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto-dark",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: center,
      zoom: zoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMounted(true);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (map.current) {
      map.current.setCenter(center);
    }
  }, [center]);

  return (
    <div className={`relative ${className || ""}`}>
      <div ref={mapContainer} className="absolute inset-0" />
      <MapContext.Provider value={{ map: map.current }}>
        {mounted && children}
      </MapContext.Provider>
    </div>
  );
}

export function useMap() {
  return React.useContext(MapContext);
}

interface MarkerProps {
  position: [number, number];
  color?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function Marker({ position, color = "#ef4444", onClick }: MarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const el = document.createElement("div");
    el.className = "w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer";
    el.style.backgroundColor = color;

    markerRef.current = new maplibregl.Marker({
      element: el,
      anchor: "center",
    })
      .setLngLat(position)
      .addTo(map);

    if (onClick) {
      el.addEventListener("click", onClick);
    }

    return () => {
      markerRef.current?.remove();
    };
  }, [map, position[0], position[1]]);

  return null;
}

interface PopupProps {
  position: [number, number];
  children: React.ReactNode;
}

export function Popup({ position, children }: PopupProps) {
  const { map } = useMap();
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map) return;

    const container = document.createElement("div");
    container.className = "bg-card text-card-foreground p-3 rounded-lg shadow-lg border min-w-[200px]";

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    })
      .setLngLat(position)
      .setDOMContent(container)
      .addTo(map);

    return () => {
      popupRef.current?.remove();
    };
  }, [map, position[0], position[1]]);

  return null;
}
