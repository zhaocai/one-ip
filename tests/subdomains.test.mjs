import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../.worker-test/index.js";
import {
  certificateNames,
  subdomainTarget,
  lookupSubdomains,
} from "../public/worker/subdomains.js";

test("subdomain targets normalize IDNs and reject URLs, IPs and wildcard queries", () => {
  assert.equal(subdomainTarget(" Example.COM. "), "example.com");
  assert.equal(subdomainTarget("例子.com"), "xn--fsqu00a.com");
  for (const value of [
    "https://example.com",
    "example.com/path",
    "example.com:443",
    "*.example.com",
    "%example.com",
    "localhost",
    "127.0.0.1",
    "1.1.1.1",
    "a@b.com",
    "a.com?x",
    "a b.com",
    "",
  ])
    assert.throws(
      () => subdomainTarget(value),
      (e) => e.status === 400,
    );
});
test("certificate names split SAN lines, deduplicate, retain wildcards and exclude unrelated domains", () => {
  assert.deepEqual(
    certificateNames(
      [
        {
          name_value:
            "WWW.Example.com\r\nexample.com\n*.example.com\n*.api.example.com",
        },
        {
          name_value:
            "www.example.com\nx.y.example.com\nnotexample.com\nexample.com.attacker.net\nhttps://bad.example.com",
        },
      ],
      "example.com",
    ),
    [
      "*.api.example.com",
      "*.example.com",
      "www.example.com",
      "x.y.example.com",
    ],
  );
  assert.deepEqual(certificateNames([], "example.com"), []);
  for (const value of [{}, null, [{}], [{ name_value: null }]])
    assert.throws(
      () => certificateNames(value, "example.com"),
      (e) => e.status === 502,
    );
});
test("crt.sh integration uses a fixed upstream and preserves errors", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url) => {
      calls++;
      const target = new URL(url);
      assert.equal(target.origin, "https://crt.sh");
      assert.equal(target.searchParams.get("q"), "%.example.com");
      assert.equal(target.searchParams.get("output"), "json");
      return Response.json([{ name_value: "www.example.com" }]);
    };
    const response = await worker.fetch(
      new Request("https://tools.example/api/subdomains/example.com"),
      {},
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).names, ["www.example.com"]);
    await assert.rejects(
      () => lookupSubdomains("evil.com/path"),
      (e) => e.status === 400,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      new Response("rate limited", { status: 429 });
    await assert.rejects(
      () => lookupSubdomains("example.com"),
      (e) => e.status === 429,
    );
    globalThis.fetch = async () => Response.json({ error: "bad" });
    await assert.rejects(
      () => lookupSubdomains("example.com"),
      (e) => e.status === 502,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
