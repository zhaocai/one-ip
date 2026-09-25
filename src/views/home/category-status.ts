export function matchesSiteCategory(
  row: { type: string; extra?: string[] },
  category: string,
) {
  return (
    category === "all" ||
    (category === "domestic"
      ? row.type === "domestic"
      : (row.extra?.includes(category) ?? false))
  );
}

export function categoryStatusClass(
  rows: {
    visible: boolean;
    pending: boolean;
    reachable?: boolean;
    geoPending: boolean;
    geo?: { ip?: string };
  }[],
) {
  if (
    !rows.length ||
    rows.some((row) => !row.visible || row.pending || row.geoPending)
  )
    return "text-muted-foreground hover:text-muted-foreground";
  const unreachable = rows.filter((row) => row.reachable === false).length;
  const success = rows.filter((row) => row.geo?.ip).length;
  if (!unreachable && success === rows.length)
    return "text-emerald-700 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400";
  if (unreachable < rows.length)
    return "text-amber-700 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400";
  return "text-destructive hover:text-destructive";
}
