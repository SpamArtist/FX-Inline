import type { ComponentChildren, JSX } from "preact";

type NativeIconProps = JSX.SVGAttributes<SVGSVGElement> & {
  children: ComponentChildren;
  size?: number | string;
  strokeWidth?: number | string;
};

type PublicIconProps = Omit<NativeIconProps, "children">;

function NativeIcon({
  size = 16,
  strokeWidth = 2,
  children,
  ...props
}: NativeIconProps) {
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

export function ArrowLeftRightIcon(props: PublicIconProps) {
  return (
    <NativeIcon {...props}>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </NativeIcon>
  );
}

export function ChevronDownIcon(props: PublicIconProps) {
  return (
    <NativeIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </NativeIcon>
  );
}

export function CogIcon(props: PublicIconProps) {
  return (
    <NativeIcon {...props}>
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
    </NativeIcon>
  );
}
