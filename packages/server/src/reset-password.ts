import fs from "node:fs";
import readline from "node:readline";
import type { Readable, Writable } from "node:stream";
import { RESET_CONFIRM_WORDS } from "./constants";
import { m } from "./messages";
import { authFile, clearStoredPassword } from "./password-store";

/**
 * The forgotten password (npm run reset-password, run on the computer itself): after a yes in the terminal it removes the password
 * set in the panel, so the next start is the first run again. The database, the uploads and the session key stay. Whether it removed one.
 */
export async function resetPassword(io: { input: Readable; output: Writable }): Promise<boolean> {
  const say = (line: string) => io.output.write(`${line}\n`);
  if (process.env.FF_PASSWORD) say(m.reset.envNote);
  const file = authFile();
  if (!fs.existsSync(file)) {
    say(m.reset.none);
    return false;
  }
  const rl = readline.createInterface({ input: io.input, output: io.output });
  // input that ends before an answer (Ctrl+C, a closed pipe) is a no
  const answer = await new Promise<string>((resolve) => {
    rl.once("close", () => resolve(""));
    rl.question(m.reset.confirm(file), resolve);
  });
  rl.close();
  if (!RESET_CONFIRM_WORDS.includes(answer.trim().toLocaleLowerCase("tr"))) {
    say(m.reset.cancelled);
    return false;
  }
  clearStoredPassword();
  say(m.reset.done);
  return true;
}
