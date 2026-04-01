import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@/test-utils/render";

// Minimal sanity check that the custom render wrapper works.
// The real value of this module is re-exporting testing-library
// helpers so consumers don't need to import from two places.

test("render wrapper renders children", () => {
  render(<Text>Hello TripTrack</Text>);
  expect(screen.getByText("Hello TripTrack")).toBeTruthy();
});

test("fireEvent is re-exported and callable", () => {
  let pressed = false;
  const { getByText } = render(
    <Text onPress={() => (pressed = true)}>Press me</Text>
  );
  fireEvent.press(getByText("Press me"));
  expect(pressed).toBe(true);
});
