import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UpgradeCardProps {
    title: string;
    body: string;
    /** Defaults to the billing page. */
    href?: string;
    cta?: string;
}

/** Inline, non-blocking upsell shown in place of a paid-only feature. */
export function UpgradeCard({ title, body, href = "/billing", cta = "View plans" }: UpgradeCardProps) {
    return (
        <Card className="mx-auto max-w-lg border-warn/40 bg-warn-soft">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <Lock className="h-5 w-5 text-warn" aria-hidden="true" /> {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-fg">{body}</p>
                <Button asChild>
                    <Link href={href}>{cta}</Link>
                </Button>
            </CardContent>
        </Card>
    );
}
