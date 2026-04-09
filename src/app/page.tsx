import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const EventForm = dynamic(() => import('@/components/EventForm').then(mod => mod.EventForm), {
	loading: () => (
		<div className="flex justify-center items-center my-32 space-x-2">
			<Loader2 className="w-8 h-8 text-primary animate-spin" />
			<span className="text-muted-foreground font-medium">フォームを読み込み中...</span>
		</div>
	)
});

export default function CreateEventPage() {
	return (
		<div className="h-[100dvh] overflow-hidden flex flex-col bg-background text-foreground p-2 sm:p-4 md:p-6 lg:p-8">
			<EventForm />
		</div>
	);
}
