function validateEgyptianNationalID(id) {
  // 1. لازم يكون 14 رقم بالظبط
  if (typeof id !== 'string' || !/^\d{14}$/.test(id)) return false;

  // 2. أول رقم (القرن): 2 = 1900s, 3 = 2000s
  const century = parseInt(id[0]);
  if (century !== 2 && century !== 3) return false;

  // 3. الشهر واليوم
  const month = parseInt(id.substring(3, 5));
  const day = parseInt(id.substring(5, 7));
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 4. كود المحافظة (بنشوف لو رقم المحافظة صح)
  const validGovernorates = [
    1, 2, 3, 4, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35
  ];
  const gov = parseInt(id.substring(7, 9));
  if (!validGovernorates.includes(gov)) return false;

  // 5. التحقق من الرقم الأخير (تم تعطيله مؤقتاً للتجربة)
  // let sum = 0;
  // for (let i = 0; i < 13; i++) {
  //   let digit = parseInt(id[i]);
  //   if (i % 2 === 0) {
  //     digit *= 2;
  //     if (digit > 9) digit -= 9;
  //   }
  //   sum += digit;
  // }
  // const checkDigit = (10 - (sum % 10)) % 10;
  // if (checkDigit !== parseInt(id[13])) return false;

  return true; // هيقبل طول ما الشكل والمحافظة صح
}

module.exports = { validateEgyptianNationalID };