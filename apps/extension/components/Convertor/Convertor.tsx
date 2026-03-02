import "@/assets/tailwind.css";
import { ReactNode } from "react";
import "./Convertor.css";

type Props = {
  shouldDisplayHeader: boolean;
  children: ReactNode;
};

export const ConvertorHOD = ({ shouldDisplayHeader, children }: Props) => {
  return (
    <div
      className={`bg-[darkslategray] text-[wheat] h-max flex flex-col gap-[0.8em] ${shouldDisplayHeader ? "" : "rounded-md pt-[0.3em] pb-[0.875em] rounded-tl-none"}`}
    >
      {shouldDisplayHeader && (
        <div className="py-2.5">
          <h2 className="font-[system-ui]">Currency Convertor</h2>
        </div>
      )}
      {children}
    </div>
  );
};
