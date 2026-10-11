import assert from "node:assert/strict";
import test from "node:test";
import { getManagerContact } from "../server/workplace";
import { safeContactHref, safePhoneHref } from "../shared/workplace";

test("fictional manager details cannot create a call or external connection", () => {
  const contact = getManagerContact();
  assert.equal(contact.demo, true);
  assert.equal(contact.phone, "123456");
  assert.equal(contact.contactLabel, "HIGH_RISK_FAST.com");
  assert.equal(contact.phoneHref, null);
  assert.equal(contact.contactHref, null);
});
test("real contact links accept only a complete phone number or HTTPS destination", () => {
  assert.equal(safePhoneHref("+44 (20) 7946 0123"), "tel:+442079460123");
  for (const value of [
    "123456",
    "911",
    "javascript:alert(1)",
    "+123456789;ext=99",
  ])
    assert.equal(safePhoneHref(value), null);
  assert.equal(
    safeContactHref("https://example.com/manager"),
    "https://example.com/manager",
  );
  for (const value of [
    "HIGH_RISK_FAST.com",
    "javascript:alert(1)",
    "http://example.com",
    "https://user:password@example.com",
  ])
    assert.equal(safeContactHref(value), null);
});
