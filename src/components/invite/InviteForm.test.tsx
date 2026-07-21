import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteForm } from "./InviteForm";

vi.mock("@/app/invite/[token]/actions", () => ({
  acceptRun: vi.fn(async () => ({})),
  declineRun: vi.fn(async () => undefined),
}));

const options = [
  { value: 1 as const, label: "Tuesday · 12–2 PM" },
  { value: 2 as const, label: "Thursday · 5–7 PM" },
];

describe("InviteForm", () => {
  it("keeps I'm in disabled until a time is selected", () => {
    render(<InviteForm token="token-abc12345" options={options} />);
    const button = screen.getByRole("button", { name: "I'm in" });
    expect(button).toBeDisabled();
  });

  it("enables I'm in after a time is selected", async () => {
    const user = userEvent.setup();
    render(<InviteForm token="token-abc12345" options={options} />);

    await user.click(
      screen.getByRole("radio", { name: "Tuesday · 12–2 PM" }),
    );
    expect(screen.getByRole("button", { name: "I'm in" })).toBeEnabled();
  });

  it("selects a time when the whole row is clicked", async () => {
    const user = userEvent.setup();
    render(<InviteForm token="token-abc12345" options={options} />);

    const row = screen.getByRole("radio", { name: "Thursday · 5–7 PM" });
    await user.click(row);
    expect(row).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "I'm in" })).toBeEnabled();
  });
});
