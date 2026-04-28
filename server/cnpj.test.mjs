import test from "node:test";
import assert from "node:assert/strict";
import { hasRequiredBrasilApiPayload, isValidCnpj, onlyDigits } from "./cnpj.mjs";

test("onlyDigits normaliza CNPJ com mascara e caracteres extras", () => {
  assert.equal(onlyDigits(" 11.222.333/0001-81<script>"), "11222333000181");
});

test("isValidCnpj aceita CNPJ valido e rejeita entradas invalidas", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
  assert.equal(isValidCnpj("123"), false);
  assert.equal(isValidCnpj("<script>alert(1)</script>"), false);
});

test("hasRequiredBrasilApiPayload exige CNPJ valido no payload externo", () => {
  assert.equal(hasRequiredBrasilApiPayload({ cnpj: "11222333000181" }), true);
  assert.equal(hasRequiredBrasilApiPayload({ cnpj: "123" }), false);
  assert.equal(hasRequiredBrasilApiPayload({}), false);
  assert.equal(hasRequiredBrasilApiPayload(null), false);
});
