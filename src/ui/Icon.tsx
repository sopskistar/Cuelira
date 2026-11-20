export function Icon({
  name,
  size = 20,
}: {
  name:
    | "play"
    | "camera"
    | "stop"
    | "pause"
    | "arrow"
    | "check"
    | "download"
    | "trash"
    | "close"
    | "book"
    | "retry";
  size?: number;
}) {
  const paths = {
    play: <path d="m8 5 11 7-11 7z" />,
    camera: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    book: (
      <>
        <path d="M12 5v16M3 4l9 1 9-1v15l-9 2-9-2z" />
      </>
    ),
    retry: <path d="M4 11a8 8 0 1 1 2 7M4 4v7h7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Mark() {
  return (
    <svg
      className="mark"
      width="34"
      height="34"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M8 8h36v9H17v30h27v9H8zM35 23l21 9-21 9z" />
    </svg>
  );
}
