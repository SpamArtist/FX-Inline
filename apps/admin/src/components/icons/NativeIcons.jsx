function NativeIcon({
  size = 16,
  children,
  strokeWidth = 2,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props["aria-hidden"] ?? true}
      {...props}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </NativeIcon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </NativeIcon>
  );
}

export function GlobeIcon(props) {
  return (
    <NativeIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20" />
      <path d="M12 2a15.3 15.3 0 0 0 0 20" />
    </NativeIcon>
  );
}

export function HammerIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9" />
      <path d="m17.6 15 3-3" />
      <path d="m13 6 5 5" />
      <path d="m16 3 5 5" />
      <path d="m2 22 3-3" />
    </NativeIcon>
  );
}

export function PlusIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </NativeIcon>
  );
}

export function RotateCcwIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </NativeIcon>
  );
}

export function SaveIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7H7v7" />
      <path d="M7 3v5h8" />
    </NativeIcon>
  );
}

export function SearchIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </NativeIcon>
  );
}

export function TrashIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </NativeIcon>
  );
}

export function XIcon(props) {
  return (
    <NativeIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </NativeIcon>
  );
}
