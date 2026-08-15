import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          background: "#1e3a8a",
          borderRadius: 7,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontFamily: "Georgia, serif",
            color: "#B45309",
            lineHeight: 1,
          }}
        >
          &#8220;
        </div>
        <div
          style={{
            fontSize: 24,
            fontFamily: "Georgia, serif",
            color: "#F8FAFC",
            lineHeight: 1,
          }}
        >
          &#8221;
        </div>
      </div>
    ),
    { ...size },
  );
}
