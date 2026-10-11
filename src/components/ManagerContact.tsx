import { useEffect, useRef, useState } from "react";
import { Phone, ExternalLink, X } from "lucide-react";
import {
  safeContactHref,
  safePhoneHref,
  type ManagerContact as Contact,
} from "../../shared/workplace";
import { isRecord } from "../../shared/validation";

export function ManagerContact({ urgent = false }: { urgent?: boolean }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    setContact(null);
    setError("");
    void fetch("/api/workplace", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value: unknown = await response.json();
        if (
          !isRecord(value) ||
          typeof value.name !== "string" ||
          typeof value.phone !== "string" ||
          typeof value.contactLabel !== "string" ||
          typeof value.demo !== "boolean" ||
          !(value.phoneHref === null || typeof value.phoneHref === "string") ||
          !(value.contactHref === null || typeof value.contactHref === "string")
        )
          throw new Error();
        if (active && !controller.signal.aborted)
          setContact(value as unknown as Contact);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load the manager contact. Use your usual workplace contact channel.",
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, reload]);
  const phoneHref =
    contact &&
    !contact.demo &&
    contact.phoneHref === safePhoneHref(contact.phone)
      ? contact.phoneHref
      : null;
  const contactHref =
    contact && !contact.demo && contact.contactHref
      ? safeContactHref(contact.contactHref)
      : null;
  return (
    <>
      <button
        className={`button ${urgent ? "urgent-button" : "primary"}`}
        onClick={() => setOpen(true)}
      >
        <Phone size={16} /> Contact Manager
      </button>
      <dialog
        ref={dialog}
        className="modal"
        aria-label="Contact manager"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <div className="modal-header">
          <span className="page-eyebrow">
            <Phone size={17} /> MANAGER CONTACT
          </span>
          <button
            className="icon-button"
            aria-label="Close manager contact"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <h2>{urgent ? "Get help now" : "Contact your manager"}</h2>
        {urgent && (
          <p className="contact-emergency">
            If anyone is in immediate danger, follow your workplace emergency
            procedure and contact local emergency services. Do not wait for a
            manager reply.
          </p>
        )}
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry contact
            </button>
          </div>
        ) : !contact ? (
          <p role="status">Loading contact…</p>
        ) : (
          <>
            <div className="contact-details">
              <strong>{contact.name}</strong>
              <p>Phone: {contact.phone}</p>
              <p>Contact: {contact.contactLabel}</p>
            </div>
            {contact.demo ? (
              <div className="information-note">
                Demo contact only. 123456 and HIGH_RISK_FAST.com are fictional
                placeholders. Calls and external links are disabled. Use your
                real workplace contact channel in an emergency.
              </div>
            ) : (
              <p className="source-meta">
                These buttons open your phone or contact app. They do not
                confirm that a manager has received your request.
              </p>
            )}
            <div className="modal-actions">
              {phoneHref ? (
                <a className="button primary" href={phoneHref}>
                  <Phone size={16} /> Call manager
                </a>
              ) : (
                <button className="button primary" disabled>
                  <Phone size={16} /> Call manager{" "}
                  {contact.demo ? "(demo)" : "unavailable"}
                </button>
              )}
              {contactHref ? (
                <a
                  className="button secondary"
                  href={contactHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} /> Open manager contact
                </a>
              ) : (
                <button className="button secondary" disabled>
                  Open contact {contact.demo ? "(demo)" : "unavailable"}
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
