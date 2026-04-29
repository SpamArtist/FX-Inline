import type { ConvertorHodProps } from "./Convertor.types";

export type { ConverterShellVariant } from "./Convertor.types";

export const ConvertorHOD = ({
  variant,
  title = "FX INLINE",
  headerActions,
  children,
}: ConvertorHodProps) => {
  const shellClassName = `fx-inline-theme fx-inline-shell fx-inline-shell--${variant}`;

  return (
    <section className={shellClassName}>
      <div className="fx-inline-shell__inner">
        <header className="fx-inline-shell__header">
          <h2 className="fx-inline-shell__title">{title}</h2>
          {headerActions && (
            <div className="fx-inline-shell__header-actions">{headerActions}</div>
          )}
        </header>
        {children}
      </div>
    </section>
  );
};
