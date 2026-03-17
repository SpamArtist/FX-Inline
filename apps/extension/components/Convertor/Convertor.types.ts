import type { ReactNode } from "react";

export type ConverterShellVariant = "popup" | "selection";

export type ConvertorHodProps = {
  variant: ConverterShellVariant;
  title?: string;
  headerActions?: ReactNode;
  children: ReactNode;
};
