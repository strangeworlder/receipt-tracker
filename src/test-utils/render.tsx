/**
 * Shared test render wrapper.
 *
 * Re-exports render, fireEvent, screen, and waitFor from
 * @testing-library/react-native so consumers import from one place.
 * Wrap with providers here as needed in the future.
 */
export { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
