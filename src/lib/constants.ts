export const COOKIE_NAMES = {
    ADMIN_PREFIX: "chousei_admin_",
    GOOGLE_SESSION: "chousei_google_session",
    GOOGLE_OAUTH_NONCE: "chousei_google_oauth_nonce",
} as const;

export const COOKIE_MAX_AGE = {
    ADMIN_SESSION: 2592000,
    GOOGLE_SESSION: 2592000,
    OAUTH_NONCE: 600,
} as const;

export const API_ERRORS = {
    EVENT_NOT_FOUND: "Event not found",
    INVALID_PASSWORD: "Invalid password",
    UNAUTHORIZED: "Unauthorized",
    INTERNAL_ERROR: "Internal Server Error",
    INVALID_OAUTH_CALLBACK: "Invalid OAuth callback",
    INVALID_OAUTH_STATE: "Invalid OAuth state",
    FAILED_TO_EXCHANGE_TOKEN: "Failed to exchange token",
    FAILED_TO_FETCH_USER_INFO: "Failed to fetch user info",
    GOOGLE_SESSION_NOT_FOUND: "Google session not found",
    FAILED_TO_FETCH_CALENDAR_LIST: "Failed to fetch calendar list",
    EMAIL_REQUIRED_FOR_NOTIFICATION: "通知を受け取る場合はメールアドレスが必要です",
    INVALID_CONFIRMED_CANDIDATE_INDEX: "Invalid confirmed candidate index",
} as const;

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
} as const;

export const LOCAL_STORAGE_KEYS = {
    PARTICIPANT_PREFIX: "chosei_participant_",
} as const;
