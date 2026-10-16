// Forgotten password: npm run reset-password (after npm run build). Asks in the terminal, then removes the password set in the
// panel so the next start asks for a name and a new password again. Records are never touched.
const { loadRootEnv } = require("../packages/core/dist/index.js");
loadRootEnv();
require("../packages/server/dist/reset-password.js")
  .resetPassword({ input: process.stdin, output: process.stdout })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
