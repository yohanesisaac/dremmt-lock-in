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

function renderInvite() {
  return render(
    <InviteForm
      token="token-abc12345"
      options={options}
      initiatorName="Yohannes"
      restaurantName="Esme"
    />,
  );
}

describe("InviteForm", () => {
  it("renders the invitation card heading", () => {
    renderInvite();
    expect(
      screen.getByRole("heading", {
        name: "Yohannes wants to go to Esme with you.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dremmt run")).toBeInTheDocument();
    expect(screen.getByText("Pick what works:")).toBeInTheDocument();
  });

  it("keeps I'm in disabled until a time is selected", () => {
    renderInvite();
    const button = screen.getByRole("button", { name: "I'm in" });
    expect(button).toBeDisabled();
  });

  it("enables I'm in after a time is selected", async () => {
    const user = userEvent.setup();
    renderInvite();

    await user.click(
      screen.getByRole("radio", { name: "Tuesday · 12–2 PM" }),
    );
    expect(screen.getByRole("button", { name: "I'm in" })).toBeEnabled();
  });

  it("selects a time when the whole row is clicked", async () => {
    const user = userEvent.setup();
    renderInvite();

    const row = screen.getByRole("radio", { name: "Thursday · 5–7 PM" });
    await user.click(row);
    expect(row).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "I'm in" })).toBeEnabled();
  });

  it("keeps phone and consent inside the card before I'm in", () => {
    renderInvite();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(
      screen.getByText("I agree to receive texts from Dremmt about this plan."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/at least \$6 toward the outing is locked/i),
    ).toBeInTheDocument();
  });
});
