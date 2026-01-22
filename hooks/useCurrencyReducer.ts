import { INITIAL_STATE, reducer } from "@/lib/reducer";
import { useReducer } from "react";

export const useCurrencyReducer = () => useReducer(reducer, INITIAL_STATE);
