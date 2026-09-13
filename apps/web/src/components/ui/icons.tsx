"use client";

import type { SVGProps } from "react";
import type { FieldType } from "@tratable/shared";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const TextIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 5h14M12 5v14" />
  </svg>
);
export const AlignLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h10M4 18h14" />
  </svg>
);
export const HashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
  </svg>
);
export const CheckSquareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </svg>
);
export const ChevronCircleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 10.5 3 3 3-3" />
  </svg>
);
export const TagsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M11 3H5a2 2 0 0 0-2 2v6l9.5 9.5a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L11 3Z" />
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const CalendarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const MailIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
export const LinkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 15 15 9" />
    <path d="M10.5 6.5 12 5a4 4 0 1 1 5.7 5.6l-1.7 1.7" />
    <path d="M13.5 17.5 12 19a4 4 0 1 1-5.7-5.6l1.7-1.7" />
  </svg>
);
export const PaperclipIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12.5 12.5 20a4.5 4.5 0 0 1-6.4-6.4L14 5.7a3 3 0 0 1 4.3 4.2l-7.6 7.6a1.5 1.5 0 0 1-2.1-2.1l6.9-6.9" />
  </svg>
);
export const PhoneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z" />
  </svg>
);
export const GlobeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17" />
  </svg>
);
export const ListPlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h11M4 12h7M4 17h7M18 15v6M15 18h6" />
  </svg>
);
export const SortIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
  </svg>
);
export const PaletteIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3a9 8 0 1 0 0 16c1.1 0 1.7-.9 1.2-1.8-.3-.6.1-1.2.8-1.2H15a4 4 0 0 0 4-4c0-5-3-9-7-9Z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
    <circle cx="9.5" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="11" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const FIELD_ICONS: Record<FieldType, (p: IconProps) => React.JSX.Element> = {
  singleLineText: TextIcon,
  longText: AlignLeftIcon,
  number: HashIcon,
  checkbox: CheckSquareIcon,
  singleSelect: ChevronCircleIcon,
  multiSelect: TagsIcon,
  date: CalendarIcon,
  dateTime: ClockIcon,
  email: MailIcon,
  url: GlobeIcon,
  phone: PhoneIcon,
  attachment: PaperclipIcon,
  linkToRecord: LinkIcon,
  autoNumber: HashIcon,
  createdTime: ClockIcon,
  lastModifiedTime: ClockIcon,
};

export function FieldTypeIcon({ type, ...rest }: { type: FieldType } & IconProps) {
  const Icon = FIELD_ICONS[type] ?? TextIcon;
  return <Icon {...rest} />;
}

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
  </svg>
);
export const DownloadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M4 19h16" />
  </svg>
);
export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 20V9m0 0 4 4m-4-4-4 4M4 5h16" />
  </svg>
);
export const LogOutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 16l4-4-4-4M19 12H9" />
  </svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
export const TableIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M9.5 4.5v15" />
  </svg>
);
export const DatabaseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </svg>
);
export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
  </svg>
);
