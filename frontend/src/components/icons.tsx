'use client';

import React from 'react';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
};

// Shared SVG wrapper: 24x24 viewBox, currentColor stroke, round caps.
// Icons are decorative, so they are hidden from screen readers (aria-hidden).
function Icon({ size = 22, color, strokeWidth = 1.8, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

// --- Home feature cards ---

// Legal Drafting
export function IconPen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </Icon>
  );
}

// Study Dashboard
export function IconChartBar(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 20v-10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
      <path d="M3 20h18" />
    </Icon>
  );
}

// Citation Maps
export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

// Debate Analysis
export function IconScales(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v4" />
      <path d="M5 7h14" />
      <path d="M5 7l-3 7h6z" />
      <path d="M19 7l-3 7h6z" />
      <path d="M12 14v7" />
      <path d="M8 21h8" />
    </Icon>
  );
}

// Legal Glossary
export function IconBook(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

// AI Tutor
export function IconCap(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v6" />
    </Icon>
  );
}

// Doctrine Explorer
export function IconLandmark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 11h16" />
      <path d="M4 8h16" />
      <path d="M6 8l6-5 6 5" />
      <path d="M7 11V8h3v3" />
      <path d="M10.5 11V8h3v3" />
      <path d="M14 11V8h3v3" />
      <path d="M5 21h14" />
      <path d="M7 21v-7h3v7" />
      <path d="M10.5 21v-7h3v7" />
      <path d="M14 21v-7h3v7" />
    </Icon>
  );
}

// Document Management
export function IconFolder(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

// Resources
export function IconBookOpen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Icon>
  );
}

// --- Dashboard stat cards ---

// Documents
export function IconFile(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
    </Icon>
  );
}

// Notes
export function IconPencil(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Icon>
  );
}

// Review Queue
export function IconRefresh(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Icon>
  );
}

// Tutor Sessions
export function IconChat(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Icon>
  );
}

// --- Today's Legal Practice cards ---

// Case of the Day
export function IconGavel(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 21h18" />
      <path d="M14 16v3.5" />
      <path d="M10 12l4 4 4-4-4-4z" />
    </Icon>
  );
}

// Term of the Day
export function IconBookmark(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

// Question of the Day
export function IconQuestion(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

// Issue-Spotting Prompt / Issue Spotter
export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </Icon>
  );
}

// Suggested Focus
export function IconTarget(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  );
}

// --- Quick Actions ---

// New Case Brief
export function IconFilePlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15h6" />
    </Icon>
  );
}

// Cite-Check Text
export function IconCheckCircle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </Icon>
  );
}

// Compare Cases
export function IconColumns(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
      <path d="M12 3v18" />
    </Icon>
  );
}