import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CompactText } from "@/components/compact-text";
import { CountryFlag } from "@/components/country-flag";
import { SiteLogo } from "@/components/site-logo";
import { IpText, Pending, ActionButton } from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { UnderlineHover } from "@/components/underline-hover";
import { t } from "@/i18n";
import type { Geo } from "@/lib/types";
import { useQueries } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getGeo, inspectSite, type Site } from "./api";
import { matchesSiteCategory } from "./category-status";
import { ExitGroups, type SiteFilter } from "./exit-groups";
import rawsites from "./sites.json";

const sites = rawsites.map((item) => ({ ...item, name: t(item.name) }));

interface Row extends Site {
  onDetail: (name: string) => void;
  visible: boolean;
  geo?: Geo;
  pending: boolean;
  reachable?: boolean;
  geoPending: boolean;
}

const categoryLabels: Record<string, string> = {
  ai: "AI 服务",
  crypto: "加密货币",
  ecommerce: "跨境电商",
  media: "流媒体",
  social: "社交社区",
  dev: "开发平台",
  tools: "实用工具",
  static: "静态资源",
  speed: "测速服务",
};

function SiteEgressTable({
  rows,
  filter,
  onClearFilter,
}: {
  rows: Row[];
  filter: SiteFilter | null;
  onClearFilter: () => void;
}) {
  const tableId = useId();
  const [expanded, setExpanded] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreToggle = useRef(false);
  const canToggle = rows.length > 5;
  const collapsed = canToggle && !expanded;
  const visibleRows = collapsed ? rows.slice(0, 6) : rows;
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    const body = bodyRef.current;
    if (!viewport || !table || !body) return;
    const resize = () => {
      const preview = body.rows[5];
      viewport.style.height =
        collapsed && preview
          ? `${preview.getBoundingClientRect().top - table.getBoundingClientRect().top + 56}px`
          : "";
    };
    resize();
    if (restoreToggle.current) {
      restoreToggle.current = false;
      toggleRef.current?.scrollIntoView({
        block: "end",
        behavior: "instant",
      });
    }
    const observer = new ResizeObserver(resize);
    observer.observe(table);
    return () => observer.disconnect();
  }, [collapsed, rows.length]);
  return (
    <Card className="split-table-card mb-3 gap-0 rounded-lg py-0">
      <CardHeader className="split-table-header">
        <div className="row-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle>{t("网站访问明细")}</CardTitle>
              <span className="split-table-count">
                {rows.length} {t("个站点")}
              </span>
            </div>
            {filter && (
              <p className="split-table-filter">
                {t(filter.kind === "site" ? "网站" : "IP")} · {filter.value}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {filter && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={onClearFilter}
              >
                {t("清除筛选")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative p-0" data-collapsed={collapsed}>
        <div
          ref={viewportRef}
          className="split-table-viewport"
          data-expanded={expanded || !canToggle}
        >
          <div className="data-table split-table">
            <table ref={tableRef} id={tableId}>
              <thead>
                <tr>
                  <th>{t("网站")}</th>
                  <th>{t("访问状态")}</th>
                  <th>{t("IP")}</th>
                  <th>{t("归属地")}</th>
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {visibleRows.map((row, index) => {
                  const location = row.geo
                    ? [
                        row.geo.country,
                        row.geo.region,
                        row.geo.city,
                        row.geo.isp,
                        row.geo.asn
                          ? `AS${String(row.geo.asn).replace(/^AS/i, "")}`
                          : undefined,
                      ]
                        .filter(Boolean)
                        .filter(
                          (value, index, all) => all.indexOf(value) === index,
                        )
                        .join(" · ")
                    : "";
                  const status = row.pending
                    ? t("检测中…")
                    : row.reachable === false
                      ? t("网站访问受阻")
                      : row.reachable === true
                        ? t("网站可访问")
                        : t("等待检测");
                  return (
                    <tr key={row.name} inert={collapsed && index >= 5}>
                      <td>
                        <button
                          type="button"
                          className="site-cell w-full overflow-hidden text-left hover:text-primary"
                          title={status}
                          onClick={() => row.onDetail(row.name)}
                        >
                          <SiteLogo src={row.icon} />
                          <span className="min-w-0 truncate">{row.name}</span>
                          <Badge
                            variant="secondary"
                            className={
                              row.type === "domestic"
                                ? "tag-domestic"
                                : "tag-international"
                            }
                          >
                            {t(row.type === "domestic" ? "国内" : "国际")}
                          </Badge>
                          {row.extra?.map((category) => (
                            <Badge key={category} variant="secondary">
                              {t(categoryLabels[category] ?? category)}
                            </Badge>
                          ))}
                        </button>
                      </td>
                      <td>
                        {row.pending ? (
                          <Pending>{t("检测中…")}</Pending>
                        ) : row.reachable === false ? (
                          <span className="text-destructive">
                            {t("网站访问受阻")}
                          </span>
                        ) : row.reachable === true ? (
                          <span className="text-emerald-700 dark:text-emerald-300">
                            {t("网站可访问")}
                          </span>
                        ) : (
                          <span className="muted">{t("等待检测")}</span>
                        )}
                      </td>
                      <td>
                        {row.geo ? (
                          <IpText ip={row.geo.ip} />
                        ) : row.reachable === true ? (
                          <span className="muted">{t("出口不可读")}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {row.geoPending ? (
                          <Pending>{t("查询中…")}</Pending>
                        ) : location ? (
                          <div className="flex min-w-0 items-center gap-1.5">
                            <CountryFlag code={row.geo?.country_code} />
                            <CompactText text={location} />
                          </div>
                        ) : (
                          <span className="muted">{t("归属信息暂不可用")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {canToggle && (
          <div className="split-table-toggle">
            <Button
              ref={toggleRef}
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11 w-full gap-1"
              aria-expanded={expanded}
              aria-controls={tableId}
              onClick={() => {
                restoreToggle.current = expanded;
                setExpanded((value) => !value);
              }}
            >
              {expanded ? (
                <ChevronUp aria-hidden="true" />
              ) : (
                <ChevronDown aria-hidden="true" />
              )}
              {expanded ? t("收起全部") : t("展开全部")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SplitResults({ summary = false }: { summary?: boolean }) {
  const [round, setRound] = useState(0);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [detailIp, setDetailIp] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<SiteFilter | null>(null);
  const [visibleSites, setVisibleSites] = useState<Set<string>>(
    () => new Set(),
  );
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleSites(new Set(sites.map((site) => site.name)));
        observer.disconnect();
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [summary]);
  const inspectionQueries = useQueries({
    queries: sites.map((site) => ({
      queryKey: ["split", site.name, round],
      enabled: visibleSites.has(site.name),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        inspectSite(site, signal),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const ips = [
    ...new Set(
      [
        ...inspectionQueries.filter((_, index) =>
          visibleSites.has(sites[index].name),
        ),
      ].flatMap((query) => (query.data?.geo ? [query.data.geo.ip] : [])),
    ),
  ];
  const geoQueries = useQueries({
    queries: ips.map((ip) => ({
      queryKey: ["geoip", ip],
      queryFn: ({ signal }: { signal: AbortSignal }) => getGeo(ip, signal),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const geoByIp = new Map(ips.map((ip, index) => [ip, geoQueries[index]]));
  const rows: Row[] = sites.map((site, i) => ({
    ...site,
    onDetail: setDetailName,
    visible: visibleSites.has(site.name),
    geo: inspectionQueries[i].data?.geo
      ? {
          ...inspectionQueries[i].data.geo,
          ...geoByIp.get(inspectionQueries[i].data.geo.ip)?.data,
        }
      : undefined,
    pending: inspectionQueries[i].isFetching || inspectionQueries[i].isPending,
    reachable: inspectionQueries[i].data?.reachable,
    geoPending:
      inspectionQueries[i].isPending ||
      Boolean(
        inspectionQueries[i].data?.geo &&
        geoByIp.get(inspectionQueries[i].data.geo.ip)?.isPending,
      ),
  }));
  const groupedRows = [...rows].sort((a, b) => {
    const aBlocked = a.visible && !a.pending && a.reachable === false;
    const bBlocked = b.visible && !b.pending && b.reachable === false;
    return Number(bBlocked) - Number(aBlocked);
  });
  const categoryRows = rows.filter((row) => matchesSiteCategory(row, category));
  const filteredRows = filter
    ? categoryRows.filter((row) =>
        filter.kind === "site"
          ? row.name === filter.value
          : row.geo?.ip === filter.value,
      )
    : categoryRows;
  const exits = [
    ...new Map(
      rows.flatMap((row) => (row.geo ? [[row.geo.ip, row.geo] as const] : [])),
    ).values(),
  ];
  const detail = rows.find((row) => row.name === detailName);
  const pending = inspectionQueries.some((query) => query.isFetching);
  const Container = summary ? Card : "div";
  const Content = summary ? CardContent : "div";
  return (
    <Container ref={container} className="mb-3">
      {summary && (
        <CardHeader>
          <div className="row-between">
            <CardTitle>{t("网站分流出口")}</CardTitle>
            {summary && (
              <Link className="small muted" to="/network/connectivity">
                {t("查看全部 ›")}
              </Link>
            )}
          </div>
        </CardHeader>
      )}
      <Content>
        {summary ? (
          <div className="grid grid-cols-1 items-start gap-x-4 gap-y-1 sm:grid-cols-2">
            {exits.map((geo) => (
              <div
                key={geo.ip}
                className="flex min-w-0 items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs"
              >
                <CountryFlag code={geo.country_code} />
                <span className="min-w-0 flex-1">
                  <IpText ip={geo.ip} />
                </span>
                <UnderlineHover asChild>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => {
                      setDetailName(null);
                      setDetailIp(geo.ip);
                    }}
                  >
                    {rows.filter((row) => row.geo?.ip === geo.ip).length}
                    {t("个站点")}
                  </button>
                </UnderlineHover>
              </div>
            ))}
            <p className="home-note col-span-full pt-1">
              {pending ? (
                <Pending>{t("正在检测分流出口…")}</Pending>
              ) : (
                t("已读取 {0}/{1} 个站点的出口{2}", [
                  rows.filter((row) => row.geo).length,
                  sites.length,
                  !exits.length ? t("，暂无可显示结果") : "",
                ])
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="split-results-heading">
              <div className="min-w-0 flex items-baseline gap-2">
                <h2>{t("网站分流出口")}</h2>
                {filter && (
                  <span>
                    {t(filter.kind === "site" ? "网站" : "IP")} · {filter.value}
                  </span>
                )}
              </div>
              <ActionButton
                size="sm"
                busy={pending}
                onClick={() => {
                  setDetailName(null);
                  setDetailIp(null);
                  setFilter(null);
                  setVisibleSites(new Set(sites.map((site) => site.name)));
                  setRound((value) => value + 1);
                }}
              >
                {pending ? t("检测中...") : t("重新检测")}
              </ActionButton>
            </div>
            <ExitGroups
              rows={groupedRows}
              category={category}
              onCategoryChange={(value) => {
                setCategory(value);
                setFilter(null);
              }}
              onSelect={setDetailName}
              onFilter={setFilter}
              activeFilter={filter}
            />
            <SiteEgressTable
              rows={filteredRows}
              filter={filter}
              onClearFilter={() => setFilter(null)}
            />
          </>
        )}
      </Content>
      <ResponsiveDialog
        open={detailName !== null || detailIp !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailName(null);
            setDetailIp(null);
          }
        }}
        title={detail?.name ?? t("出口站点")}
        description={
          detail
            ? t("该站点观察到的出口信息。")
            : t("使用此出口的站点，点击名称查看详情。")
        }
      >
        {detail ? (
          <div className="space-y-3 text-sm">
            <p className="break-all text-muted-foreground">
              {detail.domain ?? detail.url ?? detail.name}
            </p>
            <div>
              {t("出口 IP：")}
              {detail.geo?.ip ? (
                <IpText ip={detail.geo.ip} />
              ) : (
                t("未读取到出口 IP")
              )}
            </div>
            <p>
              {[detail.geo?.country, detail.geo?.city, detail.geo?.isp]
                .filter(Boolean)
                .join(" · ") || t("归属信息暂不可用")}
            </p>
            <p className="text-muted-foreground">
              {detail.pending
                ? t("检测中…")
                : detail.reachable === false
                  ? t("网站访问受阻")
                  : detail.geo
                    ? t("已读取出口")
                    : t(detail.note ?? "网站可访问，但未能读取出口 IP")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <IpText ip={detailIp ?? undefined} />
            <div className="flex flex-wrap gap-2">
              {rows
                .filter((row) => row.geo?.ip === detailIp)
                .map((row) => (
                  <Badge
                    key={row.name}
                    variant="secondary"
                    className="h-auto max-w-full gap-1.5 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground [&_.site-icon]:size-3.5"
                    asChild
                  >
                    <button
                      type="button"
                      onClick={() => setDetailName(row.name)}
                    >
                      <SiteLogo src={row.icon} />
                      <span className="min-w-0 truncate">{row.name}</span>
                    </button>
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </Container>
  );
}
