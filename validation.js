// Server-side input validation (Task 5). The browser checks are only for convenience;
// these checks run on every request, so they cannot be skipped by editing the page.

// Only accept real strings; remove hidden control characters, squash spaces, trim both ends
const clean = v => (typeof v === 'string'
  ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  : '');

const RULES = {
  NAME: /^[A-Za-z][A-Za-z .'-]*$/,
  EMAIL: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/,
  CNIC: /^\d{5}-\d{7}-\d$/,
  REASON: /^[A-Za-z0-9 .,'()\-:;!?\/]+$/,
  DONATION_REF: /^D-\d{4,8}$/,
  BENEFICIARY_REF: /^B-\d{3,8}$/,
  CITIES: ['Faisalabad', 'Lahore', 'Karachi', 'Multan'],
  NEEDS: ['Food', 'Medical', 'Education', 'Shelter'],
  TYPES: ['Zakat', 'Sadaqah', 'General charity'],
  AMOUNT_MIN: 100,
  AMOUNT_MAX: 1000000
};

// Same scoring as the instructor's password_strength_helper.js, so the server
// rejects the same "Weak" passwords the page warns about.
function passwordScore(p) {
  const groups = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter(r => r.test(p)).length;
  return (p.length >= 8) + (p.length >= 12) + (p.length >= 16) + (groups >= 2) + (groups >= 3) + (groups === 4);
}

function validateRegistration(body) {
  const errors = {};
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';   // passwords are never trimmed

  if (!name) errors.name = 'Full name is required.';
  else if (name.length < 3 || name.length > 60) errors.name = 'Full name must be 3 to 60 characters.';
  else if (!RULES.NAME.test(name)) errors.name = 'Name can contain only letters, spaces, . - and apostrophe.';

  if (!email) errors.email = 'Email is required.';
  else if (email.length > 100 || !RULES.EMAIL.test(email)) errors.email = 'Please enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8 || password.length > 64) errors.password = 'Password must be 8 to 64 characters.';
  else if (passwordScore(password) <= 2) errors.password = 'Password is too weak. Use a longer password with more variety.';

  return { errors, value: { name, email, password } };
}

function validateLogin(body) {
  const email = clean(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};
  if (!email) errors.email = 'Email is required.';
  else if (email.length > 100 || !RULES.EMAIL.test(email)) errors.email = 'Please enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length > 64) errors.password = 'Password must be at most 64 characters.';
  return { errors, value: { email, password } };
}

function validateBeneficiary(body) {
  const errors = {};
  const name = clean(body.name);
  const cnic = clean(body.cnic);
  const city = clean(body.city);
  const need = clean(body.need);
  const reason = clean(body.reason);

  if (!name) errors.name = 'Full name is required.';
  else if (name.length < 3 || name.length > 60) errors.name = 'Full name must be 3 to 60 characters.';
  else if (!RULES.NAME.test(name)) errors.name = 'Use letters only (spaces, . - and apostrophe allowed).';

  if (!cnic) errors.cnic = 'CNIC is required.';
  else if (!RULES.CNIC.test(cnic)) errors.cnic = 'Enter a valid CNIC like 12345-1234567-1.';

  if (!RULES.CITIES.includes(city)) errors.city = 'Please choose a city from the list.';
  if (!RULES.NEEDS.includes(need)) errors.need = 'Please choose a need from the list.';

  if (!reason) errors.reason = 'Please give a short reason.';
  else if (reason.length < 10 || reason.length > 200) errors.reason = 'Reason must be 10 to 200 characters.';
  else if (!RULES.REASON.test(reason)) errors.reason = "Reason can contain only letters, numbers, spaces and . , - ' ( ) : ; ! ? /";

  return { errors, value: { name, cnic, city, need, reason } };
}

function validateDonation(body) {
  const errors = {};
  const orgId = Number(body.orgId);
  const type = clean(body.type);
  const note = clean(body.note);
  const anonymous = body.anonymous === true;
  // Amount must be a whole number given as a number or as digits only
  const amountOk = (typeof body.amount === 'number' && Number.isInteger(body.amount)) ||
                   (typeof body.amount === 'string' && /^\d{1,7}$/.test(body.amount));
  const amount = amountOk ? Number(body.amount) : NaN;

  if (!Number.isInteger(orgId) || orgId < 1) errors.orgId = 'Please select an organization.';
  if (!RULES.TYPES.includes(type)) errors.type = 'Please choose a donation type from the list.';
  if (!amountOk) errors.amount = 'Amount must be a whole number.';
  else if (amount < RULES.AMOUNT_MIN || amount > RULES.AMOUNT_MAX) errors.amount = 'Amount must be between Rs. 100 and Rs. 1,000,000.';
  if (note.length > 100) errors.note = 'Message must be at most 100 characters.';
  if (body.anonymous !== undefined && typeof body.anonymous !== 'boolean') errors.anonymous = 'Invalid value for anonymous.';

  return { errors, value: { orgId, type, amount, note, anonymous } };
}

const hasErrors = e => Object.keys(e).length > 0;

module.exports = { clean, RULES, passwordScore, validateRegistration, validateLogin, validateBeneficiary, validateDonation, hasErrors };
