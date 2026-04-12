import { NextResponse } from "next/server";

const HOME_LAT = 34.45116008900086;
const HOME_LON = -117.38823911447902;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface AircraftRaw {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number | string;
  gs?: number;
  track?: number;
  t?: string;
  r?: string;
  category?: string;
}

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

export async function GET() {
  try {
    const url = `https://api.adsb.lol/v2/lat/${HOME_LAT}/lon/${HOME_LON}/dist/200`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    const rawAircraft: AircraftRaw[] = data.ac || data.aircraft || [];
    const aircraft: Aircraft[] = [];

    const milPrefixes = [
      "RCH", "HOOK", "BRICK", "DRAGON", "SNAKE", "VADER", "SHADY", "COBRA",
      "VALOR", "SAM", "NOBLE", "REACH", "TABOR", "JAKE", "KING", "FANG",
      "MAFIA", "STING", "VIPER",
    ];

    const milTypes = [
      "F16", "F15", "F22", "F35", "A10", "C17", "C130", "C5", "B1", "B2",
      "B52", "E3", "E8", "KC135", "KC10", "P3", "P8", "V22", "C2", "E2",
      "F18", "C212", "CN35", "BE20", "C30J", "H53", "H60", "T6", "T38",
    ];

    for (const ac of rawAircraft) {
      if (!ac.lat || !ac.lon) continue;

      const dist = haversine(HOME_LAT, HOME_LON, ac.lat, ac.lon);
      const callsign = (ac.flight || "").trim();
      const hexId = (ac.hex || "").toUpperCase();

      let isMilitary = false;

      for (const prefix of milPrefixes) {
        if (callsign.startsWith(prefix)) {
          isMilitary = true;
          break;
        }
      }

      if (hexId.startsWith("AE") || hexId.startsWith("AF") || hexId.startsWith("B1") || hexId.startsWith("B2")) {
        isMilitary = true;
      }

      if (milTypes.includes(ac.t || "")) {
        isMilitary = true;
      }

      aircraft.push({
        hex: hexId,
        callsign,
        lat: ac.lat,
        lon: ac.lon,
        altitude: ac.alt_baro ?? ac.alt_geom ?? "N/A",
        speed: ac.gs ?? "N/A",
        heading: ac.track ?? "N/A",
        type: ac.t || "",
        registration: ac.r || "",
        distance: Math.round(dist * 10) / 10,
        isMilitary,
        category: ac.category || "",
      });
    }

    aircraft.sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      count: aircraft.length,
      militaryCount: aircraft.filter((a) => a.isMilitary).length,
      aircraft,
      center: { lat: HOME_LAT, lon: HOME_LON },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
