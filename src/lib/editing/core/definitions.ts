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
  schema: Schema.Schema<A, unknown, never>;
  fields: readonly EditorFieldConfig[];
  createDefault: () => A;
};

export type EditorRouteAdapter<
  EditorValue,
  RouteSelection,
  EditTarget,
  FormValue,
> = {
  parseSelectionParam: (param: string) => RouteSelection | null;
  buildPath: (selection: RouteSelection, title?: string) => string;
  selectTarget: (
    value: EditorValue,
    selection: RouteSelection,
  ) => EditTarget | null;
  parseForm: (formData: FormData) => FormValue;
  mergeValue: (current: EditorValue, formValue: FormValue) => EditorValue;
};

export type EditorDataAdapter<FileValue, EditorValue> = {
  definition: EditorDefinition<EditorValue>;
  toEditorValue: (file: FileValue) => EditorValue;
  applyEditorValue: (
    file: FileValue,
    value: EditorValue,
    now?: Date,
  ) => FileValue;
};