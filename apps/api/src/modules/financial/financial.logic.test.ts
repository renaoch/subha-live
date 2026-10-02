import { describe, expect, it } from "vitest";
import { mapGiftCatalogRows } from "./financial.logic";

describe("mapGiftCatalogRows", () => {
  it("maps snake_case DB rows to the public DTO shape", () => {
    const rows = [
      {
        id: "g1",
        code: "rose",
        name: "Rose",
        icon: "rose",
        coin_price: 100,
        diamond_value: 50,
        is_active: true,
      },
    ];
    const [item] = mapGiftCatalogRows(rows);
    expect(item).toEqual({
      id: "g1",
      code: "rose",
      name: "Rose",
      icon: "rose",
      coinPrice: 100,
      diamondValue: 50,
      isActive: true,
    });
  });

  it("returns an empty array for an empty input", () => {
    expect(mapGiftCatalogRows([])).toEqual([]);
  });
});
