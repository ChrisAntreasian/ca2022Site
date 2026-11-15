import {
  landingFileC,
  upsertLandingEditorValue,
  type LandingEditorValue,
  type LandingFile,
  type LandingSection,
} from "./landing";
import { createJsonEditorStore } from "../../core/store.server";
import {
  contentDataStore,
  publicReadScope,
  type ContentKey,
} from "#lib/content.server";

const landingContentKey = "landing" satisfies ContentKey;
const landingStore = createJsonEditorStore<LandingFile>({
  store: contentDataStore(),
  schema: landingFileC,
  contentKey: landingContentKey,
  invalidDataMessage: "Invalid landing data file.",
});

export const readLandingFile = async (): Promise<LandingFile> =>
  landingStore.readFile();

/** What the public page loader reads. Under S3 this resolves to the live version. */
export const readPublicLandingFile = async (): Promise<LandingFile> =>
  landingStore.readFile(publicReadScope(landingContentKey));

export const ensureLandingBaselineSnapshot = async (file?: LandingFile) =>
  landingStore.ensureBaselineSnapshot(file);

export const writeLandingFile = async (file: LandingFile) => {
  await landingStore.writeFile(file);
};

export const saveLandingEditorValue = async (
  value: LandingEditorValue,
  now = new Date(),
) => {
  const current = await readLandingFile();
  await ensureLandingBaselineSnapshot(current);
  const updated = upsertLandingEditorValue(current, value, now);

  await writeLandingFile(updated);

  return updated;
};

/**
 * Replace a single home-page section by id. The current draft is read first so untouched sections and
 * their images survive the edit, matching how poems edits one poem within a shared file.
 */
export const saveLandingSectionEditorValue = async (
  section: LandingSection,
  now = new Date(),
) => {
  const current = await readLandingFile();
  await ensureLandingBaselineSnapshot(current);

  if (
    !current.data.data?.[0]?.attributes.page_details?.data?.some(
      (s) => s.id === section.id,
    )
  ) {
    return current;
  }

  const editorValue: LandingEditorValue = {
    sections: [section],
  };
  const updated = upsertLandingEditorValue(current, editorValue, now);

  await writeLandingFile(updated);

  return updated;
};
