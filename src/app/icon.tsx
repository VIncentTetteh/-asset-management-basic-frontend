import { ImageResponse } from "next/og";

// The favicon is generated once at build time and shipped as a static PNG.
//
// Under output: "export" there is no server to render this per request, so Next
// requires the route to declare itself static. The icon has no dynamic input — it is
// the same 32x32 mark on every request — so pinning it costs nothing. The edge runtime
// declaration is gone with it: nothing executes at the edge in a static export.
export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #2dd4bf 0%, #059669 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        color: "white",
                        fontSize: 14,
                        fontWeight: 900,
                        letterSpacing: "-0.5px",
                        fontFamily: "sans-serif",
                    }}
                >
                    IQ
                </span>
            </div>
        ),
        { ...size }
    );
}
