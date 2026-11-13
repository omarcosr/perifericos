import { createTheme, darkTheme, lightTheme } from "@tarve/core";

const dark = createTheme({ colors: {
  background: "#11151c", card: "#1a202a", foreground: "#f2f5f9", muted: "#222a37", mutedForeground: "#aab8ca",
  input: "#151b24", border: "#354153", disabled: "#242d3b", disabledForeground: "#8292a8", placeholder: "#9baac0",
  scrollbar: "#596b83", sliderThumb: "#f3f7fa", success: "#83d9ae", successMuted: "#1d3a32", destructiveText: "#ffa6a3",
} }, darkTheme);
const light = createTheme({ colors: {
  background: "#eef1f5", card: "#ffffff", foreground: "#182333", muted: "#e9eef4", mutedForeground: "#506078",
  input: "#f8fafc", border: "#d4dce7", disabled: "#e7ecf2", disabledForeground: "#606f84", placeholder: "#596a81",
  scrollbar: "#8d9caf", sliderThumb: "#ffffff", success: "#1b694d", successMuted: "#e4f3e9", destructiveText: "#a02b31",
} }, lightTheme);

export const panelTheme = {
  headset: {
    dark: createTheme({ colors: {
      primary: "#8bbcff", primaryForeground: "#10243f", primaryHover: "#a7ccff", primaryActive: "#72abfa",
      secondary: "#2a4261", secondaryForeground: "#ddecff", secondaryHover: "#344f70", secondaryActive: "#3c5a81",
      ring: "#a4cbff", selection: "#385889",
    } }, dark),
    light: createTheme({ colors: {
      primary: "#245eb0", primaryForeground: "#ffffff", primaryHover: "#1d519a", primaryActive: "#174580",
      secondary: "#dce9fb", secondaryForeground: "#1c497f", secondaryHover: "#cedff6", secondaryActive: "#bfd6f1",
      ring: "#245eb0", selection: "#bcd5fa",
    } }, light),
    photoDark: "#46607d", photoLight: "#b5cce8",
  },
  mouse: {
    dark: createTheme({ colors: {
      primary: "#87d8b2", primaryForeground: "#0e3024", primaryHover: "#a2e5c5", primaryActive: "#71c8a0",
      secondary: "#27473e", secondaryForeground: "#d1f1e1", secondaryHover: "#2f564a", secondaryActive: "#386556",
      ring: "#a0e4c3", selection: "#355d51",
    } }, dark),
    light: createTheme({ colors: {
      primary: "#14644d", primaryForeground: "#ffffff", primaryHover: "#10543f", primaryActive: "#0b4734",
      secondary: "#d9eee5", secondaryForeground: "#195542", secondaryHover: "#cae7da", secondaryActive: "#bcdfd0",
      ring: "#14644d", selection: "#b4decc",
    } }, light),
    photoDark: "#4b6a61", photoLight: "#b5d8c9",
  },
};
