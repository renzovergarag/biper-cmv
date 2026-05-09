import { Skeleton } from "@/components/ui/skeleton";

export default function AdminEventsLoading() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        </div>
    );
}
