import { createHash } from "node:crypto";
import { assertSha256Integrity, computeSha256Base64 } from "../../b2b-runtime/crypto.js";

test("computeSha256Base64 returns expected digest", async () => {
  const input = "secure module";
  const expected = createHash("sha256").update(input, "utf8").digest("base64");
  const actual = await computeSha256Base64(input);

  expect(actual).toBe(expected);
});

test("assertSha256Integrity accepts valid digest and rejects mismatch", async () => {
  const input = "runtime plugin";
  const digest = createHash("sha256").update(input, "utf8").digest("base64");

  await expect(
    assertSha256Integrity(input, `sha256-${digest}`),
  ).resolves.toBeUndefined();

  await expect(
    assertSha256Integrity(input, "sha256-invalid"),
  ).rejects.toThrow(/Integrity verification failed/i);
});
