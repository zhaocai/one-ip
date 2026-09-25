import { Fragment, memo, useState } from "react";
import { LatencyBadge } from "@/components/latency-badge";
import { SiteLogo } from "@/components/site-logo";
import { Pending, ToolCard } from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { t } from "@/i18n";
import {
  Star,
  Info,
  BrainCircuit,
  ShoppingBag,
  MessagesSquare,
  Bitcoin,
  Play,
  Gamepad2,
  Briefcase,
  Code2,
  Cloud,
  Search,
  House,
  Mail,
} from "lucide-react";
import {
  accessRating,
  averageAccessRating,
  evidenceState,
  qualityRating,
  type Evidence,
  type EvidenceState,
} from "./scenario-evidence";
import {
  scenarioGroups,
  type ScenarioGroup,
  type ScenarioTarget,
} from "./scenario-targets";
import type { useIpLatency } from "./use-ip-latency";
import { useScenarioAccess } from "./use-scenario-access";
import { useScenarioEvidence } from "./use-scenario-evidence";

const stateLabels: Record<EvidenceState, string> = {
  unmeasured: t("待检测"),
  running: t("检测中…"),
  complete: t("已取得证据"),
  partial: t("证据不完整"),
  failed: t("请求被拒绝"),
  "rate-limited": t("检测限流"),
  unverifiable: t("无法核验"),
  mismatch: t("出口不匹配"),
  expired: t("结果已过期"),
  cancelled: t("已取消"),
};
const stateTone = (state: EvidenceState) =>
  ["unmeasured", "cancelled", "unverifiable"].includes(state)
    ? "secondary"
    : state === "complete"
      ? "success"
      : state === "failed"
        ? "danger"
        : ["partial", "mismatch", "expired", "rate-limited"].includes(state)
          ? "warning"
          : "info";
