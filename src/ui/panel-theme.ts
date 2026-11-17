import { createTheme, darkTheme, lightTheme } from "@tarve/core";

export const panelTheme = {
  dark: createTheme({ colors: {
    background: "#18191d", card: "#222328", foreground: "#f3f2f6", muted: "#373841", mutedForeground: "#b8b8c5",
    input: "#2c2d34", border: "#3d3e48", disabled: "#30313a", disabledForeground: "#9e9daf", placeholder: "#aaaabb",
    scrollbar: "#646473", success: "#8bd5ad", destructiveText: "#ffabaf",
    primary: "#b3b5ff", primaryForeground: "#1a1b33", primaryHover: "#c7c8ff", primaryActive: "#a0a4fa",
    secondary: "#383b61", secondaryForeground: "#e3e4ff", secondaryHover: "#464a73", secondaryActive: "#505481",
    ring: "#c0c2ff", selection: "#4b4d83",
  } }, darkTheme),
  light: createTheme({ colors: {
    background: "#eeedf1", card: "#fbfafc", foreground: "#23232d", muted: "#dfdee7", mutedForeground: "#555566",
    input: "#e7e6ed", border: "#d3d2dc", disabled: "#e8e7ee", disabledForeground: "#666577", placeholder: "#616073",
    scrollbar: "#8b899b", success: "#276747", destructiveText: "#992f42",
    primary: "#464bb0", primaryForeground: "#ffffff", primaryHover: "#393e99", primaryActive: "#2b317c",
    secondary: "#e1e1fc", secondaryForeground: "#383d92", secondaryHover: "#d5d5f4", secondaryActive: "#c9c9ed",
    ring: "#4b50b6", selection: "#cbcdf9",
  } }, lightTheme),
};
