// Fill the bank fields from the password manager. Do not commit the values.
const required = [
  'ANEEVERSE_BANK_NAME',
  'ANEEVERSE_BANK_NUMBER',
  'ANEEVERSE_BANK_IFSC',
  'ANEEVERSE_BANK_TYPE',
  'ANEEVERSE_BANK_BANK'
]
const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.error('Missing ' + missing.join(', '))
  console.error('Enter the same fields on the invoice Billed by form. This script does not write them.')
  process.exit(1)
}
console.log('Bank fields are present in the environment. Enter them on the invoice Billed by form.')
