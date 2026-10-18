/**
 * The Home screen nudges signed-in users without a pet to add one. During sign-up the
 * user is *already* being asked for their pet, so the nudge must stay quiet or it would
 * pop up over the sign-up flow (RN Modals render above every screen).
 */
let suppressed = false;
export const setPetPromptSuppressed = (v: boolean): void => { suppressed = v; };
export const isPetPromptSuppressed = (): boolean => suppressed;
