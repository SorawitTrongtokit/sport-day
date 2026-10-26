import { ImageResponse } from "next/og";

// A plain route rather than the app/icon convention, so the layout can point the
// tab icon at the uploaded logo instead (see generateMetadata in app/layout.tsx).
export const dynamic = "force-static";

const size = { width: 512, height: 512 };

const COLORS = ["#EF4444", "#22C55E", "#38BDF8", "#A855F7"];

/** Default app icon: the four team colors under a dark tile. */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111111",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ display: "flex", height: 96 }}>
          {COLORS.map((color) => (
            <div key={color} style={{ flex: 1, background: color }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