const metricLabels: Record<string, string> = {
  latency: t("空载延迟"),
  jitter: t("抖动"),
  download: t("下载速度"),
  upload: t("上传速度"),
  downLoadedLatency: t("下载负载延迟"),
  upLoadedLatency: t("上传负载延迟"),
  packetLoss: t("UDP 丢包率"),
  latencySamples: t("延迟样本不足"),
  packetSamples: t("UDP 样本不足"),
  loadedSamples: t("负载延迟样本不足"),
  downloadSamples: t("下载样本不足"),
  uploadSamples: t("上传样本不足"),
  aimScore: t("AIM 评分未产生"),
};
export function ScenarioStars({
  stars,
  showValue = true,
}: {
  stars: number;
  showValue?: boolean;
}) {
  return (
    <span
      className="ip-scenario-stars"
      data-rating={Math.floor(stars)}
      aria-label={t("评分：{0}/5", [stars])}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className="ip-scenario-star" aria-hidden="true">
          <Star size={12} />
          <span
            className="ip-scenario-star-fill"
            style={{
              width: `${Math.min(1, Math.max(0, stars - index)) * 100}%`,
            }}
          >
            <Star size={12} className="is-filled" />
          </span>
        </span>
      ))}
      {showValue && <span>{stars}/5</span>}
    </span>
  );
}
function EvidenceDetails({ evidence }: { evidence: Evidence }) {
  const readable = evidence.samples.filter(
    (sample) => sample.outcome === "readable",
  ).length;
  const opaque = evidence.samples.filter(
    (sample) => sample.outcome === "opaque",
  ).length;
  const elapsed = evidence.samples
    .filter(
      (sample) => sample.outcome === "readable" || sample.outcome === "opaque",
    )
    .map((sample) => sample.elapsedMs)
    .sort((a, b) => a - b);
  const median = elapsed.length
    ? Math.round(
        (elapsed[Math.floor((elapsed.length - 1) / 2)] +
          elapsed[Math.floor(elapsed.length / 2)]) /
          2,
      )
    : null;
  return (
    <div className="ip-measurement-detail">
      <p>
        {t("测量来源")}：{evidence.source} · {evidence.protocol} ·{" "}
        {evidence.addressFamily === "unknown"
          ? t("地址族未核验")
          : evidence.addressFamily}
      </p>
      <p>
        {evidence.direction === "probe-inbound"
          ? t("远端探针 → 查询 IP")
          : t("当前浏览器 → 目标服务")}
        ：<span className="break-all">{evidence.target}</span>
      </p>
      {evidence.direction === "browser-outbound" && (
        <p>
          {t("测量出口")}：{evidence.egressBefore ?? t("未知")} →{" "}
          {evidence.egressAfter ?? t("未知")}
        </p>
      )}
      <p>
        {t("检测时间")}：{new Date(evidence.checkedAt).toLocaleTimeString()} ·{" "}
        {t("有效期 5 分钟")}
      </p>
      {!!evidence.samples.length && (
        <>
          <p>
            {t("样本 {0} 次，可读响应 {1} 次，不透明响应 {2} 次", [
              evidence.samples.length,
              readable,
              opaque,
            ])}
            {median !== null && ` · ${t("HTTP 耗时中位数")} ${median} ms`}
          </p>
          <p>
            {t("HTTP 状态")}：
            {[
              ...new Set(
                evidence.samples.map((sample) => sample.status).filter(Boolean),
              ),
            ].join(" / ") || t("无法读取")}
          </p>
        </>
      )}
      {evidence.metrics && (
        <dl className="ip-measurement-metrics">
          {Object.entries(metricLabels)
            .filter(([key]) => key in evidence.metrics!)
            .map(([key, label]) => {
              const value =
                evidence.metrics![key as keyof typeof evidence.metrics];
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {typeof value !== "number" || !Number.isFinite(value)
                      ? t("未知")
                      : key === "packetLoss"
                        ? `${(value * 100).toFixed(1)}%`
                        : key === "download" || key === "upload"
                          ? `${(value / 1e6).toFixed(1)} Mbps`
                          : `${Math.round(value)} ms`}
                  </dd>
                </div>
              );
            })}
        </dl>
      )}
      <details>
        <summary>{t("查看原始样本")}</summary>
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all text-[10px]">
          {JSON.stringify(evidence.raw ?? evidence.samples, null, 2)}
        </pre>
      </details>
    </div>
  );
}
function AccessRows({
  targets,
  records,
  ip,
  now,
}: {
  targets: ScenarioTarget[];
  records: Record<string, Evidence>;
  ip: string;
  now: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="data-table connectivity-table ip-platform-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("网站")}</TableHead>
            <TableHead>{t("测试记录")}</TableHead>
            <TableHead>{t("延迟")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((target, index) => {
            const evidence = records[target.url];
            const rating = accessRating(evidence, ip, now);
            const running = !evidence || evidence.state === "running";
            const status = rating.stale
              ? t("结果已过期")
              : evidence?.state === "cancelled"
                ? t("已取消")
                : evidence?.state === "rate-limited"
                  ? t("检测限流")
                  : evidence?.state === "failed"
                    ? t("请求被拒绝")
                    : rating.responses
                      ? rating.fluctuating
                        ? t("本轮有波动")
                        : t("已取得响应")
                      : running
                        ? t("检测中…")
                        : evidence?.samples.some(
                              (sample) => sample.error === "network",
                            )
                          ? t("检测受阻")
                          : t("检测超时");
            const open = expanded === target.url;
            const toggle = () => setExpanded(open ? null : target.url);
            return (
              <Fragment key={target.url}>
                <TableRow
                  data-alt={index % 2}
                  className="ip-platform-row"
                  onClick={toggle}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="site-cell ip-platform-name"
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle();
                      }}
                    >
                      <SiteLogo
                        src={target.icon}
                        website={target.website ?? target.url}
                      />
                      <span>{target.name}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div
                      className="ping-dots"
                      aria-label={t("取得响应 {0}/{1}", [
                        rating.responses,
                        rating.total,
                      ])}
                    >
                      {Array.from({ length: 8 }, (_, sampleIndex) => {
                        const sample = evidence?.samples[sampleIndex];
                        const good =
                          sample &&
                          ["readable", "opaque"].includes(sample.outcome);
                        return (
                          <span
                            key={sampleIndex}
                            className={`ping-dot ${!sample ? "" : !good ? "dot-fail" : sample.elapsedMs < 100 ? "dot-good" : sample.elapsedMs < 400 ? "dot-warn" : "dot-slow"}`}
                            title={
                              !sample
                                ? t("未采样")
                                : good
                                  ? `${sample.elapsedMs} ms · ${sample.status ? `HTTP ${sample.status}` : t("不透明响应")}`
                                  : sample.status
                                    ? `HTTP ${sample.status}`
                                    : t("检测受阻")
                            }
                          />
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {rating.median !== null &&
                    !rating.stale &&
                    !["failed", "rate-limited", "cancelled"].includes(
                      evidence?.state ?? "",
                    ) ? (
                      <LatencyBadge
                        result={{
                          median: rating.median,
                          samples: evidence!.samples.map((sample) =>
                            ["opaque", "readable"].includes(sample.outcome)
                              ? sample.elapsedMs
                              : -1,
                          ),
                        }}
                        running={running}
                      />
                    ) : (
                      <Badge variant={running ? "secondary" : "warning"}>
                        {running ? <Pending>{status}</Pending> : status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="ip-platform-evidence">
                    <TableCell colSpan={3}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {rating.scope === "ip"
                            ? t("该 IP 实测")
                            : rating.scope === "different"
                              ? t("出口不同")
                              : t("当前网络实测")}
                        </span>
                        <span>{status}</span>
                        {rating.stars !== null && (
                          <ScenarioStars stars={rating.stars} />
                        )}
                      </div>
                      {rating.scope === "different" && (
                        <p>
                          {t(
                            "出口与查询 IP 不一致，星级仅描述当前网络访问表现。",
                          )}
                        </p>
                      )}
                      {evidence && <EvidenceDetails evidence={evidence} />}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

const scenarioIcons = {
  ai: BrainCircuit,
  commerce: ShoppingBag,
  social: MessagesSquare,
  crypto: Bitcoin,
  streaming: Play,
  gaming: Gamepad2,
  remote: Briefcase,
  api: Code2,
  hosting: Cloud,
  search: Search,
  domestic: House,
  communication: Mail,
};

const platformCount = new Set(
  scenarioGroups.flatMap((group) => group.targets.map((target) => target.url)),
).size;

// Only visible rating/coverage changes rerender a row; raw sample updates stay in the dialog.
const ScenarioSummaryRow = memo(function ScenarioSummaryRow({
  group,
  average,
  rated,
  dots,
  busy,
  onSelect,
}: {
  group: ScenarioGroup;
  average: number | null;
  rated: number;
  dots: string;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = scenarioIcons[group.id as keyof typeof scenarioIcons];
  const states = dots.split(",");
  const partial = average !== null && rated < group.targets.length;
  return (
    <TableRow
      className="ip-scenario-table-row"
      onClick={() => onSelect(group.id)}
    >
      <TableCell>
        <button
          type="button"
          className="site-cell ip-platform-name"
          aria-haspopup="dialog"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(group.id);
          }}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span>{group.label}</span>
        </button>
      </TableCell>
      <TableCell>
        <div className="ip-scenario-progress">
          <div
            className="ping-dots"
            aria-label={t("已评 {0}/{1}", [rated, group.targets.length])}
          >
            {group.targets.map((target, index) => (
              <span
                key={target.url}
                className={`ping-dot ${states[index] === "_" ? "" : states[index] === "!" ? "dot-fail" : "dot-good"}`}
                title={`${target.name} · ${states[index] === "_" ? t("检测中…") : states[index] === "!" ? t("证据不足") : `${states[index]}/5`}`}
              />
            ))}
          </div>
          <span className="ip-scenario-count text-[10px] text-muted-foreground">
            {rated}/{group.targets.length}
          </span>
          <span
            className="ip-scenario-partial"
            data-visible={partial}
            title={partial ? t("部分结果") : undefined}
            aria-label={partial ? t("部分结果") : undefined}
            aria-hidden={!partial}
          >
            <Info size={11} aria-hidden="true" />
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="ip-scenario-rating">
          {average !== null ? (
            <ScenarioStars stars={average} />
          ) : (
            <Badge variant="secondary">
              {busy ? <Pending>{t("检测中…")}</Pending> : t("证据不足")}
            </Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

export function ScenarioPanel({
  ip,
  inbound,
}: {
  ip: string;
  inbound: ReturnType<typeof useIpLatency>;
}) {
  const { records, busy, now, run, cancel } = useScenarioEvidence(ip);
  const access = useScenarioAccess(ip);
  const [selected, setSelected] = useState<string | null>(null);
  const group = scenarioGroups.find((item) => item.id === selected);
  const summary = (targets: ScenarioTarget[]) =>
    averageAccessRating(
      targets.map((target) => access.records[target.url]),
      ip,
      now,
    );
  const average = group ? summary(group.targets) : null;
  const key = group?.inbound ? "https" : "quality";
  const evidence = records[key];
  const quality = group?.quality
    ? qualityRating(evidence, ip, group.quality, now)
    : null;
  const state = quality?.state ?? evidenceState(evidence, ip, now);
  const hasTurn = Boolean(
    import.meta.env.VITE_SPEEDTEST_TURN_URI &&
    import.meta.env.VITE_SPEEDTEST_TURN_CREDENTIALS_URL,
  );
  const manual = (
    <>
      <div className="my-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={Boolean(busy) || inbound.busy || access.busy}
          onClick={() => void run(key)}
        >
          {group?.inbound ? t("检测 HTTPS 入站") : t("开始网络质量测试")}
        </Button>
        {busy === key && (
          <Button size="sm" variant="ghost" onClick={cancel}>
            {t("取消")}
          </Button>
        )}
        <Badge variant={stateTone(state)}>
          {state === "running" ? (
            <Pending>{stateLabels[state]}</Pending>
          ) : (
            stateLabels[state]
          )}
        </Badge>
      </div>
      {state === "mismatch" && (
        <p>{t("观察到的出口与查询 IP 不一致，此结果不能给该 IP 评分。")}</p>
      )}
      {state === "unverifiable" && (
        <p>{t("无法读取目标响应或确认出口归属，不能判为 IP 不可用。")}</p>
      )}
      {state === "expired" && <p>{t("旧结果只供查看，请重新检测。")}</p>}
      {!!quality?.missing.length && (
        <p>
          {t("缺少有效证据")}：
          {quality.missing.map((name) => metricLabels[name] ?? name).join("、")}
        </p>
      )}
      {evidence && <EvidenceDetails evidence={evidence} />}
      {quality?.stars != null && (
        <>
          <ScenarioStars stars={quality.stars} />
          <p>
            {t(
              "AIM 五档对应 1–5 星，仅描述本次浏览器网络测量，不能证明账号或地区可用。",
            )}
          </p>
        </>
      )}
    </>
  );
  return (
    <ToolCard title={t("应用场景评分")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="ip-scenario-intro !mb-0">
          {t("自动检测 {0} 类场景、{1} 个平台，点击场景查看详情。", [
            scenarioGroups.length,
            platformCount,
          ])}
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={Boolean(busy)}
          onClick={access.busy ? access.cancel : access.start}
        >
          {access.busy ? <Pending>{t("停止检测")}</Pending> : t("重新测试")}
        </Button>
      </div>
      <div className="data-table connectivity-table ip-scenario-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("应用场景")}</TableHead>
              <TableHead>{t("检测覆盖")}</TableHead>
              <TableHead>{t("平均评分")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarioGroups.map((item) => {
              const result = summary(item.targets);
              const dots = item.targets
                .map((target) => {
                  const record = access.records[target.url];
                  const rating = accessRating(record, ip, now);
                  return rating.stars !== null
                    ? String(rating.stars)
                    : !record || record.state === "running"
                      ? "_"
                      : "!";
                })
                .join(",");
              return (
                <ScenarioSummaryRow
                  key={item.id}
                  group={item}
                  average={result.average}
                  rated={result.rated}
                  dots={dots}
                  busy={access.busy}
                  onSelect={setSelected}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ResponsiveDialog
        open={!!group}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={group?.label ?? t("应用场景评分")}
        description={t("当前网络访问评分；点击平台查看采样与出口证据。")}
      >
        {group && average && (
          <div className="ip-scenario-dialog space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t("平均访问评分")}</span>
              {average.average !== null ? (
                <ScenarioStars stars={average.average} />
              ) : (
                <Badge variant="secondary">{t("证据不足")}</Badge>
              )}
              <p className="w-full text-muted-foreground">
                {t(
                  "已评 {0}/{1}，至少 {2} 个平台有效才生成均分；未评分项不计入。",
                  [average.rated, average.total, average.required],
                )}
              </p>
              {average.rated < average.total && (
                <Badge variant="warning">
                  {access.busy ? (
                    <Pending>{t("检测中…")}</Pending>
                  ) : (
                    t("部分结果")
                  )}
                </Badge>
              )}
            </div>
            <AccessRows
              key={group.id}
              targets={group.targets}
              records={access.records}
              ip={ip}
              now={now}
            />
            {group.quality && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {t("完整网络质量检测")}
                </summary>
                <p>
                  {t(
                    "网站接入评分不代表游戏对战、视频会议或播放质量；完整质量需要带宽、抖动与丢包证据。",
                  )}
                </p>
                <p>
                  {t(
                    "测试当前浏览器到 Cloudflare 与配置的 TURN 服务，不代表所有目标平台的线路。",
                  )}
                </p>
                <p>
                  {t(
                    "最多约 70 MB 测量流量，最长 2 分钟；三个性能场景共用一次结果。",
                  )}
                </p>
                {!hasTurn && (
                  <p>
                    {t(
                      "未配置 TURN 丢包检测；可测带宽和延迟，但缺少 UDP 证据时不生成星级。",
                    )}
                  </p>
                )}
                {manual}
              </details>
            )}
            {group.inbound && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {t("查询 IP 入站检测")}
                </summary>
                <p>
                  {t(
                    "上方评分仅代表云平台网站访问，不代表查询 IP 可以部署网站。",
                  )}
                </p>
                <p>
                  {t(
                    "远端探针检查此 IP 的 HTTPS 443，不使用浏览器出口代替；证书或 Host 不匹配也可能导致失败。",
                  )}
                </p>
                <div className="my-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={inbound.busy || Boolean(busy) || access.busy}
                    onClick={() => void inbound.start()}
                  >
                    {t("检测 ICMP 入站")}
                  </Button>
                  {inbound.busy && (
                    <Button size="sm" variant="ghost" onClick={inbound.cancel}>
                      {t("取消")}
                    </Button>
                  )}
                </div>
                {inbound.data && (
                  <p>
                    {t("ICMP 已返回 {0} 个探针；不回包不代表 HTTPS 不可达。", [
                      inbound.data.results.length,
                    ])}
                  </p>
                )}
                {inbound.error && (
                  <p className="text-destructive">{inbound.error}</p>
                )}
                {manual}
              </details>
            )}
            <p className="text-muted-foreground">
              {t(
                "仅检测公开端点响应，不透明响应无法读取 HTTP 状态；不代表登录、对话、播放、地区授权或账号安全。",
              )}
            </p>
          </div>
        )}
      </ResponsiveDialog>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("评分依据与检测范围")}</summary>
        <p className="mt-2">
          {t(
            "每个平台至少 3 次有效响应；场景至少 3 个平台且覆盖 60% 后取星级均值，保留一位小数。",
          )}
        </p>
        <p>
          {t(
            "按 HTTP 响应耗时中位数评级：≤150 / 300 / 600 / 1000 / >1000 ms 对应 5 / 4 / 3 / 2 / 1 星；这是本站访问速度参考。",
          )}
        </p>
        <p>
          {t(
            "先完成基础采样再补齐至最多 8 次，整轮上限 20 秒。覆盖圆点代表各平台，详情圆点代表单次请求。",
          )}
        </p>
        <p>
          {t(
            "仅检测公开端点响应，不透明响应无法读取 HTTP 状态；不代表登录、对话、播放、地区授权或账号安全。",
          )}
        </p>
      </details>
    </ToolCard>
  );
}
