"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, PieChart, Crosshair } from "lucide-react";
import styles from "./heatmap.module.css";
import { apiCall } from "@/api/client";
import { usePageTitle } from "@/app/hooks/usePageTitle";

interface HeatPoint {
  cctv_no: number;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
}

type RegionId =
  | "seoul"
  | "incheon"
  | "gyeonggi"
  | "gangwon"
  | "chungnam"
  | "daejeon"
  | "chungbuk"
  | "gyeongbuk"
  | "daegu"
  | "jeonbuk"
  | "gwangju"
  | "jeonnam"
  | "gyeongnam"
  | "ulsan"
  | "busan"
  | "jeju";

interface RegionMeta {
  id: RegionId;
  label: string;
  short: string;
  fill: string;
  labelLng: number;
  labelLat: number;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

type Position = [number, number];
type PolygonCoordinates = Position[][];

interface PolygonGeometry {
  type: "Polygon";
  coordinates: PolygonCoordinates;
}

interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: PolygonCoordinates[];
}

interface ProvinceFeature {
  type: "Feature";
  id: RegionId;
  properties: {
    id: RegionId;
    label: string;
    short: string;
  };
  geometry: PolygonGeometry | MultiPolygonGeometry;
}

interface ProvinceMapData {
  type: "FeatureCollection";
  features: ProvinceFeature[];
}

interface SigunguFeature {
  type: "Feature";
  properties: {
    name: string;
    code: string;
    region: RegionId;
  };
  geometry: PolygonGeometry | MultiPolygonGeometry;
}

interface SigunguMapData {
  type: "FeatureCollection";
  features: SigunguFeature[];
}

interface DrillFeature {
  name: string;
  code: string;
  paths: string[];
  labelX: number;
  labelY: number;
  bboxW: number;
  bboxH: number;
}

interface HeatmapApiResponse {
  success?: boolean;
  data?: {
    heatmap?: HeatPoint[];
  };
}

interface HeatmapClassBreakdown {
  class_no: number;
  class_name: string;
  display_name: string;
  count: number;
}

interface HeatmapClassItem {
  cctv_no: number;
  name: string;
  latitude: number;
  longitude: number;
  total: number;
  last_detected_at: string | null;
  classes: HeatmapClassBreakdown[];
}

interface HeatmapClassStatsResponse {
  success?: boolean;
  data?: {
    items?: HeatmapClassItem[];
  };
}

interface AggregatedClassStat {
  key: string;
  label: string;
  count: number;
}

interface Projection {
  minX: number;
  maxLat: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface ProjectedFeature {
  id: RegionId;
  label: string;
  short: string;
  paths: string[];
}

const MAP_WIDTH = 840;
const MAP_HEIGHT = 900;
const MAP_PADDING = 10;
const LONGITUDE_SCALE = 0.78;
const REGION_PAGE_SIZE = 5;
const CCTV_PAGE_SIZE = 5;
const CLASS_STATS_LIMIT = 4;
const LABEL_MIN_BBOX = 38;

function complementaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const h2 = (h + 0.5) % 1;
  const hue2rgb = (p: number, q: number, t: number) => {
    const tt = ((t % 1) + 1) % 1;
    if (tt < 1/6) return p + (q - p) * 6 * tt;
    if (tt < 1/2) return q;
    if (tt < 2/3) return p + (q - p) * (2/3 - tt) * 6;
    return p;
  };
  const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q2;
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(hue2rgb(p2, q2, h2 + 1/3))}${toHex(hue2rgb(p2, q2, h2))}${toHex(hue2rgb(p2, q2, h2 - 1/3))}`;
}

function buildDonutPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const x1 = cx + outerR * Math.cos(startAngle), y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle),   y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle),   y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle), y4 = cy + innerR * Math.sin(startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M${x1} ${y1} A${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4}Z`;
}

const FALLBACK_POINTS: HeatPoint[] = [
  { cctv_no: 9, name: "[경부선] 판교분기점", latitude: 37.3949, longitude: 127.1026, count: 0 },
  { cctv_no: 10, name: "[수도권제1순환선] 판교램프", latitude: 37.3998, longitude: 127.1002, count: 0 },
  { cctv_no: 3, name: "[수도권제1순환선] 판교분기점", latitude: 37.3941, longitude: 127.1092, count: 0 },
  { cctv_no: 11, name: "[용인서울선]서판교IC진입 서울", latitude: 37.3812, longitude: 127.0732, count: 0 },
  { cctv_no: 12, name: "[용인서울선] 서판교IC진출 용인", latitude: 37.3788, longitude: 127.0715, count: 0 },
  { cctv_no: 13, name: "[수도권제1순환선] 송파진입로", latitude: 37.5061, longitude: 127.1195, count: 0 },
  { cctv_no: 14, name: "[수도권제1순환선] 하남분기점", latitude: 37.5488, longitude: 127.2058, count: 0 },
  { cctv_no: 15, name: "[안양성남선] 동판교IC(본선)", latitude: 37.3922, longitude: 127.1174, count: 0 },
];

const REGIONS: RegionMeta[] = [
  { id: "seoul",    label: "서울",    short: "서울", fill: "#309e98", labelLng: 126.98, labelLat: 37.57, latMin: 37.42, latMax: 37.72, lngMin: 126.75, lngMax: 127.2 },
  { id: "incheon",  label: "인천",    short: "인천", fill: "#70cfc8", labelLng: 126.58, labelLat: 37.52, latMin: 37.05, latMax: 38.05, lngMin: 125.85, lngMax: 126.85 },
  { id: "gyeonggi", label: "경기도",  short: "경기", fill: "#55bfb8", labelLng: 127.18, labelLat: 37.32, latMin: 36.85, latMax: 38.35, lngMin: 126.55, lngMax: 127.85 },
  { id: "gangwon",  label: "강원도",  short: "강원", fill: "#72d6ce", labelLng: 128.35, labelLat: 37.62, latMin: 37.0,  latMax: 38.7,  lngMin: 127.6,  lngMax: 129.7 },
  { id: "chungnam", label: "충청남도", short: "충남", fill: "#4cb2ac", labelLng: 126.85, labelLat: 36.55, latMin: 35.9,  latMax: 37.15, lngMin: 125.75, lngMax: 127.35 },
  { id: "daejeon",  label: "대전",    short: "대전", fill: "#2e9892", labelLng: 127.39, labelLat: 36.35, latMin: 36.2,  latMax: 36.48, lngMin: 127.25, lngMax: 127.55 },
  { id: "chungbuk", label: "충청북도", short: "충북", fill: "#83d8d1", labelLng: 127.72, labelLat: 36.8,  latMin: 36.05, latMax: 37.35, lngMin: 127.25, lngMax: 128.7 },
  { id: "gyeongbuk",label: "경상북도", short: "경북", fill: "#68c8c1", labelLng: 128.72, labelLat: 36.35, latMin: 35.45, latMax: 37.25, lngMin: 127.75, lngMax: 130.15 },
  { id: "daegu",    label: "대구",    short: "대구", fill: "#2faaa3", labelLng: 128.6,  labelLat: 35.87, latMin: 35.75, latMax: 36.0,  lngMin: 128.45, lngMax: 128.75 },
  { id: "jeonbuk",  label: "전라북도", short: "전북", fill: "#5fc5bd", labelLng: 127.1,  labelLat: 35.72, latMin: 35.25, latMax: 36.25, lngMin: 126.05, lngMax: 127.85 },
  { id: "gwangju",  label: "광주",    short: "광주", fill: "#27918c", labelLng: 126.85, labelLat: 35.16, latMin: 35.05, latMax: 35.25, lngMin: 126.75, lngMax: 127.05 },
  { id: "jeonnam",  label: "전라남도", short: "전남", fill: "#79d4cc", labelLng: 126.75, labelLat: 34.78, latMin: 33.9,  latMax: 35.45, lngMin: 125.7,  lngMax: 127.65 },
  { id: "gyeongnam",label: "경상남도", short: "경남", fill: "#49b5af", labelLng: 128.15, labelLat: 35.25, latMin: 34.55, latMax: 35.7,  lngMin: 127.55, lngMax: 129.25 },
  { id: "ulsan",    label: "울산",    short: "울산", fill: "#6fd0c8", labelLng: 129.31, labelLat: 35.55, latMin: 35.4,  latMax: 35.75, lngMin: 129.05, lngMax: 129.45 },
  { id: "busan",    label: "부산",    short: "부산", fill: "#37a9a2", labelLng: 129.07, labelLat: 35.18, latMin: 35.0,  latMax: 35.3,  lngMin: 128.85, lngMax: 129.35 },
  { id: "jeju",     label: "제주도",  short: "제주", fill: "#8adcd5", labelLng: 126.53, labelLat: 33.38, latMin: 33.0,  latMax: 33.7,  lngMin: 125.95, lngMax: 127.1 },
];

