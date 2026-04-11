import { ActionType, CurrencyCode } from "./enums";

export interface ICurrencyState {
  id?: string;
  code: CurrencyCode;
  amount: string;
  icon?: string;
  seq: number;
}

export interface IDispatchAction {
  type: ActionType;
  payload: {
    id?: string;
    amount?: string;
    currency?: CurrencyCode;
  };
}

export type CurrencyState = ICurrencyState;
export type DispatchAction = IDispatchAction;
