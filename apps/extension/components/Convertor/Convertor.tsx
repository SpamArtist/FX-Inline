import type { ConvertorHodProps } from "./Convertor.types";
import "./Convertor.css";

export type { ConverterShellVariant } from "./Convertor.types";

export const ConvertorHOD = ({
  variant,
  title = "FX INLINE",
  headerActions,
  children,
}: ConvertorHodProps) => {
  return (
    <section className={`ccx-theme ccx-shell ccx-shell--${variant}`}>
      <div className="ccx-shell__inner">
        <header className="ccx-shell__header">
          <h2 className="ccx-shell__title">{title}</h2>
          {headerActions && (
            <div className="ccx-shell__header-actions">{headerActions}</div>
          )}
        </header>
        {children}
      </div>
    </section>
  );
};
