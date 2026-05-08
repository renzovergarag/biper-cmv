"use client";

import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

type Range = "7" | "30";

const chartConfig = {
    count: {
        label: "Eventos",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig;

interface EventsAreaChartProps {
    initialData: { date: string; count: number }[];
    initialRange?: Range;
}

function formatLabel(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
    });
}

export default function EventsAreaChart({
    initialData,
    initialRange = "7",
}: EventsAreaChartProps) {
    const [range, setRange] = useState<Range>(initialRange);
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetch(`/api/admin/stats/events-by-day?range=${range}`)
            .then((r) => r.json())
            .then((json) => {
                if (!cancelled && Array.isArray(json.data)) {
                    setData(json.data);
                }
            })
            .catch((err) => {
                console.error("Error fetching chart data:", err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [range]);

    const isEmpty = data.every((d) => d.count === 0);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                    <CardTitle className="text-base">
                        Eventos creados
                    </CardTitle>
                    <CardDescription>
                        Últimos {range} días
                    </CardDescription>
                </div>
                <div className="flex gap-1">
                    <Button
                        variant={range === "7" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRange("7")}
                    >
                        7d
                    </Button>
                    <Button
                        variant={range === "30" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRange("30")}
                    >
                        30d
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
                {isEmpty && !loading ? (
                    <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                        Aún no hay eventos en este rango
                    </div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="aspect-auto h-[240px] sm:h-[320px] w-full"
                    >
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient
                                    id="fillCount"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--color-count)"
                                        stopOpacity={0.8}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--color-count)"
                                        stopOpacity={0.05}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={formatLabel}
                                minTickGap={20}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(v) =>
                                            formatLabel(v as string)
                                        }
                                        indicator="dot"
                                    />
                                }
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="var(--color-count)"
                                fill="url(#fillCount)"
                                strokeWidth={2}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
