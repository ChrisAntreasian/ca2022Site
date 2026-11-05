import {
  termsOfServiceFileC,
  upsertTermsOfServiceEditorValue,
  type TermsOfServiceEditorValue,
  type TermsOfServiceFile,
} from "./terms-of-service";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  type ContentKey,
} from "#lib/content.server";

const termsOfServiceContentKey = "terms-of-service" satisfies ContentKey;
const termsOfServiceStore = createJsonEditorStore<TermsOfServiceFile>({
  store: contentDataStore(),
  schema: termsOfServiceFileC,
  contentKey: termsOfServiceContentKey,
  invalidDataMessage: "Invalid terms-of-service data file.",
});

export const readTermsOfServiceFile = async (): Promise<TermsOfServiceFile> =>
  termsOfServiceStore.readFile();

/** What the public page reads. `terms-of-service` is not an S3 key, so this stays on disk or bundle. */
export const readPublicTermsOfServiceFile =
  async (): Promise<TermsOfServiceFile> =>
    termsOfServiceStore.readFile(publicReadScope(termsOfServiceContentKey));

export const ensureTermsOfServiceBaselineSnapshot = async (
  file?: TermsOfServiceFile,
) => termsOfServiceStore.ensureBaselineSnapshot(file);

export const writeTermsOfServiceFile = async (file: TermsOfServiceFile) => {
  await termsOfServiceStore.writeFile(file);
};

export const saveTermsOfServiceEditorValue = async (
  value: TermsOfServiceEditorValue,
  now = new Date(),
) => {
  const current = await readTermsOfServiceFile();
  await ensureTermsOfServiceBaselineSnapshot(current);
  const updated = upsertTermsOfServiceEditorValue(current, value, now);

  await writeTermsOfServiceFile(updated);

  return updated;
};