const REGION_BY_ID = new Map<RegionId, RegionMeta>(REGIONS.map(r => [r.id, r]));
const METRO_REGIONS = new Set<RegionId>(["seoul", "busan", "daegu", "incheon", "gwangju", "daejeon", "ulsan"]);
const COMPACT_LABELS = new Set<RegionId>(["seoul", "incheon", "daejeon", "daegu", "gwangju", "ulsan", "busan"]);

const ADDRESS_KEYWORDS: [string, RegionId][] = [
  ["서울", "seoul"],
  ["인천", "incheon"],
  ["경기", "gyeonggi"],
  ["강원", "gangwon"],
  ["충청남도", "chungnam"], ["충남", "chungnam"],
  ["대전", "daejeon"],
  ["충청북도", "chungbuk"], ["충북", "chungbuk"],
  ["경상북도", "gyeongbuk"], ["경북", "gyeongbuk"],
  ["대구", "daegu"],
  ["전라북도", "jeonbuk"], ["전북", "jeonbuk"],
  ["광주", "gwangju"],
  ["전라남도", "jeonnam"], ["전남", "jeonnam"],
  ["경상남도", "gyeongnam"], ["경남", "gyeongnam"],
  ["울산", "ulsan"],
  ["부산", "busan"],
  ["제주", "jeju"],
];

function addressToRegion(address: string): RegionId | null {
  for (const [kw, id] of ADDRESS_KEYWORDS) {
    if (address.includes(kw)) return id;
  }
  return null;
}

function polygonsForGeometry(geometry: PolygonGeometry | MultiPolygonGeometry): PolygonCoordinates[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function walkCoordinates(geometry: PolygonGeometry | MultiPolygonGeometry, callback: (position: Position) => void) {
  for (const polygon of polygonsForGeometry(geometry)) {
    for (const ring of polygon) {
      for (const position of ring) callback(position);
    }
  }
}

function createProjection(data: ProvinceMapData): Projection {
  let minX = Infinity, maxX = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feature of data.features) {
    walkCoordinates(feature.geometry, ([lng, lat]) => {
      const x = lng * LONGITUDE_SCALE;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    });
  }
  const geoWidth = maxX - minX, geoHeight = maxLat - minLat;
  const scale = Math.min((MAP_WIDTH - MAP_PADDING * 2) / geoWidth, (MAP_HEIGHT - MAP_PADDING * 2) / geoHeight);
  return { minX, maxLat, scale, offsetX: (MAP_WIDTH - geoWidth * scale) / 2, offsetY: (MAP_HEIGHT - geoHeight * scale) / 2 };
}

function projectCoordinate([lng, lat]: Position, projection: Projection) {
  return {
    x: projection.offsetX + (lng * LONGITUDE_SCALE - projection.minX) * projection.scale,
    y: projection.offsetY + (projection.maxLat - lat) * projection.scale,
  };
}

function ringToPath(ring: Position[], projection: Projection) {
  return `${ring.map((pos, i) => {
    const p = projectCoordinate(pos, projection);
    return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ")} Z`;
}

function geometryToPaths(geometry: PolygonGeometry | MultiPolygonGeometry, projection: Projection) {
  return polygonsForGeometry(geometry).map(polygon => polygon.map(ring => ringToPath(ring, projection)).join(" "));
}

function geometryCentroid(geometry: PolygonGeometry | MultiPolygonGeometry): Position {
  const polys = polygonsForGeometry(geometry);
  let bestRing: Position[] = [], bestLen = 0;
  for (const poly of polys) {
    const ring = poly[0] ?? [];
    if (ring.length > bestLen) { bestRing = ring; bestLen = ring.length; }
  }
  if (!bestRing.length) return [0, 0];
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of bestRing) { sumLng += lng; sumLat += lat; }
  return [sumLng / bestRing.length, sumLat / bestRing.length];
}

function classifyCoordinate(latitude: number, longitude: number): RegionId | null {
  for (const region of REGIONS) {
    if (latitude >= region.latMin && latitude <= region.latMax && longitude >= region.lngMin && longitude <= region.lngMax) {
      return region.id;
    }
  }
  return null;
}

function classifyPoint(point: Pick<HeatPoint, "latitude" | "longitude">): RegionId | null {
  return classifyCoordinate(point.latitude, point.longitude);
}

function regionCount(points: HeatPoint[], id: RegionId): number {
  return points.reduce((sum, point) => classifyPoint(point) === id ? sum + (Number(point.count) || 0) : sum, 0);
}

function regionPoints(points: HeatPoint[], id: RegionId): HeatPoint[] {
  return points.filter(point => classifyPoint(point) === id);
}

