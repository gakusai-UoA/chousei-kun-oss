"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/wana";

/**
 * ブラウザのグローバルエラーを Wana に送るための初期化コンポーネント。
 * - `window.onerror`（同期例外・リソースエラー）
 * - `unhandledrejection`（未処理の Promise 拒否）
 * を購読する。React のレンダリングエラーは error.tsx / global-error.tsx で捕捉する。
 */
export function WanaInit() {
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            captureException(event.error ?? new Error(event.message || "window.onerror"), {
                tags: { source: "window.onerror" },
                extra: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                },
            });
        };
        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const error =
                reason instanceof Error
                    ? reason
                    : new Error(
                          typeof reason === "string" ? reason : "Unhandled promise rejection"
                      );
            captureException(error, { tags: { source: "unhandledrejection" } });
        };

        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onRejection);
        };
    }, []);

    return null;
}
