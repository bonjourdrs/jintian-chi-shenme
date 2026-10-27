import test from "node:test";
import assert from "node:assert/strict";
import {
  androidIntent,
  douyinPlaybackHref,
  douyinVideoId,
  hemaLaunchHref,
} from "../src/lib/nativeLinks.ts";
const android =
  "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36";
test("Android video links preserve exact long ID and directly target native playback", () => {
  const id = "7644518469774284209",
    web = `https://www.douyin.com/video/${id}`;
  const link = douyinPlaybackHref(web, android);
  assert.ok(link.startsWith(`snssdk1128://aweme/detail/${id}?`));
  assert.equal(douyinPlaybackHref(web, "Desktop"), web);
  assert.equal(douyinVideoId(`https://evil.test/video/${id}`), null);
  assert.equal(douyinVideoId("javascript:alert(1)"), null);
});
test("Hema launches Hema package rather than Taobao or web search", () => {
  const link = hemaLaunchHref(android);
  assert.equal(link, "wdkhema://main");
  assert.ok(!link.includes("tbopen"));
  assert.ok(!link.includes("s.taobao.com"));
  assert.equal(
    hemaLaunchHref("Desktop"),
    "https://www.freshippo.com/down/app.html",
  );
});
test("Intent builders reject protocol, fragment and package injection", () => {
  assert.throws(() =>
    androidIntent("javascript://evil", "https://example.com"),
  );
  assert.throws(() =>
    androidIntent("wdkhema://main#Intent;evil", "https://example.com"),
  );
  assert.throws(() => androidIntent("wdkhema://main", "javascript:alert(1)"));
  assert.throws(() =>
    androidIntent("wdkhema://main", "https://example.com", "foo;evil"),
  );
});

test("Phone choices persist per App without relying on browser detection", () => {
  const old = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return key.endsWith("douyin") ? "official" : "intent";
    },
  };
  try {
    assert.equal(
      douyinPlaybackHref(
        "https://www.douyin.com/video/7644518469774284209",
        android,
      ),
      "https://www.iesdouyin.com/share/video/7644518469774284209/",
    );
    assert.ok(hemaLaunchHref(android).includes("package=com.wudaokou.hippo;"));
  } finally {
    if (old) globalThis.localStorage = old;
    else delete globalThis.localStorage;
  }
});
test("WeChat recognition does not confuse a regular Android browser", async () => {
  const { isWeChat } = await import("../src/lib/wechat.ts");
  assert.equal(isWeChat("Mozilla Android 14 MicroMessenger/8.0.60"), true);
  assert.equal(isWeChat(android), false);
});
test("Hema keyword preparation strips measurable quantity rather than searching it", async () => {
  const { hemaSearchTerm } = await import("../src/lib/hema.ts");
  assert.equal(hemaSearchTerm("鸡蛋3个"), "鸡蛋");
  assert.equal(hemaSearchTerm("土豆（300克）"), "土豆");
  assert.equal(hemaSearchTerm("十三香"), "十三香");
});