export default function HeatmapPage() {
  usePageTitle("히트맵");
  const [points, setPoints] = useState<HeatPoint[]>(FALLBACK_POINTS);
  const [classItems, setClassItems] = useState<HeatmapClassItem[]>([]);
  const [mapData, setMapData] = useState<ProvinceMapData | null>(null);
  const [mapError, setMapError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [rankPage, setRankPage] = useState(1);
  const [selectedCctvPage, setSelectedCctvPage] = useState(1);
  const [usingFallback, setUsingFallback] = useState(true);
  const [drillRegion, setDrillRegion] = useState<RegionId | null>(null);
  const [sigunguData, setSigunguData] = useState<SigunguMapData | null>(null);
  const [mapAnimKey, setMapAnimKey] = useState(0);
  const [userAddress, setUserAddress] = useState("");
  const [userRegion, setUserRegion] = useState<RegionId | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<DrillFeature | null>(null);
  const [sigunguCctvPage, setSigunguCctvPage] = useState(1);
  const [viewMode, setViewMode] = useState<"map" | "chart">("map");

  // CCTV 감지 내역 모달
  const [cctvModal, setCctvModal] = useState<{
    cctv_no: number; name: string;
    detections: Array<{ class_name: string; confidence: number; detected_at: string; status: string; image_path: string }>;
    loading: boolean;
  } | null>(null);
  const [cctvModalPage, setCctvModalPage] = useState(1);
  const [expandedCctvGroups, setExpandedCctvGroups] = useState<Record<string, boolean>>({});

  async function openCctvDetail(cctv_no: number, name: string) {
    setCctvModalPage(1);
    setExpandedCctvGroups({});
    setCctvModal({ cctv_no, name, detections: [], loading: true });
    try {
      const first: any = await apiCall(`/cctv/detections?cctv_no=${cctv_no}&per_page=100&page=1`);
      const firstItems = first?.success ? (first.data?.items ?? []) : [];
      const pageCount = Number(first?.data?.pages) || 1;
      const remaining = pageCount > 1
        ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) =>
            apiCall(`/cctv/detections?cctv_no=${cctv_no}&per_page=100&page=${i + 2}`) as Promise<any>
          ))
        : [];
      const items = [
        ...firstItems,
        ...remaining.flatMap(res => res?.success ? (res.data?.items ?? []) : []),
      ];
      setCctvModal({ cctv_no, name, loading: false, detections: items.map((d: any) => ({
        class_name: d.class_name ?? "알 수 없음",
        confidence: d.confidence ?? 0,
        detected_at: d.detected_at ?? "",
        status: d.status ?? "UNREAD",
        image_path: d.image_path ?? "",
      })) });
    } catch {
      setCctvModal({ cctv_no, name, detections: [], loading: false });
    }
  }

  function fetchData() {
    setLoading(true);
    setNotice("");
    const heatmapRequest = (apiCall("/cctv/stats/heatmap", { signal: AbortSignal.timeout(5000) }) as Promise<HeatmapApiResponse>)
      .then(resp => {
        const heatmap = resp?.data?.heatmap ?? [];
        if (resp?.success && heatmap.length > 0) {
          setPoints(heatmap);
          setUsingFallback(false);
        } else {
          setPoints(FALLBACK_POINTS);
          setUsingFallback(true);
          setNotice("감지 위치 데이터가 없어 주요 CCTV 위치를 기준으로 표시합니다.");
        }
      })
      .catch(() => {
        setPoints(FALLBACK_POINTS);
        setUsingFallback(true);
        setNotice("실시간 통계 API 연결 대기 중입니다. 주요 CCTV 위치를 기준으로 표시합니다.");
      });
    const classStatsRequest = (apiCall("/cctv/stats/heatmap/classes", { signal: AbortSignal.timeout(5000) }) as Promise<HeatmapClassStatsResponse>)
      .then(resp => { setClassItems(resp?.data?.items ?? []); })
      .catch(() => { setClassItems([]); });
    Promise.allSettled([heatmapRequest, classStatsRequest]).finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/maps/korea-provinces.geo.json")
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<ProvinceMapData>; })
      .then(data => { if (!cancelled) { setMapData(data); setMapError(false); } })
      .catch(() => { if (!cancelled) setMapError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/maps/korea-sigungu.geo.json")
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<SigunguMapData>; })
      .then(data => { if (!cancelled) setSigunguData(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw) as { address?: string };
      const addr = user?.address ?? "";
      if (!addr) return;
      setUserAddress(addr);
      const matched = addressToRegion(addr);
      if (matched) {
        setUserRegion(matched);
        setDrillRegion(matched);
        setSelected(matched);
        setMapAnimKey(k => k + 1);
      }
    } catch {}
  }, []);

  const projection = useMemo(() => mapData ? createProjection(mapData) : null, [mapData]);

  const projectedFeatures = useMemo<ProjectedFeature[]>(() => {
    if (!mapData || !projection) return [];
    const regionOrder = new Map(REGIONS.map((r, i) => [r.id, i]));
    return mapData.features
      .map(f => ({ id: f.properties.id, label: f.properties.label, short: f.properties.short, paths: geometryToPaths(f.geometry, projection) }))
      .sort((a, b) => (regionOrder.get(a.id) ?? 0) - (regionOrder.get(b.id) ?? 0));
  }, [mapData, projection]);

  const drillFeatures = useMemo<SigunguFeature[]>(() => {
    if (!drillRegion || !sigunguData) return [];
    const isMetro = METRO_REGIONS.has(drillRegion);
    return sigunguData.features.filter(f => {
      if (f.properties.region !== drillRegion) return false;
      if (!isMetro && f.properties.name.endsWith("구")) return false;
      return true;
    });
  }, [drillRegion, sigunguData]);

  const drillProjection = useMemo<Projection | null>(() => {
    if (!drillFeatures.length) return null;
    let minX = Infinity, maxX = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const feature of drillFeatures) {
      walkCoordinates(feature.geometry, ([lng, lat]) => {
        const x = lng * LONGITUDE_SCALE;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      });
    }
    const geoW = maxX - minX, geoH = maxLat - minLat;
    const scale = Math.min((MAP_WIDTH - MAP_PADDING * 2) / geoW, (MAP_HEIGHT - MAP_PADDING * 2) / geoH);
    return { minX, maxLat, scale, offsetX: (MAP_WIDTH - geoW * scale) / 2, offsetY: (MAP_HEIGHT - geoH * scale) / 2 };
  }, [drillFeatures]);

  const drillProjectedFeatures = useMemo<DrillFeature[]>(() => {
    if (!drillProjection) return [];
    return drillFeatures.map(f => {
      const [lng, lat] = geometryCentroid(f.geometry);
      const { x, y } = projectCoordinate([lng, lat], drillProjection);
      let minSvgX = Infinity, maxSvgX = -Infinity, minSvgY = Infinity, maxSvgY = -Infinity;
      walkCoordinates(f.geometry, pos => {
        const { x: px, y: py } = projectCoordinate(pos, drillProjection);
        if (px < minSvgX) minSvgX = px; if (px > maxSvgX) maxSvgX = px;
        if (py < minSvgY) minSvgY = py; if (py > maxSvgY) maxSvgY = py;
      });
      return {
        name: f.properties.name,
        code: f.properties.code,
        paths: geometryToPaths(f.geometry, drillProjection),
        labelX: x,
        labelY: y,
        bboxW: maxSvgX - minSvgX,
        bboxH: maxSvgY - minSvgY,
      };
    });
  }, [drillFeatures, drillProjection]);

  const userSigunguCode = useMemo<string | null>(() => {
    if (!userAddress || !drillRegion || drillRegion !== userRegion) return null;
    for (const f of drillFeatures) {
      if (userAddress.includes(f.properties.name)) return f.properties.code;
    }
    return null;
  }, [userAddress, drillRegion, userRegion, drillFeatures]);

  const totals = useMemo(() => {
    return new Map<RegionId, number>(REGIONS.map(r => [r.id, regionCount(points, r.id)]));
  }, [points]);

  const pointMarkers = useMemo(() => {
    if (!projection) return [];
    return points
      .map(point => {
        const m = projectCoordinate([point.longitude, point.latitude], projection);
        const count = Number(point.count) || 0;
        return { ...point, x: m.x, y: m.y, radius: count > 0 ? Math.min(18, 6 + Math.sqrt(count) * 3) : 4, active: count > 0 };
      })
      .filter(p => p.x >= 0 && p.x <= MAP_WIDTH && p.y >= 0 && p.y <= MAP_HEIGHT);
  }, [points, projection]);

  const maxTotal = Math.max(...Array.from(totals.values()), 1);
  const totalCount = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
  const selectedRegion = selected ? REGION_BY_ID.get(selected) ?? null : null;
  const selectedRegionId = selectedRegion?.id ?? null;
  const selectedPoints = selected ? regionPoints(points, selected).sort((a, b) => b.count - a.count) : [];
  const rankedRegions = [...REGIONS]
    .map(r => ({ ...r, count: totals.get(r.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const regionPageCount = Math.max(1, Math.ceil(rankedRegions.length / REGION_PAGE_SIZE));
  const currentRankPage = Math.min(rankPage, regionPageCount);
  const pagedRankedRegions = rankedRegions.slice((currentRankPage - 1) * REGION_PAGE_SIZE, currentRankPage * REGION_PAGE_SIZE);

  const selectedCctvPageCount = Math.max(1, Math.ceil(selectedPoints.length / CCTV_PAGE_SIZE));
  const currentSelectedCctvPage = Math.min(selectedCctvPage, selectedCctvPageCount);
  const pagedSelectedPoints = selectedPoints.slice((currentSelectedCctvPage - 1) * CCTV_PAGE_SIZE, currentSelectedCctvPage * CCTV_PAGE_SIZE);

  const activeRegionCount = rankedRegions.filter(r => r.count > 0).length;
  const topRegion = rankedRegions[0] ?? null;
  const topPoint = [...points].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))[0] ?? null;
  const selectedTotal = selectedRegion ? (totals.get(selectedRegion.id) ?? 0) : totalCount;
  const activeSelectedPoints = selectedPoints.filter(p => (Number(p.count) || 0) > 0);
  const topSelectedPoint = selectedPoints[0] ?? null;
  const selectedShare = selectedRegion && totalCount > 0 ? Math.round((selectedTotal / totalCount) * 100) : 0;

  const classStats = useMemo<AggregatedClassStat[]>(() => {
    const agg = new Map<string, AggregatedClassStat>();
    for (const item of classItems) {
      const itemRegion = classifyCoordinate(Number(item.latitude), Number(item.longitude));
      if (selectedRegionId && itemRegion !== selectedRegionId) continue;
      for (const ci of item.classes ?? []) {
        const count = Number(ci.count) || 0;
        if (count <= 0) continue;
        const key = String(ci.class_no ?? ci.class_name ?? ci.display_name);
        const cur = agg.get(key);
        const label = ci.display_name || ci.class_name || "미분류";
        if (cur) { cur.count += count; } else { agg.set(key, { key, label, count }); }
      }
    }
    return [...agg.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [classItems, selectedRegionId]);

  const visibleClassStats = classStats.slice(0, CLASS_STATS_LIMIT);
  const classTotal = classStats.reduce((sum, s) => sum + s.count, 0);
  const classStatsMax = Math.max(...visibleClassStats.map(s => s.count), 1);

  const drillPointMarkers = useMemo(() => {
    if (!drillProjection || !drillRegion) return [];
    return selectedPoints
      .map(point => {
        const { x, y } = projectCoordinate([point.longitude, point.latitude], drillProjection);
        const count = Number(point.count) || 0;
        return { ...point, x, y, radius: count > 0 ? Math.min(18, 6 + Math.sqrt(count) * 3) : 4, active: count > 0 };
      })
      .filter(p => p.x >= 0 && p.x <= MAP_WIDTH && p.y >= 0 && p.y <= MAP_HEIGHT);
  }, [selectedPoints, drillProjection, drillRegion]);

  const sigunguPoints = useMemo(() => {
    if (!selectedSigungu) return drillPointMarkers;
    const { labelX, labelY, bboxW, bboxH } = selectedSigungu;
    const pad = 10;
    return drillPointMarkers.filter(p =>
      p.x >= labelX - bboxW / 2 - pad && p.x <= labelX + bboxW / 2 + pad &&
      p.y >= labelY - bboxH / 2 - pad && p.y <= labelY + bboxH / 2 + pad
    );
  }, [selectedSigungu, drillPointMarkers]);

  const sigunguTotal = sigunguPoints.reduce((s, p) => s + (Number(p.count) || 0), 0);
  const sigunguCctvPageCount = Math.max(1, Math.ceil(sigunguPoints.length / CCTV_PAGE_SIZE));
  const currentSigunguCctvPage = Math.min(sigunguCctvPage, sigunguCctvPageCount);
  const pagedSigunguPoints = sigunguPoints.slice((currentSigunguCctvPage - 1) * CCTV_PAGE_SIZE, currentSigunguCctvPage * CCTV_PAGE_SIZE);

  // 시군구별 감지 수 (히트 오버레이용)
  const sigunguCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const feature of drillProjectedFeatures) {
      const { labelX, labelY, bboxW, bboxH, code } = feature;
      const pad = 12;
      const cnt = drillPointMarkers
        .filter(p => p.x >= labelX - bboxW/2 - pad && p.x <= labelX + bboxW/2 + pad &&
                     p.y >= labelY - bboxH/2 - pad && p.y <= labelY + bboxH/2 + pad)
        .reduce((s, p) => s + (Number(p.count) || 0), 0);
      counts.set(code, cnt);
    }
    return counts;
  }, [drillProjectedFeatures, drillPointMarkers]);

  const drillMaxCount = useMemo(() => Math.max(...Array.from(sigunguCounts.values()), 1), [sigunguCounts]);

  // 퍼센트 기반 색상: 높을수록 진한 빨강(#9f1239), 낮을수록 연한 핑크(#ffd0cd)
  function pctToColor(pct: number, maxPct: number): string {
    const t = maxPct > 0 ? Math.min(pct / maxPct, 1) : 0;
    const r = Math.round(0xff + (0x9f - 0xff) * t);
    const g = Math.round(0xd0 + (0x12 - 0xd0) * t);
    const b = Math.round(0xcd + (0x39 - 0xcd) * t);
    return `rgb(${r},${g},${b})`;
  }
  const pieChartData = useMemo(() => {
    let raw: Array<{ label: string; value: number; actionId: string; actionType: "region" | "sigungu" }>;

    if (drillRegion && drillProjectedFeatures.length > 0) {
      const sgEntries: [string, number][] = [];
      sigunguCounts.forEach((cnt: number, code: string) => { if (cnt > 0) sgEntries.push([code, cnt]); });
      sgEntries.sort((a, b) => b[1] - a[1]);
      raw = sgEntries.slice(0, 12).map(([code, cnt]) => {
        const feat = drillProjectedFeatures.find((f: DrillFeature) => f.code === code);
        return { label: feat?.name ?? code, value: cnt, actionId: code, actionType: "sigungu" as const };
      });
    } else if (drillRegion) {
      raw = [];
    } else {
      raw = rankedRegions.filter(r => r.count > 0).map(r => ({
        label: r.short, value: r.count, actionId: r.id, actionType: "region" as const,
      }));
    }

    const total = raw.reduce((s, d) => s + d.value, 0);
    if (total === 0) return { slices: [], total: 0, loading: drillRegion ? drillProjectedFeatures.length === 0 : false };

    // 퍼센트 계산 후 그라데이션 색상 배정
    const withPct = raw.map(d => ({ ...d, pct: Math.round((d.value / total) * 100) }));
    const maxPct = Math.max(...withPct.map(d => d.pct), 1);

    const CX = 160, CY = 160, OR = 130, IR = 65;
    let angle = -Math.PI / 2;
    const slices = withPct.map(d => {
      const sweep = (d.value / total) * 2 * Math.PI;
      const start = angle;
      angle += sweep;
      const mid = start + sweep / 2;
      return {
        label: d.label, value: d.value, color: pctToColor(d.pct, maxPct),
        actionId: d.actionId, actionType: d.actionType, pct: d.pct,
        path: buildDonutPath(CX, CY, OR, IR, start, start + sweep),
        lx: CX + (OR + 18) * Math.cos(mid),
        ly: CY + (OR + 18) * Math.sin(mid),
      };
    });
    return { slices, total, loading: false };
  }, [drillRegion, drillProjectedFeatures, sigunguCounts, rankedRegions]);

  const userDrillFeature = useMemo<DrillFeature | null>(() => {
    if (!userSigunguCode) return null;
    return drillProjectedFeatures.find(f => f.code === userSigunguCode) ?? null;
  }, [userSigunguCode, drillProjectedFeatures]);

  function handleProvinceClick(id: RegionId) {
    setDrillRegion(id);
    setSelected(id);
    setSelectedCctvPage(1);
    setSelectedSigungu(null);
    setSigunguCctvPage(1);
    setMapAnimKey((k: number) => k + 1);
  }

  function handleDrillBack() {
    setDrillRegion(null);
    setSelected(null);
    setSelectedSigungu(null);
    setSigunguCctvPage(1);
    setMapAnimKey((k: number) => k + 1);
  }

  function handleSigunguClick(feature: DrillFeature) {
    setSelectedSigungu(prev => prev?.code === feature.code ? null : feature);
    setSigunguCctvPage(1);
  }

  function handlePieSliceClick(actionId: string, actionType: "region" | "sigungu") {
    if (actionType === "region") {
      // 전국 차트 → 해당 도의 시군 분석 차트로 드릴다운 (차트 모드 유지)
      setDrillRegion(actionId as RegionId);
      setSelected(actionId as RegionId);
      setSelectedCctvPage(1);
      setSelectedSigungu(null);
      setSigunguCctvPage(1);
      setMapAnimKey((k: number) => k + 1);
    }
    // sigungu 슬라이스 클릭 시 아무 동작 없음 (지도 이동 제거)
  }

  function handleProvinceKey(event: KeyboardEvent<SVGGElement>, id: RegionId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleProvinceClick(id);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>위험 구간 지도</h2>
          <p>전국 시·도별 감지 현황을 지도에서 확인합니다.</p>
        </div>
        <button
          type="button"
          className={`${styles.chartToggleBtn}${viewMode === "chart" ? ` ${styles.active}` : ""}`}
          onClick={() => setViewMode(v => v === "map" ? "chart" : "map")}
          title={viewMode === "map" ? "차트로 보기" : "지도로 보기"}
        >
          <Crosshair size={15} />
          {viewMode === "map" ? "차트 분석" : "지도 보기"}
        </button>
      </div>

      {notice && <div className={styles.noticeBox}>{notice}</div>}

      <div className={styles.body}>
        <section className={styles.mapSection} aria-label="전국 시도별 위험 지도">

          {viewMode === "chart" && (
            <div key={drillRegion ?? "national"} className={`${styles.pieChartCanvas} ${styles.pieAnimateIn}`} style={{ position: "relative" }}>
              {/* 시군 차트일 때만 mapBackIcon 스타일로 전국 차트 뒤로가기 */}
              {drillRegion && (
                <button
                  type="button"
                  className={styles.mapBackIcon}
                  onClick={() => { setDrillRegion(null); setSelected(null); setSelectedSigungu(null); setMapAnimKey((k: number) => k + 1); }}
                  aria-label="전국 차트로 돌아가기"
                  title="전국 차트로 돌아가기"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className={styles.pieChartTitle}>
                <span>
                  {drillRegion
                    ? `${REGION_BY_ID.get(drillRegion)?.label} 시·군 감지 현황`
                    : "전국 지역별 감지 현황 · 클릭하면 시·군 분석"}
                </span>
              </div>
              <svg viewBox="0 0 320 320" className={styles.pieChartSvg}>
                {pieChartData.slices.length === 0 ? (
                  <text x="160" y="160" textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#94a3b8">
                    {pieChartData.loading ? "시·군 데이터 로딩 중..." : "감지 데이터 없음"}
                  </text>
                ) : pieChartData.slices.map((sl, i) => (
                  <g
                    key={i}
                    className={styles.pieSlice}
                    onClick={() => handlePieSliceClick(sl.actionId, sl.actionType)}
                    style={{ cursor: sl.actionType === "region" ? "pointer" : "default", outline: "none" }}
                  >
                    <path d={sl.path} fill={sl.color} />
                    {sl.pct >= 5 && (
                      <text x={sl.lx} y={sl.ly} textAnchor="middle" dominantBaseline="middle"
                        fontSize="11" fontWeight="700" fill="#0f172a"
                        stroke="rgba(255,255,255,0.9)" strokeWidth="3" paintOrder="stroke">
                        {sl.pct}%
                      </text>
                    )}
                    <title>{sl.label} · {sl.value.toLocaleString()}건 ({sl.pct}%){sl.actionType === "region" ? " — 클릭하여 시·군 분석" : ""}</title>
                  </g>
                ))}
                {pieChartData.total > 0 && (
                  <>
                    <text x="160" y="150" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="800" fill="#0f172a">{pieChartData.total.toLocaleString()}</text>
                    <text x="160" y="172" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#64748b">건 감지</text>
                  </>
                )}
              </svg>
              <div className={styles.pieLegend}>
                {pieChartData.slices.map((sl, i) => (
                  <div
                    key={i}
                    className={styles.pieLegendItem}
                    onClick={sl.actionType === "region" ? () => handlePieSliceClick(sl.actionId, sl.actionType) : undefined}
                    style={{ cursor: sl.actionType === "region" ? "pointer" : "default" }}
                  >
                    <span className={styles.pieLegendDot} style={{ background: sl.color }} />
                    {sl.label}
                    <span style={{ marginLeft: 4, color: "#94a3b8", fontSize: 11 }}>{sl.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viewMode === "map" && (
          <div className={styles.mapCanvas}>
            {drillRegion && (
              <>
                <button type="button" className={styles.mapBackIcon} onClick={handleDrillBack} aria-label="전국 지도로 돌아가기">
                  <ChevronLeft size={18} />
                </button>
                <div className={styles.mapRegionBadge}>
                  {REGION_BY_ID.get(drillRegion)?.label}{selectedSigungu ? ` › ${selectedSigungu.name}` : ""}
                </div>
              </>
            )}
            {drillRegion ? (
              drillProjectedFeatures.length > 0 && drillProjection ? (
                <svg
                  key={mapAnimKey}
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  preserveAspectRatio="xMidYMid meet"
                  className={`${styles.koreaMap} ${styles.mapAnimateIn}`}
                  role="img"
                  aria-label={`${REGION_BY_ID.get(drillRegion)?.label ?? ""} 시군구 지도`}
                >
                  <defs>
                    <radialGradient id="heatPoint" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef1746" stopOpacity="0.9" />
                      <stop offset="65%" stopColor="#ef1746" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#ef1746" stopOpacity="0.05" />
                    </radialGradient>
                  </defs>

                  {/* 시군구 경계 */}
                  <g className={styles.regionLayer}>
                    {drillProjectedFeatures.map((feature) => {
                      const isSelected = selectedSigungu?.code === feature.code;
                      const featureCount = sigunguCounts.get(feature.code) ?? 0;
                      const heatIntensity = featureCount > 0 ? 0.14 + (featureCount / drillMaxCount) * 0.42 : 0;
                      return (
                        <g
                          key={feature.code}
                          className={styles.sigunguGroup}
                          onClick={() => handleSigunguClick(feature)}
                          role="button"
                          tabIndex={0}
                          aria-label={feature.name}
                          style={{ outline: "none" }}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleSigunguClick(feature); }}
                        >
                          {feature.paths.map((path, pi) => (
                            <path
                              key={`drill-${feature.code}-${pi}`}
                              d={path}
                              className={isSelected ? styles.sigunguSelected : styles.provincePath}
                              style={isSelected ? { fill: "#ff8e99" } : { fill: "#ffd0cd" }}
                              fillRule="evenodd"
                            />
                          ))}
                          {/* 감지 밀도 오버레이 — 국가지도와 동일한 스타일 */}
                          {!isSelected && heatIntensity > 0 && feature.paths.map((path, pi) => (
                            <path
                              key={`drill-heat-${feature.code}-${pi}`}
                              d={path}
                              className={styles.heatOverlay}
                              style={{ opacity: heatIntensity }}
                              fillRule="evenodd"
                            />
                          ))}
                        </g>
                      );
                    })}
                  </g>

                  {/* 유저 지역 강조 테두리 */}
                  {userDrillFeature && (
                    <g>
                      {userDrillFeature.paths.map((path, pi) => (
                        <path
                          key={`user-hl-${pi}`}
                          d={path}
                          className={styles.userHighlightPath}
                          fillRule="evenodd"
                        />
                      ))}
                    </g>
                  )}


                  {/* 시군구 이름 + 감지 건수 라벨 */}
                  <g className={styles.labelLayer}>
                    {drillProjectedFeatures.map(feature => {
                      if (feature.bboxW < LABEL_MIN_BBOX && feature.bboxH < LABEL_MIN_BBOX) return null;
                      const count = sigunguCounts.get(feature.code) ?? 0;
                      const hasCount = count > 0;
                      // 건수가 있으면 이름을 위로 올리고 건수를 아래에 표시
                      const nameY  = hasCount ? feature.labelY - 13 : feature.labelY;
                      const countY = feature.labelY + 16;
                      return (
                        <g key={`lbl-${feature.code}`}>
                          {/* 지역 이름 */}
                          <text
                            x={feature.labelX}
                            y={nameY}
                            className={styles.sigunguLabel}
                          >
                            {feature.name}
                          </text>
                          {/* 감지 건수 배지 */}
                          {hasCount && (
                            <text
                              x={feature.labelX}
                              y={countY}
                              className={styles.sigunguCountLabel}
                            >
                              {count}건
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* 유저 위치 핀 */}
                  {userDrillFeature && (
                    <g>
                      <circle
                        cx={userDrillFeature.labelX}
                        cy={userDrillFeature.labelY - Math.max(userDrillFeature.bboxH * 0.22, 18)}
                        r={9}
                        className={styles.userPinDot}
                      />
                      <circle
                        cx={userDrillFeature.labelX}
                        cy={userDrillFeature.labelY - Math.max(userDrillFeature.bboxH * 0.22, 18)}
                        r={9}
                        className={styles.userPinRing}
                      />
                      <text
                        x={userDrillFeature.labelX}
                        y={userDrillFeature.labelY - Math.max(userDrillFeature.bboxH * 0.22, 18) + 16}
                        className={styles.userPinLabel}
                      >
                        내 지역
                      </text>
                    </g>
                  )}
                </svg>
              ) : (
                <div className={styles.mapFallback}>
                  {sigunguData ? "선택한 지역의 시군구 데이터를 로드 중입니다." : "시군구 지도를 불러오는 중입니다."}
                </div>
              )
            ) : (
              projectedFeatures.length > 0 && projection ? (
                <svg
                  key={mapAnimKey}
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  preserveAspectRatio="xMidYMid meet"
                  className={`${styles.koreaMap} ${styles.mapAnimateIn}`}
                  role="img"
                  aria-label="대한민국 시도별 위험 지도"
                >
                  <defs>
                    <radialGradient id="heatPoint" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef1746" stopOpacity="0.9" />
                      <stop offset="65%" stopColor="#ef1746" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#ef1746" stopOpacity="0.05" />
                    </radialGradient>
                  </defs>

                  <g className={styles.regionLayer}>
                    {projectedFeatures.map(feature => {
                      const count = totals.get(feature.id) ?? 0;
                      const intensity = count > 0 ? 0.16 + (count / maxTotal) * 0.4 : 0;
                      const isSelected = selected === feature.id;
                      return (
                        <g
                          key={feature.id}
                          className={`${styles.provinceGroup} ${isSelected ? styles.activeRegion : ""}`}
                          onClick={() => handleProvinceClick(feature.id)}
                          onKeyDown={event => handleProvinceKey(event, feature.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`${feature.label} ${count}건`}
                        >
                          <title>{`${feature.label} ${count.toLocaleString()}건`}</title>
                          {feature.paths.map((path, index) => (
                            <path key={`base-${feature.id}-${index}`} d={path} className={styles.provincePath} style={{ fill: "#ffd0cd" }} fillRule="evenodd" />
                          ))}
                          {count > 0 && feature.paths.map((path, index) => (
                            <path key={`heat-${feature.id}-${index}`} d={path} className={styles.heatOverlay} style={{ opacity: intensity }} fillRule="evenodd" />
                          ))}
                          {isSelected && (
                            <g className={styles.activeOutlineLayer}>
                              {feature.paths.map((path, index) => (
                                <path key={`selected-${feature.id}-${index}`} d={path} className={styles.activeOutline} fillRule="evenodd" />
                              ))}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* 감지 기록 열점 (count > 0인 CCTV만) */}

                  <g className={styles.labelLayer}>
                    {REGIONS.map(region => {
                      const count = totals.get(region.id) ?? 0;
                      const labelPosition = projectCoordinate([region.labelLng, region.labelLat], projection);
                      return (
                        <g key={region.id} className={styles.mapLabelGroup}>
                          <text x={labelPosition.x} y={labelPosition.y} className={`${styles.regionLabel} ${selected === region.id ? styles.selectedRegionLabel : ""} ${COMPACT_LABELS.has(region.id) ? styles.compactRegionLabel : ""}`}>
                            {region.short}
                          </text>
                          {count > 0 && (
                            <text x={labelPosition.x} y={labelPosition.y + 16} className={styles.regionCount}>
                              {count.toLocaleString()}건
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {/* 독도 — 투영 범위 밖이므로 SVG 고정 좌표로 표시 */}
                    <g key="dokdo">
                      <circle cx={800} cy={310} r={6} fill="#ffd0cd" stroke="#0f172a" strokeWidth={1.5} />
                      <circle cx={803} cy={316} r={4} fill="#ffd0cd" stroke="#0f172a" strokeWidth={1.5} />
                      <text x={801} y={300} className={styles.dokdoLabel}>독도</text>
                    </g>
                  </g>
                </svg>
              ) : (
                <div className={styles.mapFallback}>
                  {mapError ? "지도 경계 데이터를 불러오지 못했습니다." : "지도 데이터를 불러오는 중입니다."}
                </div>
              )
            )}
          </div>
          )}

          {viewMode === "map" && (
            <div className={styles.legend}>
              <span className={styles.legendItem}><span className={styles.dot} style={{ background: "#ffd0cd" }} />시·도 경계</span>
              <span className={styles.legendItem}><span className={styles.dot} style={{ background: "#ff8e99" }} />선택 지역</span>
              <span className={styles.legendItem}><span className={styles.dot} style={{ background: "#ef1746" }} />CCTV 위치</span>
              {userDrillFeature && (
                <span className={styles.legendItem}><span className={styles.dot} style={{ background: "#ff8e99" }} />내 지역</span>
              )}
            </div>
          )}
        </section>

        <aside className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <div className={styles.detailKicker}>
                {selectedSigungu ? "시·군·구 감지 통계" : selectedRegion ? "지역 감지 통계" : "전국 감지 통계"}
              </div>
              <h2>{selectedSigungu ? selectedSigungu.name : selectedRegion ? selectedRegion.label : "전체 현황"}</h2>
            </div>
            <MapPin size={18} />
          </div>

          <div className={styles.statSummary}>
            <div className={styles.statHero}>
              <span>{selectedSigungu ? "해당 시·군·구 총 감지" : selectedRegion ? "선택 지역 총 감지" : "전체 감지 합계"}</span>
              <strong>{selectedSigungu ? sigunguTotal.toLocaleString() : selectedTotal.toLocaleString()}건</strong>
              <em>
                {selectedSigungu
                  ? `${sigunguPoints.length.toLocaleString()}개 CCTV 집계`
                  : selectedRegion
                    ? `${selectedPoints.length.toLocaleString()}개 CCTV 중 ${activeSelectedPoints.length.toLocaleString()}개 감지`
                    : `${activeRegionCount.toLocaleString()}개 권역에서 감지 집계`}
              </em>
            </div>

            <div className={styles.statMiniGrid}>
              {!selectedRegion && !selectedSigungu && (
                <>
                  <div className={styles.statMiniFull}>
                    <span>최다 감지 지역</span>
                    <strong>{topRegion ? `${topRegion.label} · ${topRegion.count.toLocaleString()}건` : "-"}</strong>
                  </div>
                  <div className={styles.statMiniFull}>
                    <span>최다 감지 CCTV</span>
                    <strong>{topPoint ? `${topPoint.name} · ${(Number(topPoint.count)||0).toLocaleString()}건` : "-"}</strong>
                  </div>
                </>
              )}
              {(selectedRegion || selectedSigungu) && (
                <div className={styles.statMiniFull}>
                  <span>최다 감지 CCTV</span>
                  <strong>
                    {selectedSigungu
                      ? (sigunguPoints[0] ? `${sigunguPoints[0].name} · ${(Number(sigunguPoints[0].count)||0).toLocaleString()}건` : "-")
                      : (topSelectedPoint ? `${topSelectedPoint.name} · ${(Number(topSelectedPoint.count)||0).toLocaleString()}건` : "-")}
                  </strong>
                </div>
              )}
            </div>
          </div>

          <div className={styles.rankHeaderRow}>
            <div className={styles.rankHeader}>
              {selectedSigungu ? "CCTV별 감지 TOP" : selectedRegion ? "CCTV별 감지 TOP" : "지역별 감지 TOP"}
            </div>
            <div className={styles.rankMeta}>
              {selectedSigungu
                ? `${sigunguPoints.length.toLocaleString()}개 CCTV`
                : selectedRegion
                  ? `${selectedPoints.length.toLocaleString()}개 CCTV`
                  : `${rankedRegions.length.toLocaleString()}개 권역`}
            </div>
          </div>

          <div className={styles.cctvList}>
            {selectedSigungu ? (
              sigunguPoints.length === 0 ? (
                <div className={styles.emptyList}>해당 시·군·구에 표시할 CCTV가 없습니다.</div>
              ) : pagedSigunguPoints.map((point, index) => {
                const width = sigunguTotal > 0 ? Math.max(6, ((Number(point.count)||0) / sigunguTotal) * 100) : 0;
                const rank = (currentSigunguCctvPage - 1) * CCTV_PAGE_SIZE + index + 1;
                return (
                  <button key={point.cctv_no} className={styles.cctvItem} onClick={() => openCctvDetail(point.cctv_no, point.name)}>
                    <span className={styles.cctvRank}>{rank}</span>
                    <span className={styles.cctvInfo}>
                      <span className={styles.cctvName}>{point.name}</span>
                      <span className={styles.cctvBar}><span style={{ width: `${width}%` }} /></span>
                    </span>
                    <span className={styles.cctvCount}>{(Number(point.count)||0).toLocaleString()}건</span>
                  </button>
                );
              }).concat(
                Array.from({ length: Math.max(0, CCTV_PAGE_SIZE - pagedSigunguPoints.length) }, (_, i) => (
                  <div key={`sg-empty-${i}`} className={styles.cctvItemPlaceholder} aria-hidden="true" />
                ))
              )
            ) : selectedRegion ? (
              selectedPoints.length === 0 ? (
                <div className={styles.emptyList}>해당 권역에 표시할 CCTV가 없습니다.</div>
              ) : pagedSelectedPoints.map((point, index) => {
                const width = maxTotal > 0 ? Math.max(6, (point.count / maxTotal) * 100) : 0;
                const rank = (currentSelectedCctvPage - 1) * CCTV_PAGE_SIZE + index + 1;
                return (
                  <button key={point.cctv_no} className={styles.cctvItem} onClick={() => openCctvDetail(point.cctv_no, point.name)}>
                    <span className={styles.cctvRank}>{rank}</span>
                    <span className={styles.cctvInfo}>
                      <span className={styles.cctvName}>{point.name}</span>
                      <span className={styles.cctvBar}><span style={{ width: `${width}%` }} /></span>
                    </span>
                    <span className={styles.cctvCount}>{point.count.toLocaleString()}건</span>
                  </button>
                );
              }).concat(
                Array.from({ length: Math.max(0, CCTV_PAGE_SIZE - pagedSelectedPoints.length) }, (_, i) => (
                  <div key={`sel-empty-${i}`} className={styles.cctvItemPlaceholder} aria-hidden="true" />
                ))
              )
            ) : pagedRankedRegions.map((region, index) => {
              const width = maxTotal > 0 ? Math.max(region.count > 0 ? 6 : 0, (region.count / maxTotal) * 100) : 0;
              const rank = (currentRankPage - 1) * REGION_PAGE_SIZE + index + 1;
              return (
                <button key={region.id} type="button" className={styles.cctvItem} onClick={() => handleProvinceClick(region.id)}>
                  <span className={styles.cctvRank}>{rank}</span>
                  <span className={styles.cctvInfo}>
                    <span className={styles.cctvName}>{region.label}</span>
                    <span className={styles.cctvBar}><span style={{ width: `${width}%` }} /></span>
                  </span>
                  <span className={styles.cctvCount}>{region.count.toLocaleString()}건</span>
                </button>
              );
            }).concat(
              Array.from({ length: Math.max(0, REGION_PAGE_SIZE - pagedRankedRegions.length) }, (_, i) => (
                <div key={`reg-empty-${i}`} className={styles.cctvItemPlaceholder} aria-hidden="true" />
              ))
            )}
          </div>

          {selectedSigungu ? (
            <div className={styles.paginationBar} aria-label="시군구 CCTV 페이지">
              <button type="button" className={styles.pageButton} onClick={() => setSigunguCctvPage(p => Math.max(1, p - 1))} disabled={currentSigunguCctvPage <= 1} title="이전 페이지" aria-label="이전 페이지">
                <ChevronLeft size={14} />
              </button>
              <span className={styles.pageIndicator}>{currentSigunguCctvPage} / {sigunguCctvPageCount}</span>
              <button type="button" className={styles.pageButton} onClick={() => setSigunguCctvPage(p => Math.min(sigunguCctvPageCount, p + 1))} disabled={currentSigunguCctvPage >= sigunguCctvPageCount} title="다음 페이지" aria-label="다음 페이지">
                <ChevronRight size={14} />
              </button>
            </div>
          ) : selectedRegion ? (
            <div className={styles.paginationBar} aria-label="CCTV별 감지 TOP 페이지">
              <button type="button" className={styles.pageButton} onClick={() => setSelectedCctvPage(p => Math.max(1, p - 1))} disabled={currentSelectedCctvPage <= 1} title="이전 페이지" aria-label="이전 페이지">
                <ChevronLeft size={14} />
              </button>
              <span className={styles.pageIndicator}>{currentSelectedCctvPage} / {selectedCctvPageCount}</span>
              <button type="button" className={styles.pageButton} onClick={() => setSelectedCctvPage(p => Math.min(selectedCctvPageCount, p + 1))} disabled={currentSelectedCctvPage >= selectedCctvPageCount} title="다음 페이지" aria-label="다음 페이지">
                <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div className={styles.paginationBar} aria-label="지역별 감지 TOP 페이지">
              <button type="button" className={styles.pageButton} onClick={() => setRankPage(p => Math.max(1, p - 1))} disabled={currentRankPage <= 1} title="이전 페이지" aria-label="이전 페이지">
                <ChevronLeft size={14} />
              </button>
              <span className={styles.pageIndicator}>{currentRankPage} / {regionPageCount}</span>
              <button type="button" className={styles.pageButton} onClick={() => setRankPage(p => Math.min(regionPageCount, p + 1))} disabled={currentRankPage >= regionPageCount} title="다음 페이지" aria-label="다음 페이지">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* CCTV 감지 내역 모달 */}
      {cctvModal && (() => {
        const groupedDetections = Object.entries(
          cctvModal.detections.reduce<Record<string, typeof cctvModal.detections>>((groups, detection) => {
            (groups[detection.class_name] ??= []).push(detection);
            return groups;
          }, {})
        )
          .map(([className, detections]) => ({
            className,
            detections: [...detections].sort((a, b) => b.detected_at.localeCompare(a.detected_at)),
          }))
          .sort((a, b) => (b.detections[0]?.detected_at ?? "").localeCompare(a.detections[0]?.detected_at ?? ""));
        const duplicateCount = groupedDetections.reduce((sum, group) => sum + Math.max(0, group.detections.length - 1), 0);
        const modalPageSize = 3;
        const modalPageCount = Math.max(1, Math.ceil(groupedDetections.length / modalPageSize));
        const currentModalPage = Math.min(cctvModalPage, modalPageCount);
        const modalPageStart = (currentModalPage - 1) * modalPageSize;
        const visibleGroups = groupedDetections.slice(modalPageStart, modalPageStart + modalPageSize);
        const statusLabel: Record<string, string> = { CONFIRMED: "확인", DISMISSED: "반려", UNREAD: "미처리" };
        const statusTone: Record<string, { bg: string; color: string }> = {
          CONFIRMED: { bg: "#ecfdf5", color: "#15803d" },
          DISMISSED: { bg: "#fff1f2", color: "#be123c" },
          UNREAD: { bg: "#f1f5f9", color: "#64748b" },
        };
        const formatDate = (value: string) => value
          ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
          : "—";
        const formatTime = (value: string) => value
          ? new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
          : "—";
        const formatDetectedAt = (value: string) => value
          ? `${formatDate(value)} ${formatTime(value)}`
          : "—";

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.68)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setCctvModal(null)}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 20, width: "min(96vw,880px)", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(15,23,42,0.32)", animation: "slideUp 0.2s ease" }}
              onClick={e => e.stopPropagation()}>

              <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ display: "inline-flex", alignItems: "center", marginBottom: 5, borderRadius: 999, background: "#fff1f2", padding: "3px 8px", color: "#be123c", fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }}>
                      CCTV DETAIL
                    </div>
                    <div style={{ color: "var(--text)", fontSize: 17, fontWeight: 900 }}>{cctvModal.name}</div>
                    <div style={{ marginTop: 3, color: "var(--text-muted)", fontSize: 11 }}>
                      동일 객체의 반복 포착 이력을 날짜별로 묶어서 확인합니다.
                    </div>
                  </div>
                  <button onClick={() => setCctvModal(null)} aria-label="닫기"
                    style={{ width: 34, height: 34, border: "1px solid var(--border-color)", borderRadius: "50%", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-muted)", fontSize: 17, lineHeight: 1 }}>✕</button>
                </div>

                {!cctvModal.loading && cctvModal.detections.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginTop: 10 }}>
                    {[
                      ["전체 감지 이력", `${cctvModal.detections.length}건`, "누적 저장 기록"],
                      ["포착 객체 유형", `${groupedDetections.length}종`, "객체별 그룹 보기"],
                      ["추가 포착", `${duplicateCount}건`, "최초 포착 이후 반복"],
                    ].map(([label, value, desc], index) => (
                      <div key={label} style={{ border: `1px solid ${index === 2 && duplicateCount > 0 ? "#fecaca" : "var(--border-color)"}`, borderRadius: 12, background: index === 2 && duplicateCount > 0 ? "#fff7f7" : "#f8fafc", padding: "7px 10px" }}>
                        <div style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>{label}</div>
                        <div style={{ marginTop: 3, color: index === 2 && duplicateCount > 0 ? "#be123c" : "var(--text)", fontSize: 17, fontWeight: 900 }}>{value}</div>
                        <div style={{ marginTop: 2, color: "var(--text-muted)", fontSize: 10 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ overflowY: "auto", flex: 1, background: "#f8fafc", padding: 10 }}>
                {cctvModal.loading ? (
                  <div style={{ padding: 42, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>감지 이력을 불러오는 중입니다.</div>
                ) : cctvModal.detections.length === 0 ? (
                  <div style={{ padding: 42, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>이 CCTV의 감지 기록이 없습니다.</div>
                ) : (
                  <div style={{ display: "grid", gap: 7 }}>
                    {visibleGroups.map(({ className, detections }, i) => {
                      const latest = detections[0]?.detected_at ?? "";
                      const repeated = detections.length > 1;
                      const expanded = expandedCctvGroups[className] ?? false;
                      const visibleHistories = expanded ? detections : detections.slice(0, 3);
                      const hiddenHistoryCount = Math.max(0, detections.length - visibleHistories.length);
                      return (
                        <section key={className} style={{ border: `1px solid ${repeated ? "#fecaca" : "var(--border-color)"}`, borderRadius: 14, background: "var(--bg-card)", overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderBottom: "1px solid var(--border-color)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <span style={{ width: 22, height: 22, borderRadius: 8, background: repeated ? "#e11d48" : "#cbd5e1", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                                {modalPageStart + i + 1}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 900 }}>{className}</div>
                                <div style={{ marginTop: 2, color: "var(--text-muted)", fontSize: 11 }}>최근 포착 {formatDetectedAt(latest)}</div>
                              </div>
                            </div>
                            <span style={{ borderRadius: 999, background: repeated ? "#fff1f2" : "#f1f5f9", padding: "3px 8px", color: repeated ? "#be123c" : "#64748b", fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                              {repeated ? `반복 ${detections.length}회` : "1회 포착"}
                            </span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(164px, 1fr))", gap: 5, padding: 7 }}>
                            {visibleHistories.map((d, badgeIndex) => {
                              const tone = statusTone[d.status] ?? statusTone.UNREAD;
                              return (
                                <div key={`${d.detected_at}-${badgeIndex}`} style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: "6px 7px" }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                                    <span style={{ color: "#475569", fontSize: 11, fontWeight: 800 }}>{formatDate(d.detected_at)}</span>
                                    <span style={{ borderRadius: 999, background: tone.bg, padding: "2px 6px", color: tone.color, fontSize: 10, fontWeight: 800 }}>{statusLabel[d.status] ?? d.status}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                                    <strong style={{ color: "#0f172a", fontSize: 14 }}>{formatTime(d.detected_at)}</strong>
                                    <span style={{ color: "#be123c", fontSize: 11, fontWeight: 900 }}>AI {(d.confidence * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {detections.length > 3 && (
                            <div style={{ display: "flex", justifyContent: "center", padding: "0 7px 7px" }}>
                              <button type="button" onClick={() => setExpandedCctvGroups(groups => ({ ...groups, [className]: !expanded }))}
                                style={{ border: "1px solid #fecaca", borderRadius: 999, background: expanded ? "#fff" : "#fff1f2", padding: "4px 10px", color: "#be123c", cursor: "pointer", fontSize: 11, fontWeight: 900 }}>
                                {expanded ? "포착 이력 접기" : `나머지 ${hiddenHistoryCount}건 더보기`}
                              </button>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>

              {!cctvModal.loading && groupedDetections.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 14px", borderTop: "1px solid var(--border-color)", background: "var(--bg-card)", flexShrink: 0 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                    객체 {modalPageStart + 1}–{Math.min(modalPageStart + modalPageSize, groupedDetections.length)} / {groupedDetections.length}개
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <button type="button" className={styles.pageButton} onClick={() => setCctvModalPage(page => Math.max(1, page - 1))} disabled={currentModalPage <= 1} title="이전 페이지" aria-label="이전 페이지">
                      <ChevronLeft size={14} />
                    </button>
                    <span className={styles.pageIndicator}>{currentModalPage} / {modalPageCount}</span>
                    <button type="button" className={styles.pageButton} onClick={() => setCctvModalPage(page => Math.min(modalPageCount, page + 1))} disabled={currentModalPage >= modalPageCount} title="다음 페이지" aria-label="다음 페이지">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
