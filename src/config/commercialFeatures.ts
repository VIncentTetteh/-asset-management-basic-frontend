/**
 * Presentation flags for commercially gated features. The API enforces the
 * corresponding server-side flags; these values only control client routing
 * and visibility. Every risky feature defaults to OFF.
 */
export const commercialFeatures = Object.freeze({
    governedAi: process.env.NEXT_PUBLIC_FEATURE_GOVERNED_AI === "true",
    outboundWebhooks: process.env.NEXT_PUBLIC_FEATURE_OUTBOUND_WEBHOOKS === "true",
    bog2026: process.env.NEXT_PUBLIC_FEATURE_BOG_2026 === "true",
    platformHealth: process.env.NEXT_PUBLIC_FEATURE_PLATFORM_HEALTH === "true",
    documentAttachments: process.env.NEXT_PUBLIC_FEATURE_DOCUMENT_ATTACHMENTS === "true",
    governedCustomFields: process.env.NEXT_PUBLIC_FEATURE_GOVERNED_CUSTOM_FIELDS === "true",
});

export const isCommercialRouteDisabled = (pathname: string): boolean =>
    (!commercialFeatures.governedAi && (pathname.startsWith("/ai-chat") || pathname.startsWith("/ai-insights")))
    || (!commercialFeatures.outboundWebhooks && pathname.startsWith("/webhooks"))
    || (!commercialFeatures.bog2026 && (pathname.startsWith("/compliance/bog-controls") || pathname.startsWith("/compliance/bog-report")))
    || (!commercialFeatures.platformHealth && pathname.startsWith("/health"));
