import { describe, expect, it } from "vitest";
import {
  formatQuery,
  formatSearchResults,
  type SearchResult,
} from "../src/search.js";

describe("search helpers", () => {
  it("fills known template placeholders and keeps unknown ones intact", () => {
    expect(
      formatQuery("Product {name} {missing}", {
        name: "Studio Headphones",
      })
    ).toBe("Product Studio Headphones {missing}");
  });

  it("formats search results for prompt injection", () => {
    const results: SearchResult[] = [
      {
        title: "Studio Headphones",
        url: "https://example.com/studio-headphones",
        snippet: "Over-ear headphones with noise isolation",
      },
    ];

    expect(formatSearchResults(results)).toContain("Studio Headphones");
    expect(formatSearchResults([])).toBe("No web results found.");
  });
});
