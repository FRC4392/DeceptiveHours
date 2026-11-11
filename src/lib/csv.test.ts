import { describe, expect, test } from "vitest"
import { csvFromRows } from "./csv"

describe("csv escaping", () => {
  test("quotes separators, quotes and newlines", () => {
    expect(csvFromRows([["plain", "has,comma", 'has"quote', "has\nnewline"]])).toBe(
      'plain,"has,comma","has""quote","has\nnewline"',
    )
  })

  test("neutralizes spreadsheet formulas in text values", () => {
    // A name or email synced from Clerk could otherwise execute on open.
    expect(csvFromRows([["=1+1"]])).toBe("'=1+1")
    expect(csvFromRows([["@SUM(A1)"]])).toBe("'@SUM(A1)")
    expect(csvFromRows([["+1 555 0100"]])).toBe("'+1 555 0100")
    expect(csvFromRows([["=HYPERLINK(\"x\",\"y\")"]])).toBe(
      "\"'=HYPERLINK(\"\"x\"\",\"\"y\"\")\"",
    )
  })

  test("leaves genuine numbers alone so spreadsheets still sum them", () => {
    expect(csvFromRows([["-3.5", "12.0", -2, 0]])).toBe("-3.5,12.0,-2,0")
  })

  test("renders empty cells for null and undefined", () => {
    expect(csvFromRows([[null, undefined, ""]])).toBe(",,")
  })

  test("separates rows with CRLF", () => {
    expect(csvFromRows([["a"], ["b"]])).toBe("a\r\nb")
  })
})
