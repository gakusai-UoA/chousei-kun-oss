import { type ReactNode } from "react";
import { loadDefaultJapaneseParser } from "budoux";

const parser = loadDefaultJapaneseParser();

export function budouxify(text: string): ReactNode {
    if (!text) return text;
    const segments = parser.parse(text);
    return segments.map((segment, i) => (
        <span key={i} style={{ display: "inline-block" }}>
            {segment}
        </span>
    ));
}

export function parseBudouX(text: string): string[] {
    if (!text) return [text];
    return parser.parse(text);
}
