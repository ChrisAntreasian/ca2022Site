import { ENABLE_CONTENT_EDITOR } from "$app/env/private";

/**
 * The feature flag only: does the editor exist in this environment at all?
 *
 * This is deliberately not a credential check, and it is no longer the gate on any editor page. Authentication
 * lives in `session.server.ts` - see `requireEditorAccess(cookies)`. Keeping the two separate matters because
 * a public page needs "should I offer an Edit link" (flag plus session) while an editor route needs "may this
 * visitor act" (flag plus session, with a redirect to unlock when it fails).
 */
export const isEditorEnabled = () => ENABLE_CONTENT_EDITOR?.trim() === "true";
