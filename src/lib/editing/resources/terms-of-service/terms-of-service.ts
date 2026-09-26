import { Schema } from "effect";

import type { EditorDefinition } from "../../core/definitions";

export const termsOfServiceEditorValueC = Schema.Struct({
  title: Schema.String,
  bodyMarkdown: Schema.String,
});

export type TermsOfServiceEditorValue = Schema.Schema.Type<
  typeof termsOfServiceEditorValueC
>;

export type TermsOfServiceFile = {
  name: string;
  timestamp: number;
  data: TermsOfServiceEditorValue;
};

export const termsOfServiceFileC: Schema.Schema<
  TermsOfServiceFile,
  TermsOfServiceFile,
  never
> = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: termsOfServiceEditorValueC,
});

export const termsOfServiceEditorDefinition = {
  key: "terms-of-service",
  label: "Terms of Service",
  schema: termsOfServiceEditorValueC as Schema.Schema<
    TermsOfServiceEditorValue,
    unknown,
    never
  >,
  fields: [
    {
      name: "title",
      label: "Title",
      kind: "text",
      placeholder: "Terms page title",
      required: true,
    },
    {
      name: "bodyMarkdown",
      label: "Body",
      kind: "markdown",
      placeholder: "Write the terms in markdown",
      required: true,
    },
  ],
  createDefault: () => ({
    title: "",
    bodyMarkdown: "",
  }),
} satisfies EditorDefinition<TermsOfServiceEditorValue>;

export const toTermsOfServiceEditorValue = (
  file: TermsOfServiceFile,
): TermsOfServiceEditorValue => ({
  title: file.data.title,
  bodyMarkdown: file.data.bodyMarkdown,
});

export const upsertTermsOfServiceEditorValue = (
  file: TermsOfServiceFile,
  value: TermsOfServiceEditorValue,
  now = new Date(),
): TermsOfServiceFile => ({
  ...file,
  timestamp: now.getTime(),
  data: {
    title: value.title,
    bodyMarkdown: value.bodyMarkdown,
  },
});
