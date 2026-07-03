import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppButton } from "../AppButton";

vi.mock("../../../hooks/useRBAC", () => ({
  useRBAC: () => ({ can: () => true, checkAccess: () => true }),
}));

describe("AppButton", () => {
  it("disabled + disabledReason: hover shows Tooltip", async () => {
    render(
      <AppButton disabled disabledReason="Please select one item first">
        Delete
      </AppButton>
    );
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn).toBeDisabled();
    await userEvent.hover(btn);
    const tip = await screen.findByText("Please select one item first", {}, { timeout: 2000 });
    expect(tip).toBeInTheDocument();
  });

  it("disabled without reason: button still disabled", () => {
    render(<AppButton disabled>Delete</AppButton>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn).toBeDisabled();
  });

  it("loading: button disabled, loading icon present", () => {
    const { container } = render(<AppButton loading>Submit</AppButton>);
    const btn = screen.getByRole("button", { name: /Submit/ });
    expect(btn).toBeDisabled();
    expect(container.querySelector(".ant-btn-loading")).toBeInTheDocument();
  });

  it("default type=button to prevent form submit", () => {
    render(<AppButton>Submit</AppButton>);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("htmlType=submit explicit", () => {
    render(<AppButton htmlType="submit">Submit</AppButton>);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn).toHaveAttribute("type", "submit");
  });
});