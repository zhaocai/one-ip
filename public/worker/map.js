export function mapConfig(env) {
  const token =
    typeof env?.TIANDITU_TOKEN === "string" ? env.TIANDITU_TOKEN.trim() : "";
  return token ? { provider: "tianditu", token } : { provider: "osm" };
}
