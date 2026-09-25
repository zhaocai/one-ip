import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CopyButton } from "@/components/copy-button";
import { LookupForm } from "@/components/lookup-form";
import { PageHeading, ErrorNotice, Pending } from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLookupHistory } from "@/hooks/use-lookup-history";
import { t, locale } from "@/i18n";
import { endpoint } from "@/lib/network";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const pageSize = 20;

interface Result {
  domain: string;
  source: string;
  sourceUrl: string;
  names: string[];
  checkedAt: string;
}
export default function SubdomainsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [pagination, setPagination] = useState({ query: q, page: 0 });
  const setPage = (page: number) => setPagination({ query: q, page });
  const history = useLookupHistory<Result>("ip-tools:subdomains-history:v1");
  const cached = history.find(q);
  const query = useQuery({
    queryKey: ["subdomains", q],
    enabled: Boolean(q),
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
    queryFn: async ({ signal }) => {
      const result = await endpoint<Result>(
        `/subdomains/${encodeURIComponent(q)}`,
        { signal },
      );
      history.save(q, result);
      return result;
    },
    staleTime: Infinity,
    retry: false,
  });
  const data = query.data;
  const total = data?.names.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(
    pagination.query === q ? pagination.page : 0,
    pageCount - 1,
  );
  const start = currentPage * pageSize;
  const end = Math.min(start + pageSize, total);
  return (
    <div className="lookup-page text-[13px] leading-relaxed">
      <div className="lookup-search-card">
        <PageHeading
          title={t("子域名查询")}
          description={t("查询证书透明度日志中记录的子域名")}
        />
        <LookupForm
          grouped
          value={q}
          placeholder={t("输入域名，例如 example.com")}
          busy={query.isFetching}
          onSubmit={(value) => {
            setPage(0);
            value === q ? void query.refetch() : setParams({ q: value });
          }}
        />
      </div>
      <Card className="mt-3">
        <CardContent>
          <div className="examples lookup-history">
            <span>
              {history.entries.length ? t("最近查询") : t("推荐查询")}
            </span>
            {(history.entries.length
              ? history.entries.map((entry) => entry.query)
              : ["example.com", "douyin.com", "baidu.com"]
            ).map((value) => (
              <Badge key={value} variant="secondary" asChild>
                <button
                  type="button"
                  className="cursor-pointer rounded-md px-2 py-1 h-auto hover:bg-accent"
                  onClick={() => {
                    setPage(0);
                    setParams({ q: value });
                  }}
                >
                  {value}
                </button>
              </Badge>
            ))}
          </div>
          {cached && (
            <p className="small muted">
              {t("已保存的查询结果 ·")}{" "}
              {new Date(cached.savedAt).toLocaleString(locale)}
              {t("，点击查询可更新")}
            </p>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t(
          "来源：crt.sh。证书日志不保证覆盖全部子域名，也不代表域名仍在解析或可访问；带 *. 的记录为通配符证书，不是具体主机。",
        )}
      </p>
      <ErrorNotice error={query.error} />
      {query.isFetching && (
        <p className="mt-2 text-[13px] text-muted-foreground">
          <Pending>{t("正在查询证书日志…")}</Pending>
        </p>
      )}
      {data && (
        <Card className="mt-3">
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="break-all font-medium">{data.domain}</h2>
                <Badge variant="secondary">{t("共 {0} 条记录", [total])}</Badge>
              </div>
              {data.names.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs">{t("复制全部")}</span>
                  <CopyButton value={data.names.join("\n")} />
                </div>
              )}
            </div>
            <p className="small muted">
              {new Date(data.checkedAt).toLocaleString(locale)} ·{" "}
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                crt.sh ↗
              </a>
            </p>
            {data.names.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                {t("未发现证书记录，不代表没有子域名。")}
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border">
                <Table
                  className="table-fixed text-[13px]"
                  aria-label={t("子域名查询")}
                >
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead scope="col" className="w-14 text-center">
                        {t("序号")}
                      </TableHead>
                      <TableHead scope="col">{t("子域名")}</TableHead>
                      <TableHead scope="col" className="w-12 text-center">
                        {t("复制")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.names.slice(start, end).map((name, index) => (
                      <TableRow key={name}>
                        <TableCell className="text-center text-xs tabular-nums text-muted-foreground">
                          {start + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <code className="break-all text-[13px]">{name}</code>
                        </TableCell>
                        <TableCell className="p-1 text-center">
                          <CopyButton value={name} className="size-9" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {total > 0 && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className="text-xs tabular-nums text-muted-foreground"
                  role="status"
                >
                  {t("显示 {0}–{1} 条，共 {2} 条", [start + 1, end, total])}
                </p>
                <nav
                  aria-label={t("结果分页")}
                  className="flex items-center justify-between gap-1 sm:justify-end"
                >
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-9 shrink-0"
                    aria-label={t("首页")}
                    disabled={currentPage === 0}
                    onClick={() => setPage(0)}
                  >
                    <ChevronsLeft aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="size-9 shrink-0 px-2 sm:w-auto"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft className="sm:hidden" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">
                      {t("上一页")}
                    </span>
                  </Button>
                  <span
                    className="px-1 text-xs whitespace-nowrap tabular-nums"
                    aria-label={t("第 {0} 页，共 {1} 页", [
                      currentPage + 1,
                      pageCount,
                    ])}
                  >
                    {currentPage + 1} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="size-9 shrink-0 px-2 sm:w-auto"
                    disabled={currentPage === pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight className="sm:hidden" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">
                      {t("下一页")}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="size-9 shrink-0"
                    aria-label={t("末页")}
                    disabled={currentPage === pageCount - 1}
                    onClick={() => setPage(pageCount - 1)}
                  >
                    <ChevronsRight aria-hidden="true" />
                  </Button>
                </nav>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
