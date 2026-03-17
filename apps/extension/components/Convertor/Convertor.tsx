import "@/assets/tailwind.css";
import { ReactNode } from "react";
import "./Convertor.css";

export type ConverterShellVariant = "popup" | "selection";

type Props = {
  variant: ConverterShellVariant;
  title?: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

export const ConvertorHOD = ({
  variant,
  title = "FX INLINE",
  headerActions,
  children,
}: Props) => {
  return (
    <section className={`ccx-theme ccx-shell ccx-shell--${variant}`}>
      <div className="ccx-shell__inner">
        <header className="ccx-shell__header">
          <h2 className="ccx-shell__title">{title}</h2>
          {headerActions ? (
            <div className="ccx-shell__header-actions">{headerActions}</div>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
};
