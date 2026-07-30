import { Schema } from "effect";

export type FieldKind =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "checkbox"
  | "select"
  | "image"
  | "group"
  | "repeater";

export type EditorFieldConfig = {
  name: string;
  label: string;
  kind: FieldKind;
  description?: string;
  placeholder?: string;
  required?: boolean;
};

export type EditorDefinition<A> = {
  key: string;
  label: string;
  schema: Schema.Schema<A, any, never>;
  fields: readonly EditorFieldConfig[];
  createDefault: () => A;
};