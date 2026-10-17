// ============================
// Egyptian National ID Validator
// ============================
// Format: C YY MM DD GG SSSS X
// C = Century (2 for 1900s, 3 for 2000s)
// ============================

const VALID_GOVERNORATES = [
  1, 2, 3, 4,
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 23, 24, 25, 26, 27, 28, 29,
  31, 32, 33, 34, 35
];

function validateEgyptianNationalID(id) {
  if (typeof id !== 'string') return false;
  if (!/^\d{14}$/.test(id)) return false;

  const century = parseInt(id[0]);
  if (century !== 2 && century !== 3) return false;

  const year = parseInt(id.substring(1, 3));
  if (year < 0 || year > 99) return false;

  const month = parseInt(id.substring(3, 5));
  if (month < 1 || month > 12) return false;

  const day = parseInt(id.substring(5, 7));
  if (day < 1 || day > 31) return false;

  const gov = parseInt(id.substring(7, 9));
  if (!VALID_GOVERNORATES.includes(gov)) return false;

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(id[i]);
    if (i % 2 === 0) {
      sum += digit * 2;
      if (digit * 2 > 9) sum -= 9;
    } else {
      sum += digit;
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== parseInt(id[13])) return false;

  return true;
}

module.exports = { validateEgyptianNationalID };