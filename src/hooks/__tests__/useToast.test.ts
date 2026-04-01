import { act } from "@testing-library/react-native";
import { useToast } from "@/hooks/useToast";

afterEach(() => {
  // Reset store between tests
  useToast.setState({ visible: false, message: "", variant: "info" });
});

test("showToast sets visible=true with message and variant", () => {
  act(() => {
    useToast.getState().showToast("Saved!", "success");
  });

  const state = useToast.getState();
  expect(state.visible).toBe(true);
  expect(state.message).toBe("Saved!");
  expect(state.variant).toBe("success");
});

test("showToast defaults variant to info", () => {
  act(() => {
    useToast.getState().showToast("Hello");
  });

  expect(useToast.getState().variant).toBe("info");
});

test("hideToast sets visible=false", () => {
  act(() => {
    useToast.getState().showToast("Something");
    useToast.getState().hideToast();
  });

  expect(useToast.getState().visible).toBe(false);
});
