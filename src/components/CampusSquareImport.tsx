"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface CampusSquareImportProps {
    onImport: (uid: string, pass: string) => Promise<void>;
    buttonLabel?: string;
    description?: string;
    actionLabel?: string;
}

export default function CampusSquareImport({
    onImport,
    buttonLabel = "大学の時間割",
    description = "IDとパスワードを入力して時間割を取得します。パスワードは連携先のサーバーへ直接送信され、保存されません。",
    actionLabel = "インポート"
}: CampusSquareImportProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [uid, setUid] = React.useState("");
    const [pass, setPass] = React.useState("");
    const [isImporting, setIsImporting] = React.useState(false);

    const handleImport = async () => {
        if (!uid || !pass) return;
        setIsImporting(true);
        try {
            await onImport(uid, pass);
            setIsOpen(false);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" type="button" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {buttonLabel}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>連携システムからインポート</DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label htmlFor="cs-uid" className="text-sm font-medium">ログインID</label>
                        <Input id="cs-uid" value={uid} onChange={e => setUid(e.target.value)} placeholder="ログインID" />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="cs-pass" className="text-sm font-medium">パスワード</label>
                        <Input id="cs-pass" type="password" value={pass} onChange={e => setPass(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleImport} disabled={isImporting || !uid || !pass}>
                        {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {actionLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
