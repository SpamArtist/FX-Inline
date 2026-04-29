import type { ComponentChildren } from "preact";

export type ConverterShellVariant = "popup" | "selection";

export type ConvertorHodProps = {
  variant: ConverterShellVariant;
  title?: string;
  headerActions?: ComponentChildren;
  children: ComponentChildren;
};
