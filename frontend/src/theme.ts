export const colors = {
  primary: "#9C2A25",
  onPrimary: "#FFFFFF",
  primaryContainer: "#FFDAD6",
  onPrimaryContainer: "#410003",
  secondary: "#775652",
  secondaryContainer: "#FFDAD6",
  tertiary: "#705C2E",
  surface: "#FFF8F7",
  surfaceSoft: "#F7F2F0",
  surfaceContainer: "#F3EDEB",
  surfaceContainerHigh: "#EDE7E5",
  ink: "#211A19",
  inkSoft: "#534341",
  border: "#D8C2BF",
  outline: "#857370",
  brand: "#9C2A25",
  brandSoft: "#FFDAD6",
  warning: "#8A5100",
  success: "#286C2E",
  info: "#3F5F90",
  mapLand: "#EAE4DC",
  mapRoad: "#FFFFFF",
  mapWater: "#B8D5E5",
  dark: "#211A19",
} as const;

export const shadow = {
  shadowColor: "#211A19",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.16,
  shadowRadius: 7,
  elevation: 3,
} as const;

export const radius = { small: 8, medium: 12, large: 16, extraLarge: 28, full: 999 } as const;

export const zIndex = {
  bottomNav: 10,
  toast: 50,
  overlay: 100,
} as const;