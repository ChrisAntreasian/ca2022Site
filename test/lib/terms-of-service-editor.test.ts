import { describe, expect, it } from "vitest";

import {
  parseTermsOfServiceForm,
  termsOfServiceEditorPath,
} from "../../src/lib/editing/resources/terms-of-service/terms-of-service-editor";

describe("terms-of-service edit route helpers", () => {
  it("builds the terms editor path", () => {
    expect(termsOfServiceEditorPath()).toBe("/terms-of-service/edit");
  });

  it("parses form data into the editor value", () => {
    const formData = new FormData();
    formData.set("title", "AI Training and Data Use Terms");
    formData.set("bodyMarkdown", "No model training without written consent.");

    expect(parseTermsOfServiceForm(formData)).toEqual({
      title: "AI Training and Data Use Terms",
      bodyMarkdown: "No model training without written consent.",
    });
  });
});
