import {
  safeContactHref,
  safePhoneHref,
  type ManagerContact,
} from "../shared/workplace";

// Public workplace information, never API credentials. Replace with verified
// workplace contact details and set demo:false before enabling a real connection.
const manager = {
  name: "Duty manager",
  phone: "123456",
  contactLabel: "HIGH_RISK_FAST.com",
  contactUrl: "",
  demo: true,
};

export function getManagerContact(): ManagerContact {
  return {
    name: manager.name,
    phone: manager.phone,
    contactLabel: manager.contactLabel,
    demo: manager.demo,
    phoneHref: manager.demo ? null : safePhoneHref(manager.phone),
    contactHref: manager.demo ? null : safeContactHref(manager.contactUrl),
  };
}
