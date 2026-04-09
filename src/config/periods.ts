export interface CustomPeriod {
    id: number;
    label: string;
    time: string;
}

/**
 * カスタム枠設定（組織の時限など）
 * ここに時限の設定を追加すると、自動的にUIに「カスタム枠設定」として表示されます。
 * 設定がない場合（空配列の場合）は、1時間単位の選択肢のみが表示されます。
 * 
 * 記述例:
 * export const CUSTOM_PERIODS: CustomPeriod[] = [
 *     { id: 1, label: "1限", time: "09:00-09:50" },
 *     { id: 2, label: "2限", time: "09:50-10:40" },
 *     { id: 3, label: "3限", time: "10:50-11:40" },
 *     { id: 4, label: "4限", time: "11:40-12:30" },
 *     { id: 5, label: "5限", time: "13:20-14:10" },
 * ];
 */
export const CUSTOM_PERIODS: CustomPeriod[] = [];
