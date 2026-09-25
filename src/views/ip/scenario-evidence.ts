export const EVIDENCE_TTL = 5 * 60_000;
export const AIM_VERSION = "@cloudflare/speedtest@1.13.0";
export type EvidenceState =
  | "unmeasured"
  | "running"
  | "complete"
  | "partial"
  | "failed"
  | "rate-limited"
  | "unverifiable"
  | "mismatch"
  | "expired"
  | "cancelled";
export type HttpSample = {
  elapsedMs: number;
  outcome: "readable" | "opaque" | "refused" | "rate-limited" | "unknown";
  status?: number;
  error?: "timeout" | "network";
  observedIp?: string;
};
export type QualityMetrics = {
  latency?: number;
  jitter?: number;
  download?: number;
  upload?: number;
  downLoadedLatency?: number;
  upLoadedLatency?: number;
  packetLoss?: number;
};
export type Evidence = {
  kind: "http" | "quality" | "inbound";
  queriedIp: string;
  target: string;
  source: string;
  direction: "browser-outbound" | "probe-inbound";
  protocol: string;
  addressFamily: "IPv4" | "IPv6" | "unknown";
  startedAt: number;
  checkedAt: number;
  expiresAt: number;
  state: EvidenceState;
  egressBefore?: string;
  egressAfter?: string;
  routeChanged?: boolean;
  samples: HttpSample[];
  metrics?: QualityMetrics;
  raw?: {
    latency: number[];
    downLoaded: number[];
    upLoaded: number[];
    download: number[];
    upload: number[];
    packetsSent?: number;
    packetsLost?: number[];
  };
  aimScores?: Record<
    string,
    { classificationIdx: number; classificationName: string; points: number }
  >;
  ruleVersion?: string;
  incomplete?: boolean;
};

