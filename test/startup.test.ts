import { assert } from "chai";
import { config } from "../package.json";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should finish plugin initialization", function () {
    const plugin = Zotero[config.addonInstance] as typeof addon | undefined;
    assert.isTrue(Boolean(plugin?.data.initialized));
  });
});
