import { createRateService } from "../../b2b-runtime/rates.js";

test("rate service fetches with privacy-safe request options", async () => {
  const fetchCalls = [];
  const mockFetch = async (url, options) => {
    fetchCalls.push({ url, options });

    return {
      ok: true,
      json: async () => ({
        rates: {
          USD: 1,
          EUR: 0.92,
        },
      }),
    };
  };

  const service = createRateService({
    providers: ["https://example.test/rates"],
    fetchImpl: mockFetch,
  });

  const snapshot = await service.getRates({ forceRefresh: true });

  expect(snapshot.rates.USD).toBe(1);
  expect(fetchCalls).toHaveLength(1);
  expect(fetchCalls[0].options.credentials).toBe("omit");
  expect(fetchCalls[0].options.referrerPolicy).toBe("no-referrer");
  expect(fetchCalls[0].options.cache).toBe("no-store");
});