export const ACCESS_VERSION = "http-access-v1";
export function averageAccessRating(
  evidence: (Evidence | undefined)[],
  ip: string,
  now = Date.now(),
) {
  const ratings = evidence
    .map((value) => accessRating(value, ip, now).stars)
    .filter((stars): stars is number => stars !== null);
  return {
    average:
      ratings.length >= Math.max(3, Math.ceil(evidence.length * 0.6))
        ? Math.round(
            (ratings.reduce((sum, stars) => sum + stars, 0) / ratings.length) *
              10,
          ) / 10
        : null,
    rated: ratings.length,
    total: evidence.length,
    required: Math.max(3, Math.ceil(evidence.length * 0.6)),
  };
}
export function accessRating(
  evidence: Evidence | undefined,
  ip: string,
  now = Date.now(),
) {
  const samples = evidence?.samples ?? [];
  const successful = samples.filter(
    (sample) =>
      ["readable", "opaque"].includes(sample.outcome) &&
      Number.isFinite(sample.elapsedMs) &&
      sample.elapsedMs >= 0,
  );
  const times = successful
    .map((sample) => sample.elapsedMs)
    .sort((a, b) => a - b);
  const median = times.length
    ? Math.round(
        (times[Math.floor((times.length - 1) / 2)] +
          times[Math.floor(times.length / 2)]) /
          2,
      )
    : null;
  const stale = !!evidence && now >= evidence.expiresAt;
  const mismatch =
    !!evidence &&
    (evidence.routeChanged ||
      [evidence.egressBefore, evidence.egressAfter].some(
        (exit) => exit && !sameIp(exit, ip),
      ));
  const attributed =
    !!evidence &&
    !mismatch &&
    sameIp(evidence.egressBefore, ip) &&
    sameIp(evidence.egressAfter, ip) &&
    successful.length >= 2 &&
    successful.every((sample) => sameIp(sample.observedIp, ip));
  const blocked =
    !evidence ||
    evidence.kind !== "http" ||
    evidence.direction !== "browser-outbound" ||
    evidence.ruleVersion !== ACCESS_VERSION ||
    !sameIp(evidence.queriedIp, ip) ||
    stale ||
    ["cancelled", "failed", "rate-limited"].includes(evidence.state) ||
    samples.some((sample) =>
      ["refused", "rate-limited"].includes(sample.outcome),
    );
  return {
    stars:
      blocked || times.length < 3 || median === null
        ? null
        : median <= 150
          ? 5
          : median <= 300
            ? 4
            : median <= 600
              ? 3
              : median <= 1000
                ? 2
                : 1,
    median,
    responses: successful.length,
    total: samples.length,
    fluctuating: successful.length > 0 && successful.length < samples.length,
    scope: attributed
      ? ("ip" as const)
      : mismatch
        ? ("different" as const)
        : ("browser" as const),
    stale,
  };
}
export function canonicalIp(value?: string) {
  if (!value) return null;
  try {
    if (value.includes(":"))
      return new URL(`https://[${value.replace(/^\[|\]$/g, "")}]`).hostname;
    if (
      /^\d{1,3}(\.\d{1,3}){3}$/.test(value) &&
      value.split(".").every((part) => Number(part) <= 255)
    )
      return value.split(".").map(Number).join(".");
  } catch {
    /* Not an IP address. */
  }
  return null;
}
export function sameIp(left?: string, right?: string) {
  const ip = canonicalIp(left);
  return ip !== null && ip === canonicalIp(right);
}
export function evidenceState(
  evidence: Evidence | undefined,
  queriedIp: string,
  now = Date.now(),
): EvidenceState {
  if (!evidence) return "unmeasured";
  if (!sameIp(evidence.queriedIp, queriedIp)) return "mismatch";
  if (now >= evidence.expiresAt) return "expired";
  if (
    ["running", "cancelled", "rate-limited", "mismatch"].includes(
      evidence.state,
    )
  )
    return evidence.state;
  if (evidence.direction === "browser-outbound") {
    if (!evidence.egressBefore || !evidence.egressAfter) return "unverifiable";
    if (
      !sameIp(evidence.egressBefore, queriedIp) ||
      !sameIp(evidence.egressAfter, queriedIp)
    )
      return "mismatch";
  }
  return evidence.state;
}
export function summarizeHttp(samples: HttpSample[]) {
  if (samples.some((sample) => sample.outcome === "rate-limited"))
    return "rate-limited" as const;
  if (
    !samples.length ||
    samples.every((sample) => sample.outcome === "unknown")
  )
    return "unverifiable" as const;
  if (
    samples.length >= 2 &&
    samples.every((sample) => sample.outcome === "refused")
  )
    return "failed" as const;
  if (
    samples.length >= 3 &&
    samples.every((sample) => sample.outcome === "readable")
  )
    return "complete" as const;
  return "partial" as const;
}
export function qualityRating(
  evidence: Evidence | undefined,
  queriedIp: string,
  scenario: "streaming" | "gaming" | "rtc",
  now = Date.now(),
): { stars: number | null; missing: string[]; state: EvidenceState } {
  const state = evidenceState(evidence, queriedIp, now);
  if (
    !evidence ||
    evidence.kind !== "quality" ||
    evidence.direction !== "browser-outbound" ||
    evidence.target !== "speed.cloudflare.com" ||
    state !== "complete" ||
    evidence.incomplete ||
    evidence.ruleVersion !== AIM_VERSION
  )
    return {
      stars: null,
      missing: [],
      state: state === "complete" ? "partial" : state,
    };
  const metrics = evidence.metrics ?? {};
  // Explicitly gate missing packet loss: upstream AIM otherwise awards default points.
  const required: (keyof QualityMetrics)[] = [
    "latency",
    "packetLoss",
    "downLoadedLatency",
    "upLoadedLatency",
  ];
  if (scenario === "streaming") required.push("download");
  if (scenario === "rtc") required.push("jitter", "upload", "download");
  const missing = required.filter(
    (key) =>
      typeof metrics[key] !== "number" ||
      !Number.isFinite(metrics[key]) ||
      metrics[key]! < 0 ||
      (key === "packetLoss" && metrics[key]! > 1),
  );
  const gaps: string[] = [...missing];
  if ((evidence.raw?.latency.length ?? 0) < 10) gaps.push("latencySamples");
  if (
    (evidence.raw?.packetsSent ?? 0) < 100 ||
    !Array.isArray(evidence.raw?.packetsLost)
  )
    gaps.push("packetSamples");
  if (
    (evidence.raw?.downLoaded.length ?? 0) < 3 ||
    (evidence.raw?.upLoaded.length ?? 0) < 3
  )
    gaps.push("loadedSamples");
  if (scenario === "streaming" && (evidence.raw?.download.length ?? 0) < 3)
    gaps.push("downloadSamples");
  if (scenario === "rtc" && (evidence.raw?.upload.length ?? 0) < 3)
    gaps.push("uploadSamples");
  const result = evidence.aimScores?.[scenario];
  const names = ["bad", "poor", "average", "good", "great"];
  if (
    !result ||
    !Number.isInteger(result.classificationIdx) ||
    names[result.classificationIdx] !== result.classificationName ||
    !Number.isFinite(result.points)
  )
    gaps.push("aimScore");
  return {
    stars: gaps.length ? null : result!.classificationIdx + 1,
    missing: gaps,
    state: gaps.length ? "partial" : state,
  };
}
