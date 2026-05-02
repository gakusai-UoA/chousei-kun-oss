"use client";

import { useCallback, useEffect, useRef } from "react";

const ACTIVITY_LOG_KEY = "chosei_activity_log";
const MAX_LOG_ENTRIES = 100;

export type ActivityLogEntry = {
    timestamp: string;
    action: string;
    details?: string;
};

function getStoredLogs(): ActivityLogEntry[] {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem(ACTIVITY_LOG_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function storeLogs(logs: ActivityLogEntry[]): void {
    if (typeof window === "undefined") return;
    try {
        const trimmed = logs.slice(-MAX_LOG_ENTRIES);
        localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(trimmed));
    } catch {
        // Ignore storage errors
    }
}

export function logActivity(action: string, details?: string): void {
    const entry: ActivityLogEntry = {
        timestamp: new Date().toISOString(),
        action,
        details,
    };
    const logs = getStoredLogs();
    logs.push(entry);
    storeLogs(logs);
}

export function getActivityLogs(): ActivityLogEntry[] {
    return getStoredLogs();
}

export function clearActivityLogs(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACTIVITY_LOG_KEY);
}

export function formatLogsForEmail(): string {
    const logs = getStoredLogs();
    if (logs.length === 0) return "ログがありません";

    const lines = logs.map((log) => {
        const time = new Date(log.timestamp).toLocaleString("ja-JP");
        return `[${time}] ${log.action}${log.details ? ` - ${log.details}` : ""}`;
    });

    return lines.join("\n");
}

export function useActivityLog() {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        logActivity("ページ読み込み", window.location.pathname);
    }, []);

    const log = useCallback((action: string, details?: string) => {
        logActivity(action, details);
    }, []);

    return { log };
}
