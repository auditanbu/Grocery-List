export const metadata = { title: "Offline · Home" };

export default function OfflinePage() {
  return (
    <div className="ios-card mt-10 p-8 text-center">
      <p className="text-[22px] font-semibold tracking-tight">You’re offline</p>
      <p className="mt-2 text-[15px] text-ios-label-2">
        Pages you have already opened stay available. Reconnect to add items, record prices or
        export a PDF.
      </p>
    </div>
  );
}
