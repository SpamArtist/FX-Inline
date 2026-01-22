import PlusIcon from '@/assets/add_outline.svg';
import SwapVerticalIcon from '@/assets/swap_vertical_outline.svg';
import "@/assets/tailwind.css";
import CurrencyBox from '@/components/CurrencyBox/CurrencyBox';
import { ReactNode, useReducer } from 'react';
import './Convertor.css';
import { INITIAL_STATE, reducer } from '@/lib/reducer';

type Props = {
  children: ReactNode
}

export const ConvertorHOD = ({ children }: Props) => {
  return (
    <main className='bg-[darkslategray] text-[wheat] h-max'>
      <header className='py-2.5'>
        <h2 className='font-[system-ui]'>
          Currency Convertor
        </h2>
      </header>
      <div className='relative flex flex-col items-center mb-2.5 mx-2.5 pb-[1.2em] py-0 bg-inherit text-[wheat]'>
        {children}
      </div>
    </main>
  )
}
