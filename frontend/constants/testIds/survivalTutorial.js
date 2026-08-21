// Test IDs for the survival tutorial feature (guide entry + overlay screen) —
// consumed via React Native's `testID` prop. See ./index.js for the recipe.

export const SURVIVAL_TUTORIAL = {
  openButton: "survival-tutorial-open-button",
  screen: "survival-tutorial-screen",
  backdrop: "survival-tutorial-backdrop",
  closeButton: "survival-tutorial-close-button",
  filterAllButton: "survival-tutorial-filter-all-button",
  filterUrgentButton: "survival-tutorial-filter-urgent-button",
  filterOptionalButton: "survival-tutorial-filter-optional-button",
  filterTrickButton: "survival-tutorial-filter-trick-button",
  filterFirstaidButton: "survival-tutorial-filter-firstaid-button",
  filterWaterButton: "survival-tutorial-filter-water-button",
  filterSignalButton: "survival-tutorial-filter-signal-button",
  card: (itemId: string) => `survival-tutorial-${itemId}-card`,
  cardToggle: (itemId: string) => `survival-tutorial-${itemId}-card-toggle`,
  cardPriority: (itemId: string) => `survival-tutorial-${itemId}-card-priority`,
  cardSteps: (itemId: string) => `survival-tutorial-${itemId}-card-steps`,
};
