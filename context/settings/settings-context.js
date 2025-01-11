'use client'
import { createContext , useContext } from "react"

export const SettingsContext = createContext({});//creating instance of createContext named as settingsContext

export const useSettings = () => {
    const context=useContext(SettingsContext);//using the created context 

    if(!context){
        throw new Error('useSettings must be used within a SettingsProvider');//throw error if context used outside the provider
    }
    return context;
}
