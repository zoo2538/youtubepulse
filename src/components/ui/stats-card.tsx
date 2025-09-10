import { cn } from "@/lib/utils";
import { Card } from "./card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  trend = "neutral",
  className 
}: StatsCardProps) {
  const trendColors = {
    up: "text-success",
    down: "text-danger", 
    neutral: "text-muted-foreground"
  };

  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;

  return (
    <Card className={cn(
      "p-6 hover:bg-card-hover transition-colors border border-border",
      className
    )}>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {change !== undefined && (
            <div className={cn("flex items-center space-x-1", trendColors[trend])}>
              {trend !== "neutral" && <TrendIcon className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {change > 0 ? "+" : ""}{change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-muted-foreground">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}