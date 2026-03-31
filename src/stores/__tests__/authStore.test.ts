import { useAuthStore } from "../authStore";
import type { AppUser } from "../../types";

const mockUser: AppUser = {
  uid: "user-1",
  displayName: "Test User",
  email: "test@example.com",
  googleDriveLinked: false,
  createdAt: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  useAuthStore.setState({ user: null, isAnonymous: false, driveLinked: false });
});

describe("authStore initial state", () => {
  it("starts signed out", () => {
    const { user, isAnonymous, driveLinked } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(isAnonymous).toBe(false);
    expect(driveLinked).toBe(false);
  });
});

describe("setUser", () => {
  it("sets a real user and clears anonymous flag", () => {
    useAuthStore.getState().setUser(mockUser, false);
    const { user, isAnonymous } = useAuthStore.getState();
    expect(user).toEqual(mockUser);
    expect(isAnonymous).toBe(false);
  });

  it("sets anonymous state (null user, isAnonymous=true)", () => {
    useAuthStore.getState().setUser(null, true);
    const { user, isAnonymous } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(isAnonymous).toBe(true);
  });

  it("clears user on sign-out (null user, isAnonymous=false)", () => {
    useAuthStore.getState().setUser(mockUser, false);
    useAuthStore.getState().setUser(null, false);
    const { user, isAnonymous } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(isAnonymous).toBe(false);
  });
});

describe("setDriveLinked", () => {
  it("sets driveLinked to true", () => {
    useAuthStore.getState().setDriveLinked(true);
    expect(useAuthStore.getState().driveLinked).toBe(true);
  });

  it("sets driveLinked to false", () => {
    useAuthStore.setState({ driveLinked: true });
    useAuthStore.getState().setDriveLinked(false);
    expect(useAuthStore.getState().driveLinked).toBe(false);
  });
});
