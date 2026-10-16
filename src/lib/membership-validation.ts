export type MembershipContactType = "whatsapp" | "email";

export type MembershipValidationTarget =
  | "member-alias"
  | "member-contact"
  | "member-photo-section"
  | "member-signature-section";

export type MembershipValidationIssue = {
  code: "ALIAS" | "CONTACT" | "PHOTO" | "SIGNATURE";
  target: MembershipValidationTarget;
  message: string;
};

export function validateMembershipForm(input: {
  alias: string;
  contactType: MembershipContactType;
  contactValue: string;
  hasPhoto: boolean;
  hasSignature: boolean;
}): MembershipValidationIssue | null {
  const alias = input.alias.trim();
  if (alias.length < 2 || alias.length > 20) {
    return {
      code: "ALIAS",
      target: "member-alias",
      message: "O CODINOME TEM DE TER ENTRE 2 E 20 CARACTERES.",
    };
  }

  const contact = input.contactValue.trim();
  if (input.contactType === "email") {
    const validEmail = /^[^\s@]+@[^.\s@]+(?:\.[^.\s@]+)+$/.test(contact);
    if (!validEmail) {
      return {
        code: "CONTACT",
        target: "member-contact",
        message: "INTRODUZ UM ENDEREÇO DE EMAIL VÁLIDO.",
      };
    }
  } else {
    const digits = contact.replace(/[^0-9]/g, "");
    if (digits.length < 5 || /[^0-9 .()+-]/.test(contact)) {
      return {
        code: "CONTACT",
        target: "member-contact",
        message: "INTRODUZ UM NÚMERO DE WHATSAPP VÁLIDO.",
      };
    }
  }

  if (!input.hasPhoto) {
    return {
      code: "PHOTO",
      target: "member-photo-section",
      message: "CARREGA UMA FOTOGRAFIA ANTES DE ASSINAR.",
    };
  }

  if (!input.hasSignature) {
    return {
      code: "SIGNATURE",
      target: "member-signature-section",
      message: "DESENHA A TUA ASSINATURA NO CAMPO INDICADO.",
    };
  }

  return null;
}
