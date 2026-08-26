import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.5" cy="10.5" r="5.8" />
      <path d="m15 15 4.2 4.2" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="m10 11 .3 6" />
      <path d="m14 11-.3 6" />
      <path d="M6.5 7 8 20h8l1.5-13" />
    </IconBase>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m8 4 8 8" />
      <path d="m14 3 7 7-3 1-4 4-1 3-7-7 3-1 4-4 1-3Z" />
      <path d="m9 15-6 6" />
    </IconBase>
  );
}

export function ExpandIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14.5 4H20v5.5" />
      <path d="m20 4-6.5 6.5" />
      <path d="M9.5 20H4v-5.5" />
      <path d="m4 20 6.5-6.5" />
    </IconBase>
  );
}

export function RestoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 7V5h11v11h-2" />
      <rect x="5" y="8" width="11" height="11" rx="1.5" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </IconBase>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-15v-13.5Z" />
      <path d="M3.5 8.5h17" />
    </IconBase>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 6 6 6-6 6" />
    </IconBase>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 7h9" />
      <path d="M18 7h1" />
      <path d="M5 17h1" />
      <path d="M10 17h9" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </IconBase>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </IconBase>
  );
}

export function PowerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v8" />
      <path d="M7.4 6.8a7 7 0 1 0 9.2 0" />
    </IconBase>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 8v5" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.8 3.2 18a1.7 1.7 0 0 0 1.5 2.5h14.6a1.7 1.7 0 0 0 1.5-2.5L13.7 4.8a1.9 1.9 0 0 0-3.4 0Z" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4 10-10" />
    </IconBase>
  );
}
