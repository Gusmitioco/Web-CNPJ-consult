export function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isValidCnpj(value) {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const calcDigit = (base) => {
    let weight = base.length - 7;
    let sum = 0;

    for (const digit of base) {
      sum += Number(digit) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }

    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = calcDigit(cnpj.slice(0, 12));
  const second = calcDigit(cnpj.slice(0, 12) + first);

  return cnpj.endsWith(`${first}${second}`);
}

export function hasRequiredBrasilApiPayload(payload) {
  return Boolean(payload && typeof payload === "object" && typeof payload.cnpj === "string" && onlyDigits(payload.cnpj).length === 14);
}
