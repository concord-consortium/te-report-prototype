// Server names -- used in console output.

export const serverName = 'TeacherEdition Report Server';
export const serverShortName = 'TE Server';

// Logging controls.

export const verbose = process.env.VERBOSE || false;

// Communication controls.

export const port = process.env.PORT || 3000;
export const laraServer = process.env.AUTHORING_SERVER || 'authoring.staging.concord.org';
export const apiToken = process.env.AUTHORING_API_KEY || undefined;
export const portalServer = process.env.LEARN_SERVER || 'learn.staging.concord.org';
