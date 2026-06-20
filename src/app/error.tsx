"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/wana";

/**
 * セグメント単位の React レンダリングエラー境界。Wana に送信したうえで
 * 簡易なリトライ UI を表示する。
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        captureException(error, {
            tags: { source: "react-error-boundary" },
            extra: { digest: error.digest },
        });
    }, [error]);

    return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
            <h2>エラーが発生しました</h2>
            <p>問題が報告されました。もう一度お試しください。</p>
            <button
                onClick={reset}
                style={{
                    marginTop: "1rem",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.5rem",
                    border: "1px solid currentColor",
                    cursor: "pointer",
                }}
            >
                再試行
            </button>
        </div>
    );
}
