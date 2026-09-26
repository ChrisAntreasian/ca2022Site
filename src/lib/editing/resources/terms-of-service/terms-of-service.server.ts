import {
  termsOfServiceFileC,
  upsertTermsOfServiceEditorValue,
  type TermsOfServiceEditorValue,
  type TermsOfServiceFile,
} from "./terms-of-service";
import { createJsonEditorStore } from "../../core/store.server";

const termsOfServiceFilePath = "./src/data/terms-of-service.json";
const termsOfServiceStore = createJsonEditorStore<TermsOfServiceFile>({
  filePath: termsOfServiceFilePath,
  schema: termsOfServiceFileC,
  contentKey: "terms-of-service",
  invalidDataMessage: "Invalid terms-of-service data file.",
});

export const readTermsOfServiceFile = async (): Promise<TermsOfServiceFile> =>
  termsOfServiceStore.readFile();

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
