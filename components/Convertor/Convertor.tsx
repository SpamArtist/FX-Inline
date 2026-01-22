import "@/assets/tailwind.css";
import { ReactNode } from "react";
import "./Convertor.css";

type Props = {
  children: ReactNode;
};

export const ConvertorHOD = ({ children }: Props) => {
  return (
    <main className="bg-[darkslategray] text-[wheat] h-max">
      <header className="py-2.5">
        <h2 className="font-[system-ui]">Currency Convertor</h2>
      </header>
      <div className="relative flex flex-col items-center mb-2.5 mx-2.5 pb-[1.2em] py-0 bg-inherit text-[wheat]">
        {children}
      </div>
    </main>
  );
};
