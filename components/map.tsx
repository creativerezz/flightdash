import React, { useEffect, useRef, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
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

const MapContext = createContext<MapContextType>({ map: null });

export function Map({ center, zoom = 7, children, className }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Mirror the map instance into state so context consumers re-render
  // when the map is ready. Reading `mapRef.current` during render would
  // violate the react-hooks/refs rule and produce stale context values.
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [mounted, setMounted] = useState(false);

  // Keep the latest center/zoom in refs so the init effect doesn't need
  // them as dependencies (initialization must run exactly once).
  const initialCenter = useRef(center);
  const initialZoom = useRef(zoom);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
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
      center: initialCenter.current,
      zoom: initialZoom.current,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      setMounted(true);
    });

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(center);
    }
  }, [center]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Handle resize when container becomes visible
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      mapRef.current?.resize();
    };

    window.addEventListener("resize", handleResize);

    const container = mapContainer.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => mapRef.current?.resize(), 100);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (container) {
      observer.observe(container);
    }

    // Initial resize after mount
    const t = setTimeout(() => mapRef.current?.resize(), 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      clearTimeout(t);
    };
  }, [mounted]);

  return (
    <div className={`relative w-full h-full ${className || ""}`}>
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      <MapContext.Provider value={{ map: mapInstance }}>
        {mounted && children}
      </MapContext.Provider>
    </div>
  );
}

export function useMap() {
  return useContext(MapContext);
}

interface MarkerProps {
  position: [number, number];
  color?: string;
  rotation?: number;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function Marker({ position, color = "#ef4444", rotation = 0, onClick }: MarkerProps) {
  const { map } = useMap();
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const svgRef = useRef<SVGElement | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const [lng, lat] = position;

  // Create the marker once per map instance. Position/rotation/color are
  // updated imperatively below so interpolation ticks don't churn markers.
  useEffect(() => {
    if (!map) return;

    const el = document.createElement("div");
    el.className = "cursor-pointer";
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.9));transition:transform 300ms linear,color 200ms linear;">
        <path d="M12 2L13 9L22 13V15L13 13L13 19L16 21V22L12 21L8 22V21L11 19L11 13L2 15V13L11 9Z"/>
      </svg>
    `;
    svgRef.current = el.querySelector("svg");

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      onClickRef.current?.();
    };
    el.addEventListener("click", handleClick);

    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);
    markerRef.current = marker;

    return () => {
      el.removeEventListener("click", handleClick);
      marker.remove();
      markerRef.current = null;
      svgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.style.color = color;
    svg.style.transform = `rotate(${rotation}deg)`;
  }, [color, rotation]);

  return null;
}

interface PopupProps {
  position: [number, number];
  children: React.ReactNode;
}

export function Popup({ position, children }: PopupProps) {
  const { map } = useMap();
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [lng, lat] = position;

  // Create the DOM container once, lazily. This component is only
  // rendered inside <Map>'s `mounted && children` branch, so it never
  // runs during SSR — `document` is always available here.
  const [container] = useState<HTMLDivElement>(() => {
    const el = document.createElement("div");
    el.className =
      "bg-card text-card-foreground p-3 rounded-lg shadow-lg border min-w-[200px]";
    return el;
  });

  useEffect(() => {
    if (!map) return;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    })
      .setLngLat([lng, lat])
      .setDOMContent(container)
      .addTo(map);

    popupRef.current = popup;

    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, [map, lng, lat, container]);

  return createPortal(children, container);
}
