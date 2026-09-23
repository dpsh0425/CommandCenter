// The one account this app was built for. Used to gate admin-only actions
// (sending invites) and to attribute rows an invited collaborator creates
// back to the actual app owner, since their own auth.uid() is a different
// user once real multi-user login exists.
export const OWNER_USER_ID = "41781551-3aca-4a59-b517-16189aa9c896";
